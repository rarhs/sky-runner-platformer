// ============================================
//  SKY RUNNER — A Platformer Adventure
//  Built with HTML Canvas + Vanilla JavaScript
// ============================================

// ---- CANVAS SETUP ----
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 960;
canvas.height = 540;

// ---- CONSTANTS ----
const GRAVITY = 0.6;
const FRICTION = 0.85;
const PLAYER_SPEED = 0.8;
const JUMP_FORCE = -13;
const TILE = 40;

// ---- INPUT ----
const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; e.preventDefault(); });
window.addEventListener('keyup', e => { keys[e.code] = false; });

// ---- UTILITY ----
function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(min, max) { return Math.random() * (max - min) + min; }

// ---- SOUND SYSTEM (Web Audio API) ----
let audioCtx = null;
let musicGain = null;
let musicPlaying = false;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playTone(freq, duration, type, vol, slide) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  if (slide) osc.frequency.linearRampToValueAtTime(slide, audioCtx.currentTime + duration);
  gain.gain.setValueAtTime(vol || 0.15, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function sfxJump() {
  playTone(300, 0.15, 'square', 0.12, 600);
}

function sfxCoin() {
  playTone(987, 0.08, 'square', 0.1);
  setTimeout(() => playTone(1318, 0.12, 'square', 0.1), 80);
}

function sfxStomp() {
  playTone(200, 0.15, 'triangle', 0.15, 80);
}

function sfxDeath() {
  playTone(400, 0.15, 'square', 0.12, 200);
  setTimeout(() => playTone(300, 0.15, 'square', 0.12, 150), 150);
  setTimeout(() => playTone(200, 0.3, 'square', 0.1, 80), 300);
}

function sfxLevelComplete() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((n, i) => {
    setTimeout(() => playTone(n, 0.2, 'square', 0.1), i * 120);
  });
}

function sfxWin() {
  const notes = [523, 659, 784, 659, 784, 1047];
  notes.forEach((n, i) => {
    setTimeout(() => playTone(n, 0.25, 'triangle', 0.1), i * 150);
  });
}

function sfxDoubleJump() {
  playTone(500, 0.12, 'square', 0.1, 900);
}

function sfxWallJump() {
  playTone(350, 0.1, 'sawtooth', 0.1, 700);
}

function sfxCheckpoint() {
  playTone(659, 0.12, 'triangle', 0.12);
  setTimeout(() => playTone(784, 0.12, 'triangle', 0.12), 100);
  setTimeout(() => playTone(1047, 0.18, 'triangle', 0.1), 200);
}

function sfxSpike() {
  playTone(150, 0.1, 'sawtooth', 0.15, 50);
  setTimeout(() => playTone(100, 0.15, 'square', 0.1, 40), 80);
}

function sfxLava() {
  playTone(80, 0.3, 'sawtooth', 0.12, 40);
  setTimeout(() => playTone(120, 0.2, 'square', 0.08, 60), 100);
}

function sfxPowerUp() {
  playTone(523, 0.1, 'triangle', 0.12);
  setTimeout(() => playTone(659, 0.1, 'triangle', 0.12), 80);
  setTimeout(() => playTone(784, 0.1, 'triangle', 0.12), 160);
  setTimeout(() => playTone(1047, 0.15, 'triangle', 0.1), 240);
}

function sfxPowerDown() {
  playTone(400, 0.15, 'sine', 0.06, 200);
}

// Background music — unique theme per level
let musicTimeout = null;
let currentMusicLevel = 1;
const musicTimeouts = [];

function startMusic(lvl) {
  if (!audioCtx || musicPlaying) return;
  musicPlaying = true;
  currentMusicLevel = lvl || 1;
  playMusicLoop();
}

function stopMusic() {
  musicPlaying = false;
  musicTimeouts.forEach(t => clearTimeout(t));
  musicTimeouts.length = 0;
  if (musicTimeout) clearTimeout(musicTimeout);
}

// Level 1: Calm, adventurous — triangle wave, relaxed pace
const melody1 = [
  262, 294, 330, 349, 392, 349, 330, 294,
  262, 330, 392, 523, 392, 330, 262, 294,
  349, 392, 440, 392, 349, 330, 294, 262
];
// Level 2: Intense, faster — square wave, quicker tempo
const melody2 = [
  330, 392, 440, 523, 440, 392, 330, 392,
  523, 587, 659, 587, 523, 440, 392, 440,
  523, 659, 784, 659, 523, 440, 392, 330
];
// Level 3: Dramatic, urgent — sawtooth wave, fastest tempo, lower pitch
const melody3 = [
  196, 220, 262, 294, 262, 220, 196, 220,
  262, 330, 392, 330, 262, 220, 196, 262,
  294, 330, 392, 440, 392, 330, 262, 196,
  220, 262, 330, 262, 220, 196, 165, 196
];

// Level 4: Ethereal sky temple — sine wave, mystical
const melody4 = [
  392, 523, 659, 784, 659, 523, 392, 440,
  523, 659, 784, 880, 784, 659, 523, 440,
  392, 523, 440, 392, 349, 392, 440, 523
];
// Level 5: Final gauntlet — aggressive, mixed
const melody5 = [
  196, 262, 330, 392, 330, 262, 196, 165,
  196, 262, 392, 523, 392, 262, 196, 220,
  262, 330, 392, 523, 659, 523, 392, 262,
  220, 196, 165, 196, 220, 262, 330, 262
];

const levelMusic = {
  1: { melody: melody1, gap: 210, noteLen: 0.20, type: 'triangle', vol: 0.04 },
  2: { melody: melody2, gap: 160, noteLen: 0.15, type: 'square', vol: 0.03 },
  3: { melody: melody3, gap: 130, noteLen: 0.14, type: 'sawtooth', vol: 0.025 },
  4: { melody: melody4, gap: 190, noteLen: 0.22, type: 'sine', vol: 0.05 },
  5: { melody: melody5, gap: 120, noteLen: 0.12, type: 'sawtooth', vol: 0.03 }
};

function playMusicLoop() {
  if (!musicPlaying || !audioCtx) return;
  const cfg = levelMusic[currentMusicLevel] || levelMusic[1];
  const { melody, gap, noteLen, type, vol } = cfg;

  melody.forEach((freq, i) => {
    const t = setTimeout(() => {
      if (!musicPlaying || !audioCtx) return;
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(vol, audioCtx.currentTime);
      g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + noteLen);
      osc.connect(g);
      g.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + noteLen);
    }, i * gap);
    musicTimeouts.push(t);
  });
  // Loop after melody finishes
  musicTimeout = setTimeout(() => playMusicLoop(), melody.length * gap);
}

// ---- PARTICLE SYSTEM ----
class Particle {
  constructor(x, y, color, vx, vy, life, size) {
    this.x = x; this.y = y; this.color = color;
    this.vx = vx; this.vy = vy; this.life = life;
    this.maxLife = life; this.size = size || 3;
  }
  update() {
    this.x += this.vx; this.y += this.vy;
    this.vy += 0.1; this.life--;
  }
  draw(cx) {
    const a = this.life / this.maxLife;
    cx.globalAlpha = a;
    cx.fillStyle = this.color;
    cx.fillRect(this.x - cam.x, this.y - cam.y, this.size * a, this.size * a);
    cx.globalAlpha = 1;
  }
}

