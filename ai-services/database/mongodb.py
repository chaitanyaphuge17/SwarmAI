import os
import logging
from pymongo import MongoClient, ASCENDING, DESCENDING
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("swarmai.database")

MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "swarmai")

if not MONGODB_URI:
    raise RuntimeError("MONGODB_URI environment variable is required.")

# ============================================================
# ROBUST CONNECTION POOL
# ============================================================

try:
    client = MongoClient(
        MONGODB_URI,
        maxPoolSize=50,
        minPoolSize=1,
        maxIdleTimeMS=45000,
        serverSelectionTimeoutMS=30000,   # 30s — survive slow DNS on reload
        connectTimeoutMS=10000,
        socketTimeoutMS=30000,
        retryWrites=True,
        # Prevent blocking DNS resolution from crashing the import
        connect=False,
    )
    db = client[MONGODB_DATABASE]
    logger.info("MongoDB client initialised (lazy connection).")
except Exception as _mongo_init_err:
    logger.error(f"MongoDB client failed to initialise: {_mongo_init_err}")
    client = None  # type: ignore[assignment]
    db = None      # type: ignore[assignment]

def _require_db():
    """Raises a clear error if the MongoDB client failed to initialise."""
    if db is None:
        raise RuntimeError(
            "MongoDB client is unavailable. Check MONGODB_URI and network connectivity."
        )
    return db

# Core Collections
disaster_events_collection = _require_db()["disaster_events"] if db is not None else None
disasters_collection       = _require_db()["disasters"]        if db is not None else None
assignments_collection     = _require_db()["assignments"]      if db is not None else None
notifications_collection   = _require_db()["notifications"]    if db is not None else None
workflow_events_collection = _require_db()["workflow_events"]  if db is not None else None
admin_users_collection     = _require_db()["admin_users"]      if db is not None else None


# ============================================================
# AUTOMATED ROBUST INDEXING
# ============================================================

def init_indexes():
    """
    Initializes and ensures high-performance indexes across all
    collections for robust scalability, conflict checking, and rapid queries.
    """
    try:
        # 1. disaster_events indexes
        disaster_events_collection.create_index([("event_id", ASCENDING)], unique=True)
        disaster_events_collection.create_index([("status", ASCENDING)])
        disaster_events_collection.create_index([("validationStatus", ASCENDING)])
        disaster_events_collection.create_index([("disaster_type", ASCENDING)])
        disaster_events_collection.create_index([("location", ASCENDING)])
        disaster_events_collection.create_index([("severity", DESCENDING)])
        disaster_events_collection.create_index([("created_at", DESCENDING)])
        disaster_events_collection.create_index([
            ("disaster_type", ASCENDING),
            ("location", ASCENDING),
            ("created_at", DESCENDING)
        ])

        # 2. assignments indexes (Critical for zero-latency conflict detection)
        assignments_collection.create_index([("id", ASCENDING)], unique=True)
        assignments_collection.create_index([("incidentId", ASCENDING)])
        assignments_collection.create_index([("teamId", ASCENDING), ("status", ASCENDING)])
        assignments_collection.create_index([("vehicleId", ASCENDING), ("status", ASCENDING)])
        assignments_collection.create_index([("startTime", ASCENDING), ("endTime", ASCENDING)])
        assignments_collection.create_index([("createdAt", DESCENDING)])

        # 3. notifications indexes
        notifications_collection.create_index([("notification_id", ASCENDING)], unique=True)
        notifications_collection.create_index([("incident_id", ASCENDING), ("dispatched_at", DESCENDING)])

        # 4. admin_users indexes
        admin_users_collection.create_index([("username", ASCENDING)], unique=True)

        # 5. workflow_events indexes (Strict incident isolation & high-speed timeline)
        workflow_events_collection.create_index([("id", ASCENDING)], unique=True)
        workflow_events_collection.create_index([("incident_id", ASCENDING), ("created_at", ASCENDING)])
        workflow_events_collection.create_index([("sender_agent_id", ASCENDING)])
        workflow_events_collection.create_index([("event_type", ASCENDING)])

        print("🛡️ Database indexes initialized and verified.")
    except Exception as e:
        print(f"⚠️ Index initialization notice: {e}")


def check_db_health() -> bool:
    """Verifies that MongoDB cluster is reachable and responding."""
    try:
        client.admin.command("ping")
        return True
    except Exception as e:
        logger.error(f"MongoDB health ping failed: {e}")
        return False