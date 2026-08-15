import asyncio
import json
import os
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import create_engine, Column, String, Float, DateTime, Text
from sqlalchemy.orm import declarative_base, sessionmaker

from .ml_engine import analyze_transaction
from .simulator import SimulationEngine


# ============================================================
# DATABASE
# ============================================================

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

if DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace(
        "postgres://",
        "postgresql://",
        1
    )

    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True
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
        }
    )


SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False
)

Base = declarative_base()


# ============================================================
# DATABASE MODELS
# ============================================================

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True)
    account_id = Column(String, index=True)
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

    id = Column(String, primary_key=True)
    transaction_id = Column(String)
    account_id = Column(String)
    severity = Column(String)
    risk_score = Column(Float)
    title = Column(String)
    explanation = Column(Text)
    status = Column(String, default="OPEN")
    created_at = Column(DateTime)


Base.metadata.create_all(engine)


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="FinShield API",
    version="1.0.0"
)


# ============================================================
# CORS FIX
# ============================================================

app.add_middleware(
    CORSMiddleware,

    # Allow all Vercel preview/production deployments
    allow_origin_regex=r"https://.*\.vercel\.app",

    # Local development
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],

    # We are not using cookies/auth credentials
    allow_credentials=False,

    allow_methods=["*"],
    allow_headers=["*"],
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
# SEED DATABASE
# ============================================================

def seed():

    db = SessionLocal()

    try:

        existing = db.query(Transaction).count()

        if existing > 0:
            return

        now = datetime.utcnow()

        for i in range(80):

            tx = hub.engine.normal_transaction(
                now - timedelta(minutes=80 - i)
            )

            result = analyze_transaction(
                tx,
                db
            )

            db.add(
                Transaction(
                    **result["transaction"]
                )
            )

        db.commit()

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


seed()


# ============================================================
# WEBSOCKET BROADCAST
# ============================================================

async def broadcast(payload):

    dead = []

    for ws in list(hub.clients):

        try:

            await ws.send_text(
                json.dumps(
                    payload,
                    default=str
                )
            )

        except Exception:

            dead.append(ws)

    for ws in dead:
        hub.clients.discard(ws)


# ============================================================
# SIMULATION LOOP
# ============================================================

async def simulation_loop():

    hub.running = True

    try:

        while hub.running:

            tx = hub.engine.next(
                hub.scenario
            )

            db = SessionLocal()

            try:

                result = analyze_transaction(
                    tx,
                    db
                )

                db.add(
                    Transaction(
                        **result["transaction"]
                    )
                )

                if result.get("alert"):

                    db.add(
                        Alert(
                            **result["alert"]
                        )
                    )

                db.commit()

            except Exception:

                db.rollback()

                raise

            finally:

                db.close()

            await broadcast(
                {
                    "type": "transaction",
                    "data": result
                }
            )

            await asyncio.sleep(0.9)

    except asyncio.CancelledError:

        pass

    except Exception as e:

        print(
            "Simulation error:",
            repr(e)
        )

    finally:

        hub.running = False


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "name": "FinShield API",
        "status": "online",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health"
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/api/health")
def health():

    # Test database connection too
    database_status = "online"

    db = SessionLocal()

    try:
        db.query(Transaction).limit(1).all()

    except Exception as e:

        database_status = "offline"

        print(
            "Database health error:",
            repr(e)
        )

    finally:
        db.close()

    return {
        "status": "operational"
        if database_status == "online"
        else "degraded",

        "services": {
            "api": "online",
            "database": database_status,
            "ml_engine": "online",
            "stream_processor": (
                "online"
                if hub.running
                else "standby"
            )
        }
    }


# ============================================================
# DASHBOARD SUMMARY
# ============================================================

@app.get("/api/dashboard/summary")
def summary():

    db = SessionLocal()

    try:

        total = db.query(
            Transaction
        ).count()

        alerts = db.query(
            Alert
        ).count()

        transactions = db.query(
            Transaction
        ).all()

        avg = (
            sum(
                (x.risk_score or 0)
                for x in transactions
            )
            / max(total, 1)
        )

        critical = db.query(
            Transaction
        ).filter(
            Transaction.risk_score >= 75
        ).count()

        suspicious = db.query(
            Transaction
        ).filter(
            Transaction.risk_score >= 50,
            Transaction.risk_score < 75
        ).count()

        return {
            "transactions": total,
            "alerts": alerts,
            "average_risk": round(avg, 1),
            "critical": critical,
            "suspicious": suspicious,
            "transactions_per_minute": 68
        }

    finally:

        db.close()


