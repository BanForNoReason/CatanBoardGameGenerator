
/* Mafia Mini Game
 * - Unlimited players
 * - Choose a Moderator (external or one of the players)
 * - Tinder-like swipe cards: swipe to pass device, hold to reveal, release to hide
 * - Moderator panel: see all roles (PIN-protected if set)
 */

const $ = (sel) => document.querySelector(sel);

const els = {
  setupView: $("#setupView"),
  deckView: $("#deckView"),
  endView: $("#endView"),
  modView: $("#modView"),

  playerName: $("#playerName"),
  addPlayer: $("#addPlayer"),
  shufflePlayers: $("#shufflePlayers"),
  clearPlayers: $("#clearPlayers"),
  playerList: $("#playerList"),

  moderatorSelect: $("#moderatorSelect"),
  mafiaCount: $("#mafiaCount"),
  mafiaCountValue: $("#mafiaCountValue"),

  roleDoctor: $("#roleDoctor"),
  roleDetective: $("#roleDetective"),
  roleBodyguard: $("#roleBodyguard"),
  roleVigilante: $("#roleVigilante"),
  roleTracker: $("#roleTracker"),
  roleFramer: $("#roleFramer"),
  roleConsigliere: $("#roleConsigliere"),
  roleJester: $("#roleJester"),
  roleSerialKiller: $("#roleSerialKiller"),
  roleExecutioner: $("#roleExecutioner"),

  pinInput: $("#pinInput"),
  genPin: $("#genPin"),

  startGame: $("#startGame"),
  setupHint: $("#setupHint"),

  restart: $("#restart"),
  restart2: $("#restart2"),
next: $("#next"),

  card: $("#card"),
  cardIndexChip: $("#cardIndexChip"),
  cardPlayer: $("#cardPlayer"),
  roleChip: $("#roleChip"),
  roleTitle: $("#roleTitle"),
  roleDesc: $("#roleDesc"),
  roleTip: $("#roleTip"),

  openModerator: $("#openModerator"),
  closeModerator: $("#closeModerator"),
  lockModerator: $("#lockModerator"),
  pinHint: $("#pinHint"),

  pinCheck: $("#pinCheck"),
  unlock: $("#unlock"),
  unlockHint: $("#unlockHint"),
  rolesTableWrap: $("#rolesTableWrap"),
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const STORAGE_KEY_PLAYERS = "mafia_players_v1";
const STORAGE_KEY_SETTINGS = "mafia_settings_v1";

function safeParseJSON(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function loadPersisted() {
  let rawPlayers = null;
  let rawSettings = null;
  try {
    rawPlayers = localStorage.getItem(STORAGE_KEY_PLAYERS);
    rawSettings = localStorage.getItem(STORAGE_KEY_SETTINGS);
  } catch {
    return;
  }

  // Players
  const parsedPlayers = safeParseJSON(rawPlayers, []);
  if (Array.isArray(parsedPlayers)) {
    state.players = parsedPlayers
      .map((p) => (typeof p === "string" ? p.trim() : ""))
      .filter(Boolean);
  }

  // Settings (optional)
  const settings = safeParseJSON(rawSettings, null);
  if (settings && typeof settings === "object") {
    if (typeof settings.mafiaCount === "number" || typeof settings.mafiaCount === "string") {
      const v = Number(settings.mafiaCount);
      if (Number.isFinite(v)) els.mafiaCount.value = String(v);
    }
    if (typeof settings.moderator === "string") {
      // applied after renderPlayers() builds the select options
      state.moderator = settings.moderator;
    }
  }
}

function savePersisted() {
  try {
    localStorage.setItem(STORAGE_KEY_PLAYERS, JSON.stringify(state.players));
    const settings = {
      moderator: els.moderatorSelect?.value || state.moderator || "External",
      mafiaCount: Number(els.mafiaCount?.value || 0),
    };
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch {
    // ignore (private mode / blocked storage)
  }
}


function randomPin() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return String(n);
}

const state = {
  players: [],
  moderator: "External",
  pin: "",
  deck: [], // active players (excluding moderator if moderator is a player)
  roles: new Map(), // name -> role object
  idx: 0,
  ui: {
    holdingTimer: null,
    pointerDown: false,
    drag: { startX: 0, startY: 0, dx: 0, active: false, cancelledHold: false },
    modUnlocked: false,
    alive: new Map(), // name -> boolean
  },
};

function showHint(msg) {
  els.setupHint.textContent = msg || "";
}

function setView(view) {
  [els.setupView, els.deckView, els.endView, els.modView].forEach((v) => v.classList.add("mg-hidden"));
  view.classList.remove("mg-hidden");
}

function renderPlayers() {
  els.playerList.innerHTML = "";
  state.players.forEach((name, idx) => {
    const li = document.createElement("li");
    li.textContent = name;

    const rm = document.createElement("button");
    rm.type = "button";
    rm.textContent = "Remove";
    rm.addEventListener("click", () => {
      state.players.splice(idx, 1);
      syncModeratorSelect();
      syncMafiaSlider();
      renderPlayers();
      savePersisted();
      showHint("");
    });

    li.appendChild(rm);
    els.playerList.appendChild(li);
  });
  syncModeratorSelect();
  syncMafiaSlider();
}

function addPlayer(name) {
  const cleaned = (name || "").trim();
  if (!cleaned) return;
  state.players.push(cleaned);
  els.playerName.value = "";
  renderPlayers();
  savePersisted();
}

function syncModeratorSelect() {
  const prev = els.moderatorSelect.value || "External";

  els.moderatorSelect.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "External";
  opt0.textContent = "External (not in player list)";
  els.moderatorSelect.appendChild(opt0);

  state.players.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    els.moderatorSelect.appendChild(opt);
  });

  // keep previous if still valid
  const values = ["External", ...state.players];
  els.moderatorSelect.value = values.includes(prev) ? prev : "External";
}

