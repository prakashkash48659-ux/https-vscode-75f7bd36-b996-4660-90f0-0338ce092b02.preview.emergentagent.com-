# PRD - Open World Village Drive

## Overview
A 2D top-down open-world mobile game built with Expo + FastAPI + MongoDB. Players drive different vehicles around a village world, talk to NPCs (powered by AI voice), complete delivery missions, and compete on a leaderboard.

## Core Features
- Home / Name / Game / Game Over / Leaderboard screens
- Open world (2400×2400) with 16 unique buildings, gridded roads, grass terrain
- 6 vehicle types (Car, Bike, Ambulance, Police, Cycle, Tractor) with unique colors / max-speeds
- 14 unique NPCs (villagers + farmers) with names, personalities, dialog lines, voices
- **Tap any NPC to open a dialog modal** with their name + line + voice playback (OpenAI TTS via Emergent LLM key)
- HUD: Score, Missions, Health, Speed, **Time-of-day pill (Morning/Noon/Dusk/Night)**, **Weather pill (Rain)**, Pause
- Mission system with target arrow + distance
- **Day/night cycle** — sky color + tint overlay shifts every ~4 minutes
- **Weather system** — clear/rain alternating every ~60s with rain particles overlay
- Virtual joystick + chunky action buttons (Enter/Exit, Horn, Boost)
- Web-Audio sound effects (UI tap, horn, mission-complete chime, coin, crash)
- Collision damage, pause modal, leaderboard

## Backend (/api)
- `POST/GET /api/scores` & `/api/scores/leaderboard`
- `POST/GET /api/progress` & `/api/progress/{player_id}`, `POST /api/progress/spend`
- `GET /api/daily/seed`, `POST /api/daily/scores`, `GET /api/daily/leaderboard`
- `POST /api/ghosts`, `GET /api/ghosts/top`
- `GET /api/coin-packs`, `POST /api/checkout`, `GET /api/checkout/status/{id}`, `POST /api/webhook/stripe`
- **`POST /api/tts`** — OpenAI text-to-speech, returns base64 mp3, in-memory cached

## Tech
- Frontend: Expo Router single index.tsx, React Native primitives, @expo/vector-icons, PanResponder game loop
- Backend: FastAPI + Motor + MongoDB; emergentintegrations for Stripe + OpenAI TTS
- Env vars: EMERGENT_LLM_KEY, STRIPE_API_KEY, MONGO_URL, DB_NAME

## Notes
- 2.5D pseudo-3D world tilt was attempted but reverted — the `transform: rotateX` on the world container caused rendering issues in the Expo Router web bundle (content rendered offscreen). Game ships in flat 2D top-down which works flawlessly.
- Multiplayer text/voice chat, vehicle select screen with cosmetic colors, coin shop UI, and ghost-car replay are scaffolded server-side but not yet wired into the frontend (deferred to future sessions).

## Deployment
- Health check: PASS (deployment_agent confirmed ready)
- Use **Publish** button (top-right) to deploy.
