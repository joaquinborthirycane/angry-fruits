import { fruitPowers } from "./fruit-powers.js?v=20261106-5";

const matter = window.Matter;

if (!matter) {
  document.querySelector("#message").textContent = "No cargo Matter.js";
  throw new Error("Matter.js no esta disponible");
}

const {
  Engine,
  Render,
  Runner,
  Bodies,
  Body,
  Composite,
  Constraint,
  Events,
  Mouse,
  MouseConstraint,
  Vector,
} = matter;

function loadDifficulty() {
  const requested = new URLSearchParams(window.location.search).get("modo");
  if (requested === "desafio" || requested === "aventura") return requested;
  try { return window.localStorage.getItem("super-frutas-mode") === "desafio" ? "desafio" : "aventura"; }
  catch { return "aventura"; }
}
const difficulty = loadDifficulty();
const isChallenge = difficulty === "desafio";
document.querySelector("#difficultyIndicator").textContent = isChallenge ? "🔥 Desafío" : "🌻 Aventura";
const FINAL_LEVEL = 81;
const PLAYER_PROFILE_KEY = "super-frutas-player-profile-v1";
const WORLD_CATEGORY = 0x0001;
const LOADED_FRUIT_CATEGORY = 0x0002;
const GAME_SCALE = 0.7;
const MAX_CATAPULT_PULL = 195;
const MAX_CATAPULT_VERTICAL_PULL = 136;
const CATAPULT_HEIGHT = 98;

const scale = (value) => value * GAME_SCALE;
const preserveMassDensity = (density) => density / (GAME_SCALE * GAME_SCALE);

const canvas = document.querySelector("#gameCanvas");
const stage = document.querySelector(".stage-wrap");
const scoreEl = document.querySelector("#score");
const levelEl = document.querySelector("#level");
const livesEl = document.querySelector("#lives");
const messageEl = document.querySelector("#message");
const weatherIndicator = document.querySelector("#weatherIndicator");
const weatherLayer = document.querySelector("#weatherLayer");
const worldIntro = document.querySelector("#worldIntro");
const resetButton = document.querySelector("#resetButton");
const replayButton = document.querySelector("#replayButton");
const fruitCards = [...document.querySelectorAll(".fruit-card")];
const gameOverDialog = document.querySelector("#gameOverDialog");
const homeButton = gameOverDialog.querySelector(".home-button");
const finalScoreEl = document.querySelector("#finalScore");

const fruits = [
  { id: "banana", name: "Banana", emoji: "🍌", color: "#ffe066", radius: scale(28), density: 0.0016 },
  { id: "mandarina", name: "Mandarina", emoji: "🍊", color: "#ff9f1c", radius: scale(25), density: 0.0013 },
  { id: "manzana", name: "Manzana", emoji: "🍎", color: "#ff4d5a", radius: scale(27), density: 0.0015, unlockLevel: 4 },
  { id: "pera", name: "Pera", emoji: "🍐", color: "#9fd356", radius: scale(29), density: 0.0017, unlockLevel: 7 },
  {
    id: "sandia",
    name: "Sandia Furia",
    emoji: "🍉",
    color: "#1fbf75",
    radius: scale(48),
    density: 0.006,
    restitution: 0.24,
    unlockScore: 5000,
  },
  { id: "uvas", name: "Uvas Bomba", emoji: "🍇", color: "#7b3fc5", radius: scale(29), density: 0.002, unlockScore: 10000 },
  {
    id: "melon",
    name: "Melon de Fuego",
    emoji: "🍈",
    color: "#79c94b",
    radius: scale(34),
    density: 0.0024,
    restitution: 0.4,
    requiresKey: true,
  },
  {
    id: "fresa",
    name: "Fresa Inflable",
    emoji: "🍓",
    color: "#ef4056",
    radius: scale(27),
    density: 0.0014,
    restitution: 0.58,
    requiresKeyCount: 3,
  },
  {
    id: "naranja",
    name: "Naranja de Zumo",
    emoji: "🍊",
    color: "#ff861c",
    radius: scale(31),
    density: 0.0018,
    restitution: 0.44,
    requiresKeyCount: 2,
  },
  { id: "limon", name: "Limón Ácido", emoji: "🍋", color: "#e4f542", radius: scale(28), density: 0.0018, requiresKeyCount: 4 },
  { id: "coco", name: "Coco Explosivo", emoji: "🥥", color: "#b67a4e", radius: scale(34), density: 0.004, requiresKeyCount: 5 },
  { id: "arandanos", name: "Arándanos Mini", emoji: "🫐", color: "#6375db", radius: scale(27), density: 0.002, requiresKeyCount: 6 },
  { id: "pina", name: "Piña Lanzahojas", emoji: "🍍", color: "#f5c542", radius: scale(31), density: 0.0025, requiresKeyCount: 7 },
  { id: "cerezas", name: "Cerezas Gemelas", emoji: "🍒", color: "#e9436b", radius: scale(27), density: 0.002, requiresKeyCount: 8 },
  { id: "kiwi", name: "Kiwi Tornado", emoji: "🥝", color: "#93c94e", radius: scale(29), density: 0.0022, requiresKeyCount: 9 },
  { id: "mango", name: "Mango Pegajoso", emoji: "🥭", color: "#ffb536", radius: scale(30), density: 0.0024, requiresKeyCount: 10 },
  { id: "melocoton", name: "Melocotón Saltarín", emoji: "🍑", color: "#ff9c87", radius: scale(28), density: 0.002, restitution: 0.95, requiresKeyCount: 11 },
];

const vegetables = [
  { name: "Brocoli", emoji: "🥦", color: "#31b96e", sizeScale: 1.16, density: 0.0024, toughness: 1.2 },
  { name: "Zanahoria", emoji: "🥕", color: "#ff8c1a", sizeScale: 0.82, density: 0.0017, toughness: 0.82 },
  { name: "Berenjena", emoji: "🍆", color: "#7c4cc2", sizeScale: 1.08, density: 0.0028, toughness: 1.35 },
  { name: "Tomate", emoji: "🍅", color: "#ef3e36", sizeScale: 0.92, density: 0.0015, toughness: 0.75 },
  { name: "Maiz", emoji: "🌽", color: "#ffd447", sizeScale: 1.24, density: 0.0032, toughness: 1.5 },
];

let width = stage.clientWidth;
let height = stage.clientHeight;
let engine;
let render;
let runner;
let sling;
let mouseConstraint;
let currentFruit;
let currentFruitIndex = 0;
let launched = false;
let score = 0;
let lives = isChallenge ? 4 : 6;
let breakParticles = [];
let catapultReady = false;
let vegetablesLeft = 0;
let powerTimers = [];
let currentLevel = 1;
let levelChanging = false;
let levelHasStarted = false;
let levelLaunchCount = 0;
let usedFruitIds = new Set();
let fruitUseCounts = new Map();
let unlockedFruitIds = new Set(["banana", "mandarina"]);
let announcedFruitIds = new Set();
let pearPowerAnnounced = false;
let audioContext;
let lastCollisionSoundAt = 0;
let levelBodies = [];
let plant = null;
let plantMouthOpenUntil = 0;
let plantNextBiteAt = 0;
let structureActivated = false;
let structureActivatedAt = 0;
let gameOver = false;
let currentWeather = { id: "calm", icon: "☀️", name: "Calma", wind: 0 };
let activeTrajectory = [];
let bestTrajectory = [];
let replayStartedAt = 0;
let portals = [];
let portalCooldownUntil = 0;
let cannons = [];
let nextCannonShotAt = 0;
let nextWorldHazardAt = 0;
let levelKey = null;
let keyCollected = false;
let gardenTricks = { fly: null, worm: null, mushrooms: [], peels: [] };
let movingPlatforms = [];
let fruitLinks = [];
let collectedKeyCount = 0;
let pendingFruitChoices = 0;
let keyChoiceOpen = false;
let pauseStartedAt = 0;
let pausedDuration = 0;
const keyChoiceDialog = document.querySelector("#keyChoiceDialog");
const keyChoiceList = document.querySelector("#keyChoiceList");

function gameNow() {
  return (keyChoiceOpen ? pauseStartedAt : performance.now()) - pausedDuration;
}

function persistPlayerProgress() {
  try {
    const profile = {
      unlockedFruits: [...unlockedFruitIds],
      collectedKeyCount,
      pendingFruitChoices,
    };
    window.localStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(profile));
    window.localStorage.setItem("super-frutas-unlocked-fruits", JSON.stringify([...unlockedFruitIds]));
  } catch {
    // The current session remains playable when browser storage is unavailable.
  }
}

const weatherModes = [
  { id: "calm", icon: "☀️", name: "Calma", wind: 0 },
  { id: "windRight", icon: "💨", name: "Viento →", wind: 0.00038 },
  { id: "rain", icon: "🌧️", name: "Lluvia", wind: 0.00006 },
  { id: "windLeft", icon: "💨", name: "Viento ←", wind: -0.00034 },
  { id: "storm", icon: "⛈️", name: "Tormenta", wind: 0 },
  { id: "snow", icon: "❄️", name: "Nieve", wind: 0 },
];

function setLevelWeather(level) {
  currentWeather = weatherModes[(level - 1) % weatherModes.length];
  // Each new world changes the flight without adding extra controls.
  if (level >= 36 && level <= 40) currentWeather = { id: "calm", icon: "🫧", name: "Corrientes suaves", wind: 0.00012 };
  if (level >= 41 && level <= 45) currentWeather = { id: "calm", icon: "🍬", name: "Dulce calma", wind: 0 };
  if (level >= 46 && level <= 50) currentWeather = { id: "windRight", icon: "🌈", name: "Brisa del arcoíris →", wind: 0.00045 };
  if (level >= 51 && level <= 55) currentWeather = { id: "rain", icon: "🌴", name: "Lluvia tropical", wind: 0.0001 };
  if (level >= 56 && level <= 60) currentWeather = { id: "calm", icon: "🎵", name: "Ritmo tranquilo", wind: 0 };
  if (level >= 61 && level <= 65) currentWeather = { id: "snow", icon: "💎", name: "Polvo de cristal", wind: 0 };
  if (level >= 66 && level <= 70) currentWeather = { id: "rain", icon: "🍄", name: "Lluvia de hongos", wind: 0.00006 };
  if (level >= 71 && level <= 75) currentWeather = { id: "calm", icon: "🐸", name: "Bruma del pantano", wind: 0 };
  if (level >= 76 && level <= 80) currentWeather = { id: "calm", icon: "🧃", name: "Fábrica en marcha", wind: 0 };
  if (level === FINAL_LEVEL) currentWeather = { id: "storm", icon: "🥦", name: "¡Verdura Time!", wind: 0 };
  engine.gravity.y = level >= 36 && level <= 40 ? 0.65 : level >= 46 && level <= 50 ? 0.8 : 1.05;
  weatherIndicator.textContent = `${currentWeather.icon} ${currentWeather.name}`;
  weatherLayer.className = `weather-layer weather-${currentWeather.id}`;
  const worldClasses = [
    "world-forest",
    "world-wind",
    "world-desert",
    "world-fortress",
    "world-ice",
    "world-volcano",
    "world-space",
    "world-ocean",
    "world-candy",
    "world-sky",
    "world-jungle",
    "world-music",
    "world-crystal",
    "world-mushroom",
    "world-swamp",
    "world-factory",
    "world-veggie-time",
  ];
  stage.classList.remove(...worldClasses);
  stage.classList.add(worldClasses[Math.min(worldClasses.length - 1, Math.floor((level - 1) / 5))]);
  if ((level - 1) % 5 === 0) {
    const names = ["Bosque Frutal", "Montañas Ventosas", "Desierto Solar", "Fortaleza Brocoli", "Glaciar Crujiente", "Volcan Picante", "Huerta Espacial", "Océano Burbujeante", "Reino de Caramelo", "Islas del Arcoíris", "Selva Tropical", "Valle Musical", "Cuevas de Cristal", "Jardín de Hongos", "Pantano Pegajoso", "Fábrica de Zumos", "Verdura Time"];
    worldIntro.textContent = names[Math.min(names.length - 1, Math.floor((level - 1) / 5))];
    worldIntro.classList.remove("show");
    requestAnimationFrame(() => worldIntro.classList.add("show"));
  }
}

function finishGame({ victory = false } = {}) {
  gameOverDialog.querySelector(".dialog-kicker").textContent = victory ? "Aventura completada" : "Fin de la partida";
  gameOverDialog.querySelector("h2").textContent = victory ? "¡Salvaste el reino frutal! 🏆" : "¡Gran lanzamiento!";
  persistPlayerProgress();
  gameOver = true;
  Runner.stop(runner);
  Render.stop(render);
  resetButton.disabled = true;
  finalScoreEl.textContent = String(score);
  gameOverDialog.showModal();
}

function setMessage(text) {
  messageEl.textContent = text;
  messageEl.classList.remove("pop");
  window.requestAnimationFrame(() => messageEl.classList.add("pop"));
}

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  return audioContext;
}

function playTone({ frequency, duration = 0.12, type = "sine", volume = 0.12, slideTo = null }) {
  const audio = getAudioContext();
  const now = audio.currentTime;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, now + duration);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function playNoise({ duration = 0.14, volume = 0.14, filterFrequency = 600 }) {
  const audio = getAudioContext();
  const sampleCount = Math.max(1, Math.floor(audio.sampleRate * duration));
  const buffer = audio.createBuffer(1, sampleCount, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
  }

  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  source.buffer = buffer;
  filter.type = "lowpass";
  filter.frequency.value = filterFrequency;
  gain.gain.value = volume;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  source.start();
}

function playLaunchSound() {
  playTone({ frequency: 620, slideTo: 210, duration: 0.82, type: "sawtooth", volume: 0.075 });
  playTone({ frequency: 310, slideTo: 540, duration: 0.72, type: "triangle", volume: 0.065 });
}

function playCollisionSound() {
  const now = gameNow();
  if (now - lastCollisionSoundAt < 85) return;
  lastCollisionSoundAt = now;
  playNoise({ duration: 0.07, volume: 0.08, filterFrequency: 900 });
  playTone({ frequency: 120, duration: 0.06, type: "square", volume: 0.04 });
}

function playBreakSound() {
  playNoise({ duration: 0.18, volume: 0.13, filterFrequency: 1200 });
  playTone({ frequency: 620, slideTo: 260, duration: 0.12, type: "triangle", volume: 0.09 });
}

function playLevelSound() {
  [262, 330, 392].forEach((frequency) => {
    playTone({ frequency, duration: 0.12, type: "square", volume: 0.055 });
  });
  [330, 415, 523].forEach((frequency) => {
    window.setTimeout(() => {
      playTone({ frequency, slideTo: frequency * 1.04, duration: 0.32, type: "triangle", volume: 0.08 });
    }, 190);
  });
}

function playKingLaugh() {
  const audio = getAudioContext();
  const start = audio.currentTime;
  // Three descending chuckles, with a quiet echo after each one.
  [145, 118, 92].forEach((frequency, index) => {
    [0, 0.2].forEach((echoDelay, echoIndex) => {
      const at = start + index * 0.43 + echoDelay;
      const duration = 0.32 + index * 0.045;
      const voice = audio.createOscillator();
      const throat = audio.createBiquadFilter();
      const volume = audio.createGain();
      voice.type = "sawtooth";
      voice.frequency.setValueAtTime(frequency, at);
      voice.frequency.exponentialRampToValueAtTime(frequency * 0.58, at + duration);
      throat.type = "bandpass";
      throat.Q.value = 1.2;
      throat.frequency.setValueAtTime(740, at);
      throat.frequency.exponentialRampToValueAtTime(360, at + duration);
      const peak = echoIndex ? 0.025 : 0.085;
      volume.gain.setValueAtTime(0.0001, at);
      volume.gain.exponentialRampToValueAtTime(peak, at + 0.035);
      volume.gain.exponentialRampToValueAtTime(peak * 0.6, at + duration * 0.45);
      volume.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      voice.connect(throat);
      throat.connect(volume);
      volume.connect(audio.destination);
      voice.onended = () => { voice.disconnect(); throat.disconnect(); volume.disconnect(); };
      voice.start(at);
      voice.stop(at + duration + 0.03);
    });
  });

  if ("speechSynthesis" in window) {
    const laugh = new SpeechSynthesisUtterance("¡Jua! ¡Jua! ¡Juaaa!");
    laugh.lang = "es-ES";
    laugh.rate = 0.65;
    laugh.pitch = 0.22;
    laugh.volume = 0.75;
    const villainVoice = window.speechSynthesis.getVoices().find(voice =>
      voice.lang.startsWith("es") && /jorge|diego|carlos/i.test(voice.name));
    if (villainVoice) laugh.voice = villainVoice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(laugh);
  }
}

