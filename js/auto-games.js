import { initNav, initFooter, setCanonical, initPwa, escapeHtml } from "./app.js";

const W = 800;
const H = 450;

const INK = "#fcfdff";
const GREEN = "#11ff99";
const BLUE = "#3b9eff";
const ORANGE = "#ff801f";
const YELLOW = "#ffc53d";
const RED = "#ff2047";
const MUTE = "#888e90";
const BG = "#050508";

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function makeDino() {
  const Wc = 800, Hc = 450;
  const GROUND_Y = 400;
  const DINO_X = 90;
  const DINO_W = 44, DINO_H = 47;
  const DUCK_W = 55, DUCK_H = 30;
  const CONFIG = {
    baseSpeed: 6.6,
    maxSpeed: 13,
    speedPerPoint: 0.012,
    gravity: 0.62,
    jumpVelocity: 10.2,
    pixelsPerPoint: 25,
    birdScore: 300,
    nightEvery: 700
  };
  const DAY = { bg: "#050508", text: "#fcfdff", ground: "#fcfdff", cactus: "#11ff99", dino: "#fcfdff", cloud: "rgba(255,255,255,0.12)" };
  const NIGHT = { bg: "#050508", text: "#fcfdff", ground: "#fcfdff", cactus: "#22ff99", dino: "#fcfdff", cloud: "rgba(255,255,255,0.08)" };
  const g = {
    over: false,
    score: 0,
    distance: 0,
    speed: CONFIG.baseSpeed,
    nextSpawn: 420,
    groundOffset: 0,
    birdTimer: 0,
    night: false,
    obstacles: [],
    clouds: [],
    dino: {
      y: GROUND_Y - DINO_H,
      vy: 0,
      w: DINO_W,
      h: DINO_H,
      onGround: true,
      ducking: false,
      step: 0,
      legTimer: 0
    },
    restart() {
      this.over = false;
      this.score = 0;
      this.distance = 0;
      this.speed = CONFIG.baseSpeed;
      this.nextSpawn = 420;
      this.groundOffset = 0;
      this.birdTimer = 0;
      this.night = false;
      this.obstacles = [];
      this.clouds = [];
      Object.assign(this.dino, { y: GROUND_Y - DINO_H, vy: 0, w: DINO_W, h: DINO_H, onGround: true, ducking: false, step: 0, legTimer: 0 });
    },
    update(dt) {
      if (this.over) return;
      const tdt = dt * 60; // step scale
      this.speed = Math.min(CONFIG.maxSpeed, CONFIG.baseSpeed + this.score * CONFIG.speedPerPoint);
      this.distance += this.speed * tdt;
      this.score = Math.floor(this.distance / CONFIG.pixelsPerPoint);
      const nightNow = Math.floor(this.score / CONFIG.nightEvery) % 2 === 1;
      if (nightNow !== this.night) this.night = nightNow;
      this.birdTimer += tdt;
      this._botThink();
      const d = this.dino;
      if (!d.onGround) {
        d.vy += CONFIG.gravity * tdt;
        d.y += d.vy * tdt;
        const floor = GROUND_Y - d.h;
        if (d.y >= floor) { d.y = floor; d.vy = 0; d.onGround = true; }
      }
      if (d.onGround) {
        d.legTimer += tdt * (this.speed / CONFIG.baseSpeed);
        if (d.legTimer > 7) { d.legTimer = 0; d.step = 1 - d.step; }
      }
      this.groundOffset += this.speed * tdt;
      for (let i = 0; i < this.obstacles.length; i++) this.obstacles[i].x -= this.speed * tdt;
      this.obstacles = this.obstacles.filter(o => o.x + o.w > -60);
      if (this.distance >= this.nextSpawn) {
        this._spawnObstacle();
        this.nextSpawn = this.distance + this.speed * rand(52, 88);
      }
      if (Math.random() < 0.008) {
        this.clouds.push({ x: Wc + 20, y: rand(40, 110), s: rand(0.35, 0.6) });
      }
      for (let c = 0; c < this.clouds.length; c++) this.clouds[c].x -= this.speed * this.clouds[c].s * tdt;
      this.clouds = this.clouds.filter(cl => cl.x > -80);
      const box = { x: DINO_X + 4, y: d.y + 4, w: d.w - 8, h: d.h - 8 };
      for (let j = 0; j < this.obstacles.length; j++) {
        const o = this.obstacles[j];
        if (this._collide(box, { x: o.x + 3, y: o.y + 3, w: o.w - 6, h: o.h - 6 })) { this.over = true; break; }
      }
    },
    _collide(a,b){ return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; },
    _jump(){
      const d=this.dino;
      if(!d.onGround) return;
      if(d.ducking){ d.ducking=false; d.h=DINO_H; d.w=DINO_W; d.y=GROUND_Y-DINO_H; }
      d.vy=-CONFIG.jumpVelocity; d.onGround=false;
    },
    _duck(on){
      const d=this.dino;
      if(on){
        if(!d.onGround||d.ducking) return;
        d.ducking=true; d.h=DUCK_H; d.w=DUCK_W; d.y=GROUND_Y-DUCK_H;
      } else {
        if(!d.ducking) return;
        d.ducking=false; d.h=DINO_H; d.w=DINO_W;
        if(d.onGround) d.y=GROUND_Y-DINO_H;
      }
    },
    _botThink(){
      const d=this.dino;
      let nearest=null;
      for(let i=0;i<this.obstacles.length;i++){
        if(this.obstacles[i].x + this.obstacles[i].w > DINO_X+2){ nearest=this.obstacles[i]; break; }
      }
      if(!nearest){ this._duck(false); return; }
      const front=DINO_X+DINO_W;
      const dist=nearest.x-front;
      if(nearest.type==='cactus'){
        this._duck(false);
        const trigger=16.5*this.speed-22-nearest.w*0.5;
        if(d.onGround && dist<=trigger && dist>-nearest.w) this._jump();
      } else if(nearest.type==='bird'){
        if(nearest.kind==='mid'){
          const overlapping=nearest.x < DINO_X+DINO_W && nearest.x+nearest.w > DINO_X;
          if(dist < this.speed*22 || overlapping) this._duck(true); else this._duck(false);
        } else {
          this._duck(false);
          const trigger=16.5*this.speed-22-nearest.w*0.5;
          if(d.onGround && dist<=trigger && dist>-nearest.w) this._jump();
        }
      } else this._duck(false);
    },
    _spawnObstacle(){
      if(this.score>=CONFIG.birdScore && Math.random()<0.32) this._spawnBird(); else this._spawnCactus();
    },
    _spawnCactus(){
      const large=Math.random()<0.5;
      const unit=large?{w:25,h:50}:{w:17,h:35};
      const count=1+Math.floor(Math.random()*(large?2:3));
      const step=unit.w+2;
      this.obstacles.push({type:'cactus',x:Wc+12,y:GROUND_Y-unit.h,w:count*step-2,h:unit.h});
    },
    _spawnBird(){
      const kinds=['high','mid','low'];
      const kind=kinds[Math.floor(Math.random()*3)];
      let y;
      if(kind==='high') y=GROUND_Y-DINO_H-40-8;
      else if(kind==='mid') y=GROUND_Y-DINO_H-40+12;
      else y=GROUND_Y-40-2;
      this.obstacles.push({type:'bird',kind:kind,x:Wc+12,y:y,w:46,h:40});
    },
    draw(c){
      const cols=this.night?NIGHT:DAY;
      c.fillStyle=cols.bg; c.fillRect(0,0,Wc,Hc);
      // clouds
      c.fillStyle=cols.cloud;
      for(let i=0;i<this.clouds.length;i++){
        const cl=this.clouds[i]; const x=cl.x|0,y=cl.y|0;
        c.fillRect(x,y,30,8); c.fillRect(x+9,y-6,16,8); c.fillRect(x-7,y+5,12,6);
      }
      // ground
      c.fillStyle=cols.ground; c.fillRect(0,GROUND_Y,Wc,2);
      const span=Wc+40; const off=this.groundOffset%span;
      for(let i=0;i<30;i++){
        let x=i*30-off; if(x<-10)x+=span; if(x>Wc+10) continue;
        c.fillRect(x|0,GROUND_Y+4+(i%3)*3,6,1);
      }
      // obs
      for(let j=0;j<this.obstacles.length;j++){
        const o=this.obstacles[j];
        if(o.type==='cactus'){
          c.fillStyle=cols.cactus;
          const u=o.type==='cactus'?{w:25,h:50}:null;
          // simplified drawing matches style
          const large=o.w>40;
          const uw=large?25:17, uh=large?50:35;
          const cnt=Math.max(1,Math.round(o.w/(uw+2)));
          for(let k=0;k<cnt;k++){
            const x=Math.round(o.x+k*(uw+2)), y=Math.round(o.y);
            c.fillRect(x+Math.round(uw*0.35),y,Math.max(4,Math.round(uw*0.3)),uh);
            c.fillRect(x,y+Math.round(uh*0.25),Math.round(uw*0.35),Math.max(3,Math.round(uh*0.12)));
            c.fillRect(x,y+Math.round(uh*0.25),Math.max(3,Math.round(uw*0.12)),Math.round(uh*0.42));
            c.fillRect(x+Math.round(uw*0.65),y+Math.round(uh*0.35),Math.round(uw*0.35),Math.max(3,Math.round(uh*0.12)));
            c.fillRect(x+Math.round(uw*0.88),y+Math.round(uh*0.12),Math.max(3,Math.round(uw*0.12)),Math.round(uh*0.35));
          }
        } else {
          const x=Math.round(o.x), y=Math.round(o.y);
          const flap=Math.floor(this.birdTimer/7)%2===0;
          c.fillStyle=cols.dino;
          c.fillRect(x+10,y+16,24,7); c.fillRect(x+30,y+11,12,7); c.fillRect(x+40,y+14,6,4); c.fillRect(x+31,y+8,8,4);
          if(flap) c.fillRect(x+8,y+2,26,13); else c.fillRect(x+8,y+24,26,13);
          c.fillStyle=cols.bg; c.fillRect(x+35,y+13,3,3);
        }
      }
      // dino
      const d=this.dino; const dx=DINO_X, dy=Math.round(d.y); c.fillStyle=cols.dino;
      if(d.ducking){
        c.fillRect(dx,dy+8,10,12); c.fillRect(dx+6,dy+10,34,16); c.fillRect(dx+34,dy+4,20,16); c.fillRect(dx+52,dy+14,3,7);
        c.fillStyle=cols.bg; c.fillRect(dx+46,dy+7,4,4); c.fillStyle=cols.dino;
        c.fillRect(dx+10,dy+24,8,6); c.fillRect(dx+26,dy+24,8,6);
      } else {
        c.fillRect(dx,dy+12,10,12); c.fillRect(dx+8,dy+16,22,18); c.fillRect(dx+22,dy+8,12,12); c.fillRect(dx+24,dy,20,16); c.fillRect(dx+38,dy+10,6,6); c.fillRect(dx+28,dy+22,8,6);
        c.fillStyle=cols.bg; c.fillRect(dx+36,dy+4,4,4); c.fillStyle=cols.dino;
        if(d.step===0){ c.fillRect(dx+10,dy+34,7,12); c.fillRect(dx+9,dy+44,10,3); c.fillRect(dx+21,dy+34,7,8); c.fillRect(dx+20,dy+40,10,3); }
        else { c.fillRect(dx+10,dy+34,7,8); c.fillRect(dx+9,dy+40,10,3); c.fillRect(dx+21,dy+34,7,12); c.fillRect(dx+20,dy+44,10,3); }
      }
      // text
      c.fillStyle=cols.text; c.font="bold 14px Inter, monospace"; c.textAlign="right"; c.textBaseline="alphabetic";
      c.fillText("SCORE "+String(this.score), Wc-20, 32);
      if(this.over){ c.textAlign="center"; c.font="bold 18px Inter, monospace"; c.fillText("GAME OVER", Wc/2, 90); }
    }
  };
  g.restart();
  return g;
}