function syncMafiaSlider() {
  const mod = els.moderatorSelect.value || "External";
  const activeCount = state.players.length - (mod === "External" ? 0 : 1);

  // Typical: mafia up to ~half of active players (never >= half or town can't outvote)
  const max = clamp(Math.floor((activeCount - 1) / 2), 1, 6);
  els.mafiaCount.max = String(max);

  const current = Number(els.mafiaCount.value || 1);
  const nextVal = clamp(current, 1, max);
  els.mafiaCount.value = String(nextVal);
  els.mafiaCountValue.textContent = String(nextVal);

  if (activeCount < 4) {
    showHint("Mafia plays best with at least 4 active players (excluding moderator).");
  } else {
    showHint("");
  }
}

function selectedRoles() {
  const town = [];
  const mafiaSpecial = [];
  const third = [];

  if (els.roleDoctor.checked) town.push("Doctor");
  if (els.roleDetective.checked) town.push("Detective");
  if (els.roleBodyguard.checked) town.push("Bodyguard");
  if (els.roleVigilante.checked) town.push("Vigilante");
  if (els.roleTracker.checked) town.push("Tracker");

  if (els.roleFramer.checked) mafiaSpecial.push("Framer");
  if (els.roleConsigliere.checked) mafiaSpecial.push("Consigliere");

  if (els.roleJester.checked) third.push("Jester");
  if (els.roleSerialKiller.checked) third.push("Serial Killer");
  if (els.roleExecutioner.checked) third.push("Executioner");

  return { town, mafiaSpecial, third };
}

