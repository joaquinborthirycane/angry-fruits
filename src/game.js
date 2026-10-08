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

const canvas = document.querySelector("#gameCanvas");
const stage = document.querySelector(".stage-wrap");
const scoreEl = document.querySelector("#score");
const messageEl = document.querySelector("#message");
const resetButton = document.querySelector("#resetButton");
const fruitCards = [...document.querySelectorAll(".fruit-card")];

const fruits = [
  { id: "banana", name: "Banana", emoji: "🍌", color: "#ffe066", radius: 28, density: 0.0016 },
  { id: "mandarina", name: "Mandarina", emoji: "🍊", color: "#ff9f1c", radius: 25, density: 0.0013 },
  { id: "manzana", name: "Manzana", emoji: "🍎", color: "#ff4d5a", radius: 27, density: 0.0015 },
  { id: "pera", name: "Pera", emoji: "🍐", color: "#9fd356", radius: 29, density: 0.0017 },
  { id: "sandia", name: "Sandia Furia", emoji: "🍉", color: "#1fbf75", radius: 36, density: 0.0075, unlockScore: 1000 },
];

const vegetables = [
  { name: "Brocoli", emoji: "🥦", color: "#31b96e" },
  { name: "Zanahoria", emoji: "🥕", color: "#ff8c1a" },
  { name: "Berenjena", emoji: "🍆", color: "#7c4cc2" },
  { name: "Tomate", emoji: "🍅", color: "#ef3e36" },
  { name: "Maiz", emoji: "🌽", color: "#ffd447" },
];

let width = stage.clientWidth;
let height = stage.clientHeight;
let engine;
let render;
let runner;
let sling;
let currentFruit;
let currentFruitIndex = 0;
let launched = false;
let score = 0;
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
let audioContext;
let lastCollisionSoundAt = 0;

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
  playTone({ frequency: 170, slideTo: 520, duration: 0.18, type: "triangle", volume: 0.12 });
  playTone({ frequency: 90, slideTo: 160, duration: 0.1, type: "sine", volume: 0.08 });
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

