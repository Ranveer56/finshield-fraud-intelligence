import asyncio, json, os, uuid
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, String, Float, DateTime, Integer, Text
from sqlalchemy.orm import declarative_base, sessionmaker

from .ml_engine import analyze_transaction
from .simulator import SimulationEngine

DATABASE_URL = os.getenv("DATABASE_URL", "")
if DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
else:
    DB_PATH = Path(__file__).resolve().parent.parent / "finshield.db"
    engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

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

app = FastAPI(title="FinShield API", version="1.0.0")
FRONTEND_ORIGINS = [x.strip() for x in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=FRONTEND_ORIGINS, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

class Hub:
    def __init__(self):
        self.clients = set()
        self.running = False
        self.task = None
        self.scenario = "coordinated_fraud"
        self.engine = SimulationEngine()
hub = Hub()

def seed():
    db = SessionLocal()
    if db.query(Transaction).count() > 0:
        db.close(); return
    now = datetime.utcnow()
    for i in range(80):
        tx = hub.engine.normal_transaction(now - timedelta(minutes=80-i))
        result = analyze_transaction(tx, db)
        db.add(Transaction(**result["transaction"]))
    db.commit()
    db.close()

seed()

async def broadcast(payload):
    dead = []
    for ws in hub.clients:
        try:
            await ws.send_text(json.dumps(payload, default=str))
        except Exception:
            dead.append(ws)
    for ws in dead:
        hub.clients.discard(ws)

async def simulation_loop():
    hub.running = True
    while hub.running:
        tx = hub.engine.next(hub.scenario)
        db = SessionLocal()
        result = analyze_transaction(tx, db)
        db.add(Transaction(**result["transaction"]))
        if result["alert"]:
            db.add(Alert(**result["alert"]))
        db.commit()
        db.close()
        await broadcast({"type":"transaction", "data": result})
        await asyncio.sleep(0.9)

@app.get("/api/health")
def health():
    return {"status":"operational","services":{"api":"online","database":"online","ml_engine":"online","stream_processor":"online"}}

@app.get("/api/dashboard/summary")
def summary():
    db = SessionLocal()
    total = db.query(Transaction).count()
    alerts = db.query(Alert).count()
    avg = sum((x.risk_score or 0) for x in db.query(Transaction).all()) / max(total,1)
    critical = db.query(Transaction).filter(Transaction.risk_score >= 75).count()
    suspicious = db.query(Transaction).filter(Transaction.risk_score >= 50, Transaction.risk_score < 75).count()
    db.close()
    return {"transactions":total,"alerts":alerts,"average_risk":round(avg,1),"critical":critical,"suspicious":suspicious,"transactions_per_minute":68}

@app.get("/api/transactions")
def transactions(limit:int=80):
    db=SessionLocal()
    rows=db.query(Transaction).order_by(Transaction.timestamp.desc()).limit(limit).all()
    out=[{c.name:getattr(r,c.name) for c in Transaction.__table__.columns} for r in rows]
    db.close()
    return out

@app.get("/api/transactions/{tx_id}")
def transaction(tx_id:str):
    db=SessionLocal(); r=db.get(Transaction,tx_id)
    if not r:
        db.close(); raise HTTPException(404,"Transaction not found")
    out={c.name:getattr(r,c.name) for c in Transaction.__table__.columns}
    db.close(); return out

@app.get("/api/fraud/alerts")
def alerts():
    db=SessionLocal()
    rows=db.query(Alert).order_by(Alert.created_at.desc()).limit(100).all()
    out=[{c.name:getattr(r,c.name) for c in Alert.__table__.columns} for r in rows]
    db.close(); return out

@app.post("/api/fraud/alerts/{alert_id}/status")
def alert_status(alert_id:str, status:str):
    db=SessionLocal(); r=db.get(Alert,alert_id)
    if not r: raise HTTPException(404,"Alert not found")
    r.status=status.upper(); db.commit(); db.close()
    return {"ok":True}

@app.get("/api/graph")
def graph():
    db=SessionLocal()
    rows=db.query(Transaction).filter(Transaction.risk_score>=50).order_by(Transaction.timestamp.desc()).limit(80).all()
    nodes={}
    edges=[]
    for r in rows:
        for key,typ,label in [(r.account_id,"account",r.account_id),(r.device_id,"device",r.device_id),(r.merchant,"merchant",r.merchant)]:
            nodes.setdefault(key,{"id":key,"type":typ,"label":label})
        edges += [{"source":r.account_id,"target":r.device_id,"label":"uses"},
                  {"source":r.account_id,"target":r.merchant,"label":"pays"}]
    db.close()
    return {"nodes":list(nodes.values()),"edges":edges}

@app.get("/api/simulation/status")
def sim_status():
    return {"running":hub.running,"scenario":hub.scenario}

@app.post("/api/simulation/start")
async def start_simulation(scenario:str="coordinated_fraud"):
    if hub.running: return {"running":True}
    hub.scenario=scenario
    hub.task=asyncio.create_task(simulation_loop())
    return {"running":True,"scenario":scenario}

@app.post("/api/simulation/stop")
async def stop_simulation():
    hub.running=False
    return {"running":False}

@app.websocket("/ws/transactions")
async def ws_transactions(websocket:WebSocket):
    await websocket.accept(); hub.clients.add(websocket)
    try:
        while True: await websocket.receive_text()
    except WebSocketDisconnect:
        hub.clients.discard(websocket)
