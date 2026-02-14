/**
 * Proxmox Connector Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { ProxmoxConnector } from './proxmox';

vi.mock('axios', () => ({
  default: {
    create: vi.fn(),
  },
}));

const mockedAxios = axios as any;

describe('ProxmoxConnector', () => {
  let connector: ProxmoxConnector;
  let mockClient: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
    };

    mockedAxios.create = vi.fn().mockReturnValue(mockClient);

    connector = new ProxmoxConnector({
      baseUrl: 'https://proxmox.local:8006',
      tokenId: 'user@pve!token',
      tokenSecret: 'secret',
      cluster: 'pve-cluster',
    });

    await connector.initialize();
  });

  it('initializes the client with expected settings', () => {
    expect(mockedAxios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://proxmox.local:8006',
        headers: expect.objectContaining({
          Authorization: 'PVEAPIToken=user@pve!token=secret',
          Accept: 'application/json',
        }),
      })
    );
  });

  it('fetches nodes', async () => {
    mockClient.get.mockResolvedValue({
      data: {
        data: [
          {
            node: 'pve',
            status: 'online',
            maxcpu: 16,
            maxmem: 1024,
            maxdisk: 2048,
          },
        ],
      },
    });

    const nodes = await connector.getNodes();

    expect(mockClient.get).toHaveBeenCalledWith('/api2/json/nodes');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].node).toBe('pve');
  });

  it('fetches VMs and LXCs for a node', async () => {
    mockClient.get.mockImplementation((url: string) => {
      if (url === '/api2/json/nodes/pve/qemu') {
        return Promise.resolve({
          data: {
            data: [{ vmid: 101, name: 'plex', status: 'running' }],
          },
        });
      }

      if (url === '/api2/json/nodes/pve/lxc') {
        return Promise.resolve({
          data: {
            data: [{ vmid: 201, name: 'pihole', status: 'stopped' }],
          },
        });
      }

      return Promise.resolve({ data: { data: [] } });
    });

    const vms = await connector.getVMs('pve');
    const lxcs = await connector.getLXCs('pve');

    expect(vms).toHaveLength(1);
    expect(lxcs).toHaveLength(1);
    expect(vms[0].name).toBe('plex');
    expect(lxcs[0].name).toBe('pihole');
  });

  it('discovers inventory with linked host/workloads', async () => {
    mockClient.get.mockImplementation((url: string) => {
      if (url === '/api2/json/nodes') {
        return Promise.resolve({
          data: {
            data: [{ node: 'pve', status: 'online' }],
          },
        });
      }

      if (url === '/api2/json/nodes/pve/qemu') {
        return Promise.resolve({
          data: {
            data: [{ vmid: 101, name: 'plex', status: 'running' }],
          },
        });
      }

      if (url === '/api2/json/nodes/pve/lxc') {
        return Promise.resolve({
          data: {
            data: [{ vmid: 201, name: 'pihole', status: 'stopped' }],
          },
        });
      }

      return Promise.resolve({ data: { data: [] } });
    });

    const inventory = await connector.discoverAll();

    expect(inventory.hosts).toHaveLength(1);
    expect(inventory.workloads).toHaveLength(2);
    expect(inventory.workloads[0].host_id).toBe(inventory.hosts[0].id);
    expect(inventory.workloads[0].type).toBe('proxmox-vm');
    expect(inventory.workloads[1].type).toBe('proxmox-lxc');
  });

  it('sends control commands for VMs and LXCs', async () => {
    mockClient.post.mockResolvedValue({ data: { data: {} } });

    await connector.startVM('pve', 101);
    await connector.stopVM('pve', 101);
    await connector.restartLXC('pve', 201);

    expect(mockClient.post).toHaveBeenCalledWith('/api2/json/nodes/pve/qemu/101/status/start');
    expect(mockClient.post).toHaveBeenCalledWith('/api2/json/nodes/pve/qemu/101/status/stop');
    expect(mockClient.post).toHaveBeenCalledWith('/api2/json/nodes/pve/lxc/201/status/restart');
  });

  it('tests connection via /api2/json/version', async () => {
    mockClient.get.mockResolvedValue({ data: { data: { version: '8.1.3' } } });

    const result = await connector.testConnection();

    expect(result).toBe(true);
    expect(mockClient.get).toHaveBeenCalledWith('/api2/json/version');
  });

  it('returns false when connection test fails', async () => {
    mockClient.get.mockRejectedValue(new Error('Connection refused'));

    const result = await connector.testConnection();

    expect(result).toBe(false);
  });

  it('fetches cluster resources', async () => {
    const mockResources = [
      { id: 'node/pve', type: 'node', node: 'pve', status: 'online' },
      { id: 'qemu/101', type: 'qemu', vmid: 101, name: 'plex', node: 'pve' },
    ];
    mockClient.get.mockResolvedValue({ data: { data: mockResources } });

    const resources = await connector.getClusterResources();

    expect(mockClient.get).toHaveBeenCalledWith('/api2/json/cluster/resources', { params: {} });
    expect(resources).toHaveLength(2);
  });

  it('fetches cluster resources filtered by type', async () => {
    mockClient.get.mockResolvedValue({ data: { data: [] } });

    await connector.getClusterResources('vm');

    expect(mockClient.get).toHaveBeenCalledWith('/api2/json/cluster/resources', { params: { type: 'vm' } });
  });

  describe('isConfigured', () => {
    it('should return true when all env vars are set', () => {
      process.env.PROXMOX_HOST = 'https://proxmox.local:8006';
      process.env.PROXMOX_TOKEN_ID = 'user@pve!token';
      process.env.PROXMOX_TOKEN_SECRET = 'secret';

      expect(ProxmoxConnector.isConfigured()).toBe(true);

      delete process.env.PROXMOX_HOST;
      delete process.env.PROXMOX_TOKEN_ID;
      delete process.env.PROXMOX_TOKEN_SECRET;
    });

    it('should return false when env vars are missing', () => {
      delete process.env.PROXMOX_HOST;
      delete process.env.PROXMOX_TOKEN_ID;
      delete process.env.PROXMOX_TOKEN_SECRET;

      expect(ProxmoxConnector.isConfigured()).toBe(false);
    });
  });
});
