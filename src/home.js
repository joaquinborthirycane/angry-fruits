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

const modeInputs = [...document.querySelectorAll('input[name="difficulty"]')];
function selectMode(mode) {
  const selected = mode === "desafio" ? "desafio" : "aventura";
  modeInputs.forEach(input => { input.checked = input.value === selected; });
  document.querySelectorAll("[data-play-link]").forEach(link => { link.href = `game.html?modo=${selected}`; });
  document.querySelector("#selectedMode").textContent = selected === "desafio" ? "Desafío" : "Normal";
  try { window.localStorage.setItem("super-frutas-mode", selected); } catch {}
}
let storedMode = "aventura";
try { storedMode = window.localStorage.getItem("super-frutas-mode") || "aventura"; } catch {}
selectMode(storedMode);
modeInputs.forEach(input => input.addEventListener("change", () => selectMode(input.value)));
