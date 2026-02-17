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
  async selectDirectory() { return null; }
}

class WebTaskAPI implements TaskAPI {
  constructor(private http: HttpClient, private ws: WebSocketManager) {}
  getTasks(projectId: string, options?: { forceRefresh?: boolean }) {
    const params = new URLSearchParams({ projectId });
    if (options?.forceRefresh) params.set('forceRefresh', 'true');
    return this.http.get(`/tasks?${params}`);
  }
  createTask(projectId: string, title: string, description: string, metadata?: any) {
    return this.http.post('/tasks', { projectId, title, description, metadata });
  }
  deleteTask(taskId: string) { return this.http.delete(`/tasks/${taskId}`); }
  startTask(taskId: string, options?: any) { this.http.post(`/tasks/${taskId}/execute`, options); }
  stopTask(taskId: string) { this.http.post(`/tasks/${taskId}/cancel`); }
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

let _api: PlatformAPI | null = null;

export function getApi(): PlatformAPI {
  if (!_api) {
    if (isWebEnvironment()) {
      _api = new WebPlatformAPI();
    } else {
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