function roleInfo(role, context) {
  // context: { mafiaTeam: string[], executionerTarget?: string }
  const mafiaTeam = context.mafiaTeam || [];
  const executionerTarget = context.executionerTarget || "";

  switch (role) {
    case "Mafia":
      return {
        title: "MAFIA",
        chip: "Mafia",
        desc: "You are Mafia. You know the other Mafia members.",
        tip:
          mafiaTeam.length > 0
            ? `Mafia team: ${mafiaTeam.join(", ")}. At night, silently agree on a victim.`
            : "At night, silently agree on a victim with other Mafia.",
        alignment: "Mafia",
      };
    case "Consigliere":
      return {
        title: "CONSIGLIERE",
        chip: "Mafia",
        desc: "Mafia-aligned. Each night you can learn a player’s exact role (via moderator).",
        tip:
          mafiaTeam.length > 0
            ? `Mafia team: ${mafiaTeam.join(", ")}. Ask the moderator to check one player each night.`
            : "Ask the moderator to check one player each night.",
        alignment: "Mafia",
      };
    case "Framer":
      return {
        title: "FRAMER",
        chip: "Mafia",
        desc: "Mafia-aligned. Each night, pick a player to appear as Mafia if checked by Detective.",
        tip:
          mafiaTeam.length > 0
            ? `Mafia team: ${mafiaTeam.join(", ")}. Choose one player to frame each night.`
            : "Choose one player to frame each night.",
        alignment: "Mafia",
      };
    case "Doctor":
      return {
        title: "DOCTOR",
        chip: "Town",
        desc: "Town-aligned. Each night, choose one player to save (can be yourself).",
        tip: "If the Mafia attacks your saved player, they survive. You can save the same person multiple nights.",
        alignment: "Town",
      };
    case "Detective":
      return {
        title: "DETECTIVE",
        chip: "Town",
        desc: "Town-aligned. Each night, check one player. Moderator tells you Mafia (thumbs up) or Innocent (thumbs down).",
        tip: "Use your info carefully. Don’t reveal too early or you may become a target.",
        alignment: "Town",
      };
    case "Bodyguard":
      return {
        title: "BODYGUARD",
        chip: "Town",
        desc: "Town-aligned. Each night, protect one player. If attacked, you die instead.",
        tip: "Protect key power roles if you suspect they’ll be targeted.",
        alignment: "Town",
      };
    case "Vigilante":
      return {
        title: "VIGILANTE",
        chip: "Town",
        desc: "Town-aligned. You have a one-time shot to eliminate someone at night.",
        tip: "If you kill an innocent, the moderator may rule you die of guilt the next day (house rule).",
        alignment: "Town",
      };
    case "Tracker":
      return {
        title: "TRACKER",
        chip: "Town",
        desc: "Town-aligned. Each night, follow one player to see who they ‘visited’.",
        tip: "If your tracked player visited the victim, you likely found the killer.",
        alignment: "Town",
      };
    case "Villager":
      return {
        title: "VILLAGER",
        chip: "Town",
        desc: "Town-aligned. No special powers—your vote is your weapon.",
        tip: "Pay attention to contradictions and voting patterns. Push discussion during Day.",
        alignment: "Town",
      };
    case "Jester":
      return {
        title: "JESTER",
        chip: "Wildcard",
        desc: "Third-party. Your only goal is to get voted out during the Day.",
        tip: "If the town eliminates you during the day, you win alone (house rule).",
        alignment: "Third",
      };
    case "Serial Killer":
      return {
        title: "SERIAL KILLER",
        chip: "Wildcard",
        desc: "Third-party. Each night, you kill one player. You win if you are the last player standing.",
        tip: "Stay hidden. Let Town and Mafia weaken each other.",
        alignment: "Third",
      };
    case "Executioner":
      return {
        title: "EXECUTIONER",
        chip: "Wildcard",
        desc: "Third-party. Your goal is to get a specific target voted out during the Day.",
        tip: executionerTarget ? `Your target: ${executionerTarget}. Get them eliminated to win.` : "Get your target eliminated.",
        alignment: "Third",
      };
    default:
      return { title: role.toUpperCase(), chip: "Role", desc: "", tip: "", alignment: "Town" };
  }
}

function buildAssignment() {
  const mod = els.moderatorSelect.value || "External";
  const active = state.players.filter((p) => p !== mod);
  const N = active.length;

  if (N < 4) {
    showHint("Need at least 4 active players (excluding moderator).");
    return null;
  }

  // PIN
  let pin = (els.pinInput.value || "").trim();
  if (!pin) pin = randomPin();

  const mafiaWanted = Number(els.mafiaCount.value || 1);
  const { town, mafiaSpecial, third } = selectedRoles();

  const mafiaCount = Math.max(mafiaWanted, mafiaSpecial.length, 1);

  // Total required roles
  const required = mafiaCount + town.length + third.length;
  if (required > N) {
    showHint(`Too many special roles selected (${required}) for ${N} active players. Uncheck some roles or add players.`);
    return null;
  }

  // Build role list of length N
  const roles = [];

  // Mafia roles
  const mafiaRoles = [];
  // Put specials first for deterministic fill
  mafiaSpecial.forEach((r) => mafiaRoles.push(r));
  while (mafiaRoles.length < mafiaCount) mafiaRoles.push("Mafia");
  roles.push(...mafiaRoles);

  // Town power roles
  roles.push(...town);

  // Third-party roles
  roles.push(...third);

  // Fill remaining with Villagers
  while (roles.length < N) roles.push("Villager");

  // Assign randomly
  const shuffledPlayers = shuffle(active);
  const shuffledRoles = shuffle(roles);

  const assigned = new Map();
  for (let i = 0; i < N; i++) {
    assigned.set(shuffledPlayers[i], shuffledRoles[i]);
  }

  // Determine mafia team list
  const mafiaTeam = [];
  assigned.forEach((role, name) => {
    if (["Mafia", "Framer", "Consigliere"].includes(role)) mafiaTeam.push(name);
  });

  // Executioner target (if enabled)
  let executionerName = null;
  assigned.forEach((role, name) => {
    if (role === "Executioner") executionerName = name;
  });

  let executionerTarget = "";
  if (executionerName) {
    const candidates = shuffledPlayers.filter((n) => n !== executionerName);
    executionerTarget = candidates[Math.floor(Math.random() * candidates.length)] || "";
  }

  // Build detailed role objects per player
  const roleObjects = new Map();
  assigned.forEach((role, name) => {
    const info = roleInfo(role, { mafiaTeam, executionerTarget: role === "Executioner" ? executionerTarget : "" });
    roleObjects.set(name, { role, ...info });
  });

  // Alive state for moderator
  const alive = new Map();
  active.forEach((p) => alive.set(p, true));

  return { moderator: mod, activePlayers: active, pin, roleObjects, mafiaTeam, executionerTarget, alive };
}


