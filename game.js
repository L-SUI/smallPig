"use strict";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const compact = window.matchMedia("(max-width: 650px) and (orientation: portrait)");
let width = canvas.width;
const floor = 383;
const hp = document.querySelector("#hp");
const meter = document.querySelector("#health");
const score = document.querySelector("#score");
const overlay = document.querySelector("#overlay");
const headline = document.querySelector("#headline");
const description = document.querySelector("#description");
const start = document.querySelector("#start");
const pause = document.querySelector("#pause");

function loadSprite(path) {
  const image = new Image();
  image.src = "assets/" + path + ".png";
  return image;
}

const player = Object.fromEntries([
  "idle", "run-left", "run-right", "hurt-cry", "heal",
].map(name => [name, loadSprite("characters/player/" + name)]));

function item(character, name, health) {
  return {
    art: loadSprite("items/" + name),
    pose: loadSprite("characters/" + character + "/throw-" + name),
    health,
  };
}

const bear = {
  name: "狗熊阿丽", position: 0.75,
  items: [
    item("bear", "milk-tea", 18),
    item("bear", "cake", 24),
    item("bear", "books", -24),
    item("bear", "stationery", -14),
  ],
};
const professor = {
  name: "骆教授", position: 0.25,
  items: [
    item("professor", "exam", -20),
    item("professor", "notebook", -16),
    item("professor", "pencil-case", -18),
    item("professor", "paper-ball", -10),
  ],
};
const keys = new Set();
let drag = null;
let mode = "ready";
let state = newRun();

function resizeStage() {
  const nextWidth = compact.matches ? 500 : 960;
  if (nextWidth === width) return;
  const ratio = nextWidth / width;
  width = nextWidth;
  canvas.width = width;
  state.x = clamp(state.x * ratio, 48, width - 48);
  for (const drop of state.throws) drop.x = clamp(drop.x * ratio, 55, width - 55);
  draw();
}

compact.addEventListener("change", resizeStage);
resizeStage();

function newRun() {
  return { x: width * 0.215, hp: 100, time: 0, score: 0, scroll: 0,
    nextThrow: 0.8, throws: [], reaction: 0, healed: false, left: false };
}

function updateHud() {
  hp.textContent = state.hp;
  meter.value = state.hp;
  score.textContent = String(Math.floor(state.score)).padStart(4, "0");
}

function setMode(next) {
  mode = next;
  keys.clear();
  drag = null;
  pause.disabled = next !== "playing" && next !== "paused";
  pause.textContent = next === "paused" ? "继续" : "暂停";
  overlay.hidden = next === "playing";
  if (next === "paused") {
    headline.textContent = "课间休息";
    description.textContent = "准备好后，可以接着跑。";
    start.textContent = "继续跑";
  }
  if (next === "over") {
    headline.textContent = "今天先跑到这里";
    description.textContent = "本次得分 " + Math.floor(state.score) + " 分";
    start.textContent = "再跑一次";
  }
}

start.addEventListener("click", () => {
  if (mode !== "paused") state = newRun();
  updateHud();
  setMode("playing");
  start.blur();
});
pause.addEventListener("click", togglePause);
function togglePause() {
  if (mode === "playing") setMode("paused");
  else if (mode === "paused") setMode("playing");
}

window.addEventListener("keydown", event => {
  if (event.code === "Escape" && !event.repeat) togglePause();
  if (mode !== "playing" || !["ArrowLeft", "ArrowRight"].includes(event.code)) return;
  event.preventDefault();
  keys.add(event.code);
});
window.addEventListener("keyup", event => keys.delete(event.code));
window.addEventListener("blur", () => {
  if (mode === "playing") setMode("paused");
});