function setScore(nextScore) {
  score = nextScore;
  scoreEl.textContent = String(score);
  updateUnlocks();
}

function updateLives() {
  livesEl.textContent = "♥".repeat(Math.max(0, lives));
  livesEl.setAttribute("aria-label", `${lives} vidas`);
}

function updateUnlocks() {
  const newlyUnlocked = [];
  fruits.forEach((fruit) => {
    if (fruit.requiresKey || fruit.requiresKeyCount) return;
    const reachedLevel = !fruit.unlockLevel || currentLevel >= fruit.unlockLevel;
    const reachedScore = !fruit.unlockScore || score >= fruit.unlockScore;
    if (reachedLevel && reachedScore && !unlockedFruitIds.has(fruit.id)) {
      unlockedFruitIds.add(fruit.id);
      if (!announcedFruitIds.has(fruit.id)) {
        announcedFruitIds.add(fruit.id);
        newlyUnlocked.push(fruit.name);
      }
    }
  });
  if (hasPearFallPower() && !pearPowerAnnounced) {
    pearPowerAnnounced = true;
    setMessage("¡La pera consiguio el escudo anticaida!");
  }
  updateFruitTray();
  persistPlayerProgress();
  return newlyUnlocked;
}

function isFruitUnlocked(fruit) {
  if (fruit.requiresKey) return unlockedFruitIds.has(fruit.id);
  if (fruit.requiresKeyCount) return unlockedFruitIds.has(fruit.id);
  return (!fruit.unlockLevel && !fruit.unlockScore) || unlockedFruitIds.has(fruit.id);
}

function hasPearFallPower() {
  const pear = fruits.find((fruit) => fruit.id === "pera");
  return unlockedFruitIds.has("pera") && currentLevel >= pear.unlockLevel + 3;
}

function clearPowerTimers() {
  powerTimers.forEach(timer => window.clearTimeout(timer.id));
  powerTimers = [];
}

function schedulePowerTimer(timer) {
  timer.startedAt = gameNow();
  timer.id = window.setTimeout(() => {
    powerTimers = powerTimers.filter(item => item !== timer);
    timer.callback();
  }, timer.remaining);
}

function addPowerTimer(callback, delay) {
  const timer = { callback, remaining: delay, startedAt: gameNow(), id: null };
  powerTimers.push(timer);
  if (!keyChoiceOpen) schedulePowerTimer(timer);
}

function showKeyChoice() {
  if (keyChoiceOpen || !pendingFruitChoices || gameOver) return;
  const locked = fruits.filter(fruit => !isFruitUnlocked(fruit));
  if (!locked.length) {
    const bonus = pendingFruitChoices * 250;
    pendingFruitChoices = 0;
    setScore(score + bonus);
    persistPlayerProgress();
    setMessage(`¡Ya tienes todas las frutas! +${bonus} puntos`);
    return;
  }
  powerTimers.forEach(timer => {
    window.clearTimeout(timer.id);
    timer.remaining = Math.max(0, timer.remaining - (gameNow() - timer.startedAt));
  });
  pauseStartedAt = performance.now();
  keyChoiceOpen = true;
  Runner.stop(runner);
  keyChoiceList.replaceChildren();
  document.querySelector("#keyChoiceCount").textContent = pendingFruitChoices > 1 ? `Tienes ${pendingFruitChoices} elecciones. Elige una fruta cada vez.` : "Una llave, una fruta. ¡Tú eliges!";
  locked.forEach(fruit => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "key-fruit-option";
    const emoji = document.createElement("span");
    emoji.className = "key-fruit-emoji";
    emoji.setAttribute("aria-hidden", "true");
    emoji.textContent = fruit.emoji;
    const name = document.createElement("strong");
    name.textContent = fruit.name;
    const power = document.createElement("span");
    power.textContent = fruitPowers[fruit.id].power;
    button.append(emoji, name, power);
    button.addEventListener("click", () => chooseKeyFruit(fruit.id));
    keyChoiceList.append(button);
  });
  keyChoiceDialog.showModal();
}

function chooseKeyFruit(fruitId) {
  const fruit = fruits.find(item => item.id === fruitId);
  if (!keyChoiceOpen || !pendingFruitChoices || !fruit || isFruitUnlocked(fruit)) return;
  unlockedFruitIds.add(fruitId);
  pendingFruitChoices -= 1;
  persistPlayerProgress();
  keyChoiceDialog.close();
  pausedDuration += performance.now() - pauseStartedAt;
  keyChoiceOpen = false;
  updateFruitTray();
  setMessage(`¡Has elegido ${fruit.name}! Ya puedes usarla`);
  powerTimers.forEach(schedulePowerTimer);
  if (pendingFruitChoices) showKeyChoice();
  if (!keyChoiceOpen && !gameOver) Runner.run(runner, engine);
}

function resizeCanvas() {
  width = stage.clientWidth;
  height = stage.clientHeight;
  canvas.width = width * window.devicePixelRatio;
  canvas.height = height * window.devicePixelRatio;
}

function registerLevelBody(body) {
  if (!levelHasStarted) {
    Body.setStatic(body, true);
  }
  levelBodies.push(body);
  return body;
}

function activateStructure(hitBody, impactVelocity) {
  structureActivated = true;
  structureActivatedAt = gameNow();

  const nearbyBodies = levelBodies
    .filter((body) => Composite.get(engine.world, body.id, "body") && body.isStatic)
    .map((body) => ({ body, distance: Vector.magnitude(Vector.sub(body.position, hitBody.position)) }))
    .filter(({ body, distance }) => body === hitBody || distance < scale(105))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3);

  nearbyBodies.forEach(({ body }) => Body.setStatic(body, false));

  if (hitBody && !hitBody.isStatic && impactVelocity) {
    Body.setVelocity(hitBody, {
      x: impactVelocity.x * 0.52,
      y: impactVelocity.y * 0.52,
    });
  }
}

function makeGround() {
  const launcherRockWidth = scale(Math.min(360, Math.max(250, width * 0.27)));
  const castleRockWidth = scale(Math.min(680, Math.max(390, width * 0.46)));
  const launcherRock = Bodies.trapezoid(getCatapultAnchor().x, height + 10, launcherRockWidth, scale(130), 0.24, {
    isStatic: true,
    label: "ground",
    render: { fillStyle: "#625b59", strokeStyle: "#332f33", lineWidth: 4 },
  });
  const castleRock = Bodies.trapezoid(width * 0.74, height + 10, castleRockWidth, scale(130), 0.2, {
    isStatic: true,
    label: "ground",
    render: { fillStyle: "#625b59", strokeStyle: "#332f33", lineWidth: 4 },
  });
  const leftWall = Bodies.rectangle(-32, height / 2, 64, height, { isStatic: true, render: { visible: false } });
  const rightWall = Bodies.rectangle(width + 32, height / 2, 64, height, { isStatic: true, render: { visible: false } });
  Composite.add(engine.world, [launcherRock, castleRock, leftWall, rightWall]);
}

function makeCatapult() {
  catapultReady = true;
  return getCatapultAnchor();
}

function getCatapultAnchor() {
  return { x: Math.max(225, width * 0.18), y: height - 140 };
}

function makeFruit(anchor, fruitIndex = currentFruitIndex) {
  const fruit = fruits[fruitIndex];
  currentFruitIndex = fruitIndex;
  const core = Bodies.circle(anchor.x, anchor.y, fruit.radius, {
    label: "fruitCore",
    density: preserveMassDensity(fruit.density),
    restitution: fruit.restitution ?? 0.52,
    frictionAir: 0.012,
    render: { fillStyle: fruit.color },
  });
  const grabBox = Bodies.rectangle(anchor.x, anchor.y, 92, 92, {
    label: "fruitGrabBox",
    isSensor: true,
    render: { visible: false },
  });
  const body = Body.create({
    label: "fruit",
    parts: [core, grabBox],
    density: preserveMassDensity(fruit.density),
    restitution: fruit.restitution ?? 0.52,
    frictionAir: 0.012,
  });
  setFruitDraggable(body, true);
  body.game = fruit;
  currentFruit = body;
  sling = Constraint.create({
    pointA: anchor,
    bodyB: currentFruit,
    stiffness: 0.08,
    damping: 0.12,
    render: { strokeStyle: "#5b371f", lineWidth: 7 },
  });
  Composite.add(engine.world, [currentFruit, sling]);
  updateFruitTray();
}

function makeFlyingFruit(x, y, fruit, radius, velocity) {
  const body = Bodies.circle(x, y, radius, {
    label: "fruit",
    density: preserveMassDensity(fruit.density),
    restitution: fruit.restitution ?? 0.52,
    frictionAir: 0.012,
    render: { fillStyle: fruit.color },
  });
  body.game = fruit;
  body.wasLaunched = true;
  Body.setVelocity(body, velocity);
  Composite.add(engine.world, body);
  return body;
}

function makeSeed(x, y, velocity) {
  const body = Bodies.circle(x, y, scale(7), {
    label: "seed",
    density: preserveMassDensity(0.0012),
    restitution: 0.45,
    frictionAir: 0.006,
    render: { fillStyle: "#5c3422" },
  });
  body.game = { name: "Semilla", emoji: "•", color: "#5c3422" };
  Body.setVelocity(body, velocity);
  Composite.add(engine.world, body);
  return body;
}

function makeFireball(x, y, velocity) {
  const body = Bodies.circle(x, y, scale(10), {
    label: "fire",
    density: preserveMassDensity(0.0015),
    restitution: 0.18,
    frictionAir: 0.004,
    render: { visible: false },
  });
  Body.setVelocity(body, velocity);
  Composite.add(engine.world, body);
  addPowerTimer(() => {
    if (Composite.get(engine.world, body.id, "body")) Composite.remove(engine.world, body);
  }, 2200);
  return body;
}

function getFruitBody(body) {
  if (!body) return null;
  if (body.label === "fruit") return body;
  if (body.parent && body.parent.label === "fruit") return body.parent;
  return null;
}

function setFruitDraggable(body, draggable) {
  const category = draggable ? LOADED_FRUIT_CATEGORY : WORLD_CATEGORY;
  const mask = draggable ? WORLD_CATEGORY : 0xffffffff;
  body.parts.forEach((part) => {
    part.collisionFilter.category = category;
    part.collisionFilter.mask = mask;
  });
}

function getVegetableBody(body) {
  if (body.label === "vegetable") return body;
  if (body.parent && body.parent.label === "vegetable") return body.parent;
  return null;
}

function makeVegetable(x, y, veggie, size = 25, options = {}) {
  const actualSize = Math.round(scale(size * veggie.sizeScale));
  const body = Bodies.circle(x, y, actualSize, {
    label: "vegetable",
    density: preserveMassDensity(veggie.density),
    restitution: 0.32,
    friction: 0.85,
    render: { fillStyle: veggie.color },
  });
  const baseHealth = 55 + actualSize * 2.4 + body.mass * 8 * veggie.toughness;
  const maxHealth = Math.round(baseHealth * (options.healthMultiplier || 1) * (isChallenge ? 1.2 : 1));
  body.game = {
    ...veggie,
    ...options,
    broken: false,
    size: actualSize,
    health: maxHealth,
    maxHealth,
    lastDamageAt: 0,
    shieldHits: options.shieldHits || 0,
  };
  vegetablesLeft += 1;
  return registerLevelBody(body);
}

function makeChest(x, y) {
  const body = Bodies.rectangle(x, y, scale(48), scale(38), {
    label: "chest", density: preserveMassDensity(0.004), restitution: 0.18,
    render: { visible: false },
  });
  body.game = { opened: false };
  return registerLevelBody(body);
}

function makeBlock(x, y, w, h) {
  const actualWidth = scale(w);
  const actualHeight = scale(h);
  const body = Bodies.rectangle(x, y, actualWidth, actualHeight, {
    label: "block",
    density: preserveMassDensity(0.006),
    friction: 0.96,
    frictionStatic: 1,
    restitution: 0.06,
    render: { fillStyle: "#8f6f52" },
  });
  const maxHealth = Math.round(80 + Math.sqrt(w * h) * 1.7);
  body.game = { width: actualWidth, height: actualHeight, health: maxHealth, maxHealth };
  return registerLevelBody(body);
}

function makeSteelBlock(x, y, w, h) {
  const actualWidth = scale(w);
  const actualHeight = scale(h);
  const body = Bodies.rectangle(x, y, actualWidth, actualHeight, {
    label: "steelBlock",
    density: preserveMassDensity(0.012),
    friction: 0.92,
    restitution: 0.08,
    render: { fillStyle: "#63717c" },
  });
  body.game = { width: actualWidth, height: actualHeight };
  return registerLevelBody(body);
}

function makeGlassBlock(x, y, w, h) {
  const actualWidth = scale(w);
  const actualHeight = scale(h);
  const body = Bodies.rectangle(x, y, actualWidth, actualHeight, {
    label: "glassBlock",
    density: preserveMassDensity(0.0014),
    friction: 0.72,
    restitution: 0.2,
    render: { fillStyle: "rgba(143, 225, 244, 0.68)", strokeStyle: "#d9f8ff", lineWidth: 3 },
  });
  body.game = { width: actualWidth, height: actualHeight };
  return registerLevelBody(body);
}

function makeIceBlock(x, y, w, h) {
  const body = Bodies.rectangle(x, y, scale(w), scale(h), {
    label: "iceBlock",
    density: preserveMassDensity(0.0018),
    friction: 0.025,
    frictionStatic: 0.03,
    restitution: 0.16,
    render: { visible: false },
  });
  body.game = { width: scale(w), height: scale(h) };
  return registerLevelBody(body);
}

function makeGelBlock(x, y, w, h) {
  const body = Bodies.rectangle(x, y, scale(w), scale(h), {
    label: "gelBlock", density: preserveMassDensity(0.0013), friction: 0.08, restitution: 1.05,
    render: { visible: false },
  });
  body.game = { width: scale(w), height: scale(h) };
  return registerLevelBody(body);
}

function makeTnt(x, y) {
  return makeGlassBlock(x, y, 42, 42);
}

function makePlant() {
  plant = null;
  plantNextBiteAt = 0;
  if (currentLevel <= 4) return;
  const castleLeft = Math.min(...levelBodies.map((body) => body.position.x));
  const minPlantX = getCatapultAnchor().x + scale(190);
  const plantX = Math.max(minPlantX, castleLeft - scale(155));
  plant = Bodies.circle(plantX, height - scale(84), scale(38), {
    isStatic: true,
    isSensor: true,
    label: "plant",
    collisionFilter: { category: WORLD_CATEGORY, mask: 0 },
    render: { visible: false },
  });
  Composite.add(engine.world, plant);
}

