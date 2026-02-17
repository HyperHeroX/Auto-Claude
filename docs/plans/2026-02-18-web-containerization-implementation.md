# Web Containerization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Auto-Claude into a dual-track application (Electron + Web) running in Podman containers with Railway production deployment, including full automated UI testing and visual regression.

**Architecture:** Three-container Compose setup (frontend Nginx+SPA, backend FastAPI+WebSocket, terminal PTY daemon). Shared React components via platform abstraction layer. Playwright E2E + Percy visual regression.

**Tech Stack:** Vite SPA, FastAPI, WebSocket, Podman, Railway, Playwright, Percy, xterm.js, Zustand

---

## Phase 1: Foundation — Shared Module Extraction

### Task 1: Create apps/web directory structure

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`

**Step 1: Create package.json**

```json
{
  "name": "auto-claude-web",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "lint": "biome check src/",
    "lint:fix": "biome check --write src/"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-i18next": "^15.0.0",
    "i18next": "^24.0.0",
    "zustand": "^5.0.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-tooltip": "^1.1.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.0.0",
    "class-variance-authority": "^0.7.0",
    "@xterm/xterm": "^5.5.0",
    "@xterm/addon-fit": "^0.10.0",
    "@xterm/addon-webgl": "^0.18.0",
    "@xterm/addon-web-links": "^0.11.0",
    "motion": "^11.0.0",
    "@dnd-kit/core": "^6.0.0",
    "@dnd-kit/sortable": "^8.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "vitest": "^3.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "jsdom": "^25.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "postcss": "^8.0.0",
    "autoprefixer": "^10.0.0",
    "@biomejs/biome": "^2.0.0",
    "@playwright/test": "^1.52.0",
    "@percy/cli": "^1.0.0",
    "@percy/playwright": "^1.0.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["../frontend/src/renderer/*"],
      "@shared/*": ["../frontend/src/shared/*"],
      "@platform/*": ["src/platform/*"],
      "@components/*": ["../frontend/src/renderer/shared/components/*"],
      "@hooks/*": ["../frontend/src/renderer/shared/hooks/*"],
      "@lib/*": ["../frontend/src/renderer/shared/lib/*"]
    }
  },
  "include": ["src", "../frontend/src/renderer", "../frontend/src/shared"]
}
```

**Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, '../frontend/src/renderer'),
      '@shared': resolve(__dirname, '../frontend/src/shared'),
      '@platform': resolve(__dirname, 'src/platform'),
      '@components': resolve(__dirname, '../frontend/src/renderer/shared/components'),
      '@hooks': resolve(__dirname, '../frontend/src/renderer/shared/hooks'),
      '@lib': resolve(__dirname, '../frontend/src/renderer/shared/lib'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
```

**Step 4: Create index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Auto Claude</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 5: Create src/main.tsx (minimal entry point)**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  return <div>Auto Claude Web - Loading...</div>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 6: Verify it builds**

Run: `cd apps/web && npm install && npm run build`
Expected: Build succeeds, `dist/` directory created

**Step 7: Commit**

```bash
git add apps/web/
git commit -m "feat: scaffold apps/web Vite SPA project"
```

---

### Task 2: Create the Platform Abstraction Layer

**Files:**
- Create: `apps/web/src/platform/types.ts`
- Create: `apps/web/src/platform/api-client.ts`
- Create: `apps/web/src/platform/http-client.ts`
- Create: `apps/web/src/platform/ws-manager.ts`
- Test: `apps/web/src/platform/__tests__/api-client.test.ts`

**Step 1: Write the failing test**

```typescript
// apps/web/src/platform/__tests__/api-client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('PlatformAPI', () => {
  beforeEach(() => {
    // Clear any window.electronAPI mock
    delete (window as any).electronAPI;
  });

  it('should detect web environment when electronAPI is absent', async () => {
    const { isWebEnvironment } = await import('../api-client');
    expect(isWebEnvironment()).toBe(true);
  });

  it('should detect electron environment when electronAPI is present', async () => {
    (window as any).electronAPI = { projects: {} };
    const { isWebEnvironment } = await import('../api-client');
    expect(isWebEnvironment()).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/platform/__tests__/api-client.test.ts`
Expected: FAIL - module not found

**Step 3: Create types.ts**

```typescript
// apps/web/src/platform/types.ts
export interface IPCResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ProjectAPI {
  addProject(projectPath: string): Promise<IPCResult<any>>;
  removeProject(projectId: string): Promise<IPCResult>;
  getProjects(): Promise<IPCResult<any[]>>;
  selectDirectory(): Promise<string | null>;
}

export interface TaskAPI {
  getTasks(projectId: string, options?: { forceRefresh?: boolean }): Promise<IPCResult<any[]>>;
  createTask(projectId: string, title: string, description: string, metadata?: any): Promise<IPCResult<any>>;
  deleteTask(taskId: string): Promise<IPCResult>;
  startTask(taskId: string, options?: any): void;
  stopTask(taskId: string): void;
}

export interface TerminalAPI {
  createTerminal(options: any): Promise<IPCResult>;
  destroyTerminal(id: string): Promise<IPCResult>;
  sendTerminalInput(id: string, data: string): void;
  resizeTerminal(id: string, cols: number, rows: number): Promise<IPCResult<{ success: boolean }>>;
}

export interface SettingsAPI {
  getSettings(): Promise<IPCResult<any>>;
  saveSettings(settings: any): Promise<IPCResult>;
}

export interface PlatformAPI {
  projects: ProjectAPI;
  tasks: TaskAPI;
  terminals: TerminalAPI;
  settings: SettingsAPI;
}
```

**Step 4: Create http-client.ts**

```typescript
// apps/web/src/platform/http-client.ts
import type { IPCResult } from './types';

export class HttpClient {
  constructor(private baseUrl: string) {}

  async get<T>(path: string): Promise<IPCResult<T>> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }
    const data = await res.json();
    return { success: true, data };
  }

  async post<T>(path: string, body?: unknown): Promise<IPCResult<T>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }
    const data = await res.json();
    return { success: true, data };
  }

  async put<T>(path: string, body?: unknown): Promise<IPCResult<T>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }
    const data = await res.json();
    return { success: true, data };
  }

  async delete<T>(path: string): Promise<IPCResult<T>> {
    const res = await fetch(`${this.baseUrl}${path}`, { method: 'DELETE' });
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }
    const data = await res.json();
    return { success: true, data };
  }
}
```

**Step 5: Create ws-manager.ts**

```typescript
// apps/web/src/platform/ws-manager.ts
type MessageHandler = (data: any) => void;

export class WebSocketManager {
  private connections = new Map<string, WebSocket>();
  private handlers = new Map<string, Set<MessageHandler>>();

  constructor(private baseUrl: string) {}

  connect(channel: string): WebSocket {
    if (this.connections.has(channel)) {
      return this.connections.get(channel)!;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}${this.baseUrl}/${channel}`;
    const ws = new WebSocket(url);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const channelHandlers = this.handlers.get(channel);
      if (channelHandlers) {
        channelHandlers.forEach((handler) => handler(data));
      }
    };

    ws.onclose = () => {
      this.connections.delete(channel);
    };

    this.connections.set(channel, ws);
    return ws;
  }

  subscribe(channel: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
    }
    this.handlers.get(channel)!.add(handler);

    // Auto-connect if not connected
    if (!this.connections.has(channel)) {
      this.connect(channel);
    }

    return () => {
      this.handlers.get(channel)?.delete(handler);
      if (this.handlers.get(channel)?.size === 0) {
        this.connections.get(channel)?.close();
        this.connections.delete(channel);
        this.handlers.delete(channel);
      }
    };
  }

  disconnect(channel: string): void {
    this.connections.get(channel)?.close();
    this.connections.delete(channel);
    this.handlers.delete(channel);
  }

  disconnectAll(): void {
    for (const [channel] of this.connections) {
      this.disconnect(channel);
    }
  }
}
```

**Step 6: Create api-client.ts**

```typescript
// apps/web/src/platform/api-client.ts
import type { PlatformAPI, ProjectAPI, TaskAPI, TerminalAPI, SettingsAPI } from './types';
import { HttpClient } from './http-client';
import { WebSocketManager } from './ws-manager';

export function isWebEnvironment(): boolean {
  return typeof (window as any).electronAPI === 'undefined';
}

class WebProjectAPI implements ProjectAPI {
  constructor(private http: HttpClient) {}
  addProject(projectPath: string) { return this.http.post('/projects', { projectPath }); }
  removeProject(projectId: string) { return this.http.delete(`/projects/${projectId}`); }
  getProjects() { return this.http.get('/projects'); }
  async selectDirectory() {
    // Web doesn't have native file dialogs — return null, handled by UI
    return null;
  }
}

class WebTaskAPI implements TaskAPI {
  constructor(private http: HttpClient, private ws: WebSocketManager) {}
  getTasks(projectId: string, options?: { forceRefresh?: boolean }) {
    const query = options?.forceRefresh ? '?forceRefresh=true' : '';
    return this.http.get(`/tasks${query}&projectId=${projectId}`);
  }
  createTask(projectId: string, title: string, description: string, metadata?: any) {
    return this.http.post('/tasks', { projectId, title, description, metadata });
  }
  deleteTask(taskId: string) { return this.http.delete(`/tasks/${taskId}`); }
  startTask(taskId: string, options?: any) {
    this.http.post(`/tasks/${taskId}/execute`, options);
  }
  stopTask(taskId: string) {
    this.http.post(`/tasks/${taskId}/cancel`);
  }
}

class WebTerminalAPI implements TerminalAPI {
  constructor(private http: HttpClient, private ws: WebSocketManager) {}
  createTerminal(options: any) { return this.http.post('/terminals', options); }
  destroyTerminal(id: string) { return this.http.delete(`/terminals/${id}`); }
  sendTerminalInput(id: string, data: string) {
    const conn = this.ws.connect(`terminals/${id}`);
    conn.send(JSON.stringify({ type: 'input', data }));
  }
  resizeTerminal(id: string, cols: number, rows: number) {
    return this.http.post(`/terminals/${id}/resize`, { cols, rows });
  }
}

class WebSettingsAPI implements SettingsAPI {
  constructor(private http: HttpClient) {}
  getSettings() { return this.http.get('/settings'); }
  saveSettings(settings: any) { return this.http.put('/settings', settings); }
}

class WebPlatformAPI implements PlatformAPI {
  private http = new HttpClient('/api/v1');
  private ws = new WebSocketManager('/ws/v1');

  projects = new WebProjectAPI(this.http);
  tasks = new WebTaskAPI(this.http, this.ws);
  terminals = new WebTerminalAPI(this.http, this.ws);
  settings = new WebSettingsAPI(this.http);
}

// Singleton — auto-detects environment
let _api: PlatformAPI | null = null;

export function getApi(): PlatformAPI {
  if (!_api) {
    if (isWebEnvironment()) {
      _api = new WebPlatformAPI();
    } else {
      // Electron — wrap window.electronAPI directly
      _api = (window as any).electronAPI as PlatformAPI;
    }
  }
  return _api;
}

export const api = new Proxy({} as PlatformAPI, {
  get(_, prop) {
    return (getApi() as any)[prop];
  },
});
```

**Step 7: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/platform/__tests__/api-client.test.ts`
Expected: PASS

**Step 8: Commit**

```bash
git add apps/web/src/platform/
git commit -m "feat: add platform abstraction layer for web/electron API switching"
```

---

### Task 3: Create the Terminal WebSocket Service

**Files:**
- Create: `apps/terminal/package.json`
- Create: `apps/terminal/server.js`
- Create: `apps/terminal/pty-manager.js`
- Test: `apps/terminal/__tests__/server.test.js`

**Step 1: Create package.json**

```json
{
  "name": "auto-claude-terminal",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "test": "node --test __tests__/"
  },
  "dependencies": {
    "ws": "^8.18.0",
    "node-pty": "^1.0.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.0"
  }
}
```

**Step 2: Write the failing test**

```javascript
// apps/terminal/__tests__/server.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createServer } from '../server.js';

describe('Terminal WebSocket Server', () => {
  it('should respond to health check', async () => {
    const port = 9901;
    const server = createServer(port);

    try {
      const res = await fetch(`http://localhost:${port}/health`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.status, 'ok');
    } finally {
      server.close();
    }
  });
});
```

**Step 3: Run test to verify it fails**

Run: `cd apps/terminal && node --test __tests__/server.test.js`
Expected: FAIL - module not found

**Step 4: Create server.js**

```javascript
// apps/terminal/server.js
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

    // /terminals/:id — attach to existing terminal
    // /terminals — create new terminal (via message)
    if (pathParts[0] !== 'terminals') {
      ws.close(4004, 'Invalid path');
      return;
    }

    const terminalId = pathParts[1];

    if (terminalId) {
      // Attach to existing terminal
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
```

**Step 5: Create pty-manager.js**

```javascript
// apps/terminal/pty-manager.js
import * as pty from 'node-pty';
import { platform } from 'node:os';

const MAX_BUFFER_SIZE = 100_000;
const MAX_BUFFER_CHUNKS = 1000;

export class PtyManager {
  constructor() {
    /** @type {Map<string, ManagedPty>} */
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
      // Buffer management
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
      // Forward to subscribers
      for (const ws of managed.clients) {
        if (ws.readyState === 1) { // WebSocket.OPEN
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
```

**Step 6: Run test to verify it passes**

Run: `cd apps/terminal && npm install && node --test __tests__/server.test.js`
Expected: PASS

**Step 7: Commit**

```bash
git add apps/terminal/
git commit -m "feat: add standalone terminal WebSocket PTY service"
```

---

## Phase 2: FastAPI Backend

### Task 4: Create FastAPI application skeleton

**Files:**
- Create: `apps/backend/api/__init__.py`
- Create: `apps/backend/api/main.py`
- Create: `apps/backend/api/deps.py`
- Test: `tests/test_api_health.py`

**Step 1: Write the failing test**

```python
# tests/test_api_health.py
import pytest
from httpx import AsyncClient, ASGITransport

@pytest.mark.asyncio
async def test_health_endpoint():
    from api.main import create_app
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && python -m pytest tests/test_api_health.py -v`
Expected: FAIL - ModuleNotFoundError

**Step 3: Add FastAPI dependencies**

Add to `apps/backend/requirements.txt`:
```
fastapi>=0.115.0
uvicorn[standard]>=0.34.0
httpx>=0.28.0
websockets>=14.0
```

Run: `cd apps/backend && pip install -r requirements.txt`

**Step 4: Create api/main.py**

```python
# apps/backend/api/__init__.py
```

```python
# apps/backend/api/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def create_app() -> FastAPI:
    app = FastAPI(
        title="Auto Claude API",
        version="1.0.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Tighten in production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/v1/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_app()
```

**Step 5: Create api/deps.py**

```python
# apps/backend/api/deps.py
"""Shared dependencies for API routes."""
from pathlib import Path
import os


def get_data_dir() -> Path:
    """Get the data directory for persistent storage."""
    return Path(os.environ.get("DATA_DIR", ".auto-claude"))


def get_workspace_dir() -> Path:
    """Get the workspace directory (user's project)."""
    return Path(os.environ.get("WORKSPACE_DIR", "."))
```

**Step 6: Run test to verify it passes**

Run: `cd apps/backend && python -m pytest tests/test_api_health.py -v`
Expected: PASS

**Step 7: Commit**

```bash
git add apps/backend/api/ tests/test_api_health.py apps/backend/requirements.txt
git commit -m "feat: add FastAPI application skeleton with health endpoint"
```

---

### Task 5: Implement Project REST API routes

**Files:**
- Create: `apps/backend/api/routes/__init__.py`
- Create: `apps/backend/api/routes/projects.py`
- Test: `tests/test_api_projects.py`

**Step 1: Write the failing test**

```python
# tests/test_api_projects.py
import pytest
from httpx import AsyncClient, ASGITransport

@pytest.mark.asyncio
async def test_list_projects_empty():
    from api.main import create_app
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/projects")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

@pytest.mark.asyncio
async def test_create_project(tmp_path):
    from api.main import create_app
    import os
    os.environ["DATA_DIR"] = str(tmp_path)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/projects", json={
            "projectPath": str(tmp_path / "test-project")
        })
    assert response.status_code in (200, 201)
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && python -m pytest tests/test_api_projects.py -v`
Expected: FAIL - 404 (route not registered)

**Step 3: Create projects route**

```python
# apps/backend/api/routes/__init__.py
```

```python
# apps/backend/api/routes/projects.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pathlib import Path
import json
import uuid

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])

