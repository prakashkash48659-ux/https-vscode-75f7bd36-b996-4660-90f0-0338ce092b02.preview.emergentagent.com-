# PRD - Open World Village Drive

## Overview
Real-time multiplayer 2D open-world village driving game (Expo + FastAPI + MongoDB + WebSocket + AI voice). Drive, chat, record voice taunts, and compete with players online.

## Platforms
- **Web (Expo web preview)** — full feature set
- **iOS / Android (native)** — all features including native mic recording for voice taunts via `expo-audio`

## Core Features
- 2D top-down open world (2400×2400), 16 unique buildings, roads
- 6 vehicles, 3 premium unlockable via in-game coins OR Stripe coin-pack purchase
- 14 AI-voiced NPCs (OpenAI TTS) with unique names/personalities/dialog
- Mission system: random vehicle + target building; +150 score, +10 coins each
- Daily Challenge with separate daily leaderboard
- Real-time multiplayer: ghost cars + live chat over WebSocket
- Voice taunts on leaderboard scores (MediaRecorder on web, `expo-audio` on native) + Whisper transcription
- Day/night cycle (4-min loop), weather (rain), landscape orientation
- Full HUD: Score, Missions, Health, Speed, Time-of-day, Weather, Online count, Pause
- Web-Audio sound effects

## NEW: Native Mic Recording
- Uses `useAudioRecorder(RecordingPresets.HIGH_QUALITY)` from `expo-audio`
- `AudioModule.requestRecordingPermissionsAsync()` for runtime mic permission
- Auto-stop after 6 seconds (same UX as web)
- File URI read via `fetch(uri).blob() → arrayBuffer → base64`
- Submitted to `POST /api/whisper` with `mime: audio/m4a`
- **Store-compliant permission strings declared in `app.json`:**
  - iOS `NSMicrophoneUsageDescription: "Record voice taunts for your leaderboard scores"`
  - Android `android.permission.RECORD_AUDIO`
  - `expo-audio` plugin config with `microphonePermission`
- Platform-aware GameOverScreen: `Platform.OS === 'web' ? MediaRecorder : expo-audio`

## Backend (/api)
- `GET/POST /api/scores`, `GET /api/scores/leaderboard`, `GET /api/scores/{id}/voice`
- `GET /api/daily/seed`, `POST /api/daily/scores`, `GET /api/daily/leaderboard`
- `GET /api/progress/{id}`, `POST /api/progress`, `POST /api/progress/spend`
- `GET /api/coin-packs`, `POST /api/checkout`, `GET /api/checkout/status/{id}`, `POST /api/webhook/stripe`
- `POST /api/tts` (OpenAI TTS), `POST /api/whisper` (OpenAI Whisper)
- `POST /api/ghosts`, `GET /api/ghosts/top`
- `WS /api/ws/world` (multiplayer)

## Tech
- Frontend: Expo Router single index.tsx, React Native primitives, browser `MediaRecorder` (web) + `expo-audio` (native), native `WebSocket`, `three`/`@react-three/fiber/native`/`expo-gl` installed (3D helpers scaffolded, Canvas not yet wired)
- Backend: FastAPI + Motor + MongoDB + WebSocket; `emergentintegrations` for Stripe, OpenAI TTS, OpenAI Whisper

## Deployment
- Health check: PASS earlier (structure unchanged since)
- Store submission ready — mic permission strings declared, all other permissions in place
- Use **Publish** button to ship (Emergent handles APK/IPA builds)

## Pending
- Real 3D world (three.js Canvas wiring) — packages installed, helpers written
- Walk-into building interiors (mall / hotel / store)
- Voice playback preview for native recordings (currently web-only)
