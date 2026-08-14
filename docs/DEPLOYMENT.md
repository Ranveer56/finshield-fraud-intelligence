# FinShield Production Deployment

## Architecture
Vercel (React/Vite) → Render (FastAPI + WebSocket) → Render PostgreSQL

## Render
Use the included `render.yaml` as a Blueprint. It creates the API and PostgreSQL database.

After deployment, set the Render service variable:
`FRONTEND_ORIGINS=https://YOUR-VERCEL-DOMAIN.vercel.app`

## Vercel
Import the same GitHub repository:
- Root Directory: `frontend`
- Framework: Vite
- Build: `npm run build`
- Output: `dist`

Set:
`VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api`
`VITE_WS_URL=wss://YOUR-RENDER-SERVICE.onrender.com/ws/transactions`

Redeploy after setting variables.

## Test
Backend:
`https://YOUR-RENDER-SERVICE.onrender.com/api/health`

Frontend:
Open the Vercel URL → Simulation Lab → Coordinated Fraud Ring → Start Scenario.

## Security
Never commit database credentials. Put secrets in Render/Vercel environment variables.