function makeCastle() {
  levelBodies = [];
  structureActivated = false;
  structureActivatedAt = 0;
  levelKey = currentLevel >= 8 && currentLevel % 4 === 0 ? { x: width * 0.52, y: height * 0.3 } : null;
  keyCollected = !levelKey;
  makeProgressiveCastle(currentLevel);
  portals = currentLevel >= 6 && currentLevel % 3 === 0
    ? [{ x: width * 0.43, y: height * 0.42 }, { x: width * 0.67, y: height * 0.25 }]
    : [];
  cannons = currentLevel >= 5 && currentLevel % 3 === 2
    ? [{ x: width - scale(105), y: height - scale(112) }]
    : [];
  if (currentLevel >= 76 && currentLevel <= 80) {
    portals = [{ x: width * 0.42, y: height * 0.48 }, { x: width * 0.7, y: height * 0.24 }];
    cannons = [{ x: width - scale(105), y: height - scale(112) }];
  }
  nextCannonShotAt = gameNow() + 1800;
  nextWorldHazardAt = gameNow() + 2600;
  levelKey = currentLevel >= 8 && currentLevel % 4 === 0 ? { x: width * 0.52, y: height * 0.3 } : null;
  keyCollected = !levelKey;
  if (currentLevel >= 11 && currentLevel <= 15) {
    const cactus = Bodies.rectangle(width * 0.55, height - scale(92), scale(28), scale(105), {
      isStatic: true, label: "cactus", restitution: 1.25, friction: 0.05, render: { visible: false },
    });
    Composite.add(engine.world, cactus);
  }
  if (currentLevel >= 36) {
    const obstacle = currentLevel <= 40
      ? makeGlassBlock(width * 0.56, height * 0.54, 24, 100)
      : makeGelBlock(width * 0.55, height * 0.62, 95, 20);
    Body.setStatic(obstacle, true);
    Composite.add(engine.world, obstacle);
  }
  makeMovingPlatforms();
  makeGardenTricks();
  makePlant();
}

function makeGardenTricks() {
  gardenTricks = { fly: null, worm: null, mushrooms: [], peels: [] };
  const now = engine.timing.timestamp;
  if (levelKey) gardenTricks.fly = { x: width * 0.85, y: height * 0.18, home: { ...levelKey }, carrying: false, scared: false };
  if (currentLevel >= 3) gardenTricks.worm = { x: width * 0.75, y: height - scale(76), nextBite: now + 1800, eaten: 0 };
  if (["rain", "storm"].includes(currentWeather.id)) {
    const mushroomSpots = currentLevel >= 66 && currentLevel <= 70 ? [0.38, 0.54, 0.72] : [0.4, 0.64];
    mushroomSpots.forEach(fraction => {
      const mushroom = Bodies.rectangle(width * fraction, height - scale(78), scale(65), scale(18), {
        label: "mushroom", isStatic: true, isSensor: true, restitution: 1.2, render: { visible: false },
      });
      mushroom.sproutedAt = now;
      Composite.add(engine.world, mushroom);
      gardenTricks.mushrooms.push(mushroom);
    });
  }
}

function dropBananaPeel(body) {
  if (!Composite.get(engine.world, body.id, "body") || gardenTricks.peels.length >= 3) return;
  gardenTricks.peels.push({ x: Math.max(width * 0.35, Math.min(width - scale(45), body.position.x)), y: height - scale(68) });
  setMessage("¡Cáscara de banana! Las verduras pueden resbalar");
}

function updateGardenTricks() {
  if (levelChanging || gameOver) return;
  const now = engine.timing.timestamp;
  const bodies = Composite.allBodies(engine.world);
  gardenTricks.mushrooms.forEach(mushroom => { mushroom.isSensor = now - mushroom.sproutedAt < 1200; });
  const fly = gardenTricks.fly;
  if (fly && !fly.scared && !keyCollected && levelHasStarted) {
    const shot = bodies.find(body => ((body.label === "fruit" && body.wasLaunched) || ["seed", "fire"].includes(body.label)) &&
      Math.hypot(body.position.x - fly.x, body.position.y - fly.y) < scale(40) + (body.circleRadius || 0));
    if (shot) {
      fly.scared = true;
      if (fly.carrying) { levelKey.x = fly.x; levelKey.y = Math.min(height * 0.55, fly.y + scale(35)); }
      fly.carrying = false;
      addBreak(fly.x, fly.y, "#fff291", "🪰");
      setMessage("¡Mosca espantada! ¡La llave está a salvo!");
    } else {
      const destination = fly.carrying
        ? { x: width * 0.72 + Math.sin(now / 1200) * width * 0.12, y: height * 0.24 + Math.sin(now / 800) * scale(30) }
        : levelKey;
      const step = Math.min(1, (engine.timing.lastDelta || 16.67) / 1000 * (fly.carrying ? 2 : 0.65));
      fly.x += (destination.x - fly.x) * step;
      fly.y += (destination.y - fly.y) * step;
      if (!fly.carrying && Math.hypot(fly.x - levelKey.x, fly.y - levelKey.y) < scale(20)) {
        fly.carrying = true;
        setMessage("¡La mosca lleva tu llave! ¡Espántala con un frutazo!");
      }
      if (fly.carrying) { levelKey.x = fly.x; levelKey.y = fly.y + scale(20); }
    }
  }
  if (keyCollected && fly) fly.scared = true;
  bodies.filter(body => body.label === "vegetable" && !body.game.broken).forEach(veggie => {
    if (veggie.game.slipUntil && now > veggie.game.slipUntil) {
      veggie.friction = 0.85; veggie.game.slipUntil = 0;
    }
    const index = gardenTricks.peels.findIndex(peel => Math.abs(peel.x - veggie.position.x) < scale(38) && Math.abs(peel.y - veggie.position.y) < scale(55));
    if (index < 0) return;
    const peel = gardenTricks.peels.splice(index, 1)[0];
    activateStructure(veggie, { x: 6, y: -2 });
    veggie.friction = 0.01;
    veggie.game.slipUntil = now + 2400;
    Body.setVelocity(veggie, { x: veggie.position.x > peel.x ? 7 : -7, y: -2.5 });
    Body.setAngularVelocity(veggie, 0.4);
    addBreak(peel.x, peel.y, "#ffe36c", "🍌");
    setMessage("¡Ups! ¡Verdura resbalando!");
  });
  const worm = gardenTricks.worm;
  if (!worm || !structureActivated || worm.eaten >= 3) return;
  let target = bodies.find(body => body.id === worm.targetId && body.label === "block");
  if (!target) {
    target = bodies.filter(body => body.label === "block" && body.game.height > body.game.width)
      .sort((a, b) => Math.abs(a.position.x - worm.x) - Math.abs(b.position.x - worm.x))[0];
    if (!target) return;
    worm.targetId = target.id;
    worm.nextBite = now + 1200;
  }
  const step = Math.min(1, (engine.timing.lastDelta || 16.67) / 300);
  worm.x += (target.position.x - worm.x) * step;
  worm.y += (target.position.y - worm.y) * step;
  if (now < worm.nextBite) return;
  worm.nextBite = now + 1100;
  target.game.health -= 85;
  addBreak(worm.x, worm.y, "#b5e879", "🐛");
  setMessage("¡Ñam! El gusano está comiendo un soporte");
  if (target.game.health <= 0) { breakBuildingBlock(target); worm.eaten += 1; worm.targetId = null; }
}

function drawGardenTricks(ctx) {
  const now = engine.timing.timestamp;
  ctx.save();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  gardenTricks.mushrooms.forEach(mushroom => {
    const growth = Math.min(1, Math.max(0.1, (now - mushroom.sproutedAt) / 1200));
    ctx.font = `${scale(58) * growth}px serif`;
    ctx.fillText("🍄", mushroom.position.x, mushroom.position.y + scale(2));
  });
  ctx.font = `${scale(34)}px serif`;
  gardenTricks.peels.forEach(peel => {
    ctx.save(); ctx.translate(peel.x, peel.y); ctx.rotate(-0.35); ctx.scale(1.2, 0.6); ctx.fillText("🍌", 0, 0); ctx.restore();
  });
  const fly = gardenTricks.fly;
  if (fly && !fly.scared && !keyCollected) {
    ctx.save(); ctx.translate(fly.x, fly.y); ctx.rotate(Math.sin(now / 50) * 0.12); ctx.fillText("🪰", 0, 0); ctx.restore();
  }
  const worm = gardenTricks.worm;
  if (worm && worm.eaten < 3) { ctx.fillText("🐛", worm.x, worm.y + Math.sin(now / 150) * 3); }
  ctx.restore();
}

function makeMovingPlatforms() {
  movingPlatforms = [];
  if (currentLevel < (isChallenge ? 3 : 4)) return;
  const count = (isChallenge && currentLevel >= 10) || (currentLevel >= 76 && currentLevel <= 80) ? 2 : 1;
  for (let i = 0; i < count; i += 1) {
    const x = width * (0.58 + i * 0.22);
    const y = height * (0.32 + i * 0.13);
    const platform = Bodies.rectangle(x, y, scale(105), scale(16), {
      label: "movingPlatform", isStatic: true, friction: 1, render: { visible: false },
    });
    const rider = makeVegetable(x, y - scale(29), vegetables[1], 21, {
      healthMultiplier: 0.65, helmetHits: isChallenge ? 1 : 0,
    });
    Composite.add(engine.world, [platform, rider]);
    movingPlatforms.push({ platform, rider, originX: x, originY: y, phase: i * Math.PI });
  }
}

function updateMovingPlatforms() {
  const time = engine.timing.timestamp / (isChallenge ? 850 : 1500);
  movingPlatforms.forEach(item => {
    const x = item.originX + Math.sin(time + item.phase) * Math.min(scale(isChallenge ? 85 : 50), width * 0.07);
    Body.setPosition(item.platform, { x, y: item.originY }, true);
    if (item.rider.isStatic && !item.rider.game.broken) {
      Body.setPosition(item.rider, { x, y: item.originY - scale(29) });
    }
  });
}

function bossIsProtected(body) {
  if (!body.game.isKing) return false;
  const cycle = isChallenge ? 4000 : 5200;
  const protectedTime = isChallenge ? 2200 : 1500;
  return engine.timing.timestamp % cycle < protectedTime;
}

function makeProgressiveCastle(level) {
  vegetablesLeft = 0;
  const floorY = height - scale(64);
  const moduleCount = Math.min(4, 1 + Math.floor((level - 1) / 2));
  const regularCount = Math.min(11, level + 1);
  const hasKing = level % 5 === 0 || level === FINAL_LEVEL;
  const castleWidth = Math.min(610, width * 0.48);
  const moduleGap = castleWidth / moduleCount;
  const moduleWidth = Math.min(126, moduleGap - 14);
  const startX = width - Math.max(92, width * 0.055) - castleWidth + moduleGap / 2;
  const bodies = [];
  const slots = [];

  for (let moduleIndex = 0; moduleIndex < moduleCount; moduleIndex += 1) {
    const x = startX + moduleIndex * moduleGap;
    const hasUpperFloor = level >= 2 + moduleIndex;
    bodies.push(makeBlock(x - scale(moduleWidth * 0.34), floorY - scale(31), 22, 64));
    bodies.push(makeBlock(x + scale(moduleWidth * 0.34), floorY - scale(31), 22, 64));
    bodies.push(makeBlock(x, floorY - scale(70), moduleWidth, 20));
    slots.push({ x, y: floorY - scale(31), moduleIndex });
    slots.push({ x, y: floorY - scale(106), moduleIndex });

    if (hasUpperFloor) {
      bodies.push(makeBlock(x - scale(moduleWidth * 0.27), floorY - scale(112), 20, 64));
      bodies.push(makeBlock(x + scale(moduleWidth * 0.27), floorY - scale(112), 20, 64));
      const roof = (level >= 61 && level <= 65)
        ? makeGlassBlock
        : (level >= 56 && level <= 60)
        ? makeGelBlock
        : level >= 41 && level <= 45
        ? makeGelBlock
        : level >= 7 && (moduleIndex + level) % 5 === 0
        ? makeGelBlock
        : level >= 4 && (moduleIndex + level) % 4 === 0
        ? makeIceBlock
        : level >= 3 && (moduleIndex + level) % 3 === 0 ? makeGlassBlock : makeBlock;
      bodies.push(roof(x, floorY - scale(151), moduleWidth * 0.86, 18));
      slots.push({ x, y: floorY - scale(186), moduleIndex });
    }
  }

  if (hasKing) {
    const kingX = startX + (moduleCount - 1) * moduleGap;
    const kingSlot = slots.find((slot) => slot.moduleIndex === moduleCount - 1 && slot.y === floorY - scale(31));
    if (kingSlot) slots.splice(slots.indexOf(kingSlot), 1);
    const kingRank = Math.ceil(level / 5);
    const bossCycle = [
      { veggie: vegetables[3], name: "Tomate Titan" },
      { veggie: vegetables[0], name: "Rey Brocoli" },
      { veggie: vegetables[2], name: "Reina Berenjena" },
    ];
    const boss = bossCycle[(kingRank - 1) % bossCycle.length];
    bodies.push(
      makeVegetable(kingX, floorY - scale(31), boss.veggie, 31 + Math.min(8, kingRank), {
        name: level === FINAL_LEVEL ? "Emperador Verdura Time" : boss.name,
        isKing: true,
        kingRank,
        healthMultiplier: 2.2 + kingRank * 0.55,
      }),
    );
  }

  for (let index = 0; index < regularCount; index += 1) {
    const slot = slots[index % slots.length];
    const row = Math.floor(index / slots.length);
    const isEasy = index < Math.ceil(regularCount * 0.58);
    const easyTypes = [vegetables[1], vegetables[3]];
    const strongTypes = [vegetables[0], vegetables[2], vegetables[4]];
    const veggie = isEasy
      ? easyTypes[index % easyTypes.length]
      : strongTypes[Math.min(strongTypes.length - 1, Math.floor((level - 1) / 3) + index) % strongTypes.length];
    const healthMultiplier = isEasy ? 0.38 + Math.min(level, 8) * 0.015 : 0.82 + Math.min(level, 12) * 0.09;
    bodies.push(makeVegetable(slot.x + scale(row * 14), slot.y - scale(row * 8), veggie, isEasy ? 21 : 24, {
      healthMultiplier,
      helmetHits: level >= (isChallenge ? 2 : 3) && index % (isChallenge ? 2 : 4) === 0 ? 1 : 0,
      shieldHits: 0,
      isGhost: level >= 4 && index % 5 === 3,
      isHealer: level >= 6 && index % 6 === 4,
      isNinja: level >= 7 && index % 7 === 5,
      isCaged: Boolean(levelKey) && index === 0,
      nextSpecialAt: 0,
    }));
  }

  if (level >= 2 && level % 2 === 0) bodies.push(makeChest(startX, floorY - scale(205)));

  Composite.add(engine.world, bodies);
}

function addBreak(x, y, color, emoji) {
  for (let i = 0; i < 16; i += 1) {
    breakParticles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 8 - 2,
      life: 54 + Math.random() * 18,
      color,
      emoji: i % 6 === 0 ? emoji : "",
      size: scale(7 + Math.random() * 7),
    });
  }
}

function addPerfectConfetti() {
  const colors = ["#ff4d5a", "#ffd447", "#31b96e", "#39a9ff", "#a45ee5", "#ff8c1a"];
  for (let i = 0; i < 90; i += 1) {
    breakParticles.push({
      x: Math.random() * width,
      y: -20 - Math.random() * height * 0.35,
      vx: (Math.random() - 0.5) * 5,
      vy: 2 + Math.random() * 5,
      life: 95 + Math.random() * 45,
      color: colors[i % colors.length],
      emoji: i % 15 === 0 ? "★" : "",
      size: scale(5 + Math.random() * 6),
    });
  }
}

function collisionEnergy(attacker, target) {
  if (!attacker || !target) return 0;
  const relativeVelocity = Vector.sub(attacker.velocity, target.velocity);
  const relativeSpeed = Vector.magnitude(relativeVelocity);
  const impactMultiplier = ["naranja"].includes(attacker.game?.id) ? 1.8 : 1;
  return 0.5 * attacker.mass * relativeSpeed * relativeSpeed * impactMultiplier;
}

