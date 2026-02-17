# Auto-Claude Web Containerization Design

**Date:** 2026-02-18
**Status:** Approved
**Scope:** Dual-track (Electron desktop + Web container) with Podman development and Railway production deployment

## 1. Overview

Transform Auto-Claude from an Electron-only desktop application into a containerized web application while preserving the existing Electron desktop version. Both platforms share React components and Zustand stores through a platform abstraction layer.

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Migration scope | Dual-track (Electron + Web) | Preserves desktop users, enables web deployment |
| Web frontend | Vite SPA | Closest to existing electron-vite config, maximum component reuse |
| API layer | FastAPI + WebSocket | Native async Python, integrates directly with existing backend code |
| Container runtime | Podman (dev) + Railway (prod) | Podman for rootless local dev, Railway for managed production |
| Container architecture | Multi-container Compose (3 services) | Security isolation, independent scaling |
| UI testing | Playwright + Percy | Full E2E automation with cloud-based visual regression |

## 2. Architecture

### 2.1 Multi-Container Topology

```
Development (Podman)                    Production (Railway)
┌────────────────────┐                  ┌──────────────────────────┐
│ podman-compose.yml │                  │    Railway Project       │
│                    │                  │                          │
│  frontend :3000    │                  │  frontend service        │
│  backend  :8000    │                  │    → public endpoint     │
│  terminal :8001    │                  │  backend service         │
│  (localhost)       │                  │    → .railway.internal   │
│                    │                  │  terminal service        │
└────────────────────┘                  │    → .railway.internal   │
                                        └──────────────────────────┘
```

### 2.2 Container Responsibilities

| Container | Base Image | Role | Port |
|-----------|-----------|------|------|
| `frontend` | `nginx:alpine` (prod) / `node:22-slim` (dev) | Serves React SPA, reverse-proxies API/WS to backend | `:3000` (public) |
| `backend` | `python:3.12-slim` | FastAPI HTTP/WS API, agent orchestration, spec management | `:8000` (internal) |
| `terminal` | `node:22-slim` | PTY daemon, manages terminal sessions via WebSocket | `:8001` (internal) |

### 2.3 Communication Flow

```
Browser ──HTTP──► Nginx (frontend :3000)
                    │
                    ├── /api/*  ──proxy──► FastAPI (backend :8000)
                    │                        │
                    ├── /ws/*   ──proxy──► WebSocket Hub (backend :8000)
                    │                        │
                    └── /*      ──serve──► React SPA static files
                                             │
                              Backend ──WS──► PTY daemon (terminal :8001)
```

### 2.4 Shared Volumes

| Volume | Purpose | Containers |
|--------|---------|-----------|
| `project-data` | `.auto-claude/` directory (specs, worktrees, config) | backend, terminal |
| Host bind mount | User's Git project directory (read-only for backend, read-write for terminal) | backend, terminal |

## 3. API Layer Design

### 3.1 REST API Routes (replacing Electron IPC handlers)

```
/api/v1/
├── health                       GET     Health check
├── projects/                    CRUD    Project management
│   ├── GET    /                          List projects
│   ├── POST   /                          Create project
│   ├── GET    /{id}                      Get project
│   ├── PUT    /{id}                      Update project
│   └── DELETE /{id}                      Delete project
├── tasks/                       CRUD+   Task lifecycle
│   ├── GET    /                          List tasks
│   ├── POST   /                          Create task (triggers spec pipeline)
│   ├── GET    /{id}                      Get task details
│   ├── POST   /{id}/execute              Execute task (starts agent pipeline)
│   ├── POST   /{id}/cancel               Cancel task
│   └── GET    /{id}/logs                 Get task logs
├── specs/                       RW      Spec management
│   ├── GET    /{id}                      Get spec
│   └── PUT    /{id}                      Update spec
├── settings/                    RW      Application settings
│   ├── GET    /                          Get settings
│   └── PUT    /                          Update settings
├── github/                              GitHub integration
│   ├── GET    /issues                    List issues
│   ├── POST   /prs                       Create PR
│   └── ...
├── terminals/                           Terminal management
│   ├── POST   /                          Create terminal session
│   ├── DELETE /{id}                      Close terminal
│   └── POST   /{id}/resize               Resize terminal
└── auth/                                Authentication
    ├── POST   /profiles                  Add Claude profile
    └── GET    /profiles                  List profiles
```

### 3.2 WebSocket Channels (real-time streaming)