function makeFlappy() {
  const g = {
    over: false,
    score: 0,
    t: 0,
    spawnT: 0.9,
    flapCd: 0,
    bird: { x: 210, y: 210, vy: 0, r: 11 },
    pipes: [],
    restart() {
      this.over = false;
      this.score = 0;
      this.t = 0;
      this.spawnT = 0.9;
      this.pipes = [];
      Object.assign(this.bird, { y: 210, vy: 0 });
    },
    update(dt) {
      if (this.over) return;
      this.t += dt;
      this.flapCd -= dt;
      const b = this.bird;
      b.vy += 1400 * dt;
      b.y += b.vy * dt;
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        const gap = Math.max(118, 158 - this.t * 0.5);
        const cy = rand(70 + gap / 2, H - 80 - gap / 2);
        this.pipes.push({ x: W + 60, w: 68, cy, gap, passed: false });
        this.spawnT = 1.75;
      }
      for (const p of this.pipes) {
        p.x -= 250 * dt;
        if (!p.passed && p.x + p.w < b.x) {
          p.passed = true;
          this.score++;
        }
      }
      this.pipes = this.pipes.filter((p) => p.x + p.w > -20);
      let next = null;
      for (const p of this.pipes) {
        if (p.x + p.w > b.x - b.r) {
          next = p;
          break;
        }
      }
      if (next && b.y > next.cy - 10 && this.flapCd <= 0) {
        b.vy = -440;
        this.flapCd = 0.1;
      } else if (b.y > H - 70 && this.flapCd <= 0) {
        b.vy = -440;
        this.flapCd = 0.1;
      }
      if (b.y - b.r < 0 || b.y + b.r > H) this.over = true;
      for (const p of this.pipes) {
        const topH = p.cy - p.gap / 2;
        const botY = p.cy + p.gap / 2;
        const hitX = b.x + b.r > p.x && b.x - b.r < p.x + p.w;
        if (hitX && (b.y - b.r < topH || b.y + b.r > botY)) this.over = true;
      }
    },
    draw(c) {
      for (const p of this.pipes) {
        const topH = p.cy - p.gap / 2;
        const botY = p.cy + p.gap / 2;
        c.fillStyle = GREEN;
        c.fillRect(p.x, 0, p.w, topH);
        c.fillRect(p.x, botY, p.w, H - botY);
        c.fillStyle = "rgba(17,255,153,0.35)";
        c.fillRect(p.x - 4, topH - 14, p.w + 8, 14);
        c.fillRect(p.x - 4, botY, p.w + 8, 14);
      }
      const b = this.bird;
      c.save();
      c.translate(b.x, b.y);
      c.rotate(clamp(b.vy / 700, -0.5, 0.9));
      c.fillStyle = YELLOW;
      c.beginPath();
      c.ellipse(0, 0, b.r + 2, b.r, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = BG;
      c.beginPath();
      c.arc(5, -3, 2.6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = ORANGE;
      c.beginPath();
      c.moveTo(b.r + 2, 0);
      c.lineTo(b.r + 12, 3);
      c.lineTo(b.r + 2, 6);
      c.closePath();
      c.fill();
      c.restore();
    },
  };
  g.restart();
  return g;
}

function makeSnake() {
  const COLS = 32;
  const ROWS = 18;
  const CELL = 25;
  function bfsStep(start, goal, blocked) {
    const key = (p) => p.y * COLS + p.x;
    const prev = new Map();
    const q = [start];
    prev.set(key(start), null);
    const dirs = [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ];
    while (q.length) {
      const cur = q.shift();
      if (cur.x === goal.x && cur.y === goal.y) {
        let node = cur;
        while (prev.get(key(node)) && prev.get(key(node)).x === start.x && prev.get(key(node)).y === start.y) {
          return { x: node.x - start.x, y: node.y - start.y };
        }
        while (prev.get(key(node))) {
          const p = prev.get(key(node));
          if (p.x === start.x && p.y === start.y) return { x: node.x - start.x, y: node.y - start.y };
          node = p;
        }
        return null;
      }
      for (const d of dirs) {
        const nx = cur.x + d.x;
        const ny = cur.y + d.y;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        const nk = ny * COLS + nx;
        if (prev.has(nk)) continue;
        if (blocked.has(nk) && !(nx === goal.x && ny === goal.y)) continue;
        prev.set(nk, cur);
        q.push({ x: nx, y: ny });
      }
    }
    return null;
  }
  function floodCount(start, blocked) {
    const seen = new Set([start.y * COLS + start.x]);
    const q = [start];
    let n = 0;
    while (q.length) {
      const cur = q.shift();
      n++;
      for (const d of [
        { x: 0, y: -1 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: -1, y: 0 },
      ]) {
        const nx = cur.x + d.x;
        const ny = cur.y + d.y;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        const nk = ny * COLS + nx;
        if (seen.has(nk) || blocked.has(nk)) continue;
        seen.add(nk);
        q.push({ x: nx, y: ny });
      }
    }
    return n;
  }
  const g = {
    over: false,
    score: 0,
    acc: 0,
    step: 0.1,
    snake: [],
    dir: { x: 1, y: 0 },
    food: { x: 20, y: 9 },
    restart() {
      this.over = false;
      this.score = 0;
      this.acc = 0;
      this.step = 0.1;
      this.snake = [
        { x: 8, y: 9 },
        { x: 7, y: 9 },
        { x: 6, y: 9 },
        { x: 5, y: 9 },
      ];
      this.dir = { x: 1, y: 0 };
      this.placeFood();
    },
    placeFood() {
      let f;
      do {
        f = { x: randi(0, COLS - 1), y: randi(0, ROWS - 1) };
      } while (this.snake.some((s) => s.x === f.x && s.y === f.y));
      this.food = f;
    },
    update(dt) {
      if (this.over) return;
      this.acc += dt;
      while (this.acc >= this.step) {
        this.acc -= this.step;
        this.move();
        if (this.over) return;
      }
    },
    move() {
      const head = this.snake[0];
      const blocked = new Set();
      for (let i = 0; i < this.snake.length - 1; i++) {
        blocked.add(this.snake[i].y * COLS + this.snake[i].x);
      }
      let d = bfsStep(head, this.food, blocked);
      if (!d) {
        const options = [
          { x: 0, y: -1 },
          { x: 1, y: 0 },
          { x: 0, y: 1 },
          { x: -1, y: 0 },
        ].filter((o) => !(o.x === -this.dir.x && o.y === -this.dir.y));
        let best = null;
        let bestSpace = -1;
        for (const o of options) {
          const nx = head.x + o.x;
          const ny = head.y + o.y;
          if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
          if (blocked.has(ny * COLS + nx)) continue;
          const space = floodCount({ x: nx, y: ny }, blocked);
          if (space > bestSpace) {
            bestSpace = space;
            best = o;
          }
        }
        d = best || this.dir;
      }
      this.dir = d;
      const nx = head.x + d.x;
      const ny = head.y + d.y;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
        this.over = true;
        return;
      }
      const eating = nx === this.food.x && ny === this.food.y;
      const body = eating ? this.snake : this.snake.slice(0, -1);
      if (body.some((s) => s.x === nx && s.y === ny)) {
        this.over = true;
        return;
      }
      this.snake.unshift({ x: nx, y: ny });
      if (eating) {
        this.score++;
        if (this.step > 0.055) this.step -= 0.0015;
        this.placeFood();
      } else {
        this.snake.pop();
      }
    },
    draw(c) {
      c.strokeStyle = "rgba(255,255,255,0.04)";
      c.lineWidth = 1;
      for (let x = 1; x < COLS; x++) {
        c.beginPath();
        c.moveTo(x * CELL, 0);
        c.lineTo(x * CELL, H);
        c.stroke();
      }
      for (let y = 1; y < ROWS; y++) {
        c.beginPath();
        c.moveTo(0, y * CELL);
        c.lineTo(W, y * CELL);
        c.stroke();
      }
      c.fillStyle = RED;
      c.beginPath();
      c.arc(this.food.x * CELL + CELL / 2, this.food.y * CELL + CELL / 2, 7, 0, Math.PI * 2);
      c.fill();
      this.snake.forEach((s, i) => {
        c.fillStyle = i === 0 ? INK : `rgba(17,255,153,${Math.max(0.35, 1 - i / (this.snake.length + 6))})`;
        c.fillRect(s.x * CELL + 2, s.y * CELL + 2, CELL - 4, CELL - 4);
      });
    },
  };
  g.restart();
  return g;
}

