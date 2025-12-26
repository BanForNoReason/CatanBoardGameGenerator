/* Imposter Word Game (No-word Imposters)
 * - Unlimited players
 * - Up to 3 imposters (imposters receive NO word)
 * - One shared civilian word per round
 * - Categories are selectable and visible; words are hidden by default
 * - Optional pool management: toggle "Show words (host only)" to enable/disable specific words
 * - Swipe is forward-only (either direction advances). No going back.
 */

const $ = (sel) => document.querySelector(sel);

const els = {
  // views
  setupView: $("#setupView"),
  deckView: $("#deckView"),
  endView: $("#endView"),

  // players
  playerName: $("#playerName"),
  addPlayer: $("#addPlayer"),
  clearPlayers: $("#clearPlayers"),
  playerList: $("#playerList"),
  playersHint: $("#playersHint"),

  // setup controls
  imposterCount: $("#imposterCount"),
  imposterCountValue: $("#imposterCountValue"),
  categoryGrid: $("#categoryGrid"),

  // word pool (host only)
  showWords: $("#showWords"),
  newWord: $("#newWord"),
  selectAllWords: $("#selectAllWords"),
  clearWords: $("#clearWords"),
  poolHint: $("#poolHint"),
  poolSummary: $("#poolSummary"),
  wordSections: $("#wordSections"),

  // start
  startGame: $("#startGame"),
  setupHint: $("#setupHint"),

  // deck
  deckTitle: $("#deckTitle"),
  cardIndexChip: $("#cardIndexChip"),
  card: $("#card"),
  cardPlayer: $("#cardPlayer"),
  roleChip: $("#roleChip"),
  roleTitle: $("#roleTitle"),
  secretWord: $("#secretWord"),
  roleDesc: $("#roleDesc"),
  roleTip: $("#roleTip"),
  next: $("#next"),

  // end
  nextRound: $("#nextRound"),
  restart: $("#restart"),
};

// Add more categories as you want; keep words as single items (no pairs).
const CATEGORIES = {
  "Fast Food Chains": [
    "McDonald's","Burger King","Wendy's","Taco Bell","KFC","Subway","Chick-fil-A","Popeyes","Domino's","Pizza Hut",
    "Little Caesars","Five Guys","In-N-Out","Jack in the Box","Arby's","Chipotle","Panera","Dunkin'","Starbucks","Shake Shack",
  ],
  "Celebrities": [
    "Taylor Swift","Dwayne Johnson","Beyoncé","Drake","Rihanna","Tom Holland","Zendaya","Leonardo DiCaprio","Brad Pitt","Scarlett Johansson",
    "Keanu Reeves","Ryan Reynolds","Emma Watson","Kanye West","Ariana Grande","Billie Eilish","Will Smith","Chris Hemsworth","Timothée Chalamet","Selena Gomez",
  ],
  "Popular Brands": [
    "Nike","Adidas","Apple","Samsung","Google","Microsoft","Amazon","Coca-Cola","Pepsi","Toyota",
    "Honda","Ford","Netflix","Disney","Sony","PlayStation","Xbox","IKEA","Costco","Target",
  ],
  "Breakfast Staples": [
    "Pancakes","Waffles","Oatmeal","Cereal","Bacon","Eggs","Toast","Bagel","Sausage","Hash Browns",
    "French Toast","Granola","Yogurt","Muffin","Smoothie","Coffee","Tea","Orange Juice","Jam","Butter",
  ],
  "Travel & Transit": [
    "Airport","Train Station","Bus Terminal","Subway","Taxi","Ride Share","Passport","Visa","Suitcase","Backpack",
    "Boarding Pass","Gate","Customs","Hotel","Hostel","Map","Itinerary","Rental Car","Ferry","Layover",
  ],
  "Office Life": [
    "Laptop","Email","Meeting","Deadline","Presentation","Whiteboard","Sticky Notes","Printer","Calendar","Inbox",
    "Zoom","Spreadsheet","Headset","Keycard","Badge","Coffee Machine","Notebook","Pen","Cubicle","Slack",
  ],
  "Games & Platforms": [
    "Minecraft","Fortnite","Roblox","Valorant","CS2","League of Legends","Overwatch","Steam","Nintendo","PlayStation",
    "Xbox","Twitch","YouTube","Discord","TikTok","Instagram","Snapchat","Reddit","Spotify","Netflix",
  ],
  "Mythology": [
    "Zeus","Thor","Odin","Loki","Athena","Ares","Hera","Poseidon","Hades","Apollo",
    "Artemis","Hermes","Freya","Anubis","Ra","Isis","Phoenix","Dragon","Pegasus","Kraken",
  ],
  "Hobbies": [
    "Hiking","Camping","Photography","Cooking","Baking","Gardening","Fishing","Knitting","Dancing","Singing",
    "Cycling","Running","Chess","Reading","Writing","Woodworking","Yoga","Skateboarding","Painting","Sculpting",
  ],
};