# In-memory + file-backed project store
_projects: dict[str, dict] = {}


class ProjectCreate(BaseModel):
    projectPath: str
    name: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    settings: dict | None = None


@router.get("/")
async def list_projects():
    return list(_projects.values())


@router.post("/", status_code=201)
async def create_project(body: ProjectCreate):
    project_id = str(uuid.uuid4())[:8]
    project = {
        "id": project_id,
        "path": body.projectPath,
        "name": body.name or Path(body.projectPath).name,
        "createdAt": __import__("datetime").datetime.now().isoformat(),
    }
    _projects[project_id] = project
    return project


@router.get("/{project_id}")
async def get_project(project_id: str):
    project = _projects.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}")
async def update_project(project_id: str, body: ProjectUpdate):
    project = _projects.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if body.name:
        project["name"] = body.name
    if body.settings:
        project["settings"] = body.settings
    return project


@router.delete("/{project_id}")
async def delete_project(project_id: str):
    if project_id not in _projects:
        raise HTTPException(status_code=404, detail="Project not found")
    del _projects[project_id]
    return {"success": True}
```

**Step 4: Register route in main.py**

Add to `apps/backend/api/main.py` in `create_app()`:
```python
from api.routes.projects import router as projects_router
app.include_router(projects_router)
```

**Step 5: Run test to verify it passes**

Run: `cd apps/backend && python -m pytest tests/test_api_projects.py -v`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/backend/api/routes/ tests/test_api_projects.py
git commit -m "feat: add project REST API routes"
```

