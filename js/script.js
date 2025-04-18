// Elementos e contexto
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const collisionToggle = document.getElementById('collisionToggle');
const resetBtn = document.getElementById('resetBtn');
let width = canvas.width = window.innerWidth;
let height = canvas.height = window.innerHeight;

// Configurações de física e massas
const friction = 0.985;
const restitution = 0.8;    // Reduzido de 1.2 para 0.8 para colisões mais realistas
const massBall = 0.8;
const massButton = 3;
const maxSpeed = 12;        // Reduzido de 15 para 12
const iterations = 3;       // Novo: número de iterações para verificação de colisão
const stopThreshold = 0.2;
let rotation = 0.5;

const ballConfig = {
    rotation: 0,
    panels: 5,         // Reduzido para 5 painéis para melhor distribuição
    shadowOffset: 4,
    scale: 0.5,        // Reduzido para espaçar mais os painéis
    borderWidth: 1.5   // Novo: largura da borda dos painéis
};

let currentPlayer = 1;
let scores = {1: 0, 2: 0};
let timeLeft = 300;
let turnTime = 10;
let loopInterval, gameTimerInterval, turnTimerInterval;
let lastPlayedPiece = null;

let pieces = [];
let ball;
let selected = null;
let startPoint = null;
let dragEnd = null;

// Posicionamento inicial de bola e peças
function resetPositions() {
  ball = { x: width/2, y: height/2, r: 15, vx: 0, vy: 0, m: massBall, moving: false };
  pieces = [];
  const r = 20;
  const defX1 = width * 0.1, atkX1 = width * 0.3;
  const defX2 = width * 0.9, atkX2 = width * 0.7;
  const yDefs = [height * 0.2, height * 0.5, height * 0.8];
  const yAtks = [height * 0.33, height * 0.66];
  yDefs.forEach(y => pieces.push({ x: defX1, y, r, vx:0, vy:0, m: massButton, moving:false, player:1 }));
  yAtks.forEach(y => pieces.push({ x: atkX1, y, r, vx:0, vy:0, m: massButton, moving:false, player:1 }));
  yDefs.forEach(y => pieces.push({ x: defX2, y, r, vx:0, vy:0, m: massButton, moving:false, player:2 }));
  yAtks.forEach(y => pieces.push({ x: atkX2, y, r, vx:0, vy:0, m: massButton, moving:false, player:2 }));
  lastPlayedPiece = null;
}

function clampSpeed(obj) {
  const speed = Math.hypot(obj.vx, obj.vy);
  if (speed > maxSpeed) {
    const scale = maxSpeed / speed;
    obj.vx *= scale;
    obj.vy *= scale;
  }
}

function init() {
  clearAllTimers();
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
  scores = {1:0, 2:0}; timeLeft = 300; currentPlayer = 1;
  resetPositions(); startGameTimer(); startTurnTimer();
  loopInterval = setInterval(gameLoop, 1000/60);
  updateUI();
}

function clearAllTimers() {
  clearInterval(loopInterval);
  clearInterval(gameTimerInterval);
  clearInterval(turnTimerInterval);
}

function startGameTimer() {
  gameTimerInterval = setInterval(() => {
    if (timeLeft > 0) { timeLeft--; updateUI(); } else endGame();
  }, 1000);
}

function startTurnTimer() {
  turnTime = 10; updateTurnUI(); clearInterval(turnTimerInterval);
  turnTimerInterval = setInterval(() => {
    if (!isMoving() && timeLeft > 0 && !lastPlayedPiece) {
      turnTime--; updateTurnUI(); if (turnTime <= 0) switchPlayer();
    }
  }, 1000);
}

function isMoving() { return ball.moving || pieces.some(p => p.moving); }

function updateUI() {
  document.getElementById('scoreboard').textContent =
    `Jogador 1: ${scores[1]} | Jogador 2: ${scores[2]}`;
  const m = String(Math.floor(timeLeft/60)).padStart(2,'0');
  const s = String(timeLeft%60).padStart(2,'0');
  document.getElementById('timer').textContent = `Tempo: ${m}:${s}`;
}