const CATEGORY_ORDER = Object.keys(CATEGORIES);

const state = {
  players: [],
  selectedCats: new Set(CATEGORY_ORDER), // default: all selected (visual)
  // disabled word keys: `${category}::${word}`
  disabledKeys: new Set(),

  lastWord: "",
  roundWord: "",

  dealt: [], // [{name, role, word}]
  idx: 0,

  ui: {
    holdingTimer: null,
    pointerDown: false,
    drag: { startX: 0, startY: 0, dx: 0, active: false, cancelledHold: false },
    revealed: false,
  },
};

const STORAGE_KEY = "miniGames.imposter.v4";

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = safeJsonParse(raw);
    if (!data || typeof data !== "object") return;

    if (Array.isArray(data.players)) state.players = data.players.filter(Boolean).map(String);
    if (Array.isArray(data.selectedCats)) {
      state.selectedCats = new Set(data.selectedCats.filter((c) => CATEGORY_ORDER.includes(c)));
      if (state.selectedCats.size === 0) CATEGORY_ORDER.forEach((c) => state.selectedCats.add(c));
    }
    if (Array.isArray(data.disabledKeys)) state.disabledKeys = new Set(data.disabledKeys.filter(Boolean).map(String));
    if (typeof data.imposterCount === "number") {
      els.imposterCount.value = String(data.imposterCount);
      els.imposterCountValue.textContent = String(data.imposterCount);
    }
  } catch {}
}

function persist() {
  try {
    const data = {
      players: state.players,
      selectedCats: [...state.selectedCats],
      disabledKeys: [...state.disabledKeys],
      imposterCount: Number(els.imposterCount.value || "1"),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}


function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function show(view) {
  els.setupView.classList.add("mg-hidden");
  els.deckView.classList.add("mg-hidden");
  els.endView.classList.add("mg-hidden");
  view.classList.remove("mg-hidden");
}

function normalizeName(s) {
  return (s || "").trim();
}

function updatePlayersHint() {
  els.playersHint.textContent = state.players.length
    ? `${state.players.length} player${state.players.length === 1 ? "" : "s"} added.`
    : "Add players to begin.";
}

function renderPlayers() {
  els.playerList.innerHTML = "";
  state.players.forEach((name, i) => {
    const li = document.createElement("li");
    li.className = "mg-list-item";
    li.innerHTML = `
      <span>${escapeHtml(name)}</span>
      <button class="mg-x" type="button" aria-label="Remove ${escapeHtml(name)}" data-i="${i}">✕</button>
    `;
    els.playerList.appendChild(li);
  });
  updatePlayersHint();
  syncImposterSlider();
  persist();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => {
    const m = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return m[c] || c;
  });
}

function syncImposterSlider() {
  const n = state.players.length;
  const maxImposters = Math.max(1, Math.min(3, n - 1)); // keep at least 1 civilian
  els.imposterCount.max = String(maxImposters);
  const current = clamp(Number(els.imposterCount.value || "1"), 1, maxImposters);
  els.imposterCount.value = String(current);
  els.imposterCountValue.textContent = String(current);
}

function renderCategories() {
  els.categoryGrid.innerHTML = "";

  CATEGORY_ORDER.forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mg-cat-btn" + (state.selectedCats.has(cat) ? " is-active" : "");
    btn.innerHTML = `
      <div class="mg-cat-name">${escapeHtml(cat)}</div>
      <div class="mg-cat-sub">${CATEGORIES[cat].length} words</div>
    `;
    btn.addEventListener("click", () => {
      if (state.selectedCats.has(cat)) state.selectedCats.delete(cat);
      else state.selectedCats.add(cat);

      // If user deselects everything, keep behavior sensible:
      // treat "none selected" as "all selected".
      if (state.selectedCats.size === 0) {
        CATEGORY_ORDER.forEach((c) => state.selectedCats.add(c));
      }

      renderCategories();
      renderPool();
    persist();
      persist();
      els.setupHint.textContent = "";
    });
    els.categoryGrid.appendChild(btn);
  });
}

