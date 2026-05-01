import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  PanResponder,
  Dimensions,
  SafeAreaView,
  ActivityIndicator,
  StatusBar,
  Platform,
  Linking,
} from 'react-native';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;
const ORIGIN = typeof window !== 'undefined' && window.location ? window.location.origin : (BACKEND as string);

// ---------- Simple Sound (Web Audio API) ----------
let audioCtx: any = null;
const getAC = () => {
  if (typeof window === 'undefined') return null;
  if (audioCtx) return audioCtx;
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  } catch (_e) {}
  return audioCtx;
};
const playTone = (freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15) => {
  try {
    const ac = getAC();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = vol;
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    osc.stop(ac.currentTime + dur);
  } catch (_e) {}
};
const SFX = {
  uiTap: () => playTone(800, 0.06, 'square', 0.08),
  horn: () => { playTone(420, 0.18, 'sawtooth', 0.18); setTimeout(() => playTone(360, 0.16, 'sawtooth', 0.18), 60); },
  missionDone: () => { playTone(660, 0.12, 'triangle', 0.14); setTimeout(() => playTone(880, 0.16, 'triangle', 0.14), 120); setTimeout(() => playTone(1100, 0.2, 'triangle', 0.14), 260); },
  coin: () => { playTone(1200, 0.08, 'square', 0.1); setTimeout(() => playTone(1600, 0.1, 'square', 0.1), 70); },
  crash: () => playTone(120, 0.25, 'sawtooth', 0.2),
  enter: () => playTone(520, 0.1, 'triangle', 0.12),
};

// ---------- Theme ----------
const C = {
  primary: '#FFD166',
  primaryDark: '#F4B333',
  secondary: '#118AB2',
  secondaryDark: '#0B6A8C',
  accent: '#06D6A0',
  danger: '#EF476F',
  dangerDark: '#C92A51',
  grass: '#80ED99',
  grassDark: '#5DBE7B',
  road: '#6B7280',
  roadLine: '#FDF6E3',
  textPrimary: '#073B4C',
  textInverse: '#FFFFFF',
  buildingWarm: '#E76F51',
  buildingOrange: '#F4A261',
  buildingBlue: '#118AB2',
  surface: '#FFFFFF',
  surfaceOverlay: 'rgba(255,255,255,0.85)',
  joystickBase: 'rgba(0,0,0,0.25)',
  joystickThumb: '#FFFFFF',
};

// ---------- World Definition ----------
const WORLD_W = 2400;
const WORLD_H = 2400;

type Building = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  label: string;
  type: string;
};

type Road = { x: number; y: number; w: number; h: number; horizontal: boolean };

type VehicleType = 'car' | 'bike' | 'ambulance' | 'police' | 'cycle' | 'tractor';

type Vehicle = {
  id: string;
  type: VehicleType;
  x: number;
  y: number;
  angle: number; // radians
  speed: number;
  maxSpeed: number;
  color: string;
  width: number;
  length: number;
  label: string;
};

type Npc = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'villager' | 'farmer';
  color: string;
  name: string;
  voice: string;
  dialogs: string[];
  shirtColor: string;
};

type Mission = {
  vehicleType: VehicleType;
  targetBuildingId: string;
  description: string;
  reward: number;
};

// build static world
const ROADS: Road[] = [
  // horizontal
  { x: 0, y: 380, w: WORLD_W, h: 80, horizontal: true },
  { x: 0, y: 1180, w: WORLD_W, h: 80, horizontal: true },
  { x: 0, y: 1980, w: WORLD_W, h: 80, horizontal: true },
  // vertical
  { x: 380, y: 0, w: 80, h: WORLD_H, horizontal: false },
  { x: 1180, y: 0, w: 80, h: WORLD_H, horizontal: false },
  { x: 1980, y: 0, w: 80, h: WORLD_H, horizontal: false },
];

const BUILDINGS: Building[] = [
  { id: 'home',     x: 120,  y: 120,  w: 200, h: 180, color: C.buildingOrange, label: 'Home',           type: 'home' },
  { id: 'police',   x: 520,  y: 120,  w: 240, h: 200, color: C.buildingBlue,   label: 'Police Station', type: 'police' },
  { id: 'hospital', x: 1320, y: 120,  w: 240, h: 200, color: '#EF476F',        label: 'Hospital',       type: 'hospital' },
  { id: 'shop',     x: 2120, y: 120,  w: 200, h: 200, color: '#9B5DE5',        label: 'Shop',           type: 'shop' },
  { id: 'house1',   x: 120,  y: 520,  w: 200, h: 180, color: C.buildingWarm,   label: 'House',          type: 'house' },
  { id: 'station',  x: 520,  y: 520,  w: 280, h: 220, color: '#5C7B89',        label: 'Bus Station',    type: 'station' },
  { id: 'school',   x: 1320, y: 520,  w: 240, h: 220, color: '#FFD166',        label: 'School',         type: 'school' },
  { id: 'gas',      x: 2120, y: 520,  w: 200, h: 200, color: '#06D6A0',        label: 'Gas Station',    type: 'gas' },
  { id: 'farm1',    x: 120,  y: 1320, w: 220, h: 240, color: '#A47148',        label: 'Farm',           type: 'farm' },
  { id: 'barn',     x: 520,  y: 1320, w: 220, h: 240, color: '#8B4513',        label: 'Barn',           type: 'farm' },
  { id: 'church',   x: 1320, y: 1320, w: 240, h: 260, color: '#F4A261',        label: 'Church',         type: 'church' },
  { id: 'market',   x: 2120, y: 1320, w: 200, h: 220, color: '#118AB2',        label: 'Market',         type: 'shop' },
  { id: 'house2',   x: 120,  y: 2120, w: 200, h: 180, color: C.buildingWarm,   label: 'Cottage',        type: 'house' },
  { id: 'farm2',    x: 520,  y: 2120, w: 220, h: 200, color: '#A47148',        label: 'Big Farm',       type: 'farm' },
  { id: 'cafe',     x: 1320, y: 2120, w: 200, h: 180, color: '#FFD166',        label: 'Cafe',           type: 'shop' },
  { id: 'depot',    x: 2120, y: 2120, w: 220, h: 200, color: '#5C7B89',        label: 'Depot',          type: 'depot' },
];

const VEHICLE_DEFS: Record<VehicleType, { color: string; maxSpeed: number; w: number; l: number; label: string }> = {
  car:       { color: '#118AB2', maxSpeed: 5.5, w: 28, l: 50, label: 'Car' },
  bike:      { color: '#EF476F', maxSpeed: 6.5, w: 16, l: 36, label: 'Bike' },
  ambulance: { color: '#FFFFFF', maxSpeed: 5.0, w: 32, l: 60, label: 'Ambulance' },
  police:    { color: '#0B6A8C', maxSpeed: 6.2, w: 30, l: 54, label: 'Police' },
  cycle:     { color: '#FFD166', maxSpeed: 3.5, w: 14, l: 30, label: 'Cycle' },
  tractor:   { color: '#06D6A0', maxSpeed: 3.0, w: 36, l: 56, label: 'Tractor' },
};

const initialVehicles = (): Vehicle[] => {
  const list: Array<{ type: VehicleType; x: number; y: number }> = [
    { type: 'car',       x: 360,  y: 360 },
    { type: 'bike',      x: 460,  y: 360 },
    { type: 'ambulance', x: 1280, y: 340 },
    { type: 'police',    x: 480,  y: 340 },
    { type: 'cycle',     x: 360,  y: 720 },
    { type: 'tractor',   x: 360,  y: 1560 },
    { type: 'car',       x: 1280, y: 1160 },
    { type: 'bike',      x: 1300, y: 2160 },
    { type: 'tractor',   x: 760,  y: 1560 },
  ];
  return list.map((v, i) => {
    const def = VEHICLE_DEFS[v.type];
    return {
      id: `veh-${i}`,
      type: v.type,
      x: v.x,
      y: v.y,
      angle: 0,
      speed: 0,
      maxSpeed: def.maxSpeed,
      color: def.color,
      width: def.w,
      length: def.l,
      label: def.label,
    };
  });
};

const NPC_DATA: { name: string; type: 'villager' | 'farmer'; voice: string; shirtColor: string; dialogs: string[] }[] = [
  { name: 'Ravi the Farmer', type: 'farmer', voice: 'onyx', shirtColor: '#5DBE7B', dialogs: ['My tractor broke down. Can you bring me one?', 'The harvest is great this year!', 'Watch out for goats on the road.'] },
  { name: 'Lila the Villager', type: 'villager', voice: 'shimmer', shirtColor: '#118AB2', dialogs: ['Hello driver! Beautiful day for a ride.', 'Did you see the new bakery on the corner?', 'Drive safe, traveler.'] },
  { name: 'Officer Singh', type: 'villager', voice: 'echo', shirtColor: '#0B6A8C', dialogs: ['Stay within the speed limit.', 'Report to the police station for duty.', 'I keep the village safe.'] },
  { name: 'Granny Kamala', type: 'villager', voice: 'sage', shirtColor: '#9B5DE5', dialogs: ['In my day, we walked everywhere!', 'Try the chai at the cafe.', 'Be careful with that horn.'] },
  { name: 'Bobby the Boy', type: 'villager', voice: 'fable', shirtColor: '#FFD166', dialogs: ['Wow, can I drive that?', 'Did you ever see a real ambulance?', 'My uncle owns the farm.'] },
  { name: 'Farmer Anita', type: 'farmer', voice: 'coral', shirtColor: '#5DBE7B', dialogs: ['The cows are mooing again.', 'I need help moving sacks of grain.', 'Spring is the best season here.'] },
  { name: 'Doctor Kiran', type: 'villager', voice: 'nova', shirtColor: '#EF476F', dialogs: ['Bring patients to the hospital quickly!', 'Always wear a seat belt.', 'I save lives every day.'] },
  { name: 'Old Man Hari', type: 'farmer', voice: 'ash', shirtColor: '#A47148', dialogs: ['Back in my day, only horses pulled carts.', 'Tractors are loud but useful.', 'Can you fetch my newspaper?'] },
  { name: 'Mira the Teacher', type: 'villager', voice: 'shimmer', shirtColor: '#06D6A0', dialogs: ['School is open tomorrow.', 'Always learn something new.', 'Did you finish your homework?'] },
  { name: 'Farmer Joseph', type: 'farmer', voice: 'onyx', shirtColor: '#5DBE7B', dialogs: ['I plant rice and wheat.', 'Tractor please, my barn awaits!', 'Storm is coming, drive carefully.'] },
  { name: 'Priya the Cook', type: 'villager', voice: 'coral', shirtColor: '#F4A261', dialogs: ['Cafe opens at sunrise.', 'Try my samosas!', 'I run the village kitchen.'] },
  { name: 'Mechanic Aman', type: 'villager', voice: 'echo', shirtColor: '#5C7B89', dialogs: ['Need a tune up?', 'Bikes are my specialty.', 'Drop by the depot for repairs.'] },
  { name: 'Farmer Devi', type: 'farmer', voice: 'sage', shirtColor: '#A47148', dialogs: ['My goats escaped again.', 'Big farm, big work.', 'Sun rises, work begins.'] },
  { name: 'Postman Raju', type: 'villager', voice: 'fable', shirtColor: '#FFD166', dialogs: ['Got mail to deliver!', 'Have you seen the new shop?', 'Bicycles are eco friendly.'] },
];

