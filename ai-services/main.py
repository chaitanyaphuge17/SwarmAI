
import os
import sys

# Force UTF-8 output so emoji in print() calls don't crash
# on Windows terminals that default to cp1252.
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr.encoding != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8")

from dotenv import load_dotenv

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


# ============================================================
# LOAD ENVIRONMENT VARIABLES
# ============================================================

load_dotenv()


# ============================================================
# DEBUG ENVIRONMENT
# ============================================================

print("\n" + "=" * 70)
print("🔐 ENVIRONMENT CONFIGURATION")
print("=" * 70)

if os.getenv("GROQ_API_KEY"):
    print("✅ GROQ_API_KEY loaded")
else:
    print("❌ GROQ_API_KEY is missing")

print("=" * 70 + "\n")


# ============================================================
# API ROUTERS
# ============================================================

from api.dashboard_routes import (
    router as dashboard_router
)

from api.status_routes import (
    router as status_router
)

from api.disaster_routes import (
    router as disaster_router
)

from api.map_routes import (
    router as map_router
)

from api.scenario_routes import (
    router as scenario_router
)

# Round 2 routers
from api.incident_routes import (
    router as incident_router
)

from api.notification_routes import (
    router as notification_router
)

from api.delegation_routes import (
    router as delegation_router
)

from api.workflow_routes import (
    router as workflow_router
)

from api.auth_routes import (
    router as auth_router
)

from database.mongodb import init_indexes



# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="SwarmAI Disaster System",
    version="1.0.0",
    description=(
        "AI-powered multi-agent disaster detection "
        "and emergency coordination system."
    )
)


# ============================================================
# CORS CONFIGURATION
# ============================================================

allowed_origins = [

    "http://localhost:5173",

    "http://127.0.0.1:5173",

]


# ============================================================
# ENVIRONMENT ORIGINS
# ============================================================

env_origins = os.getenv(
    "ALLOWED_ORIGINS"
)


if env_origins:

    additional_origins = [

        origin.strip()

        for origin in env_origins.split(",")

        if origin.strip()

    ]

    allowed_origins.extend(
        additional_origins
    )


print("\n🌐 ALLOWED CORS ORIGINS:")

for origin in allowed_origins:

    print(
        f"   • {origin}"
    )

print()


# ============================================================
# ADD CORS MIDDLEWARE
# ============================================================

app.add_middleware(

    CORSMiddleware,

    allow_origins=allowed_origins,

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],

)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
async def root():

    return {

        "message":
            "SwarmAI Disaster Backend Running",

        "status":
            "online",

        "version":
            "1.0.0"

    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
async def health_check():

    return {

        "status":
            "healthy",

        "groq_configured":
            bool(
                os.getenv(
                    "GROQ_API_KEY"
                )
            )

    }


# ============================================================
# ROUTERS
# ============================================================

app.include_router(

    dashboard_router

)


app.include_router(

    status_router

)


app.include_router(

    disaster_router

)


app.include_router(

    map_router

)


app.include_router(

    scenario_router

)


# Round 2 routers
app.include_router(incident_router)
app.include_router(notification_router)
app.include_router(delegation_router)
app.include_router(workflow_router)
app.include_router(auth_router)
app.include_router(auth_router, prefix="")


# ============================================================
# STATIC FILES FOR EVIDENCE UPLOADS
# ============================================================

from fastapi.staticfiles import StaticFiles

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


# ============================================================
# STARTUP EVENT
# ============================================================

@app.on_event("startup")
async def startup_event():

    init_indexes()

    print("\n" + "=" * 70)

    print(
        "🚀 SWARMAI DISASTER SYSTEM STARTED"
    )

    print("=" * 70)

    print(
        "📡 API Server: http://127.0.0.1:8000"
    )

    print(
        "📚 Swagger Docs: http://127.0.0.1:8000/docs"
    )

    print(
        "❤️ Health Check: http://127.0.0.1:8000/health"
    )

    print(
        "🔌 WebSocket: ws://127.0.0.1:8000/ws/disaster"
    )

    print("=" * 70 + "\n")

