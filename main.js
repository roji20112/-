/* لعبة مطعم جزائري — نسخة قابلّة للتوسيع
   تصميم: خريطة كبيرة, لاعب, زبائن, طاولات, طلبات، نقاط.
   كل شيء في canvas -> سهل التعديل والإضافة.
*/

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function fitCanvas(){
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
fitCanvas();
addEventListener('resize', fitCanvas);

// HUD elements
const scoreEl = document.getElementById('score');
const timeEl = document.getElementById('time');
const ordersCountEl = document.getElementById('orders-count');

// الإعدادات العامة
const TILE = 64;
const WORLD = { width: 40 * TILE, height: 24 * TILE }; // خريطة أكبر من الشاشة
let camera = { x: 0, y: 0, w: canvas.width, h: canvas.height };

// اللاعب
const player = {
  x: WORLD.width/2,
  y: WORLD.height/2,
  w: 36,
  h: 48,
  speed: 220, // px/s
  dir: 0
};

// طاولات (ثابتة) - توليد نمطي
const tables = [];
for(let r=0;r<6;r++){
  for(let c=0;c<6;c++){
    const marginX = 180, marginY = 120;
    const tx = marginX + c * 520 + (r%2)*60;
    const ty = marginY + r * 280;
    if(tx < WORLD.width-100 && ty < WORLD.height-100)
      tables.push({ x: tx, y: ty, w: 80, h: 50, occupied: false, id: tables.length});
  }
}

// زبائن
let customers = [];
let orders = [];
let score = 0;
let gameSeconds = 0;
let lastSpawn = 0;
const spawnInterval = 2.5; // ثواني

// تحكمات
const keys = {};
addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

canvas.addEventListener('click', (e) => {
  // محوّر لإحداثيات العالم
  const rect = canvas.getBoundingClientRect();
  const cx = (e.clientX - rect.left) + camera.x;
  const cy = (e.clientY - rect.top) + camera.y;
  // التحقق هل نقرت على طاولة
  for(const t of tables){
    if(cx >= t.x - t.w/2 && cx <= t.x + t.w/2 && cy >= t.y - t.h/2 && cy <= t.y + t.h/2){
      // إذا طاولة مشغولة قم بخدمة الزبون
      const cust = customers.find(c => c.tableId === t.id && c.state === 'waiting');
      if(cust){
        serveCustomer(cust);
      } else {
        // لو فاضية: اللاعب يأخذ مقعد (يمكن توسيع)
      }
      break;
    }
  }
});

addEventListener('keydown', e => {
  if(e.key.toLowerCase() === 'e'){
    // تفاعل أمام الطاولة
    interact();
  }
});

// وظائف اللعبة الأساسية
function spawnCustomer(){
  // يختار طاولة فارغة
  const freeTables = tables.filter(t => !t.occupied);
  if(freeTables.length === 0) return;
  const t = freeTables[Math.floor(Math.random()*freeTables.length)];
  t.occupied = true;
  const entry = { // موضع دخول يمكن أن يكون حافة الخريطة
    x: Math.random() < 0.5 ? 30 : WORLD.width - 30,
    y: Math.random()*WORLD.height
  };
  const cust = {
    id: Date.now() + Math.random(),
    x: entry.x,
    y: entry.y,
    w: 28, h: 40,
    speed: 80 + Math.random()*60,
    tableId: t.id,
    state: 'walkingToTable', // walkingToTable, waiting, eating, leaving, served
    patience: 12 + Math.random()*10,
    order: randomOrder(),
    timer: 0
  };
  customers.push(cust);
  orders.push({ customerId: cust.id, order: cust.order, createdAt: gameSeconds });
}

function randomOrder(){
  // قائمة أطباق جزائرية بسيطة (يمكن توسعة)
  const menu = [
    { name: 'كسكس بلحم', time:6, score: 30 },
    { name: 'شخشوخة', time:7, score: 35 },
    { name: 'دجاج مشوي', time:5, score: 25 },
    { name: 'شوربة الحريرة', time:4, score: 18 },
    { name: 'مقروض', time:3, score: 12 }
  ];
  return menu[Math.floor(Math.random()*menu.length)];
}

function serveCustomer(cust){
  // تقديم الطلب بنجاح
  const idx = customers.findIndex(c => c.id === cust.id);
  if(idx === -1) return;
  // منحة نقاط مبسطة + نهاية الطلب
  score += Math.max(5, Math.round(cust.order.score - (cust.timer/2)));
  updateHUD();
  // حالة الانتقال
  cust.state = 'eating';
  cust.timer = 0;
  // ازالة من قائمة الطلبات
  orders = orders.filter(o => o.customerId !== cust.id);
  ordersCountEl.textContent = orders.length;
}

// تفاعل E: خدمة إذا اللاعب أمام الطاولة والزبون ينتظر
function interact(){
  // تحقق المسافة إلى أي طاولة قريبة
  for(const t of tables){const dx = player.x - t.x;
    const dy = player.y - t.y;
    if(Math.hypot(dx,dy) < 90){
      const cust = customers.find(c => c.tableId === t.id && c.state === 'waiting');
      if(cust){
        serveCustomer(cust);
        return;
      }
    }
  }
}

// تحديث HUD
function updateHUD(){
  scoreEl.textContent = score;
  ordersCountEl.textContent = orders.length;
}

// منطق العملاء (AI مبسطة)
function updateCustomers(dt){
  for(let i=customers.length-1;i>=0;i--){
    const c = customers[i];
    const table = tables.find(t => t.id === c.tableId);
    if(!table){
      customers.splice(i,1); continue;
    }
    if(c.state === 'walkingToTable'){
      // يتحرك نحو منتصف الطاولة
      const targetX = table.x;
      const targetY = table.y - 40; // يقف أمام الطاولة
      const dx = targetX - c.x;
      const dy = targetY - c.y;
      const dist = Math.hypot(dx,dy);
      if(dist < 6){
        c.state = 'waiting';
        c.timer = 0;
      } else {
        c.x += (dx/dist) * c.speed * dt;
        c.y += (dy/dist) * c.speed * dt;
      }
    } else if(c.state === 'waiting'){
      c.timer += dt;
      // تزداد نفاد الصبر
      c.patience -= dt;
      if(c.patience <= 0){
        // يترك المطعم غاضباً
        c.state = 'leaving';
        // ازالة الطلب
        orders = orders.filter(o => o.customerId !== c.id);
      }
    } else if(c.state === 'eating'){
      c.timer += dt;
      if(c.timer > c.order.time){
        // يأكل ثم يغادر
        c.state = 'leaving';
      }
    } else if(c.state === 'leaving'){
      // يتجه للخارج
      const targetX = Math.random() < 0.5 ? -40 : WORLD.width + 40;
      const targetY = Math.random()*WORLD.height;
      const dx = targetX - c.x;
      const dy = targetY - c.y;
      const dist = Math.hypot(dx,dy);
      if(dist < 12){
        // ازالة نهائية
        const idxT = tables.findIndex(tt => tt.id === c.tableId);
        if(idxT !== -1) tables[idxT].occupied = false;
        customers.splice(i,1);
      } else {
        c.x += (dx/dist) * c.speed * dt * 1.1;
        c.y += (dy/dist) * c.speed * dt * 1.1;
      }
    }
  }
}

// حركة اللاعب واصطدام خفيف
function updatePlayer(dt){
  let dx = 0, dy = 0;
  if(keys['arrowup'] || keys['w']) dy = -1;
  if(keys['arrowdown'] || keys['s']) dy = 1;
  if(keys['arrowleft'] || keys['a']) dx = -1;
  if(keys['arrowright'] || keys['d']) dx = 1;
  if(dx !== 0 || dy !== 0){
    const len = Math.hypot(dx,dy);
    dx /= len; dy /= len;
    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;
  }
  // قفل داخل العالم
  player.x = Math.max(20, Math.min(WORLD.width-20, player.x));
  player.y = Math.max(20, Math.min(WORLD.height-20, player.y));
  // تحديث الكاميرا لتتبع اللاعب (حدود) — smooth
  const camW = canvas.width, camH = canvas.height;
  const targetCamX = player.x - camW/2;
  const targetCamY = player.y - camH/2;
  camera.x += (targetCamX - camera.x) * 0.12;
  camera.y += (targetCamY - camera.y) * 0.12;
  camera.x = Math.max(0, Math.min(WORLD.width - camW, camera.x));
  camera.y = Math.max(0, Math.min(WORLD.height - camH, camera.y));
}

// رسم الخريطة الأساسية: أرضية، ممرات، واجهة (يمكن وضع صور لاحقًا)
function drawMap(){
  // أرضية موزّعة بنمط
  const startX = Math.floor(camera.x / TILE) * TILE;
  const startY = Math.floor(camera.y / TILE) * TILE;
  const endX = camera.x + canvas.width;
  const endY = camera.y + canvas.height;

  for(let y=startY; y<endY; y+=TILE){
    for(let x=startX; x<endX; x+=TILE){
      const ix = Math.floor(x/TILE);
      const iy = Math.floor(y/TILE);
      // بلاط متغير قليلاً
      const shade = ((ix+iy) % 2 === 0) ? '#f5ead3' : '#efe0c1';
      ctx.fillStyle = shade;
      ctx.fillRect(x - camera.x, y - camera.y, TILE, TILE);
    }
  }

  // بعض أكشاك أو عناصر ديكور على الأطراف (محاكاة شارع جزائري)
  ctx.fillStyle = '#b86b2c';
  ctx.fillRect(40 - camera.x, 40 - camera.y, 160, 40); // واجهة
  ctx.fillStyle = '#8a5a33';
  ctx.fillRect(WORLD.width - 220 - camera.x, 60 - camera.y, 200, 48);
}

// رسم الطاولات
function drawTables(){
  for(const t of tables){
    const sx = t.x - camera.x;const sy = t.y - camera.y;
    // سطح الطاولة
    ctx.fillStyle = t.occupied ? '#b74b4b' : '#7e6b4a';
    roundRect(ctx, sx - t.w/2, sy - t.h/2, t.w, t.h, 8, true, false);
    // رقم الطاولة
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('طاولة ' + (t.id+1), sx, sy + 4);
  }
}

// رسم الزبائن
function drawCustomers(){
  for(const c of customers){
    const sx = c.x - camera.x;
    const sy = c.y - camera.y;
    // جسم
    ctx.fillStyle = (c.state === 'waiting') ? '#2c3e50' : '#34495e';
    ctx.fillRect(sx - c.w/2, sy - c.h/2, c.w, c.h);
    // رأس
    ctx.beginPath();
    ctx.arc(sx, sy - c.h/2 - 8, 8, 0, Math.PI*2);
    ctx.fillStyle = '#f7d6b0';
    ctx.fill();
    // مؤشر الطلب فوق الرأس لو في انتظار
    if(c.state === 'waiting'){
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx - 18, sy - c.h - 26, 36, 22);
      ctx.fillStyle = '#000';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.order.name, sx, sy - c.h - 12);
    }
  }
}

