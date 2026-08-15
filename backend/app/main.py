import asyncio
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from sqlalchemy import create_engine, Column, String, Float, DateTime, Text
from sqlalchemy.orm import declarative_base, sessionmaker

from .ml_engine import analyze_transaction
from .simulator import SimulationEngine


# ============================================================
# CONFIG
# ============================================================

APP_NAME = "FinShield API"
APP_VERSION = "1.0.0"


# ============================================================
# DATABASE CONFIGURATION
# ============================================================

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

if DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace(
        "postgres://",
        "postgresql://",
        1,
    )

    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=300,
        future=True,
    )

else:
    DB_PATH = (
        Path(__file__).resolve().parent.parent
        / "finshield.db"
    )

    engine = create_engine(
        f"sqlite:///{DB_PATH}",
        connect_args={
            "check_same_thread": False
        },
        future=True,
    )


SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()


# ============================================================
# DATABASE MODELS
# ============================================================

class Transaction(Base):

    __tablename__ = "transactions"

    id = Column(
        String,
        primary_key=True,
    )

    account_id = Column(
        String,
        index=True,
    )

    device_id = Column(String)

    merchant = Column(String)

    amount = Column(Float)

    location = Column(String)

    ip = Column(String)

    timestamp = Column(DateTime)

    risk_score = Column(Float)

    fraud_probability = Column(Float)

    anomaly_score = Column(Float)

    risk_level = Column(String)

    explanation = Column(Text)


class Alert(Base):

    __tablename__ = "alerts"

    id = Column(
        String,
        primary_key=True,
    )

    transaction_id = Column(String)

    account_id = Column(String)

    severity = Column(String)

    risk_score = Column(Float)

    title = Column(String)

    explanation = Column(Text)

    status = Column(
        String,
        default="OPEN",
    )

    created_at = Column(DateTime)


# ============================================================
# CREATE DATABASE TABLES
# ============================================================

Base.metadata.create_all(
    bind=engine
)


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="FinShield Fraud Intelligence API",
)


# ============================================================
# CORS
# ============================================================

# This allows:
# - Vercel production
# - Vercel preview
# - localhost development
# - Render testing
#
# No cookies/auth credentials are being used.

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400,
)


# ============================================================
# SIMULATION HUB
# ============================================================

class Hub:

    def __init__(self):

        self.clients = set()

        self.running = False

        self.task = None

        self.scenario = "coordinated_fraud"

        self.engine = SimulationEngine()


hub = Hub()


# ============================================================
# DATABASE HELPER
# ============================================================

def get_db():

    return SessionLocal()


# ============================================================
# DATABASE SEED
# ============================================================

def seed_database():

    db = get_db()

    try:

        existing = (
            db.query(Transaction).count()
        )

        if existing > 0:

            print(
                f"Database already contains "
                f"{existing} transactions."
            )

            return

        print(
            "Creating FinShield demo data..."
        )

        now = datetime.utcnow()

        for i in range(80):

            tx = hub.engine.normal_transaction(
                now - timedelta(
                    minutes=80 - i
                )
            )

            result = analyze_transaction(
                tx,
                db,
            )

            transaction_data = result.get(
                "transaction"
            )

            if transaction_data:

                db.add(
                    Transaction(
                        **transaction_data
                    )
                )

            alert_data = result.get(
                "alert"
            )

            if alert_data:

                db.add(
                    Alert(
                        **alert_data
                    )
                )

        db.commit()

        print(
            "Demo data created successfully."
        )

    except Exception as exc:

        db.rollback()

        print(
            "Database seed error:",
            repr(exc),
        )

    finally:

        db.close()


# ============================================================
# STARTUP
# ============================================================

@app.on_event("startup")
async def startup_event():

    print("=" * 60)
    print("FINSHIELD API STARTING")
    print("=" * 60)

    try:

        Base.metadata.create_all(
            bind=engine
        )

        seed_database()

    except Exception as exc:

        print(
            "Startup error:",
            repr(exc),
        )

    print(
        "FinShield API started successfully."
    )