function damageVegetable(body, energy, source = null) {
  if (!body || body.game.broken || energy < 16) return;
  if (body.game.isCaged && !keyCollected) {
    setMessage("¡Primero encuentra la llave!");
    return;
  }
  if (bossIsProtected(body)) {
    if (gameNow() > (body.game.nextProtectionNoticeAt || 0)) {
      body.game.nextProtectionNoticeAt = gameNow() + 900;
      setMessage("¡Jefe protegido! Espera a que desaparezca su burbuja");
    }
    return;
  }
  const now = gameNow();
  if (now - body.game.lastDamageAt < 160) return;
  body.game.lastDamageAt = now;
  if (body.game.helmetHits > 0) {
    body.game.helmetHits -= 1;
    addBreak(body.position.x, body.position.y, "#d4e1eb", "🪖");
    setMessage("¡Casco fuera! ¡Ahora puedes dañar la verdura!");
    return;
  }
  if (body.game.shieldHits > 0) {
    body.game.shieldHits -= 1;
    addBreak(body.position.x, body.position.y, "#7de7ff", "✦");
    setMessage("¡Escudo roto!");
    return;
  }

  let damage = energy / Math.max(0.65, body.game.toughness);
  if (body.game.size >= 29 && !["sandia", "naranja", "coco"].includes(source?.game?.id)) {
    damage = Math.min(damage, body.game.maxHealth * 0.48);
  }
  body.game.health = Math.max(0, body.game.health - damage);
  addBreak(body.position.x, body.position.y, body.game.color, body.game.health <= 0 ? body.game.emoji : "✦");

  if (body.game.health <= 0) {
    breakVegetable(body);
  } else {
    setMessage(`A ${body.game.name} le queda ${Math.ceil((body.game.health / body.game.maxHealth) * 100)}%`);
  }
}

function damageWoodBlock(body, energy, projectile) {
  if (!body || !body.game || energy < 20) return false;
  if (projectile?.label === "seed" && projectile.woodHit) return false;
  const maxWoodBreaks = ["naranja", "coco"].includes(projectile?.game?.id) ? 5 : 2;
  if (projectile?.label === "fruit" && (projectile.woodBlocksBroken || 0) >= maxWoodBreaks) return false;

  body.game.health = Math.max(0, body.game.health - energy * 0.58);
  addBreak(body.position.x, body.position.y, "#9a704d", "▪");

  if (projectile?.label === "seed") projectile.woodHit = true;
  if (body.game.health > 0) {
    setMessage("¡La madera resistio el golpe!");
    return false;
  }

  if (projectile?.label === "fruit") {
    projectile.woodBlocksBroken = (projectile.woodBlocksBroken || 0) + 1;
  }
  breakBuildingBlock(body);
  return true;
}

function breakVegetable(body, fromKingExplosion = false) {
  if (!body || body.game.broken) return;
  const defeatedKing = body.game.isKing;
  body.game.broken = true;
  playBreakSound();
  addBreak(body.position.x, body.position.y, body.game.color, body.game.emoji);
  Composite.remove(engine.world, body);
  vegetablesLeft -= 1;
  setScore(score + 100);

  if (defeatedKing && vegetablesLeft > 0) {
    const remainingVegetables = Composite.allBodies(engine.world).filter(
      (target) => target.label === "vegetable" && !target.game.broken,
    );
    setMessage(`¡Cayo ${body.game.name}! ¡Explosion total!`);
    remainingVegetables.forEach((target, index) => {
      addPowerTimer(() => {
        if (!target.game.broken) {
          addBreak(target.position.x, target.position.y, "#ffd447", "💥");
          breakVegetable(target, true);
        }
      }, 100 + index * 110);
    });
    return;
  }

  if (vegetablesLeft <= 0) {
    finishLevel();
  } else if (!fromKingExplosion) {
    setMessage("¡Verdura rota!");
  }
}

function breakSteel(body) {
  if (!body || !Composite.get(engine.world, body.id, "body")) return;
  addBreak(body.position.x, body.position.y, "#b9c4cc", "💥");
  playBreakSound();
  Composite.remove(engine.world, body);
  setScore(score + 50);
  setMessage("¡La sandia rompio el acero!");
}

function breakBuildingBlock(body) {
  if (!body || !Composite.get(engine.world, body.id, "body")) return;
  const isGlass = body.label === "glassBlock";
  const isIce = body.label === "iceBlock";
  addBreak(body.position.x, body.position.y, isGlass || isIce ? "#b9f2ff" : "#9a704d", isGlass || isIce ? "✦" : "▪");
  playBreakSound();
  Composite.remove(engine.world, body);
  setScore(score + (isGlass || isIce ? 35 : 20));
  setMessage(isIce ? "¡Hielo roto!" : isGlass ? "¡Cristal roto!" : "¡Madera rota!");
}

function openChest(body) {
  if (!body || body.game.opened) return;
  body.game.opened = true;
  Composite.remove(engine.world, body);
  const reward = 150 + Math.floor(Math.random() * 201);
  setScore(score + reward);
  setMessage(`¡Cofre: ${reward} puntos!`);
  addBreak(body.position.x, body.position.y, "#ffd447", "★");
}

function explodeTnt(body) {
  if (!body || body.game.exploded) return;
  body.game.exploded = true;
  playBreakSound();
  const blastX = body.position.x;
  const blastY = body.position.y;
  addBreak(blastX, blastY, "#ff4d2e", "💥");
  Composite.remove(engine.world, body);
  setMessage("¡TNT!");

  Composite.allBodies(engine.world).forEach((target) => {
    if (target === body || target.isStatic) return;
    const distance = Vector.magnitude(Vector.sub(target.position, { x: blastX, y: blastY }));
    if (distance > 145) return;

    const force = distance < 1 ? { x: 0, y: -1 } : Vector.normalise(Vector.sub(target.position, { x: blastX, y: blastY }));
    Body.applyForce(target, target.position, {
      x: force.x * 0.055,
      y: force.y * 0.055 - 0.018,
    });

    if (target.label === "vegetable") {
      damageVegetable(target, Math.max(30, (1 - distance / 145) * 320), body);
    } else if (target.label === "tnt") {
      damageTnt(target, 2);
    }
  });
}

function damageTnt(body, damage = 1) {
  if (!body || body.label !== "tnt" || body.game.exploded) return;
  body.game.hp -= damage;
  addBreak(body.position.x, body.position.y, "#ffde59", "✦");
  if (body.game.hp <= 0) {
    explodeTnt(body);
  } else {
    setMessage("¡TNT golpeado!");
  }
}

function checkFallenVegetables() {
  if (!levelHasStarted || !structureActivated || levelChanging) return;
  if (gameNow() - structureActivatedAt < 650) return;

  Composite.allBodies(engine.world).forEach((body) => {
    if (body.label === "tnt" && !body.game.exploded) {
      const tntHitGround = body.position.y > height - scale(82) && body.speed > 1.8;
      const tntFlyingFast = body.speed > 5.5;
      if (tntHitGround || tntFlyingFast) {
        damageTnt(body, 2);
      }
      return;
    }

    if (body.label !== "vegetable" || body.game.broken) return;

    const hitGroundHard = body.position.y > height - scale(82) && body.speed > 2.2;
    const flyingFast = body.speed > 8.5;
    if (hitGroundHard || flyingFast) {
      damageVegetable(body, 0.5 * body.mass * body.speed * body.speed * 0.75);
    }
  });
}

function removeStoppedFruits() {
  if (!levelHasStarted || levelChanging) return;
  const now = gameNow();

  Composite.allBodies(engine.world).forEach((body) => {
    if (body.label !== "fruit" || !body.wasLaunched) return;
    if (body.position.y > height + 90 || body.position.x < -120 || body.position.x > width + 120) {
      Composite.remove(engine.world, body);
      return;
    }

    const isStill = body.speed < 0.28 && Math.abs(body.angularVelocity) < 0.08;
    if (!isStill) {
      body.restStartedAt = null;
      return;
    }
    if (!body.restStartedAt) body.restStartedAt = now;
    if (now - body.restStartedAt >= 3000) {
      addBreak(body.position.x, body.position.y, body.game.color, "✦");
      Composite.remove(engine.world, body);
    }
  });
}

function clearFruitLinks() {
  fruitLinks.forEach(link => Composite.remove(engine.world, link.constraint));
  fruitLinks = [];
}

function updateFruitLinks() {
  fruitLinks = fruitLinks.filter(link => {
    const { bodyA, bodyB } = link.constraint;
    if (!Composite.get(engine.world, bodyA.id, "body") || !Composite.get(engine.world, bodyB.id, "body")) {
      Composite.remove(engine.world, link.constraint);
      return false;
    }
    if (link.rope) {
      const a = bodyA.position, b = bodyB.position;
      const dx = b.x - a.x, dy = b.y - a.y;
      const lengthSquared = dx * dx + dy * dy;
      Composite.allBodies(engine.world).forEach(target => {
        if (target.label !== "vegetable" || link.hits.has(target.id) || target.game.broken) return;
        const t = Math.max(0, Math.min(1, lengthSquared ? ((target.position.x - a.x) * dx + (target.position.y - a.y) * dy) / lengthSquared : 0));
        if (Math.hypot(target.position.x - a.x - t * dx, target.position.y - a.y - t * dy) > scale(28)) return;
        link.hits.add(target.id);
        activateStructure(target, bodyA.velocity);
        Body.setVelocity(target, { x: bodyA.velocity.x * 0.7 + 2, y: -5 });
        damageVegetable(target, 95, bodyA);
      });
    }
    return true;
  });
}

function stickMango(body, hitBody) {
  if (body.mangoUsed) return;
  body.mangoUsed = true;
  const nearby = Composite.allBodies(engine.world).filter(target =>
    ["vegetable", "block", "glassBlock", "iceBlock", "gelBlock"].includes(target.label) &&
    Vector.magnitude(Vector.sub(target.position, hitBody.position)) < scale(160));
  const veggies = nearby.filter(target => target.label === "vegetable").slice(0, 3);
  const blocks = nearby.filter(target => target.label !== "vegetable");
  veggies.forEach(veggie => {
    const block = blocks.slice().sort((a, b) => Vector.magnitude(Vector.sub(a.position, veggie.position)) - Vector.magnitude(Vector.sub(b.position, veggie.position)))[0];
    if (!block) return;
    const glue = Constraint.create({ bodyA: veggie, bodyB: block, stiffness: 0.85, damping: 0.15,
      render: { visible: true, strokeStyle: "#ffbd36", lineWidth: 6 } });
    Composite.add(engine.world, glue);
    fruitLinks.push({ constraint: glue });
    addBreak(veggie.position.x, veggie.position.y, "#ffbd36", "🥭");
  });
  setMessage("¡Mango pegajoso! ¡Verduras pegadas a los bloques!");
}

function growPeach(body) {
  const now = gameNow();
  if ((body.peachBounces || 0) >= 4 || now < (body.nextPeachBounceAt || 0)) return;
  body.nextPeachBounceAt = now + 250;
  body.peachBounces = (body.peachBounces || 0) + 1;
  Body.scale(body, 1.18, 1.18);
  body.game = { ...body.game, radius: body.game.radius * 1.18 };
  Body.setVelocity(body, { x: Math.max(5, body.velocity.x), y: -7 - body.peachBounces });
  addBreak(body.position.x, body.position.y, "#ffb5a0", "🍑");
  setMessage(`¡Rebote ${body.peachBounces}! ¡Más grande y fuerte!`);
}

function applySpecialFruitPhysics() {
  updateGardenTricks();
  updateMovingPlatforms();
  updateFruitLinks();
  const stormPhase = gameNow() / 620;
  Composite.allBodies(engine.world).forEach((body) => {
    if (body.label !== "fruit" || !body.wasLaunched) return;

    if (body.tornadoUntil > gameNow()) {
      Composite.allBodies(engine.world).forEach(target => {
        if (!["vegetable", "block", "glassBlock", "iceBlock", "gelBlock"].includes(target.label)) return;
        const offset = Vector.sub(target.position, body.position);
        const distance = Vector.magnitude(offset);
        if (distance > scale(185)) return;
        activateStructure(target, body.velocity);
        if (target.isStatic) return;
        Body.applyForce(target, target.position, {
          x: target.mass * (-offset.y * 0.00002 - offset.x * 0.000006),
          y: target.mass * (offset.x * 0.000008 - 0.0018),
        });
      });
    }
    if (currentLevel >= 71 && currentLevel <= 75 && body.position.y > height - scale(155) && body.position.x > width * 0.4) {
      Body.applyForce(body, body.position, { x: -body.mass * body.velocity.x * 0.00012, y: 0 });
    }
    if (currentWeather.wind) {
      Body.applyForce(body, body.position, { x: body.mass * currentWeather.wind, y: 0 });
    }
    if (currentWeather.id === "rain") {
      Body.applyForce(body, body.position, {
        x: -body.mass * body.velocity.x * 0.000012,
        y: body.mass * 0.00013,
      });
    }
    if (currentWeather.id === "storm") {
      Body.applyForce(body, body.position, {
        x: body.mass * Math.sin(stormPhase) * 0.00048,
        y: body.mass * (0.00007 + Math.cos(stormPhase * 0.7) * 0.00012),
      });
    }
    if (currentWeather.id === "snow") {
      Body.applyForce(body, body.position, {
        x: -body.mass * body.velocity.x * 0.000018,
        y: -body.mass * body.velocity.y * 0.000006,
      });
    }

    if (portals.length === 2 && gameNow() > portalCooldownUntil) {
      const entranceIndex = portals.findIndex((portal) => Vector.magnitude(Vector.sub(body.position, portal)) < scale(48));
      if (entranceIndex >= 0) {
        const exit = portals[1 - entranceIndex];
        portalCooldownUntil = gameNow() + 900;
        Body.setPosition(body, { x: exit.x + scale(48), y: exit.y });
        Body.setVelocity(body, { x: Math.max(8, body.velocity.x), y: body.velocity.y - 1 });
        addBreak(exit.x, exit.y, "#6df3ff", "✦");
        setMessage("¡Portal frutal!");
      }
    }

    const hasFallRescue = (body.game.id === "pera" && hasPearFallPower());
    if (hasFallRescue && body.position.y > height - 24) {
      Body.setPosition(body, {
        x: Math.max(getCatapultAnchor().x + 80, Math.min(width - 80, body.position.x)),
        y: height - 105,
      });
      Body.setVelocity(body, {
        x: Math.max(7, Math.abs(body.velocity.x)),
        y: -11,
      });
      Body.setAngularVelocity(body, 0.2);
      if (!body.pearRescueShown) {
        body.pearRescueShown = true;
        addBreak(body.position.x, body.position.y, body.game.color, "↑");
        setMessage("¡La pera es inmune a las caidas!");
      }
    }
  });
  eatFruitNearPlant();
  updateEnemyHazards();
}

function updateEnemyHazards() {
  const now = gameNow();
  Composite.allBodies(engine.world).forEach((body) => {
    if (body.label !== "vegetable" || body.game.broken) return;
    if (body.game.isGhost) {
      const hidden = Math.sin(now / 650 + body.id) > 0.2;
      body.game.ghostHidden = hidden;
      body.collisionFilter.mask = hidden ? 0 : 0xffffffff;
    }
    if (body.game.isHealer && now > body.game.nextSpecialAt) {
      body.game.nextSpecialAt = now + 2200;
      Composite.allBodies(engine.world).filter((target) => target.label === "vegetable" && !target.game.broken).forEach((target) => {
        if (Vector.magnitude(Vector.sub(target.position, body.position)) < scale(180)) {
          target.game.health = Math.min(target.game.maxHealth, target.game.health + target.game.maxHealth * 0.1);
        }
      });
      addBreak(body.position.x, body.position.y, "#7dff9a", "+");
    }
    if (body.game.isNinja && currentFruit?.wasLaunched && now > body.game.nextSpecialAt && Vector.magnitude(Vector.sub(body.position, currentFruit.position)) < scale(150)) {
      body.game.nextSpecialAt = now + 2600;
      Body.setPosition(body, { x: Math.min(width - 60, body.position.x + scale(90)), y: body.position.y - scale(30) });
      setMessage("¡Verdura ninja!");
    }
  });
  const keyFruit = levelKey && !keyCollected
    ? Composite.allBodies(engine.world).find(
      (body) => body.label === "fruit" && body.wasLaunched && Vector.magnitude(Vector.sub(body.position, levelKey)) < scale(45),
    )
    : null;
  if (keyFruit) {
    keyCollected = true;
    collectedKeyCount += 1;
    pendingFruitChoices += 1;
    persistPlayerProgress();
    setMessage("¡Llave encontrada! ¡Elige una fruta nueva!");
    showKeyChoice();
    addBreak(levelKey.x, levelKey.y, "#ffd447", "★");
  }
  if (launched && now > nextWorldHazardAt) {
    const isIceWorld = currentLevel >= 21 && currentLevel <= 25;
    const isSpaceWorld = currentLevel >= 31 && currentLevel <= 35;
    if (isIceWorld || isSpaceWorld) {
      nextWorldHazardAt = now + (isSpaceWorld ? 2400 : 3300);
      const hazard = Bodies.circle(width * (0.52 + Math.random() * 0.4), -30, scale(isSpaceWorld ? 18 : 28), {
        label: isSpaceWorld ? "meteor" : "snowball", density: preserveMassDensity(0.008), restitution: 0.35,
        render: { visible: false },
      });
      Body.setVelocity(hazard, { x: -2 - Math.random() * 3, y: 5 });
      Composite.add(engine.world, hazard);
    }
  }
  if (!launched || now < nextCannonShotAt || !currentFruit?.wasLaunched) return;
  nextCannonShotAt = now + 2800;
  cannons.forEach((cannon) => {
    const ball = Bodies.circle(cannon.x, cannon.y, scale(11), {
      label: "cannonBall", density: preserveMassDensity(0.006), restitution: 0.65,
      render: { visible: false },
    });
    const direction = Vector.normalise(Vector.sub(currentFruit.position, cannon));
    Body.setVelocity(ball, { x: direction.x * 8, y: direction.y * 8 - 2 });
    Composite.add(engine.world, ball);
    playCollisionSound();
  });
}