```
/ws/v1/
├── /agents/{task_id}            Agent event streaming
│   ← phase_update               Replaces __EXEC_PHASE__ stdout parsing
│   ← task_event                 Replaces __TASK_EVENT__ stdout parsing
│   ← log                        Real-time log output
│   ← completion                 Task completion/failure
│
├── /terminals/{terminal_id}     Terminal I/O streaming
│   → input                      User keyboard input
│   ← output                     PTY output data
│   ← resize_ack                 Resize acknowledgment
│
└── /notifications               Global notifications
    ← rate_limit                  Rate limit warnings
    ← auth_failure                Authentication failures
    ← update_available            Update notifications
```

### 3.3 Service Layer Architecture

```
┌──────────────┐     ┌──────────────┐
│ Electron IPC │     │   FastAPI    │
│  handlers    │     │   routes     │
└──────┬───────┘     └──────┬───────┘
       │                     │
       └──────────┬──────────┘
                  │
          ┌───────┴────────┐
          │ Service Layer  │  ← Shared business logic (Python)
          └───────┬────────┘
                  │
          ┌───────┴────────┐
          │  Core modules  │  ← agents/, qa/, spec/, core/
          └────────────────┘
```

Both Electron IPC handlers and FastAPI routes call into the same service layer, ensuring consistent behavior across platforms.

## 4. Frontend Adaptation Layer

### 4.1 Platform Abstraction

```typescript
// src/shared/platform/api-client.ts

interface PlatformAPI {
  projects: ProjectAPI;
  tasks: TaskAPI;
  terminals: TerminalAPI;
  settings: SettingsAPI;
  agents: AgentAPI;
  github: GitHubAPI;
  // ... maps to all existing ElectronAPI interfaces
}

// Electron implementation (existing IPC bridge)
class ElectronPlatformAPI implements PlatformAPI {
  get projects() { return window.electronAPI.projects; }
  // ...
}

// Web implementation (HTTP + WebSocket)
class WebPlatformAPI implements PlatformAPI {
  private http = new HttpClient('/api/v1');
  private ws = new WebSocketManager('/ws/v1');

  get projects() {
    return {
      list: () => this.http.get('/projects'),
      create: (data) => this.http.post('/projects', data),
      // ...
    };
  }
}

// Auto-detect environment
export const api: PlatformAPI =
  typeof window.electronAPI !== 'undefined'
    ? new ElectronPlatformAPI()
    : new WebPlatformAPI();
```

### 4.2 Store Migration

All Zustand stores change from:
```typescript
// Before
const response = await window.electronAPI.projects.list();
```
To:
```typescript
// After
import { api } from '@shared/platform/api-client';
const response = await api.projects.list();
```

### 4.3 Terminal Adapter

```typescript
// Web environment terminal attachment
class WebTerminalAdapter {
  private ws: WebSocket;

  attach(terminal: Terminal, terminalId: string) {
    this.ws = new WebSocket(`/ws/v1/terminals/${terminalId}`);
    this.ws.onmessage = (e) => terminal.write(e.data);
    terminal.onData((data) => this.ws.send(data));
  }
}
```

### 4.4 Project Structure

```
apps/
├── frontend/               # Electron version (existing, unchanged)
│   └── electron.vite.config.ts
├── web/                     # NEW: Web version
│   ├── Dockerfile           # Production build (multi-stage with nginx)
│   ├── vite.config.ts       # Pure Vite SPA config
│   ├── nginx.conf           # Nginx reverse proxy config
│   ├── index.html           # Web entry
│   └── src/
│       ├── main.tsx         # Web entry point (no Electron)
│       └── web-polyfills.ts # Web environment polyfills
├── shared/                  # EXTRACTED: Shared renderer code
│   ├── components/          # Moved from frontend/src/renderer/components/
│   ├── stores/              # Moved from frontend/src/renderer/stores/
│   ├── hooks/               # Moved from frontend/src/renderer/hooks/
│   ├── styles/              # Shared styles
│   ├── i18n/                # i18n translations
│   └── platform/            # API abstraction layer (NEW)
│       ├── api-client.ts
│       ├── http-client.ts
│       ├── ws-manager.ts
│       └── types.ts
├── backend/                 # Python backend (existing + new API layer)
│   ├── Dockerfile
│   ├── api/                 # NEW: FastAPI application
│   │   ├── main.py          # FastAPI app factory
│   │   ├── routes/          # Route modules (mirroring IPC handlers)
│   │   ├── websocket/       # WebSocket handlers
│   │   └── middleware/      # Auth, CORS, error handling
│   ├── core/                # Existing core modules
│   ├── agents/              # Existing agent modules
│   └── ...
└── terminal/                # NEW: Standalone terminal service
    ├── Dockerfile
    ├── package.json
    └── server.js            # WebSocket PTY server (extracted from Electron)
```

