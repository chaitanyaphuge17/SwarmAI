import os
from datetime import datetime, timezone

from pymongo import MongoClient
from dotenv import load_dotenv


load_dotenv()


class MemoryManager:

    def __init__(self):

        # =====================================================
        # MONGODB CONFIGURATION
        # =====================================================

        self.mongodb_uri = os.getenv(
            "MONGODB_URI"
        )

        self.database_name = os.getenv(
            "MONGODB_DATABASE",
            "swarmai"
        )

        if not self.mongodb_uri:

            raise RuntimeError(
                "MONGODB_URI is not configured in .env"
            )

        # =====================================================
        # MONGODB CONNECTION
        # =====================================================

        self.client = MongoClient(
            self.mongodb_uri,

            # Prevent the application from hanging
            # indefinitely if MongoDB is unavailable.
            serverSelectionTimeoutMS=5000
        )

        self.db = self.client[
            self.database_name
        ]

        self.events_collection = (
            self.db["disaster_events"]
        )

        # =====================================================
        # CREATE INDEXES
        # =====================================================

        self.events_collection.create_index(
            "event_id",
            unique=True
        )

        self.events_collection.create_index(
            "disaster_type"
        )

        self.events_collection.create_index(
            "location"
        )

        self.events_collection.create_index(
            "severity"
        )

        self.events_collection.create_index(
            "created_at"
        )

        # Useful for historical-memory retrieval
        self.events_collection.create_index(
            [
                ("disaster_type", 1),
                ("location", 1),
                ("created_at", -1)
            ]
        )

        print(
            "🧠 MongoDB MemoryManager initialized"
        )

    # =========================================================
    # STORE EVENT
    # =========================================================

    def store_event(
        self,
        event
    ):

        if not event:

            print(
                "⚠️ Cannot store empty event"
            )

            return None

        event_to_store = dict(
            event
        )

        # -----------------------------------------------------
        # EVENT ID
        # -----------------------------------------------------

        event_id = event_to_store.get(
            "event_id"
        )

        if not event_id:

            print(
                "⚠️ Event has no event_id"
            )

            return None

        # -----------------------------------------------------
        # TIMESTAMP
        # -----------------------------------------------------

        event_to_store[
            "created_at"
        ] = datetime.now(
            timezone.utc
        )

        # -----------------------------------------------------
        # STORE / UPDATE
        #
        # Same event_id = update existing memory
        # Different event_id = new memory
        # -----------------------------------------------------

        try:

            result = (
                self.events_collection.update_one(

                    {
                        "event_id":
                            event_id
                    },

                    {
                        "$set":
                            event_to_store
                    },

                    upsert=True

                )
            )

            print(
                f"🧠 Disaster memory stored: "
                f"{event_id}"
            )

            return result

        except Exception as e:

            print(
                "❌ MongoDB store error:",
                e
            )

            return None

    # =========================================================
    # GET ALL MEMORY
    # =========================================================

    def get_memory(
        self,
        limit=50
    ):

        try:

            events = list(

                self.events_collection.find(

                    {},

                    {
                        "_id": 0
                    }

                )
                .sort(
                    "created_at",
                    -1
                )
                .limit(limit)

            )

            return events

        except Exception as e:

            print(
                "❌ MongoDB memory retrieval error:",
                e
            )

            return []

    # =========================================================
    # FIND SIMILAR EVENTS
    # =========================================================

    def find_similar_events(
        self,
        severity=None,
        disaster_type=None,
        location=None,
        limit=10
    ):

        query = {}

        # -----------------------------------------------------
        # DISASTER TYPE
        # -----------------------------------------------------

        if disaster_type:

            query[
                "disaster_type"
            ] = disaster_type

        # -----------------------------------------------------
        # LOCATION
        # -----------------------------------------------------

        if location:

            query[
                "location"
            ] = location

        # -----------------------------------------------------
        # SEVERITY
        # -----------------------------------------------------

        if severity is not None:

            query[
                "severity"
            ] = severity

        try:

            events = list(

                self.events_collection.find(

                    query,

                    {
                        "_id": 0
                    }

                )
                .sort(
                    "created_at",
                    -1
                )
                .limit(limit)

            )

            return events

        except Exception as e:

            print(
                "❌ Similar-event search error:",
                e
            )

            return []

    # =========================================================
    # GET HISTORICAL CONTEXT
    # =========================================================

    def get_historical_context(
        self,
        event,
        limit=5
    ):

        """
        Retrieve relevant historical disaster memory.

        Retrieval priority:

            1. Same disaster type + same location
            2. Same disaster type
            3. Same location
            4. Recent disasters

        The current event is always excluded.
        """

        if not event:

            return []

        disaster_type = event.get(
            "disaster_type"
        )

        location = event.get(
            "location"
        )

        current_event_id = event.get(
            "event_id"
        )

        # =====================================================
        # COMMON EXCLUSION
        # =====================================================

        exclusion = {}

        if current_event_id:

            exclusion[
                "event_id"
            ] = {
                "$ne":
                    current_event_id
            }

        # =====================================================
        # PRIORITY 1
        #
        # SAME DISASTER + SAME LOCATION
        # =====================================================

        events = []

        if disaster_type and location:

            query = {

                "disaster_type":
                    disaster_type,

                "location":
                    location,

                **exclusion

            }

            try:

                events = list(

                    self.events_collection.find(

                        query,

                        {
                            "_id": 0
                        }

                    )
                    .sort(
                        "created_at",
                        -1
                    )
                    .limit(limit)

                )

            except Exception as e:

                print(
                    "⚠️ Same disaster/location "
                    "memory search failed:",
                    e
                )

        # =====================================================
        # PRIORITY 2
        #
        # SAME DISASTER TYPE
        # =====================================================

        if (
            len(events) < limit
            and disaster_type
        ):

            remaining = (
                limit -
                len(events)
            )

            existing_ids = [

                item.get(
                    "event_id"
                )

                for item in events

            ]

            query = {

                "disaster_type":
                    disaster_type,

                **exclusion

            }

            if existing_ids:

                query[
                    "event_id"
                ] = {

                    "$nin":
                        existing_ids

                }

            try:

                additional_events = list(

                    self.events_collection.find(

                        query,

                        {
                            "_id": 0
                        }

                    )
                    .sort(
                        "created_at",
                        -1
                    )
                    .limit(remaining)

                )

                events.extend(
                    additional_events
                )

            except Exception as e:

                print(
                    "⚠️ Disaster-type memory "
                    "search failed:",
                    e
                )

        # =====================================================
        # PRIORITY 3
        #
        # SAME LOCATION
        # =====================================================

        if (
            len(events) < limit
            and location
        ):

            remaining = (
                limit -
                len(events)
            )

            existing_ids = [

                item.get(
                    "event_id"
                )

                for item in events

            ]

            query = {

                "location":
                    location,

                **exclusion

            }

            if existing_ids:

                query[
                    "event_id"
                ] = {

                    "$nin":
                        existing_ids

                }

            try:

                additional_events = list(

                    self.events_collection.find(

                        query,

                        {
                            "_id": 0
                        }

                    )
                    .sort(
                        "created_at",
                        -1
                    )
                    .limit(remaining)

                )

                events.extend(
                    additional_events
                )

            except Exception as e:

                print(
                    "⚠️ Location memory "
                    "search failed:",
                    e
                )

        # =====================================================
        # PRIORITY 4
        #
        # RECENT DISASTERS
        # =====================================================

        if len(events) < limit:

            remaining = (
                limit -
                len(events)
            )

            existing_ids = [

                item.get(
                    "event_id"
                )

                for item in events

            ]

            query = dict(
                exclusion
            )

            if existing_ids:

                query[
                    "event_id"
                ] = {

                    "$nin":
                        existing_ids

                }

            try:

                additional_events = list(

                    self.events_collection.find(

                        query,

                        {
                            "_id": 0
                        }

                    )
                    .sort(
                        "created_at",
                        -1
                    )
                    .limit(remaining)

                )

                events.extend(
                    additional_events
                )

            except Exception as e:

                print(
                    "⚠️ Recent-memory "
                    "search failed:",
                    e
                )

        # =====================================================
        # BUILD COMPACT MEMORY
        # =====================================================

        historical_context = []

        for historical in events:

            historical_context.append({

                "event_id":
                    historical.get(
                        "event_id"
                    ),

                "disaster_type":
                    historical.get(
                        "disaster_type"
                    ),

                "location":
                    historical.get(
                        "location"
                    ),

                "severity":
                    historical.get(
                        "severity",
                        0
                    ),

                "victims":
                    historical.get(
                        "victims",
                        0
                    ),

                "traffic_impact":
                    historical.get(
                        "traffic_impact"
                    ),

                "traffic_level":
                    historical.get(
                        "traffic_level"
                    ),

                "medical_access_impact":
                    historical.get(
                        "medical_access_impact"
                    ),

                "evacuation_required":
                    historical.get(
                        "evacuation_required",
                        False
                    ),

                "confidence":
                    historical.get(
                        "confidence"
                    ),

                "summary":
                    historical.get(
                        "summary"
                    ),

                "created_at":
                    historical.get(
                        "created_at"
                    )

            })

        # =====================================================
        # DEBUG
        # =====================================================

        print(
            "\n🧠 HISTORICAL MEMORY RETRIEVED:",
            len(historical_context),
            "events"
        )

        for index, memory in enumerate(
            historical_context,
            start=1
        ):

            print(

                f"[{index}] "
                f"{memory.get('disaster_type')} | "
                f"{memory.get('location')} | "
                f"Severity "
                f"{memory.get('severity')}"

            )

        return historical_context

    # =========================================================
    # GET EVENT BY ID
    # =========================================================

    def get_event(
        self,
        event_id
    ):

        if not event_id:

            return None

        try:

            event = (
                self.events_collection.find_one(

                    {
                        "event_id":
                            event_id
                    },

                    {
                        "_id": 0
                    }

                )
            )

            return event

        except Exception as e:

            print(
                "❌ Event retrieval error:",
                e
            )

            return None

    # =========================================================
    # DELETE EVENT (DISABLED — disaster records are permanent)
    # =========================================================

    def delete_event(
        self,
        event_id
    ):
        """
        Disaster record deletion is permanently disabled.
        Disaster records are immutable and must be preserved for
        historical accuracy, audit trails, and legal compliance.
        This method intentionally performs no database operation.
        """
        print(
            f"⛔ delete_event called for {event_id} — "
            "disaster deletion is disabled. No data was modified."
        )
        return False

    # =========================================================
    # DATABASE HEALTH CHECK
    # =========================================================

    def ping(self):

        try:

            self.client.admin.command(
                "ping"
            )

            print(
                "✅ MongoDB connection healthy"
            )

            return True

        except Exception as e:

            print(
                "❌ MongoDB connection error:",
                e
            )

            return False

    # =========================================================
    # CLOSE CONNECTION
    # =========================================================

    def close(self):

        try:

            self.client.close()

            print(
                "🧠 MongoDB connection closed"
            )

        except Exception as e:

            print(
                "⚠️ MongoDB close error:",
                e
            )