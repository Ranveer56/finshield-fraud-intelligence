@echo off
echo ==========================================
echo   FinShield - Fraud Intelligence
echo ==========================================
echo.
echo Start backend in another terminal:
echo   cd backend
echo   python -m venv .venv
echo   .venv\Scripts\activate
echo   pip install -r requirements.txt
echo   uvicorn app.main:app --reload --port 8000
echo.
echo Then start frontend:
echo   cd frontend
echo   npm install
echo   npm run dev
echo.
pause