# ============================================================
# TRANSACTIONS
# ============================================================

@app.get("/api/transactions")
def transactions(limit: int = 80):

    limit = max(
        1,
        min(limit, 500)
    )

    db = SessionLocal()

    try:

        rows = (
            db.query(Transaction)
            .order_by(
                Transaction.timestamp.desc()
            )
            .limit(limit)
            .all()
        )

        return [
            {
                c.name: getattr(
                    row,
                    c.name
                )
                for c in Transaction.__table__.columns
            }
            for row in rows
        ]

    finally:

        db.close()


# ============================================================
# SINGLE TRANSACTION
# ============================================================

@app.get("/api/transactions/{tx_id}")
def transaction(tx_id: str):

    db = SessionLocal()

    try:

        row = db.get(
            Transaction,
            tx_id
        )

        if not row:

            raise HTTPException(
                status_code=404,
                detail="Transaction not found"
            )

        return {
            c.name: getattr(
                row,
                c.name
            )
            for c in Transaction.__table__.columns
        }

    finally:

        db.close()


# ============================================================
# FRAUD ALERTS
# ============================================================

@app.get("/api/fraud/alerts")
def alerts():

    db = SessionLocal()

    try:

        rows = (
            db.query(Alert)
            .order_by(
                Alert.created_at.desc()
            )
            .limit(100)
            .all()
        )

        return [
            {
                c.name: getattr(
                    row,
                    c.name
                )
                for c in Alert.__table__.columns
            }
            for row in rows
        ]

    finally:

        db.close()


# ============================================================
# UPDATE ALERT STATUS
# ============================================================

@app.post("/api/fraud/alerts/{alert_id}/status")
def alert_status(
    alert_id: str,
    status: str
):

    db = SessionLocal()

    try:

        row = db.get(
            Alert,
            alert_id
        )

        if not row:

            raise HTTPException(
                status_code=404,
                detail="Alert not found"
            )

        row.status = status.upper()

        db.commit()

        return {
            "ok": True,
            "status": row.status
        }

    except Exception:

        db.rollback()
        raise

    finally:

        db.close()


# ============================================================
# FRAUD GRAPH
# ============================================================

@app.get("/api/graph")
def graph():

    db = SessionLocal()

    try:

        rows = (
            db.query(Transaction)
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

        for row in rows:

            entities = [
                (
                    row.account_id,
                    "account",
                    row.account_id
                ),
                (
                    row.device_id,
                    "device",
                    row.device_id
                ),
                (
                    row.merchant,
                    "merchant",
                    row.merchant
                )
            ]

            for key, node_type, label in entities:

                if key:

                    nodes.setdefault(
                        key,
                        {
                            "id": key,
                            "type": node_type,
                            "label": label
                        }
                    )

            if row.account_id and row.device_id:

                edges.append(
                    {
                        "source": row.account_id,
                        "target": row.device_id,
                        "label": "uses"
                    }
                )

            if row.account_id and row.merchant:

                edges.append(
                    {
                        "source": row.account_id,
                        "target": row.merchant,
                        "label": "pays"
                    }
                )

        return {
            "nodes": list(nodes.values()),
            "edges": edges
        }

    finally:

        db.close()


# ============================================================
# SIMULATION STATUS
# ============================================================

@app.get("/api/simulation/status")
def sim_status():

    return {
        "running": hub.running,
        "scenario": hub.scenario
    }


# ============================================================
# START SIMULATION
# ============================================================

@app.post("/api/simulation/start")
async def start_simulation(
    scenario: str = "coordinated_fraud"
):

    if hub.running:

        return {
            "running": True,
            "scenario": hub.scenario
        }

    hub.scenario = scenario

    hub.task = asyncio.create_task(
        simulation_loop()
    )

    return {
        "running": True,
        "scenario": scenario
    }


# ============================================================
# STOP SIMULATION
# ============================================================

@app.post("/api/simulation/stop")
async def stop_simulation():

    hub.running = False

    return {
        "running": False,
        "scenario": hub.scenario
    }


# ============================================================
# WEBSOCKET
# ============================================================

@app.websocket("/ws/transactions")
async def ws_transactions(
    websocket: WebSocket
):

    await websocket.accept()

    hub.clients.add(websocket)

    try:

        while True:

            await websocket.receive_text()

    except WebSocketDisconnect:

        hub.clients.discard(websocket)

    except Exception:

        hub.clients.discard(websocket)