function getSelectedCats() {
  // By design, we keep at least one selected; but just in case:
  return state.selectedCats.size ? [...state.selectedCats] : CATEGORY_ORDER;
}

function getPoolMap() {
  const cats = getSelectedCats();
  const map = {};
  cats.forEach((cat) => {
    const words = CATEGORIES[cat] || [];
    const enabled = words.filter((w) => !state.disabledKeys.has(`${cat}::${w}`));
    map[cat] = enabled;
  });
  return map;
}

function getFlatPool(poolMap) {
  // De-dupe across categories by lowercase, preserve first occurrence
  const seen = new Set();
  const flat = [];
  for (const cat of getSelectedCats()) {
    for (const w of poolMap[cat] || []) {
      const k = w.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      flat.push(w);
    }
  }
  return flat;
}

function renderPoolSummary(poolMap) {
  const cats = getSelectedCats();
  const totalAll = cats.reduce((acc, c) => acc + (CATEGORIES[c]?.length || 0), 0);
  const totalEnabled = cats.reduce((acc, c) => acc + (poolMap[c]?.length || 0), 0);

  els.poolSummary.innerHTML = `
    <div class="mg-pool-stat"><strong>Selected categories</strong><span>${cats.length}</span></div>
    <div class="mg-pool-stat"><strong>Enabled words</strong><span>${totalEnabled} / ${totalAll}</span></div>
    <div class="mg-pool-stat"><strong>Next round word</strong><span>${state.roundWord ? "Ready (hidden)" : "Not picked yet"}</span></div>
  `;

  els.poolHint.textContent =
    `Words are hidden by default. Random pool: ${totalEnabled} enabled word${totalEnabled === 1 ? "" : "s"} across ${cats.length} categor${cats.length === 1 ? "y" : "ies"}.`;
}

function renderPoolSections(poolMap) {
  els.wordSections.innerHTML = "";

  const show = !!els.showWords.checked;

  for (const cat of getSelectedCats()) {
    const all = CATEGORIES[cat] || [];
    const enabled = poolMap[cat] || [];
    const enabledCount = enabled.length;

    const section = document.createElement("div");
    section.className = "mg-word-section";

    const head = document.createElement("div");
    head.className = "mg-word-section-head";
    head.innerHTML = `
      <h4 class="mg-word-section-title">${escapeHtml(cat)}</h4>
      <div class="mg-mini-actions">
        <button class="mg-mini-btn" type="button" data-act="enable-cat" data-cat="${escapeHtml(cat)}">Enable all</button>
        <button class="mg-mini-btn" type="button" data-act="disable-cat" data-cat="${escapeHtml(cat)}">Disable all</button>
      </div>
    `;
    section.appendChild(head);

    const meta = document.createElement("p");
    meta.className = "mg-hidden-words-note";
    meta.textContent = show
      ? `${enabledCount}/${all.length} enabled (tap words to toggle)`
      : `${enabledCount}/${all.length} enabled (word list hidden)`;
    section.appendChild(meta);

    if (show) {
      const chips = document.createElement("div");
      chips.className = "mg-chip-grid";

      all.forEach((word) => {
        const key = `${cat}::${word}`;
        const isOff = state.disabledKeys.has(key);
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "mg-word-chip" + (isOff ? " is-off" : "");
        chip.textContent = word;
        chip.addEventListener("click", () => {
          if (state.disabledKeys.has(key)) state.disabledKeys.delete(key);
          else state.disabledKeys.add(key);
          renderPool();
    persist();
        });
        chips.appendChild(chip);
      });

      section.appendChild(chips);
    }

    els.wordSections.appendChild(section);
  }

  // category-level enable/disable
  els.wordSections.querySelectorAll("button[data-act]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const act = btn.getAttribute("data-act");
      const cat = btn.getAttribute("data-cat");
      if (!act || !cat) return;

      const all = CATEGORIES[cat] || [];
      if (act === "enable-cat") {
        all.forEach((w) => state.disabledKeys.delete(`${cat}::${w}`));
      } else if (act === "disable-cat") {
        all.forEach((w) => state.disabledKeys.add(`${cat}::${w}`));
      }
      renderPool();
    persist();
    });
  });
}

