import * as pty from 'node-pty';
import { platform } from 'node:os';

const MAX_BUFFER_SIZE = 100_000;
const MAX_BUFFER_CHUNKS = 1000;

export class PtyManager {
  constructor() {
    this.terminals = new Map();
  }

  createTerminal(config = {}) {
    const id = `pty-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const shell = config.shell || (platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash');
    const shellArgs = config.shellArgs || (platform() === 'win32' ? [] : ['-l']);

    const proc = pty.spawn(shell, shellArgs, {
      name: 'xterm-256color',
      cols: config.cols || 80,
      rows: config.rows || 24,
      cwd: config.cwd || process.env.HOME || '/tmp',
      env: { ...process.env, ...config.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
    });

    const managed = {
      id,
      process: proc,
      config,
      buffer: [],
      bufferSize: 0,
      clients: new Set(),
      createdAt: Date.now(),
      lastDataAt: Date.now(),
      isDead: false,
    };

    proc.onData((data) => {
      managed.lastDataAt = Date.now();
      managed.buffer.push(data);
      managed.bufferSize += data.length;
      while (managed.bufferSize > MAX_BUFFER_SIZE && managed.buffer.length > 1) {
        const removed = managed.buffer.shift();
        managed.bufferSize -= removed.length;
      }
      while (managed.buffer.length > MAX_BUFFER_CHUNKS) {
        const removed = managed.buffer.shift();
        managed.bufferSize -= removed.length;
      }
      for (const ws of managed.clients) {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'data', id, data }));
        }
      }
    });

    proc.onExit(({ exitCode, signal }) => {
      managed.isDead = true;
      for (const ws of managed.clients) {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'exit', id, exitCode, signal }));
        }
      }
    });

    this.terminals.set(id, managed);
    return id;
  }

  write(id, data) {
    const t = this.terminals.get(id);
    if (t && !t.isDead) t.process.write(data);
  }

  resize(id, cols, rows) {
    const t = this.terminals.get(id);
    if (t && !t.isDead) t.process.resize(cols, rows);
  }

  kill(id) {
    const t = this.terminals.get(id);
    if (t) {
      t.process.kill();
      this.terminals.delete(id);
    }
  }

  subscribe(id, ws) {
    const t = this.terminals.get(id);
    if (t) t.clients.add(ws);
  }

  unsubscribe(id, ws) {
    const t = this.terminals.get(id);
    if (t) t.clients.delete(ws);
  }

  getBuffer(id) {
    const t = this.terminals.get(id);
    if (!t) return '';
    return t.buffer.join('');
  }

  getTerminal(id) {
    return this.terminals.get(id) || null;
  }

  listTerminals() {
    return Array.from(this.terminals.values()).map(t => ({
      id: t.id,
      isDead: t.isDead,
      createdAt: t.createdAt,
      lastDataAt: t.lastDataAt,
      bufferSize: t.bufferSize,
    }));
  }
}
