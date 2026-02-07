/**
 * Inventory API Routes
 * Endpoints for listing and managing inventory (hosts and workloads)
 */

import { Router, Request, Response, NextFunction } from 'express';
import type { HostStatus, WorkloadStatus, HealthStatus } from '../../db/types';
import * as inventory from '../../db/inventory';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * GET /api/v1/inventory
 * Get all hosts and workloads
 */
export async function getInventory(
  _req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const [hosts, workloads] = await Promise.all([
      inventory.getHosts(),
      inventory.getWorkloads(),
    ]);

    res.json({ hosts, workloads });
  } catch (error) {
    logger.error('Failed to get inventory:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get inventory',
    });
  }
}

/**
 * GET /api/v1/inventory/hosts
 * Get all hosts with optional filtering
 */
export async function getHosts(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const { status, type, cluster } = req.query;

    const filters: {
      status?: HostStatus;
      type?: string;
      cluster?: string;
    } = {};

    if (status && typeof status === 'string') {
      filters.status = status as HostStatus;
    }
    if (type && typeof type === 'string') {
      filters.type = type;
    }
    if (cluster && typeof cluster === 'string') {
      filters.cluster = cluster;
    }

    const hosts = await inventory.getHosts(filters);

    res.json({ hosts });
  } catch (error) {
    logger.error('Failed to get hosts:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get hosts',
    });
  }
}

/**
 * GET /api/v1/inventory/hosts/:id
 * Get a specific host by ID
 */
export async function getHostById(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      res.status(400).json({ error: 'Invalid host ID format' });
      return;
    }

    const host = await inventory.getHostById(id);

    if (!host) {
      res.status(404).json({ error: 'Host not found' });
      return;
    }

    res.json({ host });
  } catch (error) {
    logger.error('Failed to get host by ID:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get host',
    });
  }
}

/**
 * GET /api/v1/inventory/workloads
 * Get all workloads with optional filtering
 */
export async function getWorkloads(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const { status, type, namespace, health_status } = req.query;

    const filters: {
      status?: WorkloadStatus;
      type?: string;
      namespace?: string;
      health_status?: HealthStatus;
    } = {};

    if (status && typeof status === 'string') {
      filters.status = status as WorkloadStatus;
    }
    if (type && typeof type === 'string') {
      filters.type = type;
    }
    if (namespace && typeof namespace === 'string') {
      filters.namespace = namespace;
    }
    if (health_status && typeof health_status === 'string') {
      filters.health_status = health_status as HealthStatus;
    }

    const workloads = await inventory.getWorkloads(filters);

    res.json({ workloads });
  } catch (error) {
    logger.error('Failed to get workloads:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get workloads',
    });
  }
}

/**
 * GET /api/v1/inventory/workloads/:id
 * Get a specific workload by ID
 */
export async function getWorkloadById(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      res.status(400).json({ error: 'Invalid workload ID format' });
      return;
    }

    const workload = await inventory.getWorkloadById(id);

    if (!workload) {
      res.status(404).json({ error: 'Workload not found' });
      return;
    }

    res.json({ workload });
  } catch (error) {
    logger.error('Failed to get workload by ID:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get workload',
    });
  }
}

export interface RefreshResult {
  hostsAdded: number;
  hostsUpdated: number;
  workloadsAdded: number;
  workloadsUpdated: number;
}

/**
 * POST /api/v1/inventory/refresh
 * Trigger inventory sync from Kubernetes
 */
export async function refreshInventory(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const { forceSync } = req.body || {};

    logger.info('Triggering inventory refresh', { forceSync });

    const result = await inventory.refreshInventory(forceSync);

    res.json({
      message: 'Inventory refresh completed',
      ...result,
    });
  } catch (error) {
    logger.error('Failed to refresh inventory:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to refresh inventory',
    });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate UUID v4 format
 */
function isValidUUID(uuid: string): boolean {
  const uuidv4Regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidv4Regex.test(uuid);
}

// ============================================================================
// ROUTER SETUP
// ============================================================================

router.get('/', getInventory);
router.get('/hosts', getHosts);
router.get('/hosts/:id', getHostById);
router.get('/workloads', getWorkloads);
router.get('/workloads/:id', getWorkloadById);
router.post('/refresh', refreshInventory);

export default router;