function makeBreakout() {
  const g = {
    over: false,
    score: 0,
    lives: 3,
    level: 1,
    paddle: { x: 350, y: H - 28, w: 100, h: 12 },
    ball: { x: 400, y: 300, vx: 0, vy: 0, r: 7 },
    bricks: [],
    resetBall() {
      const p = this.paddle;
      this.ball.x = p.x + p.w / 2;
      this.ball.y = p.y - 12;
      const a = -Math.PI / 2 + rand(-0.55, 0.55);
      const s = 320 + this.level * 25;
      this.ball.vx = Math.cos(a) * s;
      this.ball.vy = Math.sin(a) * s;
    },
    buildBricks() {
      this.bricks = [];
      const rows = 5 + Math.min(2, this.level - 1);
      const cols = 12;
      const bw = 60;
      const bh = 20;
      const ox = (W - cols * bw) / 2;
      const oy = 46;
      const palette = [RED, ORANGE, YELLOW, GREEN, BLUE, "#c084fc", "#f472b6"];
      for (let r = 0; r < rows; r++) {
        for (let cIdx = 0; cIdx < cols; cIdx++) {
          this.bricks.push({ x: ox + cIdx * bw, y: oy + r * (bh + 4), w: bw - 4, h: bh, color: palette[r % palette.length] });
        }
      }
    },
    restart() {
      this.over = false;
      this.score = 0;
      this.lives = 3;
      this.level = 1;
      this.paddle.x = 350;
      this.buildBricks();
      this.resetBall();
    },
    update(dt) {
      if (this.over) return;
      const p = this.paddle;
      const b = this.ball;
      const target = clamp(b.x + b.vx * 0.06 - p.w / 2, 4, W - p.w - 4);
      p.x += (target - p.x) * Math.min(1, dt * 11);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x - b.r < 0) {
        b.x = b.r;
        b.vx = Math.abs(b.vx);
      }
      if (b.x + b.r > W) {
        b.x = W - b.r;
        b.vx = -Math.abs(b.vx);
      }
      if (b.y - b.r < 0) {
        b.y = b.r;
        b.vy = Math.abs(b.vy);
      }
      if (b.vy > 0 && b.y + b.r >= p.y && b.y - b.r < p.y + p.h && b.x > p.x - 6 && b.x < p.x + p.w + 6) {
        const off = (b.x - (p.x + p.w / 2)) / (p.w / 2);
        const speed = Math.min(640, Math.hypot(b.vx, b.vy) * 1.03);
        const ang = -Math.PI / 2 + off * 1.05;
        b.vx = Math.cos(ang) * speed;
        b.vy = Math.sin(ang) * speed;
        b.y = p.y - b.r - 0.5;
      }
      for (let i = this.bricks.length - 1; i >= 0; i--) {
        const br = this.bricks[i];
        if (b.x + b.r > br.x && b.x - b.r < br.x + br.w && b.y + b.r > br.y && b.y - b.r < br.y + br.h) {
          this.bricks.splice(i, 1);
          this.score += 10;
          const overlapX = Math.min(b.x + b.r - br.x, br.x + br.w - (b.x - b.r));
          const overlapY = Math.min(b.y + b.r - br.y, br.y + br.h - (b.y - b.r));
          if (overlapY < overlapX) b.vy = -b.vy;
          else b.vx = -b.vx;
          break;
        }
      }
      if (!this.bricks.length) {
        this.level++;
        this.buildBricks();
        this.resetBall();
      }
      if (b.y - b.r > H) {
        this.lives--;
        if (this.lives <= 0) this.over = true;
        else this.resetBall();
      }
    },
    draw(c) {
      for (const br of this.bricks) {
        c.fillStyle = br.color;
        c.fillRect(br.x, br.y, br.w, br.h);
      }
      const p = this.paddle;
      c.fillStyle = INK;
      c.fillRect(p.x, p.y, p.w, p.h);
      const b = this.ball;
      c.fillStyle = GREEN;
      c.beginPath();
      c.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = MUTE;
      c.font = "13px Inter, sans-serif";
      c.fillText(`Lives ${this.lives}   Level ${this.level}`, 14, 24);
    },
  };
  g.restart();
  return g;
}