---

### Task 6: Implement Task REST API routes

**Files:**
- Create: `apps/backend/api/routes/tasks.py`
- Test: `tests/test_api_tasks.py`

**Step 1: Write the failing test**

```python
# tests/test_api_tasks.py
import pytest
from httpx import AsyncClient, ASGITransport

@pytest.mark.asyncio
async def test_list_tasks():
    from api.main import create_app
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/tasks?projectId=test")
    assert response.status_code == 200

@pytest.mark.asyncio
async def test_create_task(tmp_path):
    import os
    os.environ["DATA_DIR"] = str(tmp_path)
    from api.main import create_app
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/tasks", json={
            "projectId": "test",
            "title": "Add auth",
            "description": "Add user authentication"
        })
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Add auth"
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && python -m pytest tests/test_api_tasks.py -v`
Expected: FAIL

**Step 3: Create tasks route**

```python
# apps/backend/api/routes/tasks.py
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import uuid

router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])

_tasks: dict[str, dict] = {}


class TaskCreate(BaseModel):
    projectId: str
    title: str
    description: str
    metadata: dict | None = None


@router.get("/")
async def list_tasks(projectId: str = Query(...)):
    return [t for t in _tasks.values() if t.get("projectId") == projectId]


@router.post("/", status_code=201)
async def create_task(body: TaskCreate):
    task_id = str(uuid.uuid4())[:8]
    task = {
        "id": task_id,
        "projectId": body.projectId,
        "title": body.title,
        "description": body.description,
        "status": "pending",
        "metadata": body.metadata or {},
        "createdAt": __import__("datetime").datetime.now().isoformat(),
    }
    _tasks[task_id] = task
    return task


@router.get("/{task_id}")
async def get_task(task_id: str):
    task = _tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.delete("/{task_id}")
async def delete_task(task_id: str):
    if task_id not in _tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    del _tasks[task_id]
    return {"success": True}


@router.post("/{task_id}/execute")
async def execute_task(task_id: str):
    task = _tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task["status"] = "running"
    # TODO: Launch agent subprocess and stream events via WebSocket
    return {"success": True, "status": "running"}


@router.post("/{task_id}/cancel")
async def cancel_task(task_id: str):
    task = _tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task["status"] = "cancelled"
    return {"success": True}
```

