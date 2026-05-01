# PRD - Open World Village Drive

## Overview
A 2D top-down open-world mobile game (Expo + FastAPI + MongoDB). Players pick a vehicle, drive around a village, talk to AI-voiced NPCs, complete missions for score + coins, buy unlockable premium vehicles, and compete on daily + global leaderboards.

## Screens / Flow
Home → Name (first-time) → **Vehicle Select** → Game → Game Over → Leaderboard
Home → **Shop** ↔ Vehicle Select
Home → **Daily Challenge** → Vehicle Select → Game (daily mode)

## Core Features
- Open world (2400×2400) with 16 buildings, gridded roads, grass terrain
- 6 vehicles — Car / Bike / Cycle (free), Ambulance ($250 coins) / Police ($400) / Tractor ($200) (premium, unlock with coins)
- 14 unique AI NPCs — tap to open dialog with OpenAI-TTS voice playback (8 distinct voices, 3 lines each)
- Mission system — random vehicle + target building; +150 score, +10 coins per completion
- **Daily Challenge** — separate daily leaderboard (resets every day) tracked at backend; HUD shows "DAILY" tag
- **Coin economy** — earn from missions, spend on vehicle unlocks
- **Coin Shop** — Stripe checkout for $0.99 / $3.99 / $9.99 coin packs (test mode); polled on return; auto-grants coins
- HUD — Score, Missions, Health, Speed, Time-of-day pill (Morning/Noon/Dusk/Night), Weather pill (Rain), Pause
- Day/night cycle (4-min loop) + tint overlay
- Weather (clear/rain) with rain particles
- Joystick + 3 chunky action buttons (Enter/Exit, Horn, Boost)
- Web-Audio sound effects (UI tap, horn, mission-complete chime, coin, crash, vehicle enter)
- Landscape orientation supported (`app.json` `"orientation": "default"`)

## Backend (/api)
- `GET /api/scores/leaderboard`, `POST /api/scores`
- `GET /api/daily/seed`, `POST /api/daily/scores`, `GET /api/daily/leaderboard`
- `GET /api/progress/{player_id}`, `POST /api/progress`, `POST /api/progress/spend`
- `GET /api/coin-packs`, `POST /api/checkout`, `GET /api/checkout/status/{id}`, `POST /api/webhook/stripe`
- `POST /api/tts` — OpenAI TTS, base64 mp3 cached
- `POST /api/ghosts`, `GET /api/ghosts/top` (used for future ghost-car replay)

## Tech
- Frontend: Expo Router single index.tsx, React Native primitives, @expo/vector-icons, PanResponder loop ~30 fps
- Backend: FastAPI + Motor + MongoDB; emergentintegrations for Stripe + OpenAI TTS
- Env vars: EMERGENT_LLM_KEY, STRIPE_API_KEY, MONGO_URL, DB_NAME

## Deployment
- Health check: PASS (deployment_agent confirmed earlier)
- Use **Publish** button (top-right) to deploy

## Pending future sessions
- Multiplayer text chat + ghost cars (WebSocket)
- True 3D world (three.js / expo-gl)
- Voice notes + Whisper voice-to-text
