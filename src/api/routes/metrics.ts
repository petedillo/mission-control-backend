import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { getMetrics } from '../../metrics/index';
import { db } from '../../db/client';

const router = Router();

/**
 * Health check endpoint
 * Returns overall application health status
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    // Check database health
    const dbHealthy = await db.healthCheck();
    const poolStats = db.getPoolStats();

    const health = {
      status: dbHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      database: {
        connected: dbHealthy,
        pool: poolStats,
      },
    };

    const statusCode = dbHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Readiness probe
 * Checks if the application is ready to accept traffic
 */
router.get('/health/ready', async (_req: Request, res: Response) => {
  try {
    // Check database connectivity
    const dbHealthy = await db.healthCheck();

    const checks = {
      database: dbHealthy ? 'ok' : 'failed',
      kubernetes: 'pending', // TODO: Implement K8s connectivity check
      proxmox: 'pending', // TODO: Implement Proxmox API check
    };

    const ready = dbHealthy; // Ready if database is healthy

    res.status(ready ? 200 : 503).json({
      ready,
      timestamp: new Date().toISOString(),
      checks,
    });
  } catch (error) {
    logger.error('Readiness check failed', error);
    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Liveness probe
 * Checks if the application process is still running
 */
router.get('/health/live', (_req: Request, res: Response) => {
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Prometheus metrics endpoint
 * Returns metrics in Prometheus text format
 */
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const metrics = await getMetrics();
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send(metrics);
  } catch (error) {
    logger.error('Failed to generate metrics', error);
    res.status(500).json({
      error: 'Failed to generate metrics',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