**Step 4: Register route in main.py**

Add to `apps/backend/api/main.py`:
```python
from api.routes.tasks import router as tasks_router
app.include_router(tasks_router)
```

**Step 5: Run test to verify it passes**

Run: `cd apps/backend && python -m pytest tests/test_api_tasks.py -v`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/backend/api/routes/tasks.py tests/test_api_tasks.py
git commit -m "feat: add task REST API routes"
```

---

### Task 7: Implement WebSocket agent event streaming

**Files:**
- Create: `apps/backend/api/websocket/__init__.py`
- Create: `apps/backend/api/websocket/agents.py`
- Test: `tests/test_ws_agents.py`

**Step 1: Write the failing test**

```python
# tests/test_ws_agents.py
import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from httpx_ws import aconnect_ws
from httpx_ws.transport import ASGIWebSocketTransport

@pytest.mark.asyncio
async def test_agent_websocket_connection():
    from api.main import create_app
    app = create_app()
    async with AsyncClient(
        transport=ASGIWebSocketTransport(app),
        base_url="http://test"
    ) as client:
        async with aconnect_ws("/ws/v1/agents/test-task", client) as ws:
            # Send a ping
            await ws.send_json({"type": "ping"})
            response = await asyncio.wait_for(ws.receive_json(), timeout=5)
            assert response["type"] == "pong"
