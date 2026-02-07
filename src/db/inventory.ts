/**
 * Database Inventory Functions
 * Query and mutation functions for hosts and workloads
 */

import type { Host, Workload, HostStatus, WorkloadStatus, HealthStatus } from './types';
import { db } from './client';
import { logger } from '../utils/logger';
import { KubernetesConnector } from '../connectors/kubernetes';
type SqlParam = string | number | boolean | Date | null | Record<string, unknown>;

// ============================================================================
// HOST QUERIES
// ============================================================================

export async function getHosts(filters?: {
  status?: HostStatus;
  type?: string;
  cluster?: string;
}): Promise<Host[]> {
  let query = 'SELECT * FROM hosts WHERE 1=1';
  const params: SqlParam[] = [];

  if (filters?.status) {
    query += ` AND status = $${params.length + 1}`;
    params.push(filters.status);
  }

  if (filters?.type) {
    query += ` AND type = $${params.length + 1}`;
    params.push(filters.type);
  }

  if (filters?.cluster) {
    query += ` AND cluster = $${params.length + 1}`;
    params.push(filters.cluster);
  }

  query += ' ORDER BY name ASC';

  return db.queryMany<Host>(query, params);
}

export async function getHostById(id: string): Promise<Host | null> {
  const query = 'SELECT * FROM hosts WHERE id = $1';
  return db.queryOne<Host>(query, [id] as SqlParam[]);
}

export async function createHost(host: Omit<Host, 'id' | 'created_at' | 'updated_at'>): Promise<Host> {
  const query = `
    INSERT INTO hosts (
      name, type, cluster, addresses, status, last_seen_at, tags, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;

  const params: SqlParam[] = [
    host.name,
    host.type,
    host.cluster,
    JSON.stringify(host.addresses),
    host.status,
    host.last_seen_at,
    host.tags,
    JSON.stringify(host.metadata),
  ];

  return db.queryOne<Host>(query, params) as Promise<Host>;
}

export async function updateHost(id: string, updates: Partial<Host>): Promise<Host> {
  const setClauses: string[] = [];
  const params: SqlParam[] = [id];
  let paramCount = 2;

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramCount++}`);
    params.push(updates.name);
  }

  if (updates.status !== undefined) {
    setClauses.push(`status = $${paramCount++}`);
    params.push(updates.status);
  }

  if (updates.last_seen_at !== undefined) {
    setClauses.push(`last_seen_at = $${paramCount++}`);
    params.push(updates.last_seen_at);
  }

  if (updates.addresses !== undefined) {
    setClauses.push(`addresses = $${paramCount++}`);
    params.push(JSON.stringify(updates.addresses));
  }

  if (updates.metadata !== undefined) {
    setClauses.push(`metadata = $${paramCount++}`);
    params.push(JSON.stringify(updates.metadata));
  }

  if (updates.tags !== undefined) {
    setClauses.push(`tags = $${paramCount++}`);
    params.push(updates.tags);
  }

  setClauses.push(`updated_at = NOW()`);

  const query = `
    UPDATE hosts
    SET ${setClauses.join(', ')}
    WHERE id = $1
    RETURNING *
  `;

  return db.queryOne<Host>(query, params) as Promise<Host>;
}

// ============================================================================
// WORKLOAD QUERIES
// ============================================================================

export async function getWorkloads(filters?: {
  status?: WorkloadStatus;
  type?: string;
  namespace?: string;
  health_status?: HealthStatus;
}): Promise<Workload[]> {
  let query = 'SELECT * FROM workloads WHERE 1=1';
  const params: SqlParam[] = [];

  if (filters?.status) {
    query += ` AND status = $${params.length + 1}`;
    params.push(filters.status);
  }

  if (filters?.type) {
    query += ` AND type = $${params.length + 1}`;
    params.push(filters.type);
  }

  if (filters?.namespace) {
    query += ` AND namespace = $${params.length + 1}`;
    params.push(filters.namespace);
  }

  if (filters?.health_status) {
    query += ` AND health_status = $${params.length + 1}`;
    params.push(filters.health_status);
  }

  query += ' ORDER BY namespace ASC, name ASC';

  return db.queryMany<Workload>(query, params);
}

export async function getWorkloadById(id: string): Promise<Workload | null> {
  const query = 'SELECT * FROM workloads WHERE id = $1';
  return db.queryOne<Workload>(query, [id] as SqlParam[]);
}

