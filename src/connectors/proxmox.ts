/**
 * Proxmox Connector
 * Connects to Proxmox API and discovers inventory
 */

import axios, { AxiosInstance } from 'axios';
import https from 'https';
import crypto from 'crypto';
import type { Host, HostStatus, Workload, WorkloadStatus } from '../db/types';
import { logger } from '../utils/logger';

export interface ProxmoxNode {
  node: string;
  status?: string;
  maxcpu?: number;
  maxmem?: number;
  maxdisk?: number;
  cpu?: number;
  mem?: number;
  disk?: number;
  uptime?: number;
  [key: string]: unknown;
}

export interface ProxmoxVM {
  vmid: number;
  name?: string;
  status?: string;
  maxcpu?: number;
  maxmem?: number;
  maxdisk?: number;
  cpu?: number;
  mem?: number;
  disk?: number;
  uptime?: number;
  [key: string]: unknown;
}

export interface ProxmoxLXC {
  vmid: number;
  name?: string;
  status?: string;
  maxcpu?: number;
  maxmem?: number;
  maxdisk?: number;
  cpu?: number;
  mem?: number;
  disk?: number;
  uptime?: number;
  [key: string]: unknown;
}

export interface ProxmoxNodeStatus {
  uptime?: number;
  cpu?: number;
  maxcpu?: number;
  loadavg?: number[];
  memory?: {
    total?: number;
    used?: number;
    free?: number;
  };
  swap?: {
    total?: number;
    used?: number;
    free?: number;
  };
  rootfs?: {
    total?: number;
    used?: number;
    free?: number;
  };
  [key: string]: unknown;
}

export interface Inventory {
  hosts: Host[];
  workloads: Workload[];
}

export interface ProxmoxClusterResource {
  id: string;
  type: 'node' | 'qemu' | 'lxc' | 'storage' | 'sdn';
  node?: string;
  vmid?: number;
  name?: string;
  status?: string;
  maxcpu?: number;
  maxmem?: number;
  maxdisk?: number;
  cpu?: number;
  mem?: number;
  disk?: number;
  uptime?: number;
  template?: number;
  [key: string]: unknown;
}

export interface ProxmoxConnectorOptions {
  baseUrl?: string;
  tokenId?: string;
  tokenSecret?: string;
  cluster?: string;
  timeoutMs?: number;
}

export class ProxmoxConnector {
  private client: AxiosInstance | null = null;
  private baseUrl: string;
  private tokenId: string;
  private tokenSecret: string;
  private cluster: string;
  private connectionTimeout: number = 20000;

  constructor(options?: ProxmoxConnectorOptions) {
    this.baseUrl = options?.baseUrl ?? process.env.PROXMOX_HOST ?? '';
    this.tokenId = options?.tokenId ?? process.env.PROXMOX_TOKEN_ID ?? '';
    this.tokenSecret = options?.tokenSecret ?? process.env.PROXMOX_TOKEN_SECRET ?? '';
    this.cluster = options?.cluster ?? this.deriveClusterName(this.baseUrl);

    if (options?.timeoutMs) {
      this.connectionTimeout = options.timeoutMs;
    }
  }

  async initialize(): Promise<boolean> {
    if (!this.baseUrl) {
      throw new Error('PROXMOX_HOST is required');
    }
    if (!this.tokenId || !this.tokenSecret) {
      throw new Error('PROXMOX_TOKEN_ID and PROXMOX_TOKEN_SECRET are required');
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.connectionTimeout,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      headers: {
        Authorization: `PVEAPIToken=${this.tokenId}=${this.tokenSecret}`,
        Accept: 'application/json',
      },
    });

    logger.info('Initialized Proxmox connector', {
      baseUrl: this.baseUrl,
      cluster: this.cluster,
    });