function updateTurnUI() {
  document.getElementById('turnTimer').textContent =
    `Turno Jogador ${currentPlayer}: ${turnTime}s`;
}

function endGame() {
  clearAllTimers();
  ctx.fillStyle = '#fff'; ctx.font = '40px Arial';
  const msg = scores[1]>scores[2]?'Jogador 1 vence!':scores[2]>scores[1]?'Jogador 2 vence!':'Empate!';
  ctx.fillText(msg, width/2-150, height/2);
}

function gameLoop() {
  rotation += 2;
  // move peças
  pieces.forEach(p => {
    if (p.moving) {
      p.x += p.vx; p.y += p.vy;
      p.vx *= friction; p.vy *= friction;
      clampSpeed(p);
      if (Math.hypot(p.vx,p.vy) < stopThreshold) {
        p.vx=p.vy=0; p.moving=false;
        if (p===lastPlayedPiece){ lastPlayedPiece=null; switchPlayer(); }
      }
      // colisão com bordas
      if(p.x-p.r<0){p.x=p.r;p.vx=-p.vx;} else if(p.x+p.r>width){p.x=width-p.r;p.vx=-p.vx;}
      if(p.y-p.r<0){p.y=p.r;p.vy=-p.vy;} else if(p.y+p.r>height){p.y=height-p.r;p.vy=-p.vy;}
    }
  });
  // move bola
  if (ball.moving) {
    ball.x += ball.vx; ball.y += ball.vy;
    ball.vx *= friction; ball.vy *= friction;
    clampSpeed(ball);
    if (Math.hypot(ball.vx,ball.vy)<stopThreshold){ball.vx=ball.vy=0;ball.moving=false;}
    ballConfig.rotation += Math.hypot(ball.vx, ball.vy) * 0.03;
  }
  // colisões
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < pieces.length; i++) {
      // Colisão entre peças
      for (let j = i + 1; j < pieces.length; j++) {
        collide(pieces[i], pieces[j]);
      }
      // Colisão com a bola
      collide(pieces[i], ball);
    }
  }
  // gols
  const top=height/2-75, bot=height/2+75;
  if(ball.x-ball.r<=0&&ball.y>top&&ball.y<bot){scores[currentPlayer]++;updateUI();resetPositions();return;}
  if(ball.x+ball.r>=width&&ball.y>top&&ball.y<bot){scores[currentPlayer]++;updateUI();resetPositions();return;}
  // rebote
  if(ball.x-ball.r<0){ball.x=ball.r;ball.vx=-ball.vx;}else if(ball.x+ball.r>width){ball.x=width-ball.r;ball.vx=-ball.vx;}
  if(ball.y-ball.r<0){ball.y=ball.r;ball.vy=-ball.vy;}else if(ball.y+ball.r>height){ball.y=height-ball.r;ball.vy=-ball.vy;}
  draw();
}

function collide(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const minDist = a.r + b.r;

  if (dist < minDist) {
    // Normalizar vetores
    const nx = dx / dist;
    const ny = dy / dist;

    // Calcular velocidade relativa
    const dvx = b.vx - a.vx;
    const dvy = b.vy - a.vy;
    const relativeVelocity = dvx * nx + dvy * ny;

    // Ignorar colisão se os objetos estão se afastando
    if (relativeVelocity > 0) return;

    // Calcular impulso
    const imp = -(1 + restitution) * relativeVelocity / (1/a.m + 1/b.m);
    const ix = imp * nx;
    const iy = imp * ny;

    // Aplicar impulso
    a.vx -= ix / a.m;
    a.vy -= iy / a.m;
    b.vx += ix / b.m;
    b.vy += iy / b.m;

    // Corrigir sobreposição
    const overlap = minDist - dist;
    const correction = overlap * 0.5; // Dividir correção entre os dois objetos
    const correctionX = nx * correction;
    const correctionY = ny * correction;

    // Aplicar correção de posição
    a.x -= correctionX;
    a.y -= correctionY;
    b.x += correctionX;
    b.y += correctionY;

    a.moving = true;
    b.moving = true;
  }
}