```

**Step 2: Run test to verify it fails**

Run: `pip install httpx-ws && cd apps/backend && python -m pytest tests/test_ws_agents.py -v`
Expected: FAIL

**Step 3: Create WebSocket agent handler**

```python
# apps/backend/api/websocket/__init__.py
```

```python
# apps/backend/api/websocket/agents.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
import json

router = APIRouter()

# Track active connections per task
_task_connections: dict[str, set[WebSocket]] = {}


@router.websocket("/ws/v1/agents/{task_id}")
async def agent_websocket(websocket: WebSocket, task_id: str):
    await websocket.accept()

    if task_id not in _task_connections:
        _task_connections[task_id] = set()
    _task_connections[task_id].add(websocket)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
            else:
                await websocket.send_json({
                    "type": "error",
                    "error": f"Unknown message type: {msg_type}",
                })
    except WebSocketDisconnect:
        _task_connections[task_id].discard(websocket)
        if not _task_connections[task_id]:
            del _task_connections[task_id]


async def broadcast_to_task(task_id: str, message: dict):
    """Broadcast a message to all WebSocket clients watching a task."""
    connections = _task_connections.get(task_id, set())
    dead = set()
    for ws in connections:
        try:
            await ws.send_json(message)
        except Exception:
            dead.add(ws)
    connections -= dead
```

**Step 4: Register WebSocket route in main.py**

Add to `apps/backend/api/main.py`:
```python
from api.websocket.agents import router as agents_ws_router
app.include_router(agents_ws_router)
```

**Step 5: Run test to verify it passes**

Run: `cd apps/backend && python -m pytest tests/test_ws_agents.py -v`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/backend/api/websocket/ tests/test_ws_agents.py
git commit -m "feat: add WebSocket agent event streaming"
```

---

### Task 8: Implement Settings and Auth API routes

**Files:**
- Create: `apps/backend/api/routes/settings.py`
- Create: `apps/backend/api/routes/auth.py`
- Test: `tests/test_api_settings.py`

**Step 1: Write the failing test**

```python
# tests/test_api_settings.py
import pytest
from httpx import AsyncClient, ASGITransport

@pytest.mark.asyncio
async def test_get_settings():
    from api.main import create_app
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/settings")
    assert response.status_code == 200

@pytest.mark.asyncio
async def test_update_settings():
    from api.main import create_app
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.put("/api/v1/settings", json={"theme": "dusk"})
    assert response.status_code == 200
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && python -m pytest tests/test_api_settings.py -v`
Expected: FAIL

**Step 3: Create settings route**

```python
# apps/backend/api/routes/settings.py
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])

_settings: dict = {
    "theme": "default",
    "mode": "dark",
    "language": "en",
}


@router.get("/")
async def get_settings():
    return _settings


@router.put("/")
async def update_settings(body: dict):
    _settings.update(body)
    return _settings
```

**Step 4: Create auth route**

```python
# apps/backend/api/routes/auth.py
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

_profiles: dict[str, dict] = {}


class ProfileCreate(BaseModel):
    name: str
    apiKey: str | None = None
    baseUrl: str | None = None


@router.get("/profiles")
async def list_profiles():
    return list(_profiles.values())


@router.post("/profiles", status_code=201)
async def create_profile(body: ProfileCreate):
    import uuid
    profile_id = str(uuid.uuid4())[:8]
    profile = {
        "id": profile_id,
        "name": body.name,
        "baseUrl": body.baseUrl,
        "hasApiKey": body.apiKey is not None,
    }
    _profiles[profile_id] = profile
    return profile
```

**Step 5: Register routes in main.py**

Add to `apps/backend/api/main.py`:
```python
from api.routes.settings import router as settings_router
from api.routes.auth import router as auth_router
app.include_router(settings_router)
app.include_router(auth_router)
```

