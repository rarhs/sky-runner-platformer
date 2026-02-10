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
  reset(x, y) {
    this.x = x || 80; this.y = y || 300;
    this.vx = 0; this.vy = 0; this.onGround = false;
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
  } else {
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
  }
  return { platforms, coins, enemies, flag, width: flag.x + 200 };
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
  player.reset(80, 300);
  cam.x = 0; cam.y = 0;
  particles = [];
  state = 'PLAYING';
}

function startGame() {
  levelNum = 1;
  player.lives = 3;
  player.score = 0;
  startLevel(1);
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
      if (levelNum > 3) { state = 'WIN'; }
      else { startLevel(levelNum); }
    }
    return;
  }

  if (state === 'GAME_OVER' || state === 'WIN') return;

  // ---- Player movement ----
  if (keys['ArrowLeft'] || keys['KeyA']) {
    player.vx -= PLAYER_SPEED;
    player.facing = -1;
  }
  if (keys['ArrowRight'] || keys['KeyD']) {
    player.vx += PLAYER_SPEED;
    player.facing = 1;
  }

  // Variable-height jump
  const jumpKey = keys['Space'] || keys['ArrowUp'] || keys['KeyW'];
  if (jumpKey && player.onGround && !player.jumpHeld) {
    player.vy = JUMP_FORCE;
    player.onGround = false;
    player.jumpHeld = true;
    player.jumpTime = 0;
    spawnParticles(player.x + 14, player.y + 36, '#a0a0a0', 6, 2);
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

  // ---- Platform collision ----
  for (const plat of level.platforms) {
    plat.update();
    if (player.vy >= 0 &&
        player.x + player.w > plat.x && player.x < plat.x + plat.w &&
        player.y + player.h > plat.y && player.y + player.h < plat.y + plat.h + player.vy + 2) {
      player.y = plat.y - player.h;
      player.vy = 0;
      player.onGround = true;
      // Move with moving platform
      if (plat.moveRange > 0) {
        const prevX = plat.x;
        // Approximate movement delta
        player.x += Math.cos(plat.time) * plat.moveRange * 0.02;
      }
    }
  }

  // left wall
  if (player.x < 0) { player.x = 0; player.vx = 0; }

  // Fall to death
  if (player.y > 600) {
    playerDeath();
    return;
  }

  // ---- Coins ----
  for (const coin of level.coins) {
    coin.update();
    if (!coin.collected && aabb(player, coin)) {
      coin.collected = true;
      player.score += 100;
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
        spawnParticles(enemy.x + 15, enemy.y + 14, '#e53935', 12, 4);
      } else if (player.invincible <= 0) {
        playerDeath();
        return;
      }
    }
  }

  // ---- Flag ----
  level.flag.update();
  if (aabb(player, level.flag)) {
    state = 'LEVEL_COMPLETE';
    levelCompleteTimer = 90;
    player.score += 500;
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
  spawnParticles(player.x + 14, player.y + 18, '#4fc3f7', 15, 5);
  if (player.lives <= 0) {
    state = 'GAME_OVER';
  } else {
    player.reset(80, 300);
    player.invincible = 90;
    cam.x = 0; cam.y = 0;
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
    // Platforms
    for (const p of level.platforms) p.draw();
    // Coins
    for (const c of level.coins) c.draw();
    // Enemies
    for (const e of level.enemies) e.draw();
    // Flag
    level.flag.draw();
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