let particles = [];
function spawnParticles(x, y, color, count, spread) {
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y, color,
      rand(-spread, spread), rand(-spread * 1.5, -0.5),
      rand(15, 35), rand(2, 5)));
  }
}

// ---- PLAYER ----
const player = {
  x: 80, y: 300, w: 28, h: 36,
  vx: 0, vy: 0, onGround: false,
  facing: 1, frame: 0, frameTimer: 0,
  lives: 3, score: 0, invincible: 0,
  jumpHeld: false, jumpTime: 0,
  // Double jump
  jumpsLeft: 2, maxJumps: 2,
  // Wall jump
  onWall: false, wallDir: 0, wallSlideTimer: 0,
  // Checkpoint
  lastCheckpoint: null,
  // Power-ups
  speedBoost: 0, invincibilityPU: 0, coinMagnet: 0,
  reset(x, y) {
    const cx = this.lastCheckpoint;
    this.x = x || (cx ? cx.x : 80);
    this.y = y || (cx ? cx.y - this.h : 300);
    this.vx = 0; this.vy = 0;
    this.onGround = false; this.onWall = false;
    this.wallDir = 0; this.wallSlideTimer = 0;
    this.jumpsLeft = this.maxJumps;
    this.speedBoost = 0; this.invincibilityPU = 0; this.coinMagnet = 0;
  }
};

function drawPlayer(p) {
  const sx = p.x - cam.x, sy = p.y - cam.y;
  if (p.invincible > 0 && Math.floor(p.invincible / 4) % 2) return;

  // Body
  ctx.fillStyle = '#4fc3f7';
  ctx.fillRect(sx + 4, sy + 8, 20, 18);
  // Head
  ctx.fillStyle = '#ffcc80';
  ctx.fillRect(sx + 6, sy, 16, 14);
  // Eyes
  ctx.fillStyle = '#1a1a2e';
  const ex = p.facing > 0 ? 16 : 8;
  ctx.fillRect(sx + ex, sy + 4, 4, 4);
  // Legs
  ctx.fillStyle = '#3949ab';
  const legOffset = p.onGround ? Math.sin(p.frame * 0.5) * 3 : 4;
  ctx.fillRect(sx + 5, sy + 26, 8, 10);
  ctx.fillRect(sx + 15, sy + 26, 8, 10);
  // Hat
  ctx.fillStyle = '#ef5350';
  ctx.fillRect(sx + 4, sy - 2, 20, 5);
  ctx.fillRect(sx + 8, sy - 6, 12, 5);
}

// ---- PLATFORM ----
class Platform {
  constructor(x, y, w, h, color, moveX, moveRange) {
    this.x = x; this.y = y; this.w = w; this.h = h || 16;
    this.color = color || '#4a6741';
    this.moveX = moveX || 0; this.moveRange = moveRange || 0;
    this.originX = x; this.time = rand(0, Math.PI * 2);
  }
  update() {
    if (this.moveRange > 0) {
      this.time += 0.02;
      this.x = this.originX + Math.sin(this.time) * this.moveRange;
    }
  }
  draw() {
    const sx = this.x - cam.x, sy = this.y - cam.y;
    // Top grass layer
    ctx.fillStyle = '#66bb6a';
    ctx.fillRect(sx, sy, this.w, 6);
    // Dirt
    ctx.fillStyle = this.color;
    ctx.fillRect(sx, sy + 6, this.w, this.h - 6);
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(sx + 2, sy + 2, this.w - 4, 2);
  }
}

// ---- COIN ----
class Coin {
  constructor(x, y) {
    this.x = x; this.y = y; this.w = 16; this.h = 16;
    this.collected = false; this.bobTime = rand(0, Math.PI * 2);
  }
  update() { this.bobTime += 0.06; }
  draw() {
    if (this.collected) return;
    const sx = this.x - cam.x;
    const sy = this.y + Math.sin(this.bobTime) * 4 - cam.y;
    const stretch = Math.abs(Math.cos(this.bobTime * 0.8));
    ctx.fillStyle = '#ffd54f';
    ctx.fillRect(sx + 4 * (1 - stretch), sy, 16 * stretch, 16);
    ctx.fillStyle = '#fff176';
    ctx.fillRect(sx + 5 * (1 - stretch), sy + 3, 6 * stretch, 6);
  }
}

// ---- ENEMY ----
class Enemy {
  constructor(x, y, range) {
    this.x = x; this.y = y; this.w = 30; this.h = 28;
    this.originX = x; this.range = range || 100;
    this.speed = 1.2; this.dir = 1; this.alive = true;
    this.frame = 0;
  }
  update() {
    if (!this.alive) return;
    this.x += this.speed * this.dir;
    this.frame += 0.1;
    if (this.x > this.originX + this.range || this.x < this.originX - this.range) {
      this.dir *= -1;
    }
  }
  draw() {
    if (!this.alive) return;
    const sx = this.x - cam.x, sy = this.y - cam.y;
    // Body
    ctx.fillStyle = '#e53935';
    ctx.fillRect(sx + 2, sy + 6, 26, 18);
    // Eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(sx + 6, sy + 8, 7, 7);
    ctx.fillRect(sx + 17, sy + 8, 7, 7);
    ctx.fillStyle = '#1a1a2e';
    const ed = this.dir > 0 ? 3 : 0;
    ctx.fillRect(sx + 6 + ed, sy + 10, 4, 4);
    ctx.fillRect(sx + 17 + ed, sy + 10, 4, 4);
    // Feet
    ctx.fillStyle = '#b71c1c';
    const step = Math.sin(this.frame * 3) * 2;
    ctx.fillRect(sx + 4, sy + 22, 8, 6 + step);
    ctx.fillRect(sx + 18, sy + 22, 8, 6 - step);
    // Spikes
    ctx.fillStyle = '#ff7043';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(sx + 6 + i * 8, sy + 6);
      ctx.lineTo(sx + 10 + i * 8, sy - 4);
      ctx.lineTo(sx + 14 + i * 8, sy + 6);
      ctx.fill();
    }
  }
}