function makePong() {
  const g = {
    over: false,
    score: 0,
    t: 0,
    left: { x: 22, y: 190, w: 12, h: 70, s: 0 },
    right: { x: 766, y: 190, w: 12, h: 70, s: 0 },
    ball: { x: 400, y: 225, vx: 300, vy: 120, r: 7 },
    rs: 0,
    ls: 0,
    serve(dir) {
      const a = rand(-0.5, 0.5);
      const s = 330;
      this.ball.x = 400;
      this.ball.y = 225;
      this.ball.vx = Math.cos(a) * s * dir;
      this.ball.vy = Math.sin(a) * s;
    },
    restart() {
      this.over = false;
      this.score = 0;
      this.ls = 0;
      this.rs = 0;
      this.serve(Math.random() < 0.5 ? 1 : -1);
    },
    update(dt) {
      if (this.over) return;
      this.t += dt;
      const b = this.ball;
      const speed = 400;
      for (const [p, score] of [
        [this.left, "l"],
        [this.right, "r"],
      ]) {
        const target = b.y - p.h / 2;
        const diff = target - p.y;
        p.y += clamp(diff, -speed * dt, speed * dt);
        p.y = clamp(p.y, 4, H - p.h - 4);
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y - b.r < 0) {
        b.y = b.r;
        b.vy = Math.abs(b.vy);
      }
      if (b.y + b.r > H) {
        b.y = H - b.r;
        b.vy = -Math.abs(b.vy);
      }
      const hit = (p) => b.x - b.r < p.x + p.w && b.x + b.r > p.x && b.y > p.y - 4 && b.y < p.y + p.h + 4;
      if (b.vx < 0 && hit(this.left)) {
        const off = (b.y - (this.left.y + this.left.h / 2)) / (this.left.h / 2);
        const s = Math.min(620, Math.hypot(b.vx, b.vy) * 1.04);
        const ang = off * 0.9;
        b.vx = Math.cos(ang) * s;
        b.vy = Math.sin(ang) * s;
        b.x = this.left.x + this.left.w + b.r;
      }
      if (b.vx > 0 && hit(this.right)) {
        const off = (b.y - (this.right.y + this.right.h / 2)) / (this.right.h / 2);
        const s = Math.min(620, Math.hypot(b.vx, b.vy) * 1.04);
        const ang = Math.PI - off * 0.9;
        b.vx = Math.cos(ang) * s;
        b.vy = Math.sin(ang) * s;
        b.x = this.right.x - b.r;
      }
      if (b.x < -20) {
        this.rs++;
        this.serve(1);
      }
      if (b.x > W + 20) {
        this.ls++;
        this.serve(-1);
      }
      this.score = this.ls + this.rs;
      if (this.ls >= 7 || this.rs >= 7) this.over = true;
    },
    draw(c) {
      c.strokeStyle = "rgba(255,255,255,0.12)";
      c.setLineDash([8, 12]);
      c.beginPath();
      c.moveTo(W / 2, 0);
      c.lineTo(W / 2, H);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = "rgba(252,253,255,0.25)";
      c.font = "64px 'Instrument Serif', Georgia, serif";
      c.textAlign = "center";
      c.fillText(this.ls, W / 2 - 80, 80);
      c.fillText(this.rs, W / 2 + 80, 80);
      c.textAlign = "left";
      c.fillStyle = BLUE;
      c.fillRect(this.left.x, this.left.y, this.left.w, this.left.h);
      c.fillStyle = RED;
      c.fillRect(this.right.x, this.right.y, this.right.w, this.right.h);
      c.fillStyle = INK;
      c.beginPath();
      c.arc(this.ball.x, this.ball.y, this.ball.r, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = MUTE;
      c.font = "13px Inter, sans-serif";
      c.fillText("Bot vs Bot - first to 7", 14, 24);
    },
  };
  g.restart();
  return g;
}

function makeInvaders() {
  const g = {
    over: false,
    score: 0,
    t: 0,
    dir: 1,
    aliens: [],
    bombs: [],
    shots: [],
    ship: { x: 380, y: 410, w: 40, h: 16 },
    cool: 0,
    bombT: 0.8,
    restart() {
      this.over = false;
      this.score = 0;
      this.t = 0;
      this.dir = 1;
      this.bombs = [];
      this.shots = [];
      this.ship.x = 380;
      this.aliens = [];
      const palette = [GREEN, BLUE, YELLOW, ORANGE, RED];
      for (let r = 0; r < 5; r++) {
        for (let cIdx = 0; cIdx < 10; cIdx++) {
          this.aliens.push({ x: 120 + cIdx * 52, y: 50 + r * 36, w: 34, h: 22, color: palette[r], alive: true });
        }
      }
    },
    update(dt) {
      if (this.over) return;
      this.t += dt;
      this.cool -= dt;
      const alive = this.aliens.filter((a) => a.alive);
      const av = 28 + (50 - alive.length) * 2.4;
      let hitEdge = false;
      for (const a of alive) {
        a.x += this.dir * av * dt;
        if (a.x < 14 || a.x + a.w > W - 14) hitEdge = true;
      }
      if (hitEdge) {
        this.dir *= -1;
        for (const a of alive) a.y += 22;
      }
      this.bombT -= dt;
      if (this.bombT <= 0 && alive.length) {
        const columns = new Map();
        for (const a of alive) {
          const col = Math.round(a.x / 52);
          const cur = columns.get(col);
          if (!cur || a.y > cur.y) columns.set(col, a);
        }
        const shooter = pick([...columns.values()]);
        this.bombs.push({ x: shooter.x + shooter.w / 2, y: shooter.y + shooter.h, w: 5, h: 14 });
        this.bombT = rand(0.35, 0.85) * (alive.length / 50 + 0.4);
      }
      for (const s of this.shots) s.y -= 520 * dt;
      this.shots = this.shots.filter((s) => s.y > -20);
      for (const b of this.bombs) b.y += (150 + this.t * 2) * dt;
      this.bombs = this.bombs.filter((b) => b.y < H + 20);
      for (const s of this.shots) {
        for (const a of alive) {
          if (s.x > a.x && s.x < a.x + a.w && s.y > a.y && s.y < a.y + a.h) {
            a.alive = false;
            s.y = -999;
            this.score += 10;
          }
        }
      }
      this.shots = this.shots.filter((s) => s.y > -20);
      const ship = this.ship;
      for (const b of this.bombs) {
        if (b.x > ship.x && b.x < ship.x + ship.w && b.y + b.h > ship.y && b.y < ship.y + ship.h) {
          this.over = true;
        }
      }
      if (alive.some((a) => a.y + a.h > ship.y)) this.over = true;
      let target = null;
      let best = Infinity;
      for (const a of alive) {
        const d = Math.abs(a.x + a.w / 2 - (ship.x + ship.w / 2));
        if (d < best) {
          best = d;
          target = a;
        }
      }
      let danger = null;
      for (const b of this.bombs) {
        if (b.y > 260 && Math.abs(b.x - (ship.x + ship.w / 2)) < 44) {
          danger = b;
          break;
        }
      }
      const desired = danger
        ? ship.x + (ship.x + ship.w / 2 < danger.x ? -120 : 120)
        : target
          ? target.x + target.w / 2 - ship.w / 2
          : ship.x;
      ship.x += clamp(desired - ship.x, -330 * dt, 330 * dt);
      ship.x = clamp(ship.x, 8, W - ship.w - 8);
      if (target && this.cool <= 0 && Math.abs(target.x + target.w / 2 - (ship.x + ship.w / 2)) < 16 && !danger) {
        this.shots.push({ x: ship.x + ship.w / 2, y: ship.y - 4, w: 4, h: 12 });
        this.cool = 0.32;
      }
      if (!alive.length) this.restart();
    },
    draw(c) {
      for (const a of this.aliens) {
        if (!a.alive) continue;
        c.fillStyle = a.color;
        c.fillRect(a.x, a.y, a.w, a.h);
        c.fillStyle = BG;
        c.fillRect(a.x + 7, a.y + 7, 5, 5);
        c.fillRect(a.x + a.w - 12, a.y + 7, 5, 5);
      }
      c.fillStyle = YELLOW;
      for (const s of this.shots) c.fillRect(s.x, s.y, s.w, s.h);
      c.fillStyle = RED;
      for (const b of this.bombs) c.fillRect(b.x, b.y, b.w, b.h);
      const ship = this.ship;
      c.fillStyle = INK;
      c.fillRect(ship.x, ship.y + 6, ship.w, ship.h - 6);
      c.beginPath();
      c.moveTo(ship.x + ship.w / 2, ship.y - 6);
      c.lineTo(ship.x + ship.w - 4, ship.y + 10);
      c.lineTo(ship.x + 4, ship.y + 10);
      c.closePath();
      c.fill();
      c.fillStyle = MUTE;
      c.font = "13px Inter, sans-serif";
      c.fillText(`Score ${this.score}`, 14, 24);
    },
  };
  g.restart();
  return g;
}

function makeAsteroids() {
  const g = {
    over: false,
    score: 0,
    t: 0,
    ship: { x: 400, y: 225, vx: 0, vy: 0, a: -Math.PI / 2 },
    rocks: [],
    bullets: [],
    cool: 0,
    thrusting: false,
    spawnWave() {
      this.rocks = [];
      for (let i = 0; i < 6; i++) {
        let x;
        let y;
        do {
          x = rand(0, W);
          y = rand(0, H);
        } while (Math.hypot(x - 400, y - 225) < 180);
        this.rocks.push({
          x,
          y,
          r: 34,
          vx: rand(-70, 70),
          vy: rand(-70, 70),
          spin: rand(-1.5, 1.5),
          rot: rand(0, Math.PI * 2),
        });
      }
    },
    restart() {
      this.over = false;
      this.score = 0;
      this.t = 0;
      Object.assign(this.ship, { x: 400, y: 225, vx: 0, vy: 0, a: -Math.PI / 2 });
      this.bullets = [];
      this.spawnWave();
    },
    update(dt) {
      if (this.over) return;
      this.t += dt;
      this.cool -= dt;
      const s = this.ship;
      let target = null;
      let td = Infinity;
      for (const r of this.rocks) {
        const d = Math.hypot(r.x - s.x, r.y - s.y);
        if (d < td) {
          td = d;
          target = r;
        }
      }
      let want;
      if (td < 130) want = Math.atan2(s.y - target.y, s.x - target.x);
      else if (target) want = Math.atan2(target.y - s.y, target.x - s.x);
      else want = s.a;
      let diff = ((want - s.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      s.a += clamp(diff, -3.4 * dt, 3.4 * dt);
      this.thrusting = td < 130 || (td < 320 && Math.abs(diff) > 1.2);
      if (this.thrusting) {
        s.vx += Math.cos(s.a) * 300 * dt;
        s.vy += Math.sin(s.a) * 300 * dt;
      }
      s.vx *= 1 - 0.4 * dt;
      s.vy *= 1 - 0.4 * dt;
      const vmax = 300;
      const sp = Math.hypot(s.vx, s.vy);
      if (sp > vmax) {
        s.vx = (s.vx / sp) * vmax;
        s.vy = (s.vy / sp) * vmax;
      }
      s.x = (s.x + s.vx * dt + W) % W;
      s.y = (s.y + s.vy * dt + H) % H;
      if (target && this.cool <= 0 && td < 420 && Math.abs(diff) < 0.3 && td > 90) {
        this.bullets.push({ x: s.x + Math.cos(s.a) * 14, y: s.y + Math.sin(s.a) * 14, vx: Math.cos(s.a) * 520 + s.vx, vy: Math.sin(s.a) * 520 + s.vy, life: 1.1 });
        this.cool = 0.34;
      }
      for (const b of this.bullets) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        b.x = (b.x + W) % W;
        b.y = (b.y + H) % H;
      }
      this.bullets = this.bullets.filter((b) => b.life > 0);
      for (const r of this.rocks) {
        r.x = (r.x + r.vx * dt + W) % W;
        r.y = (r.y + r.vy * dt + H) % H;
        r.rot += r.spin * dt;
      }
      const newRocks = [];
      for (const r of this.rocks) {
        let dead = false;
        for (const b of this.bullets) {
          if (Math.hypot(b.x - r.x, b.y - r.y) < r.r) {
            b.life = 0;
            dead = true;
            this.score += r.r > 28 ? 20 : r.r > 16 ? 50 : 100;
            if (r.r > 16) {
              for (let i = 0; i < 2; i++) {
                newRocks.push({
                  x: r.x,
                  y: r.y,
                  r: r.r > 28 ? 20 : 11,
                  vx: r.vx + rand(-90, 90),
                  vy: r.vy + rand(-90, 90),
                  spin: rand(-2.5, 2.5),
                  rot: rand(0, Math.PI * 2),
                });
              }
            }
          }
        }
        if (!dead) newRocks.push(r);
      }
      this.bullets = this.bullets.filter((b) => b.life > 0);
      this.rocks = newRocks;
      for (const r of this.rocks) {
        if (Math.hypot(r.x - s.x, r.y - s.y) < r.r + 9) this.over = true;
      }
      if (!this.rocks.length) this.spawnWave();
    },
    draw(c) {
      c.fillStyle = "rgba(252,253,255,0.05)";
      for (let i = 0; i < 40; i++) {
        c.fillRect((i * 197) % W, (i * 91) % H, 2, 2);
      }
      c.strokeStyle = MUTE;
      c.lineWidth = 2;
      for (const r of this.rocks) {
        c.save();
        c.translate(r.x, r.y);
        c.rotate(r.rot);
        c.beginPath();
        const n = 9;
        for (let i = 0; i <= n; i++) {
          const a = (i / n) * Math.PI * 2;
          const rr = r.r * (0.75 + 0.3 * Math.abs(Math.sin(i * 2.7 + r.spin)));
          const px = Math.cos(a) * rr;
          const py = Math.sin(a) * rr;
          if (i === 0) c.moveTo(px, py);
          else c.lineTo(px, py);
        }
        c.closePath();
        c.stroke();
        c.restore();
      }
      const s = this.ship;
      c.fillStyle = GREEN;
      for (const b of this.bullets) {
        c.beginPath();
        c.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
        c.fill();
      }
      c.save();
      c.translate(s.x, s.y);
      c.rotate(s.a);
      c.strokeStyle = INK;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(14, 0);
      c.lineTo(-10, -9);
      c.lineTo(-6, 0);
      c.lineTo(-10, 9);
      c.closePath();
      c.stroke();
      if (this.thrusting) {
        c.strokeStyle = ORANGE;
        c.beginPath();
        c.moveTo(-8, -4);
        c.lineTo(-18 - Math.random() * 6, 0);
        c.lineTo(-8, 4);
        c.stroke();
      }
      c.restore();
      c.fillStyle = MUTE;
      c.font = "13px Inter, sans-serif";
      c.fillText(`Score ${this.score}`, 14, 24);
    },
  };
  g.restart();
  return g;
}

function makeFrogger() {
  const START_Y = H - 40;
  const ROW_H = 44;
  const COL_W = 40;
  const g = {
    over: false,
    score: 0,
    lives: 3,
    t: 0,
    frog: { x: 380, y: START_Y, w: 28, h: 28 },
    lanes: [],
    hopCd: 0,
    buildLanes() {
      this.lanes = [];
      const speeds = [70, -95, 120, -140, 160, -110];
      for (let i = 0; i < 6; i++) {
        const y = START_Y - 60 - i * ROW_H;
        const dir = speeds[i] > 0 ? 1 : -1;
        const cars = [];
        const gap = rand(150, 230);
        for (let x = -100; x < W + 200; x += gap) {
          cars.push({ x: x + rand(0, 60), w: rand(56, 108) });
        }
        this.lanes.push({ y, speed: Math.abs(speeds[i]), dir, cars });
      }
    },
    restart() {
      this.over = false;
      this.score = 0;
      this.lives = 3;
      this.t = 0;
      Object.assign(this.frog, { x: 380, y: START_Y });
      this.buildLanes();
    },
    laneAt(y) {
      return this.lanes.find((l) => y > l.y - ROW_H / 2 - 8 && y < l.y + ROW_H / 2 + 8);
    },
    safe(x, y) {
      if (x < 4 || x + 28 > W - 4 || y > START_Y + 4) return false;
      const lane = this.laneAt(y);
      if (!lane) return true;
      return !lane.cars.some((c) => x + 26 > c.x - 6 && x + 2 < c.x + c.w + 6);
    },
    update(dt) {
      if (this.over) return;
      this.t += dt;
      this.hopCd -= dt;
      for (const l of this.lanes) {
        for (const c of l.cars) c.x += l.speed * l.dir * dt;
        for (const c of l.cars) {
          if (l.dir > 0 && c.x > W + 40) c.x = -c.w - rand(40, 200);
          if (l.dir < 0 && c.x + c.w < -40) c.x = W + rand(40, 200);
        }
      }
      const f = this.frog;
      if (f.y < 44) {
        this.score += 100;
        Object.assign(f, { x: 380, y: START_Y });
      }
      for (const l of this.lanes) {
        if (Math.abs(f.y + 14 - (l.y + 14)) < 24) {
          for (const c of l.cars) {
            if (f.x + 24 > c.x && f.x + 4 < c.x + c.w) {
              this.lives--;
              if (this.lives <= 0) this.over = true;
              else Object.assign(f, { x: 380, y: START_Y });
            }
          }
        }
      }
      if (this.hopCd > 0) return;
      const cx = COL_W;
      const cy = ROW_H;
      const moves = [];
      const fwd = { x: f.x, y: f.y - cy };
      if (fwd.y > 10 && this.safe(fwd.x, fwd.y)) moves.push({ ...fwd, w: 2 });
      if (f.x > 20 && this.safe(f.x - cx, f.y)) moves.push({ x: f.x - cx, y: f.y, w: 1 });
      if (f.x < W - 48 && this.safe(f.x + cx, f.y)) moves.push({ x: f.x + cx, y: f.y, w: 1 });
      if (this.safe(f.x, f.y + cy)) moves.push({ x: f.x, y: f.y + cy, w: 0.2 });
      moves.sort((a, b) => b.w - a.w);
      if (moves.length) {
        const m = moves[0];
        f.x = m.x;
        f.y = m.y;
        this.hopCd = 0.16;
      }
    },
    draw(c) {
      c.fillStyle = "rgba(17,255,153,0.08)";
      c.fillRect(0, 8, W, 30);
      c.fillStyle = MUTE;
      c.font = "12px Inter, sans-serif";
      c.fillText("HOME", 14, 28);
      for (const l of this.lanes) {
        c.strokeStyle = "rgba(255,255,255,0.06)";
        c.beginPath();
        c.moveTo(0, l.y + ROW_H / 2);
        c.lineTo(W, l.y + ROW_H / 2);
        c.stroke();
        for (const car of l.cars) {
          c.fillStyle = l.dir > 0 ? BLUE : ORANGE;
          c.fillRect(car.x, l.y, car.w, 26);
          c.fillStyle = "rgba(0,0,0,0.35)";
          c.fillRect(car.x + car.w * 0.25, l.y + 4, car.w * 0.4, 8);
        }
      }
      c.fillStyle = GREEN;
      c.fillRect(this.frog.x, this.frog.y, 28, 28);
      c.fillStyle = BG;
      c.fillRect(this.frog.x + 6, this.frog.y + 6, 5, 5);
      c.fillRect(this.frog.x + 17, this.frog.y + 6, 5, 5);
      c.fillStyle = MUTE;
      c.font = "13px Inter, sans-serif";
      c.fillText(`Score ${this.score}   Lives ${this.lives}`, 14, H - 12);
    },
  };
  g.restart();
  return g;
}

function makeMaze() {
  const COLS = 20;
  const ROWS = 11;
  const CELL = 40;
  const OY = 5;
  function gen() {
    const cells = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    const stack = [{ x: 0, y: 0 }];
    cells[0][0] = 1;
    const dirs = [
      [0, -1, 1, 2],
      [1, 0, 2, 4],
      [0, 1, 4, 8],
      [-1, 0, 8, 1],
    ];
    while (stack.length) {
      const cur = stack[stack.length - 1];
      const options = dirs
        .map((d) => ({ d, nx: cur.x + d[0], ny: cur.y + d[1] }))
        .filter((o) => o.nx >= 0 && o.ny >= 0 && o.nx < COLS && o.ny < ROWS && !cells[o.ny][o.nx]);
      if (!options.length) {
        stack.pop();
        continue;
      }
      const { d, nx, ny } = pick(options);
      cells[cur.y][cur.x] |= d[2];
      cells[ny][nx] |= d[3];
      cells[ny][nx] = 1 | (cells[ny][nx] & 15);
      cells[cur.y][cur.x] = 1 | (cells[cur.y][cur.x] & 15);
      stack.push({ x: nx, y: ny });
    }
    return cells;
  }
  function solve(cells) {
    const prev = new Map();
    const q = [{ x: 0, y: 0 }];
    const seen = new Set(["0,0"]);
    while (q.length) {
      const cur = q.shift();
      if (cur.x === COLS - 1 && cur.y === ROWS - 1) {
        const path = [];
        let node = cur;
        while (node) {
          path.unshift(node);
          node = prev.get(`${node.x},${node.y}`);
        }
        return path;
      }
      const walls = cells[cur.y][cur.x];
      const steps = [
        [0, -1, 1],
        [1, 0, 2],
        [0, 1, 4],
        [-1, 0, 8],
      ];
      for (const [dx, dy, bit] of steps) {
        if (walls & bit) continue;
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        const key = `${nx},${ny}`;
        if (seen.has(key)) continue;
        seen.add(key);
        prev.set(key, cur);
        q.push({ x: nx, y: ny });
      }
    }
    return [];
  }
  const g = {
    over: false,
    score: 0,
    cells: null,
    path: [],
    idx: 0,
    pos: { x: 0, y: 0 },
    px: 0,
    py: 0,
    t: 0,
    newMaze() {
      this.cells = gen();
      this.path = solve(this.cells);
      this.idx = 0;
      this.pos = { x: 0, y: 0 };
      this.px = 0;
      this.py = 0;
    },
    restart() {
      this.over = false;
      this.score = 0;
      this.t = 0;
      this.newMaze();
    },
    update(dt) {
      if (this.over) return;
      this.t += dt;
      if (this.idx >= this.path.length - 1) {
        this.score++;
        this.newMaze();
        return;
      }
      const next = this.path[this.idx + 1];
      const tx = next.x * CELL + CELL / 2;
      const ty = next.y * CELL + OY + CELL / 2;
      const dx = tx - this.px;
      const dy = ty - this.py;
      const dist = Math.hypot(dx, dy);
      const step = 200 * dt;
      if (dist <= step) {
        this.px = tx;
        this.py = ty;
        this.idx++;
      } else {
        this.px += (dx / dist) * step;
        this.py += (dy / dist) * step;
      }
    },
    draw(c) {
      c.fillStyle = BG;
      c.fillRect(0, 0, W, H);
      const ex = (COLS - 1) * CELL;
      const ey = (ROWS - 1) * CELL + OY;
      c.fillStyle = "rgba(17,255,153,0.16)";
      c.fillRect(ex + 4, ey + 4, CELL - 8, CELL - 8);
      c.strokeStyle = "rgba(255,255,255,0.5)";
      c.lineWidth = 2;
      c.beginPath();
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const walls = this.cells[y][x];
          const x0 = x * CELL;
          const y0 = y * CELL + OY;
          if (!(walls & 1)) {
            c.moveTo(x0, y0);
            c.lineTo(x0 + CELL, y0);
          }
          if (!(walls & 2)) {
            c.moveTo(x0 + CELL, y0);
            c.lineTo(x0 + CELL, y0 + CELL);
          }
          if (!(walls & 4)) {
            c.moveTo(x0, y0 + CELL);
            c.lineTo(x0 + CELL, y0 + CELL);
          }
          if (!(walls & 8)) {
            c.moveTo(x0, y0);
            c.lineTo(x0, y0 + CELL);
          }
        }
      }
      c.stroke();
      c.strokeStyle = "rgba(59,158,255,0.35)";
      c.lineWidth = 3;
      c.beginPath();
      for (let i = 0; i <= this.idx && i < this.path.length; i++) {
        const p = this.path[i];
        const x = p.x * CELL + CELL / 2;
        const y = p.y * CELL + OY + CELL / 2;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.lineTo(this.px, this.py);
      c.stroke();
      c.fillStyle = BLUE;
      c.beginPath();
      c.arc(this.px, this.py, 11, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = MUTE;
      c.font = "13px Inter, sans-serif";
      c.fillText(`Mazes solved ${this.score}`, 14, H - 12);
    },
  };
  g.restart();
  return g;
}

const PIECES = [
  { t: "I", cells: [[0, 0], [1, 0], [2, 0], [3, 0]], color: BLUE },
  { t: "O", cells: [[0, 0], [1, 0], [0, 1], [1, 1]], color: YELLOW },
  { t: "T", cells: [[0, 0], [1, 0], [2, 0], [1, 1]], color: "#c084fc" },
  { t: "S", cells: [[1, 0], [2, 0], [0, 1], [1, 1]], color: GREEN },
  { t: "Z", cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: RED },
  { t: "J", cells: [[0, 0], [0, 1], [1, 1], [2, 1]], color: "#f472b6" },
  { t: "L", cells: [[2, 0], [0, 1], [1, 1], [2, 1]], color: ORANGE },
];

function rotateCells(cells) {
  const maxX = Math.max(...cells.map((c) => c[0]));
  return cells.map(([x, y]) => [maxX - y, x]);
}

function makeTetris() {
  const COLS = 10;
  const ROWS = 20;
  const CELL = 22;
  const OX = (W - COLS * CELL) / 2;
  const OY = (H - ROWS * CELL) / 2;
  function collides(board, cells, cx, cy) {
    for (const [x, y] of cells) {
      const bx = cx + x;
      const by = cy + y;
      if (bx < 0 || bx >= COLS || by >= ROWS) return true;
      if (by >= 0 && board[by][bx]) return true;
    }
    return false;
  }
  function dropRow(board, cells, cx) {
    let cy = -4;
    while (!collides(board, cells, cx, cy + 1)) cy++;
    return cy;
  }
  function evaluate(board, cells, cx) {
    const cy = dropRow(board, cells, cx);
    const sim = board.map((r) => r.slice());
    for (const [x, y] of cells) {
      const by = cy + y;
      if (by >= 0) sim[by][cx + x] = 1;
    }
    let lines = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (sim[y].every((v) => v)) {
        lines++;
        sim.splice(y, 1);
        sim.unshift(Array(COLS).fill(0));
        y++;
      }
    }
    const heights = [];
    let holes = 0;
    for (let x = 0; x < COLS; x++) {
      let h = 0;
      let seen = false;
      for (let y = 0; y < ROWS; y++) {
        if (sim[y][x]) {
          if (!seen) {
            h = ROWS - y;
            seen = true;
          }
        } else if (seen) holes++;
      }
      heights.push(h);
    }
    const agg = heights.reduce((a, b) => a + b, 0);
    let bump = 0;
    for (let x = 0; x < COLS - 1; x++) bump += Math.abs(heights[x] - heights[x + 1]);
    return lines * 0.76 - agg * 0.51 - holes * 1.36 - bump * 0.18;
  }
  const g = {
    over: false,
    score: 0,
    board: [],
    piece: null,
    rot: 0,
    cells: [],
    cx: 0,
    cy: 0,
    fallAcc: 0,
    moveCd: 0,
    plan: { rot: 0, col: 3 },
    restart() {
      this.over = false;
      this.score = 0;
      this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
      this.spawn();
    },
    spawn() {
      const p = pick(PIECES);
      this.piece = p;
      this.rot = 0;
      this.cells = p.cells.map((c) => [...c]);
      this.cx = 3;
      this.cy = -1;
      this.fallAcc = 0;
      this.moveCd = 0;
      let best = null;
      let bestScore = -Infinity;
      let cells = this.cells;
      for (let r = 0; r < 4; r++) {
        for (let col = 0; col < COLS; col++) {
          if (collides(this.board, cells, col, -1)) continue;
          const s = evaluate(this.board, cells, col);
          if (s > bestScore) {
            bestScore = s;
            best = { rot: r, col };
          }
        }
        cells = rotateCells(cells);
      }
      this.plan = best || { rot: 0, col: 3 };
    },
    lock() {
      for (const [x, y] of this.cells) {
        const by = this.cy + y;
        const bx = this.cx + x;
        if (by < 0) {
          this.over = true;
          return;
        }
        this.board[by][bx] = this.piece.color;
      }
      let lines = 0;
      for (let y = ROWS - 1; y >= 0; y--) {
        if (this.board[y].every((v) => v)) {
          lines++;
          this.board.splice(y, 1);
          this.board.unshift(Array(COLS).fill(0));
          y++;
        }
      }
      this.score += [0, 100, 300, 500, 800][lines] || 0;
      this.spawn();
    },
    update(dt) {
      if (this.over) return;
      this.moveCd -= dt;
      if (this.rot !== this.plan.rot && this.moveCd <= 0) {
        const next = rotateCells(this.cells);
        if (!collides(this.board, next, this.cx, this.cy)) {
          this.cells = next;
          this.rot = (this.rot + 1) % 4;
        }
        this.moveCd = 0.07;
      } else if (this.cx !== this.plan.col && this.moveCd <= 0) {
        const dir = this.cx < this.plan.col ? 1 : -1;
        if (!collides(this.board, this.cells, this.cx + dir, this.cy)) this.cx += dir;
        this.moveCd = 0.05;
      }
      this.fallAcc += dt;
      const fallSpeed = this.cx === this.plan.col && this.rot === this.plan.rot ? 16 : 4;
      while (this.fallAcc > 1 / fallSpeed) {
        this.fallAcc -= 1 / fallSpeed;
        if (!collides(this.board, this.cells, this.cx, this.cy + 1)) this.cy++;
        else {
          this.lock();
          break;
        }
      }
    },
    draw(c) {
      c.fillStyle = "rgba(255,255,255,0.03)";
      c.fillRect(OX - 6, OY - 6, COLS * CELL + 12, ROWS * CELL + 12);
      c.strokeStyle = "rgba(255,255,255,0.12)";
      c.strokeRect(OX - 6, OY - 6, COLS * CELL + 12, ROWS * CELL + 12);
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (this.board[y][x]) {
            c.fillStyle = this.board[y][x];
            c.fillRect(OX + x * CELL + 1, OY + y * CELL + 1, CELL - 2, CELL - 2);
          }
        }
      }
      c.fillStyle = "rgba(255,255,255,0.08)";
      let ghost = this.cy;
      while (!collides(this.board, this.cells, this.cx, ghost + 1)) ghost++;
      for (const [x, y] of this.cells) {
        if (ghost + y >= 0) c.fillRect(OX + (this.cx + x) * CELL + 1, OY + (ghost + y) * CELL + 1, CELL - 2, CELL - 2);
      }
      c.fillStyle = this.piece.color;
      for (const [x, y] of this.cells) {
        if (this.cy + y >= 0) c.fillRect(OX + (this.cx + x) * CELL + 1, OY + (this.cy + y) * CELL + 1, CELL - 2, CELL - 2);
      }
      c.fillStyle = MUTE;
      c.font = "13px Inter, sans-serif";
      c.fillText(`Score ${this.score}`, 14, 24);
      c.fillText("Bot plans each", 14, 60);
      c.fillText("placement before", 14, 78);
      c.fillText("it drops.", 14, 96);
    },
  };
  g.restart();
  return g;
}

