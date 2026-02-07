# Database Setup Complete ✅

## What Was Implemented

The complete database layer for Mission Control backend has been implemented, including:

### 1. Database Schema ([src/db/schema.sql](src/db/schema.sql))

A comprehensive PostgreSQL schema with:

- **Inventory Tables**: `hosts`, `workloads`, `services`
- **Task Management**: `tasks`, `task_runs`, `task_events`, `artifacts`
- **LLM Tracking**: `llm_requests`, `llm_responses`, `token_usage`, `provider_pricing`
- **Tools & Policies**: `tool_definitions`, `tool_call_records`, `policies`
- **Audit**: `audit_entries` (append-only, immutable)

**Features**:
- 15 tables with proper constraints and relationships
- 40+ indexes for optimized queries
- Automatic timestamp updates via triggers
- 3 convenience views for common queries
- Seed data with pricing for Ollama, Gemini, Claude, OpenAI, GitHub Models

### 2. Database Client ([src/db/client.ts](src/db/client.ts))

A robust database client wrapper with:

- Connection pooling (max 20 connections)
- Query methods: `query()`, `queryOne()`, `queryMany()`
- Transaction support with automatic rollback on error
- Health check for monitoring
- Pool statistics for observability
- Comprehensive error handling and logging
- Graceful connection management (connect/disconnect)

### 3. Migration System ([src/db/migrate.ts](src/db/migrate.ts))

A simple but effective migration runner with:

- **Commands**:
  - `npm run db:migrate init` - Initialize database with base schema
  - `npm run db:migrate` - Apply pending migrations
  - `npm run db:migrate:status` - Show migration status
- **Features**:
  - Tracks applied migrations in `schema_migrations` table
  - Transaction-based application (all-or-nothing)
  - Incremental migrations in `src/db/migrations/` directory
  - Version-based ordering (001_*, 002_*, etc.)

### 4. Type Definitions ([src/db/types.ts](src/db/types.ts))

Complete TypeScript types matching the database schema:

- All table models exported as interfaces
- Enum types for status fields, providers, risk levels, etc.
- Input types for creating records (e.g., `CreateHost`, `CreateTask`)
- Type safety for all database operations

### 5. Integration

- ✅ Database client integrated into main app ([src/index.ts](src/index.ts))
- ✅ Connection established on startup
- ✅ Graceful disconnect on shutdown (SIGTERM/SIGINT)
- ✅ Health checks updated to include database status
- ✅ Readiness probe checks database connectivity

## Quick Start

### 1. Start PostgreSQL

Using docker-compose:
```bash
docker-compose up -d postgres
```

Or use an existing PostgreSQL instance (v14+).

### 2. Configure Environment

Ensure these variables are set in `.env`:
```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=mission_control
POSTGRES_USER=mission_control
POSTGRES_PASSWORD=your-secure-password
```

### 3. Initialize Database

Run the initial schema:
```bash
npm run db:migrate:init
```

This creates all tables, indexes, triggers, views, and inserts seed data.

### 4. Verify Setup

Test the connection:
```bash
npm run db:test
```

Check migration status:
```bash
npm run db:migrate:status
```

### 5. Start the Backend

```bash
npm run dev
```

The backend will:
1. Connect to PostgreSQL
2. Verify database health
3. Start listening on port 3000

Check health:
```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-06T...",
  "uptime": 12.5,
  "environment": "development",
  "version": "1.0.0",
  "database": {
    "connected": true,
    "pool": {
      "total": 1,
      "idle": 1,
      "waiting": 0
    }
  }
}
```

## Usage Examples

### Basic Queries

```typescript
import { db } from './db/client';
import { Host, Workload } from './db/types';

// Query all online hosts
const hosts = await db.queryMany<Host>(
  'SELECT * FROM hosts WHERE status = $1',
  ['online']
);

// Get a single workload by ID
const workload = await db.queryOne<Workload>(
  'SELECT * FROM workloads WHERE id = $1',
  [workloadId]
);

// Insert a new task
const result = await db.query(
  'INSERT INTO tasks (title, created_by, is_template) VALUES ($1, $2, $3) RETURNING *',
  ['Restart Plex', 'system', false]
);
const task = result.rows[0];
```

### Transactions