function updateUnlocks() {
  fruits.forEach((fruit) => {
    if (fruit.unlockScore && score >= fruit.unlockScore && !unlockedFruitIds.has(fruit.id)) {
      unlockedFruitIds.add(fruit.id);
      if (fruit.id === "sandia" && !sandiaAnnounced) {
        sandiaAnnounced = true;
        setMessage("¡Nueva fruta: Sandia Furia!");
      }
    }
  });
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

function makeGround() {
  const ground = Bodies.rectangle(width / 2, height - 18, width + 120, 44, {
    isStatic: true,
    label: "ground",
    render: { fillStyle: "#6dbb45" },
  });
  const leftWall = Bodies.rectangle(-32, height / 2, 64, height, { isStatic: true, render: { visible: false } });
  const rightWall = Bodies.rectangle(width + 32, height / 2, 64, height, { isStatic: true, render: { visible: false } });
  Composite.add(engine.world, [ground, leftWall, rightWall]);
}

function makeCatapult() {
  const baseX = Math.max(245, width * 0.18);
  const baseY = height - 78;
  const frameLeft = Bodies.rectangle(baseX - 54, baseY + 16, 18, 124, {
    isStatic: true,
    angle: -0.28,
    label: "catapult",
    render: { visible: false },
  });
  const frameRight = Bodies.rectangle(baseX + 18, baseY + 12, 18, 118, {
    isStatic: true,
    angle: 0.26,
    label: "catapult",
    render: { visible: false },
  });
  const base = Bodies.rectangle(baseX - 18, baseY + 70, 132, 22, {
    isStatic: true,
    label: "catapult",
    render: { visible: false },
  });
  const arm = Bodies.rectangle(baseX - 8, baseY - 12, 118, 18, {
    isStatic: true,
    angle: -0.36,
    label: "catapult",
    render: { visible: false },
  });
  const cup = Bodies.circle(baseX + 44, baseY - 34, 34, {
    isStatic: true,
    label: "catapult",
    render: { visible: false },
  });
  catapultParts = [frameLeft, frameRight, base, arm, cup];
  Composite.add(engine.world, catapultParts);
  return { x: baseX + 44, y: baseY - 48 };
}

function getCatapultAnchor() {
  return { x: Math.max(245, width * 0.18) + 44, y: height - 126 };
}

function makeFruit(anchor, fruitIndex = currentFruitIndex) {
  const fruit = fruits[fruitIndex];
  currentFruitIndex = fruitIndex;
  const core = Bodies.circle(anchor.x, anchor.y, fruit.radius, {
    label: "fruitCore",
    density: fruit.density,
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
    density: fruit.density,
    restitution: 0.52,
    frictionAir: 0.012,
  });
  body.game = fruit;
  currentFruit = body;
  sling = Constraint.create({
    pointA: anchor,
    bodyB: currentFruit,
    stiffness: 0.075,
    damping: 0.01,
    render: { strokeStyle: "#5b371f", lineWidth: 7 },
  });
  Composite.add(engine.world, [currentFruit, sling]);
  updateFruitTray();
}

function makeFlyingFruit(x, y, fruit, radius, velocity) {
  const body = Bodies.circle(x, y, radius, {
    label: "fruit",
    density: fruit.density,
    restitution: 0.52,
    frictionAir: 0.012,
    render: { fillStyle: fruit.color },
  });
  body.game = fruit;
  Body.setVelocity(body, velocity);
  Composite.add(engine.world, body);
  return body;
}

function makeSeed(x, y, velocity) {
  const body = Bodies.circle(x, y, 7, {
    label: "seed",
    density: 0.0012,
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
  if (body.label === "fruit") return body;
  if (body.parent && body.parent.label === "fruit") return body.parent;
  return null;
}

function getVegetableBody(body) {
  if (body.label === "vegetable") return body;
  if (body.parent && body.parent.label === "vegetable") return body.parent;
  return null;
}

function makeVegetable(x, y, veggie, size = 25) {
  const body = Bodies.circle(x, y, size, {
    label: "vegetable",
    restitution: 0.32,
    friction: 0.85,
    render: { fillStyle: veggie.color },
  });
  body.game = { ...veggie, broken: false, size };
  vegetablesLeft += 1;
  return body;
}

function makeBlock(x, y, w, h) {
  return Bodies.rectangle(x, y, w, h, {
    label: "block",
    density: 0.0022,
    friction: 0.9,
    restitution: 0.12,
    render: { fillStyle: "#8f6f52" },
  });
}

function makeTnt(x, y) {
  const body = Bodies.rectangle(x, y, 42, 42, {
    label: "tnt",
    density: 0.0018,
    friction: 0.82,
    restitution: 0.18,
    render: { fillStyle: "#e53935" },
  });
  body.game = { exploded: false, hp: 2 };
  return body;
}

function makeLevelOneCastle() {
  vegetablesLeft = 0;
  const startX = width * 0.72;
  const floorY = height - 64;
  const bodies = [
    makeBlock(startX - 72, floorY - 30, 24, 72),
    makeBlock(startX + 72, floorY - 30, 24, 72),
    makeBlock(startX, floorY - 76, 174, 22),
    makeVegetable(startX - 34, floorY - 120, vegetables[0], 27),
    makeVegetable(startX + 38, floorY - 119, vegetables[1], 25),
    makeBlock(startX - 20, floorY - 158, 24, 60),
    makeBlock(startX + 72, floorY - 158, 24, 60),
    makeBlock(startX + 26, floorY - 195, 126, 20),
    makeVegetable(startX + 26, floorY - 236, vegetables[2], 27),
    makeVegetable(startX + 118, floorY - 42, vegetables[3], 25),
    makeVegetable(startX - 122, floorY - 42, vegetables[4], 25),
  ];
  Composite.add(engine.world, bodies);
}

function makeLevelTwoCastle() {
  vegetablesLeft = 0;
  const startX = width * 0.72;
  const floorY = height - 64;
  const bodies = [
    makeBlock(startX - 108, floorY - 26, 24, 64),
    makeBlock(startX - 36, floorY - 26, 24, 64),
    makeBlock(startX + 36, floorY - 26, 24, 64),
    makeBlock(startX + 108, floorY - 26, 24, 64),
    makeBlock(startX, floorY - 66, 250, 20),
    makeVegetable(startX - 140, floorY - 44, vegetables[0], 24),
    makeVegetable(startX + 140, floorY - 44, vegetables[1], 24),

    makeBlock(startX - 82, floorY - 110, 24, 70),
    makeBlock(startX, floorY - 110, 24, 70),
    makeBlock(startX + 82, floorY - 110, 24, 70),
    makeBlock(startX, floorY - 152, 200, 20),
    makeVegetable(startX - 42, floorY - 108, vegetables[2], 25),
    makeVegetable(startX + 42, floorY - 108, vegetables[3], 25),

    makeBlock(startX - 52, floorY - 194, 24, 68),
    makeBlock(startX + 52, floorY - 194, 24, 68),
    makeBlock(startX, floorY - 234, 146, 20),
    makeVegetable(startX - 92, floorY - 194, vegetables[4], 24),
    makeVegetable(startX + 92, floorY - 194, vegetables[0], 24),

    makeBlock(startX - 28, floorY - 274, 24, 62),
    makeBlock(startX + 28, floorY - 274, 24, 62),
    makeBlock(startX, floorY - 312, 96, 18),
    makeVegetable(startX, floorY - 272, vegetables[1], 25),
    makeVegetable(startX - 44, floorY - 348, vegetables[2], 23),
    makeVegetable(startX + 44, floorY - 348, vegetables[3], 23),

    makeBlock(startX, floorY - 382, 78, 18),
    makeVegetable(startX, floorY - 422, vegetables[4], 25),
  ];
  Composite.add(engine.world, bodies);
}

function makeCastle() {
  if (currentLevel >= 3) {
    makeGeneratedCastle(currentLevel);
  } else if (currentLevel === 2) {
    makeLevelTwoCastle();
  } else {
    makeLevelOneCastle();
  }
}

function makeGeneratedCastle(level) {
  vegetablesLeft = 0;
  const startX = width * 0.68;
  const floorY = height - 64;
  const pattern = level % 4;
  const difficulty = Math.min(level - 3, 6);
  const baseWidth = Math.min(470, 330 + difficulty * 24);
  const bodies = [];

  function addPlatform(y, w, thickness = 20) {
    bodies.push(makeBlock(startX, y, w, thickness));
  }

  function addSupports(y, positions, h = 66) {
    positions.forEach((x) => bodies.push(makeBlock(startX + x, y, 22, h)));
  }

  function addVeggies(y, positions, offset = level) {
    positions.forEach((x, index) => {
      bodies.push(makeVegetable(startX + x, y, vegetables[(offset + index) % vegetables.length], 23));
    });
  }

  if (pattern === 0) {
    addSupports(floorY - 28, [-baseWidth / 2, -baseWidth / 6, baseWidth / 6, baseWidth / 2]);
    addPlatform(floorY - 70, baseWidth + 44);
    addVeggies(floorY - 108, [-baseWidth / 3, 0, baseWidth / 3]);
    bodies.push(makeTnt(startX, floorY - 108));

    addSupports(floorY - 132, [-baseWidth / 3, 0, baseWidth / 3], 64);
    addPlatform(floorY - 174, baseWidth - 64);
    addVeggies(floorY - 214, [-baseWidth / 4, baseWidth / 4], 2);

    addSupports(floorY - 236, [-70, 70], 62);
    addPlatform(floorY - 274, 178);
    addVeggies(floorY - 314, [0], 4);
  } else if (pattern === 1) {
    addSupports(floorY - 28, [-baseWidth / 2, baseWidth / 2], 72);
    addPlatform(floorY - 74, baseWidth + 70);
    addVeggies(floorY - 112, [-baseWidth / 2 - 36, 0, baseWidth / 2 + 36]);

    addSupports(floorY - 136, [-baseWidth / 2 + 42, baseWidth / 2 - 42], 118);
    addPlatform(floorY - 206, baseWidth - 60);
    bodies.push(makeTnt(startX - 72, floorY - 154));
    bodies.push(makeTnt(startX + 72, floorY - 154));
    addVeggies(floorY - 246, [-baseWidth / 3, 0, baseWidth / 3], 3);

    addSupports(floorY - 268, [0], 72);
    addPlatform(floorY - 314, 150);
    addVeggies(floorY - 354, [-44, 44], 1);
  } else if (pattern === 2) {
    [-baseWidth / 3, baseWidth / 3].forEach((towerX, towerIndex) => {
      addSupports(floorY - 28, [towerX - 42, towerX + 42], 72);
      bodies.push(makeBlock(startX + towerX, floorY - 74, 116, 20));
      addVeggies(floorY - 114, [towerX], towerIndex);
      addSupports(floorY - 138, [towerX - 30, towerX + 30], 66);
      bodies.push(makeBlock(startX + towerX, floorY - 178, 96, 18));
      addVeggies(floorY - 216, [towerX - 30, towerX + 30], towerIndex + 2);
    });
    addPlatform(floorY - 254, baseWidth - 70);
    bodies.push(makeTnt(startX, floorY - 296));
    addVeggies(floorY - 296, [-96, 96], 4);
  } else {
    const steps = [-baseWidth / 2, -baseWidth / 4, 0, baseWidth / 4, baseWidth / 2];
    steps.forEach((x, index) => {
      const y = floorY - 28 - index * 54;
      bodies.push(makeBlock(startX + x, y, 24, 64));
      bodies.push(makeBlock(startX + x + 42, y - 40, 108, 18));
      bodies.push(makeVegetable(startX + x + 42, y - 78, vegetables[(level + index) % vegetables.length], 22));
      if (index === 1 || index === 3) bodies.push(makeTnt(startX + x + 82, y - 78));
    });
    addPlatform(floorY - 310, baseWidth - 90);
    addVeggies(floorY - 350, [-70, 0, 70], 2);
  }

  if (difficulty > 2) {
    addVeggies(floorY - 42, [-baseWidth / 2 - 54, baseWidth / 2 + 54], 1);
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
      size: 7 + Math.random() * 7,
    });
  }
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
      breakVegetable(target);
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
  if (!levelHasStarted || levelChanging) return;

  Composite.allBodies(engine.world).forEach((body) => {
    if (body.label === "tnt" && !body.game.exploded) {
      const tntHitGround = body.position.y > height - 82 && body.speed > 1.8;
      const tntFlyingFast = body.speed > 5.5;
      if (tntHitGround || tntFlyingFast) {
        damageTnt(body, 2);
      }
      return;
    }

    if (body.label !== "vegetable" || body.game.broken) return;

    const hitGroundHard = body.position.y > height - 82 && body.speed > 2.4;
    const flyingFast = body.speed > 8.5;
    if (hitGroundHard || flyingFast) {
      breakVegetable(body);
    }
  });
}

function clearLevelBodies({ clearTimers = true } = {}) {
  Composite.allBodies(engine.world).forEach((body) => {
    if (["block", "vegetable", "fruit", "seed", "tnt"].includes(body.label)) {
      Composite.remove(engine.world, body);
    }
  });
  if (sling) {
    Composite.remove(engine.world, sling);
    sling = null;
  }
  currentFruit = null;
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
    makeFruit(getCatapultAnchor(), 0);
    levelChanging = false;
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
    addPowerTimer(() => {
      if (!Composite.get(engine.world, fruitBody.id, "body")) return;
      Body.setVelocity(fruitBody, {
        x: -Math.abs(fruitBody.velocity.x) * 0.85,
        y: fruitBody.velocity.y - 5.8,
      });
      Body.setAngularVelocity(fruitBody, -0.55);
      addBreak(fruitBody.position.x, fruitBody.position.y, "#fff06b", "↩");
      setMessage("¡Banana bumeran!");
    }, 760);
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
    Body.setDensity(fruitBody, 0.009);
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
    card.classList.toggle("unlocked", fruit.id === "sandia" && !isLocked && !isUsed);
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
  });

  if (currentFruit && !launched) {
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.86)";
    ctx.fillStyle = "rgba(255, 255, 255, 0.13)";
    ctx.beginPath();
    ctx.roundRect(currentFruit.position.x - 46, currentFruit.position.y - 46, 92, 92, 16);
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
  const baseX = anchor.x - 44;
  const baseY = anchor.y + 48;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "#6d4428";
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(baseX - 78, baseY + 70);
  ctx.lineTo(baseX + 72, baseY + 70);
  ctx.stroke();

  ctx.strokeStyle = "#9b653a";
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(baseX - 58, baseY + 66);
  ctx.lineTo(baseX - 86, baseY - 36);
  ctx.moveTo(baseX + 24, baseY + 62);
  ctx.lineTo(baseX + 52, baseY - 38);
  ctx.stroke();

  ctx.strokeStyle = "#cf9058";
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(baseX - 56, baseY - 6);
  ctx.lineTo(baseX + 48, baseY - 42);
  ctx.stroke();

  ctx.fillStyle = "#efc087";
  ctx.strokeStyle = "#9b653a";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(anchor.x, anchor.y + 3, 44, 29, -0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#4b3628";
  ctx.beginPath();
  ctx.arc(baseX - 52, baseY + 76, 17, 0, Math.PI * 2);
  ctx.arc(baseX + 52, baseY + 76, 17, 0, Math.PI * 2);
  ctx.fill();

  if (currentFruit && !launched) {
    ctx.strokeStyle = "#5b371f";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(baseX - 80, baseY - 38);
    ctx.lineTo(currentFruit.position.x, currentFruit.position.y);
    ctx.lineTo(baseX + 54, baseY - 40);
    ctx.stroke();
  }

  ctx.restore();
}

