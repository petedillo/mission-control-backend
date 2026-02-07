/**
 * Simple test script to verify database connectivity
 * Run with: tsx src/db/test-connection.ts
 */

import { db } from './client';
import { logger } from '../utils/logger';

async function testConnection() {
  try {
    logger.info('Testing database connection...');

    // Connect to database
    await db.connect();
    logger.info('✅ Connected to database');

    // Test query
    const result = await db.query('SELECT version()');
    logger.info('✅ Query executed successfully', {
      version: result.rows[0].version,
    });

    // Test health check
    const healthy = await db.healthCheck();
    logger.info('✅ Health check result:', { healthy });

    // Get pool stats
    const stats = db.getPoolStats();
    logger.info('✅ Pool statistics:', stats);

    // Test transaction
    await db.transaction(async (client) => {
      const testResult = await client.query('SELECT 1 + 1 as sum');
      logger.info('✅ Transaction test:', { sum: testResult.rows[0].sum });
    });

    // Test convenience methods
    const singleRow = await db.queryOne('SELECT NOW() as current_time');
    logger.info('✅ queryOne test:', { time: singleRow?.current_time });

    const multipleRows = await db.queryMany(
      'SELECT * FROM pg_database LIMIT 3'
    );
    logger.info('✅ queryMany test:', { count: multipleRows.length });

    // Cleanup
    await db.disconnect();
    logger.info('✅ Database connection closed');

    logger.info('\n🎉 All database tests passed!');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Database test failed:', error);
    process.exit(1);
  }
}

testConnection();
