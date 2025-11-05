"use strict";

/*  Config  */
const TILE_RADIUS = 52;
const NUMBER_FONT_FAMILY =
  "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

const IMG_SRC = {
  wood: "images/wood.webp",
  brick: "images/brick.webp",
  wheat: "images/wheat.webp",
  sheep: "images/sheep.webp",
  ore: "images/ore.webp",
  desert: "images/desert.webp",
};

// Board configurations
const BOARD_CONFIG = {
  standard: {
    resources: [
      "wood",
      "wood",
      "wood",
      "wood",
      "brick",
      "brick",
      "brick",
      "sheep",
      "sheep",
      "sheep",
      "sheep",
      "wheat",
      "wheat",
      "wheat",
      "wheat",
      "ore",
      "ore",
      "ore",
      "desert",
    ],
    chits: [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12],
  },
  expanded: {
    resources: [
      ...Array(6).fill("wood"),
      ...Array(5).fill("brick"),
      ...Array(6).fill("sheep"),
      ...Array(6).fill("wheat"),
      ...Array(5).fill("ore"),
      ...Array(2).fill("desert"),
    ],
    chits: [
      2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 8, 8, 8, 9, 9, 9, 10, 10, 10,
      11, 11, 11, 12, 12,
    ],
  },
};

/*  DOM  */
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const elements = {
  selectBoard: document.getElementById("boardType"),
  btnRegen: document.getElementById("regen"),
  chk68: document.getElementById("block68"),
  chkSame: document.getElementById("blockSame"),
  chkResource: document.getElementById("blockResource"),
};

/*  Math / Utils  */
const SQ3 = Math.sqrt(3);
const DIRS = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const key = (q, r) => `${q},${r}`;
const axialNeighbors = (q, r) =>
  DIRS.map(([dq, dr]) => ({ q: q + dq, r: r + dr }));

function axialDisk(radius) {
  const out = [];
  for (let q = -radius; q <= radius; q++) {
    const rmin = Math.max(-radius, -q - radius);
    const rmax = Math.min(radius, -q + radius);
    for (let r = rmin; r <= rmax; r++) out.push({ q, r });
  }
  return out;
}

function axialCatan56() {
  // 5-6 player board: elongated hexagon
  // Pattern: 4-5-6-6-5-4 hexes per row = 30 total
  const hexes = [
    // Row r=-2 (top, 4 hexes)
    { q: 2, r: -2 },
    { q: 3, r: -2 },
    { q: 4, r: -2 },
    { q: 5, r: -2 },
    // Row r=-1 (5 hexes)
    { q: 1, r: -1 },
    { q: 2, r: -1 },
    { q: 3, r: -1 },
    { q: 4, r: -1 },
    { q: 5, r: -1 },
    // Row r=0 (6 hexes)
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 2, r: 0 },
    { q: 3, r: 0 },
    { q: 4, r: 0 },
    { q: 5, r: 0 },
    // Row r=1 (6 hexes) - shifted left
    { q: -1, r: 1 },
    { q: 0, r: 1 },
    { q: 1, r: 1 },
    { q: 2, r: 1 },
    { q: 3, r: 1 },
    { q: 4, r: 1 },
    // Row r=2 (5 hexes) - shifted left
    { q: -1, r: 2 },
    { q: 0, r: 2 },
    { q: 1, r: 2 },
    { q: 2, r: 2 },
    { q: 3, r: 2 },
    // Row r=3 (bottom, 4 hexes) - shifted left
    { q: -1, r: 3 },
    { q: 0, r: 3 },
    { q: 1, r: 3 },
    { q: 2, r: 3 },
  ];

  return hexes;
}

const axialToPixel = (q, r, S) => ({
  x: S * SQ3 * (q + r / 2),
  y: S * 1.5 * r,
});

