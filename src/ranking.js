import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./ranking-config.js";

const isConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

function headers(extra = {}) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    ...extra,
  };
}

export async function getTopScores() {
  if (!isConfigured) throw new Error("Ranking pendiente de conectar");
  const endpoint = `${SUPABASE_URL}/rest/v1/scores?select=name,score&order=score.desc,created_at.asc&limit=10`;
  const response = await fetch(endpoint, { headers: headers() });
  if (!response.ok) throw new Error("No se pudo cargar el ranking");
  return response.json();
}

export async function submitScore(name, score) {
  if (!isConfigured) throw new Error("Ranking pendiente de conectar");
  const cleanName = name.trim().replace(/\s+/g, " ").slice(0, 16);
  const cleanScore = Math.max(1, Math.min(1000000, Math.floor(score)));
  if (cleanName.length < 2) throw new Error("Escribe al menos 2 letras");
  if (!/^[\p{L}\p{N} ._-]+$/u.test(cleanName)) {
    throw new Error("Usa solo letras, numeros, espacios, punto, guion o guion bajo");
  }
  const response = await fetch(`${SUPABASE_URL}/rest/v1/scores`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json", Prefer: "return=minimal" }),
    body: JSON.stringify({ name: cleanName, score: cleanScore }),
  });
  if (!response.ok) throw new Error("No se pudo guardar la puntuacion");
}

export async function renderLeaderboard(list) {
  list.replaceChildren();
  const status = document.createElement("li");
  status.className = "leaderboard-status";
  status.textContent = "Cargando ranking...";
  list.append(status);
  try {
    const scores = await getTopScores();
    list.replaceChildren();
    if (!scores.length) {
      status.textContent = "Todavia no hay puntuaciones";
      list.append(status);
      return;
    }
    scores.forEach((entry, index) => {
      const item = document.createElement("li");
      const position = document.createElement("span");
      const name = document.createElement("strong");
      const points = document.createElement("span");
      position.textContent = `${index + 1}.`;
      name.textContent = entry.name;
      points.textContent = `${entry.score} pts`;
      item.append(position, name, points);
      list.append(item);
    });
  } catch (error) {
    status.textContent = error.message;
  }
}