// رسم اللاعب
function drawPlayer(){
  const sx = player.x - camera.x;
  const sy = player.y - camera.y;
  // ظل
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + player.h/2 + 4, player.w/2, 8, 0, 0, Math.PI*2);
  ctx.fill();

  // جسم
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(sx - player.w/2, sy - player.h/2, player.w, player.h);
  // وجه
  ctx.fillStyle = '#f7d6b0';
  ctx.fillRect(sx - 10, sy - player.h/2 - 10, 20, 12);
}

// أدوات مساعدة للرسم
function roundRect(ctx, x, y, w, h, r, fill, stroke){
  if (typeof stroke === 'undefined') stroke = true;
  if (typeof r === 'undefined') r = 5;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if(fill) ctx.fill();
  if(stroke) ctx.stroke();
}

// رسم كل شيء
function render(){
  // خلفية نظيفة
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // رسم الخريطة
  drawMap();

  // رسم طاولات
  drawTables();

  // زبائن
  drawCustomers();

  // لاعب في المقدمة
  drawPlayer();

  // لوحة صغيرة توضيحية (خريطة صغيرة)
  drawMiniMap();
}

// خريطة صغيرة تساعد اللاعب في التنقّل
function drawMiniMap(){
  const w = 160, h = 100;
  const px = canvas.width - w - 12, py = 12;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#fff';
  roundRect(ctx, px, py, w, h, 6, true, false);
  ctx.globalAlpha = 1;
  // حدود العالم على الخريطة المصغّرة
  ctx.strokeStyle = '#333';
  ctx.strokeRect(px+6, py+6, w-12, h-12);
  // موضع اللاعب كنقطة حمراء
  const mx = px + 6 + (player.x / WORLD.width) * (w-12);
  const my = py + 6 + (player.y / WORLD.height) * (h-12);
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.arc(mx, my, 4, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

// حلقة اللعبة
let lastTs = performance.now();
function gameLoop(ts){
  const dt = Math.min(0.05, (ts - lastTs) / 1000); // حد dt لضمان ثبات
  lastTs = ts;

  // توليد زبائن دوريًا
  lastSpawn += dt;
  if(lastSpawn >= spawnInterval){
    spawnCustomer();
    lastSpawn = 0;
  }

  // تحديثات
  updatePlayer(dt);
  updateCustomers(dt);

  // عداد اللعبة
  gameSeconds += dt;
  // توقيت HUD
  const minutes = Math.floor(gameSeconds/60);
  const seconds = Math.floor(gameSeconds%60).toString().padStart(2,'0');
  timeEl.textContent = ${minutes}:${seconds};

  // زيادة غضب العملاء (تم تضمينه كـ patience)
  // تحديث HUD كل إطار
  updateHUD();

  // رسم
  render();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

// تعليمات إضافية للمطوّر: دوال مفيدة لإضافة وظائف جديدة:
// - إضافة لوحة قائمة الطعام (menu) مع صور
// - نظام تحضير الطعام مع طباخ ومعدات (oven, stove) ووقت تحضير
// - حفظ حالة اللعب (localStorage)
// - إضافة أصوات وواجهات رسومية أفضل
// - استبدال المستطيلات بصور sprites: استبدال drawPlayer و drawCustomers

// حفظ تلقائي بسيط
setInterval(()=> {
  // يمكن حفظ score و time و settings في localStorage
  localStorage.setItem('resto-save', JSON.stringify({score, gameSeconds}));}, 10000);

// تحميل حفظ إن وُجد
try {
  const save = JSON.parse(localStorage.getItem('resto-save'));
  if(save){
    score = save.score || 0;
    gameSeconds = save.gameSeconds || 0;
    updateHUD();
  }
} catch(e){ /* ignore */ }