const initialNpcs = (): Npc[] => {
  return NPC_DATA.map((d, i) => ({
    id: `npc-${i}`,
    x: 200 + Math.random() * (WORLD_W - 400),
    y: 200 + Math.random() * (WORLD_H - 400),
    vx: (Math.random() - 0.5) * 1.2,
    vy: (Math.random() - 0.5) * 1.2,
    type: d.type,
    color: d.type === 'farmer' ? '#A47148' : '#9B5DE5',
    name: d.name,
    voice: d.voice,
    dialogs: d.dialogs,
    shirtColor: d.shirtColor,
  }));
};

// ---------- Player ID ----------
let cachedPlayerId: string | null = null;
const getPlayerId = () => {
  if (cachedPlayerId) return cachedPlayerId;
  cachedPlayerId = `p-${Math.random().toString(36).slice(2, 10)}`;
  return cachedPlayerId;
};

// ---------- Main App ----------
type Screen = 'home' | 'name' | 'vehicleSelect' | 'shop' | 'play' | 'gameover' | 'leaderboard';

const VEHICLE_PRICES: Record<string, number> = { ambulance: 250, police: 400, tractor: 200 };

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [playerName, setPlayerName] = useState<string>('');
  const [pendingName, setPendingName] = useState<string>('');
  const [lastScore, setLastScore] = useState<number>(0);
  const [lastMissions, setLastMissions] = useState<number>(0);
  const [bestScore, setBestScore] = useState<number>(0);
  const [coins, setCoins] = useState<number>(0);
  const [unlocks, setUnlocks] = useState<string[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>('car');
  const [dailyMode, setDailyMode] = useState<boolean>(false);

  const [lastVehicle, setLastVehicle] = useState<string>('car');

  const refreshProgress = useCallback(() => {
    const pid = getPlayerId();
    return fetch(`${BACKEND}/api/progress/${pid}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d && d.player_name) {
          setPlayerName(d.player_name);
          setBestScore(d.best_score || 0);
          setCoins(d.coins || 0);
          setUnlocks(d.unlocks || []);
        }
        return d;
      })
      .catch(() => null);
  }, []);

  useEffect(() => { refreshProgress(); }, [refreshProgress]);

  // Stripe success polling on app load
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('stripe_session');
    if (!sid) return;
    let attempts = 0;
    const poll = async () => {
      try {
        const r = await fetch(`${BACKEND}/api/checkout/status/${sid}`);
        const d = await r.json();
        if (d.payment_status === 'paid') {
          await refreshProgress();
          if (typeof window !== 'undefined' && window.history) window.history.replaceState({}, '', window.location.pathname);
          SFX.coin();
          return;
        }
        if (d.status === 'expired') return;
      } catch (_e) {}
      attempts += 1;
      if (attempts < 8) setTimeout(poll, 2000);
    };
    poll();
  }, [refreshProgress]);

  const startGame = () => {
    SFX.uiTap();
    setDailyMode(false);
    if (!playerName) setScreen('name');
    else setScreen('vehicleSelect');
  };

  const startDaily = () => {
    SFX.uiTap();
    setDailyMode(true);
    if (!playerName) setScreen('name');
    else setScreen('vehicleSelect');
  };

  const handleGameOver = useCallback(async (score: number, missions: number, coinsEarned: number, vehicle: string) => {
    setLastScore(score);
    setLastMissions(missions);
    setLastVehicle(vehicle);
    const newBest = Math.max(bestScore, score);
    setBestScore(newBest);
    setCoins(c => c + coinsEarned);
    // Save progress (best/coins) immediately; score row submitted from GameOver after optional taunt
    try {
      await fetch(`${BACKEND}/api/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: getPlayerId(),
          player_name: playerName || 'Anon',
          best_score: newBest,
          total_missions: missions,
          earned_coins_delta: coinsEarned,
          last_vehicle: vehicle,
        }),
      });
    } catch (_e) {}
    setScreen('gameover');
  }, [playerName, bestScore]);

  const submitScoreWithVoice = useCallback(async (voiceB64: string | null, voiceText: string | null) => {
    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      await fetch(`${BACKEND}/api/${dailyMode ? 'daily/scores' : 'scores'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_name: playerName || 'Anon',
          score: lastScore,
          missions_completed: lastMissions,
          vehicle: lastVehicle,
          is_daily: dailyMode,
          daily_date: dailyMode ? todayIso : undefined,
          voice_b64: voiceB64 || undefined,
          voice_text: voiceText || undefined,
        }),
      });
    } catch (_e) {}
  }, [dailyMode, playerName, lastScore, lastMissions, lastVehicle]);

  const onPurchaseVehicle = useCallback(async (type: VehicleType) => {
    const cost = VEHICLE_PRICES[type] || 999;
    if (coins < cost) {
      return false;
    }
    try {
      const r = await fetch(`${BACKEND}/api/progress/spend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: getPlayerId(), item_id: `vehicle:${type}`, cost }),
      });
      if (!r.ok) return false;
      const d = await r.json();
      setCoins(d.coins);
      setUnlocks(d.unlocks || []);
      SFX.coin();
      return true;
    } catch (_e) {
      return false;
    }
  }, [coins]);

  if (screen === 'home') {
    return <HomeScreen onPlay={startGame} onLeaderboard={() => setScreen('leaderboard')} onShop={() => { SFX.uiTap(); setScreen('shop'); }} onDaily={startDaily} bestScore={bestScore} playerName={playerName} coins={coins} />;
  }
  if (screen === 'name') {
    return (
      <NameScreen
        value={pendingName}
        onChange={setPendingName}
        onSubmit={() => {
          const n = (pendingName || '').trim() || 'Driver';
          setPlayerName(n);
          setPendingName('');
          setScreen('vehicleSelect');
        }}
        onBack={() => setScreen('home')}
      />
    );
  }
  if (screen === 'vehicleSelect') {
    return (
      <VehicleSelectScreen
        coins={coins}
        unlocks={unlocks}
        selected={selectedVehicle}
        onSelect={setSelectedVehicle}
        onPurchase={onPurchaseVehicle}
        dailyMode={dailyMode}
        onStart={() => { SFX.uiTap(); setScreen('play'); }}
        onShop={() => setScreen('shop')}
        onBack={() => setScreen('home')}
      />
    );
  }
  if (screen === 'shop') {
    return (
      <ShopScreen
        coins={coins}
        playerId={getPlayerId()}
        onBack={() => setScreen(playerName ? 'vehicleSelect' : 'home')}
      />
    );
  }
  if (screen === 'play') {
    return <GameScreen playerName={playerName} initialVehicle={selectedVehicle} dailyMode={dailyMode} onExit={handleGameOver} />;
  }
  if (screen === 'gameover') {
    return (
      <GameOverScreen
        score={lastScore}
        missions={lastMissions}
        bestScore={bestScore}
        coins={coins}
        dailyMode={dailyMode}
        onSubmit={submitScoreWithVoice}
        onRetry={() => setScreen('play')}
        onHome={() => setScreen('home')}
        onLeaderboard={() => setScreen('leaderboard')}
      />
    );
  }
  if (screen === 'leaderboard') {
    return <LeaderboardScreen onBack={() => setScreen('home')} />;
  }
  return null;
}

