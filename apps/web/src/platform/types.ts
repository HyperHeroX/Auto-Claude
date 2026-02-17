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
