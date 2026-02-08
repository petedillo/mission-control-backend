/**
 * Inventory API Routes Tests
 * Testing GET/POST endpoints for hosts, workloads, and refresh
 * 
 * Pattern follows discord-bot examples with proper mocking and isolated tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import type { Host, Workload } from '../../db/types';

// Import route handlers
import {
  getInventory,
  getHosts,
  getHostById,
  getWorkloads,
  getWorkloadById,
  refreshInventory,
} from './inventory';

// Mock the inventory module functions
vi.mock('../../db/inventory', () => ({
  getHosts: vi.fn(),
  getHostById: vi.fn(),
  getWorkloads: vi.fn(),
  getWorkloadById: vi.fn(),
  refreshInventory: vi.fn(),
  syncDiscoveredInventory: vi.fn(),
}));

// Helper to create mock request/response objects
function createMockRequestResponse() {
  const req = {
    params: {},
    query: {},
    body: {},
    app: {
      locals: {},
    },
  } as unknown as Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return { req, res, next };
}

// Sample test data factories
const createMockHost = (overrides?: Partial<Host>): Host => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'node-1',
  type: 'k8s-node',
  cluster: 'test-cluster',
  addresses: { lan: '192.168.1.100' },
  status: 'online',
  last_seen_at: new Date(),
  tags: [],
  metadata: { capacity: { cpu: '4' } },
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const createMockWorkload = (overrides?: Partial<Workload>): Workload => ({
  id: '22222222-2222-4222-8222-222222222222',
  name: 'test-app',
  type: 'k8s-deployment',
  host_id: null,
  status: 'running',
  namespace: 'default',
  spec: { replicas: 3, readyReplicas: 3 },
  health_status: 'healthy',
  last_updated_at: new Date(),
  metadata: { labels: { app: 'test' } },
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

async function getMockedInventory() {
  const inventoryModule = await import('../../db/inventory');
  return inventoryModule as unknown as {
    getHosts: ReturnType<typeof vi.fn>;
    getHostById: ReturnType<typeof vi.fn>;
    getWorkloads: ReturnType<typeof vi.fn>;
    getWorkloadById: ReturnType<typeof vi.fn>;
    refreshInventory: ReturnType<typeof vi.fn>;
    syncDiscoveredInventory: ReturnType<typeof vi.fn>;
  };
}


describe('Inventory API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/inventory', () => {
    it('should return all hosts and workloads', async () => {
      const { req, res } = createMockRequestResponse();
      const mockHosts = [createMockHost()];
      const mockWorkloads = [createMockWorkload()];

      const inventory = await getMockedInventory();
      inventory.getHosts.mockResolvedValue(mockHosts);
      inventory.getWorkloads.mockResolvedValue(mockWorkloads);

      await getInventory(req, res, vi.fn());

      expect(res.json).toHaveBeenCalledWith({
        data: {
          hosts: mockHosts,
          workloads: mockWorkloads,
        },
      });
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const { req, res } = createMockRequestResponse();
      const error = new Error('Database connection failed');

      const inventory = await getMockedInventory();
      inventory.getHosts.mockRejectedValue(error);

      await getInventory(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
        })
      );
    });

    it('should return empty arrays when no inventory exists', async () => {
      const { req, res } = createMockRequestResponse();

      const inventory = await getMockedInventory();
      inventory.getHosts.mockResolvedValue([]);
      inventory.getWorkloads.mockResolvedValue([]);

      await getInventory(req, res, vi.fn());

      expect(res.json).toHaveBeenCalledWith({
        data: {
          hosts: [],
          workloads: [],
        },
      });
    });
  });

  describe('GET /api/v1/inventory/hosts', () => {
    it('should return all hosts without filters', async () => {
      const { req, res } = createMockRequestResponse();
      const mockHosts = [createMockHost()];

      const inventory = await getMockedInventory();
      inventory.getHosts.mockResolvedValue(mockHosts);

      await getHosts(req, res, vi.fn());

      expect(res.json).toHaveBeenCalledWith({ data: mockHosts });
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should filter hosts by status', async () => {
      const { req, res } = createMockRequestResponse();
      req.query = { status: 'online' };

      const mockHosts = [createMockHost({ status: 'online' })];

      const inventory = await getMockedInventory();
      inventory.getHosts.mockResolvedValue(mockHosts);

      await getHosts(req, res, vi.fn());

      expect(res.json).toHaveBeenCalledWith({ data: mockHosts });
    });

    it('should filter hosts by type', async () => {
      const { req, res } = createMockRequestResponse();
      req.query = { type: 'k8s-node' };

      const mockHosts = [createMockHost({ type: 'k8s-node' })];

      const inventory = await getMockedInventory();
      inventory.getHosts.mockResolvedValue(mockHosts);

      await getHosts(req, res, vi.fn());

      expect(res.json).toHaveBeenCalledWith({ data: mockHosts });
    });

    it('should handle errors when fetching hosts', async () => {
      const { req, res } = createMockRequestResponse();
      const error = new Error('Database error');

      const inventory = await getMockedInventory();
      inventory.getHosts.mockRejectedValue(error);

      await getHosts(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('GET /api/v1/inventory/hosts/:id', () => {
    it('should return a specific host by ID', async () => {
      const { req, res } = createMockRequestResponse();
      req.params = { id: '11111111-1111-4111-8111-111111111111' };

      const mockHost = createMockHost();

      const inventory = await getMockedInventory();
      inventory.getHostById.mockResolvedValue(mockHost);

      await getHostById(req, res, vi.fn());

      expect(res.json).toHaveBeenCalledWith({ data: mockHost });
    });

    it('should return 404 when host not found', async () => {
      const { req, res } = createMockRequestResponse();
      req.params = { id: '33333333-3333-4333-8333-333333333333' };

      const inventory = await getMockedInventory();
      inventory.getHostById.mockResolvedValue(null);

      await getHostById(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Host not found' })
      );
    });

    it('should return 400 for invalid UUID format', async () => {
      const { req, res } = createMockRequestResponse();
      req.params = { id: 'invalid-id' };

      await getHostById(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Invalid') })
      );
    });
  });

  describe('GET /api/v1/inventory/workloads', () => {
    it('should return all workloads without filters', async () => {
      const { req, res } = createMockRequestResponse();
      const mockWorkloads = [createMockWorkload()];

      const inventory = await getMockedInventory();
      inventory.getWorkloads.mockResolvedValue(mockWorkloads);

      await getWorkloads(req, res, vi.fn());

      expect(res.json).toHaveBeenCalledWith({ data: mockWorkloads });
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should filter workloads by status', async () => {
      const { req, res } = createMockRequestResponse();
      req.query = { status: 'running' };

      const mockWorkloads = [createMockWorkload({ status: 'running' })];

      const inventory = await getMockedInventory();
      inventory.getWorkloads.mockResolvedValue(mockWorkloads);

      await getWorkloads(req, res, vi.fn());

      expect(res.json).toHaveBeenCalledWith({ data: mockWorkloads });
    });

    it('should filter workloads by type', async () => {
      const { req, res } = createMockRequestResponse();
      req.query = { type: 'k8s-deployment' };

      const mockWorkloads = [createMockWorkload({ type: 'k8s-deployment' })];

      const inventory = await getMockedInventory();
      inventory.getWorkloads.mockResolvedValue(mockWorkloads);

      await getWorkloads(req, res, vi.fn());

      expect(res.json).toHaveBeenCalledWith({ data: mockWorkloads });
    });

    it('should filter workloads by namespace', async () => {
      const { req, res } = createMockRequestResponse();
      req.query = { namespace: 'kube-system' };

      const mockWorkloads = [
        createMockWorkload({ namespace: 'kube-system' }),
      ];

      const inventory = await getMockedInventory();
      inventory.getWorkloads.mockResolvedValue(mockWorkloads);

      await getWorkloads(req, res, vi.fn());

      expect(res.json).toHaveBeenCalledWith({ data: mockWorkloads });
    });

    it('should filter workloads by health status', async () => {
      const { req, res } = createMockRequestResponse();
      req.query = { health_status: 'unhealthy' };

      const mockWorkloads = [
        createMockWorkload({ health_status: 'unhealthy' }),
      ];

      const inventory = await getMockedInventory();
      inventory.getWorkloads.mockResolvedValue(mockWorkloads);

      await getWorkloads(req, res, vi.fn());

      expect(res.json).toHaveBeenCalledWith({ data: mockWorkloads });
    });

    it('should handle errors when fetching workloads', async () => {
      const { req, res } = createMockRequestResponse();
      const error = new Error('Database error');

      const inventory = await getMockedInventory();
      inventory.getWorkloads.mockRejectedValue(error);

      await getWorkloads(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('GET /api/v1/inventory/workloads/:id', () => {
    it('should return a specific workload by ID', async () => {
      const { req, res } = createMockRequestResponse();
      req.params = { id: '22222222-2222-4222-8222-222222222222' };

      const mockWorkload = createMockWorkload();

      const inventory = await getMockedInventory();
      inventory.getWorkloadById.mockResolvedValue(mockWorkload);

      await getWorkloadById(req, res, vi.fn());

      expect(res.json).toHaveBeenCalledWith({ data: mockWorkload });
    });

    it('should return 404 when workload not found', async () => {
      const { req, res } = createMockRequestResponse();
      req.params = { id: '44444444-4444-4444-8444-444444444444' };

      const inventory = await getMockedInventory();
      inventory.getWorkloadById.mockResolvedValue(null);

      await getWorkloadById(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Workload not found' })
      );
    });

    it('should return 400 for invalid UUID format', async () => {
      const { req, res } = createMockRequestResponse();
      req.params = { id: 'invalid-uuid' };

      await getWorkloadById(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('Invalid') })
      );
    });
  });

  describe('POST /api/v1/inventory/sync', () => {
    it('should trigger inventory sync and return counts', async () => {
      const { req, res } = createMockRequestResponse();
      const mockHosts = [createMockHost()];
      const mockWorkloads = [createMockWorkload()];

      const discoverAll = vi.fn().mockResolvedValue({
        hosts: mockHosts,
        workloads: mockWorkloads,
      });

      req.app.locals = {
        kubernetesConnector: { discoverAll },
      };

      const inventory = await getMockedInventory();
      inventory.syncDiscoveredInventory.mockResolvedValue({
        hostsAdded: 1,
        hostsUpdated: 0,
        workloadsAdded: 1,
        workloadsUpdated: 0,
      });

      await refreshInventory(req, res, vi.fn());

      expect(discoverAll).toHaveBeenCalled();
      expect(inventory.syncDiscoveredInventory).toHaveBeenCalledWith({
        hosts: mockHosts,
        workloads: mockWorkloads,
      });
      expect(res.json).toHaveBeenCalledWith({
        data: {
          synced: true,
          hosts_count: 1,
          workloads_count: 1,
          timestamp: expect.any(String),
        },
      });
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should merge Proxmox inventory when available', async () => {
      const { req, res } = createMockRequestResponse();
      const mockHosts = [createMockHost()];
      const mockWorkloads = [createMockWorkload()];
      const proxmoxHost = createMockHost({
        id: '55555555-5555-4555-8555-555555555555',
        name: 'pve-node',
        type: 'proxmox-node',
      });
      const proxmoxWorkload = createMockWorkload({
        id: '66666666-6666-4666-8666-666666666666',
        name: 'plex',
        type: 'proxmox-vm',
        namespace: 'pve',
      });

      const discoverAll = vi.fn().mockResolvedValue({
        hosts: mockHosts,
        workloads: mockWorkloads,
      });

      const discoverAllProxmox = vi.fn().mockResolvedValue({
        hosts: [proxmoxHost],
        workloads: [proxmoxWorkload],
      });

      req.app.locals = {
        kubernetesConnector: { discoverAll },
        proxmoxConnector: { discoverAll: discoverAllProxmox },
      };

      const inventory = await getMockedInventory();
      inventory.syncDiscoveredInventory.mockResolvedValue({
        hostsAdded: 2,
        hostsUpdated: 0,
        workloadsAdded: 2,
        workloadsUpdated: 0,
      });

      await refreshInventory(req, res, vi.fn());

      expect(inventory.syncDiscoveredInventory).toHaveBeenCalledWith({
        hosts: [...mockHosts, proxmoxHost],
        workloads: [...mockWorkloads, proxmoxWorkload],
      });
      expect(res.json).toHaveBeenCalledWith({
        data: {
          synced: true,
          hosts_count: 2,
          workloads_count: 2,
          timestamp: expect.any(String),
        },
      });
    });

    it('should handle sync errors', async () => {
      const { req, res } = createMockRequestResponse();
      const error = new Error('Kubernetes connection failed');

      req.app.locals = {
        kubernetesConnector: {
          discoverAll: vi.fn().mockRejectedValue(error),
        },
      };

      await refreshInventory(req, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Kubernetes'),
        })
      );
    });
  });
});