// ---------- Home Screen ----------
function HomeScreen({ onPlay, onLeaderboard, onShop, onDaily, bestScore, playerName, coins }: any) {
  return (
    <SafeAreaView style={styles.fullScreen} testID="home-screen">
      <StatusBar barStyle="dark-content" />
      <View style={styles.homeBg}>
        {/* decorative road */}
        <View style={styles.homeRoad} />
        <View style={styles.homeRoadLine} />

        <View style={styles.homeContent}>
          <Text style={styles.homeTitleSmall}>OPEN WORLD</Text>
          <Text style={styles.homeTitle} testID="home-title">Village Drive</Text>
          <Text style={styles.homeSub}>Drive. Explore. Complete missions.</Text>

          <View style={styles.homeIconRow}>
            <MaterialCommunityIcons name="car-hatchback" size={32} color={C.secondary} />
            <MaterialCommunityIcons name="ambulance" size={32} color={C.danger} />
            <MaterialCommunityIcons name="police-badge" size={32} color={C.secondaryDark} />
            <MaterialCommunityIcons name="tractor" size={32} color={C.accent} />
            <MaterialCommunityIcons name="motorbike" size={32} color={C.primaryDark} />
            <MaterialCommunityIcons name="bike" size={32} color="#A47148" />
          </View>

          {playerName ? (
            <Text style={styles.homeWelcome}>Welcome back, {playerName}!</Text>
          ) : null}

          <TouchableOpacity testID="play-button" style={[styles.gameBtnPrimary, { marginTop: 12 }]} onPress={onPlay} activeOpacity={0.85}>
            <FontAwesome5 name="play" size={18} color={C.textPrimary} />
            <Text style={styles.gameBtnPrimaryText}>  PLAY</Text>
          </TouchableOpacity>

          <TouchableOpacity testID="daily-button" style={[styles.gameBtnSecondary, { backgroundColor: C.danger, borderColor: C.dangerDark }]} onPress={onDaily} activeOpacity={0.85}>
            <FontAwesome5 name="calendar-day" size={16} color={C.textInverse} />
            <Text style={styles.gameBtnSecondaryText}>  DAILY CHALLENGE</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <TouchableOpacity testID="leaderboard-button" style={[styles.gameBtnSecondary, { minWidth: 0, flex: 1 }]} onPress={onLeaderboard} activeOpacity={0.85}>
              <FontAwesome5 name="trophy" size={14} color={C.textInverse} />
              <Text style={styles.gameBtnSecondaryText}>  LEADER</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="shop-button" style={[styles.gameBtnSecondary, { backgroundColor: C.accent, borderColor: '#048D6B', minWidth: 0, flex: 1 }]} onPress={onShop} activeOpacity={0.85}>
              <FontAwesome5 name="store" size={14} color="#fff" />
              <Text style={styles.gameBtnSecondaryText}>  SHOP</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <View style={styles.homeBestPill} testID="home-best-score">
              <FontAwesome5 name="star" size={14} color={C.primaryDark} />
              <Text style={styles.homeBestText}>  Best: {bestScore}</Text>
            </View>
            <View style={[styles.homeBestPill, { backgroundColor: '#FEF3C7' }]} testID="home-coins">
              <FontAwesome5 name="coins" size={14} color={C.primaryDark} />
              <Text style={styles.homeBestText}>  {coins}</Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ---------- Name Screen ----------
function NameScreen({ value, onChange, onSubmit, onBack }: any) {
  return (
    <SafeAreaView style={[styles.fullScreen, { backgroundColor: C.grass }]} testID="name-screen">
      <View style={styles.nameWrap}>
        <Text style={styles.nameTitle}>Driver Name</Text>
        <TextInput
          testID="name-input"
          style={styles.nameInput}
          placeholder="Your name"
          placeholderTextColor="#94a3b8"
          value={value}
          onChangeText={onChange}
          maxLength={16}
          autoFocus
        />
        <TouchableOpacity testID="name-submit" style={styles.gameBtnPrimary} onPress={onSubmit}>
          <Text style={styles.gameBtnPrimaryText}>START GAME</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="name-back" style={[styles.gameBtnSecondary]} onPress={onBack}>
          <Text style={styles.gameBtnSecondaryText}>BACK</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ---------- Game Over Screen ----------
function GameOverScreen({ score, missions, bestScore, coins, dailyMode, onSubmit, onRetry, onHome, onLeaderboard }: any) {
  const [recState, setRecState] = useState<'idle' | 'recording' | 'recorded' | 'transcribing'>('idle');
  const [voiceB64, setVoiceB64] = useState<string | null>(null);
  const [voiceText, setVoiceText] = useState<string | null>(null);
  const [voiceMime, setVoiceMime] = useState<string>('audio/webm');
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const recorderRef = useRef<any>(null);
  const chunksRef = useRef<any[]>([]);

  const startRec = async () => {
    setError('');
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
        setError('Voice not supported on this device');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const W: any = (typeof window !== 'undefined') ? window : {};
      const MR = W.MediaRecorder;
      if (!MR) { setError('Recording not supported'); return; }
      let mime = 'audio/webm;codecs=opus';
      if (!MR.isTypeSupported(mime)) mime = 'audio/webm';
      if (!MR.isTypeSupported(mime)) mime = '';
      const rec = new MR(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e: any) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mime || 'audio/webm' });
        setVoiceMime(blob.type || 'audio/webm');
        const buf = await blob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        const b64 = (typeof btoa !== 'undefined') ? btoa(bin) : '';
        setVoiceB64(b64);
        setRecState('transcribing');
        try {
          const r = await fetch(`${BACKEND}/api/whisper`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio_b64: b64, mime: blob.type || 'audio/webm' }),
          });
          if (r.ok) {
            const d = await r.json();
            setVoiceText(d.text || '');
          }
        } catch (_e) {}
        setRecState('recorded');
        try { stream.getTracks().forEach((t: any) => t.stop()); } catch (_e) {}
      };
      recorderRef.current = rec;
      rec.start();
      setRecState('recording');
      // auto stop after 6s
      setTimeout(() => { try { rec.state === 'recording' && rec.stop(); } catch (_e) {} }, 6000);
    } catch (e: any) {
      setError(e?.message || 'Mic permission denied');
    }
  };

  const stopRec = () => {
    try { recorderRef.current && recorderRef.current.state === 'recording' && recorderRef.current.stop(); } catch (_e) {}
  };

  const playPreview = () => {
    if (!voiceB64) return;
    if (typeof window !== 'undefined' && (window as any).Audio) {
      const a = new (window as any).Audio(`data:${voiceMime};base64,${voiceB64}`);
      a.play().catch(() => {});
    }
  };

  const submit = async (withVoice: boolean) => {
    setSubmitted(true);
    SFX.uiTap();
    await onSubmit(withVoice ? voiceB64 : null, withVoice ? voiceText : null);
  };

  return (
    <SafeAreaView style={[styles.fullScreen, { backgroundColor: C.grass }]} testID="gameover-screen">
      <ScrollView contentContainerStyle={{ padding: 24, alignItems: 'center', paddingBottom: 80 }}>
        <Text style={styles.gameOverTitle}>{dailyMode ? 'Daily Run!' : 'Run Complete!'}</Text>
        <View style={[styles.gameOverCard, { width: '100%' }]}>
          <View style={styles.gameOverRow}>
            <FontAwesome5 name="star" size={20} color={C.primaryDark} />
            <Text style={styles.gameOverLabel}>Score</Text>
            <Text style={styles.gameOverValue} testID="gameover-score">{score}</Text>
          </View>
          <View style={styles.gameOverRow}>
            <FontAwesome5 name="flag-checkered" size={18} color={C.accent} />
            <Text style={styles.gameOverLabel}>Missions</Text>
            <Text style={styles.gameOverValue} testID="gameover-missions">{missions}</Text>
          </View>
          <View style={styles.gameOverRow}>
            <FontAwesome5 name="coins" size={18} color={C.primaryDark} />
            <Text style={styles.gameOverLabel}>Coins</Text>
            <Text style={styles.gameOverValue}>{coins}</Text>
          </View>
          <View style={styles.gameOverRow}>
            <FontAwesome5 name="crown" size={18} color={C.danger} />
            <Text style={styles.gameOverLabel}>Best</Text>
            <Text style={styles.gameOverValue}>{bestScore}</Text>
          </View>
        </View>

        {/* Voice taunt section */}
        {!submitted && (
          <View style={styles.tauntCard} testID="taunt-card">
            <Text style={styles.tauntTitle}>🎤 Add a voice taunt</Text>
            <Text style={styles.tauntSub}>Other players hear it on the leaderboard.</Text>
            {error ? <Text style={{ color: C.danger, marginVertical: 4 }} testID="taunt-error">{error}</Text> : null}
            {recState === 'idle' && (
              <TouchableOpacity testID="taunt-record" style={[styles.gameBtnPrimary, { backgroundColor: C.danger, borderColor: C.dangerDark }]} onPress={startRec}>
                <FontAwesome5 name="microphone" size={16} color="#fff" />
                <Text style={[styles.gameBtnPrimaryText, { color: '#fff' }]}>  RECORD (6s)</Text>
              </TouchableOpacity>
            )}
            {recState === 'recording' && (
              <TouchableOpacity testID="taunt-stop" style={[styles.gameBtnPrimary, { backgroundColor: '#9CA3AF' }]} onPress={stopRec}>
                <FontAwesome5 name="stop" size={16} color={C.textPrimary} />
                <Text style={styles.gameBtnPrimaryText}>  STOP</Text>
              </TouchableOpacity>
            )}
            {recState === 'transcribing' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color={C.secondary} />
                <Text style={{ fontWeight: '700', color: C.textPrimary }}>Transcribing…</Text>
              </View>
            )}
            {recState === 'recorded' && (
              <View style={{ alignItems: 'center', alignSelf: 'stretch' }}>
                {voiceText ? <Text style={styles.tauntText} testID="taunt-text">"{voiceText}"</Text> : null}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TouchableOpacity testID="taunt-play" style={[styles.gameBtnSecondary, { backgroundColor: C.secondary, minWidth: 0, flex: 1 }]} onPress={playPreview}>
                    <FontAwesome5 name="play" size={12} color="#fff" />
                    <Text style={styles.gameBtnSecondaryText}>  PREVIEW</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID="taunt-redo" style={[styles.gameBtnSecondary, { backgroundColor: '#9CA3AF', borderColor: '#6B7280', minWidth: 0, flex: 1 }]} onPress={() => { setVoiceB64(null); setVoiceText(null); setRecState('idle'); }}>
                    <FontAwesome5 name="redo" size={12} color="#fff" />
                    <Text style={styles.gameBtnSecondaryText}>  REDO</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {!submitted ? (
          <TouchableOpacity testID="gameover-submit" style={[styles.gameBtnPrimary, { backgroundColor: C.accent, borderColor: '#048D6B' }]} onPress={() => submit(!!voiceB64)}>
            <Text style={[styles.gameBtnPrimaryText, { color: '#fff' }]}>SUBMIT SCORE{voiceB64 ? ' + TAUNT' : ''}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={{ marginVertical: 12, fontSize: 16, color: C.accent, fontWeight: '900' }} testID="submitted-msg">✓ Submitted</Text>
        )}

        <TouchableOpacity testID="gameover-retry" style={styles.gameBtnPrimary} onPress={onRetry}>
          <Text style={styles.gameBtnPrimaryText}>PLAY AGAIN</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="gameover-leaderboard" style={styles.gameBtnSecondary} onPress={onLeaderboard}>
          <Text style={styles.gameBtnSecondaryText}>LEADERBOARD</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="gameover-home" style={[styles.gameBtnSecondary, { backgroundColor: C.danger, borderColor: C.dangerDark }]} onPress={onHome}>
          <Text style={styles.gameBtnSecondaryText}>HOME</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------- Vehicle Select Screen ----------
function VehicleSelectScreen({ coins, unlocks, selected, onSelect, onPurchase, dailyMode, onStart, onShop, onBack }: any) {
  const types: VehicleType[] = ['car', 'bike', 'cycle', 'ambulance', 'police', 'tractor'];
  const [busy, setBusy] = useState<string>('');
  const isLocked = (t: VehicleType) => VEHICLE_PRICES[t] !== undefined && !unlocks.includes(`vehicle:${t}`);
  return (
    <SafeAreaView style={[styles.fullScreen, { backgroundColor: C.grass }]} testID="vehicle-select-screen">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <Text style={[styles.gameOverTitle, { fontSize: 28, marginTop: 8, textAlign: 'center' }]}>Choose Your Ride</Text>
        {dailyMode && <Text style={{ textAlign: 'center', color: C.danger, fontWeight: '900', marginBottom: 8 }}>DAILY CHALLENGE</Text>}
        <View style={[styles.homeBestPill, { alignSelf: 'center', backgroundColor: '#FEF3C7', marginBottom: 12 }]}>
          <FontAwesome5 name="coins" size={14} color={C.primaryDark} />
          <Text style={styles.homeBestText}>  {coins}</Text>
        </View>
        {types.map(t => {
          const def = VEHICLE_DEFS[t];
          const locked = isLocked(t);
          const price = VEHICLE_PRICES[t];
          const isSelected = selected === t;
          return (
            <TouchableOpacity
              key={t}
              testID={`vehicle-${t}`}
              activeOpacity={0.85}
              disabled={locked}
              onPress={() => { if (!locked) { SFX.uiTap(); onSelect(t); } }}
              style={{
                backgroundColor: '#fff',
                borderRadius: 16,
                padding: 14,
                marginBottom: 10,
                borderWidth: 3,
                borderColor: isSelected ? C.accent : C.textPrimary,
                opacity: locked ? 0.6 : 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <View style={{ width: 56, height: 38, backgroundColor: def.color, borderRadius: 8, borderWidth: 2, borderColor: '#073B4C', justifyContent: 'center', alignItems: 'center' }}>
                <MaterialCommunityIcons name={iconForVehicle(t)} size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: C.textPrimary }}>{def.label}</Text>
                <Text style={{ fontSize: 12, color: C.secondary }}>Top speed: {Math.floor(def.maxSpeed * 10)}</Text>
              </View>
              {locked ? (
                <TouchableOpacity
                  testID={`buy-${t}`}
                  style={{ backgroundColor: coins >= price ? C.primary : '#E5E7EB', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderBottomWidth: 4, borderColor: coins >= price ? C.primaryDark : '#9CA3AF' }}
                  disabled={coins < price || busy === t}
                  onPress={async () => {
                    setBusy(t);
                    const ok = await onPurchase(t);
                    setBusy('');
                    if (ok) onSelect(t);
                  }}
                >
                  <Text style={{ fontWeight: '900', color: C.textPrimary }}>{busy === t ? '...' : `Buy ${price}`}</Text>
                </TouchableOpacity>
              ) : isSelected ? (
                <FontAwesome5 name="check-circle" size={26} color={C.accent} />
              ) : (
                <FontAwesome5 name="circle" size={20} color="#94a3b8" />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, backgroundColor: 'rgba(255,255,255,0.95)', borderTopWidth: 2, borderColor: C.textPrimary, flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity testID="vsel-back" style={[styles.gameBtnSecondary, { backgroundColor: '#9CA3AF', borderColor: '#6B7280', minWidth: 0, flex: 1 }]} onPress={onBack}>
          <Text style={styles.gameBtnSecondaryText}>BACK</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="vsel-shop" style={[styles.gameBtnSecondary, { backgroundColor: C.accent, borderColor: '#048D6B', minWidth: 0, flex: 1 }]} onPress={onShop}>
          <Text style={styles.gameBtnSecondaryText}>SHOP</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="vsel-start" style={[styles.gameBtnPrimary, { minWidth: 0, flex: 2 }]} onPress={onStart}>
          <Text style={styles.gameBtnPrimaryText}>START</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ---------- Coin Shop Screen ----------
function ShopScreen({ coins, playerId, onBack }: any) {
  const [packs, setPacks] = useState<any[]>([]);
  const [busy, setBusy] = useState<string>('');
  useEffect(() => {
    fetch(`${BACKEND}/api/coin-packs`).then(r => r.json()).then(d => setPacks(d || [])).catch(() => {});
  }, []);
  const buy = async (id: string) => {
    setBusy(id);
    try {
      const origin = (typeof window !== 'undefined' && window.location) ? window.location.origin : (BACKEND as string);
      const r = await fetch(`${BACKEND}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_id: id, origin_url: origin, player_id: playerId }),
      });
      const d = await r.json();
      if (d.url) {
        if (typeof window !== 'undefined' && window.location) {
          window.location.href = d.url;
        } else {
          await Linking.openURL(d.url);
        }
      }
    } catch (_e) {}
    setBusy('');
  };
  return (
    <SafeAreaView style={[styles.fullScreen, { backgroundColor: C.grass }]} testID="shop-screen">
      <View style={styles.lbHeader}>
        <Text style={styles.lbTitle}>Coin Shop</Text>
        <View style={[styles.homeBestPill, { backgroundColor: '#FEF3C7', marginTop: 8 }]}>
          <FontAwesome5 name="coins" size={14} color={C.primaryDark} />
          <Text style={styles.homeBestText}>  Balance: {coins}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
        {packs.length === 0 ? (
          <ActivityIndicator size="large" color={C.secondary} style={{ marginTop: 40 }} />
        ) : packs.map((p: any) => (
          <View key={p.id} style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 3, borderColor: C.textPrimary, flexDirection: 'row', alignItems: 'center', gap: 12 }} testID={`pack-${p.id}`}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: C.primaryDark }}>
              <FontAwesome5 name="coins" size={24} color={C.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: C.textPrimary }}>{p.label}</Text>
              <Text style={{ fontSize: 14, color: C.secondary, fontWeight: '700' }}>{p.coins.toLocaleString()} coins</Text>
            </View>
            <TouchableOpacity
              testID={`buy-pack-${p.id}`}
              style={{ backgroundColor: C.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderBottomWidth: 4, borderColor: C.primaryDark }}
              disabled={busy === p.id}
              onPress={() => buy(p.id)}
            >
              <Text style={{ fontWeight: '900', color: C.textPrimary }}>{busy === p.id ? '...' : `$${p.amount}`}</Text>
            </TouchableOpacity>
          </View>
        ))}
        <Text style={{ textAlign: 'center', color: C.textPrimary, fontSize: 12, opacity: 0.7, marginTop: 12 }}>Test mode — payments are simulated.</Text>
      </ScrollView>
      <View style={styles.lbFooter}>
        <TouchableOpacity testID="shop-back" style={styles.gameBtnPrimary} onPress={onBack}>
          <Text style={styles.gameBtnPrimaryText}>BACK</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ---------- Leaderboard ----------
function LeaderboardScreen({ onBack }: any) {
  const [tab, setTab] = useState<'global' | 'daily'>('global');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const url = tab === 'daily' ? `${BACKEND}/api/daily/leaderboard` : `${BACKEND}/api/scores/leaderboard`;
    fetch(url)
      .then(r => r.json())
      .then(d => { setItems(d || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [tab]);
  return (
    <SafeAreaView style={[styles.fullScreen, { backgroundColor: C.grass }]} testID="leaderboard-screen">
      <View style={styles.lbHeader}>
        <Text style={styles.lbTitle}>Leaderboard</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <TouchableOpacity testID="lb-tab-global" onPress={() => { SFX.uiTap(); setTab('global'); }} style={{ paddingHorizontal: 18, paddingVertical: 8, borderRadius: 16, backgroundColor: tab === 'global' ? C.primary : 'rgba(255,255,255,0.6)', borderWidth: 2, borderColor: C.textPrimary }}>
            <Text style={{ fontWeight: '900', color: C.textPrimary }}>Global</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="lb-tab-daily" onPress={() => { SFX.uiTap(); setTab('daily'); }} style={{ paddingHorizontal: 18, paddingVertical: 8, borderRadius: 16, backgroundColor: tab === 'daily' ? C.danger : 'rgba(255,255,255,0.6)', borderWidth: 2, borderColor: C.textPrimary }}>
            <Text style={{ fontWeight: '900', color: tab === 'daily' ? '#fff' : C.textPrimary }}>Today</Text>
          </TouchableOpacity>
        </View>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={C.secondary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
          {items.length === 0 ? (
            <Text style={styles.lbEmpty} testID="lb-empty">{tab === 'daily' ? 'No scores yet today. Be the first!' : 'No scores yet. Be the first!'}</Text>
          ) : (
            items.map((it, idx) => (
              <View key={it.id || idx} style={styles.lbRow} testID={`lb-row-${idx}`}>
                <Text style={styles.lbRank}>#{idx + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lbName} numberOfLines={1}>{it.player_name}</Text>
                  {it.voice_text ? <Text style={{ fontSize: 11, color: C.secondary, fontStyle: 'italic' }} numberOfLines={1}>"{it.voice_text}"</Text> : null}
                </View>
                {it.has_voice ? (
                  <TouchableOpacity testID={`lb-play-${idx}`} style={{ marginRight: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' }} onPress={async () => {
                    try {
                      const r = await fetch(`${BACKEND}/api/scores/${it.id}/voice`);
                      if (!r.ok) return;
                      const d = await r.json();
                      if (d.audio_base64 && typeof window !== 'undefined' && (window as any).Audio) {
                        const a = new (window as any).Audio(`data:audio/webm;base64,${d.audio_base64}`);
                        a.play().catch(() => {});
                      }
                    } catch (_e) {}
                  }}>
                    <FontAwesome5 name="volume-up" size={14} color="#fff" />
                  </TouchableOpacity>
                ) : null}
                <Text style={styles.lbScore}>{it.score}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
      <View style={styles.lbFooter}>
        <TouchableOpacity testID="lb-back" style={styles.gameBtnPrimary} onPress={onBack}>
          <Text style={styles.gameBtnPrimaryText}>BACK</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ---------- The Game ----------
function GameScreen({ playerName, initialVehicle, dailyMode, onExit }: { playerName: string; initialVehicle: VehicleType; dailyMode: boolean; onExit: (score: number, missions: number, coinsEarned: number, vehicle: string) => void }) {
  const [dim, setDim] = useState(Dimensions.get('window'));
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setDim(window));
    return () => sub.remove();
  }, []);
  const SCREEN_W = dim.width;
  const SCREEN_H = dim.height;

  // Boot the player into their selected vehicle right away
  const playerRef = useRef({
    x: 250,
    y: 240,
    angle: 0,
    onFoot: true,
    vehicleId: null as string | null,
    speed: 0,
  });
  const vehiclesRef = useRef<Vehicle[]>(initialVehicles());
  const npcsRef = useRef<Npc[]>(initialNpcs());
  const inputRef = useRef({ dx: 0, dy: 0, boost: false });
  const missionRef = useRef<Mission | null>(null);
  const coinsEarnedRef = useRef<number>(0);
  const lastVehicleRef = useRef<string>(initialVehicle || 'car');

  // Place initial selected vehicle near the player and seat them in it
  useEffect(() => {
    if (!initialVehicle) return;
    const def = VEHICLE_DEFS[initialVehicle];
    const newVeh: Vehicle = {
      id: 'starter',
      type: initialVehicle,
      x: playerRef.current.x + 30,
      y: playerRef.current.y + 30,
      angle: 0,
      speed: 0,
      maxSpeed: def.maxSpeed,
      color: def.color,
      width: def.w,
      length: def.l,
      label: def.label,
    };
    vehiclesRef.current = [newVeh, ...vehiclesRef.current];
    playerRef.current.x = newVeh.x;
    playerRef.current.y = newVeh.y;
    playerRef.current.onFoot = false;
    playerRef.current.vehicleId = newVeh.id;
    lastVehicleRef.current = initialVehicle;
  }, [initialVehicle]);

  const [scoreState, setScoreState] = useState(0);
  const [missionsState, setMissionsState] = useState(0);
  const [healthState, setHealthState] = useState(100);
  const [paused, setPaused] = useState(false);
  const [hornActive, setHornActive] = useState(false);
  const [tick, setTick] = useState(0);
  const [missionToast, setMissionToast] = useState<string>('');
  const [activeNpc, setActiveNpc] = useState<Npc | null>(null);
  const [activeDialog, setActiveDialog] = useState<string>('');
  const [ttsLoading, setTtsLoading] = useState<boolean>(false);
  // Day/night cycle (0..1 where 0=morning, 0.25=noon, 0.5=dusk, 0.75=night)
  const [timeOfDay, setTimeOfDay] = useState<number>(0.1);
  const [weather, setWeather] = useState<'clear' | 'rain'>('clear');

  const scoreRef = useRef(0);
  const missionsCountRef = useRef(0);
  const healthRef = useRef(100);
  const timeAccumRef = useRef(0);
  const audioElRef = useRef<any>(null);

  // initial mission
  useEffect(() => {
    missionRef.current = generateMission();
  }, []);

  // day/night cycle - one full cycle per 4 minutes
  useEffect(() => {
    const id = setInterval(() => {
      setTimeOfDay(t => (t + 1 / 240) % 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // weather: random change every ~45-90s
  useEffect(() => {
    const cycle = () => {
      setWeather(prev => (prev === 'rain' ? 'clear' : Math.random() < 0.4 ? 'rain' : 'clear'));
    };
    const id = setInterval(cycle, 60000);
    return () => clearInterval(id);
  }, []);

  // generate rain drops
  const rainDrops = React.useMemo(() => {
    const arr: { x: number; y: number; d: number }[] = [];
    for (let i = 0; i < 80; i++) {
      arr.push({ x: Math.random() * SCREEN_W, y: Math.random() * SCREEN_H, d: 4 + Math.random() * 8 });
    }
    return arr;
  }, [SCREEN_W, SCREEN_H]);

  const playNpcDialog = useCallback(async (n: Npc) => {
    SFX.uiTap();
    const line = n.dialogs[Math.floor(Math.random() * n.dialogs.length)];
    setActiveNpc(n);
    setActiveDialog(line);
    setTtsLoading(true);
    try {
      const r = await fetch(`${BACKEND}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `${n.name} says: ${line}`, voice: n.voice }),
      });
      const d = await r.json();
      if (d.audio_base64 && typeof window !== 'undefined' && (window as any).Audio) {
        if (audioElRef.current) {
          try { audioElRef.current.pause(); } catch (_e) {}
        }
        const a = new (window as any).Audio(`data:audio/mp3;base64,${d.audio_base64}`);
        audioElRef.current = a;
        a.play().catch(() => {});
      }
    } catch (_e) {}
    setTtsLoading(false);
  }, []);

  function generateMission(): Mission {
    const types: VehicleType[] = ['car', 'bike', 'ambulance', 'police', 'cycle', 'tractor'];
    const vt = types[Math.floor(Math.random() * types.length)];
    let candidates = BUILDINGS;
    if (vt === 'ambulance') candidates = BUILDINGS.filter(b => b.type === 'hospital' || b.type === 'house');
    if (vt === 'police') candidates = BUILDINGS.filter(b => b.type === 'police' || b.type === 'shop');
    if (vt === 'tractor') candidates = BUILDINGS.filter(b => b.type === 'farm' || b.type === 'barn' || b.type === 'depot');
    if (candidates.length === 0) candidates = BUILDINGS;
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    const labelByType: Record<VehicleType, string> = {
      car: 'Drive a Car',
      bike: 'Ride the Bike',
      ambulance: 'Take the Ambulance',
      police: 'Drive the Police car',
      cycle: 'Ride the Cycle',
      tractor: 'Drive the Tractor',
    };
    return {
      vehicleType: vt,
      targetBuildingId: target.id,
      description: `${labelByType[vt]} to ${target.label}`,
      reward: 150,
    };
  }

  // joystick PanResponder
  const joySize = 130;
  const joyMax = (joySize / 2) - 22;
  const [joyOffset, setJoyOffset] = useState({ x: 0, y: 0 });
  const joyResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_e, g) => {
        let dx = g.dx;
        let dy = g.dy;
        const len = Math.sqrt(dx * dx + dy * dy);
        const max = joyMax;
        if (len > max) {
          dx = (dx / len) * max;
          dy = (dy / len) * max;
        }
        inputRef.current.dx = dx / max;
        inputRef.current.dy = dy / max;
        setJoyOffset({ x: dx, y: dy });
      },
      onPanResponderRelease: () => {
        inputRef.current.dx = 0;
        inputRef.current.dy = 0;
        setJoyOffset({ x: 0, y: 0 });
      },
      onPanResponderTerminate: () => {
        inputRef.current.dx = 0;
        inputRef.current.dy = 0;
        setJoyOffset({ x: 0, y: 0 });
      },
    })
  ).current;

  // game loop
  useEffect(() => {
    let raf: any;
    let lastTs = Date.now();
    const loop = () => {
      const now = Date.now();
      const dt = Math.min(40, now - lastTs);
      lastTs = now;
      if (!paused) step(dt);
      raf = setTimeout(loop, 33);
    };
    loop();
    return () => clearTimeout(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  const showToast = (msg: string) => {
    setMissionToast(msg);
    setTimeout(() => setMissionToast(''), 2200);
  };

  const step = (dt: number) => {
    const p = playerRef.current;
    const inp = inputRef.current;
    const dtScale = dt / 16.67; // normalize to ~60fps frame

    // movement
    if (p.onFoot) {
      const walkSpeed = 2.4;
      p.x += inp.dx * walkSpeed * dtScale;
      p.y += inp.dy * walkSpeed * dtScale;
      if (Math.abs(inp.dx) > 0.05 || Math.abs(inp.dy) > 0.05) {
        p.angle = Math.atan2(inp.dy, inp.dx);
      }
    } else {
      const veh = vehiclesRef.current.find(v => v.id === p.vehicleId);
      if (veh) {
        // joystick steers vehicle
        const intensity = Math.sqrt(inp.dx * inp.dx + inp.dy * inp.dy);
        if (intensity > 0.05) {
          const targetAngle = Math.atan2(inp.dy, inp.dx);
          // interpolate angle
          let diff = targetAngle - veh.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const turnRate = 0.08 * dtScale;
          veh.angle += Math.max(-turnRate * Math.abs(diff) * 6, Math.min(turnRate * Math.abs(diff) * 6, diff));
          // accelerate
          const boostMul = inp.boost ? 1.6 : 1.0;
          veh.speed += 0.18 * intensity * dtScale;
          if (veh.speed > veh.maxSpeed * boostMul) veh.speed = veh.maxSpeed * boostMul;
        } else {
          veh.speed *= 0.92;
          if (veh.speed < 0.05) veh.speed = 0;
        }
        veh.x += Math.cos(veh.angle) * veh.speed * dtScale;
        veh.y += Math.sin(veh.angle) * veh.speed * dtScale;
        // boundary
        veh.x = Math.max(20, Math.min(WORLD_W - 20, veh.x));
        veh.y = Math.max(20, Math.min(WORLD_H - 20, veh.y));
        // collision with buildings: simple bounce-back
        for (const b of BUILDINGS) {
          if (veh.x > b.x - 16 && veh.x < b.x + b.w + 16 && veh.y > b.y - 16 && veh.y < b.y + b.h + 16) {
            // reverse position step
            veh.x -= Math.cos(veh.angle) * veh.speed * dtScale * 1.1;
            veh.y -= Math.sin(veh.angle) * veh.speed * dtScale * 1.1;
            if (veh.speed > 3) {
              healthRef.current = Math.max(0, healthRef.current - 4);
              setHealthState(healthRef.current);
            }
            veh.speed *= 0.3;
          }
        }
        // hit NPCs?
        for (const n of npcsRef.current) {
          const dx = n.x - veh.x;
          const dy = n.y - veh.y;
          if (dx * dx + dy * dy < 22 * 22 && veh.speed > 1.5) {
            n.x += dx > 0 ? 30 : -30;
            n.y += dy > 0 ? 30 : -30;
            healthRef.current = Math.max(0, healthRef.current - 6);
            setHealthState(healthRef.current);
            scoreRef.current = Math.max(0, scoreRef.current - 5);
          }
        }
        // sync player with vehicle
        p.x = veh.x;
        p.y = veh.y;
        p.angle = veh.angle;
        p.speed = veh.speed;

        // mission check
        const m = missionRef.current;
        if (m && m.vehicleType === veh.type) {
          const tb = BUILDINGS.find(b => b.id === m.targetBuildingId);
          if (tb) {
            const cx = tb.x + tb.w / 2;
            const cy = tb.y + tb.h / 2;
            const reach = Math.max(tb.w, tb.h) / 2 + 20;
            const dxx = veh.x - cx;
            const dyy = veh.y - cy;
            if (dxx * dxx + dyy * dyy < reach * reach) {
              scoreRef.current += m.reward;
              missionsCountRef.current += 1;
              coinsEarnedRef.current += 10;
              setMissionsState(missionsCountRef.current);
              showToast(`Mission complete! +${m.reward} pts +10 coins`);
              SFX.missionDone();
              SFX.coin();
              missionRef.current = generateMission();
            }
          }
        }

        // earn passive score when driving fast
        if (veh.speed > 1) {
          scoreRef.current += 0.1 * dtScale;
        }
      }
    }

    // bound player on foot too
    p.x = Math.max(16, Math.min(WORLD_W - 16, p.x));
    p.y = Math.max(16, Math.min(WORLD_H - 16, p.y));

    // npc movement
    for (const n of npcsRef.current) {
      n.x += n.vx * dtScale;
      n.y += n.vy * dtScale;
      if (Math.random() < 0.005) {
        n.vx = (Math.random() - 0.5) * 1.2;
        n.vy = (Math.random() - 0.5) * 1.2;
      }
      if (n.x < 40 || n.x > WORLD_W - 40) n.vx *= -1;
      if (n.y < 40 || n.y > WORLD_H - 40) n.vy *= -1;
    }

    timeAccumRef.current += dt;
    if (timeAccumRef.current > 100) {
      timeAccumRef.current = 0;
      setScoreState(Math.floor(scoreRef.current));
      setTick(t => (t + 1) % 1000);
    }

    if (healthRef.current <= 0) {
      onExit(Math.floor(scoreRef.current), missionsCountRef.current, coinsEarnedRef.current, lastVehicleRef.current);
    }
  };

  // actions
  const onEnterExit = () => {
    const p = playerRef.current;
    if (p.onFoot) {
      // find closest vehicle within range
      let closest: Vehicle | null = null;
      let bestD = 60 * 60;
      for (const v of vehiclesRef.current) {
        const dxx = v.x - p.x;
        const dyy = v.y - p.y;
        const d = dxx * dxx + dyy * dyy;
        if (d < bestD) {
          bestD = d;
          closest = v;
        }
      }
      if (closest) {
        p.onFoot = false;
        p.vehicleId = closest.id;
        lastVehicleRef.current = closest.type;
        SFX.enter();
        showToast(`Boarded ${closest.label}`);
      } else {
        showToast('No vehicle nearby');
      }
    } else {
      const veh = vehiclesRef.current.find(v => v.id === p.vehicleId);
      if (veh) {
        veh.speed = 0;
        // place player beside vehicle
        p.x = veh.x + Math.cos(veh.angle + Math.PI / 2) * 26;
        p.y = veh.y + Math.sin(veh.angle + Math.PI / 2) * 26;
      }
      p.onFoot = true;
      p.vehicleId = null;
      showToast('Exited vehicle');
    }
    setTick(t => t + 1);
  };

  const onHorn = () => {
    setHornActive(true);
    SFX.horn();
    setTimeout(() => setHornActive(false), 400);
    // scare NPCs
    const p = playerRef.current;
    for (const n of npcsRef.current) {
      const dxx = n.x - p.x;
      const dyy = n.y - p.y;
      const d2 = dxx * dxx + dyy * dyy;
      if (d2 < 200 * 200) {
        const d = Math.sqrt(d2) || 1;
        n.vx = (dxx / d) * 1.8;
        n.vy = (dyy / d) * 1.8;
      }
    }
  };

  const setBoost = (on: boolean) => {
    inputRef.current.boost = on;
  };

  // camera
  const camX = playerRef.current.x - SCREEN_W / 2;
  const camY = playerRef.current.y - SCREEN_H / 2;

  const currentVeh = !playerRef.current.onFoot
    ? vehiclesRef.current.find(v => v.id === playerRef.current.vehicleId)
    : null;
  const currentVehLabel = currentVeh ? currentVeh.label : 'On Foot';

  // mission marker
  const mission = missionRef.current;
  let missionTargetBuilding: Building | null = null;
  if (mission) missionTargetBuilding = BUILDINGS.find(b => b.id === mission.targetBuildingId) || null;

  // arrow direction to mission target
  let arrowAngle = 0;
  let arrowDist = 0;
  if (missionTargetBuilding) {
    const tx = missionTargetBuilding.x + missionTargetBuilding.w / 2;
    const ty = missionTargetBuilding.y + missionTargetBuilding.h / 2;
    const dx = tx - playerRef.current.x;
    const dy = ty - playerRef.current.y;
    arrowAngle = Math.atan2(dy, dx);
    arrowDist = Math.sqrt(dx * dx + dy * dy);
  }

  return (
    <View style={styles.gameRoot} testID="game-screen">
      <StatusBar barStyle="light-content" />
      {/* World viewport */}
      <View style={[styles.worldViewport, { width: SCREEN_W, height: SCREEN_H }]} pointerEvents="box-none">
        <View
          style={{
            position: 'absolute',
            width: WORLD_W,
            height: WORLD_H,
            transform: [{ translateX: -camX }, { translateY: -camY }],
            backgroundColor: C.grass,
          }}
          pointerEvents="box-none"
        >
          {/* Grass texture: scatter dark patches */}
          {GRASS_PATCHES.map((g, i) => (
            <View key={`gp-${i}`} style={{ position: 'absolute', left: g.x, top: g.y, width: g.s, height: g.s, borderRadius: g.s, backgroundColor: C.grassDark, opacity: 0.5 }} />
          ))}

          {/* Roads */}
          {ROADS.map((r, i) => (
            <View key={`r-${i}`} style={{ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, backgroundColor: C.road }}>
              {r.horizontal ? (
                <View style={{ position: 'absolute', left: 0, top: r.h / 2 - 3, width: r.w, height: 6, flexDirection: 'row' }}>
                  {Array.from({ length: Math.floor(r.w / 60) }).map((_, k) => (
                    <View key={k} style={{ width: 30, height: 6, backgroundColor: C.roadLine, marginRight: 30 }} />
                  ))}
                </View>
              ) : (
                <View style={{ position: 'absolute', top: 0, left: r.w / 2 - 3, width: 6, height: r.h }}>
                  {Array.from({ length: Math.floor(r.h / 60) }).map((_, k) => (
                    <View key={k} style={{ width: 6, height: 30, backgroundColor: C.roadLine, marginBottom: 30 }} />
                  ))}
                </View>
              )}
            </View>
          ))}

          {/* Buildings */}
          {BUILDINGS.map(b => {
            const isTarget = mission && b.id === mission.targetBuildingId;
            return (
              <View key={b.id} style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h }}>
                <View style={{ flex: 1, backgroundColor: b.color, borderRadius: 10, borderWidth: 3, borderColor: '#073B4C', justifyContent: 'center', alignItems: 'center' }}>
                  <View style={{ position: 'absolute', top: 8, left: 8, right: 8, height: 30, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 6 }} />
                  <View style={{ position: 'absolute', top: b.h * 0.45, left: b.w * 0.35, width: b.w * 0.3, height: b.h * 0.5, backgroundColor: '#073B4C', borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14, position: 'absolute', top: 12 }} numberOfLines={1}>{b.label}</Text>
                </View>
                {isTarget && (
                  <View style={{ position: 'absolute', top: -36, alignSelf: 'center', backgroundColor: C.danger, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 2, borderColor: '#fff' }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>TARGET</Text>
                  </View>
                )}
              </View>
            );
          })}

          {/* NPCs (tappable for dialog) */}
          {npcsRef.current.map(n => (
            <TouchableOpacity
              key={n.id}
              activeOpacity={0.6}
              onPress={() => playNpcDialog(n)}
              testID={`npc-${n.id}`}
              style={{ position: 'absolute', left: n.x - 14, top: n.y - 14, width: 28, height: 32 }}
            >
              {/* shadow */}
              <View style={{ position: 'absolute', left: 4, top: 22, width: 20, height: 6, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.35)' }} />
              {/* head */}
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: n.color, borderWidth: 2, borderColor: '#073B4C', alignSelf: 'center' }} />
              {/* body */}
              <View style={{ width: 14, height: 10, backgroundColor: n.shirtColor, alignSelf: 'center', marginTop: -2, borderRadius: 2, borderWidth: 1, borderColor: '#073B4C' }} />
            </TouchableOpacity>
          ))}

          {/* Vehicles */}
          {vehiclesRef.current.map(v => (
            <View
              key={v.id}
              style={{
                position: 'absolute',
                left: v.x - v.length / 2,
                top: v.y - v.width / 2,
                width: v.length,
                height: v.width,
                transform: [{ rotate: `${v.angle}rad` }],
              }}
            >
              <View style={{ flex: 1, backgroundColor: v.color, borderRadius: 8, borderWidth: 2, borderColor: '#073B4C', justifyContent: 'center', alignItems: 'center', flexDirection: 'row' }}>
                {/* windshield */}
                <View style={{ position: 'absolute', right: 6, top: 3, bottom: 3, width: 10, backgroundColor: '#073B4C', borderRadius: 3, opacity: 0.7 }} />
                {/* type marker */}
                {v.type === 'ambulance' && <View style={{ width: 10, height: 10, backgroundColor: C.danger, borderRadius: 2 }} />}
                {v.type === 'police' && <View style={{ width: 8, height: 8, backgroundColor: C.danger, borderRadius: 4, position: 'absolute', top: 2, left: '40%' }} />}
                {v.type === 'tractor' && <View style={{ width: 8, height: 8, backgroundColor: '#073B4C', borderRadius: 4, position: 'absolute', left: 2 }} />}
              </View>
            </View>
          ))}

          {/* Player on foot */}
          {playerRef.current.onFoot && (
            <View style={{ position: 'absolute', left: playerRef.current.x - 9, top: playerRef.current.y - 9, width: 18, height: 24 }}>
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFD166', borderWidth: 2, borderColor: '#073B4C' }} />
              <View style={{ width: 14, height: 10, backgroundColor: C.danger, alignSelf: 'center', marginTop: -2, borderRadius: 2 }} />
            </View>
          )}

          {/* horn ripple */}
          {hornActive && (
            <View style={{ position: 'absolute', left: playerRef.current.x - 80, top: playerRef.current.y - 80, width: 160, height: 160, borderRadius: 80, borderWidth: 4, borderColor: C.primary, opacity: 0.6 }} />
          )}
        </View>

        {/* Night tint overlay (above world, below HUD) */}
        {(() => { const nt = nightTint(timeOfDay); return nt.alpha > 0.02 ? (
          <View pointerEvents="none" style={{ ...StyleSheet.absoluteFillObject, backgroundColor: nt.color, opacity: nt.alpha }} />
        ) : null; })()}

        {/* Rain particles overlay */}
        {weather === 'rain' && (
          <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            {rainDrops.map((d, i) => (
              <View key={`rd-${i}`} style={{ position: 'absolute', left: (d.x + (tick * 6) % SCREEN_W) % SCREEN_W, top: (d.y + (tick * (8 + d.d)) ) % SCREEN_H, width: 2, height: 12, backgroundColor: 'rgba(170,200,255,0.7)', borderRadius: 1, transform: [{ rotate: '12deg' }] }} />
            ))}
            <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(120,140,180,0.18)' }} />
          </View>
        )}
      </View>

      {/* HUD top */}
      <SafeAreaView style={styles.hudTop} pointerEvents="box-none">
        <View style={styles.hudTopRow} pointerEvents="box-none">
          <View style={styles.hudPill} testID="hud-score">
            <FontAwesome5 name="star" size={14} color={C.primaryDark} />
            <Text style={styles.hudPillText}>  {scoreState}</Text>
          </View>
          <View style={styles.hudPill} testID="hud-missions">
            <FontAwesome5 name="flag-checkered" size={13} color={C.accent} />
            <Text style={styles.hudPillText}>  {missionsState}</Text>
          </View>
          <View style={styles.hudPill} testID="hud-health">
            <FontAwesome5 name="heart" size={13} color={C.danger} />
            <Text style={styles.hudPillText}>  {healthState}</Text>
          </View>
          <View style={styles.hudPill} testID="hud-speed">
            <MaterialCommunityIcons name="speedometer" size={16} color={C.secondary} />
            <Text style={styles.hudPillText}>  {Math.floor((playerRef.current.speed || 0) * 10)}</Text>
          </View>
          <View style={styles.hudPill} testID="hud-time">
            <MaterialCommunityIcons name={timeOfDay > 0.7 || timeOfDay < 0.05 ? 'weather-night' : 'white-balance-sunny'} size={14} color={C.primaryDark} />
            <Text style={styles.hudPillText}>  {timePhaseLabel(timeOfDay)}</Text>
          </View>
          {weather === 'rain' && (
            <View style={styles.hudPill} testID="hud-weather">
              <MaterialCommunityIcons name="weather-pouring" size={14} color={C.secondary} />
              <Text style={styles.hudPillText}>  Rain</Text>
            </View>
          )}
          <TouchableOpacity testID="pause-button" style={[styles.hudPill, { backgroundColor: C.danger }]} onPress={() => setPaused(true)}>
            <FontAwesome5 name="pause" size={12} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.missionBanner} testID="mission-banner">
          <Text style={styles.missionLabel}>MISSION</Text>
          <Text style={styles.missionText} numberOfLines={2}>{mission ? mission.description : '...'}</Text>
          {missionTargetBuilding && (
            <Text style={styles.missionDist}>{Math.floor(arrowDist)}m away</Text>
          )}
        </View>

        {/* Mission arrow at top center pointing to target */}
        {missionTargetBuilding && arrowDist > 200 && (
          <View style={{ position: 'absolute', top: 170, alignSelf: 'center', width: 50, height: 50, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ transform: [{ rotate: `${arrowAngle + Math.PI / 2}rad` }] }}>
              <MaterialCommunityIcons name="navigation-variant" size={42} color={C.danger} />
            </View>
          </View>
        )}

        <View style={styles.vehicleNamePill} testID="vehicle-name">
          <MaterialCommunityIcons name={currentVeh ? iconForVehicle(currentVeh.type) : 'walk'} size={16} color={C.textPrimary} />
          <Text style={styles.vehicleNameText}>  {playerName}: {currentVehLabel}</Text>
        </View>

        {missionToast ? (
          <View style={styles.toast} testID="mission-toast">
            <Text style={styles.toastText}>{missionToast}</Text>
          </View>
        ) : null}
      </SafeAreaView>

      {/* Joystick */}
      <View
        style={[styles.joystickBase, { width: joySize, height: joySize, borderRadius: joySize / 2, left: 28, bottom: 60 }]}
        testID="joystick"
        {...joyResponder.panHandlers}
      >
        <View
          style={[
            styles.joystickThumb,
            {
              transform: [{ translateX: joyOffset.x }, { translateY: joyOffset.y }],
            },
          ]}
        />
      </View>

      {/* Action buttons */}
      <View style={styles.actionsCol} pointerEvents="box-none">
        <TouchableOpacity testID="action-enter-exit" style={[styles.actionBtn, { backgroundColor: C.accent, borderColor: '#048D6B' }]} onPress={onEnterExit}>
          <MaterialCommunityIcons name="car-door" size={26} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity testID="action-horn" style={[styles.actionBtn, { backgroundColor: C.primary, borderColor: C.primaryDark }]} onPress={onHorn}>
          <MaterialCommunityIcons name="bullhorn" size={24} color={C.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          testID="action-boost"
          style={[styles.actionBtn, { backgroundColor: C.danger, borderColor: C.dangerDark }]}
          onPressIn={() => setBoost(true)}
          onPressOut={() => setBoost(false)}
        >
          <MaterialCommunityIcons name="lightning-bolt" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Pause overlay */}
      {paused && (
        <View style={styles.pauseOverlay} testID="pause-overlay">
          <View style={styles.pauseCard}>
            <Text style={styles.pauseTitle}>Paused</Text>
            <TouchableOpacity testID="pause-resume" style={styles.gameBtnPrimary} onPress={() => setPaused(false)}>
              <Text style={styles.gameBtnPrimaryText}>RESUME</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="pause-quit"
              style={[styles.gameBtnSecondary, { backgroundColor: C.danger, borderColor: C.dangerDark }]}
              onPress={() => onExit(Math.floor(scoreRef.current), missionsCountRef.current, coinsEarnedRef.current, lastVehicleRef.current)}
            >
              <Text style={styles.gameBtnSecondaryText}>END RUN</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* NPC Dialog */}
      {activeNpc && (
        <View style={styles.dialogOverlay} testID="npc-dialog">
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setActiveNpc(null)} />
          <View style={styles.dialogCard}>
            <View style={styles.dialogHeader}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: activeNpc.color, borderWidth: 2, borderColor: '#073B4C', justifyContent: 'center', alignItems: 'center' }}>
                <FontAwesome5 name={activeNpc.type === 'farmer' ? 'tractor' : 'user'} size={14} color="#fff" />
              </View>
              <Text style={styles.dialogName} testID="npc-dialog-name">{activeNpc.name}</Text>
              {ttsLoading && <ActivityIndicator size="small" color={C.secondary} />}
            </View>
            <Text style={styles.dialogText} testID="npc-dialog-text">"{activeDialog}"</Text>
            <TouchableOpacity testID="npc-dialog-close" style={[styles.gameBtnPrimary, { minWidth: 160 }]} onPress={() => { setActiveNpc(null); try { audioElRef.current?.pause(); } catch (_e) {} }}>
              <Text style={styles.gameBtnPrimaryText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function iconForVehicle(t: VehicleType): any {
  switch (t) {
    case 'car': return 'car-hatchback';
    case 'bike': return 'motorbike';
    case 'ambulance': return 'ambulance';
    case 'police': return 'police-badge';
    case 'cycle': return 'bike';
    case 'tractor': return 'tractor';
    default: return 'car';
  }
}

// shade: lighten/darken a hex color by amount (-100..100)
function shade(hex: string, amt: number): string {
  const m = /^#?([a-f\d]{6})$/i.exec(hex);
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  let r = (num >> 16) + amt;
  let g = ((num >> 8) & 0xff) + amt;
  let b = (num & 0xff) + amt;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// skyColor returns a sky color based on time-of-day t (0..1)
function skyColor(t: number): string {
  // 0.0 morning peach, 0.25 noon blue, 0.5 dusk orange, 0.75 night dark blue
  if (t < 0.25) return lerpColor('#FFD8A8', '#7DD3FC', t / 0.25);
  if (t < 0.5)  return lerpColor('#7DD3FC', '#FB923C', (t - 0.25) / 0.25);
  if (t < 0.75) return lerpColor('#FB923C', '#1E3A8A', (t - 0.5) / 0.25);
  return lerpColor('#1E3A8A', '#FFD8A8', (t - 0.75) / 0.25);
}

function nightTint(t: number): { color: string; alpha: number } {
  // night peak around t = 0.85
  const dist = Math.abs(t - 0.85);
  const a = Math.max(0, 0.55 - dist * 1.6);
  return { color: '#0B1639', alpha: a };
}

function lerpColor(a: string, b: string, p: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 0xff) * (1 - p) + ((pb >> 16) & 0xff) * p);
  const g = Math.round(((pa >> 8) & 0xff) * (1 - p) + ((pb >> 8) & 0xff) * p);
  const bl = Math.round((pa & 0xff) * (1 - p) + (pb & 0xff) * p);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
}

function timePhaseLabel(t: number): string {
  if (t < 0.2) return 'Morning';
  if (t < 0.45) return 'Noon';
  if (t < 0.7) return 'Dusk';
  return 'Night';
}

// pre-generate grass patches deterministically-ish
const GRASS_PATCHES: { x: number; y: number; s: number }[] = (() => {
  const arr = [];
  let seed = 1234;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < 80; i++) {
    arr.push({ x: rand() * WORLD_W, y: rand() * WORLD_H, s: 30 + rand() * 50 });
  }
  return arr;
})();

// ---------- Styles ----------
const styles = StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: C.grass },
  // Home
  homeBg: { flex: 1, backgroundColor: C.grass, alignItems: 'center', justifyContent: 'center', padding: 24 },
  homeRoad: { position: 'absolute', left: 0, right: 0, top: '52%', height: 70, backgroundColor: C.road },
  homeRoadLine: { position: 'absolute', left: 0, right: 0, top: '52%', height: 70, alignItems: 'center', justifyContent: 'center' },
  homeContent: { width: '100%', alignItems: 'center', paddingTop: 24 },
  homeTitleSmall: { fontSize: 14, fontWeight: '700', color: C.textPrimary, letterSpacing: 4, opacity: 0.7 },
  homeTitle: { fontSize: 48, fontWeight: '900', color: C.textPrimary, letterSpacing: -1, marginTop: 4, textAlign: 'center' },
  homeSub: { fontSize: 16, color: C.textPrimary, opacity: 0.8, marginTop: 8, marginBottom: 24, textAlign: 'center' },
  homeIconRow: { flexDirection: 'row', gap: 14, marginVertical: 16, flexWrap: 'wrap', justifyContent: 'center' },
  homeWelcome: { color: C.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 4 },
  homeBestPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceOverlay, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, marginTop: 24, borderWidth: 2, borderColor: C.textPrimary },
  homeBestText: { color: C.textPrimary, fontWeight: '800' },

  // Buttons
  gameBtnPrimary: {
    flexDirection: 'row',
    backgroundColor: C.primary,
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderBottomWidth: 6,
    borderColor: C.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    minWidth: 220,
  },
  gameBtnPrimaryText: { color: C.textPrimary, fontWeight: '900', fontSize: 18, letterSpacing: 1 },
  gameBtnSecondary: {
    flexDirection: 'row',
    backgroundColor: C.secondary,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderBottomWidth: 6,
    borderColor: C.secondaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
    minWidth: 220,
  },
  gameBtnSecondaryText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1 },

  // Name screen
  nameWrap: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  nameTitle: { fontSize: 32, fontWeight: '900', color: C.textPrimary, marginBottom: 16 },
  nameInput: { width: '100%', backgroundColor: '#fff', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 16, fontSize: 18, borderWidth: 3, borderColor: C.textPrimary, marginBottom: 16 },

  // Game over
  gameOverWrap: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  gameOverTitle: { fontSize: 36, fontWeight: '900', color: C.textPrimary, marginBottom: 16 },
  gameOverCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '100%', borderWidth: 3, borderColor: C.textPrimary, marginBottom: 16 },
  gameOverRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  gameOverLabel: { flex: 1, fontSize: 18, fontWeight: '700', color: C.textPrimary, marginLeft: 12 },
  gameOverValue: { fontSize: 22, fontWeight: '900', color: C.textPrimary },

  // Leaderboard
  lbHeader: { paddingTop: 24, paddingBottom: 12, alignItems: 'center' },
  lbTitle: { fontSize: 36, fontWeight: '900', color: C.textPrimary },
  lbEmpty: { textAlign: 'center', color: C.textPrimary, marginTop: 40, fontSize: 16 },
  lbRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 2, borderColor: C.textPrimary },
  lbRank: { fontSize: 18, fontWeight: '900', color: C.danger, width: 50 },
  lbName: { flex: 1, fontSize: 16, fontWeight: '700', color: C.textPrimary },
  lbScore: { fontSize: 18, fontWeight: '900', color: C.secondary },
  lbFooter: { padding: 16, alignItems: 'center' },

  // Game
  gameRoot: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  worldViewport: { position: 'absolute', overflow: 'hidden', backgroundColor: C.grass },
  hudTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  hudTopRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: Platform.OS === 'ios' ? 8 : 32, gap: 8, flexWrap: 'wrap' },
  hudPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceOverlay, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: '#fff' },
  hudPillText: { color: C.textPrimary, fontWeight: '800', fontSize: 14 },
  missionBanner: { marginTop: 10, alignSelf: 'center', backgroundColor: '#fff', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 14, borderWidth: 2, borderColor: C.textPrimary, maxWidth: '90%' },
  missionLabel: { fontSize: 10, fontWeight: '900', color: C.danger, letterSpacing: 2, textAlign: 'center' },
  missionText: { fontSize: 14, fontWeight: '800', color: C.textPrimary, textAlign: 'center' },
  missionDist: { fontSize: 11, fontWeight: '700', color: C.secondary, textAlign: 'center', marginTop: 2 },
  vehicleNamePill: { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 80, right: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceOverlay, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16 },
  vehicleNameText: { color: C.textPrimary, fontWeight: '800', fontSize: 12 },
  toast: { position: 'absolute', top: 220, alignSelf: 'center', backgroundColor: C.textPrimary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 16 },
  toastText: { color: '#fff', fontWeight: '900' },

  joystickBase: { position: 'absolute', backgroundColor: C.joystickBase, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  joystickThumb: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 6, elevation: 5 },

  actionsCol: { position: 'absolute', right: 20, bottom: 50, alignItems: 'center' },
  actionBtn: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginVertical: 6, borderBottomWidth: 5 },

  pauseOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  pauseCard: { backgroundColor: '#fff', padding: 24, borderRadius: 20, alignItems: 'center', borderWidth: 3, borderColor: C.textPrimary, minWidth: 280 },
  pauseTitle: { fontSize: 32, fontWeight: '900', color: C.textPrimary, marginBottom: 16 },

  dialogOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  dialogCard: { backgroundColor: '#FFF8E7', borderRadius: 20, padding: 18, borderWidth: 3, borderColor: C.textPrimary, width: '100%', maxWidth: 360, alignItems: 'center' },
  dialogHeader: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginBottom: 12, gap: 10 },
  dialogName: { flex: 1, fontSize: 18, fontWeight: '900', color: C.textPrimary },
  dialogText: { fontSize: 16, color: C.textPrimary, fontStyle: 'italic', textAlign: 'center', marginBottom: 16, lineHeight: 22 },

  tauntCard: { backgroundColor: '#FFF8E7', borderRadius: 16, padding: 14, borderWidth: 3, borderColor: C.textPrimary, width: '100%', alignItems: 'center', marginVertical: 8 },
  tauntTitle: { fontSize: 16, fontWeight: '900', color: C.textPrimary, marginBottom: 2 },
  tauntSub: { fontSize: 12, color: C.textPrimary, opacity: 0.7, marginBottom: 8 },
  tauntText: { fontSize: 14, fontStyle: 'italic', color: C.textPrimary, textAlign: 'center', marginVertical: 6 },
});
