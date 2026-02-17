import { describe, it, expect, beforeEach } from 'vitest';

describe('PlatformAPI', () => {
  beforeEach(() => {
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
