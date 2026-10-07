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
let spoonParts = [];
let vegetablesLeft = 0;
let powerTimers = [];

function setMessage(text) {
  messageEl.textContent = text;
  messageEl.classList.remove("pop");
  window.requestAnimationFrame(() => messageEl.classList.add("pop"));
}

function setScore(nextScore) {
  score = nextScore;
  scoreEl.textContent = String(score);
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

function makeSpoon() {
  const baseX = Math.max(95, width * 0.13);
  const baseY = height - 78;
  const handle = Bodies.rectangle(baseX - 18, baseY + 28, 18, 92, {
    isStatic: true,
    angle: -0.22,
    label: "spoon",
    render: { fillStyle: "#b77b44" },
  });
  const bowl = Bodies.circle(baseX + 14, baseY - 10, 39, {
    isStatic: true,
    label: "spoon",
    render: { fillStyle: "#d49a62" },
  });
  spoonParts = [handle, bowl];
  Composite.add(engine.world, spoonParts);
  return { x: baseX + 14, y: baseY - 24 };
}

function makeFruit(anchor) {
  const fruit = fruits[currentFruitIndex];
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

function makeCastle() {
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
  addBreak(body.position.x, body.position.y, body.game.color, body.game.emoji);
  Composite.remove(engine.world, body);
  vegetablesLeft -= 1;
  setScore(score + 100);
  setMessage(vegetablesLeft <= 0 ? "¡Ganaste!" : "¡Verdura rota!");
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
}

function nextFruit() {
  if (vegetablesLeft <= 0) return;
  currentFruitIndex += 1;
  if (currentFruitIndex >= fruits.length) {
    setMessage("Sin frutas. Toca reiniciar.");
    return;
  }
  launched = false;
  makeFruit({ x: Math.max(95, width * 0.13) + 14, y: height - 102 });
  setMessage(`Turno de ${fruits[currentFruitIndex].name}`);
}

function updateFruitTray() {
  fruitCards.forEach((card, index) => {
    card.classList.toggle("active", index === currentFruitIndex);
  });
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
      ctx.font = "35px serif";
      ctx.fillText(body.game.emoji, body.position.x, body.position.y + 1);
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

  spoonParts.forEach((part) => {
    if (part.circleRadius) {
      ctx.beginPath();
      ctx.ellipse(part.position.x, part.position.y, 45, 30, -0.2, 0, Math.PI * 2);
      ctx.fillStyle = "#efc087";
      ctx.fill();
    }
  });

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

      const bodies = [pair.bodyA, pair.bodyB];
      const veggie = bodies.map(getVegetableBody).find(Boolean);
      const fruit = bodies.map(getFruitBody).find(Boolean);
      const block = bodies.find((body) => body.label === "block");
      const speed = fruit ? Vector.magnitude(fruit.velocity) : Math.max(pair.bodyA.speed, pair.bodyB.speed);

      if (veggie && fruit && speed > 4.1) {
        breakVegetable(veggie);
      } else if (veggie && block && block.speed > 5.2) {
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
      launched = true;
      window.setTimeout(() => {
        if (sling) {
          sling.bodyB = null;
          Composite.remove(engine.world, sling);
          sling = null;
          activatePower(currentFruit);
          setMessage("¡Vuela fruta!");
        }
      }, 80);
      window.setTimeout(nextFruit, 2500);
    }
  });
}

function drawBackground() {
  const ctx = render.context;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.56)";
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
  currentFruitIndex = 0;
  launched = false;
  breakParticles = [];
  clearPowerTimers();
  setScore(0);
  setMessage("Prepara la cuchara");

  makeGround();
  const anchor = makeSpoon();
  makeCastle();
  makeFruit(anchor);
  setupCollisions();
  setupMouse();

  Events.on(render, "beforeRender", drawBackground);
  Events.on(render, "afterRender", () => {
    drawLabels();
    drawParticles();
  });

  Render.run(render);
  Runner.run(runner, engine);
}

resetButton.addEventListener("click", startGame);
window.addEventListener("resize", () => {
  window.clearTimeout(window.resizeGameTimer);
  window.resizeGameTimer = window.setTimeout(startGame, 250);
});

startGame();