function make2048() {
  const SIZE = 4;
  const TILE = 84;
  const GAP = 10;
  const OX = (W - (SIZE * TILE + (SIZE - 1) * GAP)) / 2;
  const OY = (H - (SIZE * TILE + (SIZE - 1) * GAP)) / 2;
  const COLORS = {
    2: "#1c1c22",
    4: "#26262e",
    8: ORANGE,
    16: "#ff963d",
    32: YELLOW,
    64: "#ffd76a",
    128: GREEN,
    256: "#4dffb8",
    512: BLUE,
    1024: "#6fb8ff",
    2048: "#c084fc",
  };
  function slide(board, dir) {
    const b = board.map((r) => r.slice());
    let gained = 0;
    const lines = [];
    for (let i = 0; i < SIZE; i++) {
      let line = [];
      for (let j = 0; j < SIZE; j++) {
        if (dir === "l") line.push(b[i][j]);
        else if (dir === "r") line.push(b[i][SIZE - 1 - j]);
        else if (dir === "u") line.push(b[j][i]);
        else line.push(b[SIZE - 1 - j][i]);
      }
      const compact = line.filter((v) => v);
      const out = [];
      for (let j = 0; j < compact.length; j += 2) {
        if (j + 1 < compact.length && compact[j] === compact[j + 1]) {
          out.push(compact[j] * 2);
          gained += compact[j] * 2;
          j++;
        } else out.push(compact[j]);
      }
      while (out.length < SIZE) out.push(0);
      lines.push(out);
    }
    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE; j++) {
        if (dir === "l") b[i][j] = lines[i][j];
        else if (dir === "r") b[i][j] = lines[i][SIZE - 1 - j];
        else if (dir === "u") b[i][j] = lines[j][i];
        else b[i][j] = lines[SIZE - 1 - j][i];
      }
    }
    let changed = false;
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) if (b[y][x] !== board[y][x]) changed = true;
    return { b, gained, changed };
  }
  function heuristic(board) {
    const weights = [
      [65536, 16384, 4096, 1024],
      [512, 128, 32, 8],
      [16, 4, 2, 1],
      [1, 0, 0, 0],
    ];
    let h = 0;
    let empty = 0;
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        if (!board[y][x]) empty++;
        else h += board[y][x] * weights[y][x];
      }
    return h + empty * 300;
  }
  const g = {
    over: false,
    score: 0,
    board: [],
    waitT: 0,
    anim: new Map(),
    restart() {
      this.over = false;
      this.score = 0;
      this.board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
      this.spawn();
      this.spawn();
      this.waitT = 0;
    },
    spawn() {
      const free = [];
      for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) if (!this.board[y][x]) free.push({ x, y });
      if (!free.length) return;
      const c = pick(free);
      this.board[c.y][c.x] = Math.random() < 0.9 ? 2 : 4;
      this.anim.set(`${c.x},${c.y}`, 0.18);
    },
    update(dt) {
      if (this.over) return;
      for (const [k, v] of this.anim) {
        const nv = v - dt;
        if (nv <= 0) this.anim.delete(k);
        else this.anim.set(k, nv);
      }
      this.waitT -= dt;
      if (this.waitT > 0) return;
      const dirs = ["l", "r", "u", "d"];
      let best = null;
      let bestScore = -Infinity;
      for (const d of dirs) {
        const res = slide(this.board, d);
        if (!res.changed) continue;
        const s = heuristic(res.b) + res.gained * 2 + Math.random() * 40;
        if (s > bestScore) {
          bestScore = s;
          best = d;
        }
      }
      if (!best) {
        this.over = true;
        return;
      }
      const res = slide(this.board, best);
      this.board = res.b;
      this.score += res.gained;
      this.spawn();
      this.waitT = 0.22;
    },
    draw(c) {
      c.fillStyle = "rgba(255,255,255,0.03)";
      c.fillRect(OX - 12, OY - 12, SIZE * TILE + (SIZE - 1) * GAP + 24, SIZE * TILE + (SIZE - 1) * GAP + 24);
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          const v = this.board[y][x];
          const px = OX + x * (TILE + GAP);
          const py = OY + y * (TILE + GAP);
          c.fillStyle = v ? COLORS[v] || "#2dd4bf" : "rgba(255,255,255,0.05)";
          const pop = this.anim.get(`${x},${y}`) || 0;
          const inset = pop > 0 ? pop * 40 : 0;
          c.fillRect(px + inset, py + inset, TILE - inset * 2, TILE - inset * 2);
          if (v) {
            c.fillStyle = v > 8 ? "#000" : INK;
            c.font = `600 ${v >= 1024 ? 26 : v >= 128 ? 30 : 34}px Inter, sans-serif`;
            c.textAlign = "center";
            c.textBaseline = "middle";
            c.fillText(String(v), px + TILE / 2, py + TILE / 2 + 1);
            c.textAlign = "left";
            c.textBaseline = "alphabetic";
          }
        }
      }
      c.fillStyle = MUTE;
      c.font = "13px Inter, sans-serif";
      c.fillText(`Score ${this.score}`, 14, 24);
      c.fillText(`Best tile ${Math.max(...this.board.flat())}`, 14, 42);
    },
  };
  g.restart();
  return g;
}

