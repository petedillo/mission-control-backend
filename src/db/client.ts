/**
 * Database Client Wrapper
 * Provides a connection pool and helper methods for PostgreSQL
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { logger } from '../utils/logger.js';

type SqlParam = string | number | boolean | Date | null | Record<string, unknown> | unknown[];

interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

class DatabaseClient {
  private pool: Pool | null = null;
  private config: DbConfig;

  constructor(config: DbConfig) {
    this.config = {
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ...config,
    };
  }

  /**
   * Initialize the database connection pool
   */
  async connect(): Promise<void> {
    if (this.pool) {
      logger.warn('Database pool already initialized');
      return;
    }

    try {
      this.pool = new Pool(this.config);

      // Test the connection
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();

      logger.info('Database connection pool initialized', {
        database: this.config.database,
        host: this.config.host,
        port: this.config.port,
        serverTime: result.rows[0].now,
      });
    } catch (error) {
      logger.error('Failed to initialize database pool', { error });
      throw error;
    }
  }

  /**
   * Close the database connection pool
   */
  async disconnect(): Promise<void> {
    if (!this.pool) {
      logger.warn('Database pool not initialized');
      return;
    }

    try {
      await this.pool.end();
      this.pool = null;
      logger.info('Database connection pool closed');
    } catch (error) {
      logger.error('Error closing database pool', { error });
      throw error;
    }
  }

  /**
   * Execute a SQL query
   */
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: ReadonlyArray<SqlParam>
  ): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call connect() first.');
    }

    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params ? [...params] : undefined);
      const duration = Date.now() - start;

      logger.debug('Query executed', {
        duration,
        rows: result.rowCount,
        command: result.command,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Query failed', {
        duration,
        error,
        query: text,
        params: params ? '[REDACTED]' : undefined,
      });
      throw error;
    }
  }

  /**
   * Execute a query and return the first row
   */
  async queryOne<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: ReadonlyArray<SqlParam>
  ): Promise<T | null> {
    const result = await this.query<T>(text, params);
    return result.rows[0] || null;
  }

  /**
   * Execute a query and return all rows
   */
  async queryMany<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: ReadonlyArray<SqlParam>
  ): Promise<T[]> {
    const result = await this.query<T>(text, params);
    return result.rows;
  }

  /**
   * Get a client from the pool for transactions
   */
  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call connect() first.');
    }

    return this.pool.connect();
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction rolled back', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if database is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as healthy');
      return result.rows[0]?.healthy === 1;
    } catch (error) {
      logger.error('Database health check failed', { error });
      return false;
    }
  }

  /**
   * Get connection pool stats
   */
  getPoolStats(): {
    total: number;
    idle: number;
    waiting: number;
  } | null {
    if (!this.pool) {
      return null;
    }

    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }
}

// Create singleton instance
const dbConfig: DbConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'mission_control',
  user: process.env.POSTGRES_USER || 'mission_control',
  password: process.env.POSTGRES_PASSWORD || 'changeme',
};

export const db = new DatabaseClient(dbConfig);
export default db;
