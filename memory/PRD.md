# PRD - Open World Village Drive

## Overview
A 2D top-down open-world mobile game (Expo + FastAPI + MongoDB). Drive vehicles around a village, talk to AI-voiced NPCs, complete missions, record voice taunts on your high scores, and compete on daily + global leaderboards.

## Screens
Home → Name (first-time) → Vehicle Select → Game → **Game Over (with voice taunt)** → Leaderboard
Home → Shop ↔ Vehicle Select | Home → Daily Challenge → Vehicle Select → Game

## Core Features
- Open world (2400×2400) with 16 buildings, gridded roads
- 6 vehicles — Car / Bike / Cycle (free); Ambulance ($250) / Police ($400) / Tractor ($200) — premium unlocks via coins
- 14 unique AI NPCs — tap to open dialog with OpenAI-TTS voice playback
- Mission system — random vehicle + target building; +150 score, +10 coins per completion
- Daily Challenge with separate daily leaderboard (resets each day)
- Coin Shop — Stripe Checkout test mode for $0.99 / $3.99 / $9.99 packs
- HUD — Score, Missions, Health, Speed, Time-of-day pill, Weather pill, Pause
- Day/night cycle (4-min loop) + tint overlay
- Weather (clear/rain) with rain particles
- Joystick + 3 chunky action buttons (Enter/Exit, Horn, Boost)
- Web-Audio sound effects (UI tap, horn, mission-complete chime, coin, crash, vehicle enter)
- Landscape orientation supported

## NEW: Voice Taunts (Whisper + base64 audio)
- Game Over screen shows a "🎤 Add a voice taunt" card with **RECORD (6s)** button
- MediaRecorder API records `audio/webm`, base64-encoded, sent to `POST /api/whisper` for transcription
- Score submitted via `POST /api/scores` with optional `voice_b64` + `voice_text`
- Leaderboard rows display the transcribed taunt under the player name + a 🔊 speaker icon
- Tap speaker → fetches audio from `GET /api/scores/{id}/voice` and plays it
- Voice clips capped at 350KB base64; older entries auto-expire when new top10 fills

## Backend (/api)
- `GET/POST /api/scores`, `GET /api/scores/leaderboard`
- `GET /api/scores/{id}/voice` — voice taunt audio for a score (NEW)
- `GET /api/daily/seed`, `POST /api/daily/scores`, `GET /api/daily/leaderboard`
- `GET /api/progress/{player_id}`, `POST /api/progress`, `POST /api/progress/spend`
- `GET /api/coin-packs`, `POST /api/checkout`, `GET /api/checkout/status/{id}`, `POST /api/webhook/stripe`
- `POST /api/tts` — OpenAI TTS, base64 mp3
- `POST /api/whisper` — OpenAI Whisper STT, base64 audio in / text out (NEW)
- `POST /api/ghosts`, `GET /api/ghosts/top` (used for future ghost-car replay)

## Tech
- Frontend: Expo Router single index.tsx, React Native primitives, MediaRecorder API for voice, @expo/vector-icons
- Backend: FastAPI + Motor + MongoDB; emergentintegrations for Stripe, OpenAI TTS, OpenAI Whisper
- Env: EMERGENT_LLM_KEY, STRIPE_API_KEY, MONGO_URL, DB_NAME

## Verified end-to-end
- TTS → Whisper round-trip: "Test." → spoken → transcribed back to "Test." ✓
- Score with voice taunt → stored → leaderboard shows transcript + play button → audio plays ✓

## Pending future sessions
- Multiplayer text chat + ghost cars (WebSocket)
- True 3D world (three.js / expo-gl)
- Native mobile mic recording via expo-av (currently web-only via MediaRecorder)
