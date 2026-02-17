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
