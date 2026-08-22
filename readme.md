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

## 🌐 Live Demo & Important Notice

- **Live Application URL**: [https://swarmai-disaster-system.pages.dev/](https://swarmai-disaster-system.pages.dev/)

> ⚠️ **Notice regarding Render Free-Tier Backend**:  
> The backend server is hosted on Render's free tier. If inactive, the server automatically enters sleep mode. The initial request might take **30–60 seconds** to wake up. Once awake, the system operates seamlessly in real time.

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
| **Frontend** | React 18, Vite, Tailwind CSS, Framer Motion, React Icons, MapLibre GL |
| **Backend** | Python 3.11, FastAPI, WebSockets, Uvicorn, Motor / PyMongo |
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
│   │   │   ├── AdminCommandCenter.jsx   # Top-level Admin Command View
│   │   │   ├── AgentWorkflowPanel.jsx   # Graph topology, Story view & timeline log
│   │   │   ├── DelegationPanel.jsx      # Round 2 Delegation & Conflict form
│   │   │   ├── ConflictModal.jsx        # Conflict detection warning modal
│   │   │   ├── ConflictBadge.jsx        # Dynamic conflict severity indicator
│   │   │   ├── MapDashboard.jsx         # MapLibre GL interactive operational map
│   │   │   └── ResponseView.jsx         # Live incident response simulation view
│   │   └── services/
│   │       └── adminService.js          # API clients for workflow & delegation
│   └── package.json
│
├── ai-services/
│   ├── agents/
│   │   ├── emergency_agent.py           # Emergency analysis & severity rating
│   │   ├── medical_agent.py             # Casualty triage & medical routing
│   │   ├── traffic_agent.py             # Route calculation & obstruction check
│   │   └── resource_agent.py            # Unit deployment & supply allocation
│   ├── api/
│   │   ├── delegation_routes.py         # Conflict check & delegation endpoints
│   │   └── workflow_routes.py           # Incident summary & graph topology endpoints
│   ├── orchestrator/
│   │   └── langgraph_orchestrator.py    # Multi-agent LangGraph state graph
│   ├── services/
│   │   ├── conflict_checker.py          # Round 2 Conflict Detection Engine
│   │   ├── image_validator.py           # Groq VLM image verification
│   │   └── sms_service.py               # Twilio SMS notification dispatch
│   ├── database/
│   │   └── mongodb.py                   # Async MongoDB client & collection handlers
│   └── main.py                          # FastAPI server & WebSocket manager
└── README.md
```

---

## ⚡ Quick Start Guide

### Prerequisites
- Python 3.10+
- Node.js 18+
- MongoDB instance (local or Atlas)

### 1. Backend Setup

```bash
cd ai-services

# Create and activate virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat <<EOT > .env
GROQ_API_KEY=your_groq_api_key
MONGODB_URI=your_mongodb_uri
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_phone
ORS_API_KEY=your_openrouteservice_key
EOT

# Start FastAPI server
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
Backend API will run at `http://127.0.0.1:8000`

---

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
cat <<EOT > .env
VITE_BACKEND_URL=http://127.0.0.1:8000
VITE_MAPTILER_KEY=your_maptiler_api_key
EOT

# Start Vite dev server
npm run dev
```
Frontend application will run at `http://localhost:5173`

---

## 🧪 Verification & Testing

### Running Round 2 End-to-End Conflict Verification
We provide an automated verification suite testing conflict detection across schedule overlaps, resource reservation collisions, duplicate tasks, and capacity thresholds:

```bash
cd ai-services
python test_round2_e2e.py
```

### Running Frontend Build Check
```bash
cd frontend
npm run build
```

---

---

## 🌐 Production Deployment Guide

This section describes how to deploy SwarmAI in production with the frontend hosted on **Cloudflare Pages** and the FastAPI backend hosted on **Railway**.

### Architecture Overview
```
[ Frontend: React + Vite ] (Cloudflare Pages)
            │
            ▼ HTTPS / WSS
[ Backend: FastAPI Server ] (Railway)
     ├── [ MongoDB Atlas ] (Persistent Database)
     ├── [ Cloudinary ] (Cloud Image Storage)
     ├── [ Groq Cloud ] (LLM & VLM Vision)
     └── [ Twilio ] (SMS Alerts)
```

---

### 1. Backend Deployment — Railway

1. **Create a Railway Project**:
   - Go to [Railway.app](https://railway.app) and create a new project.
   - Connect your GitHub repository.

2. **Configure Service Settings**:
   - **Root Directory**: `ai-services` (or repository root with `Procfile`).
   - **Build Command**: Railway automatically detects Python using `requirements.txt` and `runtime.txt`.
   - **Start Command**:
     ```bash
     uvicorn main:app --host 0.0.0.0 --port $PORT
     ```
     *(Handled automatically via `Procfile`)*.

3. **Configure Environment Variables in Railway**:
   Set the following variables in your Railway service dashboard:

   | Variable | Example Value / Description |
   | :--- | :--- |
   | `PORT` | Auto-set by Railway (default `8000`) |
   | `ALLOWED_ORIGINS` | `https://your-app.pages.dev,http://localhost:5173` |
   | `MONGODB_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/swarmai` |
   | `MONGODB_DATABASE` | `swarmai` |
   | `GROQ_API_KEY` | `gsk_...` |
   | `CLOUDINARY_CLOUD_NAME` | `your_cloud_name` |
   | `CLOUDINARY_API_KEY` | `your_api_key` |
   | `CLOUDINARY_API_SECRET` | `your_api_secret` |
   | `TWILIO_ACCOUNT_SID` | `AC_...` |
   | `TWILIO_AUTH_TOKEN` | `your_auth_token` |
   | `TWILIO_PHONE_NUMBER` | `+1234567890` |
   | `ADMIN_USERNAME` | `admin` |
   | `ADMIN_PASSWORD` | `your_secure_admin_password` |

---

### 2. Frontend Deployment — Cloudflare Pages

1. **Connect Cloudflare Pages**:
   - Open [Cloudflare Dashboard](https://dash.cloudflare.com/) -> **Workers & Pages** -> **Create application** -> **Pages**.
   - Select **Connect to Git** and pick your repository.

2. **Configure Build Settings**:
   - **Framework preset**: `Vite`
   - **Root directory**: `frontend`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`

3. **Configure Environment Variables in Cloudflare Pages**:
   - Add environment variable:
     - `VITE_API_URL` = `https://your-backend.up.railway.app`
     - `VITE_MAPTILER_KEY` = `your_maptiler_key`

4. **Single Page Application (SPA) Routing**:
   - Single-page client routing is configured automatically via `public/_redirects` (`/* /index.html 200`).

---

### 3. External Services Setup

#### 🍃 MongoDB Atlas Setup
1. Create a cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a Database User with read/write access.
3. Network Access: Whitelist IP `0.0.0.0/0` (or Railway IP range) to allow Railway backend connections.
4. Copy connection string into `MONGODB_URI`.

#### ☁️ Cloudinary Setup (Permanent Evidence Storage)
1. Sign up on [Cloudinary](https://cloudinary.com/).
2. Copy `Cloud Name`, `API Key`, and `API Secret` from Dashboard into Railway environment variables.
3. Uploaded evidence images are stored permanently in the `swarmai_disasters` Cloudinary folder.

---

## 🛡️ License

Distributed under the MIT License. See `LICENSE` for more information.

---

**Built by Team `sohamshejwal` (`U9L97JW9`) for Far Away 2026 Challenge #689.**