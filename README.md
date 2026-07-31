# Forge India Connect — AI Voice Calling CRM

A working full-stack scaffold implementing the **core CRM workflow** from your
Admin / Team Leader / Agent diagrams: role-based auth, the 3 fixed pools
(Recruitment, Credit Card Sales, Customer Support), lead import & assignment,
click-to-call logging with disposition, live-call monitoring signals
(listen/whisper/barge/transfer), leave approval, and reporting.

## Honest scope note

Your original brief asks for a full Electron desktop app with Angular
micro-frontends, live SIP/PBX integration (Asterisk/FreeSWITCH), a RAG
knowledge base, real AI voice conversation (Whisper/TTS/LangGraph),
Kubernetes deployment, penetration testing, and dozens of enterprise
modules — that's a multi-month build for a full team, not something any
single response can generate as genuinely production-ready code.

What's actually here is a **real, working web application** (not a mock)
covering the CRM/workflow layer end-to-end:

- ✅ JWT auth with RBAC (Admin / Team Leader / Agent)
- ✅ 3 fixed pools + campaign management
- ✅ Lead creation, CSV/Excel import with duplicate validation, assignment
- ✅ Click-to-call flow with disposition, notes, call duration tracking
- ✅ Live call list + monitor signal endpoints (listen/whisper/barge/transfer)
  broadcast over WebSocket to the pool channel — this is the *signaling*
  layer; actual audio bridging needs Asterisk/FreeSWITCH wired to these hooks
- ✅ Leave request + approval workflow
- ✅ Reporting: calls, leads, conversion rate, per-agent performance
- ❌ Not included: actual SIP calling, AI voice/STT/TTS, RAG knowledge base,
  Electron packaging, Angular micro-frontend, Kubernetes manifests, CI/CD

Where a module isn't implemented, treat this as the foundation to build on —
the data models (`app/schemas/common.py`) and routing structure already
anticipate where AI/voice/PBX services would plug in (see `CallStart`,
`monitor_call`, and the WebSocket channel).

## Stack

- **Backend**: FastAPI, Motor (async MongoDB), JWT auth, Pydantic v2
- **Frontend**: React 18 + Vite + TypeScript + Tailwind (brand colors from
  your logo: navy `#0B4EA2`, gold `#FFC72C`)
- **Database**: MongoDB (Atlas or local via Docker)

## Setup

### 1. Database
Local MongoDB instance running on `mongodb://127.0.0.1:27017` with database name `ai_voice_crm`.
Start MongoDB locally using your installed local MongoDB service or Docker:
```bash
docker compose up -d          # starts MongoDB on localhost:27017
```
*(No MongoDB Atlas or cloud configuration required)*


### 2. Backend
```bash
cd backend
cp .env.example .env          # edit MONGO_URI / JWT_SECRET
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
python seed.py                # creates 3 pools + demo admin/TL/agent accounts
```
API docs: http://localhost:8000/docs

### 3. Frontend
```bash
cd frontend
cp .env.example .env          # VITE_API_URL=http://localhost:8000
npm install
npm run dev
```
App: http://localhost:5173

### Demo logins (after `python seed.py`)
| Role | Email | Password |
|---|---|---|
| Admin | admin@forgeindia.com | Admin@123 |
| Team Leader | tl@forgeindia.com | Leader@123 |
| Agent | agent@forgeindia.com | Agent@123 |

## Project structure

```
forge-crm/
├── backend/
│   ├── app/
│   │   ├── core/          # config, db, security, RBAC deps
│   │   ├── routes/        # auth, users, pools, campaigns, leads, calls, leave, reports, ws
│   │   ├── schemas/       # pydantic request/response models + enums
│   │   └── services/      # websocket manager
│   ├── seed.py
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── api/           # fetch client
│       ├── context/       # auth context
│       ├── components/    # sidebar layout
│       └── pages/         # Login, Dashboard, Leads, Campaigns, Users, LiveCalls, Reports, Leave, Dialer
└── docker-compose.yml
```

## Where to plug in the AI/voice layer next

- `POST /api/calls/start` — call this from your SIP/PBX bridge (or an n8n
  workflow triggered by Asterisk AGI/AMI events) instead of only from the UI
- `POST /api/calls/{id}/monitor` — wire the `listen/whisper/barge` actions to
  Asterisk `ChanSpy`/`Whisper` application calls
- `CallEnd.transcript` / `ai_summary` — populate from your Whisper STT +
  LLM summarization pipeline after the call ends
- WebSocket channel `/ws/pool/{pool_id}` — already broadcasts call
  start/end/monitor events; an Electron tray app or Angular micro-frontend
  can subscribe to this for real-time desktop notifications
