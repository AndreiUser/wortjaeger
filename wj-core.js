"use strict";
/* Shared core for the extra Wortjäger games (tower.html, platform.html).
   Uses the same localStorage keys and spaced-repetition rules as index.html, so every game
   reads one word list and writes one progress record. */
const $ = s => document.querySelector(s);
const FONT = '"Chakra Petch", "Segoe UI", system-ui, sans-serif';
const COL = { bg: "#0b0e1a", panel: "#141a2e", panel2: "#1b2340", line: "#2a3456", fg: "#e9ecf5", muted: "#8a93b3",
  gold: "#ffc94a", ok: "#5be0a0", bad: "#ff5d73", der: "#6aa8ff", die: "#ff7a9a", das: "#5be0a0", shield: "#8fdcff", rock: "#9a8470" };
const ARTS = ["der", "die", "das"];

/* ---------- Storage (browser localStorage, shared with index.html) ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }
};
let words = store.get("wj_words", null);
let progress = store.get("wj_progress", {});
let settings = Object.assign({ lang: "ro", newPer: 5, voice: true }, store.get("wj_settings", {}));
function saveProgress() { store.set("wj_progress", progress); }
function saveSettings() { store.set("wj_settings", settings); }

// First visit straight to a mini-game: take the starter list from words-b1.json.
// That needs a web server; when the page is opened as a file, the shooter page seeds the list instead.
async function loadWords() {
  if (Array.isArray(words)) return true;
  try {
    const data = await (await fetch("words-b1.json")).json();
    words = data.words.map(w => ({ ...w, active: w.active !== false }));
    store.set("wj_words", words);
    if (!Array.isArray(store.get("wj_phrases", null)) && Array.isArray(data.phrases))
      store.set("wj_phrases", data.phrases.map(p => ({ ...p, active: p.active !== false })));
    return true;
  } catch { words = []; return false; }
}
// Another tab (the register, another game) changed the data: pick it up so we never save over it.
window.addEventListener("storage", e => {
  if (e.key === "wj_words") words = store.get("wj_words", words);
  if (e.key === "wj_progress") progress = store.get("wj_progress", {});
  if (e.key === "wj_settings") settings = Object.assign(settings, store.get("wj_settings", {}));
});

/* ---------- Spaced repetition (Leitner boxes with day intervals, as in index.html) ---------- */
const IV = [0, 1, 3, 7, 16, 35, 80]; // box -> days until next review
const MAX_REVIEWS = 20;
function today() { const d = new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000); }
function prog(id) { return progress[id] || (progress[id] = { b: 0, due: today(), seen: 0, ok: 0, bad: 0 }); }
function setBox(id, b) { const p = prog(id); p.b = Math.max(0, Math.min(6, b)); p.due = today() + IV[p.b]; }