**Step 6: Run test to verify it passes**

Run: `cd apps/backend && python -m pytest tests/test_api_settings.py -v`
Expected: PASS

**Step 7: Commit**

```bash
git add apps/backend/api/routes/settings.py apps/backend/api/routes/auth.py tests/test_api_settings.py
git commit -m "feat: add settings and auth API routes"
```

---

## Phase 3: Containerization

### Task 9: Create Dockerfiles

**Files:**
- Create: `apps/web/Dockerfile`
- Create: `apps/web/nginx.conf`
- Create: `apps/backend/Dockerfile`
- Create: `apps/terminal/Dockerfile`

**Step 1: Create Frontend Dockerfile**

```dockerfile
# apps/web/Dockerfile
FROM node:22-slim AS builder
WORKDIR /app
COPY apps/web/package*.json ./
RUN npm ci
COPY apps/frontend/src/renderer/ /frontend-renderer/
COPY apps/frontend/src/shared/ /frontend-shared/
COPY apps/web/ .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/templates/default.conf.template
EXPOSE 3000
ENV PORT=3000
ENV BACKEND_HOST=backend
ENV BACKEND_PORT=8000
```

**Step 2: Create nginx.conf**

```nginx
# apps/web/nginx.conf
server {
    listen ${PORT};
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://${BACKEND_HOST}:${BACKEND_PORT};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /ws/ {
        proxy_pass http://${BACKEND_HOST}:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

**Step 3: Create Backend Dockerfile**

```dockerfile
# apps/backend/Dockerfile
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY apps/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY apps/backend/ .
EXPOSE 8000
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

**Step 4: Create Terminal Dockerfile**

```dockerfile
# apps/terminal/Dockerfile
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY apps/terminal/package*.json ./
RUN npm ci
COPY apps/terminal/ .
EXPOSE 8001
CMD ["sh", "-c", "node server.js --port=${PORT:-8001}"]
```

**Step 5: Commit**

```bash
git add apps/web/Dockerfile apps/web/nginx.conf apps/backend/Dockerfile apps/terminal/Dockerfile
git commit -m "feat: add Dockerfiles for all three services"
```

---

### Task 10: Create podman-compose configuration

**Files:**
- Create: `podman-compose.yml`
- Create: `podman-compose.override.yml`
- Create: `.env.example`

**Step 1: Create podman-compose.yml**

```yaml
# podman-compose.yml
version: "3.9"
services:
  frontend:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "${FRONTEND_PORT:-3000}:${FRONTEND_PORT:-3000}"
    environment:
      - PORT=${FRONTEND_PORT:-3000}
      - BACKEND_HOST=backend
      - BACKEND_PORT=${BACKEND_PORT:-8000}
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped

  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
    ports:
      - "${BACKEND_PORT:-8000}:${BACKEND_PORT:-8000}"
    environment:
      - PORT=${BACKEND_PORT:-8000}
      - TERMINAL_WS_URL=ws://terminal:${TERMINAL_PORT:-8001}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
      - DATA_DIR=/data
      - WORKSPACE_DIR=/workspace
    volumes:
      - project-data:/data
      - ${PROJECT_DIR:-.}:/workspace:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${BACKEND_PORT:-8000}/api/v1/health"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s
    depends_on:
      terminal:
        condition: service_healthy
    restart: unless-stopped

  terminal:
    build:
      context: .
      dockerfile: apps/terminal/Dockerfile
    environment:
      - PORT=${TERMINAL_PORT:-8001}
    volumes:
      - project-data:/data
      - ${PROJECT_DIR:-.}:/workspace
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:${PORT:-8001}/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 5s
    restart: unless-stopped

volumes:
  project-data:
```

**Step 2: Create podman-compose.override.yml (dev HMR)**

```yaml
# podman-compose.override.yml
# Development overrides — auto-loaded by podman-compose
version: "3.9"
services:
  frontend:
    build:
      dockerfile: apps/web/Dockerfile
    volumes:
      - ./apps/web/src:/app/src
      - ./apps/frontend/src/shared:/frontend-shared
      - ./apps/frontend/src/renderer:/frontend-renderer
    command: sh -c "npm run dev -- --host 0.0.0.0 --port ${PORT:-3000}"
    environment:
      - NODE_ENV=development

  backend:
    volumes:
      - ./apps/backend:/app
    command: uvicorn api.main:app --reload --host 0.0.0.0 --port ${PORT:-8000}
    environment:
      - DEBUG=true

  terminal:
    volumes:
      - ./apps/terminal:/app
    command: node --watch server.js --port=${PORT:-8001}
```

**Step 3: Create .env.example**

```bash
# .env.example
# Copy to .env and fill in values

# Ports
FRONTEND_PORT=3000
BACKEND_PORT=8000
TERMINAL_PORT=8001

# Project directory to mount (your source code project)
PROJECT_DIR=.

# Claude API
ANTHROPIC_API_KEY=

# Percy (for visual regression tests)
PERCY_TOKEN=
```

**Step 4: Verify podman-compose builds**

Run: `podman-compose build`
Expected: All three images build successfully

