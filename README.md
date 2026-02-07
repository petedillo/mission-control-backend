# Mission Control Backend

**Version**: 1.0.0 (MVP - Phase 1)
**Last Updated**: February 6, 2026
**Status**: Initial Setup

---

## Overview

Node.js + Express + TypeScript backend for Mission Control. Provides:
- Inventory aggregation from K8s, Proxmox, ArgoCD, and Prometheus
- Task execution engine with LLM integration (Ollama + Gemini)
- Tool registry and execution framework
- SSE streaming for real-time task updates
- Token usage tracking and cost estimation
- PostgreSQL-backed persistence and audit logging

---

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL 14+
- **LLM Providers**: Ollama (local), Gemini (free tier), Claude (Phase 2)
- **Real-time**: Server-Sent Events (SSE)
- **Job Queue**: In-memory (MVP), Bull + Redis (Phase 2)
- **Testing**: Jest
- **Deployment**: Docker Compose (dev), Kubernetes Helm (prod)

---

## Project Structure

```
mission-control-backend/
├── src/
│   ├── index.ts                    # Express app entry point
│   ├── db/
│   │   ├── schema.sql              # PostgreSQL schema
│   │   ├── migrations/             # Database migrations
│   │   └── client.ts               # PostgreSQL client wrapper
│   ├── connectors/
│   │   ├── kubernetes.ts           # K8s API client
│   │   ├── proxmox.ts              # Proxmox API client
│   │   ├── argocd.ts               # ArgoCD API client
│   │   └── prometheus.ts           # Prometheus query client
│   ├── llm/
│   │   ├── ollama-adapter.ts       # Ollama provider adapter
│   │   ├── gemini-adapter.ts       # Gemini provider adapter
│   │   ├── claude-adapter.ts       # Claude stub (Phase 2)
│   │   └── provider-interface.ts   # Common LLM interface
│   ├── tools/
│   │   ├── registry.ts             # Tool definitions + schemas
│   │   ├── executor.ts             # Tool execution loop
│   │   └── definitions/            # Individual tool implementations
│   │       ├── k8s-tools.ts
│   │       ├── proxmox-tools.ts
│   │       └── prometheus-tools.ts
│   ├── services/
│   │   ├── task-runner.ts          # Job queue + task orchestration
│   │   ├── event-stream.ts         # SSE event handler
│   │   └── inventory-merger.ts     # Live API + static metadata merger
│   ├── api/
│   │   └── routes/
│   │       ├── health.ts           # Health check endpoint
│   │       ├── inventory.ts        # Inventory endpoints
│   │       ├── tasks.ts            # Task management endpoints
│   │       ├── task-runs.ts        # Task execution endpoints
│   │       └── usage.ts            # Token usage endpoints
│   ├── models/                     # TypeScript types/interfaces
│   └── utils/                      # Utilities (logger, validators)
├── tests/                          # Jest test files
├── Dockerfile                      # Container definition
├── docker-compose.yml              # Dev environment (backend + PostgreSQL)
├── package.json
├── tsconfig.json
├── .env.example                    # Environment variable template
├── .gitignore
└── README.md                       # This file
```

---

## Prerequisites

- **Node.js**: v18+ (LTS recommended)
- **PostgreSQL**: v14+
- **Docker**: For containerized deployment (optional for dev)
- **Access to**:
  - Kubernetes cluster (kubeconfig)
  - Proxmox API (host + API token)
  - Prometheus endpoint (URL)
  - Ollama instance (local or LAN)
  - Gemini API key (free tier)

---

## Getting Started

### 1. Install Dependencies

```bash
cd mission-control-backend
npm install
```

### 2. Configure Environment

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/mission_control

# Kubernetes
KUBECONFIG_PATH=/path/to/your/kubeconfig
# or
K8S_CLUSTER_URL=https://k8s.example.com
K8S_TOKEN=<YOUR_K8S_TOKEN>

# Proxmox
PROXMOX_HOST=https://proxmox.example.com:8006
PROXMOX_API_TOKEN=<YOUR_PROXMOX_TOKEN>

# Prometheus
PROMETHEUS_URL=http://prometheus.example.com:9090

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral

# Gemini
GEMINI_API_KEY=<YOUR_GEMINI_API_KEY>
GEMINI_MODEL=gemini-2.0-flash-exp

# Backend Config
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug

# Backend Auth (for macOS app)
API_AUTH_TOKEN=<GENERATE_RANDOM_TOKEN>
```

**⚠️ Security**: Never commit `.env` to Git. It's already in `.gitignore`.

### 3. Set Up Database

Option A: Local PostgreSQL
```bash
# Create database
createdb mission_control

# Run migrations
npm run migrate
```

Option B: Docker Compose (includes PostgreSQL)
```bash
docker-compose up -d postgres
npm run migrate
```

### 4. Run Development Server

```bash
# TypeScript watch mode
npm run dev
```

The API will be available at `http://localhost:3000`.

### 5. Verify Health Endpoint

```bash
curl http://localhost:3000/api/v1/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-06T12:00:00.000Z",
  "version": "1.0.0",
  "connectors": {
    "kubernetes": true,
    "proxmox": true,
    "prometheus": true,
    "ollama": true
  }
}
```

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |
| `npm test` | Run Jest tests |
| `npm run migrate` | Run database migrations |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |

---

## API Endpoints (MVP)

### Health & Status

- `GET /api/v1/health` - Health check + connector status

### Inventory

- `GET /api/v1/inventory` - Get all inventory (hosts + workloads + services)
- `GET /api/v1/inventory/hosts` - List all hosts
- `GET /api/v1/inventory/hosts/:id` - Get host details
- `GET /api/v1/inventory/workloads` - List all workloads
- `GET /api/v1/inventory/workloads/:id` - Get workload details

### Tasks

- `GET /api/v1/tasks` - List tasks
- `POST /api/v1/tasks` - Create new task
- `GET /api/v1/tasks/:id` - Get task details

### Task Runs

- `POST /api/v1/task-runs` - Start task execution
- `GET /api/v1/task-runs/:id` - Get run status
- `GET /api/v1/task-runs/:id/events` - Get run events
- `GET /api/v1/task-runs/:id/events/stream` - SSE stream of events

### Usage & Accounting

- `GET /api/v1/usage/tokens` - Token usage by provider/model/date

---

## Database Schema (MVP)

Key tables:
- `hosts` - Physical/virtual hosts (K8s nodes, Proxmox nodes)
- `workloads` - Running workloads (K8s pods, Proxmox VMs/LXCs)
- `services` - Logical service groupings
- `tasks` - User-created tasks (templates)
- `task_runs` - Execution instances
- `task_events` - Append-only event log
- `llm_requests` - LLM API request records
- `llm_responses` - LLM API response records
- `token_usage` - Token consumption tracking
- `tool_definitions` - Available tools + schemas
- `tool_call_records` - Tool execution history
- `audit_entries` - Immutable audit log

See `src/db/schema.sql` for full DDL.

---

## Tool System

Tools are defined in `src/tools/registry.ts` with:
- Name (e.g., `list_k8s_deployments`)
- Description (for LLM)
- JSON Schema (arguments validation)
- Risk level: `READ_ONLY`, `SAFE_MUTATE`, `DESTRUCTIVE`
- Executor function

### MVP Tools (8 total)

**Kubernetes**:
- `list_k8s_deployments` (READ_ONLY)
- `get_k8s_pod_logs` (READ_ONLY)
- `restart_k8s_deployment` (SAFE_MUTATE)

**Proxmox**:
- `list_proxmox_vms` (READ_ONLY)
- `list_proxmox_lxcs` (READ_ONLY)
- `restart_proxmox_lxc` (SAFE_MUTATE)

**Observability**:
- `get_argocd_app_status` (READ_ONLY)
- `query_prometheus` (READ_ONLY)

---

## LLM Providers

### Ollama (Local)
- **Model**: `mistral` (or `llama3`, `codellama`)
- **Base URL**: `http://localhost:11434` (configurable)
- **Token counting**: Via `prompt_eval_count` + `eval_count`
- **Cost**: Free (local inference)