# ============================================================
# SHUTDOWN
# ============================================================

@app.on_event("shutdown")
async def shutdown_event():

    print(
        "FinShield API shutting down..."
    )

    hub.running = False

    if hub.task is not None:

        if not hub.task.done():

            hub.task.cancel()

            try:

                await hub.task

            except asyncio.CancelledError:

                pass

        hub.task = None

    print(
        "FinShield API shutdown complete."
    )


# ============================================================
# BROADCAST
# ============================================================

async def broadcast(payload):

    dead_clients = []

    message = json.dumps(
        payload,
        default=str,
    )

    for websocket in list(
        hub.clients
    ):

        try:

            await websocket.send_text(
                message
            )

        except Exception:

            dead_clients.append(
                websocket
            )

    for websocket in dead_clients:

        hub.clients.discard(
            websocket
        )


# ============================================================
# SIMULATION LOOP
# ============================================================

async def simulation_loop():

    hub.running = True

    print(
        f"Simulation started: "
        f"{hub.scenario}"
    )

    try:

        while hub.running:

            tx = hub.engine.next(
                hub.scenario
            )

            db = get_db()

            result = None

            try:

                result = analyze_transaction(
                    tx,
                    db,
                )

                transaction_data = result.get(
                    "transaction"
                )

                if transaction_data:

                    db.add(
                        Transaction(
                            **transaction_data
                        )
                    )

                alert_data = result.get(
                    "alert"
                )

                if alert_data:

                    db.add(
                        Alert(
                            **alert_data
                        )
                    )

                db.commit()

            except Exception as exc:

                db.rollback()

                print(
                    "Simulation database error:",
                    repr(exc),
                )

            finally:

                db.close()

            if result is not None:

                await broadcast(
                    {
                        "type": "transaction",
                        "data": result,
                    }
                )

            await asyncio.sleep(0.9)

    except asyncio.CancelledError:

        print(
            "Simulation cancelled."
        )

    except Exception as exc:

        print(
            "Simulation error:",
            repr(exc),
        )

    finally:

        hub.running = False

        print(
            "Simulation stopped."
        )


# ============================================================
# ROOT
# ============================================================

@app.get("/")
async def root():

    return {
        "name": APP_NAME,
        "status": "online",
        "version": APP_VERSION,
        "message": (
            "FinShield Fraud Intelligence "
            "API is running."
        ),
        "docs": "/docs",
        "redoc": "/redoc",
        "health": "/api/health",
        "endpoints": {
            "dashboard": "/api/dashboard/summary",
            "transactions": "/api/transactions",
            "alerts": "/api/fraud/alerts",
            "graph": "/api/graph",
            "simulation": "/api/simulation/status",
            "websocket": "/ws/transactions",
        },
    }


# ============================================================
# ROOT HEAD
# ============================================================

@app.head("/")
async def root_head():

    return JSONResponse(
        content=None,
        status_code=200,
    )


# ============================================================
# HEALTH
# ============================================================

@app.get("/api/health")
async def health():

    database_status = "online"

    db = None

    try:

        db = get_db()

        db.query(
            Transaction
        ).limit(1).all()

    except Exception as exc:

        database_status = "offline"

        print(
            "Database health error:",
            repr(exc),
        )

    finally:

        if db is not None:

            db.close()

    return {
        "status": (
            "operational"
            if database_status == "online"
            else "degraded"
        ),
        "service": APP_NAME,
        "version": APP_VERSION,
        "services": {
            "api": "online",
            "database": database_status,
            "ml_engine": "online",
            "stream_processor": (
                "online"
                if hub.running
                else "standby"
            ),
        },
        "timestamp": datetime.utcnow().isoformat(),
    }


# ============================================================
# DASHBOARD SUMMARY
# ============================================================