```typescript
import { db } from './db/client';

const result = await db.transaction(async (client) => {
  // Create task
  const task = await client.query(
    'INSERT INTO tasks (title, created_by) VALUES ($1, $2) RETURNING *',
    ['Deploy blog-api', 'system']
  );

  // Create task run
  const run = await client.query(
    'INSERT INTO task_runs (task_id, user_prompt, status) VALUES ($1, $2, $3) RETURNING *',
    [task.rows[0].id, 'Deploy blog-api to production', 'queued']
  );

  return { task: task.rows[0], run: run.rows[0] };
});

console.log('Created task:', result.task.id);
console.log('Created run:', result.run.id);
```

### Using Views

```typescript
// Get active task runs
const activeRuns = await db.queryMany(
  'SELECT * FROM active_task_runs ORDER BY created_at DESC LIMIT 10'
);

// Get token usage summary
const usageSummary = await db.queryMany(
  'SELECT * FROM recent_token_usage_summary ORDER BY total_cost_usd DESC'
);

// Get tool success rates
const toolStats = await db.queryMany(
  'SELECT * FROM tool_call_success_rate WHERE total_calls > 0'
);
```

## Database Schema Highlights

### Inventory
Track all infrastructure components:
- **Hosts**: Proxmox nodes, VMs, LXCs, K8s nodes, Docker hosts
- **Workloads**: K8s deployments/pods, Proxmox VMs/LXCs, Docker containers
- **Services**: Logical groupings (e.g., "plex", "blog-api") with SLO targets

### Task Execution
Complete audit trail:
- **Tasks**: Reusable templates or one-off definitions
- **Task Runs**: Execution instances with status tracking
- **Task Events**: Append-only log (LLM requests, tool calls, logs, errors)
- **Artifacts**: Generated files, outputs, links

### LLM Cost Tracking
Monitor AI spend:
- **Token Usage**: Input/output tokens with estimated cost per request
- **Provider Pricing**: Configurable pricing (per 1M tokens)
- **Request/Response**: Full LLM interaction tracking

### Security & Compliance
Audit everything:
- **Audit Entries**: Immutable log of all actions (who, what, when, outcome)
- **Tool Policies**: Risk-based approval rules (READ_ONLY, SAFE_MUTATE, DESTRUCTIVE)

## Next Steps

With the database layer complete, the next priorities are:

1. **First Connector Implementation** (Kubernetes)
   - Implement K8s API client in `src/connectors/kubernetes.ts`
   - Add inventory sync to populate `hosts` and `workloads` tables
   - Create basic CRUD operations

2. **API Endpoints**
   - `GET /api/v1/inventory` - List all hosts and workloads
   - `GET /api/v1/inventory/hosts/:id` - Host details
   - `GET /api/v1/inventory/workloads/:id` - Workload details
   - `POST /api/v1/inventory/refresh` - Trigger inventory sync

3. **LLM Integration**
   - Implement Ollama adapter in `src/llm/ollama.ts`
   - Implement Gemini adapter in `src/llm/gemini.ts`
   - Add token tracking to `llm_requests` and `token_usage` tables

4. **Tool Registry**
   - Create tool definitions in `tool_definitions` table
   - Implement first tools:
     - `list_k8s_deployments`
     - `get_k8s_pod_logs`
     - `restart_k8s_deployment`

## Files Created

```
src/db/
├── schema.sql                 # Complete database schema
├── client.ts                  # Database connection pool & query wrapper
├── migrate.ts                 # Migration runner
├── types.ts                   # TypeScript type definitions
├── test-connection.ts         # Connection test script
├── README.md                  # Database layer documentation
└── migrations/
    └── README.md              # Migration guide
```

## Database Statistics

- **Tables**: 15
- **Indexes**: 40+
- **Views**: 3
- **Triggers**: 6
- **Seed Records**: 10 (provider pricing)
- **Estimated Schema Size**: ~50 KB (empty)

## Testing Checklist

- [x] Database client connects successfully
- [x] Health check returns database status
- [x] Readiness probe checks database connectivity
- [x] Connection pool tracks statistics
- [x] Transactions work with rollback on error
- [x] Migration system tracks applied migrations
- [x] Schema initializes without errors
- [x] All indexes created successfully
- [x] Triggers update timestamps automatically
- [x] Views return correct results

---

**Status**: ✅ Database Layer Complete
**Next**: Kubernetes Connector Implementation
**Updated**: February 6, 2026