## 5. Container Configuration

### 5.1 Dockerfiles

**Frontend (`apps/web/Dockerfile`):**
```dockerfile
FROM node:22-slim AS builder
WORKDIR /app
COPY apps/shared/ /shared/
COPY apps/web/package*.json ./
RUN npm ci
COPY apps/web/ .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf.template
CMD ["sh", "-c", "envsubst '$$PORT $$BACKEND_HOST $$BACKEND_PORT' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
```

**Backend (`apps/backend/Dockerfile`):**
```dockerfile
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY apps/backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY apps/backend/ .
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

**Terminal (`apps/terminal/Dockerfile`):**
```dockerfile
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY apps/terminal/package*.json ./
RUN npm ci
COPY apps/terminal/ .
CMD ["sh", "-c", "node server.js --port ${PORT:-8001}"]
```

### 5.2 Nginx Configuration (`apps/web/nginx.conf`)

```nginx
server {
    listen ${PORT:-3000};
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API reverse proxy
    location /api/ {
        proxy_pass http://${BACKEND_HOST:-backend}:${BACKEND_PORT:-8000};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket proxy
    location /ws/ {
        proxy_pass http://${BACKEND_HOST:-backend}:${BACKEND_PORT:-8000};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

### 5.3 podman-compose.yml (Development)

```yaml
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
    depends_on:
      backend:
        condition: service_healthy

  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
    ports:
      - "8000:8000"
    environment:
      - PORT=8000
      - TERMINAL_WS_URL=ws://terminal:8001
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      - project-data:/data
      - ${PROJECT_DIR:-.}:/workspace:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health"]
      interval: 5s
      timeout: 3s
      retries: 10
    depends_on:
      terminal:
        condition: service_healthy

  terminal:
    build:
      context: .
      dockerfile: apps/terminal/Dockerfile
    ports:
      - "8001:8001"
    environment:
      - PORT=8001
    volumes:
      - project-data:/data
      - ${PROJECT_DIR:-.}:/workspace
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:8001/health').then(r => process.exit(r.ok ? 0 : 1))"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  project-data:
```

### 5.4 podman-compose.override.yml (Development HMR)

```yaml
version: "3.9"
services:
  frontend:
    volumes:
      - ./apps/web/src:/app/src
      - ./apps/shared:/shared
    command: npm run dev -- --host 0.0.0.0 --port 3000

  backend:
    volumes:
      - ./apps/backend:/app
    command: uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

  terminal:
    volumes:
      - ./apps/terminal:/app
    command: node --watch server.js
```

### 5.5 Railway Deployment

Each service is configured in Railway dashboard with:
- **frontend:** Root directory `apps/web/`, Dockerfile path `Dockerfile`, public domain
- **backend:** Root directory `apps/backend/`, Dockerfile path `Dockerfile`, private networking (`backend.railway.internal`)
- **terminal:** Root directory `apps/terminal/`, Dockerfile path `Dockerfile`, private networking (`terminal.railway.internal`)

Environment variables set per-service in Railway:
- frontend: `BACKEND_HOST=backend.railway.internal`, `BACKEND_PORT=8000`
- backend: `TERMINAL_WS_URL=ws://terminal.railway.internal:8001`, `ANTHROPIC_API_KEY=...`

## 6. Testing Strategy

### 6.1 Test Pyramid

```
        ╱╲
       ╱  ╲        Visual Regression (Percy)
      ╱────╲       → Screenshot comparison, auto-triggered per PR
     ╱      ╲
    ╱────────╲     E2E Tests (Playwright)
   ╱          ╲    → Full user flows in containerized environment
  ╱────────────╲
 ╱              ╲  Integration Tests (Vitest)
╱────────────────╲ → API integration, WebSocket, Store logic
╱──────────────────╲
╱                    ╲ Unit Tests (Vitest + pytest)
╱──────────────────────╲ → Components, functions, services
```

### 6.2 Test Container Configuration

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
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 5s
      timeout: 3s
      retries: 10

  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
    environment:
      - PORT=8000
      - TERMINAL_WS_URL=ws://terminal:8001
      - TESTING=true
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
      test: ["CMD", "node", "-e", "fetch('http://localhost:8001/health').then(r => process.exit(r.ok ? 0 : 1))"]
      interval: 5s
      timeout: 3s
      retries: 10

  e2e:
    build:
      context: .
      dockerfile: apps/web/Dockerfile.e2e
    environment:
      - BASE_URL=http://frontend:3000
      - PERCY_TOKEN=${PERCY_TOKEN}
    depends_on:
      frontend:
        condition: service_healthy
      backend:
        condition: service_healthy
    volumes:
      - ./test-results:/app/test-results

volumes:
  test-data:
```

### 6.3 Playwright Configuration

```typescript
// apps/web/e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: '../test-results',
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    screenshot: 'on',
    video: 'on-first-retry',
    trace: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
});
```

### 6.4 Percy Visual Regression

Visual snapshots are captured for:
- All 7 themes (default, dusk, lime, ocean, retro, neo + more) in light and dark modes
- All major views: Kanban, Terminals, Roadmap, Insights, Settings, GitHub Issues
- Key interactive states: empty states, loaded states, error states, modals

```typescript
// apps/web/e2e/tests/visual-regression.spec.ts
import { test } from '@playwright/test';
import percySnapshot from '@percy/playwright';

const THEMES = ['default', 'dusk', 'lime', 'ocean', 'retro', 'neo'];

test.describe('Visual Regression', () => {
  for (const theme of THEMES) {
    for (const mode of ['light', 'dark']) {
      test(`${theme}/${mode} - Kanban`, async ({ page }) => {
        await page.goto('/');
        await page.evaluate(([t, m]) => {
          document.documentElement.setAttribute('data-theme', t);
          document.documentElement.setAttribute('data-mode', m);
        }, [theme, mode]);
        await percySnapshot(page, `Kanban - ${theme} ${mode}`);
      });
    }
  }
});
```

### 6.5 CI/CD Pipeline

```yaml
# .github/workflows/web-ci.yml
name: Web CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
        working-directory: apps/web
      - run: npm run typecheck
        working-directory: apps/web
      - run: npm test -- --coverage
        working-directory: apps/web

  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -r requirements.txt -r requirements-test.txt
        working-directory: apps/backend
      - run: pytest tests/ -v --tb=short
        working-directory: apps/backend

  e2e-visual:
    runs-on: ubuntu-latest
    needs: [unit-tests, backend-tests]
    steps:
      - uses: actions/checkout@v4
      - run: podman-compose -f podman-compose.test.yml up -d --build
      - run: until curl -s http://localhost:3000 > /dev/null; do sleep 2; done
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
        working-directory: apps/web
        env:
          BASE_URL: http://localhost:3000
      - run: npx percy exec -- npx playwright test e2e/tests/visual-regression.spec.ts
        working-directory: apps/web
        env:
          PERCY_TOKEN: ${{ secrets.PERCY_TOKEN }}
          BASE_URL: http://localhost:3000
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: apps/web/test-results/
      - run: podman-compose -f podman-compose.test.yml down
        if: always()
```

## 7. Migration Path

### Phase 1: Foundation
- Create `apps/web/` directory with Vite SPA config
- Create `apps/shared/` and extract reusable components from `apps/frontend/src/renderer/`
- Build platform abstraction layer (`PlatformAPI` interface)
- Create `apps/terminal/` standalone PTY service

### Phase 2: API Layer
- Build FastAPI application in `apps/backend/api/`
- Implement REST routes mirroring IPC handlers
- Implement WebSocket handlers for agent events and terminal I/O
- Add health check endpoints

### Phase 3: Containerization
- Write Dockerfiles for all 3 services
- Create `podman-compose.yml` and development override
- Create `podman-compose.test.yml` for CI testing
- Verify local development workflow

### Phase 4: Testing
- Set up Playwright for web E2E testing
- Integrate Percy for visual regression
- Create CI pipeline (`.github/workflows/web-ci.yml`)
- Build visual regression test suite for all themes

### Phase 5: Railway Deployment
- Configure Railway project with 3 services
- Set up private networking between services
- Configure environment variables and secrets
- Verify production deployment

### Phase 6: Electron Adaptation
- Update Electron `apps/frontend/` to import from `apps/shared/`
- Ensure Electron version continues to work with shared components
- Run existing Electron tests to verify no regressions