function clearLevelBodies({ clearTimers = true } = {}) {
  clearFruitLinks();
  movingPlatforms = [];
  gardenTricks = { fly: null, worm: null, mushrooms: [], peels: [] };
  Composite.allBodies(engine.world).forEach((body) => {
    if (["block", "glassBlock", "iceBlock", "gelBlock", "steelBlock", "vegetable", "fruit", "seed", "fire", "tnt", "plant", "cannonBall", "meteor", "snowball", "cactus", "movingPlatform", "chest", "mushroom"].includes(body.label)) {
      Composite.remove(engine.world, body);
    }
  });
  if (sling) {
    Composite.remove(engine.world, sling);
    sling = null;
  }
  currentFruit = null;
  plant = null;
  cannons = [];
  levelKey = null;
  levelBodies = [];
  structureActivated = false;
  structureActivatedAt = 0;
  if (clearTimers) clearPowerTimers();
}

function finishLevel() {
  if (levelChanging) return;
  levelChanging = true;
  clearPowerTimers();
  if (levelLaunchCount === 1) {
    const bonus = 300 + currentLevel * 100;
    setScore(score + bonus);
    addPerfectConfetti();
    setMessage(`¡Limpieza perfecta! +${bonus} puntos`);
  } else {
    setMessage(`¡Nivel ${currentLevel} completado!`);
  }
  if (currentLevel === FINAL_LEVEL) {
    playLevelSound();
    addPerfectConfetti();
    setMessage("¡Verdura Time completado! ¡Salvaste el reino frutal!");
    addPowerTimer(() => finishGame({ victory: true }), 1800);
    return;
  }
  const nextLevel = currentLevel + 1;
  playLevelSound();
  addPowerTimer(() => {
    currentLevel = nextLevel;
    try {
      const highestLevel = Number(window.localStorage.getItem("super-frutas-highest-level")) || 1;
      window.localStorage.setItem("super-frutas-highest-level", String(Math.max(highestLevel, currentLevel)));
    } catch {
      // Progress remains available for the current game when storage is unavailable.
    }
    setLevelWeather(currentLevel);
    levelEl.textContent = String(currentLevel);
    currentFruitIndex = 0;
    usedFruitIds = new Set();
    fruitUseCounts = new Map();
    levelHasStarted = false;
    levelLaunchCount = 0;
    launched = false;
    breakParticles = [];
    clearLevelBodies({ clearTimers: false });
    makeCastle();
    levelChanging = false;
    const newlyUnlocked = updateUnlocks();
    makeFruit(getCatapultAnchor(), 0);
    updateFruitTray();
    if (currentLevel % 5 === 0 || currentLevel === FINAL_LEVEL) {
      setMessage("¡Un jefe protege este nivel!");
      playKingLaugh();
    } else if (newlyUnlocked.length) {
      setMessage(`¡Nueva fruta: ${newlyUnlocked.join(" y ")}!`);
    } else {
      setMessage(`Nivel ${currentLevel}: mas verduras`);
    }
  }, 1300);
}

function activatePower(fruitBody) {
  if (!fruitBody || !fruitBody.game) return;

  if (fruitBody.game.id === "melocoton") fruitBody.restitution = 0.95;

  if (fruitBody.game.id === "cerezas") {
    addPowerTimer(() => {
      if (!Composite.get(engine.world, fruitBody.id, "body")) return;
      const twins = [-1, 1].map(side => makeFlyingFruit(
        fruitBody.position.x, fruitBody.position.y + side * scale(24),
        { ...fruitBody.game, id: "cerezaGemela", emoji: "🍒", radius: scale(16) }, scale(16),
        { x: fruitBody.velocity.x + 3, y: fruitBody.velocity.y + side * 4 },
      ));
      Composite.remove(engine.world, fruitBody);
      const rope = Constraint.create({ bodyA: twins[0], bodyB: twins[1], length: scale(110), stiffness: 0.08,
        render: { visible: true, strokeStyle: "#6bbf58", lineWidth: 4 } });
      Composite.add(engine.world, rope);
      fruitLinks.push({ constraint: rope, hits: new Set(), rope: true });
      setMessage("¡Cerezas gemelas! ¡Cuidado con la cuerda!");
    }, 240);
  }
  if (fruitBody.game.id === "kiwi") {
    fruitBody.tornadoUntil = gameNow() + 1900;
    setMessage("¡Tornado de kiwi!");
  }

  if (fruitBody.game.id === "pina") {
    for (let i = 0; i < 8; i += 1) {
      addPowerTimer(() => {
        if (!Composite.get(engine.world, fruitBody.id, "body")) return;
        const leaf = makeFireball(fruitBody.position.x + scale(22), fruitBody.position.y, {
          x: Math.max(13, fruitBody.velocity.x + 10),
          y: fruitBody.velocity.y * 0.3 + ((i % 4) - 1.5) * 1.8,
        });
        leaf.isLeaf = true;
        Body.setAngularVelocity(leaf, 0.35);
        addBreak(leaf.position.x, leaf.position.y, "#78db65", "🍃");
        setMessage("¡Ráfaga de hojas giratorias!");
      }, 160 + i * 95);
    }
  }

  if (fruitBody.game.id === "arandanos") {
    addPowerTimer(() => {
      if (!Composite.get(engine.world, fruitBody.id, "body")) return;
      const origin = { ...fruitBody.position };
      const base = { ...fruitBody.velocity };
      Composite.remove(engine.world, fruitBody);
      const group = Body.nextGroup(true);
      for (let i = 0; i < 24; i += 1) {
        const angle = -0.8 + (i % 12) * (1.6 / 11);
        const speed = 9 + Math.floor(i / 12) * 3;
        const radius = scale(5);
        const mini = makeFlyingFruit(origin.x, origin.y, {
          ...fruitBody.game, id: "miniArandano", name: "Miniarándano", radius,
          density: 0.004, restitution: 0.65,
        }, radius, {
          x: base.x * 0.7 + Math.cos(angle) * speed,
          y: base.y * 0.7 + Math.sin(angle) * speed,
        });
        mini.collisionFilter.group = group;
        addPowerTimer(() => {
          if (Composite.get(engine.world, mini.id, "body")) Composite.remove(engine.world, mini);
        }, 4500);
      }
      addBreak(origin.x, origin.y, "#899bff", "🫐");
      setMessage("¡Lluvia de 24 mini arándanos!");
    }, 300);
  }

  if (fruitBody.game.id === "limon") {
    for (let i = 0; i < 6; i += 1) {
      addPowerTimer(() => {
        if (!Composite.get(engine.world, fruitBody.id, "body")) return;
        const acid = makeFireball(fruitBody.position.x + scale(20), fruitBody.position.y, {
          x: Math.max(12, fruitBody.velocity.x + 9),
          y: fruitBody.velocity.y * 0.25 + (i - 2.5) * 0.6,
        });
        acid.isAcid = true;
        addBreak(acid.position.x, acid.position.y, "#caff46", "💧");
        setMessage("¡Lluvia de ácido de limón!");
      }, 120 + i * 140);
    }
  }
  if (fruitBody.game.id === "coco") {
    fruitBody.coconutArmed = true;
    addPowerTimer(() => explodeJuice(fruitBody), 1500);
  }

  if (fruitBody.game.id === "fresa") {
    addPowerTimer(() => {
      if (!Composite.get(engine.world, fruitBody.id, "body") || fruitBody.inflated) return;
      fruitBody.inflated = true;
      Body.scale(fruitBody, 1.75, 1.75);
      fruitBody.game = { ...fruitBody.game, radius: fruitBody.game.radius * 1.75 };
      Body.setVelocity(fruitBody, {
        x: fruitBody.velocity.x * 1.08,
        y: fruitBody.velocity.y - 1.4,
      });
      addBreak(fruitBody.position.x, fruitBody.position.y, "#ff6f8a", "¡PLOP!");
      setMessage("¡La fresa se inflo!");
    }, 80);
  }

  if (fruitBody.game.id === "naranja") {
    addPowerTimer(() => {
      if (!Composite.get(engine.world, fruitBody.id, "body")) return;
      fruitBody.juiceMode = true;
      fruitBody.game = { ...fruitBody.game, emoji: "🧃" };
      addBreak(fruitBody.position.x, fruitBody.position.y, "#ffad2f", "💦");
      setMessage("¡La naranja se convirtio en zumo!");
    }, 360);
    addPowerTimer(() => explodeJuice(fruitBody), 1050);
  }

  if (fruitBody.game.id === "melon") {
    for (let i = 0; i < 5; i += 1) {
      addPowerTimer(() => {
        if (!Composite.get(engine.world, fruitBody.id, "body")) return;
        const fire = makeFireball(fruitBody.position.x + scale(18), fruitBody.position.y, {
          x: Math.max(10, fruitBody.velocity.x + 7 + i * 0.7),
          y: fruitBody.velocity.y * 0.35 + (i - 2) * 0.8,
        });
        addBreak(fire.position.x, fire.position.y, "#ff7a24", "🔥");
      }, 180 + i * 130);
    }
    setMessage("¡Melon de Fuego!");
  }

  if (fruitBody.game.id === "pera") {
    addPowerTimer(() => {
      if (!Composite.get(engine.world, fruitBody.id, "body")) return;
      Body.setVelocity(fruitBody, {
        x: fruitBody.velocity.x * 1.8 + 3,
        y: fruitBody.velocity.y * 1.35 - 1.2,
      });
      Body.setAngularVelocity(fruitBody, 0.42);
      addBreak(fruitBody.position.x, fruitBody.position.y, "#b7ef5d", "⚡");
      setMessage("¡Pera turbo!");
    }, 220);
  }

  if (fruitBody.game.id === "banana") addPowerTimer(() => dropBananaPeel(fruitBody), 650);

  if (fruitBody.game.id === "banana") {
    fruitBody.boomerangReadyAt = gameNow() + 260;
    fruitBody.boomerangUsed = false;
    setMessage("Haz click para activar el bumeran");
  }

  if (fruitBody.game.id === "mandarina") {
    addPowerTimer(() => {
      if (!Composite.get(engine.world, fruitBody.id, "body")) return;
      const { x, y } = fruitBody.position;
      const base = { x: fruitBody.velocity.x, y: fruitBody.velocity.y };
      Composite.remove(engine.world, fruitBody);
      addBreak(x, y, "#ffb02e", "🍊");

      const fragmentCount = 5;
      for (let i = 0; i < fragmentCount; i += 1) {
        const angle = -0.72 + i * (1.44 / Math.max(1, fragmentCount - 1));
        const speed = 5.8 + Math.abs(base.x) * 0.38;
        const fragmentGame = fruitBody.game;
        const gajo = makeFlyingFruit(x, y, fragmentGame, scale(13), {
          x: base.x * 0.72 + Math.cos(angle) * speed,
          y: base.y * 0.72 + Math.sin(angle) * speed,
        });
        Body.setAngularVelocity(gajo, (i - 2) * 0.18);
      }
      setMessage(`¡${fragmentCount} gajos!`);
    }, 420);
  }

  if (fruitBody.game.id === "manzana") {
    addPowerTimer(() => {
      if (!Composite.get(engine.world, fruitBody.id, "body")) return;
      const base = { x: Math.max(6, fruitBody.velocity.x), y: fruitBody.velocity.y };

      const seedCount = 6;
      for (let i = 0; i < seedCount; i += 1) {
        const spread = (i - (seedCount - 1) / 2) * 0.7;
        const seed = makeSeed(fruitBody.position.x + 18, fruitBody.position.y + spread * 4, {
          x: base.x + 7 + i * 0.55,
          y: base.y * 0.2 + spread,
        });
        Body.setAngularVelocity(seed, 0.35 + i * 0.08);
      }
      addBreak(fruitBody.position.x, fruitBody.position.y, "#5c3422", "•");
      setMessage("¡Lluvia de semillas!");
    }, 260);
  }

  if (fruitBody.game.id === "sandia") {
    Body.setVelocity(fruitBody, {
      x: fruitBody.velocity.x * 1.32 + 2.4,
      y: Math.max(-6.2, fruitBody.velocity.y * 0.72),
    });
    Body.setAngularVelocity(fruitBody, 0.42);
    setMessage("¡Sandia pesada!");
  }

  if (fruitBody.game.id === "uvas") {
    Body.setVelocity(fruitBody, {
      x: fruitBody.velocity.x * 1.24 + 1.8,
      y: fruitBody.velocity.y * 1.18 - 0.8,
    });
    addPowerTimer(() => {
      if (!Composite.get(engine.world, fruitBody.id, "body")) return;
      const { x, y } = fruitBody.position;
      const base = { x: fruitBody.velocity.x, y: fruitBody.velocity.y };
      Composite.remove(engine.world, fruitBody);
      addBreak(x, y, "#9b5de5", "🍇");
      const grapeGroup = Body.nextGroup(true);

      const grapeCount = 7;
      for (let i = 0; i < grapeCount; i += 1) {
        const angle = -0.85 + i * (1.7 / Math.max(1, grapeCount - 1));
        const grape = makeFlyingFruit(x, y, { ...fruitBody.game, id: "uvaBomba", grapeBomb: true, emoji: "●" }, scale(11), {
          x: base.x * 1.05 + Math.cos(angle) * (5.5 + i * 0.18),
          y: base.y * 0.9 + Math.sin(angle) * 6,
        });
        grape.game.grapeBomb = true;
        grape.collisionFilter.group = grapeGroup;
      }
      setMessage("¡Racimo bomba!");
    }, 360);
  }
}

function triggerBananaBoomerang() {
  const boomerangFruit = Composite.allBodies(engine.world).find(
    (body) =>
      body.label === "fruit" &&
      body.wasLaunched &&
      ["banana"].includes(body.game?.id) &&
      !body.boomerangUsed &&
      gameNow() >= (body.boomerangReadyAt || Infinity),
  );
  if (!boomerangFruit) return;
  boomerangFruit.boomerangUsed = true;
  Body.setVelocity(boomerangFruit, {
    x: -Math.max(12, Math.abs(boomerangFruit.velocity.x) * 1.2 + 3),
    y: Math.min(-4, boomerangFruit.velocity.y - 5.5),
  });
  Body.setAngularVelocity(boomerangFruit, -0.9);
  addBreak(boomerangFruit.position.x, boomerangFruit.position.y, boomerangFruit.game.color, "↩");
  setMessage("¡Banana bumeran!");
}

function explodeGrape(body) {
  if (!body || body.game.exploded || !Composite.get(engine.world, body.id, "body")) return;
  body.game.exploded = true;
  const origin = { ...body.position };
  Composite.remove(engine.world, body);
  addBreak(origin.x, origin.y, "#9b5de5", "💥");
  playBreakSound();

  Composite.allBodies(engine.world).forEach((target) => {
    const offset = Vector.sub(target.position, origin);
    const distance = Vector.magnitude(offset);
    if (distance > 92 || target.isStatic) return;
    if (target.label === "vegetable") {
      damageVegetable(target, Math.max(24, (1 - distance / 92) * 230), body);
    }
    if (target.label === "tnt") damageTnt(target, 2);
    if (target.label === "block") {
      damageWoodBlock(target, Math.max(20, (1 - distance / 92) * 180), body);
    } else if (target.label === "glassBlock") {
      breakBuildingBlock(target);
    }
  });
}