function resetCardTransform() {
  // Ensure the card never keeps transition/opacity state between players.
  els.card.classList.remove("mg-animate");
  els.card.classList.remove("is-dragging");
  els.card.style.transform = "";
  els.card.style.opacity = "1";
}


function hideReveal() {
  els.card.classList.remove("is-revealed");
  els.card.querySelector(".mg-face-back").setAttribute("aria-hidden", "true");
}

function showReveal() {
  els.card.classList.add("is-revealed");
  els.card.querySelector(".mg-face-back").setAttribute("aria-hidden", "false");
}

function renderCard() {
  const deck = state.deck;
  const idx = state.idx;
  if (idx < 0 || idx >= deck.length) return;

  const name = deck[idx];
  const info = state.roles.get(name);

  els.cardIndexChip.textContent = `${idx + 1} / ${deck.length}`;
  els.cardPlayer.textContent = name;

  els.roleChip.textContent = info?.chip || "Role";
  els.roleTitle.textContent = info?.title || "ROLE";
  els.roleDesc.textContent = info?.desc || "";
  els.roleTip.textContent = info?.tip || "";

  hideReveal();
  resetCardTransform();
}

function goTo(i) {
  const next = clamp(i, 0, state.deck.length - 1);
  if (next === state.idx) return;
  state.idx = next;
  renderCard();
}

function goNext() {
  if (state.idx >= state.deck.length - 1) {
    setView(els.endView);
    // Hint PIN on end screen (for moderator)
    if (state.pin) {
      els.pinHint.textContent = `Moderator PIN: ${state.pin} (keep private)`;
    } else {
      els.pinHint.textContent = "";
    }
    return;
  }
  state.idx += 1;
  renderCard();
}

function goPrev() {
  if (state.idx <= 0) return;
  state.idx -= 1;
  renderCard();
}


function swipeAnimateOut(direction) {
  // direction only affects animation; advancing is forward-only
  const card = els.card;

  // Use viewport width so the card fully exits on all screens.
  const off = Math.max(window.innerWidth, 520) * 1.35;
  const x = direction * off;
  const r = direction * 16;

  card.classList.add("mg-animate");
  card.style.opacity = "0";
  card.style.transform = `translate3d(${x}px, 0, 0) rotate(${r}deg)`;

  const onEnd = () => {
    card.removeEventListener("transitionend", onEnd);
    resetCardTransform();
    goNext();
  };
  card.addEventListener("transitionend", onEnd, { once: true });
}