/*  Canvas Utilities  */
function resizeCanvasToDisplaySize(canvas, cssW, cssH) {
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function hexPath(ctx, cx, cy, S) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const ang = ((60 * i - 30) * Math.PI) / 180;
    const x = cx + S * Math.cos(ang);
    const y = cy + S * Math.sin(ang);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawHexImage(ctx, img, cx, cy, S) {
  // Draw image clipped to slightly smaller hex for better border fit
  ctx.save();
  hexPath(ctx, cx, cy, S * 0.98); // 98% size for image
  ctx.clip();
  const size = 2 * S;
  ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
  ctx.restore();

  // Draw border at full size
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#2c2416";
  hexPath(ctx, cx, cy, S);
  ctx.stroke();
}

function drawToken(ctx, num, cx, cy, S) {
  if (num == null) return;

  const r = S * 0.42;
  const hot = num === 6 || num === 8;

  // Draw circle
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Draw number
  ctx.fillStyle = hot ? "#c0392b" : "#222";
  ctx.font = `${Math.round(S * 0.7)}px ${NUMBER_FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(num), cx, cy);

  // Draw pips
  const pips = {
    2: 1,
    3: 2,
    4: 3,
    5: 4,
    6: 5,
    8: 5,
    9: 4,
    10: 3,
    11: 2,
    12: 1,
  }[num];
  if (pips) {
    ctx.fillStyle = hot ? "#c0392b" : "#666";
    const y = cy + r * 0.78;
    const spacing = S * 0.09; // Reduced from 0.11
    const startX = cx - (spacing * (pips - 1)) / 2;
    const pr = S * 0.038; // Reduced from 0.048
    for (let i = 0; i < pips; i++) {
      ctx.beginPath();
      ctx.arc(startX + i * spacing, y, pr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/*  Data Generation  */
function buildNeighborsIndex(axials) {
  const idxByKey = new Map(axials.map((t, i) => [key(t.q, t.r), i]));
  return axials.map((t) =>
    axialNeighbors(t.q, t.r)
      .map((n) => idxByKey.get(key(n.q, n.r)))
      .filter((i) => i !== undefined)
  );
}

function makeAssignment(resources, chits) {
  const res = shuffle(resources);
  const ch = shuffle(chits);
  const tiles = res.map((r) => ({ resource: r, chit: null }));
  let k = 0;
  for (const t of tiles) {
    if (t.resource !== "desert") t.chit = ch[k++];
  }
  return tiles;
}

function isValid(tiles, neighborsIdx, opts) {
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    const neighbors = neighborsIdx[i].map((j) => tiles[j]);

    // Check 6/8 adjacency
    if (opts.block68 && (tile.chit === 6 || tile.chit === 8)) {
      if (neighbors.some((n) => n.chit === 6 || n.chit === 8)) return false;
    }

    // Check identical numbers touching
    if (opts.blockSame && tile.chit != null) {
      if (neighbors.some((n) => n.chit === tile.chit)) return false;
    }

    // Check identical resources touching
    if (opts.blockResource && tile.resource !== "desert") {
      if (neighbors.some((n) => n.resource === tile.resource)) return false;
    }
  }
  return true;
}

function generateTiles(neighborsIdx, mode, options) {
  const config = BOARD_CONFIG[mode];
  const maxTries = 1000000; // Increased for stricter constraints

  for (let tries = 0; tries < maxTries; tries++) {
    const tiles = makeAssignment(config.resources, config.chits);
    if (isValid(tiles, neighborsIdx, options)) return tiles;
  }

  // If we still can't find a valid layout, try without resource constraint
  if (options.blockResource) {
    console.warn(
      "Could not satisfy all constraints. Trying without resource blocking..."
    );
    const relaxedOptions = { ...options, blockResource: false };
    for (let tries = 0; tries < maxTries; tries++) {
      const tiles = makeAssignment(config.resources, config.chits);
      if (isValid(tiles, neighborsIdx, relaxedOptions)) return tiles;
    }
  }

  throw new Error("No valid layout found. Try disabling some constraints.");
}

/*  Layout / Render  */
function computeLayout(axials, S) {
  const pts = axials.map((t) => axialToPixel(t.q, t.r, S));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX;
  const height = maxY - minY;
  const centers = pts.map((p) => ({
    x: p.x - (minX + width / 2),
    y: p.y - (minY + height / 2),
  }));
  return { centers, width, height };
}

function fitBoardSize(container, boardW, boardH, padding = 24) {
  const cssW = container.clientWidth - padding * 2;

  // Simply calculate based on board aspect ratio
  const aspectRatio = boardH / boardW;
  const cssH = cssW * aspectRatio;

  const scale = cssW / boardW;

  return { cssW: Math.max(320, cssW), cssH, scale };
}

function renderBoard(state) {
  const wrap = document.querySelector(".wrap");
  const boardWidth = state.base.width + TILE_RADIUS * 2;
  const boardHeight = state.base.height + TILE_RADIUS * 2;

  // On mobile, use a more aggressive fitting strategy
  const isMobile = window.innerWidth <= 768;
  const padding = isMobile ? 16 : 24;

  const { cssW, cssH, scale } = fitBoardSize(
    wrap,
    boardWidth,
    boardHeight,
    padding
  );

  // On mobile, calculate exact size needed for board
  const actualBoardWidth = boardWidth * scale;
  const actualBoardHeight = boardHeight * scale;

  const finalW = isMobile ? actualBoardWidth : cssW;
  const finalH = isMobile ? actualBoardHeight : cssH;

  resizeCanvasToDisplaySize(canvas, finalW, finalH);

  ctx.save();
  ctx.translate(finalW / 2, finalH / 2);

  // Background
  const bg =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--backdrop")
      .trim() || "#f0eff4";
  ctx.fillStyle = bg;
  ctx.fillRect(-finalW / 2, -finalH / 2, finalW, finalH);

  const S = TILE_RADIUS * scale;

  // Draw tiles
  for (let i = 0; i < state.tiles.length; i++) {
    const { x, y } = state.centers[i];
    const t = state.tiles[i];
    drawHexImage(ctx, state.images[t.resource], x * scale, y * scale, S);
    if (t.resource !== "desert") {
      drawToken(ctx, t.chit, x * scale, y * scale, S);
    }
  }

  ctx.restore();
}

/*  Controller  */
const state = {
  mode: "standard",
  axials: null,
  neighborsIdx: null,
  base: null,
  centers: null,
  images: null,
  tiles: null,
};

function getOptions() {
  return {
    block68: elements.chk68?.checked || false,
    blockSame: elements.chkSame?.checked || false,
    blockResource: elements.chkResource?.checked || false,
  };
}

async function regenerate() {
  const mode =
    elements.selectBoard?.value === "expanded" ? "expanded" : "standard";
  if (mode !== state.mode) setBoardMode(mode);

  const options = getOptions();
  state.tiles = generateTiles(state.neighborsIdx, state.mode, options);
  renderBoard(state);
}

function setBoardMode(mode) {
  state.mode = mode;
  state.axials = mode === "expanded" ? axialCatan56() : axialDisk(2);
  state.neighborsIdx = buildNeighborsIndex(state.axials);
  state.base = computeLayout(state.axials, TILE_RADIUS);
  state.centers = state.base.centers;
}

/* Image Loader */
async function loadImages(map) {
  const entries = Object.entries(map);
  const promises = entries.map(
    ([k, src]) =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve([k, img]);
        img.onerror = reject;
        img.src = src;
      })
  );
  const results = await Promise.all(promises);
  return Object.fromEntries(results);
}

/*  Initialization  */
(async function init() {
  state.images = await loadImages(IMG_SRC);
  setBoardMode("standard");
  await regenerate();

  elements.btnRegen.addEventListener("click", regenerate);
  window.addEventListener("resize", () => renderBoard(state));

  document.querySelectorAll(".navbar a[href='#']").forEach((a) => {
    a.addEventListener("click", (e) => e.preventDefault());
  });
})().catch(console.error);