function renderPool() {
  const map = getPoolMap();
  renderPoolSummary(map);
  renderPoolSections(map);
  persist();
}

function pickNewRoundWord() {
  const map = getPoolMap();
  const pool = getFlatPool(map);

  if (pool.length < 1) {
    state.roundWord = "";
    return false;
  }

  // avoid repeating last word if possible
  let chosen = pool[Math.floor(Math.random() * pool.length)];
  if (pool.length > 1) {
    for (let t = 0; t < 20; t++) {
      const w = pool[Math.floor(Math.random() * pool.length)];
      if (w !== state.lastWord) {
        chosen = w;
        break;
      }
    }
  }

  state.roundWord = chosen;
  state.lastWord = chosen;
  return true;
}

function dealRound() {
  els.setupHint.textContent = "";

  if (state.players.length < 3) {
    els.setupHint.textContent = "Add at least 3 players.";
    return false;
  }

  syncImposterSlider();
  const impCount = Number(els.imposterCount.value || "1");
  const maxImp = Math.max(1, Math.min(3, state.players.length - 1));
  const actualImp = clamp(impCount, 1, maxImp);

  // pick word (hidden until each civilian reveals their card)
  if (!state.roundWord) {
    const ok = pickNewRoundWord();
    if (!ok) {
      els.setupHint.textContent = "Enable at least 1 word in the pool.";
      return false;
    }
  }

  // Randomize view order to reduce “meta” guessing
  const names = shuffle(state.players);

  // pick imposter indices
  const idxs = shuffle(names.map((_, i) => i));
  const impIdx = new Set(idxs.slice(0, actualImp));

  state.dealt = names.map((name, i) => {
    if (impIdx.has(i)) {
      return { name, role: "Imposter", word: "" };
    }
    return { name, role: "Civilian", word: state.roundWord };
  });

  state.idx = 0;
  state.ui.revealed = false;
  renderCard(false);
  show(els.deckView);
  return true;
}

function renderCard(reveal) {
  const card = state.dealt[state.idx];
  const total = state.dealt.length;

  els.cardIndexChip.textContent = `${state.idx + 1} / ${total}`;
  els.cardPlayer.textContent = card?.name || "";

  if (!card) return;

  if (!reveal) {
    els.card.classList.remove("is-revealed");
    els.roleChip.textContent = "Role";
    els.roleTitle.textContent = "";
    els.secretWord.textContent = "";
    els.roleDesc.textContent = "";
    els.roleTip.textContent = "Keep your screen hidden. Hold to reveal your role.";
    return;
  }

  els.card.classList.add("is-revealed");

  if (card.role === "Civilian") {
    els.roleChip.textContent = "Civilian";
    els.roleTitle.textContent = "CIVILIAN";
    els.secretWord.textContent = card.word;
    els.roleDesc.textContent = "You have the secret word. Give a one-word clue that fits, but don’t make it too obvious.";
    els.roleTip.textContent = "After everyone speaks, discuss who had no word — then vote.";
  } else {
    els.roleChip.textContent = "Imposter";
    els.roleTitle.textContent = "IMPOSTER";
    els.secretWord.textContent = "NO WORD";
    els.roleDesc.textContent = "You do NOT get the word. Blend in by giving vague clues and learning from others.";
    els.roleTip.textContent = "Try to survive. If you’re voted out, try guessing the word (house rule).";
  }
}