function attachHoldAndSwipe() {
  const card = els.card;

  // Hold-to-reveal timing
  const HOLD_MS = 520;

  // Movement thresholds
  const CANCEL_MOVE_PX = 10; // cancel hold if user starts moving
  const SWIPE_THRESHOLD = 90;

  // Rotation feel (matches the Imposter card vibe)
  const ROTATE_FACTOR = 0.03; // px -> deg

  let holdingTimer = null;
  let active = false;
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let cancelledHold = false;

  // rAF transform to avoid lag/jank during pointermove
  let rafId = 0;
  let pendingDx = 0;

  function clearHoldTimer() {
    if (holdingTimer) {
      clearTimeout(holdingTimer);
      holdingTimer = null;
    }
  }

  function cancelRaf() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function applyTransform(nextDx) {
    const rot = clamp(nextDx * ROTATE_FACTOR, -18, 18);
    card.style.transform = `translate3d(${nextDx}px, 0, 0) rotate(${rot}deg)`;
  }

  function scheduleTransform(nextDx) {
    pendingDx = nextDx;
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      applyTransform(pendingDx);
    });
  }

  function startHoldTimer() {
    clearHoldTimer();
    holdingTimer = setTimeout(() => {
      if (!active) return;
      if (cancelledHold) return;
      showReveal();
    }, HOLD_MS);
  }

  function beginPointer(e) {
    if (e.button !== 0 && e.pointerType === "mouse") return;

    active = true;
    startX = e.clientX;
    startY = e.clientY;
    dx = 0;
    cancelledHold = false;

    // Important: remove transitions while dragging so movement is 1:1 with the finger/mouse.
    card.classList.remove("mg-animate");
    card.classList.add("is-dragging");
    card.style.opacity = "1";

    card.setPointerCapture?.(e.pointerId);
    startHoldTimer();
  }

  function movePointer(e) {
    if (!active) return;

    const nextDx = e.clientX - startX;
    const dy = e.clientY - startY;
    dx = nextDx;

    // Cancel hold reveal if the user starts moving.
    if (!cancelledHold && (Math.abs(nextDx) > CANCEL_MOVE_PX || Math.abs(dy) > CANCEL_MOVE_PX)) {
      cancelledHold = true;
      clearHoldTimer();
    }

    // Don't allow swipe while revealed (release to hide first).
    if (card.classList.contains("is-revealed")) return;

    scheduleTransform(nextDx);
  }

  function endPointer() {
    if (!active) return;

    active = false;
    cancelRaf();
    clearHoldTimer();

    hideReveal();
    card.classList.remove("is-dragging");

    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      swipeAnimateOut(dx > 0 ? +1 : -1);
      return;
    }

    // Snap back smoothly.
    card.classList.add("mg-animate");
    card.style.opacity = "1";
    card.style.transform = `translate3d(0, 0, 0) rotate(0deg)`;

    const onEnd = () => {
      card.removeEventListener("transitionend", onEnd);
      card.classList.remove("mg-animate");
      resetCardTransform();
    };
    card.addEventListener("transitionend", onEnd, { once: true });
  }

  function cancelPointer() {
    if (!active) return;
    active = false;
    cancelRaf();
    clearHoldTimer();
    hideReveal();
    card.classList.remove("is-dragging");
    card.classList.add("mg-animate");
    resetCardTransform();
    card.classList.remove("mg-animate");
  }

  card.addEventListener("pointerdown", beginPointer);
  card.addEventListener("pointermove", movePointer);
  card.addEventListener("pointerup", endPointer);
  card.addEventListener("pointercancel", cancelPointer);

  // Keyboard support
  card.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      swipeAnimateOut(e.key === "ArrowLeft" ? -1 : 1);
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      // Default to "next" animation direction for keyboard activation
      swipeAnimateOut(1);
    }
  });
}

function buildRolesTable() {
  const rows = [];
  state.deck.forEach((name) => {
    const info = state.roles.get(name);
    const alive = state.ui.alive.get(name) ?? true;
    rows.push({ name, role: info?.title || "", chip: info?.chip || "", alive });
  });

  const table = document.createElement("table");
  table.className = "mg-table";

  const thead = document.createElement("thead");
  thead.innerHTML = `<tr><th>Player</th><th>Role</th><th>Alive</th></tr>`;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    if (!r.alive) tr.classList.add("mg-dead");

    const tdName = document.createElement("td");
    tdName.textContent = r.name;

    const tdRole = document.createElement("td");
    tdRole.textContent = `${r.role} (${r.chip})`;

    const tdAlive = document.createElement("td");
    const wrap = document.createElement("div");
    wrap.className = "mg-alive";

    const toggle = document.createElement("div");
    toggle.className = "mg-toggle";
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("tabindex", "0");
    toggle.dataset.on = String(r.alive);

    const label = document.createElement("span");
    label.textContent = r.alive ? "Alive" : "Dead";

    function setAlive(next) {
      state.ui.alive.set(r.name, next);
      toggle.dataset.on = String(next);
      label.textContent = next ? "Alive" : "Dead";
      if (next) tr.classList.remove("mg-dead");
      else tr.classList.add("mg-dead");
    }

    toggle.addEventListener("click", () => setAlive(!(toggle.dataset.on === "true")));
    toggle.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setAlive(!(toggle.dataset.on === "true"));
      }
    });

    wrap.appendChild(toggle);
    wrap.appendChild(label);

    tdAlive.appendChild(wrap);

    tr.appendChild(tdName);
    tr.appendChild(tdRole);
    tr.appendChild(tdAlive);
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);

  els.rolesTableWrap.innerHTML = "";
  els.rolesTableWrap.appendChild(table);
}