    return true;
  }

  async testConnection(): Promise<boolean> {
    try {
      const client = this.ensureClient();
      await client.get('/api2/json/version');
      logger.info('Proxmox connection test successful');
      return true;
    } catch (error) {
      logger.error('Proxmox connection test failed', { error });
      return false;
    }
  }

  setConnectionTimeout(ms: number): void {
    this.connectionTimeout = ms;
  }

  /**
   * Get all cluster resources in a single call
   * Uses /cluster/resources — more efficient than per-node iteration
   */
  async getClusterResources(type?: 'node' | 'vm' | 'storage'): Promise<ProxmoxClusterResource[]> {
    const client = this.ensureClient();
    const params = type ? { type } : {};
    const response = await client.get('/api2/json/cluster/resources', { params });
    return (response.data?.data ?? []) as ProxmoxClusterResource[];
  }

  async getNodes(): Promise<ProxmoxNode[]> {
    const client = this.ensureClient();
    const response = await client.get('/api2/json/nodes');
    return (response.data?.data ?? []) as ProxmoxNode[];
  }

  async getVMs(node: string): Promise<ProxmoxVM[]> {
    const client = this.ensureClient();
    const response = await client.get(`/api2/json/nodes/${node}/qemu`);
    return (response.data?.data ?? []) as ProxmoxVM[];
  }

  async getLXCs(node: string): Promise<ProxmoxLXC[]> {
    const client = this.ensureClient();
    const response = await client.get(`/api2/json/nodes/${node}/lxc`);
    return (response.data?.data ?? []) as ProxmoxLXC[];
  }

  async getNodeStatus(node: string): Promise<ProxmoxNodeStatus> {
    const client = this.ensureClient();
    const response = await client.get(`/api2/json/nodes/${node}/status`);
    return (response.data?.data ?? {}) as ProxmoxNodeStatus;
  }

  async startVM(node: string, vmid: number): Promise<string> {
    const client = this.ensureClient();
    await client.post(`/api2/json/nodes/${node}/qemu/${vmid}/status/start`);
    return `Start request sent for VM ${vmid} on ${node}`;
  }

  async stopVM(node: string, vmid: number): Promise<string> {
    const client = this.ensureClient();
    await client.post(`/api2/json/nodes/${node}/qemu/${vmid}/status/stop`);
    return `Stop request sent for VM ${vmid} on ${node}`;
  }

  async restartLXC(node: string, vmid: number): Promise<string> {
    const client = this.ensureClient();
    await client.post(`/api2/json/nodes/${node}/lxc/${vmid}/status/restart`);
    return `Restart request sent for LXC ${vmid} on ${node}`;
  }

  async startLXC(node: string, vmid: number): Promise<string> {
    const client = this.ensureClient();
    await client.post(`/api2/json/nodes/${node}/lxc/${vmid}/status/start`);
    return `Start request sent for LXC ${vmid} on ${node}`;
  }

  async stopLXC(node: string, vmid: number): Promise<string> {
    const client = this.ensureClient();
    await client.post(`/api2/json/nodes/${node}/lxc/${vmid}/status/stop`);
    return `Stop request sent for LXC ${vmid} on ${node}`;
  }

  async restartVM(node: string, vmid: number): Promise<string> {
    const client = this.ensureClient();
    await client.post(`/api2/json/nodes/${node}/qemu/${vmid}/status/reboot`);
    return `Restart request sent for VM ${vmid} on ${node}`;
  }

  static isConfigured(): boolean {
    return !!(
      process.env.PROXMOX_HOST &&
      process.env.PROXMOX_TOKEN_ID &&
      process.env.PROXMOX_TOKEN_SECRET
    );
  }

  async discoverAll(): Promise<Inventory> {
    const nodes = await this.getNodes();
    const hosts = nodes.map((node) => this.convertNodeToHost(node));

    const workloads: Workload[] = [];

    for (const node of nodes) {
      const [vms, lxcs] = await Promise.all([
        this.getVMs(node.node),
        this.getLXCs(node.node),
      ]);

      const hostId = this.getHostId(node.node);

      workloads.push(
        ...vms.map((vm) => this.convertVMToWorkload(vm, node.node, hostId)),
        ...lxcs.map((lxc) => this.convertLXCToWorkload(lxc, node.node, hostId))
      );
    }

    return { hosts, workloads };
  }

  // ============================================================================
  // CONVERSION HELPERS
  // ============================================================================

  private convertNodeToHost(node: ProxmoxNode): Host {
    const now = new Date();
    return {
      id: this.getHostId(node.node),
      name: node.node,
      type: 'proxmox-node',
      cluster: this.cluster,
      addresses: {},
      status: this.mapNodeStatus(node.status),
      last_seen_at: now,
      tags: ['proxmox'],
      metadata: {
        cpu: node.cpu ?? null,
        maxcpu: node.maxcpu ?? null,
        mem: node.mem ?? null,
        maxmem: node.maxmem ?? null,
        disk: node.disk ?? null,
        maxdisk: node.maxdisk ?? null,
        uptime: node.uptime ?? null,
      },
      created_at: now,
      updated_at: now,
    };
  }

  private convertVMToWorkload(vm: ProxmoxVM, node: string, hostId: string): Workload {
    const now = new Date();
    return {
      id: this.getWorkloadId(`proxmox-vm:${node}:${vm.vmid}`),
      name: vm.name || `vm-${vm.vmid}`,
      type: 'proxmox-vm',
      host_id: hostId,
      status: this.mapWorkloadStatus(vm.status),
      namespace: node,
      spec: {
        vmid: vm.vmid,
        node,
        cpu: vm.cpu ?? null,
        maxcpu: vm.maxcpu ?? null,
        mem: vm.mem ?? null,
        maxmem: vm.maxmem ?? null,
        disk: vm.disk ?? null,
        maxdisk: vm.maxdisk ?? null,
        uptime: vm.uptime ?? null,
      },
      health_status: vm.status === 'running' ? 'healthy' : 'unknown',
      last_updated_at: now,
      metadata: {
        node,
      },
      created_at: now,
      updated_at: now,
    };
  }

  private convertLXCToWorkload(
    lxc: ProxmoxLXC,
    node: string,
    hostId: string
  ): Workload {
    const now = new Date();
    return {
      id: this.getWorkloadId(`proxmox-lxc:${node}:${lxc.vmid}`),
      name: lxc.name || `lxc-${lxc.vmid}`,
      type: 'proxmox-lxc',
      host_id: hostId,
      status: this.mapWorkloadStatus(lxc.status),
      namespace: node,
      spec: {
        vmid: lxc.vmid,
        node,
        cpu: lxc.cpu ?? null,
        maxcpu: lxc.maxcpu ?? null,
        mem: lxc.mem ?? null,
        maxmem: lxc.maxmem ?? null,
        disk: lxc.disk ?? null,
        maxdisk: lxc.maxdisk ?? null,
        uptime: lxc.uptime ?? null,
      },
      health_status: lxc.status === 'running' ? 'healthy' : 'unknown',
      last_updated_at: now,
      metadata: {
        node,
      },
      created_at: now,
      updated_at: now,
    };
  }

  private mapNodeStatus(status?: string): HostStatus {
    if (!status) {
      return 'unknown';
    }
    if (status === 'online') {
      return 'online';
    }
    if (status === 'offline') {
      return 'offline';
    }
    return 'unknown';
  }

  private mapWorkloadStatus(status?: string): WorkloadStatus {
    if (!status) {
      return 'unknown';
    }

    switch (status) {
      case 'running':
        return 'running';
      case 'stopped':
        return 'stopped';
      case 'paused':
      case 'suspended':
        return 'stopped';
      default:
        return 'unknown';
    }
  }

  private ensureClient(): AxiosInstance {
    if (!this.client) {
      throw new Error('Proxmox connector not initialized');
    }
    return this.client;
  }

  private getHostId(nodeName: string): string {
    return this.getDeterministicId(`proxmox-node:${this.cluster}:${nodeName}`);
  }

  private getWorkloadId(seed: string): string {
    return this.getDeterministicId(seed);
  }

  private getDeterministicId(seed: string): string {
    const hash = crypto.createHash('sha1').update(seed).digest();
    const bytes = Buffer.from(hash.subarray(0, 16));

    bytes[6] = (bytes[6] & 0x0f) | 0x50;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  private deriveClusterName(baseUrl: string): string {
    try {
      if (!baseUrl) {
        return 'proxmox';
      }
      return new URL(baseUrl).hostname || 'proxmox';
    } catch {
      return 'proxmox';
    }
  }
}