@app.get("/api/dashboard/summary")
async def dashboard_summary():

    db = get_db()

    try:

        total = (
            db.query(
                Transaction
            ).count()
        )

        alerts_count = (
            db.query(
                Alert
            ).count()
        )

        transactions = (
            db.query(
                Transaction
            ).all()
        )

        if transactions:

            average_risk = (
                sum(
                    (
                        tx.risk_score
                        or 0
                    )
                    for tx in transactions
                )
                / len(transactions)
            )

        else:

            average_risk = 0

        critical = (
            db.query(
                Transaction
            )
            .filter(
                Transaction.risk_score >= 75
            )
            .count()
        )

        suspicious = (
            db.query(
                Transaction
            )
            .filter(
                Transaction.risk_score >= 50,
                Transaction.risk_score < 75,
            )
            .count()
        )

        return {
            "transactions": total,
            "alerts": alerts_count,
            "average_risk": round(
                average_risk,
                1,
            ),
            "critical": critical,
            "suspicious": suspicious,
            "transactions_per_minute": 68,
        }

    finally:

        db.close()


# ============================================================
# TRANSACTIONS
# ============================================================

@app.get("/api/transactions")
async def get_transactions(
    limit: int = 80,
):

    limit = max(
        1,
        min(
            limit,
            500,
        ),
    )

    db = get_db()

    try:

        rows = (
            db.query(
                Transaction
            )
            .order_by(
                Transaction.timestamp.desc()
            )
            .limit(limit)
            .all()
        )

        return [
            {
                column.name: getattr(
                    row,
                    column.name,
                )
                for column
                in Transaction.__table__.columns
            }
            for row in rows
        ]

    finally:

        db.close()


# ============================================================
# SINGLE TRANSACTION
# ============================================================

@app.get(
    "/api/transactions/{tx_id}"
)
async def get_transaction(
    tx_id: str,
):

    db = get_db()

    try:

        row = db.get(
            Transaction,
            tx_id,
        )

        if row is None:

            raise HTTPException(
                status_code=404,
                detail="Transaction not found",
            )

        return {
            column.name: getattr(
                row,
                column.name,
            )
            for column
            in Transaction.__table__.columns
        }

    finally:

        db.close()


# ============================================================
# FRAUD ALERTS
# ============================================================

@app.get("/api/fraud/alerts")
async def get_alerts():

    db = get_db()

    try:

        rows = (
            db.query(
                Alert
            )
            .order_by(
                Alert.created_at.desc()
            )
            .limit(100)
            .all()
        )

        return [
            {
                column.name: getattr(
                    row,
                    column.name,
                )
                for column
                in Alert.__table__.columns
            }
            for row in rows
        ]

    finally:

        db.close()


# ============================================================
# UPDATE ALERT STATUS
# ============================================================

@app.post(
    "/api/fraud/alerts/{alert_id}/status"
)
async def update_alert_status(
    alert_id: str,
    status: str,
):

    db = get_db()

    try:

        row = db.get(
            Alert,
            alert_id,
        )

        if row is None:

            raise HTTPException(
                status_code=404,
                detail="Alert not found",
            )

        allowed_statuses = {
            "OPEN",
            "INVESTIGATING",
            "RESOLVED",
            "DISMISSED",
            "CLOSED",
        }

        new_status = status.upper().strip()

        if new_status not in allowed_statuses:

            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid status. "
                    "Allowed values: "
                    + ", ".join(
                        sorted(
                            allowed_statuses
                        )
                    )
                ),
            )

        row.status = new_status

        db.commit()

        return {
            "ok": True,
            "alert_id": alert_id,
            "status": row.status,
        }

    except HTTPException:

        db.rollback()

        raise

    except Exception as exc:

        db.rollback()

        print(
            "Alert status error:",
            repr(exc),
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to update alert status",
        )

    finally:

        db.close()


# ============================================================
# FRAUD GRAPH
# ============================================================

