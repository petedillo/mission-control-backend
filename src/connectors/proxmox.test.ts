/**
 * Proxmox Connector Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProxmoxConnector } from './proxmox';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockAxiosInstance = {
  get: mockGet,
  post: mockPost,
};
const mockCreate = vi.fn(() => mockAxiosInstance);

vi.mock('axios', () => ({
  default: {
    create: mockCreate,
  },
}));

describe('ProxmoxConnector', () => {
  let connector: ProxmoxConnector;

  beforeEach(async () => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockCreate.mockClear();

    connector = new ProxmoxConnector({
      baseUrl: 'https://proxmox.local:8006',
      tokenId: 'user@pve!token',
      tokenSecret: 'secret',
      cluster: 'pve-cluster',
    });

    await connector.initialize();
  });

  it('initializes the client with expected settings', () => {
    expect(mockCreate).toHaveBeenCalledWith(
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
    mockGet.mockResolvedValue({
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

    expect(mockGet).toHaveBeenCalledWith('/api2/json/nodes');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].node).toBe('pve');
  });

  it('fetches VMs and LXCs for a node', async () => {
    mockGet.mockImplementation((url: string) => {
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
    mockGet.mockImplementation((url: string) => {
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
    mockPost.mockResolvedValue({ data: { data: {} } });

    await connector.startVM('pve', 101);
    await connector.stopVM('pve', 101);
    await connector.restartLXC('pve', 201);

    expect(mockPost).toHaveBeenCalledWith('/api2/json/nodes/pve/qemu/101/status/start');
    expect(mockPost).toHaveBeenCalledWith('/api2/json/nodes/pve/qemu/101/status/stop');
    expect(mockPost).toHaveBeenCalledWith('/api2/json/nodes/pve/lxc/201/status/restart');
  });
});
