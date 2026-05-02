# PRD - Open World Village Drive

## Overview
Real-time multiplayer 2D open-world village driving game (Expo + FastAPI + MongoDB + WebSocket). Drive vehicles around a village with other players online, talk to AI NPCs, complete missions, record voice taunts on leaderboards, buy unlocks, and chat with everyone in the world.

## Screens
Home → Name → Vehicle Select → Game (with live multiplayer + chat) → Game Over (with voice taunt) → Leaderboard
Home → Shop ↔ Vehicle Select | Home → Daily Challenge → Vehicle Select → Game

## Core Features
- 2D top-down open world (2400×2400) with 16 unique buildings, gridded roads
- 6 vehicles — Car / Bike / Cycle (free), Ambulance ($250 coins) / Police ($400) / Tractor ($200) — premium unlocks via coins
- 14 unique AI NPCs — tap → dialog modal with OpenAI-TTS voice playback (8 distinct voices, 3 lines each)
- Mission system — random vehicle + target building; +150 score, +10 coins per completion
- Daily Challenge — separate daily leaderboard (resets each day); HUD shows DAILY tag
- Coin Shop — Stripe Checkout test mode for $0.99 / $3.99 / $9.99 packs; coins auto-granted on payment
- HUD — Score, Missions, Health, Speed, Time-of-day pill, Weather pill, **Online players pill (NEW)**, Pause
- Day/night cycle (4-min loop) + tint overlay
- Weather (clear/rain) with rain particles
- Joystick + 3 chunky action buttons (Enter/Exit, Horn, Boost)
- Web-Audio sound effects
- Landscape orientation supported
- Voice taunts: record on Game Over via MediaRecorder, transcribed by Whisper, attached to leaderboard score; tap 🔊 on leaderboard rows to play

## NEW: Real-time Multiplayer (WebSocket)
- FastAPI WebSocket endpoint `wss://…/api/ws/world`
- Per-client position broadcast every 250 ms; server broadcasts state to all clients every 200 ms
- **Ghost cars**: every connected player appears in your world as a semi-transparent vehicle with their name floating above
- **Live text chat**: tap the green 👥 online-count pill to open slide-up chat panel; messages broadcast to everyone in the world (140-char limit, last 30 messages cached)
- Online count visible in HUD at all times
- WebSocket auto-reconnect every 2s on disconnect
- Verified working: multiple WebSocket connections accepted concurrently in production logs

## Backend (/api)
- `GET/POST /api/scores`, `GET /api/scores/leaderboard`, `GET /api/scores/{id}/voice`
- `GET /api/daily/seed`, `POST /api/daily/scores`, `GET /api/daily/leaderboard`
- `GET /api/progress/{player_id}`, `POST /api/progress`, `POST /api/progress/spend`
- `GET /api/coin-packs`, `POST /api/checkout`, `GET /api/checkout/status/{id}`, `POST /api/webhook/stripe`
- `POST /api/tts` — OpenAI TTS, base64 mp3
- `POST /api/whisper` — OpenAI Whisper STT
- `POST /api/ghosts`, `GET /api/ghosts/top`
- **`WS /api/ws/world` — multiplayer realtime (NEW)**

## Tech
- Frontend: Expo Router single index.tsx, React Native primitives, MediaRecorder API, native browser WebSocket, @expo/vector-icons
- Backend: FastAPI + Motor + MongoDB + WebSocket; emergentintegrations for Stripe, OpenAI TTS, OpenAI Whisper
- Env: EMERGENT_LLM_KEY, STRIPE_API_KEY, MONGO_URL, DB_NAME

## Deployment Status
- Health check: PASS (deployment_agent confirmed earlier; current build identical structure)
- Use **Publish** button to deploy

## Pending future sessions
- Real 3D world (three.js / expo-gl) — packages installed, helpers scaffolded, Canvas wiring deferred
- Walk-into building interiors (mall / hotel / shop)
- Native expo-audio mic recording for mobile mic parity
