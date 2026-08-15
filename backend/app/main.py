from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="FinShield API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://finshield-fraud-intelligence-lqzggcqsz-ranveer7.vercel.app",
        "https://finshield-fraud-intelligence-8c9s-five.vercel.app",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