function start() {
  loadPersisted();

  renderPlayers();
  // Apply persisted moderator (if any) now that options exist
  if (state.moderator && (state.moderator === "External" || state.players.includes(state.moderator))) {
    els.moderatorSelect.value = state.moderator;
  }
  syncMafiaSlider();


  els.addPlayer.addEventListener("click", () => addPlayer(els.playerName.value));
  els.playerName.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addPlayer(els.playerName.value);
  });

  els.shufflePlayers.addEventListener("click", () => {
    state.players = shuffle(state.players);
    renderPlayers();
    savePersisted();
  });

  els.clearPlayers.addEventListener("click", () => {
    state.players = [];
    renderPlayers();
    savePersisted();
    showHint("");
  });

  els.moderatorSelect.addEventListener("change", () => {
    syncMafiaSlider();
    savePersisted();
  });
  els.mafiaCount.addEventListener("input", () => {
    els.mafiaCountValue.textContent = String(els.mafiaCount.value);
    savePersisted();
  });

  [
    els.roleDoctor,
    els.roleDetective,
    els.roleBodyguard,
    els.roleVigilante,
    els.roleTracker,
    els.roleFramer,
    els.roleConsigliere,
    els.roleJester,
    els.roleSerialKiller,
    els.roleExecutioner,
  ].forEach((el) => el.addEventListener("change", () => showHint("")));

  els.genPin.addEventListener("click", () => {
    els.pinInput.value = randomPin();
  });

  els.startGame.addEventListener("click", () => {
    const built = buildAssignment();
    if (!built) return;

    state.moderator = built.moderator;
    state.pin = built.pin;
    state.deck = built.activePlayers;
    state.roles = built.roleObjects;
    state.idx = 0;
    state.ui.modUnlocked = false;
    state.ui.alive = built.alive;

    setView(els.deckView);
    renderCard();
  });

  const restartAll = () => {
    state.deck = [];
    state.roles = new Map();
    state.idx = 0;
    state.pin = "";
    state.ui.modUnlocked = false;
    state.ui.alive = new Map();
    setView(els.setupView);
    hideReveal();
    resetCardTransform();
    els.unlockHint.textContent = "";
    els.pinCheck.value = "";
    els.rolesTableWrap.innerHTML = "";
  };

  els.restart.addEventListener("click", restartAll);
  els.restart2.addEventListener("click", restartAll);  els.next.addEventListener("click", () => goNext());

  els.openModerator.addEventListener("click", () => {
    setView(els.modView);
    // default to locked on entry
    state.ui.modUnlocked = false;
    els.rolesTableWrap.innerHTML = "";
    els.pinCheck.value = "";
    els.unlockHint.textContent = "";
    if (!state.pin) {
      state.ui.modUnlocked = true;
      buildRolesTable();
      els.unlockHint.textContent = "Unlocked (no PIN set).";
    }
  });

  function lockModeratorUI(msg) {
    state.ui.modUnlocked = false;
    els.rolesTableWrap.innerHTML = "";
    els.pinCheck.value = "";
    els.unlockHint.textContent = msg || "Locked.";
  }

  els.lockModerator.addEventListener("click", () => {
    lockModeratorUI("Locked.");
  });

  els.closeModerator.addEventListener("click", () => {
    lockModeratorUI("");
    setView(els.endView);
  });

  els.unlock.addEventListener("click", () => {
    const attempt = (els.pinCheck.value || "").trim();
    if (!state.pin) {
      state.ui.modUnlocked = true;
      buildRolesTable();
      els.unlockHint.textContent = "Unlocked (no PIN set).";
      return;
    }
    if (attempt === state.pin) {
      state.ui.modUnlocked = true;
      els.unlockHint.textContent = "Unlocked.";
      buildRolesTable();
    } else {
      els.unlockHint.textContent = "Incorrect PIN.";
    }
  });

  attachHoldAndSwipe();
}

start();
