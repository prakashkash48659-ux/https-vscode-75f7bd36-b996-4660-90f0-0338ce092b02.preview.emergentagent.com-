# PRD - Open World Village Drive

## Overview
A 2D top-down open-world mobile game built with Expo + FastAPI + MongoDB. Players drive different vehicles around a village world, complete delivery missions, and compete on a global leaderboard.

## Core Features Implemented
- Home screen with Play, Leaderboard, best-score pill, and animated icon row
- Driver-name onboarding screen (cached locally per device player_id)
- Open world (2400x2400) with grass terrain, gridded roads (dashed lines), 16 unique buildings (Police Station, Hospital, Farm, Barn, School, Cafe, etc.)
- Camera follows player (on foot or in vehicle) using transform translation
- 6 vehicle types: Car, Bike, Ambulance, Police, Cycle, Tractor — each with unique color, max-speed and icon
- 14 NPCs (villagers and farmers) walking with random vectors
- Virtual joystick (left) using PanResponder + 3 chunky action buttons (right): Enter/Exit, Horn, Boost (press-hold)
- HUD pills: Score, Missions, Health, Speed, Pause; mission banner; navigation arrow to target; vehicle/name pill; toast feedback
- Mission system: random vehicle-type + target-building combos with 150 reward; auto-regenerates on completion
- Collision system: building collisions reduce health & speed; running over NPCs damages health and reduces score
- Pause modal with Resume / End-run
- Game over screen with score, missions, best score, retry, leaderboard, home
- Leaderboard screen powered by backend top-10 scores

## Backend Endpoints (all under /api)
- `POST /api/scores` — submit run score
- `GET /api/scores/leaderboard?limit=10` — top scores
- `POST /api/progress` — upsert player progress (best_score, total_missions)
- `GET /api/progress/{player_id}` — load saved progress

## Tech
- Frontend: Expo Router (single index.tsx), React Native primitives, @expo/vector-icons, PanResponder, raw setTimeout game loop (~30fps)
- Backend: FastAPI + Motor + MongoDB; UUID ids; ISO datetime; `_id` excluded from responses
- No third-party integrations (only internal MongoDB + REST)

## Future Enhancements
- Vehicle selection screen with unlocks
- Day/night cycle and weather
- Sound effects (engine, horn, sirens)
- Multiplayer ghost cars
- In-app purchases / coin shop (revenue)