function explodeJuice(body) {
  if (!body || body.juiceExploded || !Composite.get(engine.world, body.id, "body")) return;
  body.juiceExploded = true;
  const origin = { ...body.position };
  Composite.remove(engine.world, body);
  addBreak(origin.x, origin.y, "#ff941f", "💥");
  addBreak(origin.x, origin.y, "#ffd45c", body.game.id === "coco" ? "🥥" : "💦");
  playBreakSound();
  const isCoconut = ["coco"].includes(body.game.id);
  const blastRadius = scale(isCoconut ? 260 : 185);
  const blastPower = isCoconut ? 1.9 : 1;

  Composite.allBodies(engine.world).forEach((target) => {
    const offset = Vector.sub(target.position, origin);
    const distance = Vector.magnitude(offset);
    if (distance > blastRadius || target.label === "steelBlock") return;
    if (!target.isStatic && distance > 0) {
      const direction = Vector.normalise(offset);
      Body.applyForce(target, target.position, {
        x: direction.x * 0.04 * blastPower,
        y: (direction.y * 0.04 - 0.018) * blastPower,
      });
    }
    if (target.label === "vegetable") {
      damageVegetable(target, Math.max(60, (1 - distance / blastRadius) * 420) * blastPower, body);
    } else if (target.label === "block") {
      damageWoodBlock(target, Math.max(50, (1 - distance / blastRadius) * 320) * blastPower, body);
    } else if (["glassBlock", "iceBlock"].includes(target.label)) {
      breakBuildingBlock(target);
    } else if (target.label === "tnt") {
      damageTnt(target, 2);
    }
  });
  setMessage(isCoconut ? "¡BOOOM! ¡Superexplosión de coco!" : "¡Superexplosión de zumo!");
}

function eatFruitNearPlant() {
  const now = gameNow();
  if (!plant || levelChanging || now < plantNextBiteAt) return;
  const biteRadius = scale(108);
  const victim = Composite.allBodies(engine.world)
    .filter((body) => body.label === "fruit" && body.wasLaunched)
    .map((body) => ({ body, distance: Vector.magnitude(Vector.sub(body.position, plant.position)) }))
    .filter(({ body, distance }) => distance <= biteRadius + (body.circleRadius || 0))
    .sort((a, b) => a.distance - b.distance)[0]?.body;

  if (victim) {
    plantNextBiteAt = now + 900;
    plantMouthOpenUntil = gameNow() + 850;
    addBreak(victim.position.x, victim.position.y, "#79c943", "CHOMP!");
    addBreak(plant.position.x, plant.position.y - 24, "#e53950", "🌿");
    Composite.remove(engine.world, victim);
    const lostPoints = Math.min(200, score);
    setScore(score - lostPoints);
    if (lostPoints > 0) {
      addBreak(plant.position.x, plant.position.y - 50, "#ff7777", `−${lostPoints}`);
    }
    setMessage(lostPoints > 0
      ? `¡ÑAM! La planta se comió la fruta. −${lostPoints} puntos`
      : "¡ÑAM! La planta se comió la fruta. ¡Cuidado con sus dientes!");
    playNoise({ duration: 0.28, volume: 0.14, filterFrequency: 380 });
  }
}

function nextFruit() {
  if (vegetablesLeft <= 0 || levelChanging) return;
  const nextIndex = fruits.findIndex((fruit) => isFruitUnlocked(fruit) && !usedFruitIds.has(fruit.id));
  if (nextIndex === -1) {
    currentFruit = null;
    updateFruitTray();
    setMessage("Sin frutas. Toca reiniciar.");
    return;
  }
  launched = false;
  makeFruit(getCatapultAnchor(), nextIndex);
  setMessage(`Turno de ${fruits[nextIndex].name}`);
}

function resetFruitsAfterLife() {
  clearFruitLinks();
  clearPowerTimers();
  Composite.allBodies(engine.world).forEach((body) => {
    if (["fruit", "seed", "fire"].includes(body.label)) {
      Composite.remove(engine.world, body);
    }
  });
  if (sling) {
    Composite.remove(engine.world, sling);
    sling = null;
  }

  currentFruit = null;
  currentFruitIndex = 0;
  usedFruitIds = new Set();
  fruitUseCounts = new Map();
  launched = false;
  makeFruit(getCatapultAnchor(), 0);
  updateFruitTray();
}

function updateFruitTray() {
  fruitCards.forEach((card, index) => {
    const fruit = fruits[index];
    if (!fruit) return;

    const isUsed = usedFruitIds.has(fruit.id);
    const isLocked = !isFruitUnlocked(fruit);
    const bananaShotsLeft = Math.max(0, 3 - (fruitUseCounts.get("banana") || 0));
    const fruitName = fruit.id === "banana" && !isLocked ? `Banana ×${bananaShotsLeft}` : fruit.name.replace(" Furia", "");
    const name = document.createElement("span");
    name.textContent = fruitName;
    card.replaceChildren(document.createTextNode(`${isLocked ? "🔒" : fruit.emoji} `), name);
    card.classList.toggle("active", index === currentFruitIndex && !isUsed && !isLocked && !launched);
    card.classList.toggle("used", isUsed);
    card.classList.toggle("locked", isLocked);
    card.classList.toggle("unlocked", ["sandia", "uvas", "melon", "fresa", "naranja", "limon", "coco", "arandanos", "pina", "cerezas", "kiwi", "mango", "melocoton"].includes(fruit.id) && !isLocked && !isUsed);
    card.classList.toggle("powered", fruit.id === "pera" && hasPearFallPower() && !isUsed);
    card.disabled = isLocked || isUsed || launched || levelChanging;
  });
}

function chooseFruit(index) {
  if (launched || levelChanging || !isFruitUnlocked(fruits[index]) || usedFruitIds.has(fruits[index].id)) return;
  getAudioContext();
  if (currentFruit) Composite.remove(engine.world, currentFruit);
  if (sling) Composite.remove(engine.world, sling);
  sling = null;
  makeFruit(getCatapultAnchor(), index);
  setMessage(`Elegiste ${fruits[index].name}`);
}