@app.get("/api/graph")
async def fraud_graph():

    db = get_db()

    try:

        rows = (
            db.query(
                Transaction
            )
            .filter(
                Transaction.risk_score >= 50
            )
            .order_by(
                Transaction.timestamp.desc()
            )
            .limit(80)
            .all()
        )

        nodes = {}

        edges = []

        edge_keys = set()

        for row in rows:

            entities = [
                (
                    row.account_id,
                    "account",
                    row.account_id,
                ),
                (
                    row.device_id,
                    "device",
                    row.device_id,
                ),
                (
                    row.merchant,
                    "merchant",
                    row.merchant,
                ),
            ]

            for (
                node_id,
                node_type,
                label,
            ) in entities:

                if node_id:

                    nodes.setdefault(
                        node_id,
                        {
                            "id": node_id,
                            "type": node_type,
                            "label": label,
                        },
                    )

            if (
                row.account_id
                and row.device_id
            ):

                edge_key = (
                    row.account_id,
                    row.device_id,
                    "uses",
                )

                if edge_key not in edge_keys:

                    edges.append(
                        {
                            "source": row.account_id,
                            "target": row.device_id,
                            "label": "uses",
                        }
                    )

                    edge_keys.add(
                        edge_key
                    )

            if (
                row.account_id
                and row.merchant
            ):

                edge_key = (
                    row.account_id,
                    row.merchant,
                    "pays",
                )

                if edge_key not in edge_keys:

                    edges.append(
                        {
                            "source": row.account_id,
                            "target": row.merchant,
                            "label": "pays",
                        }
                    )

                    edge_keys.add(
                        edge_key
                    )

        return {
            "nodes": list(
                nodes.values()
            ),
            "edges": edges,
        }

    finally:

        db.close()


# ============================================================
# SIMULATION STATUS
# ============================================================

@app.get(
    "/api/simulation/status"
)
async def simulation_status():

    return {
        "running": hub.running,
        "scenario": hub.scenario,
    }


# ============================================================
# START SIMULATION
# ============================================================

@app.post(
    "/api/simulation/start"
)
async def start_simulation(
    scenario: str = "coordinated_fraud",
):

    if hub.running:

        return {
            "running": True,
            "scenario": hub.scenario,
            "message": (
                "Simulation is already running."
            ),
        }

    scenario = scenario.strip()

    if not scenario:

        scenario = "coordinated_fraud"

    hub.scenario = scenario

    hub.running = True

    hub.task = asyncio.create_task(
        simulation_loop()
    )

    return {
        "running": True,
        "scenario": hub.scenario,
        "message": "Simulation started.",
    }


# ============================================================
# STOP SIMULATION
# ============================================================

@app.post(
    "/api/simulation/stop"
)
async def stop_simulation():

    hub.running = False

    return {
        "running": False,
        "scenario": hub.scenario,
        "message": "Simulation stopping.",
    }


# ============================================================
# WEBSOCKET
# ============================================================

@app.websocket(
    "/ws/transactions"
)
async def websocket_transactions(
    websocket: WebSocket,
):

    await websocket.accept()

    hub.clients.add(
        websocket
    )

    try:

        await websocket.send_text(
            json.dumps(
                {
                    "type": "connection",
                    "status": "connected",
                    "message": (
                        "FinShield transaction "
                        "stream connected."
                    ),
                }
            )
        )

        while True:

            await websocket.receive_text()

    except WebSocketDisconnect:

        hub.clients.discard(
            websocket
        )

    except Exception as exc:

        print(
            "WebSocket error:",
            repr(exc),
        )

        hub.clients.discard(
            websocket
        )


# ============================================================
# GLOBAL ERROR HANDLER
# ============================================================

@app.exception_handler(Exception)
async def global_exception_handler(
    request,
    exc,
):

    print(
        "Unhandled API error:",
        repr(exc),
    )

    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": (
                "FinShield API encountered "
                "an unexpected error."
            ),
        },
    )
