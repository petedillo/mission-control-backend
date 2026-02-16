/**
 * ArgoCD Connector Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { ArgoCDConnector } from './argocd';

vi.mock('axios', () => ({
  default: {
    create: vi.fn(),
  },
}));

const mockedAxios = axios as any;

describe('ArgoCDConnector', () => {
  let connector: ArgoCDConnector;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
    };

    mockedAxios.create = vi.fn().mockReturnValue(mockClient);

    connector = new ArgoCDConnector(
      'https://argocd.example.com',
      'test-token-123',
      true
    );
  });

  describe('initialization', () => {
    it('should initialize with provided server and token', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://argocd.example.com',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token-123',
          }),
        })
      );
    });

    it('should add http:// prefix if missing', () => {
      const connector2 = new ArgoCDConnector('argocd.example.com', 'token', true);
      expect(mockedAxios.create).toHaveBeenLastCalledWith(
        expect.objectContaining({
          baseURL: 'http://argocd.example.com',
        })
      );
    });

    it('should use environment variables as fallback', () => {
      process.env.ARGOCD_SERVER = 'https://env-server.com';
      process.env.ARGOCD_AUTH_TOKEN = 'env-token';

      const connector2 = new ArgoCDConnector();
      expect(mockedAxios.create).toHaveBeenLastCalledWith(
        expect.objectContaining({
          baseURL: 'https://env-server.com',
          headers: expect.objectContaining({
            Authorization: 'Bearer env-token',
          }),
        })
      );
    });
  });

  describe('testConnection', () => {
    it('should return true on successful connection', async () => {
      mockClient.get.mockResolvedValueOnce({ data: { version: '2.5.0' } });

      const result = await connector.testConnection();
      expect(result).toBe(true);
      expect(mockClient.get).toHaveBeenCalledWith('/api/version');
    });

    it('should return false on connection failure', async () => {
      mockClient.get.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await connector.testConnection();
      expect(result).toBe(false);
    });
  });

  describe('getApplications', () => {
    it('should retrieve all applications', async () => {
      const mockApps = [
        {
          metadata: { name: 'app1', namespace: 'argocd' },
          spec: { project: 'default' },
          status: {
            sync: { status: 'Synced' },
            health: { status: 'Healthy' },
          },
        },
        {
          metadata: { name: 'app2', namespace: 'argocd' },
          spec: { project: 'default' },
          status: {
            sync: { status: 'OutOfSync' },
            health: { status: 'Degraded' },
          },
        },
      ];

      mockClient.get.mockResolvedValueOnce({ data: { items: mockApps } });

      const result = await connector.getApplications();
      expect(result).toEqual(mockApps);
      expect(result.length).toBe(2);
      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/applications');
    });

    it('should return empty array if no items', async () => {
      mockClient.get.mockResolvedValueOnce({ data: {} });

      const result = await connector.getApplications();
      expect(result).toEqual([]);
    });

    it('should throw on API error', async () => {
      mockClient.get.mockRejectedValueOnce(new Error('API Error'));

      await expect(connector.getApplications()).rejects.toThrow('API Error');
    });
  });

  describe('getAppStatus', () => {
    it('should retrieve detailed app status', async () => {
      const mockApp = {
        metadata: { name: 'test-app', namespace: 'argocd' },
        spec: { project: 'default' },
        status: {
          sync: { status: 'Synced', revision: 'abc123' },
          health: { status: 'Healthy', message: 'All good' },
          resources: [
            {
              kind: 'Deployment',
              name: 'my-deployment',
              namespace: 'default',
              status: 'Synced',
              health: { status: 'Healthy' },
            },
          ],
        },
      };

      mockClient.get.mockResolvedValueOnce({ data: mockApp });

      const result = await connector.getAppStatus('test-app');
      expect(result).toEqual({
        name: 'test-app',
        namespace: 'argocd',
        syncStatus: 'Synced',
        healthStatus: 'Healthy',
        revision: 'abc123',
        message: 'All good',
        resources: [
          {
            kind: 'Deployment',
            name: 'my-deployment',
            namespace: 'default',
            status: 'Synced',
            health: 'Healthy',
          },
        ],
      });
      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/applications/test-app');
    });

    it('should handle missing status fields', async () => {
      const mockApp = {
        metadata: { name: 'test-app' },
        spec: { project: 'default' },
      };

      mockClient.get.mockResolvedValueOnce({ data: mockApp });

      const result = await connector.getAppStatus('test-app');
      expect(result.syncStatus).toBe('Unknown');
      expect(result.healthStatus).toBe('Unknown');
      expect(result.revision).toBeUndefined();
    });
  });

  describe('syncApp', () => {
    it('should trigger sync successfully', async () => {
      mockClient.post.mockResolvedValueOnce({ data: { status: 'Running' } });

      const result = await connector.syncApp('test-app');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Sync operation');
      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/v1/applications/test-app/sync',
        expect.objectContaining({
          prune: false,
          dryRun: false,
        })
      );
    });

    it('should support prune and dryRun options', async () => {
      mockClient.post.mockResolvedValueOnce({ data: { status: 'Running' } });

      const result = await connector.syncApp('test-app', true, true);
      expect(result.success).toBe(true);
      expect(result.message).toContain('(dry-run)');
      expect(mockClient.post).toHaveBeenCalledWith(
        '/api/v1/applications/test-app/sync',
        expect.objectContaining({
          prune: true,
          dryRun: true,
        })
      );
    });

    it('should return error on sync failure', async () => {
      mockClient.post.mockRejectedValueOnce({
        response: { data: { message: 'App not found' } },
      });

      const result = await connector.syncApp('test-app');
      expect(result.success).toBe(false);
      expect(result.error).toBe('App not found');
    });
  });

  describe('getAppHistory', () => {
    it('should retrieve app deployment history', async () => {
      const mockApp = {
        metadata: {
          name: 'test-app',
          creationTimestamp: '2026-02-01T00:00:00Z',
        },
        status: {
          sync: { revision: 'abc123' },
        },
      };

      mockClient.get.mockResolvedValueOnce({ data: mockApp });

      const result = await connector.getAppHistory('test-app');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toMatchObject({
        id: 1,
        revision: 'abc123',
        deployedAt: '2026-02-01T00:00:00Z',
      });
    });

    it('should handle apps without revision', async () => {
      const mockApp = {
        metadata: { name: 'test-app' },
      };

      mockClient.get.mockResolvedValueOnce({ data: mockApp });

      const result = await connector.getAppHistory('test-app');
      expect(result).toEqual([]);
    });
  });

  describe('refreshApp', () => {
    it('should refresh app successfully', async () => {
      mockClient.get.mockResolvedValueOnce({ data: { metadata: { name: 'test-app' } } });

      const result = await connector.refreshApp('test-app');
      expect(result.success).toBe(true);
      expect(result.message).toContain('refreshed');
      expect(mockClient.get).toHaveBeenCalledWith('/api/v1/applications/test-app?refresh=true');
    });

    it('should return error on refresh failure', async () => {
      mockClient.get.mockRejectedValueOnce({
        response: { data: { message: 'Refresh failed' } },
      });

      const result = await connector.refreshApp('test-app');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Refresh failed');
    });
  });

  describe('getAllAppStatuses', () => {
    it('should retrieve statuses for all apps', async () => {
      const mockApps = [
        {
          metadata: { name: 'app1', namespace: 'argocd' },
          status: {
            sync: { status: 'Synced', revision: 'rev1' },
            health: { status: 'Healthy', message: 'OK' },
          },
        },
        {
          metadata: { name: 'app2' },
          status: {
            sync: { status: 'OutOfSync' },
            health: { status: 'Degraded' },
          },
        },
      ];

      mockClient.get.mockResolvedValueOnce({ data: { items: mockApps } });

      const result = await connector.getAllAppStatuses();
      expect(result.length).toBe(2);
      expect(result[0]).toMatchObject({
        name: 'app1',
        namespace: 'argocd',
        syncStatus: 'Synced',
        healthStatus: 'Healthy',
        revision: 'rev1',
      });
      expect(result[1]).toMatchObject({
        name: 'app2',
        namespace: 'argocd',
        syncStatus: 'OutOfSync',
        healthStatus: 'Degraded',
      });
    });
  });

  describe('isConfigured', () => {
    it('should return true when both env vars are set', () => {
      process.env.ARGOCD_SERVER = 'https://argocd.example.com';
      process.env.ARGOCD_AUTH_TOKEN = 'token123';

      expect(ArgoCDConnector.isConfigured()).toBe(true);
    });

    it('should return false when env vars are missing', () => {
      delete process.env.ARGOCD_SERVER;
      delete process.env.ARGOCD_AUTH_TOKEN;

      expect(ArgoCDConnector.isConfigured()).toBe(false);
    });
  });
});