function drawLabels() {
  const ctx = render.context;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "34px serif";

  // The fork stays behind the projectile so the launch channel remains visibly open.
  drawCatapult(ctx);
  drawReplayTrail(ctx);
  drawGardenTricks(ctx);

  Composite.allBodies(engine.world).forEach((body) => {
    if (body.label === "fruit" && body.tornadoUntil > gameNow()) {
      ctx.save();
      ctx.translate(body.position.x, body.position.y);
      ctx.rotate(gameNow() / 100);
      ctx.strokeStyle = "rgba(196, 255, 155, 0.8)";
      ctx.lineWidth = 4;
      for (let i = 0; i < 4; i += 1) {
        ctx.beginPath();
        ctx.ellipse(0, (i - 1.5) * 18, scale(25 + i * 18), 12 + i * 4, 0, 0.3, Math.PI * 1.7);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (body.label === "fruit" && body.game) {
      if (body.game.id === "miniArandano") {
        ctx.fillStyle = "#5264cf";
        ctx.beginPath();
        ctx.arc(body.position.x, body.position.y, body.circleRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#c1ceff";
        ctx.beginPath();
        ctx.arc(body.position.x - 1, body.position.y - 1, body.circleRadius * 0.3, 0, Math.PI * 2);
        ctx.fill();
      } else drawAngryFruit(ctx, body);
    }
    if (body.label === "vegetable" && body.game && !body.game.broken) {
      drawScaredVegetable(ctx, body);
    }
    if (body.label === "seed") {
      drawSeed(ctx, body);
    }
    if (body.label === "fire") {
      ctx.font = `${scale(26)}px serif`;
      if (body.isLeaf) {
        ctx.save();
        ctx.translate(body.position.x, body.position.y);
        ctx.rotate(body.angle);
        ctx.fillStyle = "#65ce57";
        ctx.beginPath();
        ctx.ellipse(0, 0, scale(17), scale(6), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#dbffb0";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-scale(13), 0);
        ctx.lineTo(scale(13), 0);
        ctx.stroke();
        ctx.restore();
      } else if (body.isAcid) {
        ctx.fillStyle = "#caff46";
        ctx.shadowColor = "#8dff37";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(body.position.x, body.position.y, scale(10), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else ctx.fillText("🔥", body.position.x, body.position.y);
    }
    if (body.label === "tnt") {
      drawTnt(ctx, body);
    }
    if (body.label === "steelBlock") {
      drawSteelBlock(ctx, body);
    }
    if (body.label === "glassBlock") {
      drawGlassBlock(ctx, body);
    }
    if (body.label === "iceBlock") drawIceBlock(ctx, body);
    if (body.label === "gelBlock") drawGelBlock(ctx, body);
    if (body.label === "cannonBall") drawCannonBall(ctx, body);
    if (["meteor", "snowball"].includes(body.label)) drawWorldHazard(ctx, body);
    if (body.label === "cactus") drawCactus(ctx, body);
    if (body.label === "chest") drawChest(ctx, body);
    if (body.label === "movingPlatform") {
      ctx.fillStyle = "#46bfc9";
      ctx.strokeStyle = "#e3ffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(body.position.x - scale(52.5), body.position.y - scale(8), scale(105), scale(16), 5);
      ctx.fill(); ctx.stroke();
      ctx.font = "16px serif";
      ctx.fillStyle = "#163b4b";
      ctx.fillText("↔", body.position.x, body.position.y);
    }
  });

  drawPlant(ctx);
  drawPortals(ctx);
  drawCannons(ctx);
  if (levelKey && !keyCollected) {
    ctx.font = `${scale(42)}px serif`;
    ctx.fillText("🔑", levelKey.x, levelKey.y);
  }

  if (currentFruit && !launched) {
    const guideSize = scale(92);
    ctx.setLineDash([scale(8), scale(8)]);
    ctx.lineWidth = scale(4);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.86)";
    ctx.fillStyle = "rgba(255, 255, 255, 0.13)";
    ctx.beginPath();
    ctx.roundRect(currentFruit.position.x - guideSize / 2, currentFruit.position.y - guideSize / 2, guideSize, guideSize, scale(16));
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function drawGelBlock(ctx, body) {
  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);
  ctx.fillStyle = "rgba(238, 76, 190, 0.72)";
  ctx.strokeStyle = "#ffb6e8";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-body.game.width / 2, -body.game.height / 2, body.game.width, body.game.height, 10);
  ctx.fill(); ctx.stroke(); ctx.restore();
}

function drawWorldHazard(ctx, body) {
  ctx.fillStyle = body.label === "meteor" ? "#75504a" : "#eafcff";
  ctx.beginPath(); ctx.arc(body.position.x, body.position.y, body.circleRadius, 0, Math.PI * 2); ctx.fill();
}

function drawCactus(ctx, body) {
  ctx.save(); ctx.translate(body.position.x, body.position.y);
  ctx.fillStyle = "#2f9b58";
  ctx.fillRect(-10, -50, 20, 100);
  ctx.fillRect(-28, -20, 56, 16);
  ctx.restore();
}

function drawIceBlock(ctx, body) {
  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);
  ctx.fillStyle = "rgba(190, 244, 255, 0.78)";
  ctx.strokeStyle = "#f5feff";
  ctx.lineWidth = 3;
  ctx.fillRect(-body.game.width / 2, -body.game.height / 2, body.game.width, body.game.height);
  ctx.strokeRect(-body.game.width / 2, -body.game.height / 2, body.game.width, body.game.height);
  ctx.restore();
}

function drawCannons(ctx) {
  cannons.forEach((cannon) => {
    ctx.fillStyle = "#30353b";
    ctx.fillRect(cannon.x - 25, cannon.y - 12, 42, 24);
    ctx.fillStyle = "#171a1d";
    ctx.beginPath();
    ctx.arc(cannon.x + 18, cannon.y, 13, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawCannonBall(ctx, body) {
  ctx.fillStyle = "#22272d";
  ctx.beginPath();
  ctx.arc(body.position.x, body.position.y, scale(11), 0, Math.PI * 2);
  ctx.fill();
}

function drawChest(ctx, body) {
  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);
  ctx.fillStyle = "#8b4f24";
  ctx.strokeStyle = "#3e2416";
  ctx.lineWidth = 3;
  ctx.fillRect(-24, -16, 48, 32);
  ctx.strokeRect(-24, -16, 48, 32);
  ctx.fillStyle = "#ffd447";
  ctx.fillRect(-4, -5, 8, 14);
  ctx.fillRect(-24, -3, 48, 6);
  ctx.restore();
}

function drawPortals(ctx) {
  portals.forEach((portal, index) => {
    ctx.save();
    ctx.translate(portal.x, portal.y);
    ctx.rotate((gameNow() / 700) * (index ? -1 : 1));
    ctx.strokeStyle = index ? "#ff79d1" : "#6df3ff";
    ctx.lineWidth = 8;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 58, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

function drawReplayTrail(ctx) {
  if (!replayStartedAt || bestTrajectory.length < 2) return;
  const index = Math.min(bestTrajectory.length - 1, Math.floor((gameNow() - replayStartedAt) / 24));
  ctx.save();
  ctx.strokeStyle = "rgba(255, 239, 120, 0.78)";
  ctx.lineWidth = 5;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  bestTrajectory.slice(0, index + 1).forEach((point, pointIndex) => {
    if (pointIndex === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();
  const point = bestTrajectory[index];
  ctx.fillStyle = "#ffd447";
  ctx.beginPath();
  ctx.arc(point.x, point.y, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (index === bestTrajectory.length - 1) replayStartedAt = 0;
}

function drawCatapult(ctx) {
  if (!catapultReady) return;
  const anchor = getCatapultAnchor();

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const leftTip = { x: anchor.x - scale(58), y: anchor.y - scale(68) };
  const rightTip = { x: anchor.x + scale(58), y: anchor.y - scale(68) };
  const forkBottomY = anchor.y + scale(48);

  // The upright U is visual only; it never participates in physics collisions.
  ctx.strokeStyle = "#7f4d2d";
  ctx.lineWidth = scale(12);
  ctx.beginPath();
  ctx.moveTo(leftTip.x, leftTip.y);
  ctx.lineTo(leftTip.x, anchor.y + scale(20));
  ctx.quadraticCurveTo(leftTip.x, forkBottomY, anchor.x, forkBottomY);
  ctx.quadraticCurveTo(rightTip.x, forkBottomY, rightTip.x, anchor.y + scale(20));
  ctx.lineTo(rightTip.x, rightTip.y);
  ctx.stroke();

  ctx.strokeStyle = "#58351f";
  ctx.lineWidth = scale(13);
  ctx.beginPath();
  ctx.moveTo(anchor.x, forkBottomY);
  ctx.lineTo(anchor.x, anchor.y + CATAPULT_HEIGHT);
  ctx.stroke();

  ctx.strokeStyle = "#99613a";
  ctx.lineWidth = scale(10);
  ctx.beginPath();
  ctx.moveTo(anchor.x - scale(25), anchor.y + CATAPULT_HEIGHT + scale(4));
  ctx.lineTo(anchor.x + scale(25), anchor.y + CATAPULT_HEIGHT + scale(4));
  ctx.stroke();

  if (currentFruit && !launched) {
    ctx.strokeStyle = "#362018";
    ctx.lineWidth = scale(5);
    ctx.beginPath();
    ctx.moveTo(leftTip.x, leftTip.y);
    ctx.lineTo(currentFruit.position.x, currentFruit.position.y);
    ctx.lineTo(rightTip.x, rightTip.y);
    ctx.stroke();
  }

  ctx.restore();
}

function drawPlant(ctx) {
  if (!plant) return;
  const x = plant.position.x;
  const y = plant.position.y;
  const mouthOpen = gameNow() < plantMouthOpenUntil;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(GAME_SCALE, GAME_SCALE);
  ctx.strokeStyle = "#28763b";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(0, 34);
  ctx.quadraticCurveTo(-8, 5, 1, -19);
  ctx.stroke();
  ctx.fillStyle = "#3aa655";
  ctx.beginPath();
  ctx.ellipse(-17, 20, 20, 9, -0.45, 0, Math.PI * 2);
  ctx.ellipse(17, 25, 20, 9, 0.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#e53950";
  ctx.beginPath();
  ctx.arc(0, -25, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff4d6";
  const jaw = mouthOpen ? 15 : 7;
  ctx.beginPath();
  ctx.moveTo(-23, -25);
  ctx.lineTo(-12, -25 - jaw);
  ctx.lineTo(-4, -25);
  ctx.lineTo(5, -25 - jaw);
  ctx.lineTo(13, -25);
  ctx.lineTo(23, -25 - jaw);
  ctx.lineTo(23, -25 + jaw);
  ctx.lineTo(12, -25);
  ctx.lineTo(4, -25 + jaw);
  ctx.lineTo(-5, -25);
  ctx.lineTo(-13, -25 + jaw);
  ctx.lineTo(-23, -25);
  ctx.fill();
  ctx.restore();
}

function drawSteelBlock(ctx, body) {
  const width = body.game.width;
  const height = body.game.height;
  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);
  ctx.fillStyle = "#63717c";
  ctx.strokeStyle = "#303a43";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-width / 2, -height / 2, width, height, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#d8e0e5";
  const insetX = Math.min(10, width * 0.2);
  const insetY = Math.min(7, height * 0.25);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dy]) => {
    ctx.beginPath();
    ctx.arc(dx * (width / 2 - insetX), dy * (height / 2 - insetY), 2.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawGlassBlock(ctx, body) {
  const blockWidth = body.game.width;
  const blockHeight = body.game.height;
  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);
  ctx.fillStyle = "rgba(142, 226, 245, 0.55)";
  ctx.strokeStyle = "#e2fbff";
  ctx.lineWidth = 3;
  ctx.fillRect(-blockWidth / 2, -blockHeight / 2, blockWidth, blockHeight);
  ctx.strokeRect(-blockWidth / 2, -blockHeight / 2, blockWidth, blockHeight);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-blockWidth * 0.34, blockHeight * 0.32);
  ctx.lineTo(-blockWidth * 0.08, -blockHeight * 0.28);
  ctx.lineTo(blockWidth * 0.1, blockHeight * 0.12);
  ctx.lineTo(blockWidth * 0.32, -blockHeight * 0.3);
  ctx.stroke();
  ctx.restore();
}

function drawAngryFruit(ctx, body) {
  const radius = body.circleRadius || body.game.radius || 24;
  const x = body.position.x;
  const y = body.position.y;
  const faceScale = Math.max(0.56, radius / 28);

  if ((body.game.id === "pera" && hasPearFallPower())) {
    ctx.save();
    const glow = ctx.createRadialGradient(x, y, radius * 0.45, x, y, radius * 1.35);
    glow.addColorStop(0, "rgba(130, 255, 225, 0.55)");
    glow.addColorStop(0.65, "rgba(68, 214, 255, 0.34)");
    glow.addColorStop(1, "rgba(68, 214, 255, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.font = `${Math.max(24, radius * 1.35)}px serif`;
  ctx.fillText(body.game.emoji, x, y + 1);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(body.angle * 0.35);
  ctx.lineCap = "round";
  ctx.lineWidth = 3 * faceScale;
  ctx.strokeStyle = "#241b16";
  ctx.fillStyle = "#241b16";

  ctx.beginPath();
  ctx.moveTo(-12 * faceScale, -11 * faceScale);
  ctx.lineTo(-2 * faceScale, -7 * faceScale);
  ctx.moveTo(12 * faceScale, -11 * faceScale);
  ctx.lineTo(2 * faceScale, -7 * faceScale);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(-7 * faceScale, -3 * faceScale, 2.8 * faceScale, 0, Math.PI * 2);
  ctx.arc(7 * faceScale, -3 * faceScale, 2.8 * faceScale, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-8 * faceScale, 12 * faceScale);
  ctx.quadraticCurveTo(0, 6 * faceScale, 8 * faceScale, 12 * faceScale);
  ctx.stroke();
  ctx.restore();
}

function drawScaredVegetable(ctx, body) {
  ctx.save();
  if (body.game.isGhost) ctx.globalAlpha = body.game.ghostHidden ? 0.16 : 0.72;
  const radius = body.circleRadius || body.game.size || 24;
  const x = body.position.x;
  const y = body.position.y;
  const faceScale = Math.max(0.55, radius / 27);

  if (body.game.shieldHits > 0) {
    ctx.strokeStyle = "rgba(125, 231, 255, 0.9)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y, radius * 1.28, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (body.game.isCaged && !keyCollected) {
    ctx.strokeStyle = "#7e8791";
    ctx.lineWidth = 4;
    for (let offset = -radius; offset <= radius; offset += radius) {
      ctx.beginPath(); ctx.moveTo(x + offset, y - radius * 1.3); ctx.lineTo(x + offset, y + radius * 1.3); ctx.stroke();
    }
  }
  if (body.game.isHealer || body.game.isNinja) {
    ctx.font = `${Math.max(16, radius * 0.7)}px serif`;
    ctx.fillText(body.game.isHealer ? "✚" : "★", x, y - radius - 23);
  }

  if (body.game.helmetHits > 0) {
    ctx.font = `${Math.max(24, radius)}px serif`;
    ctx.fillText("🪖", x, y - radius - 5);
  }
  if (body.game.isKing) {
    const protectedNow = bossIsProtected(body);
    ctx.strokeStyle = protectedNow ? "#7ee6ff" : "#ffdb65";
    ctx.lineWidth = protectedNow ? 5 : 2;
    ctx.setLineDash(protectedNow ? [] : [5, 5]);
    ctx.beginPath(); ctx.arc(x, y, radius * 1.5, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "bold 12px sans-serif";
    ctx.fillStyle = protectedNow ? "#c9f8ff" : "#ffe48b";
    ctx.fillText(protectedNow ? "🛡 Protegido" : "¡Ataca ahora!", x, y - radius - 45);
    ctx.font = `${Math.max(25, radius * 0.9)}px serif`;
    ctx.fillText("👑", x, y - radius - 12);
  }

  ctx.font = `${Math.max(28, radius * 1.35)}px serif`;
  ctx.fillText(body.game.emoji, x, y + 1);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(body.angle * 0.25);
  ctx.lineCap = "round";
  ctx.lineWidth = 2.6 * faceScale;
  ctx.strokeStyle = "#231915";
  ctx.fillStyle = "#ffffff";

  ctx.beginPath();
  ctx.arc(-8 * faceScale, -5 * faceScale, 5 * faceScale, 0, Math.PI * 2);
  ctx.arc(8 * faceScale, -5 * faceScale, 5 * faceScale, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#231915";
  ctx.beginPath();
  ctx.arc(-7 * faceScale, -4 * faceScale, 2 * faceScale, 0, Math.PI * 2);
  ctx.arc(9 * faceScale, -4 * faceScale, 2 * faceScale, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(0, 11 * faceScale, 5 * faceScale, 7 * faceScale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const healthRatio = Math.max(0, body.game.health / body.game.maxHealth);
  const barWidth = Math.max(34, radius * 1.7);
  const barY = y - radius - (body.game.isKing ? 38 : 13);
  ctx.fillStyle = "rgba(25, 20, 28, 0.82)";
  ctx.fillRect(x - barWidth / 2 - 2, barY - 2, barWidth + 4, 8);
  ctx.fillStyle = healthRatio > 0.55 ? "#42d66b" : healthRatio > 0.25 ? "#ffd447" : "#ef4d3f";
  ctx.fillRect(x - barWidth / 2, barY, barWidth * healthRatio, 4);
  ctx.restore();
}

function drawSeed(ctx, body) {
  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);
  ctx.fillStyle = "#5c3422";
  ctx.strokeStyle = "#2b160e";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawTnt(ctx, body) {
  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(body.angle);

  ctx.fillStyle = "#e53935";
  ctx.strokeStyle = "#7a1f1c";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-22, -22, 44, 44, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ffd447";
  ctx.fillRect(-20, -6, 40, 12);
  ctx.fillStyle = "#2b1a16";
  ctx.font = "bold 16px Baloo 2, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("TNT", 0, 0);

  ctx.strokeStyle = "#2b1a16";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(10, -22);
  ctx.quadraticCurveTo(20, -34, 29, -24);
  ctx.stroke();

  ctx.fillStyle = "#ffde59";
  ctx.beginPath();
  ctx.arc(31, -23, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles() {
  const ctx = render.context;
  ctx.save();
  breakParticles = breakParticles.filter((particle) => particle.life > 0);
  breakParticles.forEach((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.24;
    particle.life -= 1;
    ctx.globalAlpha = Math.max(0, particle.life / 64);
    if (particle.emoji) {
      ctx.font = `${particle.size + 12}px serif`;
      ctx.fillText(particle.emoji, particle.x, particle.y);
    } else {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fillStyle = particle.color;
      ctx.fill();
    }
  });
  ctx.restore();
}

function setupCollisions() {
  Events.on(engine, "collisionStart", (event) => {
    event.pairs.forEach((pair) => {
      if (pair.bodyA.isSensor || pair.bodyB.isSensor) return;
      if (levelHasStarted && Math.max(pair.bodyA.speed, pair.bodyB.speed) > 1.6) {
        playCollisionSound();
      }

      const bodies = [pair.bodyA, pair.bodyB];
      const veggie = bodies.map(getVegetableBody).find(Boolean);
      const fruit = bodies.map(getFruitBody).find(Boolean);
      const seed = bodies.find((body) => body.label === "seed");
      const fire = bodies.find((body) => body.label === "fire");
      const block = bodies.find((body) => body.label === "block");
      const glassBlock = bodies.find((body) => body.label === "glassBlock");
      const iceBlock = bodies.find((body) => body.label === "iceBlock");
      const steelBlock = bodies.find((body) => body.label === "steelBlock");
      const tnt = bodies.find((body) => body.label === "tnt");
      const chest = bodies.find((body) => body.label === "chest");
      const worldHazard = bodies.find((body) => ["meteor", "snowball"].includes(body.label));
      const speed = fruit ? Vector.magnitude(fruit.velocity) : Math.max(pair.bodyA.speed, pair.bodyB.speed);
      const hitSpeed = Math.max(pair.bodyA.speed, pair.bodyB.speed);
      const launchedFruit = fruit?.wasLaunched ? fruit : null;
      const projectile = launchedFruit || seed || fire;
      const structureBody = veggie || block || glassBlock || iceBlock || steelBlock || tnt || chest || bodies.find(body => body.label === "movingPlatform");

      const mushroom = bodies.find(body => body.label === "mushroom");
      if (mushroom && launchedFruit && gameNow() > (launchedFruit.nextMushroomBounceAt || 0)) {
        launchedFruit.nextMushroomBounceAt = gameNow() + 300;
        Body.setVelocity(launchedFruit, { x: Math.max(5, launchedFruit.velocity.x), y: -14 });
        addBreak(mushroom.position.x, mushroom.position.y, "#ffaaa1", "🍄");
        setMessage("¡Boing! ¡Las setas de lluvia te impulsan!");
      }
      if (levelHasStarted && projectile && structureBody) {
        activateStructure(structureBody, { ...projectile.velocity });
      }

      const grapeHitSurface = bodies.some((body) =>
        ["ground", "movingPlatform", "block", "glassBlock", "iceBlock", "steelBlock", "vegetable", "tnt"].includes(body.label),
      );
      if (launchedFruit && ["mango"].includes(launchedFruit.game.id) && structureBody && hitSpeed > 1.2) stickMango(launchedFruit, structureBody);
      if (launchedFruit && ["melocoton"].includes(launchedFruit.game.id) && grapeHitSurface && hitSpeed > 1.5) growPeach(launchedFruit);
      if (fire?.isLeaf && structureBody) {
        addBreak(fire.position.x, fire.position.y, "#78db65", "🍃");
        if (veggie) damageVegetable(veggie, 120, fire);
        else if (block) damageWoodBlock(block, 160, fire);
        else if (glassBlock || iceBlock) breakBuildingBlock(glassBlock || iceBlock);
        else if (tnt) damageTnt(tnt, 1);
        else if (chest) openChest(chest);
        Composite.remove(engine.world, fire);
        return;
      }
      if (fire?.isAcid && structureBody) {
        addBreak(fire.position.x, fire.position.y, "#caff46", "💦");
        if (veggie) damageVegetable(veggie, 150, fire);
        else if (block) damageWoodBlock(block, 200, fire);
        else if (glassBlock || iceBlock) breakBuildingBlock(glassBlock || iceBlock);
        else if (steelBlock) breakSteel(steelBlock);
        else if (tnt) damageTnt(tnt, 2);
        else if (chest) openChest(chest);
        Composite.remove(engine.world, fire);
        return;
      }
      if (launchedFruit?.coconutArmed && !launchedFruit.juiceExploded && grapeHitSurface && hitSpeed > 1.2) {
        explodeJuice(launchedFruit);
        return;
      }
      if (launchedFruit?.juiceMode && !launchedFruit.juiceExploded && grapeHitSurface && hitSpeed > 1.2) {
        explodeJuice(launchedFruit);
        return;
      }
      if (launchedFruit?.game?.grapeBomb && grapeHitSurface && hitSpeed > 1.4) {
        explodeGrape(launchedFruit);
        return;
      }
      if (chest && launchedFruit && speed > 2.2) {
        openChest(chest);
        return;
      }

      if (steelBlock && launchedFruit && ["sandia"].includes(launchedFruit.game.id) && speed > 3.2) {
        breakSteel(steelBlock);
        return;
      }
      if (steelBlock && (launchedFruit || seed)) {
        setMessage("El acero se rompe con sandía o ácido de limón");
        return;
      }

      if (steelBlock && fire) {
        Composite.remove(engine.world, fire);
        setMessage("El fuego no derrite el acero");
        return;
      }

      if (glassBlock && ((launchedFruit && hitSpeed > 2.2) || fire)) {
        breakBuildingBlock(glassBlock);
        if (fire) Composite.remove(engine.world, fire);
        return;
      }
      if (iceBlock && ((launchedFruit && hitSpeed > 1.7) || fire)) {
        breakBuildingBlock(iceBlock);
        if (fire) Composite.remove(engine.world, fire);
        return;
      }

      if (block && launchedFruit && launchedFruit.game.id === "mandarina") {
        setMessage("La mandarina solo rompe cristal");
        return;
      }
      if (block && launchedFruit && speed > 2.2) {
        damageWoodBlock(block, collisionEnergy(launchedFruit, block), launchedFruit);
        return;
      }
      if (block && seed && seed.speed > 2.2) {
        damageWoodBlock(block, collisionEnergy(seed, block), seed);
        Composite.remove(engine.world, seed);
        return;
      }
      if (block && fire) {
        damageWoodBlock(block, 85, fire);
        Composite.remove(engine.world, fire);
        return;
      }

      if (tnt && levelHasStarted && launchedFruit && speed > 1.8) {
        damageTnt(tnt, 2);
      } else if (tnt && levelHasStarted && seed && seed.speed > 2.2) {
        damageTnt(tnt, 1);
      } else if (tnt && levelHasStarted && block && block.speed > 1.8) {
        damageTnt(tnt, 2);
      } else if (tnt && levelHasStarted && bodies.some((body) => body.label === "ground") && tnt.speed > 1.8) {
        damageTnt(tnt, 2);
      } else if (tnt && levelHasStarted && hitSpeed > 5.5) {
        damageTnt(tnt, 2);
      } else if (veggie && launchedFruit && speed > 2.2) {
        damageVegetable(veggie, collisionEnergy(launchedFruit, veggie), launchedFruit);
      } else if (veggie && seed && seed.speed > 3.3) {
        damageVegetable(veggie, collisionEnergy(seed, veggie), seed);
      } else if (veggie && fire) {
        damageVegetable(veggie, 95, fire);
        Composite.remove(engine.world, fire);
      } else if (levelHasStarted && veggie && block && block.speed > 3.2) {
        damageVegetable(veggie, collisionEnergy(block, veggie), block);
      } else if (levelHasStarted && veggie && worldHazard && worldHazard.speed > 2.5) {
        damageVegetable(veggie, collisionEnergy(worldHazard, veggie), worldHazard);
      } else if (levelHasStarted && veggie && bodies.some((body) => body.label === "ground") && veggie.speed > 2.2) {
        damageVegetable(veggie, 0.5 * veggie.mass * veggie.speed * veggie.speed * 0.9);
      }
    });
  });
}

function setupMouse() {
  const mouse = Mouse.create(render.canvas);
  mouseConstraint = MouseConstraint.create(engine, {
    mouse,
    collisionFilter: {
      mask: LOADED_FRUIT_CATEGORY,
    },
    constraint: {
      stiffness: 0.18,
      render: { visible: false },
    },
  });
  Composite.add(engine.world, mouseConstraint);
  render.mouse = mouse;

  Events.on(engine, "beforeUpdate", () => {
    if (!currentFruit || launched || getFruitBody(mouseConstraint.body) !== currentFruit) return;

    const anchor = getCatapultAnchor();
    let pull = {
      x: Math.max(0, anchor.x - mouse.position.x),
      y: anchor.y - mouse.position.y,
    };
    pull.y = Math.max(-MAX_CATAPULT_VERTICAL_PULL, Math.min(MAX_CATAPULT_VERTICAL_PULL, pull.y));
    const distance = Vector.magnitude(pull);
    if (distance > MAX_CATAPULT_PULL) pull = Vector.mult(Vector.normalise(pull), MAX_CATAPULT_PULL);

    Body.setPosition(currentFruit, Vector.sub(anchor, pull));
    Body.setVelocity(currentFruit, { x: 0, y: 0 });
    Body.setAngularVelocity(currentFruit, 0);
  });

  Events.on(mouseConstraint, "enddrag", (event) => {
    if (getFruitBody(event.body) === currentFruit && !launched) {
      getAudioContext();
      const launchedFruit = currentFruit;
      const anchor = getCatapultAnchor();
      const pull = Vector.sub(anchor, launchedFruit.position);
      const pullDistance = Vector.magnitude(pull);

      if (pullDistance < 24 || pull.x < 24) {
        Body.setPosition(launchedFruit, anchor);
        Body.setVelocity(launchedFruit, { x: 0, y: 0 });
        setMessage("Arrastra la fruta hacia atras para lanzar");
        return;
      }

      const launchPull =
        pullDistance > MAX_CATAPULT_PULL ? Vector.mult(Vector.normalise(pull), MAX_CATAPULT_PULL) : pull;
      launched = true;
      activeTrajectory = [];
      levelHasStarted = true;
      levelLaunchCount += 1;
      launchedFruit.wasLaunched = true;
      setFruitDraggable(launchedFruit, false);
      const fruitId = launchedFruit.game.id;
      const useCount = (fruitUseCounts.get(fruitId) || 0) + 1;
      fruitUseCounts.set(fruitId, useCount);
      if (fruitId !== "banana" || useCount >= 3) {
        usedFruitIds.add(fruitId);
      }
      updateFruitTray();

      if (sling) {
        sling.bodyB = null;
        Composite.remove(engine.world, sling);
        sling = null;
      }
      Body.setVelocity(launchedFruit, {
        x: launchPull.x * 0.15,
        y: launchPull.y * 0.15,
      });
      Body.setAngularVelocity(launchedFruit, launchPull.x * 0.0025);
      activatePower(launchedFruit);
      playLaunchSound();
      setMessage("¡Vuela fruta!");
      addPowerTimer(nextFruit, 3200);
    }
  });
}

function drawBackground() {
  const ctx = render.context;
  ctx.save();
  const worldIndex = Math.min(16, Math.floor((currentLevel - 1) / 5));
  const world = [
    ["#315d4a", "#d65343", "#ff9a3d", "#33252c"],
    ["#32647b", "#77b8ca", "#d8edf0", "#39464d"],
    ["#25244f", "#574475", "#87638d", "#21172d"],
    ["#3c2634", "#7f3438", "#bf5940", "#24171d"],
    ["#83cfe8", "#bdebf5", "#dff8ff", "#31434d"],
    ["#642f3d", "#ca493d", "#ef7138", "#3a2225"],
    ["#111536", "#28244f", "#51448c", "#19162c"],
    ["#075d89", "#139fb5", "#70e3db", "#123e61"],
    ["#aa63c4", "#f6a8ce", "#ffe6b0", "#75456b"],
    ["#469ed9", "#a6e8ff", "#fff2c7", "#547dab"],
    ["#184d49", "#3c9d67", "#b8e88b", "#254638"],
    ["#6b4fa1", "#ce8ed3", "#ffe8bc", "#4f3467"],
    ["#242451", "#7669c7", "#a5f4f2", "#23253e"],
    ["#225a62", "#62a6a0", "#c9e7af", "#29494b"],
    ["#334a42", "#718751", "#ced68c", "#303f2f"],
    ["#475b82", "#91b4bf", "#f6cc89", "#394453"],
    ["#18342c", "#46633f", "#d6c56a", "#192a24"],
  ][worldIndex];
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, world[0]);
  sky.addColorStop(0.3, world[1]);
  sky.addColorStop(0.57, world[2]);
  sky.addColorStop(0.58, world[3]);
  sky.addColorStop(1, "#160f1a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(35, 20, 48, 0.34)";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width * 0.56, 0);
  ctx.lineTo(0, height * 0.62);
  ctx.closePath();
  ctx.fill();

  if (!["rain", "storm", "snow"].includes(currentWeather.id)) {
  ctx.fillStyle = "#ffcf3f";
  ctx.beginPath();
  ctx.arc(width * 0.1, 58, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 64, 47, 0.75)";
  ctx.lineWidth = 18;
  ctx.stroke();

  }
  ctx.fillStyle = "rgba(47, 42, 62, 0.78)";
  for (const cloud of [
    [width * 0.28, 74, 38],
    [width * 0.49, 105, 30],
    [width * 0.82, 66, 34],
  ]) {
    ctx.beginPath();
    ctx.arc(cloud[0] - cloud[2], cloud[1], cloud[2] * 0.75, 0, Math.PI * 2);
    ctx.arc(cloud[0], cloud[1] - 10, cloud[2], 0, Math.PI * 2);
    ctx.arc(cloud[0] + cloud[2], cloud[1], cloud[2] * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  const abyss = ctx.createLinearGradient(0, height * 0.58, 0, height);
  abyss.addColorStop(0, "rgba(45, 27, 35, 0.45)");
  abyss.addColorStop(0.55, "#21151f");
  abyss.addColorStop(1, "#08070b");
  ctx.fillStyle = abyss;
  ctx.fillRect(0, height * 0.58, width, height * 0.42);

  ctx.fillStyle = "rgba(255, 74, 42, 0.2)";
  ctx.beginPath();
  ctx.ellipse(width * 0.5, height + 35, width * 0.28, 70, 0, 0, Math.PI * 2);
  ctx.fill();
  if (currentLevel >= 36 && currentLevel <= 40) {
    ctx.strokeStyle = "rgba(201, 255, 255, 0.65)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 22; i += 1) {
      const y = height - ((gameNow() * 0.035 + i * 41) % (height + 30));
      ctx.beginPath();
      ctx.arc((i * 137 + Math.sin(y / 60) * 12) % width, y, 4 + i % 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  if (currentLevel >= 71 && currentLevel <= 75) {
    ctx.fillStyle = "rgba(139, 171, 72, 0.6)";
    ctx.beginPath();
    ctx.ellipse(width * 0.68, height - scale(88), width * 0.27, scale(35), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#cfdf8b";
    for (let i = 0; i < 9; i += 1) {
      const radius = 3 + Math.sin(gameNow() / 600 + i) * 2;
      ctx.beginPath(); ctx.arc(width * (0.45 + i * 0.055), height - scale(85) + Math.sin(i) * 10, radius, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function drawWeatherEffects(ctx) {
  const time = gameNow();
  const weather = currentWeather.id;
  ctx.save();
  if (["rain", "storm", "snow"].includes(weather)) {
    ctx.fillStyle = weather === "snow" ? "rgba(214, 234, 244, 0.9)" : weather === "storm" ? "rgba(39, 55, 76, 0.95)" : "rgba(75, 102, 120, 0.94)";
    [0.1, 0.44, 0.78].forEach((fraction, index) => {
      const x = width * fraction + Math.sin(time / 3800 + index) * 10;
      const y = 55 + index % 2 * 8;
      ctx.beginPath();
      ctx.ellipse(x, y + 10, 88, 28, 0, 0, Math.PI * 2);
      ctx.ellipse(x - 36, y - 4, 38, 32, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 12, y - 14, 45, 37, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  if (weather === "calm") {
    // Gentle sunbeams stay near the edge so they do not hide the targets.
    ctx.strokeStyle = "rgba(255, 228, 126, 0.35)";
    ctx.lineWidth = 5;
    for (let i = 0; i < 9; i += 1) {
      const angle = i * Math.PI * 2 / 9 + time / 18000;
      ctx.beginPath();
      ctx.moveTo(width * 0.1 + Math.cos(angle) * 58, 58 + Math.sin(angle) * 58);
      ctx.lineTo(width * 0.1 + Math.cos(angle) * 77, 58 + Math.sin(angle) * 77);
      ctx.stroke();
    }
  }
  if (["windRight", "windLeft"].includes(weather)) {
    const direction = weather === "windRight" ? 1 : -1;
    for (let i = 0; i < 15; i += 1) {
      const travel = ((i * 109 + time * 0.2) % (width + 180)) - 90;
      const x = direction > 0 ? travel : width - travel;
      const y = 70 + ((i * 73) % Math.max(1, height - 110)) + Math.sin(time / 420 + i) * 14;
      ctx.strokeStyle = "rgba(225, 251, 255, 0.65)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - direction * 50, y);
      ctx.quadraticCurveTo(x - direction * 20, y - 10, x, y); ctx.stroke();
      ctx.save(); ctx.translate(x, y); ctx.rotate(direction * time / 500 + i);
      ctx.fillStyle = i % 2 ? "#f2cf64" : "#b5e38a";
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 4, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
  if (["rain", "storm"].includes(weather)) {
    const storm = weather === "storm";
    ctx.strokeStyle = storm ? "rgba(202, 238, 255, 0.85)" : "rgba(183, 229, 255, 0.82)";
    ctx.lineWidth = storm ? 2.3 : 2;
    ctx.lineCap = "round";
    const drops = Math.min(storm ? 140 : 95, Math.max(50, Math.floor(width / 10)));
    for (let i = 0; i < drops; i += 1) {
      const x = ((i * 97 + time * 0.09) % (width + 60)) - 30;
      const y = (i * 61 + time * (storm ? 0.65 : 0.45)) % height;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y + (storm ? 22 : 15)); ctx.stroke();
    }
    if (storm) {
      const phase = time % 6500;
      if (phase > 4500 && phase < 5300) {
        const glow = Math.sin((phase - 4500) / 800 * Math.PI);
        ctx.fillStyle = `rgba(219, 237, 255, ${glow * 0.1})`;
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = `rgba(255, 240, 156, ${glow})`;
        ctx.lineWidth = 5;
        const x = width * 0.76;
        ctx.beginPath(); ctx.moveTo(x, 25); ctx.lineTo(x - 28, 85);
        ctx.lineTo(x + 3, 77); ctx.lineTo(x - 35, 150); ctx.stroke();
      }
    }
  }
  if (weather === "snow") {
    ctx.fillStyle = "rgba(250, 254, 255, 0.95)";
    const flakes = Math.min(85, Math.max(40, Math.floor(width / 12)));
    for (let i = 0; i < flakes; i += 1) {
      const x = ((i * 83 + Math.sin(time / 1100 + i) * 28 + width) % (width + 30)) - 15;
      const y = (i * 47 + time * (0.035 + (i % 3) * 0.012)) % height;
      ctx.beginPath(); ctx.arc(x, y, 2 + i % 4, 0, Math.PI * 2); ctx.fill();
      if (i % 5 === 0) {
        ctx.strokeStyle = "rgba(237, 251, 255, 0.85)"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y);
        ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6); ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function startGame({ preserveScore = false } = {}) {
  const nextScore = preserveScore ? score : 0;
  const nextLevel = preserveScore ? currentLevel : 1;
  gameOver = false;
  resetButton.disabled = false;
  resizeCanvas();
  if (runner) Runner.stop(runner);
  if (render) Render.stop(render);

  if (engine) clearFruitLinks();
  engine = Engine.create();
  engine.gravity.y = 1.05;
  render = Render.create({
    canvas,
    engine,
    options: {
      width,
      height,
      wireframes: false,
      background: "transparent",
      pixelRatio: window.devicePixelRatio,
    },
  });
  runner = Runner.create();
  currentLevel = nextLevel;
  setLevelWeather(currentLevel);
  levelEl.textContent = String(currentLevel);
  levelChanging = false;
  currentFruitIndex = 0;
  usedFruitIds = new Set();
  fruitUseCounts = new Map();
  if (!preserveScore) {
    unlockedFruitIds = new Set(["banana", "mandarina"]);
    collectedKeyCount = 0;
    pendingFruitChoices = 0;
    lives = isChallenge ? 4 : 6;
    updateLives();
    bestTrajectory = [];
    activeTrajectory = [];
    replayButton.disabled = true;
    announcedFruitIds = new Set();
    pearPowerAnnounced = false;
  }
  levelHasStarted = false;
  levelLaunchCount = 0;
  launched = false;
  breakParticles = [];
  clearPowerTimers();
  setScore(nextScore);
  setMessage(currentLevel === 1 ? "Nivel 1: empieza con Banana y Mandarina" : `Nivel ${currentLevel}: elige una fruta`);

  makeGround();
  const anchor = makeCatapult();
  makeCastle();
  makeFruit(anchor, 0);
  setupCollisions();
  setupMouse();

  Events.on(engine, "afterUpdate", () => {
    if (currentFruit?.wasLaunched && Composite.get(engine.world, currentFruit.id, "body")) {
      activeTrajectory.push({ x: currentFruit.position.x, y: currentFruit.position.y });
      if (activeTrajectory.length > bestTrajectory.length) {
        bestTrajectory = activeTrajectory.slice();
        replayButton.disabled = bestTrajectory.length < 8;
      }
    }
    checkFallenVegetables();
    removeStoppedFruits();
  });
  Events.on(engine, "beforeUpdate", applySpecialFruitPhysics);
  Events.on(render, "beforeRender", drawBackground);
  Events.on(render, "afterRender", () => {
    drawLabels();
    drawWeatherEffects(render.context);
    drawParticles();
  });

  Render.run(render);
  Runner.run(runner, engine);
}

resetButton.addEventListener("click", () => {
  if (levelChanging || gameOver || keyChoiceOpen) return;
  getAudioContext();
  lives -= 1;
  updateLives();
  if (lives <= 0) {
    finishGame();
    return;
  }
  resetFruitsAfterLife();
  setMessage(`Te quedan ${lives} vidas`);
});
canvas.addEventListener("pointerdown", () => {
  if (launched && !levelChanging) triggerBananaBoomerang();
});
gameOverDialog.addEventListener("cancel", (event) => event.preventDefault());
homeButton.addEventListener("click", () => persistPlayerProgress());
document.querySelector("#headerHomeButton").addEventListener("click", persistPlayerProgress);
replayButton.addEventListener("click", () => {
  if (bestTrajectory.length < 2) return;
  replayStartedAt = gameNow();
  setMessage("Repeticion del mejor tiro");
});
fruitCards.forEach((card, index) => {
  card.addEventListener("click", () => chooseFruit(index));
});
window.addEventListener("resize", () => {
  if (gameOver || keyChoiceOpen) return;
  window.clearTimeout(window.resizeGameTimer);
  window.resizeGameTimer = window.setTimeout(() => startGame({ preserveScore: true }), 250);
});
window.addEventListener("pagehide", persistPlayerProgress);

keyChoiceDialog.addEventListener("cancel", event => event.preventDefault());
updateLives();
startGame();
showKeyChoice();