// ---- BAT (flying enemy) ----
class Bat {
  constructor(x, y, range) {
    this.x = x; this.y = y; this.w = 26; this.h = 20;
    this.originX = x; this.originY = y;
    this.range = range || 120;
    this.speed = 1.5; this.dir = 1; this.alive = true;
    this.time = rand(0, Math.PI * 2);
    this.wingFrame = 0;
  }
  update() {
    if (!this.alive) return;
    this.time += 0.03;
    this.wingFrame += 0.15;
    this.x += this.speed * this.dir;
    this.y = this.originY + Math.sin(this.time * 2) * 30;
    if (this.x > this.originX + this.range || this.x < this.originX - this.range) {
      this.dir *= -1;
    }
  }
  draw() {
    if (!this.alive) return;
    const sx = this.x - cam.x, sy = this.y - cam.y;
    const wingY = Math.sin(this.wingFrame) * 6;
    // Wings
    ctx.fillStyle = '#7b1fa2';
    ctx.beginPath();
    ctx.moveTo(sx + 13, sy + 10);
    ctx.lineTo(sx - 4, sy + 4 + wingY);
    ctx.lineTo(sx + 4, sy + 14);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(sx + 13, sy + 10);
    ctx.lineTo(sx + 30, sy + 4 + wingY);
    ctx.lineTo(sx + 22, sy + 14);
    ctx.fill();
    // Body
    ctx.fillStyle = '#4a148c';
    ctx.beginPath();
    ctx.arc(sx + 13, sy + 10, 7, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#ff1744';
    ctx.fillRect(sx + 8, sy + 7, 3, 3);
    ctx.fillRect(sx + 15, sy + 7, 3, 3);
  }
}

// ---- SPIKE (hazard) ----
class Spike {
  constructor(x, y, count) {
    this.x = x; this.y = y;
    this.count = count || 3;
    this.w = this.count * 16; this.h = 16;
  }
  update() { }
  draw() {
    const sx = this.x - cam.x, sy = this.y - cam.y;
    for (let i = 0; i < this.count; i++) {
      // Metallic spike
      ctx.fillStyle = '#b0bec5';
      ctx.beginPath();
      ctx.moveTo(sx + i * 16, sy + 16);
      ctx.lineTo(sx + i * 16 + 8, sy);
      ctx.lineTo(sx + i * 16 + 16, sy + 16);
      ctx.fill();
      // Highlight edge
      ctx.fillStyle = '#eceff1';
      ctx.beginPath();
      ctx.moveTo(sx + i * 16 + 6, sy + 4);
      ctx.lineTo(sx + i * 16 + 8, sy);
      ctx.lineTo(sx + i * 16 + 10, sy + 4);
      ctx.fill();
    }
  }
}

// ---- LAVA (hazard) ----
class Lava {
  constructor(x, y, w) {
    this.x = x; this.y = y; this.w = w; this.h = 40;
    this.time = rand(0, Math.PI * 2);
    this.bubbles = [];
    for (let i = 0; i < Math.floor(w / 30); i++) {
      this.bubbles.push({ x: rand(0, w), phase: rand(0, Math.PI * 2), speed: rand(0.03, 0.06) });
    }
  }
  update() { this.time += 0.04; }
  draw() {
    const sx = this.x - cam.x, sy = this.y - cam.y;
    // Main lava body
    const grd = ctx.createLinearGradient(sx, sy, sx, sy + 40);
    grd.addColorStop(0, '#ff6f00');
    grd.addColorStop(0.5, '#e65100');
    grd.addColorStop(1, '#bf360c');
    ctx.fillStyle = grd;
    ctx.fillRect(sx, sy + 6, this.w, 34);
    // Wavy surface
    ctx.fillStyle = '#ffab00';
    ctx.beginPath();
    ctx.moveTo(sx, sy + 12);
    for (let x = 0; x <= this.w; x += 8) {
      const wave = Math.sin(this.time * 2 + x * 0.06) * 4;
      ctx.lineTo(sx + x, sy + 6 + wave);
    }
    ctx.lineTo(sx + this.w, sy + 12);
    ctx.fill();
    // Bubbles
    ctx.fillStyle = '#ffd600';
    for (const b of this.bubbles) {
      const by = Math.sin(this.time * 3 + b.phase) * 4;
      const bsize = Math.sin(this.time * 2 + b.phase) * 2 + 3;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(sx + b.x, sy + 14 + by, bsize, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Glow
    ctx.fillStyle = 'rgba(255, 152, 0, 0.15)';
    ctx.fillRect(sx, sy - 10, this.w, 16);
  }
}

// ---- FLAG (level goal) ----
class Flag {
  constructor(x, y) {
    this.x = x; this.y = y; this.w = 20; this.h = 60; this.time = 0;
  }
  update() { this.time += 0.05; }
  draw() {
    const sx = this.x - cam.x, sy = this.y - cam.y;
    // Pole
    ctx.fillStyle = '#bdbdbd';
    ctx.fillRect(sx + 8, sy, 4, 60);
    // Flag cloth
    const wave = Math.sin(this.time) * 4;
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath();
    ctx.moveTo(sx + 12, sy + 4);
    ctx.lineTo(sx + 36 + wave, sy + 10);
    ctx.lineTo(sx + 12, sy + 22);
    ctx.fill();
    // Star
    ctx.fillStyle = '#ff9800';
    ctx.fillRect(sx + 18, sy + 10, 6, 6);
    // Ball top
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath();
    ctx.arc(sx + 10, sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---- CHECKPOINT ----
class Checkpoint {
  constructor(x, y) {
    this.x = x; this.y = y; this.w = 16; this.h = 50;
    this.active = false; this.time = 0;
  }
  update() { this.time += 0.05; }
  draw() {
    const sx = this.x - cam.x, sy = this.y - cam.y;
    // Pole
    ctx.fillStyle = this.active ? '#66bb6a' : '#616161';
    ctx.fillRect(sx + 6, sy + 10, 4, 40);
    // Orb
    const glow = this.active ? Math.sin(this.time * 2) * 0.3 + 0.7 : 0.3;
    ctx.globalAlpha = glow;
    ctx.fillStyle = this.active ? '#69f0ae' : '#9e9e9e';
    ctx.beginPath();
    ctx.arc(sx + 8, sy + 6, 8, 0, Math.PI * 2);
    ctx.fill();
    // Inner glow
    if (this.active) {
      ctx.fillStyle = '#b9f6ca';
      ctx.beginPath();
      ctx.arc(sx + 8, sy + 6, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// ---- POWER-UP ----
class PowerUp {
  constructor(x, y, type) {
    this.x = x; this.y = y; this.w = 20; this.h = 20;
    this.type = type; // 'speed', 'invincible', 'magnet'
    this.collected = false;
    this.time = rand(0, Math.PI * 2);
  }
  update() { this.time += 0.05; }
  draw() {
    if (this.collected) return;
    const sx = this.x - cam.x, sy = this.y + Math.sin(this.time) * 4 - cam.y;
    // Glow aura
    const colors = { speed: '#ff9800', invincible: '#ffd600', magnet: '#42a5f5' };
    const icons = { speed: '⚡', invincible: '🛡️', magnet: '🧲' };
    const c = colors[this.type];
    ctx.globalAlpha = 0.3 + Math.sin(this.time * 2) * 0.15;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(sx + 10, sy + 10, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Box
    ctx.fillStyle = c;
    ctx.fillRect(sx + 2, sy + 2, 16, 16);
    // Inner highlight
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.5;
    ctx.fillRect(sx + 4, sy + 4, 6, 3);
    ctx.globalAlpha = 1;
    // Type indicator
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(icons[this.type], sx + 10, sy + 14);
    ctx.textAlign = 'left';
  }
}

// ---- CAMERA ----
const cam = { x: 0, y: 0 };

// ---- BACKGROUND (parallax) ----
function drawBackground(levelW) {
  // Sky gradient
  const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grd.addColorStop(0, '#0d1b2a');
  grd.addColorStop(0.5, '#1b2838');
  grd.addColorStop(1, '#2d4a3e');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Stars
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 60; i++) {
    const sx = ((i * 137 + 50) % canvas.width);
    const sy = ((i * 97 + 30) % (canvas.height * 0.5));
    const twinkle = Math.sin(Date.now() * 0.003 + i) * 0.5 + 0.5;
    ctx.globalAlpha = twinkle * 0.8;
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.globalAlpha = 1;

  // Far mountains (slowest parallax)
  drawMountains(0.1, '#1a3040', 280, 120);
  // Near mountains
  drawMountains(0.25, '#1e3a30', 340, 100);
  // Hills
  drawMountains(0.4, '#2d5040', 400, 70);
}

function drawMountains(parallax, color, baseY, height) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height);
  for (let x = 0; x <= canvas.width + 80; x += 80) {
    const wx = x + cam.x * parallax;
    const h = Math.sin(wx * 0.005) * height * 0.6
      + Math.sin(wx * 0.012 + 2) * height * 0.3
      + Math.sin(wx * 0.025 + 5) * height * 0.1;
    ctx.lineTo(x, baseY - h);
  }
  ctx.lineTo(canvas.width, canvas.height);
  ctx.fill();
}

// ---- LEVELS ----
function createLevel(num) {
  const platforms = [];
  const coins = [];
  const enemies = [];
  const bats = [];
  const spikes = [];
  const lavas = [];
  const powerups = [];
  let flag;

  if (num === 1) {
    // Ground sections
    platforms.push(new Platform(0, 480, 400, 60, '#4a6741'));
    platforms.push(new Platform(500, 480, 300, 60, '#4a6741'));
    platforms.push(new Platform(900, 480, 500, 60, '#4a6741'));
    platforms.push(new Platform(1500, 480, 400, 60, '#4a6741'));
    // Stepping platforms
    platforms.push(new Platform(300, 380, 100, 16));
    platforms.push(new Platform(480, 300, 100, 16));
    platforms.push(new Platform(650, 360, 120, 16));
    platforms.push(new Platform(850, 280, 100, 16));
    platforms.push(new Platform(1050, 350, 120, 16));
    platforms.push(new Platform(1250, 300, 100, 16));
    platforms.push(new Platform(1400, 380, 120, 16));
    // Coins
    coins.push(new Coin(340, 340));
    coins.push(new Coin(510, 260));
    coins.push(new Coin(700, 320));
    coins.push(new Coin(880, 240));
    coins.push(new Coin(1100, 310));
    coins.push(new Coin(1280, 260));
    coins.push(new Coin(950, 440));
    coins.push(new Coin(1000, 440));
    // Enemies
    enemies.push(new Enemy(600, 452, 80));
    enemies.push(new Enemy(1000, 452, 100));
    enemies.push(new Enemy(1550, 452, 80));
    // Flag
    flag = new Flag(1830, 420);
    // Power-ups (Level 1 — tutorial)
    powerups.push(new PowerUp(880, 240, 'speed'));
  } else if (num === 2) {
    // Ground
    platforms.push(new Platform(0, 480, 300, 60, '#4a5568'));
    platforms.push(new Platform(600, 480, 200, 60, '#4a5568'));
    platforms.push(new Platform(1100, 480, 200, 60, '#4a5568'));
    platforms.push(new Platform(1700, 480, 500, 60, '#4a5568'));
    // Floating platforms
    platforms.push(new Platform(250, 380, 80, 16, '#5a7060'));
    platforms.push(new Platform(400, 300, 80, 16, '#5a7060'));
    platforms.push(new Platform(550, 220, 120, 16, '#5a7060'));
    platforms.push(new Platform(750, 320, 80, 16, '#5a7060'));
    // Moving platforms
    platforms.push(new Platform(900, 380, 100, 16, '#80cbc4', 1, 80));
    platforms.push(new Platform(1100, 280, 100, 16, '#80cbc4', 1, 100));
    platforms.push(new Platform(1350, 350, 80, 16, '#80cbc4', 1, 60));
    platforms.push(new Platform(1550, 280, 120, 16, '#5a7060'));
    platforms.push(new Platform(1500, 400, 100, 16, '#5a7060'));
    // Coins
    coins.push(new Coin(280, 340));
    coins.push(new Coin(430, 260));
    coins.push(new Coin(590, 180));
    coins.push(new Coin(780, 280));
    coins.push(new Coin(940, 340));
    coins.push(new Coin(1140, 240));
    coins.push(new Coin(1380, 310));
    coins.push(new Coin(1580, 240));
    coins.push(new Coin(1750, 440));
    coins.push(new Coin(1800, 440));
    // Enemies
    enemies.push(new Enemy(650, 452, 60));
    enemies.push(new Enemy(1150, 452, 60));
    enemies.push(new Enemy(1800, 452, 100));
    enemies.push(new Enemy(1580, 256, 40));
    // Flag
    flag = new Flag(2100, 420);
    // Hazards for Level 2
    spikes.push(new Spike(750, 304, 2));
    spikes.push(new Spike(1500, 384, 2));
    // Power-ups (Level 2)
    powerups.push(new PowerUp(430, 260, 'speed'));
    powerups.push(new PowerUp(1380, 270, 'magnet'));
  } else if (num === 2) {
    // Level 3 — hardest
    platforms.push(new Platform(0, 480, 200, 60, '#5d4037'));
    platforms.push(new Platform(800, 480, 200, 60, '#5d4037'));
    platforms.push(new Platform(1600, 480, 200, 60, '#5d4037'));
    platforms.push(new Platform(2200, 480, 400, 60, '#5d4037'));
    // Tricky jumps
    platforms.push(new Platform(200, 400, 60, 16, '#6d5040'));
    platforms.push(new Platform(320, 340, 60, 16, '#6d5040'));
    platforms.push(new Platform(460, 280, 60, 16, '#6d5040'));
    platforms.push(new Platform(600, 220, 80, 16, '#6d5040'));
    platforms.push(new Platform(700, 340, 60, 16, '#6d5040'));
    // Moving sections
    platforms.push(new Platform(900, 350, 80, 16, '#80cbc4', 1, 100));
    platforms.push(new Platform(1100, 280, 80, 16, '#80cbc4', 1, 80));
    platforms.push(new Platform(1300, 350, 80, 16, '#80cbc4', 1, 120));
    platforms.push(new Platform(1500, 250, 80, 16, '#80cbc4', 1, 60));
    // Final stretch
    platforms.push(new Platform(1750, 380, 60, 16, '#6d5040'));
    platforms.push(new Platform(1900, 320, 60, 16, '#6d5040'));
    platforms.push(new Platform(2050, 380, 80, 16, '#6d5040'));
    // Coins (more = more reward for harder level)
    coins.push(new Coin(230, 360));
    coins.push(new Coin(350, 300));
    coins.push(new Coin(490, 240));
    coins.push(new Coin(630, 180));
    coins.push(new Coin(730, 300));
    coins.push(new Coin(950, 300));
    coins.push(new Coin(1150, 230));
    coins.push(new Coin(1350, 300));
    coins.push(new Coin(1530, 200));
    coins.push(new Coin(1780, 340));
    coins.push(new Coin(1930, 280));
    coins.push(new Coin(2300, 440));
    coins.push(new Coin(2350, 440));
    coins.push(new Coin(2400, 440));
    // More enemies
    enemies.push(new Enemy(850, 452, 60));
    enemies.push(new Enemy(1650, 452, 60));
    enemies.push(new Enemy(2300, 452, 80));
    enemies.push(new Enemy(2400, 452, 60));
    enemies.push(new Enemy(620, 196, 30));
    // Flag
    flag = new Flag(2530, 420);
    // Hazards for Level 3
    spikes.push(new Spike(700, 324, 2));
    spikes.push(new Spike(2200, 464, 3));
    lavas.push(new Lava(200, 500, 600));
    lavas.push(new Lava(1000, 500, 600));
    bats.push(new Bat(500, 180, 100));
    bats.push(new Bat(1400, 200, 120));
    // Power-ups (Level 3)
    powerups.push(new PowerUp(490, 240, 'invincible'));
    powerups.push(new PowerUp(1350, 260, 'magnet'));
  } else if (num === 4) {
    // Level 4 — Sky Temple (double jump + wall jump required)
    const checkpoints = [];
    // Ground start
    platforms.push(new Platform(0, 480, 250, 60, '#37474f'));
    // Tall walls for wall jumping
    platforms.push(new Platform(300, 200, 20, 280, '#546e7a'));
    platforms.push(new Platform(380, 200, 20, 280, '#546e7a'));
    // Platform after wall jump
    platforms.push(new Platform(440, 300, 80, 16, '#607d8b'));
    // Checkpoint 1
    checkpoints.push(new Checkpoint(470, 250));
    // Double jump gap
    platforms.push(new Platform(600, 350, 60, 16, '#607d8b'));
    platforms.push(new Platform(780, 280, 60, 16, '#607d8b'));
    platforms.push(new Platform(950, 350, 80, 16, '#607d8b'));
    // Another wall section
    platforms.push(new Platform(1080, 150, 20, 330, '#546e7a'));
    platforms.push(new Platform(1160, 150, 20, 330, '#546e7a'));
    platforms.push(new Platform(1080, 140, 100, 16, '#607d8b'));
    // Checkpoint 2
    checkpoints.push(new Checkpoint(1120, 90));
    // Sky bridge
    platforms.push(new Platform(1250, 200, 60, 16, '#607d8b'));
    platforms.push(new Platform(1370, 250, 80, 16, '#80cbc4', 1, 60));
    platforms.push(new Platform(1520, 200, 60, 16, '#607d8b'));
    // Final wall climb
    platforms.push(new Platform(1650, 100, 20, 380, '#546e7a'));
    platforms.push(new Platform(1730, 100, 20, 380, '#546e7a'));
    // Landing
    platforms.push(new Platform(1780, 480, 300, 60, '#37474f'));
    // Coins
    coins.push(new Coin(340, 300));
    coins.push(new Coin(340, 350));
    coins.push(new Coin(340, 250));
    coins.push(new Coin(630, 310));
    coins.push(new Coin(810, 240));
    coins.push(new Coin(980, 310));
    coins.push(new Coin(1120, 180));
    coins.push(new Coin(1280, 160));
    coins.push(new Coin(1400, 210));
    coins.push(new Coin(1550, 160));
    coins.push(new Coin(1690, 200));
    coins.push(new Coin(1690, 250));
    coins.push(new Coin(1690, 300));
    // Enemies
    enemies.push(new Enemy(460, 276, 30));
    enemies.push(new Enemy(960, 322, 40));
    enemies.push(new Enemy(1850, 452, 60));
    // Flag
    flag = new Flag(2020, 420);
    // Hazards for Level 4
    bats.push(new Bat(600, 250, 80));
    bats.push(new Bat(1250, 150, 60));
    spikes.push(new Spike(950, 334, 3));
    lavas.push(new Lava(520, 500, 100));
    // Power-ups (Level 4)
    powerups.push(new PowerUp(630, 310, 'speed'));
    powerups.push(new PowerUp(1280, 120, 'invincible'));
    powerups.push(new PowerUp(1550, 160, 'magnet'));
    return { platforms, coins, enemies, bats, spikes, lavas, powerups, flag, checkpoints, width: flag.x + 200 };
  } else {
    // Level 5 — The Gauntlet (everything combined)
    const checkpoints = [];
    // Start
    platforms.push(new Platform(0, 480, 200, 60, '#4e342e'));
    // Wall jump intro
    platforms.push(new Platform(250, 200, 20, 280, '#6d4c41'));
    platforms.push(new Platform(330, 200, 20, 280, '#6d4c41'));
    platforms.push(new Platform(400, 280, 80, 16, '#795548'));
    // Checkpoint 1
    checkpoints.push(new Checkpoint(430, 230));
    // Moving platform section
    platforms.push(new Platform(550, 350, 80, 16, '#80cbc4', 1, 80));
    platforms.push(new Platform(730, 280, 80, 16, '#80cbc4', 1, 60));
    platforms.push(new Platform(900, 350, 80, 16, '#80cbc4', 1, 100));
    // Checkpoint 2
    platforms.push(new Platform(1050, 400, 100, 16, '#795548'));
    checkpoints.push(new Checkpoint(1080, 350));
    // Wall + double jump combo
    platforms.push(new Platform(1200, 150, 20, 330, '#6d4c41'));
    platforms.push(new Platform(1280, 150, 20, 330, '#6d4c41'));
    platforms.push(new Platform(1350, 300, 60, 16, '#795548'));
    platforms.push(new Platform(1500, 220, 60, 16, '#795548'));
    // Checkpoint 3
    platforms.push(new Platform(1620, 350, 80, 16, '#795548'));
    checkpoints.push(new Checkpoint(1650, 300));
    // Enemy gauntlet on ground
    platforms.push(new Platform(1750, 480, 500, 60, '#4e342e'));
    // Final ascent walls
    platforms.push(new Platform(2300, 180, 20, 300, '#6d4c41'));
    platforms.push(new Platform(2380, 180, 20, 300, '#6d4c41'));
    platforms.push(new Platform(2430, 480, 200, 60, '#4e342e'));
    // Coins
    coins.push(new Coin(290, 300));
    coins.push(new Coin(290, 350));
    coins.push(new Coin(580, 310));
    coins.push(new Coin(760, 240));
    coins.push(new Coin(930, 310));
    coins.push(new Coin(1240, 250));
    coins.push(new Coin(1240, 300));
    coins.push(new Coin(1380, 260));
    coins.push(new Coin(1530, 180));
    coins.push(new Coin(1800, 440));
    coins.push(new Coin(1900, 440));
    coins.push(new Coin(2000, 440));
    coins.push(new Coin(2340, 280));
    coins.push(new Coin(2340, 330));
    coins.push(new Coin(2500, 440));
    // Enemies
    enemies.push(new Enemy(430, 256, 30));
    enemies.push(new Enemy(1070, 372, 40));
    enemies.push(new Enemy(1800, 452, 60));
    enemies.push(new Enemy(1920, 452, 50));
    enemies.push(new Enemy(2060, 452, 40));
    enemies.push(new Enemy(2480, 452, 50));
    // Flag
    flag = new Flag(2580, 420);
    // Hazards for Level 5
    bats.push(new Bat(550, 250, 80));
    bats.push(new Bat(1350, 200, 100));
    bats.push(new Bat(2100, 350, 80));
    spikes.push(new Spike(1750, 464, 4));
    spikes.push(new Spike(2430, 464, 3));
    lavas.push(new Lava(400, 500, 150));
    lavas.push(new Lava(1050, 500, 150));
    // Power-ups (Level 5)
    powerups.push(new PowerUp(580, 310, 'speed'));
    powerups.push(new PowerUp(1380, 220, 'invincible'));
    return { platforms, coins, enemies, bats, spikes, lavas, powerups, flag, checkpoints, width: flag.x + 200 };
  }
  return { platforms, coins, enemies, bats, spikes, lavas, powerups, flag, checkpoints: [], width: flag.x + 200 };
}

// ---- GAME STATE ----
let state = 'MENU'; // MENU, PLAYING, LEVEL_COMPLETE, GAME_OVER, WIN
let level = null;
let levelNum = 1;
let levelCompleteTimer = 0;
let deathTimer = 0;
let menuBob = 0;

function startLevel(num) {
  level = createLevel(num);
  player.lastCheckpoint = null;
  player.reset(80, 300);
  player.jumpsLeft = player.maxJumps;
  cam.x = 0; cam.y = 0;
  particles = [];
  state = 'PLAYING';
}

function startGame() {
  initAudio();
  levelNum = 1;
  player.lives = 3;
  player.score = 0;
  startLevel(1);
  startMusic(levelNum);
}

// ---- UPDATE ----
function update() {
  if (state === 'MENU') {
    menuBob += 0.03;
    return;
  }

  if (state === 'LEVEL_COMPLETE') {
    levelCompleteTimer--;
    if (levelCompleteTimer <= 0) {
      levelNum++;
      if (levelNum > 5) { state = 'WIN'; sfxWin(); }
      else { startLevel(levelNum); startMusic(levelNum); }
    }
    return;
  }

  if (state === 'GAME_OVER' || state === 'WIN') return;

  // ---- Player movement ----
  const speedMul = player.speedBoost > 0 ? 1.8 : 1;
  if (keys['ArrowLeft'] || keys['KeyA']) {
    player.vx -= PLAYER_SPEED * speedMul;
    player.facing = -1;
  }
  if (keys['ArrowRight'] || keys['KeyD']) {
    player.vx += PLAYER_SPEED * speedMul;
    player.facing = 1;
  }

  // Variable-height jump + double jump + wall jump
  const jumpKey = keys['Space'] || keys['ArrowUp'] || keys['KeyW'];
  if (jumpKey && !player.jumpHeld) {
    if (player.onWall && !player.onGround) {
      // Wall jump — launch away from wall
      player.vy = JUMP_FORCE * 0.9;
      player.vx = player.wallDir * -8;
      player.facing = -player.wallDir;
      player.onWall = false;
      player.jumpHeld = true;
      player.jumpTime = 0;
      player.jumpsLeft = Math.max(player.jumpsLeft - 1, 0);
      sfxWallJump();
      spawnParticles(player.x + (player.wallDir > 0 ? 0 : player.w), player.y + 18, '#90caf9', 8, 3);
    } else if (player.jumpsLeft > 0) {
      const isDoubleJump = !player.onGround;
      player.vy = JUMP_FORCE * (isDoubleJump ? 0.85 : 1);
      player.onGround = false;
      player.jumpHeld = true;
      player.jumpTime = 0;
      player.jumpsLeft--;
      if (isDoubleJump) {
        sfxDoubleJump();
        spawnParticles(player.x + 14, player.y + 36, '#4fc3f7', 10, 3);
      } else {
        sfxJump();
        spawnParticles(player.x + 14, player.y + 36, '#a0a0a0', 6, 2);
      }
    }
  }
  if (jumpKey && player.jumpHeld && player.jumpTime < 10 && player.vy < 0) {
    player.vy += JUMP_FORCE * 0.05;
    player.jumpTime++;
  }
  if (!jumpKey) { player.jumpHeld = false; }

  // Physics
  player.vx *= FRICTION;
  player.vy += GRAVITY;
  player.x += player.vx;
  player.y += player.vy;
  player.onGround = false;

  if (player.invincible > 0) player.invincible--;
  player.frameTimer++;
  if (player.frameTimer > 6) { player.frame++; player.frameTimer = 0; }

  // ---- Power-up timers ----
  if (player.speedBoost > 0) {
    player.speedBoost--;
    // Orange trail particles
    if (Math.random() < 0.4) spawnParticles(player.x + 14, player.y + 30, '#ff9800', 1, 2);
    if (player.speedBoost === 0) sfxPowerDown();
  }
  if (player.invincibilityPU > 0) {
    player.invincibilityPU--;
    if (player.invincibilityPU === 0) sfxPowerDown();
  }
  if (player.coinMagnet > 0) {
    player.coinMagnet--;
    if (player.coinMagnet === 0) sfxPowerDown();
  }

  // ---- Platform collision ----
  player.onWall = false;
  player.wallDir = 0;
  for (const plat of level.platforms) {
    plat.update();
    // Land on top
    if (player.vy >= 0 &&
      player.x + player.w > plat.x && player.x < plat.x + plat.w &&
      player.y + player.h > plat.y && player.y + player.h < plat.y + plat.h + player.vy + 2) {
      player.y = plat.y - player.h;
      player.vy = 0;
      player.onGround = true;
      player.jumpsLeft = player.maxJumps;
      // Move with moving platform
      if (plat.moveRange > 0) {
        player.x += Math.cos(plat.time) * plat.moveRange * 0.02;
      }
    }
    // Head bonk — hitting bottom from below
    if (player.vy < 0 &&
      player.x + player.w > plat.x + 4 && player.x < plat.x + plat.w - 4 &&
      player.y < plat.y + plat.h && player.y > plat.y + plat.h + player.vy - 2) {
      player.y = plat.y + plat.h;
      player.vy = 0;
    }
    // Side blocking — push player out horizontally
    if (player.y + player.h > plat.y + 4 && player.y < plat.y + plat.h - 4) {
      // Right side of player hits left side of platform
      if (player.x + player.w > plat.x && player.x + player.w < plat.x + 14) {
        player.x = plat.x - player.w;
        player.vx = 0;
        if (!player.onGround) {
          player.onWall = true;
          player.wallDir = 1;
        }
      }
      // Left side of player hits right side of platform
      if (player.x < plat.x + plat.w && player.x > plat.x + plat.w - 14) {
        player.x = plat.x + plat.w;
        player.vx = 0;
        if (!player.onGround) {
          player.onWall = true;
          player.wallDir = -1;
        }
      }
    }
  }

  // Wall slide — slow fall when on wall and holding toward it
  if (player.onWall && !player.onGround) {
    const holdingToward = (player.wallDir > 0 && (keys['ArrowRight'] || keys['KeyD'])) ||
      (player.wallDir < 0 && (keys['ArrowLeft'] || keys['KeyA']));
    if (holdingToward && player.vy > 0) {
      player.vy = Math.min(player.vy, 2);
      player.wallSlideTimer++;
      player.jumpsLeft = Math.max(player.jumpsLeft, 1);
    }
  } else {
    player.wallSlideTimer = 0;
  }

  // left wall
  if (player.x < 0) { player.x = 0; player.vx = 0; }

  // Fall to death
  if (player.y > 600) {
    playerDeath();
    return;
  }

  // ---- Checkpoints ----
  if (level.checkpoints) {
    for (const cp of level.checkpoints) {
      cp.update();
      if (!cp.active && aabb(player, cp)) {
        cp.active = true;
        player.lastCheckpoint = { x: cp.x, y: cp.y };
        sfxCheckpoint();
        spawnParticles(cp.x + 8, cp.y + 6, '#69f0ae', 15, 4);
      }
    }
  }

  // ---- Coins ----
  for (const coin of level.coins) {
    coin.update();
    // Coin magnet — pull nearby coins
    if (!coin.collected && player.coinMagnet > 0) {
      const dx = (player.x + 14) - (coin.x + 8);
      const dy = (player.y + 18) - (coin.y + 8);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 150) {
        coin.x += dx / dist * 5;
        coin.y += dy / dist * 5;
      }
    }
    if (!coin.collected && aabb(player, coin)) {
      coin.collected = true;
      player.score += 100;
      sfxCoin();
      spawnParticles(coin.x + 8, coin.y + 8, '#ffd54f', 10, 3);
    }
  }

  // ---- Enemies ----
  for (const enemy of level.enemies) {
    enemy.update();
    if (enemy.alive && aabb(player, enemy)) {
      // Stomp from above
      if (player.vy > 0 && player.y + player.h < enemy.y + 16) {
        enemy.alive = false;
        player.vy = JUMP_FORCE * 0.6;
        player.score += 200;
        sfxStomp();
        spawnParticles(enemy.x + 15, enemy.y + 14, '#e53935', 12, 4);
      } else if (player.invincible <= 0 && player.invincibilityPU <= 0) {
        playerDeath();
        return;
      }
    }
  }

  // ---- Bats ----
  if (level.bats) {
    for (const bat of level.bats) {
      bat.update();
      if (bat.alive && aabb(player, bat)) {
        if (player.vy > 0 && player.y + player.h < bat.y + 12) {
          bat.alive = false;
          player.vy = JUMP_FORCE * 0.6;
          player.score += 300;
          sfxStomp();
          spawnParticles(bat.x + 13, bat.y + 10, '#7b1fa2', 12, 4);
        } else if (player.invincible <= 0 && player.invincibilityPU <= 0) {
          playerDeath();
          return;
        }
      }
    }
  }

  // ---- Spikes ----
  if (level.spikes) {
    for (const spike of level.spikes) {
      if (aabb(player, spike) && player.invincible <= 0 && player.invincibilityPU <= 0) {
        sfxSpike();
        playerDeath();
        return;
      }
    }
  }

  // ---- Lava ----
  if (level.lavas) {
    for (const lava of level.lavas) {
      lava.update();
      if (aabb(player, lava) && player.invincibilityPU <= 0) {
        sfxLava();
        spawnParticles(player.x + 14, player.y + 18, '#ff6f00', 20, 5);
        playerDeath();
        return;
      }
    }
  }

  // ---- Power-ups ----
  if (level.powerups) {
    for (const pu of level.powerups) {
      pu.update();
      if (!pu.collected && aabb(player, pu)) {
        pu.collected = true;
        sfxPowerUp();
        spawnParticles(pu.x + 10, pu.y + 10, pu.type === 'speed' ? '#ff9800' : pu.type === 'invincible' ? '#ffd600' : '#42a5f5', 15, 4);
        if (pu.type === 'speed') player.speedBoost = 300; // ~5 sec
        if (pu.type === 'invincible') player.invincibilityPU = 300;
        if (pu.type === 'magnet') player.coinMagnet = 480; // ~8 sec
      }
    }
  }

  // ---- Flag ----
  level.flag.update();
  if (aabb(player, level.flag)) {
    state = 'LEVEL_COMPLETE';
    levelCompleteTimer = 90;
    player.score += 500;
    sfxLevelComplete();
    stopMusic();
    spawnParticles(level.flag.x + 10, level.flag.y, '#ffeb3b', 20, 5);
  }

  // ---- Camera ----
  const targetCX = player.x - canvas.width / 3;
  const targetCY = player.y - canvas.height / 2;
  cam.x = lerp(cam.x, Math.max(0, targetCX), 0.08);
  cam.y = lerp(cam.y, Math.max(Math.min(targetCY, 100), -50), 0.08);

  // ---- Particles ----
  particles = particles.filter(p => { p.update(); return p.life > 0; });
}

function playerDeath() {
  player.lives--;
  sfxDeath();
  spawnParticles(player.x + 14, player.y + 18, '#4fc3f7', 15, 5);
  if (player.lives <= 0) {
    state = 'GAME_OVER';
    stopMusic();
  } else {
    // Respawn at checkpoint if available
    if (player.lastCheckpoint) {
      player.reset();
    } else {
      player.reset(80, 300);
    }
    player.invincible = 90;
    player.jumpsLeft = player.maxJumps;
  }
}

// ---- DRAW ----
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (state === 'MENU') {
    drawMenuScreen();
    return;
  }

  // Background
  drawBackground(level ? level.width : 2000);

  if (level) {
    // Lava (drawn behind platforms)
    if (level.lavas) {
      for (const lv of level.lavas) lv.draw();
    }
    // Platforms
    for (const p of level.platforms) p.draw();
    // Spikes
    if (level.spikes) {
      for (const sp of level.spikes) sp.draw();
    }
    // Checkpoints
    if (level.checkpoints) {
      for (const cp of level.checkpoints) cp.draw();
    }
    // Coins
    for (const c of level.coins) c.draw();
    // Enemies
    for (const e of level.enemies) e.draw();
    // Bats
    if (level.bats) {
      for (const b of level.bats) b.draw();
    }
    // Power-ups
    if (level.powerups) {
      for (const pu of level.powerups) pu.draw();
    }
    // Flag
    level.flag.draw();
  }

  // Wall slide effect — friction lines
  if (player.onWall && !player.onGround && player.wallSlideTimer > 0) {
    const sx = player.x + (player.wallDir > 0 ? player.w - 2 : 0) - cam.x;
    const sy = player.y - cam.y;
    ctx.fillStyle = '#b0bec5';
    for (let i = 0; i < 3; i++) {
      const yo = (player.wallSlideTimer * 2 + i * 12) % 36;
      ctx.fillRect(sx, sy + yo, 3, 6);
    }
  }

  // Invincibility PU shimmer
  if (player.invincibilityPU > 0) {
    const sx = player.x - cam.x, sy = player.y - cam.y;
    ctx.globalAlpha = 0.25 + Math.sin(Date.now() * 0.01) * 0.15;
    ctx.fillStyle = '#ffd600';
    ctx.beginPath();
    ctx.arc(sx + 14, sy + 18, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Coin magnet lines
  if (player.coinMagnet > 0 && level) {
    ctx.strokeStyle = '#42a5f5';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    for (const coin of level.coins) {
      if (coin.collected) continue;
      const dx = (player.x + 14) - (coin.x + 8);
      const dy = (player.y + 18) - (coin.y + 8);
      if (Math.sqrt(dx * dx + dy * dy) < 150) {
        ctx.beginPath();
        ctx.moveTo(player.x + 14 - cam.x, player.y + 18 - cam.y);
        ctx.lineTo(coin.x + 8 - cam.x, coin.y + 8 - cam.y);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
  }

  // Player
  drawPlayer(player);

  // Particles
  for (const p of particles) p.draw(ctx);

  // HUD
  drawHUD();

  // Overlays
  if (state === 'LEVEL_COMPLETE') drawLevelComplete();
  if (state === 'GAME_OVER') drawGameOver();
  if (state === 'WIN') drawWinScreen();
}

// ---- UI SCREENS ----
function drawMenuScreen() {
  // BG
  const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grd.addColorStop(0, '#0d1b2a');
  grd.addColorStop(1, '#1b4332');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Stars
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 80; i++) {
    const sx = (i * 137 + 50) % canvas.width;
    const sy = (i * 97 + 30) % canvas.height;
    const twinkle = Math.sin(Date.now() * 0.002 + i * 0.5) * 0.4 + 0.6;
    ctx.globalAlpha = twinkle;
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.globalAlpha = 1;

  // Title
  const bob = Math.sin(menuBob) * 8;
  ctx.textAlign = 'center';
  ctx.font = '900 48px "Press Start 2P", monospace';
  // Shadow
  ctx.fillStyle = '#000';
  ctx.fillText('SKY RUNNER', canvas.width / 2 + 3, 160 + bob + 3);
  // Gradient text
  const tgrd = ctx.createLinearGradient(0, 130 + bob, 0, 180 + bob);
  tgrd.addColorStop(0, '#4fc3f7');
  tgrd.addColorStop(1, '#81d4fa');
  ctx.fillStyle = tgrd;
  ctx.fillText('SKY RUNNER', canvas.width / 2, 160 + bob);

  // Subtitle
  ctx.font = '700 16px "Inter", sans-serif';
  ctx.fillStyle = '#80cbc4';
  ctx.fillText('A Platformer Adventure', canvas.width / 2, 200 + bob);

  // Instructions
  const blink = Math.sin(Date.now() * 0.005) > 0;
  if (blink) {
    ctx.font = '700 18px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffd54f';
    ctx.fillText('PRESS ENTER', canvas.width / 2, 320);
  }

  // Controls
  ctx.font = '14px "Inter", sans-serif';
  ctx.fillStyle = '#90a4ae';
  ctx.fillText('← → or A D  to move  |  SPACE or ↑  to jump', canvas.width / 2, 420);
  ctx.fillText('Collect coins, stomp enemies, reach the flag!', canvas.width / 2, 450);

  // Character preview
  const px = canvas.width / 2 - 14, py = 250 + bob * 0.5;
  ctx.fillStyle = '#4fc3f7';
  ctx.fillRect(px + 4, py + 8, 20, 18);
  ctx.fillStyle = '#ffcc80';
  ctx.fillRect(px + 6, py, 16, 14);
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(px + 16, py + 4, 4, 4);
  ctx.fillStyle = '#ef5350';
  ctx.fillRect(px + 4, py - 2, 20, 5);
  ctx.fillRect(px + 8, py - 6, 12, 5);
  ctx.fillStyle = '#3949ab';
  ctx.fillRect(px + 5, py + 26, 8, 10);
  ctx.fillRect(px + 15, py + 26, 8, 10);

  ctx.textAlign = 'left';
}

function drawHUD() {
  // Semi-transparent bar
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, 0, canvas.width, 44);

  ctx.font = '700 16px "Press Start 2P", monospace';
  ctx.textAlign = 'left';

  // Score
  ctx.fillStyle = '#ffd54f';
  ctx.fillText('★ ' + player.score, 16, 30);

  // Lives
  ctx.fillStyle = '#ef5350';
  for (let i = 0; i < player.lives; i++) {
    ctx.fillText('♥', 280 + i * 28, 30);
  }

  // Level
  ctx.fillStyle = '#80cbc4';
  ctx.textAlign = 'right';
  ctx.fillText('LVL ' + levelNum, canvas.width - 16, 30);

  // Jump indicator (small dots)
  ctx.textAlign = 'left';
  for (let i = 0; i < player.maxJumps; i++) {
    ctx.fillStyle = i < player.jumpsLeft ? '#81d4fa' : '#37474f';
    ctx.beginPath();
    ctx.arc(430 + i * 18, 26, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Wall slide icon if on wall
  if (player.onWall && !player.onGround) {
    ctx.fillStyle = '#90caf9';
    ctx.font = '12px "Inter", sans-serif';
    ctx.fillText('⬤ WALL', 470, 30);
  }

  // Power-up bars
  let barX = 16;
  const barY = 38;
  const puList = [
    { timer: player.speedBoost, max: 300, color: '#ff9800', label: '⚡' },
    { timer: player.invincibilityPU, max: 300, color: '#ffd600', label: '🛡️' },
    { timer: player.coinMagnet, max: 480, color: '#42a5f5', label: '🧲' },
  ];
  for (const pu of puList) {
    if (pu.timer > 0) {
      const pct = pu.timer / pu.max;
      ctx.font = '12px sans-serif';
      ctx.fillText(pu.label, barX, barY + 13);
      // Bar background
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(barX + 18, barY + 4, 50, 8);
      // Bar fill
      ctx.fillStyle = pu.color;
      ctx.fillRect(barX + 18, barY + 4, 50 * pct, 8);
      barX += 80;
    }
  }

  ctx.textAlign = 'left';
}

function drawLevelComplete() {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.font = '900 36px "Press Start 2P", monospace';
  ctx.fillStyle = '#ffd54f';
  ctx.fillText('LEVEL CLEAR!', canvas.width / 2, canvas.height / 2);
  ctx.font = '14px "Inter", sans-serif';
  ctx.fillStyle = '#80cbc4';
  ctx.fillText('+500 BONUS', canvas.width / 2, canvas.height / 2 + 40);
  ctx.textAlign = 'left';
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.font = '900 40px "Press Start 2P", monospace';
  ctx.fillStyle = '#e53935';
  ctx.fillText('GAME OVER', canvas.width / 2, 200);
  ctx.font = '700 18px "Inter", sans-serif';
  ctx.fillStyle = '#ffd54f';
  ctx.fillText('Final Score: ' + player.score, canvas.width / 2, 260);
  const blink = Math.sin(Date.now() * 0.005) > 0;
  if (blink) {
    ctx.font = '700 16px "Press Start 2P", monospace';
    ctx.fillStyle = '#80cbc4';
    ctx.fillText('PRESS ENTER TO RETRY', canvas.width / 2, 340);
  }
  ctx.textAlign = 'left';
}

function drawWinScreen() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  const bob = Math.sin(Date.now() * 0.004) * 6;
  ctx.font = '900 36px "Press Start 2P", monospace';
  ctx.fillStyle = '#ffd54f';
  ctx.fillText('YOU WIN!', canvas.width / 2, 180 + bob);
  ctx.font = '700 20px "Inter", sans-serif';
  ctx.fillStyle = '#81d4fa';
  ctx.fillText('🎉 Congratulations! 🎉', canvas.width / 2, 240);
  ctx.fillStyle = '#fff';
  ctx.fillText('Final Score: ' + player.score, canvas.width / 2, 290);
  const blink = Math.sin(Date.now() * 0.005) > 0;
  if (blink) {
    ctx.font = '700 14px "Press Start 2P", monospace';
    ctx.fillStyle = '#80cbc4';
    ctx.fillText('PRESS ENTER TO PLAY AGAIN', canvas.width / 2, 380);
  }
  ctx.textAlign = 'left';
}

// ---- MENU/RESTART INPUT ----
window.addEventListener('keydown', e => {
  if (e.code === 'Enter') {
    if (state === 'MENU' || state === 'GAME_OVER' || state === 'WIN') {
      startGame();
    }
  }
});

// ---- GAME LOOP ----
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Start!
gameLoop();
