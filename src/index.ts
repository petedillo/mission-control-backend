import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { db } from './db/client';
import { KubernetesConnector } from './connectors/kubernetes';
import { ProxmoxConnector } from './connectors/proxmox';
import { ArgoCDConnector } from './connectors/argocd';
import { PrometheusConnector } from './connectors/prometheus';
import { syncDiscoveredInventory } from './db/inventory';
import app from './app';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;

// Start server
let server: ReturnType<typeof app.listen>;

async function startServer() {
  try {
    // Initialize database connection
    await db.connect();
    logger.info('✅ Database connection established');

    const connector = new KubernetesConnector(process.env.KUBECONFIG_PATH);
    await connector.initialize();
    app.locals.kubernetesConnector = connector;
    logger.info('✅ Kubernetes connector initialized');

    if (
      process.env.PROXMOX_HOST &&
      process.env.PROXMOX_TOKEN_ID &&
      process.env.PROXMOX_TOKEN_SECRET
    ) {
      const proxmoxConnector = new ProxmoxConnector();
      await proxmoxConnector.initialize();
      app.locals.proxmoxConnector = proxmoxConnector;
      logger.info('✅ Proxmox connector initialized');
    } else {
      logger.info('ℹ️ Proxmox connector skipped (missing credentials)');
    }

    // Initialize ArgoCD connector (optional)
    if (ArgoCDConnector.isConfigured()) {
      const argoCDConnector = new ArgoCDConnector();
      const connected = await argoCDConnector.testConnection();
      if (connected) {
        app.locals.argoCDConnector = argoCDConnector;
        logger.info('✅ ArgoCD connector initialized');
      } else {
        logger.warn('⚠️ ArgoCD connector failed connection test');
      }
    } else {
      logger.info('ℹ️ ArgoCD connector skipped (missing credentials)');
    }

    // Initialize Prometheus connector (optional)
    if (PrometheusConnector.isConfigured()) {
      const prometheusConnector = new PrometheusConnector();
      const connected = await prometheusConnector.testConnection();
      if (connected) {
        app.locals.prometheusConnector = prometheusConnector;
        logger.info('✅ Prometheus connector initialized');
      } else {
        logger.warn('⚠️ Prometheus connector failed connection test');
      }
    } else {
      logger.info('ℹ️ Prometheus connector skipped (missing configuration)');
    }

    const syncIntervalMs = Number(process.env.INVENTORY_SYNC_INTERVAL_MS || 60000);
    if (syncIntervalMs > 0) {
      setInterval(async () => {
        try {
          logger.info('⏱️ Running scheduled inventory sync');
          const proxmoxConnector = app.locals
            .proxmoxConnector as ProxmoxConnector | undefined;

          const [k8sInventory, proxmoxInventory] = await Promise.all([
            connector.discoverAll(),
            proxmoxConnector?.discoverAll() ?? Promise.resolve({ hosts: [], workloads: [] }),
          ]);

          const merged = {
            hosts: [...k8sInventory.hosts, ...proxmoxInventory.hosts],
            workloads: [...k8sInventory.workloads, ...proxmoxInventory.workloads],
          };

          const stats = await syncDiscoveredInventory(merged);
          logger.info('✅ Scheduled inventory sync complete', stats);
        } catch (error) {
          logger.error('Scheduled inventory sync failed', error);
        }
      }, syncIntervalMs);
    }

    server = app.listen(PORT, () => {
      logger.info(`🚀 Mission Control Backend listening on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Close HTTP server
  server.close(async () => {
    logger.info('HTTP server closed');

    // Close database connections
    try {
      await db.disconnect();
      logger.info('Database connections closed');
    } catch (error) {
      logger.error('Error closing database connections:', error);
    }

    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
