import { EnemyArt } from './enemies.js';
// Layered, animated vector models. World positions and hitboxes stay in the combat engine.
const TAU = Math.PI * 2;
const ELEMENTS = { Q: ['#83dcff', '#286caa'], W: ['#c49aff', '#60399b'], E: ['#ffc174', '#b64e23'] };
export class ActorArt {
  constructor(renderer) { this.r = renderer; this.c = renderer.ctx; this.fx = renderer.vfx; this.enemies = new EnemyArt(this); }
  path(points, fill, stroke, width = 1) {
    const c = this.c; c.beginPath(); points.forEach(([x,y], i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.lineJoin = 'round'; c.stroke(); }
  }
  gradient(x, y, radius, light, dark) { const g = this.c.createRadialGradient(x - radius * .3, y - radius * .4, 0, x, y, radius); g.addColorStop(0, light); g.addColorStop(1, dark); return g; }
  orb(x, y, element, radius = 6, alpha = 1) {
    const c = this.c, r = this.r, [color, dark] = ELEMENTS[element]; c.save(); c.globalAlpha *= alpha;
    this.fx.glow(x, y, radius * 3.6, color, .36); r.circle(x,y,radius,this.gradient(x,y,radius,'#fff9f0',dark),color,1);
    if (element === 'Q') { for (let i=0;i<3;i++) { const a=i*Math.PI/3; r.line(x-Math.cos(a)*radius*.65,y-Math.sin(a)*radius*.65,x+Math.cos(a)*radius*.65,y+Math.sin(a)*radius*.65,'#d9fbffcc',1); } }
    else if (element === 'W') { c.beginPath(); c.moveTo(x+2,y-radius*.65); c.lineTo(x-2,y+1); c.lineTo(x+2,y); c.lineTo(x-2,y+radius*.65); c.strokeStyle='#f7e9ff'; c.lineWidth=1.2; c.stroke(); }
    else { c.beginPath(); c.moveTo(x,y-radius*.8); c.bezierCurveTo(x-radius,y,x-radius*.4,y+radius*.7,x+1,y+radius*.6); c.bezierCurveTo(x+radius,y+radius*.4,x+radius*.3,y-radius*.3,x,y-radius*.8); c.fillStyle='#fff1ba'; c.fill(); }
    r.circle(x-radius*.3,y-radius*.4,radius*.2,'#ffffffcc'); c.restore();
  }
  hero(p) {
    const c=this.c,r=this.r,t=p.stasis>0?p.stasisPoseTime:r.game.time, walking=!!p.target&&!(p.stasis>0), stride=walking?Math.sin(p.walk||0):0, bob=walking?Math.abs(stride)*1.8:Math.sin(t*2)*.65;
    this.fx.aura(p); this.fx.ellipse(p.x,p.y+18,23,8,'#060c166f');
    this.fx.ellipse(p.x,p.y+18,25,10,null,'#e2c88a55');
    const spheres=[0,1,2].map(i=>{const a=t*1.2+i*TAU/3;return {x:Math.cos(a)*31,y:-23+Math.sin(a)*17,element:r.game.queue[i]||['Q','W','E'][i],alpha:r.game.queue[i]?1:.48};});
    c.save();c.translate(p.x,p.y);c.globalAlpha=p.ghost>0?.4:p.invulnerable>0?.65:1;
    for(const s of spheres) if(s.y<-23)this.orb(s.x,s.y,s.element,5.2,s.alpha);
    c.save();c.translate(0,-bob);if(Math.cos(p.facing||0)<0)c.scale(-1,1);
    // Cloak, boots, and gold-edged tabard.
    c.beginPath();c.moveTo(-10,-13);c.bezierCurveTo(-22,-4,-22+stride*2,18,-26,22);c.quadraticCurveTo(-9,30,0,23);c.quadraticCurveTo(15,29,26,22);c.bezierCurveTo(20-stride*2,5,20,-4,10,-13);c.closePath();
    const cloak=c.createLinearGradient(-20,-8,20,24);cloak.addColorStop(0,'#aa72ba');cloak.addColorStop(.45,'#654286');cloak.addColorStop(1,'#30213f');c.fillStyle=cloak;c.fill();c.strokeStyle='#c7a676';c.lineWidth=1.4;c.stroke();
    this.path([[-12,12],[-13,22+stride*2],[-3,24+stride*2],[-2,12]],'#252136','#b49464');
    this.path([[3,12],[3,24-stride*2],[13,22-stride*2],[11,12]],'#252136','#b49464');
    this.path([[-11,-12],[-15,17],[0,21],[15,17],[11,-12]],'#674581','#d6b57f',1.5);
    this.path([[-5,-11],[-5,16],[0,12],[5,16],[5,-11]],'#ddc18b');
    r.line(0,-8,0,11,'#53376e',2.4);r.line(-11,7,11,7,'#e2c58d',2);r.diamond(0,7,3,'#b08ae0','#ffdf97');
    const cast=p.casting>0?Math.sin(Math.min(1,p.casting/.4)*Math.PI)*7:0;
    // Raised collar and broad pauldrons frame the oversized, expressive head.
    this.path([[-7,-13],[-18,-19],[-23,-9],[-12,-2],[-6,-7]],'#c9bbd0','#f1d6a2',1.3);
    this.path([[7,-13],[18,-19],[23,-9],[12,-2],[6,-7]],'#c9bbd0','#f1d6a2',1.3);
    this.path([[-14,-7],[-21,1-cast],[-16,7-cast],[-7,-3]],'#765193','#c9a671');
    this.path([[14,-7],[24,1-cast],[19,8-cast],[8,-3]],'#765193','#c9a671');
    r.circle(-20,3-cast,4,'#efcdb9','#be979d');r.circle(23,3-cast,4,'#efcdb9','#be979d');
    this.path([[-12,-15],[-12,-24],[0,-15],[12,-24],[12,-15],[0,-6]],'#35213e','#e3c38a',1.5);
    r.circle(0,-28,14,this.gradient(0,-28,16,'#ffe7d5','#cfa1aa'),'#ae859b');
    r.circle(-14,-26,3,'#e7bfba');r.circle(14,-26,3,'#e7bfba');
    // Swept ivory hair, not a hood or staff silhouette.
    this.path([[-14,-24],[-19,-38],[-13,-38],[-15,-46],[-7,-44],[-5,-53],[2,-47],[11,-54],[12,-46],[23,-48],[18,-39],[23,-37],[14,-24],[12,-38],[5,-41],[-1,-29],[-5,-38],[-11,-32],[-12,-21]],this.gradient(0,-42,23,'#fff9e5','#b6abcd'),'#bcaec9',1);
    r.line(-10,-43,-4,-47,'#ffffffaa',1);r.line(5,-43,13,-48,'#ffffffaa',1);
    r.line(-9,-27,-4,-25,'#7e587c',1.5);r.line(4,-25,9,-27,'#7e587c',1.5);
    this.fx.ellipse(-6,-22,1.8,3,'#75418f');this.fx.ellipse(6,-22,1.8,3,'#75418f');r.circle(-5.6,-23, .7,'#fff');r.circle(6.4,-23,.7,'#fff');
    this.fx.ellipse(-9,-18,3,1.5,'#e8a7aa55');this.fx.ellipse(9,-18,3,1.5,'#e8a7aa55');
    c.beginPath();c.moveTo(-2,-16);c.quadraticCurveTo(1,-14,4,-17);c.strokeStyle='#a66d83';c.lineWidth=1;c.stroke();r.diamond(0,-8,3.4,'#c5a0f3','#ffe2a6');
    if(p.casting>0){this.fx.glow(24,1-cast,24,p.castColor||'#dab6ff',p.casting);r.circle(24,1-cast,7,null,(p.castColor||'#dab6ff')+'bb');}
    c.restore();
    for(const s of spheres)if(s.y>=-23)this.orb(s.x,s.y,s.element,5.2,s.alpha);
    if(p.casting>0){const progress=1-p.casting/.4;this.fx.ellipse(0,17,25+progress*22,10+progress*9,null,(p.castColor||'#dab6ff')+Math.round(p.casting/.4*160).toString(16).padStart(2,'0'),1.5);}
    c.restore();
  }
  enemy(e) {
    const c=this.c,r=this.r,t=r.game.time; c.save();
    if(e.flash>0)c.filter='brightness(1.65)';
    this.enemies.draw(e);
    c.restore();
  }
  heroBeacon(p) {
    const c=this.c,r=this.r;c.save();c.globalAlpha=p.ghost>0?.35:.8;
    // A thin silhouette remains readable when foreground spells pass over the player.
    r.circle(p.x,p.y-28,15,null,'#f5ddff',1.2);
    c.beginPath();c.moveTo(p.x-13,p.y-10);c.lineTo(p.x-20,p.y+20);c.quadraticCurveTo(p.x,p.y+27,p.x+20,p.y+20);c.lineTo(p.x+13,p.y-10);c.strokeStyle='#e6c8ff';c.lineWidth=1.2;c.stroke();
    this.fx.ellipse(p.x,p.y+18,28,11,null,'#f1dba5',1.5);c.font='500 9px sans-serif';c.textAlign='center';c.fillStyle='#f9e8ff';c.fillText('小卡尔',p.x,p.y-61);c.restore();
  }
  enemyProjectile(s) { this.enemies.projectile(s); }
}
