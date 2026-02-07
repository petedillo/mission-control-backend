/**
 * Database Migration Runner
 * Simple migration system for applying schema changes
 */

import * as fs from 'fs';
import * as path from 'path';
import { db } from './client.js';
import { logger } from '../utils/logger.js';

interface Migration {
  version: number;
  name: string;
  file: string;
  sql: string;
}

class MigrationRunner {
  private migrationsDir: string;

  constructor(migrationsDir: string) {
    this.migrationsDir = migrationsDir;
  }

  /**
   * Ensure the migrations table exists
   */
  private async ensureMigrationsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;

    await db.query(sql);
    logger.info('Schema migrations table ready');
  }

  /**
   * Get applied migrations from database
   */
  private async getAppliedMigrations(): Promise<Set<number>> {
    const result = await db.queryMany<{ version: number }>(
      'SELECT version FROM schema_migrations ORDER BY version'
    );

    return new Set(result.map((row) => row.version));
  }

  /**
   * Load migration files from directory
   */
  private loadMigrationFiles(): Migration[] {
    if (!fs.existsSync(this.migrationsDir)) {
      logger.warn('Migrations directory not found', {
        path: this.migrationsDir,
      });
      return [];
    }

    const files = fs
      .readdirSync(this.migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const migrations: Migration[] = [];

    for (const file of files) {
      // Expected format: 001_initial_schema.sql
      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) {
        logger.warn('Skipping invalid migration file', { file });
        continue;
      }

      const version = parseInt(match[1], 10);
      const name = match[2];
      const filePath = path.join(this.migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      migrations.push({ version, name, file, sql });
    }

    return migrations;
  }

  /**
   * Apply a single migration
   */
  private async applyMigration(migration: Migration): Promise<void> {
    logger.info('Applying migration', {
      version: migration.version,
      name: migration.name,
    });

    await db.transaction(async (client) => {
      // Execute the migration SQL
      await client.query(migration.sql);

      // Record the migration
      await client.query(
        'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
        [migration.version, migration.name]
      );
    });

    logger.info('Migration applied successfully', {
      version: migration.version,
      name: migration.name,
    });
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<void> {
    try {
      await db.connect();
      await this.ensureMigrationsTable();

      const appliedMigrations = await this.getAppliedMigrations();
      const allMigrations = this.loadMigrationFiles();

      const pendingMigrations = allMigrations.filter(
        (m) => !appliedMigrations.has(m.version)
      );

      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations');
        return;
      }

      logger.info('Found pending migrations', {
        count: pendingMigrations.length,
      });

      for (const migration of pendingMigrations) {
        await this.applyMigration(migration);
      }

      logger.info('All migrations completed successfully');
    } catch (error) {
      logger.error('Migration failed', { error });
      throw error;
    }
  }

  /**
   * Show migration status
   */
  async status(): Promise<void> {
    try {
      await db.connect();
      await this.ensureMigrationsTable();

      const appliedMigrations = await this.getAppliedMigrations();
      const allMigrations = this.loadMigrationFiles();

      logger.info('=== Migration Status ===');

      for (const migration of allMigrations) {
        const status = appliedMigrations.has(migration.version)
          ? '✓ Applied'
          : '✗ Pending';
        logger.info(`${status} | Version ${migration.version} | ${migration.name}`);
      }
    } catch (error) {
      logger.error('Failed to get migration status', { error });
      throw error;
    }
  }

  /**
   * Initialize schema (apply initial schema.sql)
   */
  async init(): Promise<void> {
    try {
      await db.connect();

      const schemaPath = path.join(__dirname, 'schema.sql');
      if (!fs.existsSync(schemaPath)) {
        throw new Error('schema.sql not found');
      }

      logger.info('Initializing database schema');

      const sql = fs.readFileSync(schemaPath, 'utf-8');
      await db.query(sql);

      logger.info('Database schema initialized successfully');

      // Record this as migration version 0
      await this.ensureMigrationsTable();
      await db.query(
        `INSERT INTO schema_migrations (version, name)
         VALUES (0, 'initial_schema')
         ON CONFLICT (version) DO NOTHING`
      );
    } catch (error) {
      logger.error('Schema initialization failed', { error });
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const runner = new MigrationRunner(migrationsDir);

  const command = process.argv[2] || 'migrate';

  try {
    switch (command) {
      case 'init':
        await runner.init();
        break;
      case 'migrate':
        await runner.migrate();
        break;
      case 'status':
        await runner.status();
        break;
      default:
        logger.error(`Unknown command: ${command}`);
        logger.info('Usage: npm run db:migrate [init|migrate|status]');
        process.exit(1);
    }
  } catch (error) {
    logger.error('Command failed', { command, error });
    process.exit(1);
  } finally {
    await db.disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { MigrationRunner };
