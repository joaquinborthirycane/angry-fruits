import { renderLeaderboard } from "./ranking.js?v=20261018-2";

renderLeaderboard(document.querySelector("#homeLeaderboard"));

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
