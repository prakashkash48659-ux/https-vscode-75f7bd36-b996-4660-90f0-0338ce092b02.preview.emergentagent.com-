from fastapi import FastAPI, APIRouter, HTTPException, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, date

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
)


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', 'sk_test_emergent')

# Fixed coin packages (server-side only)
COIN_PACKS: Dict[str, Dict[str, Any]] = {
    'small':  {'coins': 100,  'amount': 0.99,  'label': 'Starter Pack'},
    'medium': {'coins': 500,  'amount': 3.99,  'label': 'Pro Pack'},
    'large':  {'coins': 1500, 'amount': 9.99,  'label': 'Mega Pack'},
}

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
class ScoreCreate(BaseModel):
    player_name: str
    score: int
    missions_completed: int = 0
    vehicle: Optional[str] = None
    is_daily: bool = False
    daily_date: Optional[str] = None


class Score(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    player_name: str
    score: int
    missions_completed: int = 0
    vehicle: Optional[str] = None
    is_daily: bool = False
    daily_date: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ProgressUpsert(BaseModel):
    player_id: str
    player_name: str
    best_score: int = 0
    total_missions: int = 0
    coins: int = 0
    last_vehicle: Optional[str] = None
    unlocks: Optional[List[str]] = None
    earned_coins_delta: int = 0  # additive earn


class Progress(BaseModel):
    player_id: str
    player_name: str
    best_score: int = 0
    total_missions: int = 0
    coins: int = 0
    last_vehicle: Optional[str] = None
    unlocks: List[str] = Field(default_factory=list)
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SpendRequest(BaseModel):
    player_id: str
    item_id: str
    cost: int


class GhostFrame(BaseModel):
    x: float
    y: float
    a: float


class GhostCreate(BaseModel):
    player_name: str
    score: int
    vehicle: str
    frames: List[GhostFrame]


class CheckoutRequest(BaseModel):
    package_id: str
    origin_url: str
    player_id: str


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Open World Village Drive API"}


# ---- Scores ----
@api_router.post("/scores", response_model=Score)
async def submit_score(payload: ScoreCreate):
    score = Score(**payload.model_dump())
    await db.scores.insert_one(score.model_dump())
    return score


@api_router.get("/scores/leaderboard", response_model=List[Score])
async def get_leaderboard(limit: int = 10):
    cursor = db.scores.find({"is_daily": False}, {"_id": 0}).sort("score", -1).limit(limit)
    items = await cursor.to_list(length=limit)
    return [Score(**i) for i in items]


# ---- Daily challenge ----
@api_router.get("/daily/seed")
async def daily_seed():
    today = date.today().isoformat()
    # deterministic seed from date string
    seed = sum(ord(c) for c in today) * 7919
    return {"date": today, "seed": seed}


@api_router.post("/daily/scores", response_model=Score)
async def submit_daily_score(payload: ScoreCreate):
    payload.is_daily = True
    payload.daily_date = payload.daily_date or date.today().isoformat()
    s = Score(**payload.model_dump())
    await db.scores.insert_one(s.model_dump())
    return s


@api_router.get("/daily/leaderboard", response_model=List[Score])
async def get_daily_leaderboard(limit: int = 10, daily_date: Optional[str] = None):
    d = daily_date or date.today().isoformat()
    cursor = db.scores.find({"is_daily": True, "daily_date": d}, {"_id": 0}).sort("score", -1).limit(limit)
    items = await cursor.to_list(length=limit)
    return [Score(**i) for i in items]


# ---- Progress / coins / unlocks ----
@api_router.post("/progress", response_model=Progress)
async def upsert_progress(payload: ProgressUpsert):
    existing = await db.progress.find_one({"player_id": payload.player_id}, {"_id": 0})
    base = existing or {}
    coins = int(base.get("coins", 0)) + int(payload.earned_coins_delta or 0)
    if payload.coins and not existing:
        coins = payload.coins
    unlocks = payload.unlocks if payload.unlocks is not None else base.get("unlocks", [])
    progress = Progress(
        player_id=payload.player_id,
        player_name=payload.player_name,
        best_score=max(int(base.get("best_score", 0)), int(payload.best_score or 0)),
        total_missions=max(int(base.get("total_missions", 0)), int(payload.total_missions or 0)),
        coins=coins,
        last_vehicle=payload.last_vehicle or base.get("last_vehicle"),
        unlocks=unlocks,
    )
    await db.progress.update_one(
        {"player_id": payload.player_id},
        {"$set": progress.model_dump()},
        upsert=True,
    )
    return progress


@api_router.get("/progress/{player_id}", response_model=Progress)
async def get_progress(player_id: str):
    doc = await db.progress.find_one({"player_id": player_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Progress not found")
    return Progress(**doc)


@api_router.post("/progress/spend", response_model=Progress)
async def spend_coins(payload: SpendRequest):
    doc = await db.progress.find_one({"player_id": payload.player_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Progress not found")
    coins = int(doc.get("coins", 0))
    if coins < payload.cost:
        raise HTTPException(status_code=400, detail="Not enough coins")
    unlocks = list(doc.get("unlocks", []))
    if payload.item_id in unlocks:
        raise HTTPException(status_code=400, detail="Already owned")
    coins -= payload.cost
    unlocks.append(payload.item_id)
    await db.progress.update_one(
        {"player_id": payload.player_id},
        {"$set": {"coins": coins, "unlocks": unlocks, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    doc["coins"] = coins
    doc["unlocks"] = unlocks
    return Progress(**doc)


# ---- Ghosts ----
@api_router.post("/ghosts")
async def create_ghost(payload: GhostCreate):
    if len(payload.frames) < 5:
        raise HTTPException(status_code=400, detail="Ghost too short")
    # cap frames length
    frames = payload.frames[:600]
    g = {
        "id": str(uuid.uuid4()),
        "player_name": payload.player_name,
        "score": payload.score,
        "vehicle": payload.vehicle,
        "frames": [f.model_dump() for f in frames],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.ghosts.insert_one(g)
    return {"id": g["id"], "ok": True}


@api_router.get("/ghosts/top")
async def get_top_ghost():
    doc = await db.ghosts.find_one({}, {"_id": 0}, sort=[("score", -1)])
    if not doc:
        return {"ghost": None}
    return {"ghost": doc}


# ---- Stripe checkout ----
@api_router.get("/coin-packs")
async def list_coin_packs():
    return [{"id": k, **v} for k, v in COIN_PACKS.items()]


@api_router.post("/checkout")
async def create_checkout(req: CheckoutRequest, http_request: Request):
    if req.package_id not in COIN_PACKS:
        raise HTTPException(status_code=400, detail="Invalid package")
    pack = COIN_PACKS[req.package_id]
    host_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    origin = req.origin_url.rstrip("/")
    success_url = f"{origin}/?stripe_session={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/?stripe_cancel=1"
    session = await stripe_checkout.create_checkout_session(
        CheckoutSessionRequest(
            amount=float(pack["amount"]),
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "player_id": req.player_id,
                "package_id": req.package_id,
                "coins": str(pack["coins"]),
            },
        )
    )
    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "player_id": req.player_id,
        "package_id": req.package_id,
        "amount": float(pack["amount"]),
        "currency": "usd",
        "coins": pack["coins"],
        "payment_status": "initiated",
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"url": session.url, "session_id": session.session_id}


@api_router.get("/checkout/status/{session_id}")
async def checkout_status(session_id: str, http_request: Request):
    host_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    status = await stripe_checkout.get_checkout_status(session_id)
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    new_payment_status = status.payment_status
    new_status = status.status
    granted = bool(tx.get("granted", False))
    if new_payment_status == "paid" and not granted:
        # Grant coins to player
        player_id = tx.get("player_id")
        coins = int(tx.get("coins", 0))
        await db.progress.update_one(
            {"player_id": player_id},
            {"$inc": {"coins": coins}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
        granted = True
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"payment_status": new_payment_status, "status": new_status, "granted": granted}},
    )
    return {
        "payment_status": new_payment_status,
        "status": new_status,
        "amount_total": status.amount_total,
        "currency": status.currency,
        "metadata": status.metadata,
        "granted": granted,
    }


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    try:
        event = await stripe_checkout.handle_webhook(body, sig)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    if event.payment_status == "paid" and event.session_id:
        tx = await db.payment_transactions.find_one({"session_id": event.session_id}, {"_id": 0})
        if tx and not tx.get("granted", False):
            player_id = tx.get("player_id")
            coins = int(tx.get("coins", 0))
            await db.progress.update_one(
                {"player_id": player_id},
                {"$inc": {"coins": coins}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
                upsert=True,
            )
            await db.payment_transactions.update_one(
                {"session_id": event.session_id},
                {"$set": {"payment_status": "paid", "status": "complete", "granted": True}},
            )
    return {"received": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