**Step 5: Verify services start**

Run: `podman-compose up -d && sleep 10 && curl http://localhost:3000 && curl http://localhost:8000/api/v1/health`
Expected: Both return valid responses

Run: `podman-compose down`

**Step 6: Commit**

```bash
git add podman-compose.yml podman-compose.override.yml .env.example
git commit -m "feat: add podman-compose configuration for dev and prod"
```

---

## Phase 4: Testing Infrastructure

### Task 11: Set up Playwright E2E tests

**Files:**
- Create: `apps/web/e2e/playwright.config.ts`
- Create: `apps/web/e2e/tests/health.spec.ts`
- Create: `apps/web/e2e/tests/navigation.spec.ts`

**Step 1: Create Playwright config**

```typescript
// apps/web/e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: '../test-results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [
    ['html', { outputFolder: '../test-results/html' }],
    ['json', { outputFile: '../test-results/results.json' }],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    screenshot: 'on',
    video: 'on-first-retry',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
});
```

**Step 2: Create health check E2E test**

```typescript
// apps/web/e2e/tests/health.spec.ts
import { test, expect } from '@playwright/test';

test.describe('App Health', () => {
  test('should load the web app', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Auto Claude/);
  });

  test('API health check should respond', async ({ request }) => {
    const response = await request.get('/api/v1/health');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('ok');
  });
});
```

**Step 3: Create navigation E2E test**

```typescript
// apps/web/e2e/tests/navigation.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should display main layout', async ({ page }) => {
    await page.goto('/');
    // Verify the main app container renders
    await expect(page.locator('#root')).toBeVisible();
  });
});
```

**Step 4: Add E2E script to package.json**

Add to `apps/web/package.json` scripts:
```json
"test:e2e": "npx playwright test --config=e2e/playwright.config.ts"
```

**Step 5: Install Playwright browsers**

Run: `cd apps/web && npx playwright install --with-deps chromium`

**Step 6: Run E2E tests against running containers**

Run: `podman-compose up -d && sleep 10 && cd apps/web && npx playwright test e2e/tests/health.spec.ts --config=e2e/playwright.config.ts`
Expected: PASS

Run: `podman-compose down`

**Step 7: Commit**

```bash
git add apps/web/e2e/
git commit -m "feat: add Playwright E2E test infrastructure"
```

---

### Task 12: Set up Percy visual regression

**Files:**
- Create: `apps/web/e2e/tests/visual-regression.spec.ts`
- Create: `apps/web/.percy.yml`

**Step 1: Create Percy config**

```yaml
# apps/web/.percy.yml
version: 2
snapshot:
  widths: [375, 768, 1280]
  min-height: 1024
  percy-css: |
    /* Disable animations for stable screenshots */
    *, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }
```

**Step 2: Create visual regression tests**

```typescript
// apps/web/e2e/tests/visual-regression.spec.ts
import { test } from '@playwright/test';
import percySnapshot from '@percy/playwright';

test.describe('Visual Regression', () => {
  test('homepage - default state', async ({ page }) => {
    await page.goto('/');
    // Wait for app to fully render
    await page.waitForLoadState('networkidle');
    await percySnapshot(page, 'Homepage - Default');
  });

  test('homepage - dark mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-mode', 'dark');
    });
    await percySnapshot(page, 'Homepage - Dark Mode');
  });

  test('homepage - light mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-mode', 'light');
    });
    await percySnapshot(page, 'Homepage - Light Mode');
  });
});
```

**Step 3: Verify Percy runs (dry run without token)**

Run: `cd apps/web && PERCY_TOKEN='' npx percy exec -- npx playwright test e2e/tests/visual-regression.spec.ts --config=e2e/playwright.config.ts 2>&1 | head -5`
Expected: Percy outputs "PERCY_TOKEN was not provided" (expected without token)

**Step 4: Commit**

```bash
git add apps/web/e2e/tests/visual-regression.spec.ts apps/web/.percy.yml
git commit -m "feat: add Percy visual regression test suite"
```

---

### Task 13: Create test container compose and CI pipeline

**Files:**
- Create: `podman-compose.test.yml`
- Create: `.github/workflows/web-ci.yml`

**Step 1: Create test compose**

```yaml
# podman-compose.test.yml
version: "3.9"
services:
  frontend:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - BACKEND_HOST=backend
      - BACKEND_PORT=8000
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 5s
      timeout: 3s
      retries: 10
    depends_on:
      backend:
        condition: service_healthy

  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
    environment:
      - PORT=8000
      - TERMINAL_WS_URL=ws://terminal:8001
      - TESTING=true
      - DATA_DIR=/data
    volumes:
      - test-data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health"]
      interval: 5s
      timeout: 3s
      retries: 10

  terminal:
    build:
      context: .
      dockerfile: apps/terminal/Dockerfile
    environment:
      - PORT=8001
    volumes:
      - test-data:/data
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:8001/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  test-data:
```

**Step 2: Create CI pipeline**