function switchPlayer(){ currentPlayer=currentPlayer===1?2:1; startTurnTimer(); }

function draw(){
  ctx.clearRect(0,0,width,height);
  ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.strokeRect(0,0,width,height);
  ctx.beginPath();ctx.moveTo(width/2,0);ctx.lineTo(width/2,height);ctx.stroke();
  ctx.beginPath();ctx.arc(width/2,height/2,100,0,2*Math.PI);ctx.stroke();
  ctx.fillStyle='#000';ctx.fillRect(0,height/2-75,5,150);ctx.fillRect(width-5,height/2-75,5,150);
  // aura
  pieces.forEach(p=>{ if(p.player===currentPlayer&&!p.moving){ctx.save();ctx.strokeStyle=p.player===1?'rgba(255,200,0,0.8)':'rgba(0,200,255,0.8)';ctx.lineWidth=3;ctx.setLineDash([8,8]);ctx.lineDashOffset=-rotation;ctx.beginPath();ctx.arc(p.x,p.y,p.r+8,0,2*Math.PI);ctx.stroke();ctx.restore();}});
  // peças e bola
  pieces.forEach(p=>{ctx.fillStyle=p.player===1?'#f00':'#00f';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,2*Math.PI);ctx.fill();});
  drawSoccerBall();
  // predição (collisionToggle)
  if(collisionToggle.checked && selected){
    const dx=dragEnd.x-startPoint.x, dy=dragEnd.y-startPoint.y, d=Math.hypot(dx,dy);
    if(d>0){const nx=dx/d, ny=dy/d; ctx.strokeStyle='rgba(255,255,255,0.7)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(selected.x,selected.y);const L=Math.max(width,height);ctx.lineTo(selected.x+nx*L, selected.y+ny*L);ctx.stroke();}
  }
  // indicador força
  if(selected&&dragEnd){const dx=dragEnd.x-startPoint.x,dy=dragEnd.y-startPoint.y,force=Math.min(Math.hypot(dx,dy)/5,maxSpeed),angle=Math.atan2(dy,dx);ctx.strokeStyle=selected.player===1?'#ff0':'#0ff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(selected.x,selected.y);const len=force*10;ctx.lineTo(selected.x+Math.cos(angle)*len,selected.y+Math.sin(angle)*len);ctx.stroke();}
}

function drawSoccerBall() {
    const ballImage = document.getElementById('soccerBall');
    const x = ball.x - ball.r;
    const y = ball.y - ball.r;
    const size = ball.r * 2;
    
    // Salvar contexto para aplicar rotação
    ctx.save();
    
    // Transladar para o centro da bola
    ctx.translate(ball.x, ball.y);
    // Rotacionar baseado na velocidade
    ctx.rotate(ballConfig.rotation);
    // Voltar para a posição original
    ctx.translate(-ball.x, -ball.y);
    
    // Desenhar a imagem
    ctx.drawImage(ballImage, x, y, size, size);
    
    // Restaurar contexto
    ctx.restore();
}

canvas.addEventListener('mousedown',e=>{if(isMoving()||timeLeft<=0)return;const rect=canvas.getBoundingClientRect();const x=e.clientX-rect.left,y=e.clientY-rect.top;selected=pieces.find(p=>p.player===currentPlayer&&Math.hypot(x-p.x,y-p.y)<=p.r);if(selected){startPoint={x,y};dragEnd={x,y};}});
canvas.addEventListener('mousemove',e=>{if(selected){const rect=canvas.getBoundingClientRect();dragEnd={x:e.clientX-rect.left,y:e.clientY-rect.top};}});
canvas.addEventListener('mouseup',e=>{if(selected&&dragEnd){lastPlayedPiece=selected;const dx=startPoint.x-dragEnd.x,dy=startPoint.y-dragEnd.y;selected.vx=dx/5;selected.vy=dy/5;selected.moving=true;selected=null;dragEnd=null;startPoint=null;}});

resetBtn.addEventListener('click',init);
window.addEventListener('resize',()=>{width=canvas.width=window.innerWidth;height=canvas.height=window.innerHeight;resetPositions();draw();});
init();