function drawAngryFruit(ctx, body) {
  const radius = body.circleRadius || body.game.radius || 24;
  const x = body.position.x;
  const y = body.position.y;
  const faceScale = Math.max(0.56, radius / 28);

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
      const tnt = bodies.find((body) => body.label === "tnt");
      const speed = fruit ? Vector.magnitude(fruit.velocity) : Math.max(pair.bodyA.speed, pair.bodyB.speed);
      const hitSpeed = Math.max(pair.bodyA.speed, pair.bodyB.speed);

      if (tnt && levelHasStarted && fruit && speed > 1.8) {
        damageTnt(tnt, 2);
      } else if (tnt && levelHasStarted && seed && seed.speed > 2.2) {
        damageTnt(tnt, 1);
      } else if (tnt && levelHasStarted && block && block.speed > 1.8) {
        damageTnt(tnt, 2);
      } else if (tnt && levelHasStarted && bodies.some((body) => body.label === "ground") && tnt.speed > 1.8) {
        damageTnt(tnt, 2);
      } else if (tnt && levelHasStarted && hitSpeed > 5.5) {
        damageTnt(tnt, 2);
      } else if (veggie && fruit && speed > 2.8) {
        breakVegetable(veggie);
      } else if (veggie && seed && seed.speed > 3.3) {
        breakVegetable(veggie);
      } else if (levelHasStarted && veggie && block && block.speed > 3.2) {
        breakVegetable(veggie);
      } else if (levelHasStarted && veggie && bodies.some((body) => body.label === "ground") && veggie.speed > 2.2) {
        breakVegetable(veggie);
      }
    });
  });
}