function goNext() {
  state.ui.revealed = false;
  renderCard(false);

  state.idx += 1;
  if (state.idx >= state.dealt.length) {
    // finished dealing
    show(els.endView);
    return;
  }

  renderCard(false);
}

function startHoldTimer() {
  clearTimeout(state.ui.holdingTimer);
  state.ui.holdingTimer = setTimeout(() => {
    if (!state.ui.pointerDown) return;
    if (state.ui.drag.cancelledHold) return;
    state.ui.revealed = true;
    renderCard(true);
  }, 140);
}

function clearHoldTimer() {
  clearTimeout(state.ui.holdingTimer);
  state.ui.holdingTimer = null;
}

function bindCardInteractions() {
  const card = els.card;

  const SWIPE_THRESHOLD = 90;
const SWIPE_OFFSCREEN_PX = 1200;
const SWIPE_ROTATE_DEG = 16;
const SWIPE_ANIM_MS = 320;

function onPointerDown(e) {
  if (state.ui.animating) return;

  state.ui.pointerDown = true;
  state.ui.drag.active = true;
  state.ui.drag.startX = e.clientX;
  state.ui.drag.startY = e.clientY;
  state.ui.drag.dx = 0;
  state.ui.drag.cancelledHold = false;

  // prep smooth animation: disable transitions while dragging
  els.card.classList.remove("mg-animate");
  els.card.classList.add("is-dragging");
  els.card.style.opacity = "1";

  state.ui.revealed = false;
  renderCard(false);

  els.card.setPointerCapture?.(e.pointerId);
  startHoldTimer();
}

function onPointerMove(e) {
  if (!state.ui.drag.active || state.ui.animating) return;
  const dx = e.clientX - state.ui.drag.startX;
  const dy = e.clientY - state.ui.drag.startY;

  state.ui.drag.dx = dx;

  // cancel hold if user is clearly moving
  if (Math.abs(dx) > 12 || Math.abs(dy) > 12) {
    state.ui.drag.cancelledHold = true;
    clearHoldTimer();
    renderCard(false);
  }

  // GPU-friendly drag transform
  els.card.style.transform = `translate3d(${dx}px, 0, 0) rotate(${dx * 0.03}deg)`;
}

function onPointerUp() {
  if (state.ui.animating) return;

  clearHoldTimer();
  const dx = state.ui.drag.dx || 0;

  state.ui.pointerDown = false;
  state.ui.drag.active = false;
  state.ui.drag.dx = 0;
  state.ui.drag.cancelledHold = false;

  // snap back OR animate offscreen, then advance
  els.card.classList.remove("is-dragging");
  els.card.classList.add("mg-animate");

  if (Math.abs(dx) > SWIPE_THRESHOLD) {
    state.ui.animating = true;
    const dir = dx >= 0 ? 1 : -1;

    // animate away
    els.card.style.transform = `translate3d(${dir * SWIPE_OFFSCREEN_PX}px, 0, 0) rotate(${dir * SWIPE_ROTATE_DEG}deg)`;
    els.card.style.opacity = "0";

    setTimeout(() => {
      // reset visual state before rendering next
      els.card.style.opacity = "1";
      els.card.style.transform = "";
      state.ui.animating = false;
      goNext();
    }, SWIPE_ANIM_MS);
    return;
  }

  // not enough swipe: ease back to center
  state.ui.revealed = false;
  renderCard(false);
  els.card.style.opacity = "1";
  els.card.style.transform = "translate3d(0, 0, 0) rotate(0deg)";

  setTimeout(() => {
    // cleanup
    if (!state.ui.animating) els.card.style.transform = "";
  }, SWIPE_ANIM_MS);
}

function onPointerCancel() {
  clearHoldTimer();
  els.card.classList.remove("is-dragging");
  els.card.classList.add("mg-animate");

  els.card.style.opacity = "1";
  els.card.style.transform = "";

  state.ui.pointerDown = false;
  state.ui.drag.active = false;
  state.ui.drag.dx = 0;
  state.ui.drag.cancelledHold = false;
  state.ui.revealed = false;
  state.ui.animating = false;
  renderCard(false);
}

  card.addEventListener("pointerdown", onPointerDown);
  card.addEventListener("pointermove", onPointerMove);
  card.addEventListener("pointerup", onPointerUp);
  card.addEventListener("pointercancel", onPointerCancel);

  // keyboard (forward only)
  card.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goNext();
    }
  });
}