function makeMole() {
  const holes = [];
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      holes.push({ x: 200 + x * 160, y: 90 + y * 120, up: 0, hit: 0, cool: rand(0.2, 1.4) });
    }
  }
  const g = {
    over: false,
    score: 0,
    t: 0,
    holes,
    hammer: { x: 400, y: -80, tx: 400, ty: -80, swing: 0 },
    restart() {
      this.over = false;
      this.score = 0;
      this.t = 0;
      for (const h of this.holes) {
        h.up = 0;
        h.hit = 0;
        h.cool = rand(0.2, 1.4);
      }
    },
    update(dt) {
      if (this.over) return;
      this.t += dt;
      const rate = Math.max(0.55, 1.4 - this.t * 0.012);
      for (const h of this.holes) {
        if (h.up > 0) {
          h.up -= dt;
        } else if (h.hit > 0) {
          h.hit -= dt;
        } else {
          h.cool -= dt;
          if (h.cool <= 0) {
            h.up = rand(0.6, 1.1);
            h.cool = rand(rate * 0.7, rate * 1.6);
          }
        }
      }
      const targets = this.holes.filter((h) => h.up > 0.15);
      if (targets.length) {
        const t = pick(targets);
        this.hammer.tx = t.x + 26;
        this.hammer.ty = t.y - 18;
      } else {
        this.hammer.tx = 400;
        this.hammer.ty = -80;
      }
      const hx = this.hammer.x;
      const hy = this.hammer.y;
      const dx = this.hammer.tx - hx;
      const dy = this.hammer.ty - hy;
      const dist = Math.hypot(dx, dy);
      const sp = 640 * dt;
      if (dist > 26) {
        this.hammer.x += (dx / dist) * Math.min(sp, dist);
        this.hammer.y += (dy / dist) * Math.min(sp, dist);
        this.hammer.swing = Math.max(0, this.hammer.swing - dt * 4);
      } else {
        this.hammer.swing = Math.min(1, this.hammer.swing + dt * 9);
        if (this.hammer.swing >= 0.95) {
          for (const h of this.holes) {
            if (h.up > 0 && Math.hypot(h.x + 26 - this.hammer.x, h.y - 18 - this.hammer.y) < 60) {
              h.up = 0;
              h.hit = 0.35;
              this.score++;
            }
          }
          this.hammer.swing = 0;
        }
      }
    },
    draw(c) {
      c.fillStyle = MUTE;
      c.font = "13px Inter, sans-serif";
      c.fillText(`Score ${this.score}   Round ${1 + Math.floor(this.t / 25)}`, 14, 24);
      for (const h of this.holes) {
        c.fillStyle = "rgba(255,255,255,0.05)";
        c.beginPath();
        c.ellipse(h.x + 26, h.y + 26, 46, 26, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#000";
        c.beginPath();
        c.ellipse(h.x + 26, h.y + 26, 36, 18, 0, 0, Math.PI * 2);
        c.fill();
        if (h.up > 0) {
          const rise = Math.min(1, h.up * 4);
          c.fillStyle = "#8b5a2b";
          c.beginPath();
          c.ellipse(h.x + 26, h.y + 22 - 18 * rise, 24, 26 * rise, 0, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = INK;
          c.beginPath();
          c.arc(h.x + 17, h.y + 6 - 18 * rise, 3.5, 0, Math.PI * 2);
          c.arc(h.x + 35, h.y + 6 - 18 * rise, 3.5, 0, Math.PI * 2);
          c.fill();
        } else if (h.hit > 0) {
          c.strokeStyle = RED;
          c.lineWidth = 3;
          const r = 18 + (0.35 - h.hit) * 60;
          c.beginPath();
          c.arc(h.x + 26, h.y + 10, r, 0, Math.PI * 2);
          c.stroke();
          c.lineWidth = 1;
        }
      }
      const hm = this.hammer;
      c.save();
      c.translate(hm.x, hm.y);
      c.rotate(-0.9 + hm.swing * 1.7);
      c.strokeStyle = "#c9a227";
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(0, -44);
      c.stroke();
      c.fillStyle = INK;
      c.fillRect(-14, -62, 28, 20);
      c.restore();
    },
  };
  g.restart();
  return g;
}

const GAMES = [
  { id: "dino", title: "Auto Dino Runner", desc: "A bot sprints through the desert and leaps over every cactus - and duck-dives under the birds.", make: makeDino },
  { id: "flappy", title: "Auto Flappy", desc: "The bot taps at exactly the right moment to thread the bird through every pipe gap.", make: makeFlappy },
  { id: "snake", title: "Auto Snake", desc: "Pathfinding snake: the bot BFS-plans a route to the food and flees when trapped.", make: makeSnake },
  { id: "breakout", title: "Auto Breakout", desc: "The paddle shadow-tracks the ball and angles every return into the brick wall.", make: makeBreakout },
  { id: "pong", title: "Auto Pong", desc: "Two bots rally forever. First to seven takes the match, then they run it back.", make: makePong },
  { id: "invaders", title: "Auto Space Invaders", desc: "The bot lines up shots on the nearest alien and sidesteps every falling bomb.", make: makeInvaders },
  { id: "asteroids", title: "Auto Asteroids", desc: "The ship targets the closest rock, blasts it into pieces and burns away from danger.", make: makeAsteroids },
  { id: "frogger", title: "Auto Frogger", desc: "The frog reads the traffic, waits for a gap and hops clean across six lanes.", make: makeFrogger },
  { id: "maze", title: "Auto Maze Runner", desc: "A solver races through a freshly generated maze, then instantly starts the next one.", make: makeMaze },
  { id: "tetris", title: "Auto Tetris", desc: "The bot scores every rotation and column, then drops each piece into the best spot.", make: makeTetris },
  { id: "2048", title: "Auto 2048", desc: "A greedy slider chases the classic corner strategy and never stops merging tiles.", make: make2048 },
  { id: "mole", title: "Auto Whack-a-Mole", desc: "An auto-hammer smacks every mole the instant it pops up. The score climbs forever.", make: makeMole },
];

const canvas = document.getElementById("autoCanvas");
const ctx = canvas.getContext("2d");

let current = null;
let currentDef = null;
let speed = 1;
let paused = false;
let overT = 0;
const bests = loadBests();

function loadBests() {
  try {
    return JSON.parse(localStorage.getItem("boredpup-auto-best") || "{}");
  } catch {
    return {};
  }
}

function saveBests() {
  try {
    localStorage.setItem("boredpup-auto-best", JSON.stringify(bests));
  } catch {
    /* private mode */
  }
}

function statusText() {
  if (paused) return "Paused";
  if (current && current.over) return "Bot wiped out - rebooting…";
  return "Bot playing";
}

function updateHud() {
  document.getElementById("autoStatus").textContent = statusText();
  document.getElementById("autoScore").textContent = current ? current.score : 0;
  document.getElementById("autoBest").textContent = bests[currentDef.id] || 0;
}

function loadGame(def) {
  currentDef = def;
  current = def.make();
  overT = 0;
  document.getElementById("autoTitle").textContent = def.title;
  document.getElementById("autoDesc").textContent = def.desc;
  document.querySelectorAll(".auto-card").forEach((card) => {
    const active = card.dataset.id === def.id;
    card.classList.toggle("active", active);
    card.setAttribute("aria-pressed", active ? "true" : "false");
  });
  updateHud();
}

function trackBest() {
  if (!current || !currentDef) return;
  const best = bests[currentDef.id] || 0;
  if (current.score > best) {
    bests[currentDef.id] = current.score;
    saveBests();
  }
}

let lastTs = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  if (!lastTs) lastTs = ts;
  let dt = (ts - lastTs) / 1000;
  lastTs = ts;
  if (dt > 0.05) dt = 0.05;
  if (!current) return;
  if (!paused) {
    const total = dt * speed;
    const step = 1 / 120;
    let t = 0;
    while (t < total && !current.over) {
      const s = Math.min(step, total - t);
      current.update(s);
      t += s;
    }
    if (current.over) {
      overT += total;
      if (overT > 1.4) {
        trackBest();
        current.restart();
        overT = 0;
      }
    }
  }
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  current.draw(ctx);
  updateHud();
}

