import { createServer as createHttpServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { PtyManager } from './pty-manager.js';

export function createServer(port) {
  const ptyManager = new PtyManager();

  const httpServer = createHttpServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', terminals: ptyManager.listTerminals().length }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const pathParts = url.pathname.split('/').filter(Boolean);

    if (pathParts[0] !== 'terminals') {
      ws.close(4004, 'Invalid path');
      return;
    }

    const terminalId = pathParts[1];

    if (terminalId) {
      const terminal = ptyManager.getTerminal(terminalId);
      if (!terminal) {
        ws.close(4004, 'Terminal not found');
        return;
      }
      ptyManager.subscribe(terminalId, ws);
    }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleMessage(ptyManager, ws, msg, terminalId);
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', error: e.message }));
      }
    });

    ws.on('close', () => {
      if (terminalId) {
        ptyManager.unsubscribe(terminalId, ws);
      }
    });
  });

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Terminal service listening on port ${port}`);
  });

  return httpServer;
}

function handleMessage(ptyManager, ws, msg, terminalId) {
  switch (msg.type) {
    case 'create': {
      const id = ptyManager.createTerminal(msg.config || {});
      ptyManager.subscribe(id, ws);
      ws.send(JSON.stringify({ type: 'created', id }));
      break;
    }
    case 'input': {
      const id = msg.id || terminalId;
      if (id) ptyManager.write(id, msg.data);
      break;
    }
    case 'resize': {
      const id = msg.id || terminalId;
      if (id) ptyManager.resize(id, msg.cols, msg.rows);
      break;
    }
    case 'kill': {
      const id = msg.id || terminalId;
      if (id) ptyManager.kill(id);
      ws.send(JSON.stringify({ type: 'killed', id }));
      break;
    }
    case 'get-buffer': {
      const id = msg.id || terminalId;
      if (id) {
        const buffer = ptyManager.getBuffer(id);
        ws.send(JSON.stringify({ type: 'buffer', id, data: buffer }));
      }
      break;
    }
    case 'list': {
      const terminals = ptyManager.listTerminals();
      ws.send(JSON.stringify({ type: 'list', data: terminals }));
      break;
    }
    default:
      ws.send(JSON.stringify({ type: 'error', error: `Unknown message type: ${msg.type}` }));
  }
}

// CLI entry
const port = parseInt(process.argv.find(a => a.startsWith('--port='))?.split('=')[1] || process.env.PORT || '8001');
if (import.meta.url === `file://${process.argv[1]}`) {
  createServer(port);
}