function resetAll({ hard = false } = {}) {
  if (hard) {
    state.players = [];
    state.selectedCats = new Set(CATEGORY_ORDER);
    state.disabledKeys = new Set();
    els.playerName.value = "";
    els.imposterCount.value = "1";
    els.imposterCountValue.textContent = "1";
  }

  state.lastWord = "";
  state.roundWord = "";
  state.dealt = [];
  state.idx = 0;
  state.ui.revealed = false;

  els.showWords.checked = false;

  renderPlayers();
  renderCategories();
  renderPool();
  els.setupHint.textContent = "";
  show(els.setupView);
  persist();
}

function resetForNextRound() {
  state.dealt = [];
  state.idx = 0;
  state.roundWord = ""; // force new pick

  pickNewRoundWord();
  dealRound();
}

function bindSetupEvents() {
  els.addPlayer.addEventListener("click", () => {
    const name = normalizeName(els.playerName.value);
    if (!name) return;
    state.players.push(name);
    els.playerName.value = "";
    renderPlayers();
    els.setupHint.textContent = "";
    persist();
  });

  els.playerName.addEventListener("keydown", (e) => {
    if (e.key === "Enter") els.addPlayer.click();
  });

  els.clearPlayers.addEventListener("click", () => {
    resetAll({ hard: true });
  });

  els.playerList.addEventListener("click", (e) => {
    const btn = e.target.closest?.("button[data-i]");
    if (!btn) return;
    const idx = Number(btn.getAttribute("data-i"));
    if (!Number.isFinite(idx)) return;
    state.players.splice(idx, 1);
    renderPlayers();
  });

  els.imposterCount.addEventListener("input", () => {
    syncImposterSlider();
    persist();
  });

  els.showWords.addEventListener("change", () => {
    renderPool();
    persist();
  });

  els.selectAllWords.addEventListener("click", () => {
    // enable all words in selected categories
    for (const cat of getSelectedCats()) {
      for (const w of CATEGORIES[cat] || []) {
        state.disabledKeys.delete(`${cat}::${w}`);
      }
    }
    renderPool();
    persist();
  });

  els.clearWords.addEventListener("click", () => {
    // disable all words in selected categories
    for (const cat of getSelectedCats()) {
      for (const w of CATEGORIES[cat] || []) {
        state.disabledKeys.add(`${cat}::${w}`);
      }
    }
    // invalidate pending word if pool becomes empty
    state.roundWord = "";
    renderPool();
    persist();
  });

  els.newWord.addEventListener("click", () => {
    state.roundWord = "";
    const ok = pickNewRoundWord();
    if (!ok) {
      els.setupHint.textContent = "Enable at least 1 word in the pool.";
    } else {
      els.setupHint.textContent = "New word selected for the next round (hidden).";
    }
    renderPool();
    persist();
  });

  els.startGame.addEventListener("click", () => {
    // Ensure we have a word ready (hidden)
    if (!state.roundWord) pickNewRoundWord();
    dealRound();
  });

  els.next.addEventListener("click", () => {
    goNext();
  });

  els.nextRound.addEventListener("click", () => {
    resetForNextRound();
  });

  els.restart.addEventListener("click", () => {
    resetAll();
  });
}

function init() {
  loadPersisted();
  renderPlayers();
  renderCategories();
  renderPool();
  bindSetupEvents();
  bindCardInteractions();
  show(els.setupView);
}

init();