function renderGrid() {
  const grid = document.getElementById("autoGrid");
  grid.innerHTML = GAMES.map(
    (g) => `
    <button class="auto-card" type="button" role="listitem" data-id="${escapeHtml(g.id)}" aria-pressed="false">
      <span class="auto-card-title">${escapeHtml(g.title)}</span>
      <span class="auto-card-desc">${escapeHtml(g.desc)}</span>
      <span class="auto-card-live"><span class="status-dot" aria-hidden="true"></span>Bot ready</span>
    </button>`
  ).join("");
  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".auto-card");
    if (!card) return;
    const def = GAMES.find((g) => g.id === card.dataset.id);
    if (def && def !== currentDef) {
      loadGame(def);
      // Scroll to player
      const player = document.getElementById("player");
      if (player) {
        player.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  });
  // keyboard accessibility
  grid.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      const card = e.target.closest(".auto-card");
      if (!card) return;
      e.preventDefault();
      card.click();
    }
  });
}

function bindControls() {
  const pauseBtn = document.getElementById("autoPause");
  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    pauseBtn.textContent = paused ? "Resume" : "Pause";
    pauseBtn.setAttribute("aria-pressed", paused ? "true" : "false");
    updateHud();
  });
  document.getElementById("autoRestart").addEventListener("click", () => {
    trackBest();
    current = currentDef.make();
    overT = 0;
    updateHud();
  });
  document.querySelectorAll(".speed-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      speed = Number(btn.dataset.speed) || 1;
      document.querySelectorAll(".speed-btn").forEach((b) => b.classList.toggle("active", b === btn));
    });
  });
}

async function init() {
  initNav();
  setCanonical();
  initPwa();
  renderGrid();
  bindControls();
  loadGame(GAMES[0]);
  requestAnimationFrame(frame);
  initFooter();
}

init();
