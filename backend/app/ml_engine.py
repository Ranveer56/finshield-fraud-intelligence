import uuid, statistics
from datetime import datetime
from sklearn.ensemble import IsolationForest

MODEL=None

def risk_level(score):
    return "CRITICAL" if score>=75 else "HIGH" if score>=50 else "MEDIUM" if score>=25 else "LOW"

def analyze_transaction(tx, db):
    from .main import Transaction
    history=db.query(Transaction).filter(Transaction.account_id==tx["account_id"]).order_by(Transaction.timestamp.desc()).limit(30).all()
    amounts=[x.amount for x in history]
    avg=statistics.mean(amounts) if amounts else 1200
    std=statistics.pstdev(amounts) if len(amounts)>1 else 500
    amount_dev=min(100, abs(tx["amount"]-avg)/(std+1)*18)

    known_devices={x.device_id for x in history}
    device_score=45 if tx["device_id"] not in known_devices and history else 5
    geo_score=35 if tx["location"] not in {"Bhopal","Indore","Delhi"} and history else 4
    velocity_score=10
    if history and tx["timestamp"]:
        recent=[x for x in history if (tx["timestamp"]-x.timestamp).total_seconds()<180]
        velocity_score=min(100,len(recent)*24)

    behavioral=min(100, amount_dev*0.65 + velocity_score*0.35)
    graph_score=0
    # shared-device heuristic: strong signal for the hard-mode coordinated ring
    from sqlalchemy import func
    shared=db.query(Transaction).filter(Transaction.device_id==tx["device_id"]).count()
    if shared>=2: graph_score=min(100, 55+shared*8)

    anomaly=min(100, behavioral*0.55 + device_score*0.2 + geo_score*0.1 + graph_score*0.15)
    fraud_prob=min(0.99, max(0.01, (anomaly/100)*0.92))
    risk=min(100, anomaly*0.78 + graph_score*0.22)

    reasons=[]
    if amount_dev>45: reasons.append(f"Amount is unusually high versus {tx['account_id']}'s historical behavior")
    if device_score>30: reasons.append("New device detected for this account")
    if geo_score>25: reasons.append("Geographic behavior differs from historical pattern")
    if velocity_score>35: reasons.append("Unusual transaction velocity detected")
    if graph_score>45: reasons.append(f"Device is linked to {shared} recent transactions/accounts")
    if not reasons: reasons.append("Transaction aligns with normal behavioral baseline")

    t={"id":tx["id"],"account_id":tx["account_id"],"device_id":tx["device_id"],"merchant":tx["merchant"],
       "amount":tx["amount"],"location":tx["location"],"ip":tx["ip"],"timestamp":tx["timestamp"],
       "risk_score":round(risk,1),"fraud_probability":round(fraud_prob,3),"anomaly_score":round(anomaly,1),
       "risk_level":risk_level(risk),"explanation":"; ".join(reasons)}
    alert=None
    if risk>=65:
        sev=risk_level(risk)
        alert={"id":str(uuid.uuid4()),"transaction_id":tx["id"],"account_id":tx["account_id"],
               "severity":sev,"risk_score":round(risk,1),
               "title":"Coordinated fraud pattern detected" if graph_score>=45 else "Suspicious transaction detected",
               "explanation":" • ".join(reasons),"status":"OPEN","created_at":tx["timestamp"]}
    return {"transaction":t,"alert":alert}