/* ---------- Word helpers ---------- */
function gender(de) { const m = /^(der|die|das)\s/i.exec(de || ""); return m ? m[1].toLowerCase() : null; }
function stem(de) { return (de || "").replace(/^(der|die|das|sich)\s+/i, "").toLowerCase(); }
function tokens(s) { return (s || "").toLowerCase().split(/[^a-zà-ÿăâîșțşţ]+/).filter(x => x.length > 3); }
function promptOf(w) { const L = settings.lang, O = L === "ro" ? "en" : "ro"; return w[L] || w[O] || ""; }
function otherOf(w) { const o = settings.lang === "ro" ? w.en : w.ro; return o && o !== promptOf(w) ? o : ""; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function deHTML(de) {
  const g = gender(de);
  return g ? `<span class="art-${g}">${esc(de.slice(0, 3))}</span>${esc(de.slice(3))}` : esc(de);
}
// The German as shown on a shielded question: without its article.
function bare(de) { return gender(de) ? de.slice(4) : de; }

// Look-alike wrong answers: same word type, same gender, shared start, similar length.
// Words whose meaning overlaps the target (same translation tokens) are never used.
function distractors(w, k) {
  const tt = new Set(tokens(promptOf(w)));
  const ws = stem(w.de), g = gender(w.de);
  return words
    .filter(c => c.id !== w.id && c.de && c.active !== false && c.de.toLowerCase() !== w.de.toLowerCase() && !tokens(promptOf(c)).some(t => tt.has(t)))
    .map(c => {
      const cs = stem(c.de); let s = Math.random() * 3, p = 0;
      if (c.pos === w.pos) s += 3;
      if (g && gender(c.de) === g) s += 2;
      while (p < cs.length && p < ws.length && cs[p] === ws[p]) p++;
      s += Math.min(p, 4) * 1.2;
      if (Math.abs(cs.length - ws.length) <= 3) s += 1;
      return { c, s };
    })
    .sort((a, b) => b.s - a.s).slice(0, k).map(x => x.c);
}

/* ---------- Audio ---------- */
let deVoice = null, actx = null;
function pickVoice() { try { deVoice = speechSynthesis.getVoices().find(v => /^de([-_]|$)/i.test(v.lang)) || null; } catch {} }
if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function say(text) {
  if (!settings.voice || !("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "de-DE"; if (deVoice) u.voice = deVoice; u.rate = 0.9;
    speechSynthesis.speak(u);
  } catch {}
}
function audioOn() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } }
function beep(freq, dur, type = "square", vol = 0.05, slide = 0) {
  if (!actx) return;
  try {
    const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur);
  } catch {}
}
const sfx = {
  shot: () => beep(880, 0.05, "square", 0.012, -400),
  boom: () => beep(140, 0.18, "sawtooth", 0.04, -60),
  ok: () => { beep(660, 0.1, "triangle", 0.08); setTimeout(() => beep(990, 0.14, "triangle", 0.08), 80); },
  crack: () => { beep(300, 0.08, "square", 0.06, 300); setTimeout(() => beep(1200, 0.1, "sine", 0.05), 60); },
  bad: () => beep(180, 0.3, "sawtooth", 0.07, -100),
  gold: () => beep(520, 0.25, "sine", 0.08, 400),
  coin: () => { beep(988, 0.05, "square", 0.03); setTimeout(() => beep(1319, 0.09, "square", 0.03), 50); },
  jump: () => beep(330, 0.12, "square", 0.025, 300),
  bump: () => beep(200, 0.06, "square", 0.04),
  stomp: () => beep(160, 0.12, "square", 0.05, 200),
  build: () => [392, 523].forEach((f, i) => setTimeout(() => beep(f, 0.08, "triangle", 0.06), i * 60)),
  level: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.12, "triangle", 0.07), i * 70))
};

/* ---------- Runs: teach, then test (the same order as the shooter) ---------- */
// Each new word is taught (intro) right before its first test, followed by up to two reviews.
// Due reviews come after. With nothing new and nothing due: free practice on known words.
function buildQueue() {
  const t = today();
  const usable = w => w.active !== false && w.de && (w.ro || w.en);
  const act = words.filter(usable);
  const learning = act.filter(w => progress[w.id] && progress[w.id].b === 0);
  const fresh = act.filter(w => !progress[w.id]);
  const news = [...learning, ...fresh].slice(0, settings.newPer);
  const rev = shuffle(act.filter(w => progress[w.id] && progress[w.id].b > 0 && progress[w.id].due <= t)
    .sort((a, b) => progress[a.id].due - progress[b.id].due).slice(0, MAX_REVIEWS));
  const out = [];
  news.forEach(w => {
    out.push({ k: "intro", w }, { k: "test", w, m: "learn1" });
    for (let i = 0; i < 2 && rev.length; i++) out.push({ k: "test", w: rev.shift(), m: "review" });
  });
  rev.forEach(w => out.push({ k: "test", w, m: "review" }));
  if (!out.length) return shuffle(act.filter(w => progress[w.id] && progress[w.id].b > 0)).slice(0, 12).map(w => ({ k: "test", w, m: "retry" }));
  return out;
}
function canPlay() { return words.filter(w => w.active !== false && w.de && (w.ro || w.en)).length >= 4; }
function introduce(w) { const p = prog(w.id); p.seen++; saveProgress(); }

// Fewer options while a word is being learned, more once it is known.
function optionCount(s) {
  if (s.m === "learn1") return 2;
  if (s.m === "learn2" || s.m === "retry") return 3;
  return (progress[s.w.id]?.b ?? 0) <= 2 ? 3 : 4;
}
function options(s) { return shuffle([s.w, ...distractors(s.w, optionCount(s) - 1)]); }
// Shielded nouns: after the right word, the right article.
function wantArmor(s) {
  if (s.armor !== undefined) return s.armor;
  if (!gender(s.w.de)) return false;
  if (s.m === "review") return Math.random() < 0.6;
  if (s.m === "learn2") return Math.random() < 0.5;
  return false;
}

