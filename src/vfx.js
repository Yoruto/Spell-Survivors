// Original Canvas effects: Invoker-inspired silhouettes and color language, no extracted assets.
const TAU = Math.PI * 2;
const noise = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export class SpellVFX {
  constructor(renderer) { this.r = renderer; this.c = renderer.ctx; }
  foreground(f) {
    if (f.kind === 'WEE') { this.effect(f); return; }
    if (f.kind !== 'EEE' || !f.fired) return;
    const c = this.c, fade = Math.max(0, 1 - (f.age - f.delay) / .85); c.save(); c.globalAlpha = fade; c.globalCompositeOperation = 'lighter';
    const beam = c.createLinearGradient(f.x, f.y - 520, f.x, f.y); beam.addColorStop(0, '#ffb63b00'); beam.addColorStop(.4, '#ffb63b50'); beam.addColorStop(1, '#fff5cddd');
    c.fillStyle = beam; c.beginPath(); c.moveTo(f.x - 8, f.y - 520); c.lineTo(f.x + 8, f.y - 520); c.lineTo(f.x + 22 * fade, f.y); c.lineTo(f.x - 22 * fade, f.y); c.fill();
    this.glow(f.x, f.y - 3, 45, '#fff2bb', fade * .5); c.restore();
  }
  glow(x, y, radius, color, strength = .6) {
    const c = this.c; c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(x, y, 0, x, y, Math.max(1, radius));
    g.addColorStop(0, color + Math.round(strength * 255).toString(16).padStart(2, '0')); g.addColorStop(.35, color + '35'); g.addColorStop(1, color + '00');
    c.fillStyle = g; c.fillRect(x - radius, y - radius, radius * 2, radius * 2); c.restore();
  }
  ellipse(x, y, rx, ry, fill, stroke, width = 1) {
    const c = this.c; c.beginPath(); c.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, TAU); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
  }
  sparks(x, y, radius, t, color, count = 18, seed = 0, inward = false) {
    for (let i = 0; i < count; i++) {
      const a = noise(i + seed * 31) * TAU, phase = (t * (.6 + noise(i + 53)) + noise(i + 6)) % 1;
      const d = radius * (inward ? 1 - phase : phase), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * .65;
      this.r.line(px, py, px - Math.cos(a) * (3 + phase * 8), py - Math.sin(a) * (3 + phase * 8), color + Math.floor((1 - phase) * 210).toString(16).padStart(2, '0'), 1.3);
    }
  }
  bolt(x1, y1, x2, y2, seed, color = '#d5bcff', width = 1.5) {
    const c = this.c; c.beginPath(); c.moveTo(x1, y1);
    for (let i = 1; i < 9; i++) { const t = i / 8, j = (noise(seed + i * 11) - .5) * 18 * Math.sin(t * Math.PI); c.lineTo(x1 + (x2 - x1) * t + j, y1 + (y2 - y1) * t + j); }
    c.strokeStyle = color; c.lineWidth = width; c.stroke();
  }
  flames(x, y, scale, t, count = 9) {
    const c = this.c; c.save(); const alpha = c.globalAlpha;
    for (let i = 0; i < count; i++) {
      const phase = (t * 1.8 + noise(i + 13)) % 1, px = x + (noise(i + 21) - .5) * scale * 1.3, py = y - phase * scale * 1.6;
      const flameX = px + Math.sin(t * 7 + i) * 6, size = (1 - phase) * scale * .3 + 2;
      c.globalAlpha = alpha * (1 - phase) * .8; c.beginPath(); c.moveTo(flameX - size, py + size);
      c.bezierCurveTo(flameX - size * 1.5, py - size, flameX + size * .8, py - size * 1.4, flameX + Math.sin(t * 8 + i) * size, py - size * 3);
      c.bezierCurveTo(flameX + size * 2, py - size, flameX + size * 1.5, py + size, flameX - size, py + size);
      c.fillStyle = i % 2 ? '#ff8b22' : '#ffe092'; c.fill();
    } c.restore();
  }
  effect(f) {
    const c = this.c, r = this.r, t = f.age; c.save();
    if (f.kind === 'WWW') {
      const charge = Math.min(1, t / f.delay), orb = 9 + charge * 30, phase = Math.floor(t * 18);
      this.ellipse(f.x, f.y, f.radius, f.radius * .7, '#6f29a919', '#ae7edb88');
      if (!f.fired) {
        this.glow(f.x, f.y - 25, 65 + charge * 65, '#a465ff', .25 + charge * .5);
        this.ellipse(f.x, f.y - 25, orb, orb, '#28143ce6', '#d1afff', 2);
        for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + t * 1.7; this.bolt(f.x + Math.cos(a) * orb, f.y - 25 + Math.sin(a) * orb, f.x + Math.cos(a + .7) * f.radius * .85, f.y + Math.sin(a + .7) * f.radius * .55, phase + i * 17, '#bf91efaa'); }
        c.beginPath(); c.arc(f.x, f.y, f.radius, -.5 * Math.PI, -.5 * Math.PI + charge * TAU); c.strokeStyle = '#d6b0ff'; c.lineWidth = 2; c.stroke();
        this.sparks(f.x, f.y - 15, f.radius, t, '#dabaff', f.vortex ? 40 : 18, 27, true);
        if (f.vortex) for (let j = 0; j < 3; j++) { c.beginPath(); for (let i = 0; i < 65; i++) { const k = i / 64, a = k * TAU + t * 3 + j * TAU / 3, d = k * f.radius; const x = f.x + Math.cos(a) * d, y = f.y + Math.sin(a) * d * .65; if (!i) c.moveTo(x, y); else c.lineTo(x, y); } c.strokeStyle = '#ab84ec66'; c.lineWidth = 2; c.stroke(); }
      } else {
        const fade = Math.max(0, 1 - (t - f.delay) / (f.duration - f.delay)); c.globalAlpha = fade;
        this.glow(f.x, f.y, f.radius * 1.3, '#c391ff', fade);
        for (let i = 0; i < 2; i++) this.ellipse(f.x, f.y, Math.min(f.radius * 1.2, (t - f.delay) * 620 + i * 18), Math.min(f.radius * .8, (t - f.delay) * 400 + i * 12), null, i ? '#dbcbff' : '#9659e7', 3);
        this.sparks(f.x, f.y, f.radius * 1.3, t - f.delay, '#dac0ff', 32, 70);
      }
    } else if (f.kind === 'EEE') {
      const charge = Math.min(1, t / f.delay);
      this.ellipse(f.x, f.y, f.radius, f.radius * .7, '#d97b1019', '#fbc76eaa');
      if (!f.fired) {
        this.glow(f.x, f.y, f.radius * .8, '#ffa52c', charge * .5);
        this.ellipse(f.x, f.y, f.radius * (1 - charge * .55), f.radius * .7 * (1 - charge * .55), null, '#ffe6a5bb', 2);
        for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + t * .5; r.line(f.x + Math.cos(a) * f.radius * .85, f.y + Math.sin(a) * f.radius * .6, f.x + Math.cos(a) * f.radius * .7, f.y + Math.sin(a) * f.radius * .49, '#ffcf7acc', 2); }
        this.sparks(f.x, f.y, f.radius, t, '#ffd592', 16, 13, true);
      } else {
        const age = t - f.delay, fade = Math.max(0, 1 - age / .85);
        this.ellipse(f.x, f.y, f.radius * .8, f.radius * .55, '#31231fbb', '#b6602788');
        c.globalAlpha = fade; c.globalCompositeOperation = 'lighter';
        this.glow(f.x, f.y - 5, f.radius * 1.7, '#ffac30', fade); this.glow(f.x, f.y - 5, f.radius * .7, '#fff4c4', fade);
        this.ellipse(f.x, f.y, Math.min(f.radius * 1.4, 20 + age * 400), Math.min(f.radius, 12 + age * 270), null, '#ffe4a5', 3);
        this.flames(f.x, f.y, 55, age, 12); this.sparks(f.x, f.y, f.radius * 1.5, age, '#ffd384', 30, 17);
      }
    } else if (f.kind === 'WEE') {
      const height = t < f.delay ? (1 - t / f.delay) * 280 : 0;
      if (height > 0) this.ellipse(f.x, f.y, f.radius, f.radius * .55, '#cf712522', '#ffa44d88');
      else {
        // Charred, smouldering trail with the same fixed direction as the actual meteor.
        const length = Math.min(f.traveled, 160);
        for (let i = 0; i < 8; i++) { const back = length * i / 7, x = f.x - f.dx * back, y = f.y - f.dy * back; this.ellipse(x, y, 36 - i * 2, 22 - i, '#201c18aa', '#ad491c22'); this.flames(x, y, 19 - i, t + i * .1, 3); }
      }
      const x = f.x, y = f.y - height - 15;
      this.glow(x, y, 85, '#fa701e', .8); this.flames(x, y + 5, 48, t, 15);
      c.save(); c.translate(x, y); c.rotate(t * 3);
      c.beginPath();
      for (let i = 0; i < 14; i++) { const a = i * TAU / 14, radius = 27 + noise(i + 213) * 9; const px = Math.cos(a) * radius, py = Math.sin(a) * radius; if (!i) c.moveTo(px, py); else c.lineTo(px, py); } c.closePath();
      const rock = c.createRadialGradient(-12, -13, 1, 6, 8, 40); rock.addColorStop(0, '#aa542a'); rock.addColorStop(.5, '#542b1b'); rock.addColorStop(1, '#211a18'); c.fillStyle = rock; c.fill(); c.strokeStyle = '#ff9d37'; c.lineWidth = 2; c.stroke();
      for (let i = 0; i < 7; i++) { const a = i * TAU / 7; c.beginPath(); c.moveTo(Math.cos(a) * 31, Math.sin(a) * 31); c.lineTo(Math.cos(a + .15) * 20, Math.sin(a + .15) * 20); c.lineTo(Math.cos(a - .3) * 15, Math.sin(a - .3) * 15); c.lineTo(Math.cos(a + .2) * 8, Math.sin(a + .2) * 8); c.strokeStyle = '#ffba4b'; c.lineWidth = 2; c.stroke(); }
      this.glow(-7, -9, 20, '#ffad29', .7); c.restore();
      this.sparks(x, y, 85, t, '#ffb55e', 16, f.id || 1);
    } else if (f.kind === 'QQE') {
      const half = f.halfLength || 150, alpha = Math.min(1, (f.duration - t) * 2); c.globalAlpha = alpha;
      r.line(f.x - f.dx * half, f.y - f.dy * half, f.x + f.dx * half, f.y + f.dy * half, '#81d6ff22', 50);
      for (let i = -Math.floor(half / 17); i <= Math.floor(half / 17); i++) {
        const x = f.x + f.dx * i * 17, y = f.y + f.dy * i * 17, h = 28 + noise(i + 83) * 28;
        this.ellipse(x, y + 7, 22, 9, '#bcf0ff16'); c.beginPath(); c.moveTo(x - 9, y + 9); c.lineTo(x - 5, y - h * .4); c.lineTo(x + 1, y - h); c.lineTo(x + 10, y + 4); c.closePath();
        const ice = c.createLinearGradient(x, y - h, x, y + 9); ice.addColorStop(0, '#f1fcff'); ice.addColorStop(.45, '#9adffcaa'); ice.addColorStop(1, '#3678a477'); c.fillStyle = ice; c.fill(); c.strokeStyle = '#b4edff99'; c.lineWidth = .8; c.stroke();
        r.line(x + 1, y - h + 3, x + 1, y + 3, '#ebfbff88');
      } this.sparks(f.x, f.y, half, t * .3, '#c2f2ff', 20, 52);
    } else if (f.kind === 'danger') {
      r.circle(f.x, f.y, f.radius, f.fired ? '#ec799844' : '#ec799812', '#fa839ccc', 1.5);
      if (!f.fired) {
        const charge=Math.min(1,t/f.delay); c.beginPath(); c.arc(f.x, f.y, f.radius, -Math.PI / 2, -Math.PI / 2 + charge * TAU); c.strokeStyle = '#ff8ba3'; c.lineWidth = 3; c.stroke();
        r.circle(f.x,f.y,f.radius*(1-charge*.7),null,'#ff819b66');
        if(f.pattern==='axe'){
          c.save();c.translate(f.x,f.y);c.rotate((f.facing||0)+Math.PI*.25);r.line(0,26,0,-22,'#efab9b99',3);c.beginPath();c.moveTo(0,-24);c.quadraticCurveTo(20,-33,26,-15);c.lineTo(16,-4);c.quadraticCurveTo(9,-14,0,-12);c.closePath();c.fillStyle='#e48e7d55';c.fill();c.strokeStyle='#efab9b';c.lineWidth=1.5;c.stroke();c.restore();
          for(let i=0;i<4;i++){const a=i*TAU/4;r.line(f.x+Math.cos(a)*f.radius*.82,f.y+Math.sin(a)*f.radius*.82,f.x+Math.cos(a)*f.radius*.65,f.y+Math.sin(a)*f.radius*.65,'#ee9b83aa',2);}
        }else{for(let i=0;i<6;i++){const a=i*TAU/6;r.line(f.x+Math.cos(a)*f.radius*.7,f.y+Math.sin(a)*f.radius*.7,f.x+Math.cos(a+TAU/3)*f.radius*.7,f.y+Math.sin(a+TAU/3)*f.radius*.7,'#ee7b9444');}r.diamond(f.x,f.y,9,'#b8476f66','#ffadc1');}
      } else { const fade=Math.max(0,1-(t-f.delay)*2);this.glow(f.x,f.y,f.radius,f.pattern==='axe'?'#de704e':'#e56092',fade);this.sparks(f.x,f.y,f.radius*1.2,t-f.delay,'#ffb494',24,73);
        if(f.pattern==='axe'){c.save();c.translate(f.x,f.y);c.rotate(f.facing||0);r.line(-65,-18,65,18,'#ffc39c'+Math.floor(fade*220).toString(16).padStart(2,'0'),4);r.line(-50,-30,50,30,'#ffd2ad'+Math.floor(fade*160).toString(16).padStart(2,'0'),2);c.restore();}
      }
    } else if(f.kind==='death') {
      const progress=Math.min(1,t/f.duration),fade=1-progress;c.globalAlpha=fade;
      this.ellipse(f.x,f.y+8,f.radius*(1+progress),f.radius*.4,'#13101b55');
      for(let i=0;i<(f.boss?24:9);i++){const a=i*2.4+(f.seed||0),d=progress*(f.boss?100:35),x=f.x+Math.cos(a)*d,y=f.y+Math.sin(a)*d*.5-progress*14; r.diamond(x,y,Math.max(.1,(1-progress)*(f.boss?8:4)),i%2?'#bcad9f':f.color);}
      this.sparks(f.x,f.y,f.boss?140:50,t,f.color,12,f.seed);
    } else if (f.kind === 'beam') {
      const k = Math.min(1, t / .18), x = f.x + (f.tx - f.x) * k, y = f.y + (f.ty - f.y) * k - Math.sin(k * Math.PI) * 22;
      r.line(x, y, x - (f.tx - f.x) * .12, y - (f.ty - f.y) * .12, '#ffac5588', 3); this.glow(x, y, 15, '#ff8b25', .9); r.circle(x, y, 3, '#ffe0a2');
    } else if (['hit', 'frost-hit', 'ember-hit'].includes(f.kind)) {
      const color = f.kind === 'frost-hit' ? '#a9e4ff' : f.kind === 'ember-hit' ? '#ffb466' : '#dfebdc'; c.globalAlpha = Math.max(0, 1 - t / f.duration);
      if (f.kind === 'frost-hit') for (let i = 0; i < 5; i++) { const a = i * TAU / 5; r.diamond(f.x + Math.cos(a) * t * 110, f.y + Math.sin(a) * t * 85, 6, '#bceeff', '#f1ffff'); }
      else this.sparks(f.x, f.y, 55, t * 2, color, 8, f.seed);
    }
    c.restore();
  }
  projectile(s) {
    const c = this.c, r = this.r, t = r.game.time; c.save();
    if (s.kind === 'QWE') {
      c.globalCompositeOperation = 'lighter';
      if (s.radial) {
        for (let i = 0; i < 4; i++) { const radius = Math.max(1, s.traveled - i * 11 * ((s.ringWidth || 20) / 20)); r.circle(s.x, s.y, radius, null, ['#e7efffcc', '#abd8f688', '#d5bbf755', '#f3d7a522'][i], i ? 6 : 3); }
        this.sparks(s.x, s.y, s.traveled, t, '#b9e3ff', 32, 71);
      } else {
        c.translate(s.x, s.y); c.rotate(Math.atan2(s.dy, s.dx));
        for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(-i * 10, 0, 25, (62 - i * 6) * ((s.r || 65) / 65), 0, -Math.PI / 2, Math.PI / 2); c.strokeStyle = ['#f0f6ffdd', '#a9daff99', '#b0bfff77', '#dcb9e555', '#f7d4ac33'][i]; c.lineWidth = i ? 8 : 3; c.stroke(); }
        this.glow(0, 0, 55, '#a7d9ff', .25); this.sparks(0, 0, 66, t, '#d5f0ff', 14, 4);
      }
    } else {
      this.ellipse(s.x, s.y + 10, 32, 16, '#111b1d88');
      const h = 108;
      for (let i = 0; i < 19; i++) {
        const k = i / 18, y = s.y - k * h, width = (7 + k * 37) * ((s.r || 42) / 42), phase = t * 11 + i * .6;
        c.beginPath(); c.ellipse(s.x + Math.sin(phase) * 5, y, width, 4 + k * 8, 0, phase, phase + Math.PI * 1.6); c.strokeStyle = i % 3 ? '#c3c9d1b0' : '#f4f7eecc'; c.lineWidth = 2 + k * 2; c.stroke();
      }
      this.glow(s.x, s.y - 35, 58, '#b8d3d4', .16);
      for (let i = 0; i < 14; i++) { const phase = (t * .8 + noise(i)) % 1, a = t * 7 + i * 2, radius = 10 + phase * 40; r.diamond(s.x + Math.cos(a) * radius, s.y - phase * h + Math.sin(a) * 5, 2 + noise(i + 10) * 2, i % 2 ? '#a6ba9a' : '#d9e1d3'); }
    } c.restore();
  }
  aura(unit) {
    const c = this.c, r = this.r, t = r.game.time; c.save();
    if (unit.ghost > 0) {
      this.ellipse(unit.x, unit.y + 12, 60, 30, '#78c4d812', '#a1d9ed33');
      for (let i = 0; i < 8; i++) { const a = t * .5 + i * TAU / 8; this.glow(unit.x + Math.cos(a) * 35, unit.y + Math.sin(a) * 15 - 4, 22, '#97d6e8', .07); }
      this.sparks(unit.x, unit.y, 55, t * .4, '#c4f3ff', 12, 33);
    }
    if (unit.buff > 0) {
      this.glow(unit.x, unit.y, 45, '#e9b7ef', .18);
      for (let i = 0; i < 3; i++) { const a = t * 4 + i * TAU / 3, x = unit.x + Math.cos(a) * 23, y = unit.y + Math.sin(a) * 12 - 14; this.bolt(x, y, x + Math.sin(t * 6 + i) * 12, y - 35, i + Math.floor(t * 12), '#e3b6f2cc', 1.7); }
    } c.restore();
  }
  spirit(a) {
    const c = this.c, r = this.r, t = r.game.time; c.save();
    this.ellipse(a.x, a.y + 15, 19, 8, '#100d0a77'); this.glow(a.x, a.y - 3, 50, '#ff7922', .3); this.flames(a.x, a.y - 2, 25, t + a.id, 12);
    const shell=c.createLinearGradient(a.x-10,a.y-14,a.x+10,a.y+15);shell.addColorStop(0,'#805331');shell.addColorStop(1,'#2c2523');
    c.fillStyle = shell; c.beginPath(); c.moveTo(a.x - 9, a.y + 15); c.lineTo(a.x - 17, a.y - 5); c.lineTo(a.x - 7, a.y - 16); c.lineTo(a.x + 8, a.y - 16); c.lineTo(a.x + 17, a.y - 5); c.lineTo(a.x + 9, a.y + 15); c.lineTo(a.x,a.y+11); c.closePath(); c.fill(); c.strokeStyle='#c48c53';c.lineWidth=1;c.stroke();
    this.glow(a.x, a.y - 3, 12, '#ffbf45', .8); r.diamond(a.x, a.y - 3, 6, '#ffb74d','#ffdea1');
    this.ellipse(a.x,a.y-16,8,7,'#45302a','#9b754b');r.line(a.x-5,a.y-17,a.x-1,a.y-17,'#fff0bc',2);r.line(a.x+1,a.y-17,a.x+5,a.y-17,'#fff0bc',2);
    for(const side of[-1,1]){r.line(a.x+side*11,a.y-7,a.x+side*20,a.y+4,'#8c5e37',6);r.circle(a.x+side*20,a.y+4,4,'#382d27','#c38a44');this.flames(a.x+side*20,a.y+3,9,t+a.id+side,3);r.line(a.x+side*5,a.y+5,a.x+side*10,a.y+12,'#f9b552',1);}
    c.fillStyle = '#293b29'; c.fillRect(a.x - 15, a.y - 35, 30, 3); c.fillStyle = '#d3bf84'; c.fillRect(a.x - 15, a.y - 35, 30 * a.hp / a.maxHp, 3); this.aura(a); c.restore();
  }
}