```yaml
# .github/workflows/web-ci.yml
name: Web CI

on:
  push:
    branches: [main, develop]
    paths:
      - 'apps/web/**'
      - 'apps/backend/api/**'
      - 'apps/terminal/**'
      - 'podman-compose*.yml'
  pull_request:
    branches: [main, develop]
    paths:
      - 'apps/web/**'
      - 'apps/backend/api/**'
      - 'apps/terminal/**'
      - 'podman-compose*.yml'

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: apps/web/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: apps/web

      - name: Type check
        run: npm run typecheck
        working-directory: apps/web

      - name: Unit tests
        run: npm test -- --coverage
        working-directory: apps/web

  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        run: pip install -r requirements.txt
        working-directory: apps/backend

      - name: API tests
        run: python -m pytest tests/test_api_*.py tests/test_ws_*.py -v
        working-directory: apps/backend

  e2e-visual:
    runs-on: ubuntu-latest
    needs: [unit-tests, backend-tests]
    steps:
      - uses: actions/checkout@v4

      # Build and start containers
      - name: Build containers
        run: podman-compose -f podman-compose.test.yml build

      - name: Start services
        run: podman-compose -f podman-compose.test.yml up -d

      - name: Wait for services
        run: |
          for i in $(seq 1 30); do
            curl -s http://localhost:3000 > /dev/null && \
            curl -s http://localhost:8000/api/v1/health > /dev/null && \
            echo "Services ready" && exit 0
            echo "Waiting... ($i/30)"
            sleep 2
          done
          echo "Services failed to start"
          podman-compose -f podman-compose.test.yml logs
          exit 1

      # Install Playwright
      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install Playwright
        run: |
          cd apps/web
          npm ci
          npx playwright install --with-deps chromium

      # E2E tests
      - name: Run E2E tests
        run: npx playwright test --config=e2e/playwright.config.ts
        working-directory: apps/web
        env:
          BASE_URL: http://localhost:3000

      # Percy visual regression
      - name: Visual regression
        if: github.event_name == 'pull_request'
        run: npx percy exec -- npx playwright test e2e/tests/visual-regression.spec.ts --config=e2e/playwright.config.ts
        working-directory: apps/web
        env:
          PERCY_TOKEN: ${{ secrets.PERCY_TOKEN }}
          BASE_URL: http://localhost:3000

      # Upload results
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: e2e-results
          path: apps/web/test-results/

      # Cleanup
      - name: Stop services
        if: always()
        run: podman-compose -f podman-compose.test.yml down
```

**Step 3: Commit**

```bash
git add podman-compose.test.yml .github/workflows/web-ci.yml
git commit -m "feat: add test containers and CI pipeline with visual regression"
```

---

## Phase 5: Web App Integration

### Task 14: Wire up web entry point with real React app

**Files:**
- Modify: `apps/web/src/main.tsx`
- Create: `apps/web/src/WebApp.tsx`

**Step 1: Create WebApp.tsx that imports shared components**

```tsx
// apps/web/src/WebApp.tsx
import React, { useEffect, useState } from 'react';
import { api } from '@platform/api-client';

export function WebApp() {
  const [health, setHealth] = useState<string>('checking...');

  useEffect(() => {
    fetch('/api/v1/health')
      .then((r) => r.json())
      .then((d) => setHealth(d.status))
      .catch(() => setHealth('error'));
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Auto Claude Web</h1>
        <p className="text-gray-400">
          API Status: <span className={health === 'ok' ? 'text-green-400' : 'text-red-400'}>{health}</span>
        </p>
      </div>
    </div>
  );
}
```

**Step 2: Update main.tsx**

```tsx
// apps/web/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { WebApp } from './WebApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WebApp />
  </React.StrictMode>
);
```

**Step 3: Verify build succeeds**

Run: `cd apps/web && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add apps/web/src/
git commit -m "feat: wire up web entry point with API health check"
```

---

### Task 15: Add Railway deployment configuration

**Files:**
- Create: `apps/web/railway.json`
- Create: `apps/backend/railway.json`
- Create: `apps/terminal/railway.json`

**Step 1: Create Railway configs**

```json
// apps/web/railway.json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "healthcheckPath": "/",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

```json
// apps/backend/railway.json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "healthcheckPath": "/api/v1/health",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

```json
// apps/terminal/railway.json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**Step 2: Commit**

```bash
git add apps/web/railway.json apps/backend/railway.json apps/terminal/railway.json
git commit -m "feat: add Railway deployment configuration"
```

---

## Summary

### Phase 1 (Foundation): Tasks 1-3
- Web project scaffold with Vite SPA
- Platform abstraction layer (Electron/Web API switching)
- Standalone terminal WebSocket PTY service

### Phase 2 (API Layer): Tasks 4-8
- FastAPI skeleton with health endpoint
- Project, Task, Settings, Auth REST routes
- WebSocket agent event streaming

### Phase 3 (Containerization): Tasks 9-10
- Dockerfiles for frontend, backend, terminal
- podman-compose.yml with health checks and dev overrides

### Phase 4 (Testing): Tasks 11-13
- Playwright E2E test infrastructure
- Percy visual regression test suite
- Test containers and CI pipeline

### Phase 5 (Integration): Tasks 14-15
- Web entry point with React app
- Railway deployment configuration

### Total: 15 tasks, each with explicit TDD steps