function setupMouse() {
  const mouse = Mouse.create(render.canvas);
  const mouseConstraint = MouseConstraint.create(engine, {
    mouse,
    constraint: {
      stiffness: 0.18,
      render: { visible: false },
    },
  });
  Composite.add(engine.world, mouseConstraint);
  render.mouse = mouse;

  Events.on(mouseConstraint, "enddrag", (event) => {
    if (getFruitBody(event.body) === currentFruit && !launched) {
      getAudioContext();
      launched = true;
      levelHasStarted = true;
      usedFruitIds.add(currentFruit.game.id);
      updateFruitTray();
      window.setTimeout(() => {
        if (sling) {
          sling.bodyB = null;
          Composite.remove(engine.world, sling);
          sling = null;
          activatePower(currentFruit);
          playLaunchSound();
          setMessage("¡Vuela fruta!");
        }
      }, 80);
      addPowerTimer(nextFruit, 2500);
    }
  });
}

function drawBackground() {
  const ctx = render.context;
  ctx.save();
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#55bde8");
  sky.addColorStop(0.46, "#a8eaff");
  sky.addColorStop(0.47, "#8ed857");
  sky.addColorStop(1, "#4eb03f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(230, 54, 54, 0.18)";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width * 0.48, 0);
  ctx.lineTo(0, height * 0.48);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255, 206, 55, 0.92)";
  ctx.beginPath();
  ctx.arc(width * 0.1, 58, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(235, 73, 50, 0.55)";
  ctx.lineWidth = 15;
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.5)";
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
  ctx.fillStyle = "#7bc85d";
  ctx.fillRect(0, height - 50, width, 50);
  ctx.fillStyle = "#8c5a36";
  ctx.fillRect(0, height - 18, width, 18);
  ctx.restore();
}

function startGame() {
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
  sandiaAnnounced = false;
  levelHasStarted = false;
  launched = false;
  breakParticles = [];
  clearPowerTimers();
  setScore(0);
  setMessage("Nivel 1: elige una fruta");

  makeGround();
  const anchor = makeCatapult();
  makeCastle();
  makeFruit(anchor, 0);
  setupCollisions();
  setupMouse();

  Events.on(engine, "afterUpdate", checkFallenVegetables);
  Events.on(render, "beforeRender", drawBackground);
  Events.on(render, "afterRender", () => {
    drawLabels();
    drawParticles();
  });

  Render.run(render);
  Runner.run(runner, engine);
}

resetButton.addEventListener("click", startGame);
resetButton.addEventListener("click", () => {
  getAudioContext();
  playLevelSound();
});
fruitCards.forEach((card, index) => {
  card.addEventListener("click", () => chooseFruit(index));
});
window.addEventListener("resize", () => {
  window.clearTimeout(window.resizeGameTimer);
  window.resizeGameTimer = window.setTimeout(startGame, 250);
});

startGame();
