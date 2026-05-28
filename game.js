const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const scoreEl = document.querySelector("#score");
const levelEl = document.querySelector("#level");
const livesEl = document.querySelector("#lives");
const overlay = document.querySelector("#overlay");
const startButton = document.querySelector("#startButton");

const playerFace = new Image();
playerFace.src = "geng.webp";
playerFace.addEventListener("load", () => draw());

const hitFace = new Image();
hitFace.src = "2.png";
hitFace.addEventListener("load", () => draw());

const clearFace = new Image();
clearFace.src = "3.png";
clearFace.addEventListener("load", () => draw());

let lastSpokenAt = 0;

const keys = new Set();
const stars = Array.from({ length: 110 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  r: Math.random() * 1.8 + 0.4,
  speed: Math.random() * 0.35 + 0.08,
}));

const state = {
  running: false,
  paused: false,
  gameOver: false,
  score: 0,
  level: 1,
  lives: 5,
  lastTime: 0,
  alienDirection: 1,
  alienDrop: false,
  playerBullets: [],
  alienBullets: [],
  particles: [],
  skillMessages: [],
  aliens: [],
  hitFaceTimer: 0,
  clearFaceTimer: 0,
  player: {
    x: canvas.width / 2 - 29,
    y: canvas.height - 92,
    w: 58,
    h: 58,
    cooldown: 0,
    invincible: 0,
  },
};

function resetGame() {
  state.running = true;
  state.paused = false;
  state.gameOver = false;
  state.score = 0;
  state.level = 1;
  state.lives = 5;
  state.player.x = canvas.width / 2 - state.player.w / 2;
  state.player.cooldown = 0;
  state.player.invincible = 0;
  state.hitFaceTimer = 0;
  state.clearFaceTimer = 0;
  state.playerBullets = [];
  state.alienBullets = [];
  state.particles = [];
  state.skillMessages = [];
  createWave();
  updateHud();
  hideOverlay();
}

function createWave() {
  state.aliens = [];
  state.alienDirection = 1;
  const cols = 10;
  const rows = Math.min(2 + state.level, 4);
  const gapX = 72;
  const gapY = 54;
  const startX = (canvas.width - (cols - 1) * gapX) / 2 - 23;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      state.aliens.push({
        ...createAlienSkill(),
        x: startX + col * gapX,
        y: 70 + row * gapY,
        w: 46,
        h: 26,
        row,
        wobble: Math.random() * Math.PI * 2,
      });
    }
  }
}

