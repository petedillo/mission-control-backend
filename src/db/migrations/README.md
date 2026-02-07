# Database Migrations

This directory contains incremental database migrations for Mission Control.

## Migration Files

Migration files follow the naming convention:
```
{version}_{description}.sql
```

Example:
- `001_add_user_preferences.sql`
- `002_add_k8s_context_column.sql`

## Usage

### Initialize the database (first time setup)
```bash
npm run db:migrate init
```

This will apply the base `schema.sql` and record it as migration version 0.

### Check migration status
```bash
npm run db:migrate status
```

### Apply pending migrations
```bash
npm run db:migrate
```

## Creating a New Migration

1. Create a new file in this directory with the next version number
2. Write your SQL changes (ALTER TABLE, CREATE INDEX, etc.)
3. Run `npm run db:migrate status` to verify it's detected
4. Run `npm run db:migrate` to apply it

## Example Migration

File: `001_add_workload_restart_count.sql`

```sql
-- Add restart count tracking to workloads
ALTER TABLE workloads
ADD COLUMN restart_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_workloads_restart_count ON workloads(restart_count);

COMMENT ON COLUMN workloads.restart_count IS 'Number of times this workload has been restarted';
```

## Notes

- Migrations are applied in a transaction - they either fully succeed or fully rollback
- Once applied, migrations are recorded in the `schema_migrations` table
- Never modify a migration file after it has been applied to production
- Always test migrations on a dev database first