export async function createWorkload(
  workload: Omit<Workload, 'id' | 'created_at' | 'updated_at'>
): Promise<Workload> {
  const query = `
    INSERT INTO workloads (
      name, type, host_id, status, namespace, spec, health_status,
      last_updated_at, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;

  const params: SqlParam[] = [
    workload.name,
    workload.type,
    workload.host_id,
    workload.status,
    workload.namespace,
    JSON.stringify(workload.spec),
    workload.health_status,
    workload.last_updated_at,
    JSON.stringify(workload.metadata),
  ];

  return db.queryOne<Workload>(query, params) as Promise<Workload>;
}

export async function updateWorkload(
  id: string,
  updates: Partial<Workload>
): Promise<Workload> {
  const setClauses: string[] = [];
  const params: SqlParam[] = [id];
  let paramCount = 2;

  if (updates.status !== undefined) {
    setClauses.push(`status = $${paramCount++}`);
    params.push(updates.status);
  }

  if (updates.health_status !== undefined) {
    setClauses.push(`health_status = $${paramCount++}`);
    params.push(updates.health_status);
  }

  if (updates.spec !== undefined) {
    setClauses.push(`spec = $${paramCount++}`);
    params.push(JSON.stringify(updates.spec));
  }

  if (updates.metadata !== undefined) {
    setClauses.push(`metadata = $${paramCount++}`);
    params.push(JSON.stringify(updates.metadata));
  }

  if (updates.last_updated_at !== undefined) {
    setClauses.push(`last_updated_at = $${paramCount++}`);
    params.push(updates.last_updated_at);
  }

  setClauses.push(`updated_at = NOW()`);

  const query = `
    UPDATE workloads
    SET ${setClauses.join(', ')}
    WHERE id = $1
    RETURNING *
  `;

  return db.queryOne<Workload>(query, params) as Promise<Workload>;
}

// ============================================================================
// INVENTORY SYNC
// ============================================================================

export interface RefreshStats {
  hostsAdded: number;
  hostsUpdated: number;
  workloadsAdded: number;
  workloadsUpdated: number;
}

export async function refreshInventory(forceSync: boolean = false): Promise<RefreshStats> {
  try {
    logger.info('Starting inventory refresh', { forceSync });

    // Initialize Kubernetes connector
    const connector = new KubernetesConnector();
    await connector.initialize();

    // Discover all inventory
    const inventory = await connector.discoverAll();

    // Use transaction to ensure consistency
    const stats: RefreshStats = {
      hostsAdded: 0,
      hostsUpdated: 0,
      workloadsAdded: 0,
      workloadsUpdated: 0,
    };

    return await db.transaction(async (_client) => {
      // Process hosts
      for (const host of inventory.hosts) {
        const existing = await getHostById(host.id);

        if (existing) {
          await updateHost(host.id, host);
          stats.hostsUpdated++;
        } else {
          await createHost(host);
          stats.hostsAdded++;
        }
      }

      // Process workloads
      for (const workload of inventory.workloads) {
        const existing = await getWorkloadById(workload.id);

        if (existing) {
          await updateWorkload(workload.id, workload);
          stats.workloadsUpdated++;
        } else {
          await createWorkload(workload);
          stats.workloadsAdded++;
        }
      }

      logger.info('Inventory refresh completed', stats);
      return stats;
    });
  } catch (error) {
    logger.error('Failed to refresh inventory:', error);
    throw error;
  }
}

// ============================================================================
// INVENTORY STATISTICS
// ============================================================================

export async function getInventoryStats(): Promise<{
  totalHosts: number;
  totalWorkloads: number;
  healthyWorkloads: number;
  unhealthyWorkloads: number;
}> {
  const hostCount = await db.queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM hosts'
  );

  const workloadCount = await db.queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM workloads'
  );

  const healthyCount = await db.queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM workloads WHERE health_status = 'healthy'"
  );

  const unhealthyCount = await db.queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM workloads WHERE health_status = 'unhealthy'"
  );

  return {
    totalHosts: hostCount?.count || 0,
    totalWorkloads: workloadCount?.count || 0,
    healthyWorkloads: healthyCount?.count || 0,
    unhealthyWorkloads: unhealthyCount?.count || 0,
  };
}