function updateHud() {
  scoreEl.textContent = state.score;
  levelEl.textContent = state.level;
  livesEl.textContent = state.lives;
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function showOverlay(title, message, buttonText) {
  overlay.querySelector("h1").textContent = title;
  overlay.querySelector("p").textContent = message;
  startButton.textContent = buttonText;
  overlay.classList.remove("hidden");
}

function shoot() {
  if (state.player.cooldown > 0 || !state.running || state.paused) return;
  state.playerBullets.push({
    x: state.player.x + state.player.w / 2 - 3,
    y: state.player.y - 12,
    w: 6,
    h: 16,
    vy: -590,
  });
  state.player.cooldown = 0.16;
}

function alienShoot() {
  if (state.aliens.length === 0) return;
  const shootersByColumn = new Map();
  for (const alien of state.aliens) {
    const current = shootersByColumn.get(Math.round(alien.x / 66));
    if (!current || alien.y > current.y) shootersByColumn.set(Math.round(alien.x / 66), alien);
  }
  const shooters = Array.from(shootersByColumn.values());
  const shooter = shooters[Math.floor(Math.random() * shooters.length)];
  state.alienBullets.push({
    x: shooter.x + shooter.w / 2 - 3,
    y: shooter.y + shooter.h,
    w: 6,
    h: 14,
    vy: 160 + state.level * 14,
  });
}

function update(dt) {
  if (!state.running || state.paused) return;

  const playerSpeed = 420;
  const left = keys.has("arrowleft") || keys.has("a") || keys.has("touchleft");
  const right = keys.has("arrowright") || keys.has("d") || keys.has("touchright");
  if (left) state.player.x -= playerSpeed * dt;
  if (right) state.player.x += playerSpeed * dt;
  state.player.x = clamp(state.player.x, 18, canvas.width - state.player.w - 18);
  if (keys.has(" ") || keys.has("touchfire")) shoot();

  state.player.cooldown = Math.max(0, state.player.cooldown - dt);
  state.player.invincible = Math.max(0, state.player.invincible - dt);
  state.hitFaceTimer = Math.max(0, state.hitFaceTimer - dt);
  state.clearFaceTimer = Math.max(0, state.clearFaceTimer - dt);
  for (const star of stars) {
    star.y += star.speed * 60 * dt;
    if (star.y > canvas.height) {
      star.y = -4;
      star.x = Math.random() * canvas.width;
    }
  }

  for (const bullet of state.playerBullets) bullet.y += bullet.vy * dt;
  for (const bullet of state.alienBullets) bullet.y += bullet.vy * dt;
  state.playerBullets = state.playerBullets.filter((bullet) => bullet.y + bullet.h > 0);
  state.alienBullets = state.alienBullets.filter((bullet) => bullet.y < canvas.height + 20);

  const alienSpeed = 28 + state.level * 7;
  let hitEdge = false;
  for (const alien of state.aliens) {
    alien.x += state.alienDirection * alienSpeed * dt;
    alien.wobble += dt * 4;
    if (alien.x < 22 || alien.x + alien.w > canvas.width - 22) hitEdge = true;
  }
  if (hitEdge) {
    state.alienDirection *= -1;
    for (const alien of state.aliens) alien.y += 22;
  }

  if (Math.random() < dt * (0.22 + state.level * 0.045)) alienShoot();

  handleCollisions();
  updateParticles(dt);
  updateSkillMessages(dt);

  if (state.aliens.length === 0) {
    state.level += 1;
    state.clearFaceTimer = 1.25;
    state.playerBullets = [];
    state.alienBullets = [];
    burst(state.player.x + state.player.w / 2, state.player.y + state.player.h / 2, "#ffd166");
    createWave();
    updateHud();
  }

  if (state.player.invincible <= 0 && state.aliens.some((alien) => alien.y + alien.h >= state.player.y - 8)) {
    loseLife();
  }
}

function handleCollisions() {
  for (const bullet of [...state.playerBullets]) {
    const alien = state.aliens.find((item) => intersects(bullet, item));
    if (!alien) continue;
    state.playerBullets.splice(state.playerBullets.indexOf(bullet), 1);
    hitAlien(alien);
  }

  if (state.player.invincible > 0) return;
  const hit = state.alienBullets.find((bullet) => intersects(bullet, state.player));
  if (hit) {
    state.alienBullets.splice(state.alienBullets.indexOf(hit), 1);
    loseLife();
  }
}

function createAlienSkill() {
  const roll = Math.random();
  if (roll < 0.34) {
    return {
      skill: "love5",
      value: randomLove5Value(),
      hp: 1,
      shieldHits: 0,
      beast: null,
    };
  }
  if (roll < 0.46) {
    return {
      skill: "framed",
      value: `0.${String(Math.floor(Math.random() * 100)).padStart(2, "0")}`,
      hp: 1,
      shieldHits: 3,
      beast: null,
    };
  }
  if (roll < 0.62) {
    const beast = Math.random() < 0.5 ? "鹿" : "马";
    return {
      skill: "deerHorse",
      value: beast,
      hp: 1,
      shieldHits: 0,
      beast,
    };
  }
  return {
    skill: "normal",
    value: `0.${String(Math.floor(Math.random() * 100)).padStart(2, "0")}`,
    hp: 1,
    shieldHits: 0,
    beast: null,
  };
}

function randomLove5Value() {
  if (Math.random() < 0.55) return "0.5";
  const tenths = Math.floor(Math.random() * 10);
  return `0.${tenths}5`;
}

function hitAlien(alien) {
  if (alien.skill === "framed" && alien.shieldHits > 0) {
    alien.shieldHits -= 1;
    speakText("莫须有");
    addSkillMessage("莫须有", `无敌剩余 ${alien.shieldHits} 次`, alien.x + alien.w / 2, alien.y, "#f4f6fb");
    burst(alien.x + alien.w / 2, alien.y + alien.h / 2, "#f4f6fb", 7);
    return;
  }

  if (alien.skill === "deerHorse") {
    addSkillMessage("指鹿为马", alien.beast === "马" ? "马受到伤害" : "鹿不受伤害", alien.x + alien.w / 2, alien.y, "#ffd166");
    if (alien.beast === "鹿") {
      burst(alien.x + alien.w / 2, alien.y + alien.h / 2, "#ffd166", 7);
      alien.beast = "马";
      alien.value = "马";
      return;
    }
  }

  const damage = alien.skill === "love5" ? 0.5 : 1;
  if (alien.skill === "love5") {
    addSkillMessage("天生爱5", "伤害减半", alien.x + alien.w / 2, alien.y, "#b8f36b");
  }
  alien.hp -= damage;

  if (alien.hp > 0) {
    burst(alien.x + alien.w / 2, alien.y + alien.h / 2, "#7bdff2", 8);
    return;
  }

  state.aliens.splice(state.aliens.indexOf(alien), 1);
  state.score += 20 + alien.row * 5;
  burst(alien.x + alien.w / 2, alien.y + alien.h / 2, "#44d7b6");
  updateHud();
}

function speakText(text) {
  if (!("speechSynthesis" in window)) return;
  const now = performance.now();
  if (now - lastSpokenAt < 260) return;
  lastSpokenAt = now;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 1.05;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function loseLife() {
  burst(state.player.x + state.player.w / 2, state.player.y + state.player.h / 2, "#ff6b6b");
  state.lives -= 1;
  state.hitFaceTimer = 0.9;
  state.clearFaceTimer = 0;
  state.player.invincible = 2.2;
  state.alienBullets = [];
  updateHud();
  if (state.lives <= 0) {
    state.running = false;
    state.gameOver = true;
    showOverlay("Game Over", `Score ${state.score} | Press Start to try again`, "Restart");
  }
}

function burst(x, y, color, count = 14) {
  for (let i = 0; i < count; i += 1) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 240,
      vy: (Math.random() - 0.5) * 240,
      life: Math.random() * 0.35 + 0.25,
      color,
    });
  }
}

