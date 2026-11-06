import { fruitPowers } from "./fruit-powers.js?v=20261106-5";
let highestLevel = 1;
try {
  highestLevel = Math.max(1, Number(window.localStorage.getItem("super-frutas-highest-level")) || 1);
} catch {
  highestLevel = 1;
}

document.querySelector("#mapProgress").textContent = `Nivel máximo: ${highestLevel}`;
const worldStops = [...document.querySelectorAll(".world-stop")];
worldStops.forEach((stop, index) => {
  const startLevel = Number(stop.dataset.startLevel);
  const nextStartLevel = Number(worldStops[index + 1]?.dataset.startLevel) || Number.POSITIVE_INFINITY;
  const unlocked = highestLevel >= startLevel;
  const current = unlocked && highestLevel < nextStartLevel;
  stop.classList.toggle("unlocked", unlocked);
  stop.classList.toggle("current", current);
  stop.setAttribute("aria-label", `${stop.querySelector("strong").textContent}: ${unlocked ? "desbloqueado" : `se desbloquea en el nivel ${startLevel}`}`);
});

const fruitPowerDialog = document.querySelector("#fruitPowerDialog");
document.querySelectorAll("[data-fruit-info]").forEach(button => {
  button.addEventListener("click", () => {
    const fruit = fruitPowers[button.dataset.fruitInfo];
    if (!fruit) return;
    document.querySelector("#fruitPowerEmoji").textContent = fruit.emoji;
    document.querySelector("#fruitPowerTitle").textContent = fruit.name;
    document.querySelector("#fruitPowerName").textContent = fruit.power;
    document.querySelector("#fruitPowerDescription").textContent = fruit.description;
    document.querySelector("#fruitPowerUnlock").textContent = `🔑 ${fruit.unlock}`;
    fruitPowerDialog.showModal();
  });
});
document.querySelector("#closeFruitPower").addEventListener("click", () => fruitPowerDialog.close());
document.querySelector("#doneFruitPower").addEventListener("click", () => fruitPowerDialog.close());
fruitPowerDialog.addEventListener("click", event => {
  if (event.target !== fruitPowerDialog) return;
  const bounds = fruitPowerDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) fruitPowerDialog.close();
});