// Record one answer. Returns the step to ask again later in the run, or null.
// rt is the answer time in ms; fast / slow are this game's limits for a quick or a hesitant answer.
function grade(s, ok, { rt = 0, why = "word", practice = false, fast = 2500, slow = 7000 } = {}) {
  if (practice) return ok ? null : { k: "test", w: s.w, m: "retry" };
  const p = prog(s.w.id);
  let again = null;
  if (ok) {
    p.ok++;
    if (s.m === "learn1") again = { k: "test", w: s.w, m: "learn2" };
    else if (s.m === "learn2") setBox(s.w.id, 1);
    else if (s.m === "review") {
      if (rt < fast && p.b >= 2) setBox(s.w.id, p.b + 2);
      else if (rt > slow) setBox(s.w.id, Math.max(1, p.b));
      else setBox(s.w.id, p.b + 1);
    }
  } else {
    p.bad++;
    if (why === "article") p.art = (p.art || 0) + 1;
    if (s.m === "review") setBox(s.w.id, why === "article" ? Math.max(1, p.b - 1) : 1);
    again = { k: "test", w: s.w, m: s.m === "learn1" || s.m === "learn2" ? "learn1" : "retry", armor: why === "article" ? true : undefined };
  }
  saveProgress();
  return again;
}

/* ---------- Menu and results ---------- */
function todayChips() {
  const t = today(), c = { new: 0, learning: 0, due: 0 };
  words.filter(w => w.active !== false).forEach(w => {
    const p = progress[w.id];
    if (!p) c.new++; else if (p.b === 0) c.learning++; else if (p.due <= t) c.due++;
  });
  return `<span class="chip"><b>${Math.min(c.due, MAX_REVIEWS)}</b> reviews due</span>` +
    `<span class="chip"><b>${Math.min(settings.newPer, c.new + c.learning)}</b> new words this run</span>`;
}
function bindSettings(onChange) {
  $("#set-lang").value = settings.lang;
  $("#set-new").value = String(settings.newPer);
  $("#set-voice").checked = settings.voice;
  $("#set-lang").onchange = e => { settings.lang = e.target.value; saveSettings(); onChange(); };
  $("#set-new").onchange = e => { settings.newPer = +e.target.value; saveSettings(); onChange(); };
  $("#set-voice").onchange = e => { settings.voice = e.target.checked; saveSettings(); };
}
function resultsHTML(stats) {
  return stats.map(([k, v]) => `<div><strong>${v}</strong><span>${k}</span></div>`).join("");
}
function wordChips(title, list) {
  return list.length ? `<p class="lede">${title}</p><div class="wordlist">${list.map(w => `<span>${deHTML(w.de)} · ${esc(promptOf(w))}</span>`).join("")}</div>` : "";
}

let toastTimer = 0;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, 2800);
}

/* ---------- Canvas helpers ---------- */
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
function fitFont(ctx, text, maxW, start, min, weight = 700) {
  let fs = start;
  do { ctx.font = `${weight} ${fs}px ${FONT}`; if (ctx.measureText(text).width <= maxW) break; fs--; } while (fs > min);
  return fs;
}
// German text centred, with the article (der/die/das) in its gender colour.
function drawDe(ctx, text, cx, cy, fs, color = COL.fg) {
  ctx.font = `700 ${fs}px ${FONT}`; ctx.textBaseline = "middle"; ctx.textAlign = "left";
  const g = gender(text);
  let x = cx - ctx.measureText(text).width / 2;
  if (g) {
    const art = text.slice(0, 4);
    ctx.fillStyle = COL[g]; ctx.fillText(art, x, cy); x += ctx.measureText(art).width;
    ctx.fillStyle = color; ctx.fillText(text.slice(4), x, cy);
  } else if (ARTS.includes(text)) { ctx.fillStyle = COL[text]; ctx.fillText(text, x, cy); }
  else { ctx.fillStyle = color; ctx.fillText(text, x, cy); }
}