function addSkillMessage(title, body, x, y, color) {
  state.skillMessages.push({
    title,
    body,
    x,
    y: y - 12,
    life: 1.1,
    color,
  });
}

function updateParticles(dt) {
  for (const particle of state.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
  }
  state.particles = state.particles.filter((particle) => particle.life > 0);
}

function updateSkillMessages(dt) {
  for (const message of state.skillMessages) {
    message.y -= 34 * dt;
    message.life -= dt;
  }
  state.skillMessages = state.skillMessages.filter((message) => message.life > 0);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  drawPlayer();
  drawAliens();
  drawBullets();
  drawParticles();
  drawSkillMessages();
  if (state.paused) {
    ctx.fillStyle = "rgba(8, 10, 15, 0.62)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f4f6fb";
    ctx.font = "700 54px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2);
  }
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#080a0f");
  gradient.addColorStop(1, "#111722");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const star of stars) {
    ctx.fillStyle = `rgba(244, 246, 251, ${0.35 + star.r * 0.2})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer() {
  const activeFace = getActivePlayerFace();
  const blink = state.player.invincible > 0 && state.hitFaceTimer <= 0 && Math.floor(state.player.invincible * 12) % 2 === 0;
  if (blink) return;
  const { x, y, w, h } = state.player;

  ctx.save();
  ctx.shadowColor = state.hitFaceTimer > 0 ? "rgba(255, 107, 107, 0.72)" : "rgba(68, 215, 182, 0.65)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = state.hitFaceTimer > 0 ? "#ff6b6b" : "#44d7b6";
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, w / 2 + 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2);
  ctx.clip();

  if (activeFace.complete && activeFace.naturalWidth > 0) {
    const size = Math.min(activeFace.naturalWidth, activeFace.naturalHeight);
    const sx = (activeFace.naturalWidth - size) / 2;
    const sy = Math.max(0, (activeFace.naturalHeight - size) * 0.12);
    ctx.drawImage(activeFace, sx, sy, size, size, x, y, w, h);
  } else {
    ctx.fillStyle = "#f4f6fb";
    ctx.fillRect(x, y, w, h);
  }

  ctx.restore();
  ctx.strokeStyle = "#f4f6fb";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#ffd166";
  ctx.fillRect(x + 8, y + h - 2, 10, 8);
  ctx.fillRect(x + w - 18, y + h - 2, 10, 8);
}

function getActivePlayerFace() {
  if (state.hitFaceTimer > 0) return hitFace;
  if (state.clearFaceTimer > 0) return clearFace;
  return playerFace;
}

function drawAliens() {
  for (const alien of state.aliens) {
    const bob = Math.sin(alien.wobble) * 2;
    const color = getAlienColor(alien);
    const shielded = alien.skill === "framed" && alien.shieldHits > 0;
    ctx.fillStyle = "rgba(16, 18, 24, 0.92)";
    roundRect(alien.x - 3, alien.y - 4 + bob, alien.w + 6, alien.h + 8, 8);
    ctx.fill();
    ctx.strokeStyle = shielded ? "#f4f6fb" : color;
    ctx.lineWidth = shielded ? 4 : 2;
    roundRect(alien.x - 3, alien.y - 4 + bob, alien.w + 6, alien.h + 8, 8);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = alien.skill === "deerHorse" ? "900 22px system-ui" : "800 18px ui-monospace, SFMono-Regular, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(alien.value), alien.x + alien.w / 2, alien.y + alien.h / 2 + bob + 1);
    drawAlienSkillBadge(alien, color, bob);
    ctx.fillStyle = "#ff6b6b";
    ctx.fillRect(alien.x + 7, alien.y + alien.h + bob + 3, 7, 5);
    ctx.fillRect(alien.x + alien.w - 14, alien.y + alien.h + bob + 3, 7, 5);
  }
  ctx.lineWidth = 1;
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
}

function getAlienColor(alien) {
  if (alien.skill === "love5") return "#b8f36b";
  if (alien.skill === "framed") return "#f4f6fb";
  if (alien.skill === "deerHorse") return alien.beast === "马" ? "#ffd166" : "#ff6b6b";
  return alien.row % 2 === 0 ? "#b8f36b" : "#7bdff2";
}

function drawAlienSkillBadge(alien, color, bob) {
  let label = "";
  if (alien.skill === "love5") label = "5";
  if (alien.skill === "framed") label = alien.shieldHits > 0 ? String(alien.shieldHits) : "莫";
  if (alien.skill === "deerHorse") label = "辨";
  if (!label) return;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(alien.x + alien.w + 5, alien.y - 5 + bob, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#101218";
  ctx.font = "800 11px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, alien.x + alien.w + 5, alien.y - 5 + bob + 1);
}

function drawBullets() {
  ctx.fillStyle = "#ffd166";
  for (const bullet of state.playerBullets) roundRect(bullet.x, bullet.y, bullet.w, bullet.h, 3, true);
  ctx.fillStyle = "#ff6b6b";
  for (const bullet of state.alienBullets) roundRect(bullet.x, bullet.y, bullet.w, bullet.h, 3, true);
}

function drawParticles() {
  for (const particle of state.particles) {
    ctx.globalAlpha = Math.max(0, particle.life * 2);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, 4, 4);
  }
  ctx.globalAlpha = 1;
}

function drawSkillMessages() {
  for (const message of state.skillMessages) {
    const alpha = clamp(message.life / 1.1, 0, 1);
    const x = clamp(message.x, 78, canvas.width - 78);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(8, 10, 15, 0.72)";
    roundRect(x - 76, message.y - 34, 152, 56, 8, true);
    ctx.strokeStyle = message.color;
    ctx.lineWidth = 2;
    roundRect(x - 76, message.y - 34, 152, 56, 8);
    ctx.stroke();
    ctx.fillStyle = message.color;
    ctx.font = "900 30px system-ui";
    ctx.fillText(message.title, x, message.y - 11);
    ctx.fillStyle = "#f4f6fb";
    ctx.font = "700 13px system-ui";
    ctx.fillText(message.body, x, message.y + 16);
    ctx.restore();
  }
}

function roundRect(x, y, w, h, r, fillNow = false) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fillNow) ctx.fill();
}

function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function loop(time) {
  const dt = Math.min(0.033, (time - state.lastTime) / 1000 || 0);
  state.lastTime = time;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function setTouchKey(key, pressed) {
  if (pressed) keys.add(key);
  else keys.delete(key);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowleft", "arrowright", "a", "d", " "].includes(key)) event.preventDefault();
  if (key === "p" && state.running) state.paused = !state.paused;
  keys.add(key);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

startButton.addEventListener("click", resetGame);

for (const [id, key] of [
  ["leftButton", "touchleft"],
  ["rightButton", "touchright"],
  ["fireButton", "touchfire"],
]) {
  const button = document.querySelector(`#${id}`);
  button.addEventListener("pointerdown", () => setTouchKey(key, true));
  button.addEventListener("pointerup", () => setTouchKey(key, false));
  button.addEventListener("pointerleave", () => setTouchKey(key, false));
  button.addEventListener("pointercancel", () => setTouchKey(key, false));
}

draw();
requestAnimationFrame(loop);
