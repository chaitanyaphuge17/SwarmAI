# 🚨 SwarmAI — Multi-Agent Emergency Disaster Command System

[![Live Demo](https://img.shields.io/badge/Live%20Demo-SwarmAI%20Dashboard-blue?style=for-the-badge&logo=cloudflare)](https://swarmai-disaster-system.pages.dev/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org/)
[![LangGraph](https://img.shields.io/badge/AI%20Orchestrator-LangGraph-FF6F61?style=for-the-badge)](https://langchain-ai.github.io/langgraph/)

SwarmAI is a state-of-the-art autonomous multi-agent disaster response platform designed to automate, coordinate, and optimize real-time emergency command operations during critical disaster situations (floods, fires, earthquakes, chemical leaks, and tactical emergencies).

---

## 🏆 FAR AWAY 2026 — ROUND 2 CHALLENGE STATEMENT

**Team:** `sohamshejwal` (`U9L97JW9`)  
**Challenge #689:** `Delegation: Conflict Check`

> **Challenge Directive:**  
> Extend the MVP with a capability related to transfer of responsibility between users or roles. Specifically, detect conflicts early and present them before the user commits to an action. The change should fit naturally into the existing MVP and remain independent of any specific hackathon theme.

---

### 💡 What We Did to Resolve It (Technical Solution)

To address Challenge #689, we engineered a dedicated **Delegation & Conflict Check Engine** integrated seamlessly into the **Admin Command Center** (`DelegationPanel.jsx` & `conflict_checker.py`). 

#### 1. Pre-Commit Conflict Detection Engine (`services/conflict_checker.py`)
Before an administrator or dispatch officer commits a task delegation, team assignment, vehicle reservation, or shift window, the system intercepts the request and evaluates it against all active operational assignments stored in MongoDB.

#### 2. Multi-Dimensional Conflict Rules
Our engine evaluates 4 distinct operational conflict vectors:
- 📅 **Schedule Overlap Conflict**: Calculates exact time window overlaps ($\Delta t$ in hours) across active team schedules. Prevents double-booking response units across simultaneous disaster zones.
- 🚑 **Resource Allocation Conflict**: Detects overlapping vehicle reservations (e.g. Fire Truck 01 or Ambulance 02 reserved for overlapping time frames across different incidents).
- 🔁 **Duplicate Assignment Protection**: Identifies identical tasks assigned to the same team on the same incident to eliminate redundant dispatch.
- ⚡ **Capacity & Workload Warning**: Tracks active assignment counts per team against operational thresholds (e.g. max 3 concurrent deployments) to prevent responder burnout and performance degradation.

#### 3. Pre-Commit Interactive Modal & Intelligent Suggestions (`ConflictModal.jsx`)
- **Real-Time Badge Feedback**: Displays `No Conflict`, `Capacity Warning`, or `Schedule Conflict` badges dynamically as assignment parameters change.
- **Overlapping Incident Details**: Displays exact conflicting incident IDs, time ranges, and duration of overlap.
- **Smart Recommendations**: Suggests alternative teams and vehicles of matching roles/types currently free during the requested timeframe.
- **Flexible Control Flow**: Presents clear options to either **Cancel & Reassign** or **Proceed & Override** (for critical emergency bypass).

#### 4. Audit Log & Real-Time Broadcast
Once confirmed, delegations are persisted in MongoDB (`assignments_collection`) and broadcasted via WebSockets (`/ws/disaster`) to update all active command center dashboards instantly.

---

---

## 🚀 Core Features

### 🤖 1. Autonomous Multi-Agent Swarm (LangGraph Driven)
- **Coordinator Agent**: Synthesizes field data, manages workflow state, and delegates tasks across specialized agents.
- **Emergency Agent**: Analyzes disaster severity (1–10 scale), assesses hazard propagation, and issues evacuation orders.
- **Medical Agent**: Prioritizes casualty triage, evaluates medical access bottlenecks, and deploys emergency medical units.
- **Traffic Agent**: Monitors route congestion, identifies road blockages, and calculates optimal emergency vehicle transit routes via OpenRouteService.
- **Resource Agent**: Tracks unit availability, dispatches fire trucks/ambulances, and balances regional supply allocation.

### 🖼️ 2. Image Verification & Vision Pipeline
- **Groq Vision LLM Integration**: Analyzes user-submitted disaster imagery to verify authenticity, identify hazards, and categorize disaster types.
- **Geo-Plausibility Check**: Verifies image content against reported incident metadata to filter false or spoofed reports.
- **Per-Image Verification Log**: Provides itemized validation reports directly in the Admin Command Center.

### 📲 3. Twilio SMS Notification Integration
- Automated SMS alerts dispatched directly to emergency response commanders and field team leads upon incident confirmation or delegation updates.

### 🗺️ 4. Interactive Map & Live Topology
- Built with **MapLibre GL** and **MapTiler**.
- Features disaster heat zones, hospital overlays, animated ambulance transit vectors, and optimized route geometry.
- **Directed Inter-Agent Topology Graph**: Displays visual nodes and directed communication links showing message exchange frequencies between swarm agents.

### 📑 5. Admin Command Center & Workflow History
- Tabbed interface: **Agent Workflow**, **Incident Details**, **Notifications**, and **Delegation Center**.
- Real-time WebSocket streaming (`/ws/disaster`) for instantaneous workflow events and logs.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS, Framer Motion, React Icons, MapLibre GL |
| **Backend** | Python 3.11, FastAPI, WebSockets, Uvicorn, PyMongo |
| **AI / Swarm** | LangGraph, Groq LLM / Vision API, OpenRouteService API |
| **Database** | MongoDB Atlas |
| **External Services** | Twilio SMS API, Cloudinary Image Storage |

---

## 📂 Project Structure

```
swarm-ai/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/                  # Shared React state
│   │   ├── hooks/                    # Dashboard and browser integration hooks
│   │   ├── models/                   # Frontend data models
│   │   ├── pages/                    # Application pages
│   │   └── services/                 # Axios, admin, disaster, simulation, WebSocket
│   ├── public/                       # Static frontend assets
│   ├── package.json                  # npm scripts and dependencies
│   ├── vite.config.js                # Vite, React, and Tailwind configuration
│   └── eslint.config.js              # ESLint configuration
│
├── ai-services/                     # FastAPI backend and Python services
│   ├── agents/
│   ├── api/                          # HTTP and WebSocket route modules
│   ├── config/                       # Settings and geographic rules
│   ├── database/                     # MongoDB client, collections, indexes
│   ├── logs/                         # Runtime logs
│   ├── orchestrator/                 # Main and LangGraph orchestrators
│   ├── scenarios/                    # Reusable disaster scenarios
│   ├── schemas/                      # Request and response schemas
│   ├── scripts/                      # Database maintenance scripts
│   ├── services/                     # AI, validation, routing, simulation, integrations
│   ├── shared/                       # Context, memory, maps, logging, streams, agents
│   ├── simulation/                   # Disaster and vehicle simulation support
│   ├── uploads/                      # Evidence images served at /uploads
│   ├── websocket/                    # WebSocket support modules
│   ├── requirements.txt              # Python dependencies
│   └── test_*.py                     # Backend tests
├── .gitignore
├── frontend.zip                      # Archived frontend copy
└── readme.md
```

Local runtime artifacts such as `__pycache__`, `node_modules`, `.venv`, uploaded images, and `.env` files may also appear. They are environment-specific and are ignored or generated during development.

---

## ⚡ Quick Start Guide

### Prerequisites
- Python 3.10+ (3.11 recommended)
- Node.js 18+ and npm
- Reachable MongoDB instance (local or Atlas)
- Groq API key
- MapTiler API key for the map view
- Optional: OpenRouteService, Cloudinary, and Twilio credentials

### 1. Backend Setup

```powershell
cd C:\Users\Admin\Desktop\swarm-ai\ai-services

# Create and activate virtual environment
python -m venv .venv
# On Windows PowerShell:
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

```

Create `ai-services/.env` before starting the server:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DATABASE=swarmai
GROQ_API_KEY=your_groq_api_key
ORS_API_KEY=your_openrouteservice_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_phone
ADMIN_PHONE_NUMBER=your_admin_phone
```

`MONGODB_URI` and `GROQ_API_KEY` are required. The other values enable optional features. Never commit `.env` or real credentials.

Start the FastAPI server:

```powershell
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend API: `http://127.0.0.1:8000`.

If PowerShell blocks activation, use Command Prompt:

```bat
cd C:\Users\Admin\Desktop\swarm-ai\ai-services
.venv\Scripts\activate.bat
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

### 2. Frontend Setup

```powershell
cd C:\Users\Admin\Desktop\swarm-ai\frontend

# Install dependencies
npm install

```

Create `frontend/.env`:

```dotenv
VITE_BACKEND_URL=http://127.0.0.1:8000
VITE_MAPTILER_KEY=your_maptiler_api_key
```

Start Vite:

```powershell
npm run dev
```

Frontend application will normally run at `http://localhost:5173`.

### 3. Verify localhost connectivity

Open these URLs while both terminals are running:

- API root: `http://127.0.0.1:8000/`
- Health check: `http://127.0.0.1:8000/health`
- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`
- Frontend: `http://localhost:5173`

The backend already allows `http://localhost:5173` and `http://127.0.0.1:5173` through CORS. The frontend has no Vite proxy; Axios and WebSocket requests connect directly to `VITE_BACKEND_URL`. The live WebSocket URL is `ws://127.0.0.1:8000/ws/disaster`.

If the browser reports a CORS or connection error, confirm both processes are running, confirm the backend URL in `frontend/.env`, and restart Vite after changing that file. Additional browser origins can be added as a comma-separated `ALLOWED_ORIGINS` value in `ai-services/.env`.

---

## 🧪 Verification & Testing

### Backend tests

Run the complete backend suite from `ai-services`:

```powershell
cd C:\Users\Admin\Desktop\swarm-ai\ai-services
python -m pytest
```

### Running Round 2 End-to-End Conflict Verification
We provide an automated verification suite testing conflict detection across schedule overlaps, resource reservation collisions, duplicate tasks, and capacity thresholds:

```powershell
cd C:\Users\Admin\Desktop\swarm-ai\ai-services
python test_round2_e2e.py
```

### Frontend checks

```powershell
cd C:\Users\Admin\Desktop\swarm-ai\frontend
npm run lint
npm run build
```

---

## 🔌 Main API Surfaces

- `/dashboard/data` and `/agents/status` for dashboard and agent state.
- `/disaster/analyze` for disaster analysis and `/route` for optional routing.
- `/scenario/...` and `/simulation/start` for scenarios and simulations.
- `/api/auth/...`, `/api/incidents/...`, and `/api/notifications/...` for admin operations.
- `/api/delegation/...` and `/api/delegation-teams` for conflict checks and assignments.
- `/api/incidents/{incident_id}/workflow/...` for workflow events, summaries, and graphs.
- `/uploads/...` for locally served evidence images.
- `/ws/disaster` for real-time updates.

The default admin credentials are `admin` / `swarmadmin2026` unless `ADMIN_USERNAME` and `ADMIN_PASSWORD` are set in `ai-services/.env`. Change these values before exposing the backend beyond localhost.

---

**Built by Team `sohamshejwal` (`U9L97JW9`) for Far Away 2026 Challenge #689.**
