# FinShield — Real-Time Financial Fraud & Risk Intelligence

Hackathon-ready full-stack prototype for real-time fraud detection, behavioral anomaly analysis, account/device relationship intelligence, explainable risk scoring, and coordinated fraud-ring simulation.

## Stack
- Frontend: React + Vite + Tailwind CSS + Recharts + React Flow + Framer Motion + Lucide
- Backend: FastAPI + SQLAlchemy + SQLite + WebSockets
- ML: Isolation Forest with deterministic fallback
- Simulator: normal traffic + coordinated fraud ring + account takeover + velocity + geographic anomaly

## Run

### Backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

The dashboard is pre-seeded with synthetic data. Use **Simulation Lab → Coordinated Fraud Ring → Start Simulation** for the main hackathon demo.
