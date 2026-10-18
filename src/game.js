import { renderLeaderboard, submitScore } from "./ranking.js?v=20261018-2";

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
const livesEl = document.querySelector("#lives");
const messageEl = document.querySelector("#message");
const resetButton = document.querySelector("#resetButton");
const fruitCards = [...document.querySelectorAll(".fruit-card")];
const gameOverDialog = document.querySelector("#gameOverDialog");
const finalScoreEl = document.querySelector("#finalScore");
const scoreForm = document.querySelector("#scoreForm");
const playerNameInput = document.querySelector("#playerName");
const scoreStatus = document.querySelector("#scoreStatus");
const gameLeaderboard = document.querySelector("#gameLeaderboard");

const fruits = [
  { id: "banana", name: "Banana", emoji: "🍌", color: "#ffe066", radius: scale(28), density: 0.0016 },
  { id: "mandarina", name: "Mandarina", emoji: "🍊", color: "#ff9f1c", radius: scale(25), density: 0.0013 },
  { id: "manzana", name: "Manzana", emoji: "🍎", color: "#ff4d5a", radius: scale(27), density: 0.0015 },
  { id: "pera", name: "Pera", emoji: "🍐", color: "#9fd356", radius: scale(29), density: 0.0017 },
  { id: "sandia", name: "Sandia Furia", emoji: "🍉", color: "#1fbf75", radius: scale(36), density: 0.0012, unlockScore: 1000 },
  { id: "uvas", name: "Uvas Bomba", emoji: "🍇", color: "#7b3fc5", radius: scale(29), density: 0.002, unlockScore: 5000 },
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
let lives = 3;
let breakParticles = [];
let catapultParts = [];
let vegetablesLeft = 0;
let powerTimers = [];
let currentLevel = 1;
let levelChanging = false;
let levelHasStarted = false;
let usedFruitIds = new Set();
let unlockedFruitIds = new Set(["banana", "mandarina", "manzana", "pera"]);
let sandiaAnnounced = false;
let uvasAnnounced = false;
let pearPowerAnnounced = false;
let audioContext;
let lastCollisionSoundAt = 0;
let levelBodies = [];
let plant = null;
let plantMouthOpenUntil = 0;
let plantHasEaten = false;
let structureActivated = false;
let structureActivatedAt = 0;
let gameOver = false;

function finishGame() {
  gameOver = true;
  Runner.stop(runner);
  Render.stop(render);
  resetButton.disabled = true;
  finalScoreEl.textContent = String(score);
  scoreForm.hidden = score <= 0;
  scoreStatus.textContent = "";
  renderLeaderboard(gameLeaderboard);
  gameOverDialog.showModal();
  if (score > 0) playerNameInput.focus();
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
  const now = performance.now();
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
  [220, 330, 440, 660].forEach((frequency, index) => {
    window.setTimeout(() => {
      playTone({ frequency, duration: 0.13, type: "triangle", volume: 0.09 });
    }, index * 90);
  });
}

function setScore(nextScore) {
  score = nextScore;
  scoreEl.textContent = String(score);
  updateUnlocks();
}

function updateLives() {
  livesEl.textContent = "♥".repeat(lives) + "♡".repeat(3 - lives);
  livesEl.setAttribute("aria-label", `${lives} vidas`);
}

function updateUnlocks() {
  fruits.forEach((fruit) => {
    if (fruit.unlockScore && score >= fruit.unlockScore && !unlockedFruitIds.has(fruit.id)) {
      unlockedFruitIds.add(fruit.id);
      if (fruit.id === "sandia" && !sandiaAnnounced) {
        sandiaAnnounced = true;
        setMessage("¡Nueva fruta: Sandia Furia!");
      }
      if (fruit.id === "uvas" && !uvasAnnounced) {
        uvasAnnounced = true;
        setMessage("¡Nueva fruta: Uvas Bomba!");
      }
    }
  });
  if (score >= 3000 && !pearPowerAnnounced) {
    pearPowerAnnounced = true;
    setMessage("¡La pera consiguio el escudo anticaida!");
  }
  updateFruitTray();
}

function isFruitUnlocked(fruit) {
  return !fruit.unlockScore || unlockedFruitIds.has(fruit.id);
}

function clearPowerTimers() {
  powerTimers.forEach((timer) => window.clearTimeout(timer));
  powerTimers = [];
}

function addPowerTimer(callback, delay) {
  const timer = window.setTimeout(callback, delay);
  powerTimers.push(timer);
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
  structureActivatedAt = performance.now();

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
  const anchor = getCatapultAnchor();
  const post = Bodies.rectangle(anchor.x, anchor.y + CATAPULT_HEIGHT / 2, scale(16), CATAPULT_HEIGHT, {
    isStatic: true,
    isSensor: true,
    label: "catapult",
    render: { visible: false },
  });
  const foot = Bodies.rectangle(anchor.x, anchor.y + CATAPULT_HEIGHT, scale(72), scale(14), {
    isStatic: true,
    isSensor: true,
    label: "catapult",
    render: { visible: false },
  });
  catapultParts = [post, foot];
  Composite.add(engine.world, catapultParts);
  return anchor;
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
    restitution: 0.52,
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
    restitution: 0.52,
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
    restitution: 0.52,
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
  const maxHealth = Math.round(baseHealth * (options.healthMultiplier || 1));
  body.game = {
    ...veggie,
    ...options,
    broken: false,
    size: actualSize,
    health: maxHealth,
    maxHealth,
    lastDamageAt: 0,
  };
  vegetablesLeft += 1;
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

function makeTnt(x, y) {
  return makeGlassBlock(x, y, 42, 42);
}

function makePlant() {
  plant = null;
  plantHasEaten = false;
  if (currentLevel <= 4) return;
  plant = Bodies.circle(width * (0.48 + Math.random() * 0.12), height - scale(76), scale(38), {
    isStatic: true,
    isSensor: true,
    label: "plant",
    render: { visible: false },
  });
  Composite.add(engine.world, plant);
}

function makeCastle() {
  levelBodies = [];
  structureActivated = false;
  structureActivatedAt = 0;
  makeProgressiveCastle(currentLevel);
  makePlant();
}

function makeProgressiveCastle(level) {
  vegetablesLeft = 0;
  const floorY = height - scale(64);
  const moduleCount = Math.min(4, 1 + Math.floor((level - 1) / 2));
  const regularCount = Math.min(11, level + 1);
  const hasKing = level % 3 === 0;
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
      const roof = level >= 3 && (moduleIndex + level) % 3 === 0 ? makeGlassBlock : makeBlock;
      bodies.push(roof(x, floorY - scale(151), moduleWidth * 0.86, 18));
      slots.push({ x, y: floorY - scale(186), moduleIndex });
    }
  }

  if (hasKing) {
    const kingX = startX + (moduleCount - 1) * moduleGap;
    const kingSlot = slots.find((slot) => slot.moduleIndex === moduleCount - 1 && slot.y === floorY - scale(31));
    if (kingSlot) slots.splice(slots.indexOf(kingSlot), 1);
    const kingRank = level / 3;
    bodies.push(
      makeVegetable(kingX, floorY - scale(31), vegetables[0], 31, {
        name: "Rey Brocoli",
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
    bodies.push(makeVegetable(slot.x + scale(row * 14), slot.y - scale(row * 8), veggie, isEasy ? 21 : 24, { healthMultiplier }));
  }

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

function collisionEnergy(attacker, target) {
  if (!attacker || !target) return 0;
  const relativeVelocity = Vector.sub(attacker.velocity, target.velocity);
  const relativeSpeed = Vector.magnitude(relativeVelocity);
  return 0.5 * attacker.mass * relativeSpeed * relativeSpeed;
}

function damageVegetable(body, energy, source = null) {
  if (!body || body.game.broken || energy < 16) return;
  const now = performance.now();
  if (now - body.game.lastDamageAt < 160) return;
  body.game.lastDamageAt = now;

  let damage = energy / Math.max(0.65, body.game.toughness);
  if (body.game.size >= 29 && source?.game?.id !== "sandia") {
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
  if (projectile?.label === "fruit" && (projectile.woodBlocksBroken || 0) >= 2) return false;

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

function breakVegetable(body) {
  if (body.game.broken) return;
  body.game.broken = true;
  playBreakSound();
  addBreak(body.position.x, body.position.y, body.game.color, body.game.emoji);
  Composite.remove(engine.world, body);
  vegetablesLeft -= 1;
  setScore(score + 100);
  if (vegetablesLeft <= 0) {
    finishLevel();
  } else {
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
  addBreak(body.position.x, body.position.y, isGlass ? "#b9f2ff" : "#9a704d", isGlass ? "✦" : "▪");
  playBreakSound();
  Composite.remove(engine.world, body);
  setScore(score + (isGlass ? 35 : 20));
  setMessage(isGlass ? "¡Cristal roto!" : "¡Madera rota!");
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
  if (performance.now() - structureActivatedAt < 650) return;

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
  const now = performance.now();

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

function applySpecialFruitPhysics() {
  Composite.allBodies(engine.world).forEach((body) => {
    if (body.label !== "fruit" || !body.wasLaunched) return;

    if (body.game.id === "sandia") {
      Body.applyForce(body, body.position, {
        x: 0,
        y: -body.mass * engine.gravity.y * engine.gravity.scale,
      });
    }

    if (body.game.id === "pera" && score >= 3000 && body.position.y > height - 24) {
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
}

function clearLevelBodies({ clearTimers = true } = {}) {
  Composite.allBodies(engine.world).forEach((body) => {
    if (["block", "glassBlock", "steelBlock", "vegetable", "fruit", "seed", "tnt", "plant"].includes(body.label)) {
      Composite.remove(engine.world, body);
    }
  });
  if (sling) {
    Composite.remove(engine.world, sling);
    sling = null;
  }
  currentFruit = null;
  plant = null;
  levelBodies = [];
  structureActivated = false;
  structureActivatedAt = 0;
  if (clearTimers) clearPowerTimers();
}

function finishLevel() {
  if (levelChanging) return;
  levelChanging = true;
  clearPowerTimers();
  const nextLevel = currentLevel + 1;
  setMessage(`¡Nivel ${nextLevel}!`);
  playLevelSound();
  addPowerTimer(() => {
    currentLevel = nextLevel;
    currentFruitIndex = 0;
    usedFruitIds = new Set();
    levelHasStarted = false;
    launched = false;
    breakParticles = [];
    clearLevelBodies({ clearTimers: false });
    makeCastle();
    levelChanging = false;
    makeFruit(getCatapultAnchor(), 0);
    updateFruitTray();
    setMessage(`Nivel ${currentLevel}: mas verduras`);
  }, 1300);
}

function activatePower(fruitBody) {
  if (!fruitBody || !fruitBody.game) return;

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

  if (fruitBody.game.id === "banana") {
    fruitBody.boomerangReadyAt = performance.now() + 260;
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

      for (let i = 0; i < 5; i += 1) {
        const angle = -0.72 + i * 0.36;
        const speed = 5.8 + Math.abs(base.x) * 0.38;
        const gajo = makeFlyingFruit(x, y, fruitBody.game, 13, {
          x: base.x * 0.72 + Math.cos(angle) * speed,
          y: base.y * 0.72 + Math.sin(angle) * speed,
        });
        Body.setAngularVelocity(gajo, (i - 2) * 0.18);
      }
      setMessage("¡Cinco gajos!");
    }, 420);
  }

  if (fruitBody.game.id === "manzana") {
    addPowerTimer(() => {
      if (!Composite.get(engine.world, fruitBody.id, "body")) return;
      const base = { x: Math.max(6, fruitBody.velocity.x), y: fruitBody.velocity.y };

      for (let i = 0; i < 6; i += 1) {
        const spread = (i - 2.5) * 0.85;
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
    addPowerTimer(() => {
      if (!Composite.get(engine.world, fruitBody.id, "body")) return;
      Body.setVelocity(fruitBody, {
        x: fruitBody.velocity.x * 1.35 + 2,
        y: fruitBody.velocity.y - 2.5,
      });
      Body.scale(fruitBody, 1.12, 1.12);
      Body.setAngularVelocity(fruitBody, 0.35);
      addBreak(fruitBody.position.x, fruitBody.position.y, "#ff4d5a", "💥");
      setMessage("¡Sandia Furia!");
    }, 260);
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

      for (let i = 0; i < 7; i += 1) {
        const angle = -0.85 + i * 0.28;
        const grape = makeFlyingFruit(x, y, { ...fruitBody.game, grapeBomb: true, emoji: "●" }, 11, {
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
  const banana = Composite.allBodies(engine.world).find(
    (body) =>
      body.label === "fruit" &&
      body.wasLaunched &&
      body.game?.id === "banana" &&
      !body.boomerangUsed &&
      performance.now() >= (body.boomerangReadyAt || Infinity),
  );
  if (!banana) return;
  banana.boomerangUsed = true;
  Body.setVelocity(banana, {
    x: -Math.max(12, Math.abs(banana.velocity.x) * 1.2 + 3),
    y: Math.min(-4, banana.velocity.y - 5.5),
  });
  Body.setAngularVelocity(banana, -0.9);
  addBreak(banana.position.x, banana.position.y, "#fff06b", "↩");
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

function schedulePlantAttack() {
  if (!plant || plantHasEaten) return;

  function tryToEat(attemptsLeft) {
    if (!plant || plantHasEaten || levelChanging) return;
    const flyingFruits = Composite.allBodies(engine.world).filter(
      (body) => body.label === "fruit" && body.wasLaunched && body.speed > 1 && body.position.y < height - 58,
    );

    if (!flyingFruits.length) {
      if (attemptsLeft > 0) addPowerTimer(() => tryToEat(attemptsLeft - 1), 280);
      return;
    }

    const victim = flyingFruits[Math.floor(Math.random() * flyingFruits.length)];
    plantHasEaten = true;
    plantMouthOpenUntil = performance.now() + 850;
    addBreak(victim.position.x, victim.position.y, "#79c943", "CHOMP!");
    addBreak(plant.position.x, plant.position.y - 24, "#e53950", "🌿");
    Composite.remove(engine.world, victim);
    setMessage("¡ÑAM! La planta se comio la fruta");
    playNoise({ duration: 0.28, volume: 0.14, filterFrequency: 380 });
  }

  addPowerTimer(() => tryToEat(6), 720 + Math.random() * 520);
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
  clearPowerTimers();
  Composite.allBodies(engine.world).forEach((body) => {
    if (["fruit", "seed"].includes(body.label)) {
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
    card.innerHTML = `${isLocked ? "🔒" : fruit.emoji} <span>${fruit.name.replace(" Furia", "")}</span>`;
    card.classList.toggle("active", index === currentFruitIndex && !isUsed && !isLocked && !launched);
    card.classList.toggle("used", isUsed);
    card.classList.toggle("locked", isLocked);
    card.classList.toggle("unlocked", ["sandia", "uvas"].includes(fruit.id) && !isLocked && !isUsed);
    card.classList.toggle("powered", fruit.id === "pera" && score >= 3000 && !isUsed);
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

  Composite.allBodies(engine.world).forEach((body) => {
    if (body.label === "fruit" && body.game) {
      drawAngryFruit(ctx, body);
    }
    if (body.label === "vegetable" && body.game && !body.game.broken) {
      drawScaredVegetable(ctx, body);
    }
    if (body.label === "seed") {
      drawSeed(ctx, body);
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
  });

  drawPlant(ctx);

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

  drawCatapult(ctx);

  ctx.restore();
}

function drawCatapult(ctx) {
  if (!catapultParts.length) return;
  const anchor = getCatapultAnchor();

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "#58351f";
  ctx.lineWidth = scale(12);
  ctx.beginPath();
  ctx.moveTo(anchor.x, anchor.y + scale(18));
  ctx.lineTo(anchor.x, anchor.y + CATAPULT_HEIGHT);
  ctx.stroke();

  ctx.strokeStyle = "#99613a";
  ctx.lineWidth = scale(10);
  ctx.beginPath();
  ctx.moveTo(anchor.x - scale(25), anchor.y + CATAPULT_HEIGHT + scale(4));
  ctx.lineTo(anchor.x + scale(25), anchor.y + CATAPULT_HEIGHT + scale(4));
  ctx.stroke();

  ctx.strokeStyle = "#45291d";
  ctx.lineWidth = scale(6);
  ctx.beginPath();
  ctx.moveTo(anchor.x - scale(18), anchor.y + scale(22));
  ctx.lineTo(anchor.x, anchor.y);
  ctx.lineTo(anchor.x + scale(18), anchor.y + scale(22));
  ctx.stroke();

  if (currentFruit && !launched) {
    ctx.strokeStyle = "#362018";
    ctx.lineWidth = scale(5);
    ctx.beginPath();
    ctx.moveTo(anchor.x - scale(18), anchor.y + scale(22));
    ctx.lineTo(currentFruit.position.x, currentFruit.position.y);
    ctx.lineTo(anchor.x + scale(18), anchor.y + scale(22));
    ctx.stroke();
  }

  ctx.restore();
}

function drawPlant(ctx) {
  if (!plant) return;
  const x = plant.position.x;
  const y = plant.position.y;
  const mouthOpen = performance.now() < plantMouthOpenUntil;

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

  if (body.game.id === "pera" && score >= 3000) {
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
  const radius = body.circleRadius || body.game.size || 24;
  const x = body.position.x;
  const y = body.position.y;
  const faceScale = Math.max(0.55, radius / 27);

  if (body.game.isKing) {
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
      const block = bodies.find((body) => body.label === "block");
      const glassBlock = bodies.find((body) => body.label === "glassBlock");
      const steelBlock = bodies.find((body) => body.label === "steelBlock");
      const tnt = bodies.find((body) => body.label === "tnt");
      const speed = fruit ? Vector.magnitude(fruit.velocity) : Math.max(pair.bodyA.speed, pair.bodyB.speed);
      const hitSpeed = Math.max(pair.bodyA.speed, pair.bodyB.speed);
      const launchedFruit = fruit?.wasLaunched ? fruit : null;
      const projectile = launchedFruit || seed;
      const structureBody = veggie || block || glassBlock || steelBlock || tnt;

      if (levelHasStarted && projectile && structureBody) {
        activateStructure(structureBody, { ...projectile.velocity });
      }

      const grapeHitSurface = bodies.some((body) =>
        ["ground", "block", "glassBlock", "steelBlock", "vegetable", "tnt"].includes(body.label),
      );
      if (launchedFruit?.game?.grapeBomb && grapeHitSurface && hitSpeed > 1.4) {
        explodeGrape(launchedFruit);
        return;
      }

      if (steelBlock && launchedFruit && launchedFruit.game.id === "sandia" && speed > 3.2) {
        breakSteel(steelBlock);
        return;
      }
      if (steelBlock && (launchedFruit || seed)) {
        setMessage("El acero solo se rompe con la sandia");
        return;
      }

      if (glassBlock && launchedFruit && hitSpeed > 2.2) {
        breakBuildingBlock(glassBlock);
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
      } else if (levelHasStarted && veggie && block && block.speed > 3.2) {
        damageVegetable(veggie, collisionEnergy(block, veggie), block);
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
      levelHasStarted = true;
      launchedFruit.wasLaunched = true;
      setFruitDraggable(launchedFruit, false);
      schedulePlantAttack();
      usedFruitIds.add(launchedFruit.game.id);
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
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#532b55");
  sky.addColorStop(0.3, "#bd3f4f");
  sky.addColorStop(0.57, "#ff8a3d");
  sky.addColorStop(0.58, "#4c3138");
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

  ctx.fillStyle = "#ffcf3f";
  ctx.beginPath();
  ctx.arc(width * 0.1, 58, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 64, 47, 0.75)";
  ctx.lineWidth = 18;
  ctx.stroke();

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

  ctx.strokeStyle = "#ffe967";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(width * 0.5, 120);
  ctx.lineTo(width * 0.47, 177);
  ctx.lineTo(width * 0.505, 170);
  ctx.lineTo(width * 0.475, 235);
  ctx.stroke();

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
  ctx.restore();
}

function startGame({ preserveScore = false } = {}) {
  const nextScore = preserveScore ? score : 0;
  gameOver = false;
  resetButton.disabled = false;
  resizeCanvas();
  if (runner) Runner.stop(runner);
  if (render) Render.stop(render);

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
  currentLevel = 1;
  levelChanging = false;
  currentFruitIndex = 0;
  usedFruitIds = new Set();
  unlockedFruitIds = new Set(["banana", "mandarina", "manzana", "pera"]);
  if (!preserveScore) {
    sandiaAnnounced = false;
    uvasAnnounced = false;
    pearPowerAnnounced = false;
  }
  levelHasStarted = false;
  launched = false;
  breakParticles = [];
  clearPowerTimers();
  setScore(nextScore);
  setMessage("Nivel 1: elige una fruta");

  makeGround();
  const anchor = makeCatapult();
  makeCastle();
  makeFruit(anchor, 0);
  setupCollisions();
  setupMouse();

  Events.on(engine, "afterUpdate", () => {
    checkFallenVegetables();
    removeStoppedFruits();
  });
  Events.on(engine, "beforeUpdate", applySpecialFruitPhysics);
  Events.on(render, "beforeRender", drawBackground);
  Events.on(render, "afterRender", () => {
    drawLabels();
    drawParticles();
  });

  Render.run(render);
  Runner.run(runner, engine);
}

resetButton.addEventListener("click", () => {
  if (levelChanging || gameOver) return;
  getAudioContext();
  lives -= 1;
  updateLives();
  if (lives <= 0) {
    finishGame();
    return;
  }
  resetFruitsAfterLife();
  playLevelSound();
  setMessage(`Te quedan ${lives} vidas`);
});
canvas.addEventListener("pointerdown", () => {
  if (launched && !levelChanging) triggerBananaBoomerang();
});
scoreForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = scoreForm.querySelector("button");
  submitButton.disabled = true;
  scoreStatus.textContent = "Guardando...";
  try {
    await submitScore(playerNameInput.value, score);
    scoreStatus.textContent = "¡Puntuacion guardada!";
    playerNameInput.disabled = true;
    await renderLeaderboard(gameLeaderboard);
  } catch (error) {
    scoreStatus.textContent = error.message;
    submitButton.disabled = false;
  }
});
gameOverDialog.addEventListener("cancel", (event) => event.preventDefault());
fruitCards.forEach((card, index) => {
  card.addEventListener("click", () => chooseFruit(index));
});
window.addEventListener("resize", () => {
  if (gameOver) return;
  window.clearTimeout(window.resizeGameTimer);
  window.resizeGameTimer = window.setTimeout(() => startGame({ preserveScore: true }), 250);
});

updateLives();
startGame();