### Gemini (Cloud - Free Tier)
- **Model**: `gemini-2.0-flash-exp` (fast, free) or `gemini-pro` (paid)
- **SDK**: `@google/generative-ai`
- **Token counting**: Via `usageMetadata`
- **Cost**: Free tier (15 RPM, 1M TPM) or paid

### Claude (Phase 2)
- **Model**: `claude-3-sonnet` or `claude-3-opus`
- **SDK**: `@anthropic-ai/sdk`
- **Token counting**: Native API response
- **Cost**: Paid ($15-75/1M tokens)

---

## Deployment

### Development (Local)

```bash
npm run dev
```

### Production (Docker Compose)

```bash
docker-compose up -d
```

This starts:
- Backend (port 3000)
- PostgreSQL (port 5432)

### Production (Kubernetes)

Helm chart (Phase 2):
```bash
helm install mission-control ./helm/mission-control \
  --set image.tag=1.0.0 \
  --set postgresql.enabled=true
```

---

## Testing

### Run Tests

```bash
npm test
```

### Test Coverage

```bash
npm run test:coverage
```

### Example Test Scenarios

1. Health endpoint returns 200
2. K8s connector lists deployments
3. Proxmox connector lists VMs
4. Ollama adapter generates text
5. Gemini adapter handles tool calling
6. Task runner creates and executes task
7. Token usage is recorded correctly

---

## Security Checklist

- [ ] All secrets in environment variables (not hardcoded)
- [ ] `.env` file never committed to Git
- [ ] API auth token required for all endpoints
- [ ] Tool risk levels enforced (DESTRUCTIVE requires approval)
- [ ] Audit log records all actions (append-only)
- [ ] Input validation on all API endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] Rate limiting on LLM endpoints (prevent abuse)
- [ ] TLS encryption for production deployment
- [ ] Backend runs behind Tailscale (not publicly exposed)

---

## Troubleshooting

### Connection to Kubernetes fails

- Check `KUBECONFIG_PATH` or `K8S_CLUSTER_URL` + `K8S_TOKEN`
- Verify cluster is reachable: `kubectl cluster-info`
- Check Tailscale connection if cluster is on homelab LAN

### Connection to Proxmox fails

- Verify `PROXMOX_HOST` is correct (https://host:8006)
- Check API token has required permissions
- Test with curl: `curl -k -H "Authorization: PVEAPIToken=USER@REALM!TOKENID=UUID" $PROXMOX_HOST/api2/json/version`

### Ollama not responding

- Ensure Ollama is running: `ollama list`
- Check base URL: `curl http://localhost:11434/api/version`
- Pull model if missing: `ollama pull mistral`

### Database migrations fail

- Ensure PostgreSQL is running: `pg_isready`
- Check `DATABASE_URL` is correct
- Verify database exists: `psql -l | grep mission_control`

---

## Roadmap

### Phase 1 (Current - Week 1)
- [x] Project setup + dependencies
- [ ] PostgreSQL schema + migrations
- [ ] K8s + Proxmox + Prometheus connectors
- [ ] Ollama + Gemini LLM adapters
- [ ] Tool registry + executor
- [ ] Task runner + SSE streaming
- [ ] API routes (inventory, tasks, usage)

### Phase 2 (Week 2)
- [ ] Claude provider adapter
- [ ] Bull + Redis job queue
- [ ] ArgoCD mutations (sync, rollback)
- [ ] Policy engine
- [ ] GitHub Models API research

### Phase 3 (Weeks 3-4)
- [ ] Task templates
- [ ] Docker/Compose connector
- [ ] Multi-step workflows

### Phase 4+ (Weeks 5+)
- [ ] RAG + document indexing
- [ ] Incident timeline
- [ ] Dry-run preview
- [ ] Multi-user auth

---

## Contributing

This is a personal homelab project, but contributions are welcome:

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add my feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## License

MIT

---

## References

- [Master Plan](../MISSION_CONTROL_MASTER_PLAN.md)
- [App Brief](../CLAUDE_MISSION_CONTROL_APP_BRIEF.md)
- Discord Bot (reference patterns): `../../development/discord-bot/`
- Auto-Memoir (job queue patterns): `../../development/ollama/app/`

---

**Questions?** Open an issue or reach out!