canvas.addEventListener("pointerdown", event => {
  if (mode !== "playing" || event.pointerType === "mouse" || drag) return;
  canvas.setPointerCapture(event.pointerId);
  drag = { id: event.pointerId, x: event.clientX };
});
canvas.addEventListener("pointermove", event => {
  if (drag?.id !== event.pointerId) return;
  const delta = (event.clientX - drag.x) * width / canvas.getBoundingClientRect().width;
  drag.x = event.clientX;
  if (!Number.isFinite(delta) || delta === 0) return;
  state.left = delta < 0;
  state.x = clamp(state.x + delta, 48, width - 48);
});
for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) {
  canvas.addEventListener(name, event => {
    if (drag?.id === event.pointerId) drag = null;
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function spawn() {
  const healing = Math.random() < 0.19;
  const thrower = healing || Math.random() < 0.33 ? bear : professor;
  const pool = thrower.items.filter(item => (item.health > 0) === healing);
  const item = pool[Math.floor(Math.random() * pool.length)];
  const x = clamp(state.x + (Math.random() - 0.5) * 155, 55, width - 55);
  state.throws.push({ thrower, item, x, y: 137, age: 0, spent: false });
}

function update(dt) {
  state.time += dt;
  const speed = 150 + Math.min(state.time * 3, 190);
  state.scroll += speed * dt;
  state.score += speed * dt / 12;
  state.reaction = Math.max(0, state.reaction - dt);
  if (!drag) {
    const direction = Number(keys.has("ArrowRight")) - Number(keys.has("ArrowLeft"));
    state.left = direction < 0;
    state.x = clamp(state.x + direction * 345 * dt, 48, width - 48);
  }

  state.nextThrow -= dt;
  if (state.nextThrow <= 0) {
    spawn();
    state.nextThrow = Math.max(0.62, 1.8 - state.time * 0.022) * (0.9 + Math.random() * 0.2);
  }
  for (const drop of state.throws) {
    drop.age += dt;
    if (drop.age < 0.64 || drop.spent) continue;
    drop.y += (225 + Math.min(115, state.time * 2)) * dt;
    const feet = floor;
    const head = floor - 111;
    if (Math.abs(drop.x - state.x) > 40 || drop.y + 16 < head || drop.y - 16 > feet) continue;
    const { health } = drop.item;
    state.hp = clamp(state.hp + health, 0, 100);
    state.reaction = 0.65;
    state.healed = health > 0;
    drop.spent = true;
    if (state.hp === 0) {
      setMode("over");
      break;
    }
  }
  state.throws = state.throws.filter(drop => !drop.spent && drop.y < floor + 24);
  updateHud();
}

function box(x, y, w, h, color, radius = 0) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
}

function ellipse(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
  ctx.fill();
}

function label(value, x, y, size, color) {
  ctx.font = "bold " + size + "px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function sprite(image, x, bottom, height) {
  if (!image.naturalWidth) return;
  const w = height * image.naturalWidth / image.naturalHeight;
  ctx.drawImage(image, x - w / 2, bottom - height, w, height);
}

function scenery() {
  box(0, 0, width, 460, "#bfe1f1");
  for (let i = 0; i < 6; i++) {
    const x = (i * 215 + 1040 - state.scroll * 0.075 % 1040) % 1040 - 35;
    ellipse(x, 50, 62, 16, "#f7f9f4");
    ellipse(x - 15, 39, 27, 20, "#f7f9f4");
  }
  for (let i = 0; i < 4; i++) {
    const x = (i * 270 + 1080 - state.scroll * 0.2 % 1080) % 1080 - 100;
    box(x, 92, 176, 107, "#e6c4ad", 5);
    box(x - 7, 87, 190, 12, "#bc8274", 5);
    for (let j = 0; j < 5; j++) box(x + 12 + j * 32, 112, 18, 31, "#f7e2c5", 3);
    ellipse(x + 175, 150, 34, 37, "#a9c399");
    ellipse(x + 208, 145, 42, 47, "#8fae83");
  }

  box(0, 160, width, floor - 160, "#f5e5d8");
  box(0, 157, width, 14, "#e6c4b1");
  for (let row = 0; row < 5; row++) {
    const y = 171 + row * 45;
    box(0, y, width, 1, "#dfc6b7");
    for (let x = -180; x < width; x += 180) {
      box(x + (row % 2) * 90 - state.scroll * 0.58 % 180, y, 1, 45, "#dfc6b7");
    }
  }
  box(width / 2 - 95, 200, 190, 72, "#e5c5ae", 9);
  box(width / 2 - 90, 205, 180, 62, "#fff0dc", 6);
  label("好好学习 · 天天向上", width / 2, 243, 16, "#936957");
  box(0, floor, width, 77, "#eac8b2");
  box(0, floor, width, 5, "#bd8d79");
  box(0, 427, width, 2, "#d2a791");
  for (let x = 0; x <= width + 125; x += 125) {
    const offset = x - state.scroll % 125;
    ctx.strokeStyle = "#d2a791";
    ctx.beginPath();
    ctx.moveTo(offset, floor + 5);
    ctx.lineTo(offset + (offset - width / 2) * 0.22, 460);
    ctx.stroke();
  }
}

function draw() {
  scenery();
  const visible = new Map();
  if (mode === "ready") {
    visible.set(professor, professor.items[0]);
    visible.set(bear, bear.items[0]);
  }
  for (const drop of state.throws) {
    if (drop.age < 1) visible.set(drop.thrower, drop.item);
    const color = drop.item.health > 0 ? "#6d9e70" : "#cf6a63";
    ellipse(drop.x, floor + 5, 29, 7, color);
    if (drop.age >= 0.64) {
      ellipse(drop.x, drop.y, 23, 23, drop.item.health > 0 ? "#e4f3db" : "#fff4e1");
      sprite(drop.item.art, drop.x, drop.y + 23, 46);
    }
  }
  for (const [thrower, item] of visible) {
    const x = thrower.position * width;
    box(x - 55, 16, 110, 25, "#fff3e4", 12);
    label(thrower.name, x, 34, 15, "#744c40");
    sprite(item.pose, x, 174, 140);
  }

  let pose = mode === "ready" ? "idle" : state.left ? "run-left" : "run-right";
  if (state.reaction > 0) pose = state.healed ? "heal" : "hurt-cry";
  const bob = pose.startsWith("run-") ? 4 * Math.abs(Math.sin(state.scroll / 12)) : 0;
  ellipse(state.x, floor + 2, 32, 6, "#9c74625c");
  sprite(player[pose], state.x, floor - bob + 3, 126);
}

let last = 0;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;
  if (mode === "playing") update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
