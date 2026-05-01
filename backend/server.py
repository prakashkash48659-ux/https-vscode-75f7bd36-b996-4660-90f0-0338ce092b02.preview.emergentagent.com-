from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
class ScoreCreate(BaseModel):
    player_name: str
    score: int
    missions_completed: int = 0
    vehicle: Optional[str] = None


class Score(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    player_name: str
    score: int
    missions_completed: int = 0
    vehicle: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ProgressUpsert(BaseModel):
    player_id: str
    player_name: str
    best_score: int = 0
    total_missions: int = 0
    coins: int = 0
    last_vehicle: Optional[str] = None


class Progress(BaseModel):
    player_id: str
    player_name: str
    best_score: int = 0
    total_missions: int = 0
    coins: int = 0
    last_vehicle: Optional[str] = None
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Open World Village Drive API"}


@api_router.post("/scores", response_model=Score)
async def submit_score(payload: ScoreCreate):
    score = Score(**payload.model_dump())
    doc = score.model_dump()
    await db.scores.insert_one(doc)
    return score


@api_router.get("/scores/leaderboard", response_model=List[Score])
async def get_leaderboard(limit: int = 10):
    cursor = db.scores.find({}, {"_id": 0}).sort("score", -1).limit(limit)
    items = await cursor.to_list(length=limit)
    return [Score(**i) for i in items]


@api_router.post("/progress", response_model=Progress)
async def upsert_progress(payload: ProgressUpsert):
    progress = Progress(**payload.model_dump())
    doc = progress.model_dump()
    await db.progress.update_one(
        {"player_id": payload.player_id},
        {"$set": doc},
        upsert=True,
    )
    return progress


@api_router.get("/progress/{player_id}", response_model=Progress)
async def get_progress(player_id: str):
    doc = await db.progress.find_one({"player_id": player_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Progress not found")
    return Progress(**doc)


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
