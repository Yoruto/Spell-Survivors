// MOBA lane-creep silhouettes and a heavy axe commander, drawn as original vector art.
const TAU = Math.PI * 2;
export class EnemyArt {
  constructor(art) { this.art=art; this.c=art.c; this.r=art.r; this.fx=art.fx; }
  path(...args) { this.art.path(...args); }
  gradient(...args) { return this.art.gradient(...args); }
  draw(e) { const t=this.r.game.time; if(e.bossType==='timber')this.timber(e,t);else if(e.boss)this.commander(e,t);else if(e.kind==='ranged')this.caster(e,t);else { if(e.kind==='elite')this.c.scale(1.15,1.15);this.soldier(e,t); } }
  timber(e,t) {
    const c=this.c,r=this.r,hot=e.ai?.overheat>0,accent=hot?'#a1ebff':e.ai?.enraged?'#ff9258':'#f4c27a';
    this.fx.ellipse(0,25,58,21,'#10151888',accent+'88',2);
    // Wide circular chassis, hydraulic arms and a visible pilot distinguish it from the commander.
    for(const side of[-1,1]){
      this.path([[side*21,-9],[side*42,-18],[side*61,4],[side*48,25],[side*29,13]],'#4d5558','#c8ad84',2);
      r.circle(side*44,-2,10,'#303d43',accent,2);r.line(side*30,-15,side*50,5,'#c1cbd0',4);
      r.line(side*27,19,side*37,34,'#39464c',10);r.line(side*22,35,side*47,35,'#a99c7c',7);
    }
    this.fx.ellipse(0,-4,39,40,this.gradient(-16,-18,65,'#c39963','#343c42'),accent,3);
    this.fx.ellipse(0,-10,28,26,'#253e48','#b4a688',3);
    r.circle(0,-19,13,'#a4b985','#e4d4a7',1.5);
    this.path([[-17,-28],[-12,-40],[11,-40],[18,-28]],'#775a40','#e1b780',2);
    this.path([[-13,-27],[13,-27],[13,-17],[-13,-17]],'#2a3839','#c9ac79',2);
    r.circle(-6,-23,4,accent);r.circle(6,-23,4,accent);r.line(-5,-10,6,-10,'#584e38',2);
    this.path([[-17,2],[17,2],[23,22],[-23,22]],'#5c675d','#d0b389',2);
    for(let i=0;i<3;i++)r.line(-12,7+i*5,12,7+i*5,'#202d32',2);
    c.save();c.translate(0,24);c.rotate(t*(e.ai?.action?.kind==='spin'?20:5));
    c.beginPath();for(let i=0;i<32;i++){const a=i*TAU/32,rad=i%2?22:29;if(i===0)c.moveTo(Math.cos(a)*rad,Math.sin(a)*rad*.55);else c.lineTo(Math.cos(a)*rad,Math.sin(a)*rad*.55);}c.closePath();c.fillStyle='#b6b9ac';c.fill();c.strokeStyle=accent;c.lineWidth=2;c.stroke();r.circle(0,0,8,'#8d603b',accent,2);c.restore();
    for(let i=0;i<(e.ai?.armor||0);i++){const a=-Math.PI+i*Math.PI/4;r.circle(Math.cos(a)*43,Math.sin(a)*33-7,5,'#f7ca7b','#fff2ce',1);}
    if(hot){this.fx.glow(0,0,70,'#8ceaff',.25);this.fx.sparks(0,-20,65,t,'#cff6ff',10,4);}
    if(e.casting>0)this.fx.ellipse(0,27,60,25,null,accent,2);
  }
  soldier(e,t) {
    const c=this.c,r=this.r,step=Math.sin(e.walk||0)*2.5,swing=Math.sin(Math.min(1,(e.swing||0)/.3)*Math.PI),charger=e.kind==='charger';
    const action=e.brain?.action,windup=action?.kind==='melee'?1-action.left/action.duration:0;
    if(Math.cos(e.facing||0)<0)c.scale(-1,1);
    c.translate(0,-Math.abs(step)*.3);
    // Red tabard and two plated marching boots: deliberately upright and bipedal.
    this.path([[-9,-7],[-13,11],[-7,16],[0,13],[9,16],[13,10],[8,-7]],'#742d37','#a45553');
    this.path([[-10,7],[-10,16+step],[-2,17+step],[-1,7]],'#363841','#a6a4a2');
    this.path([[2,7],[2,17-step],[11,16-step],[10,7]],'#363841','#a6a4a2');
    r.line(-8,12+step,-3,12+step,'#737b87',1);r.line(4,12-step,9,12-step,'#737b87',1);
    this.path([[-10,-11],[-9,6],[0,11],[10,5],[11,-11],[0,-17]],this.gradient(-3,-6,20,'#8992a0','#3c404b'),'#b3b6b8',1.1);
    this.path([[-3,-9],[-3,8],[0,5],[4,8],[4,-9]],'#b3464e');
    r.line(-8,2,8,2,'#30272c',2);r.diamond(0,2,2.2,'#d7ad73');
    for(const side of[-1,1]){this.path([[side*7,-12],[side*14,-14],[side*18,-7],[side*11,-3]],'#59606e','#c2b9aa');r.circle(side*13,-9,1.3,'#cfb489');}
    // Compact steel helmet, red plume and a warm eye slit.
    this.path([[-10,-13],[-12,-24],[-7,-31],[6,-32],[12,-25],[11,-12],[4,-8],[-6,-9]],this.gradient(-5,-24,20,'#a0a4ac','#46434d'),'#c3b9ad',1.2);
    this.path([[-2,-30],[-4,-39],[5,-38],[9,-31],[4,-29]],charger?'#dcb06a':'#a94049','#c46262');
    this.path([[-9,-23],[9,-23],[8,-17],[-7,-16]],'#20212a','#76727a');
    r.line(-5,-20,-1,-20,'#f9d59c',1.4);r.line(3,-20,6,-20,'#f9d59c',1.4);r.line(1,-24,1,-12,'#a9a5a3',2);
    // Sword arm swings only when a real melee attack has committed.
    c.save();c.translate(13,-4);c.rotate(charger?Math.PI*.5:-.3-swing*1.1+windup*.9);r.line(0,0,6,3,'#6d5360',5);r.circle(7,3,3,'#b99482');
    if(charger){r.line(9,23,9,-53,'#b39468',4);this.path([[4,-48],[9,-65],[14,-48],[9,-43]],'#ead1a0','#fff2cc',1);}
    else {r.line(9,9,9,-19,'#312e36',3);this.path([[7,-12],[7,-31],[10,-37],[13,-31],[12,-12]],'#c1cbd1','#edf0de',.8);r.line(4,-10,16,-10,'#d1ad71',2);r.line(9,-30,9,-14,'#eef6f3',1);}
    c.restore();
    // Broad shield makes the melee role legible even in a crowded wave.
    if(!charger){r.line(-10,-5,-17,1,'#4b414b',5);
    this.path([[-27,-9],[-16,-13],[-8,-7],[-9,8],[-17,16],[-26,7]],this.gradient(-23,-4,24,'#b75558','#642b39'),'#d0b68b',1.5);
    r.line(-18,-10,-18,11,'#b9b4b2',2);r.line(-25,-2,-10,-2,'#b9b4b2',1.6);r.diamond(-18,-1,3.6,'#b7b8ba','#ede2c2');
    for(const [x,y]of[[-24,-6],[-12,-5],[-24,5],[-13,5]])r.circle(x,y,.9,'#e0d0ad');}
    if(swing>.1){c.beginPath();c.arc(13,-9,28,-2.3,-.7);c.strokeStyle='#f5dfae66';c.lineWidth=2;c.stroke();}
  }
  caster(e,t) {
    const c=this.c,r=this.r,step=Math.sin(e.walk||0)*1.3,action=e.brain?.action;
    const cast=action?.kind==='bolt' ? .25+.75*(1-action.left/action.duration) : action?.kind==='recharge' ? .3+.15*Math.sin(t*6) : e.casting>0?Math.sin(Math.min(1,e.casting/.45)*Math.PI):0;
    if(Math.cos(e.facing||0)<0)c.scale(-1,1);
    c.translate(0,-Math.abs(step)*.4);
    // Matching red-team mage creep: short robe, hood and a tall crystal staff.
    this.path([[-7,8],[-8,17+step],[-1,17+step],[0,7]],'#332c36','#8d7070');
    this.path([[2,7],[2,17-step],[9,17-step],[8,8]],'#332c36','#8d7070');
    this.path([[-8,-13],[-16,14],[-7,18],[0,15],[8,18],[16,12],[8,-13]],this.gradient(-7,-8,31,'#a94b58','#572836'),'#c49d7c',1.1);
    this.path([[-2,-11],[-4,13],[0,17],[5,13],[3,-11]],'#d7b983');r.line(-12,10,11,10,'#c59c72',1);
    this.path([[-11,-11],[-13,-24],[-7,-32],[0,-39],[11,-29],[14,-13],[0,-5]],this.gradient(-7,-27,25,'#bf626a','#752d41'),'#c6a581',1.2);
    this.path([[-8,-20],[-5,-27],[4,-27],[9,-20],[6,-12],[-5,-12]],'#292230');
    r.line(-5,-20,-1,-19,'#ffe4a5',1.5);r.line(3,-19,7,-20,'#ffe4a5',1.5);
    r.line(-8,-29,5,-34,'#e1b990',1);
    this.path([[-8,-12],[-14,-13],[-18,-3],[-9,2]],'#8a394c','#c09e7d');
    r.line(-14,-4,-20,-7-cast*9,'#a86468',4);r.circle(-21,-7-cast*9,3,'#d5ad94');
    if(cast>0){this.fx.glow(-23,-16,21,'#ffb382',cast*.55);r.diamond(-23,-16,4+cast*3,'#ffe0b1','#ed9972');}
    // Staff silhouette replaces the previous floating cultist/book silhouette.
    c.save();c.translate(17,1);c.rotate(.12-cast*.12);r.line(0,18,0,-35,'#654f41',3.6);r.line(-1,14,-1,-31,'#bc9464',1);
    this.path([[-7,-34],[-7,-43],[0,-49],[7,-43],[7,-34],[0,-30]],'#a78660','#e2c99b');
    r.diamond(0,-40,6,this.gradient(0,-40,7,'#ffe5c4','#d66e60'),'#ffe2ab');this.fx.glow(0,-40,cast?24:12,'#ef9a79',cast?.55:.2);
    r.line(-5,-28,5,-28,'#d1b783',2);r.circle(-1,-3,3,'#d5ad94');c.restore();
    if(e.mana!==null){r.line(-12,24,12,24,'#302733',2);r.line(-12,24,-12+24*e.mana/100,24,'#ce839d',2);}
  }
  greatAxe(x,y,angle,rage=false) {
    const c=this.c,r=this.r;c.save();c.translate(x,y);c.rotate(angle);
    r.line(0,48,0,-55,'#302c30',7);r.line(-1,46,-1,-55,'#b3a48e',2);r.circle(0,48,4,'#8a7870','#d9bd8c');
    for(let i=0;i<6;i++)r.line(-3,8+i*5,3,11+i*5,'#9c7460',2);
    // Heavy crescent blade with a silver cutting edge and a deep red steel spine.
    c.beginPath();c.moveTo(3,-56);c.bezierCurveTo(18,-68,41,-64,48,-43);c.lineTo(34,-22);c.quadraticCurveTo(18,-37,4,-34);c.closePath();
    const metal=c.createLinearGradient(4,-40,48,-46);metal.addColorStop(0,'#742d3a');metal.addColorStop(.55,'#5b5c67');metal.addColorStop(.83,'#9da6ae');metal.addColorStop(1,'#ebede3');c.fillStyle=metal;c.fill();c.strokeStyle='#d3c9b6';c.lineWidth=1.6;c.stroke();
    c.beginPath();c.moveTo(28,-63);c.quadraticCurveTo(43,-60,48,-43);c.lineTo(34,-22);c.strokeStyle='#f4eee0';c.lineWidth=3;c.stroke();
    this.path([[-4,-55],[-21,-59],[-30,-44],[-20,-31],[-5,-34]],'#4b414b','#bcae9e',1.5);
    this.path([[3,-50],[15,-50],[19,-42],[5,-39]],'#9d3944','#c06a68');r.circle(0,-44,5,'#7e5b4b','#dcc79d');
    if(rage){this.fx.glow(26,-44,38,'#ff704c',.24);this.fx.sparks(26,-44,39,this.r.game.time,'#ffaf72',8,29);}
    c.restore();
  }
  commander(e,t) {
    const c=this.c,r=this.r,rage=e.hp<e.maxHp*.5,cast=e.casting>0?Math.sin(Math.min(1,e.casting/1.1)*Math.PI):0,step=Math.sin(e.walk||0)*2,accent=rage?'#ff7955':'#cf6c5b';
    if(Math.cos(e.facing||0)<0)c.scale(-1,1);
    this.fx.ellipse(0,32,52,20,'#1b101355','#c15b4c66',1.3);
    for(let i=0;i<4;i++)r.diamond(-24+i*16,44,5,i<(e.ai?.rage||0)?'#ff9167':'#4b3434','#cc8866');
    if(rage)this.fx.glow(0,-4,77,'#d94835',.13);
    // Dark red war cloak and steel greaves; broad human shoulders, no skull or horns.
    c.beginPath();c.moveTo(-29,-41);c.bezierCurveTo(-41,-18,-34,17,-43,44);c.lineTo(-22,38);c.lineTo(-12,47);c.lineTo(1,39);c.lineTo(19,46);c.lineTo(34,36);c.lineTo(44,42);c.bezierCurveTo(35,10,40,-20,27,-41);c.closePath();c.fillStyle=this.gradient(-21,-10,68,'#973c45','#3b202c');c.fill();c.strokeStyle='#b56961';c.lineWidth=1.5;c.stroke();
    for(const [side,shift]of[[-1,step],[1,-step]]){
      this.path([[side*7,13],[side*9,36+shift],[side*29,40+shift],[side*33,34+shift],[side*23,10]],this.gradient(side*18,24,27,'#646977','#292b37'),'#b6ada2',1.3);r.line(side*10,28+shift,side*25,30+shift,'#92949c',2);
    }
    this.path([[-28,-35],[-27,-3],[-17,23],[0,28],[18,22],[28,-6],[28,-35],[0,-44]],this.gradient(-12,-28,62,'#84838b','#30323e'),'#c5b5a8',1.6);
    for(const side of[-1,1]){this.path([[side*2,-30],[side*23,-33],[side*24,-18],[side*5,-11]],'#45434e','#a89b96');r.line(side*5,-27,side*21,-29,'#d2b8a2',1);r.line(side*8,-7,side*21,-13,'#a16b62',2);r.line(side*8,4,side*20,-1,'#7c7780',2);}
    this.path([[-6,-32],[-3,12],[6,14],[11,-31]],'#9f3c45','#c77a70');r.line(-22,12,22,12,'#392e32',7);this.path([[-6,8],[5,7],[9,15],[0,19],[-8,15]],'#8f7355','#ddbc81',1.5);
    // Bulky pauldrons with steel spikes echo heavy frontline fighters.
    for(const side of[-1,1]){
      this.path([[side*22,-37],[side*35,-48],[side*47,-38],[side*47,-24],[side*31,-18],[side*24,-24]],this.gradient(side*31,-34,30,'#8a8790','#393842'),'#c1b0a3',1.5);
      for(let i=0;i<3;i++)this.path([[side*(28+i*6),-40],[side*(28+i*6),-51-(i%2)*3],[side*(34+i*5),-38]],'#b5b1ae','#e0d3bd');
      r.circle(side*34,-30,2,'#dbb28b');
    }
    // Bare, muscular forearms and heavy gauntlets gripping the axe with both hands.
    this.path([[-35,-21],[-43,-4],[-27,9],[-14,3],[-19,-5],[-29,-12]],rage?'#ca7c68':'#b68b7d','#d9b39a',1.2);
    this.path([[35,-21],[44,-5-cast*10],[30,7-cast*15],[17,0-cast*12],[21,-9],[28,-13]],rage?'#ca7c68':'#b68b7d','#d9b39a',1.2);
    this.path([[-31,-2],[-22,-6],[-12,2],[-18,12],[-28,8]],'#4d4650','#b99a88',1.3);
    const axeY=1-cast*28,axeAngle=.45-cast*.75+(e.swing>0?Math.sin(e.swing/.3*Math.PI)*.5:0);
    this.greatAxe(18,axeY,axeAngle,rage);
    r.circle(12,5-cast*13,5,'#aa8b7b','#dfbfa3');r.circle(24,-17-cast*15,5,'#aa8b7b','#dfbfa3');
    // Human face, cropped black hair, thick brows and a forked warrior beard.
    r.line(-6,-38,-6,-31,'#bb9783',5);r.line(6,-38,6,-31,'#bb9783',5);
    this.path([[-14,-63],[-13,-43],[-7,-34],[7,-34],[14,-45],[13,-63],[0,-70]],this.gradient(-6,-57,31,'#e0b49a',rage?'#a85046':'#8d615b'),'#c09683',1.2);
    this.path([[-15,-54],[-17,-65],[-11,-74],[1,-77],[13,-70],[16,-56],[9,-61],[5,-68],[-4,-65],[-11,-64]],'#30282d','#51404a');
    this.path([[-13,-47],[-9,-40],[-4,-41],[0,-43],[6,-41],[12,-47],[9,-35],[3,-31],[-1,-34],[-6,-31],[-12,-38]],'#382a2d','#594049');
    r.line(-10,-55,-3,-53,'#423039',2.5);r.line(3,-53,10,-55,'#423039',2.5);r.line(-9,-51,-4,-51,rage?'#ffb58f':'#ecd6b7',1.3);r.line(4,-51,9,-51,rage?'#ffb58f':'#ecd6b7',1.3);
    r.line(-1,-51,-3,-45,'#895b58',1);r.line(-4,-42,5,-42,'#d5b09a',1);r.line(9,-59,7,-44,'#8d514e',1);r.line(10,-56,8,-55,'#c6a090',1);
    if(cast>0){this.fx.ellipse(0,31,50+cast*15,20+cast*6,null,accent+'aa',2);this.fx.sparks(0,5,65,t,accent,13,9,true);}
    if(e.spawn>0){const fade=e.spawn/1.5;this.fx.ellipse(0,32,55+(1-fade)*38,22+(1-fade)*16,null,accent+Math.floor(fade*200).toString(16).padStart(2,'0'),3);}
    if(e.swing>0){c.beginPath();c.ellipse(18,5,72,30,.2,-1.6,.8);c.strokeStyle='#ffb89a66';c.lineWidth=4;c.stroke();}
  }
  projectile(s) {
    const c=this.c,r=this.r,t=r.game.time;c.save();
    if(s.kind==='axe'){
      r.line(s.x,s.y,s.x-s.dx*22,s.y-s.dy*22,'#e1745366',s.r*1.5);this.fx.glow(s.x,s.y,s.r*3,'#e47b51',.2);
      c.translate(s.x,s.y);c.rotate(t*12+(s.dx+s.dy)*3);c.scale(.21,.21);this.greatAxe(0,7,0,false);
    }else{
      r.line(s.x,s.y,s.x-s.dx*20,s.y-s.dy*20,'#d06b7766',s.r);this.fx.glow(s.x,s.y,s.r*3,'#ed9c81',.3);r.circle(s.x,s.y,s.r,this.gradient(s.x,s.y,s.r,'#fff0cc','#ad5868'),'#f4ba9a');
      r.circle(s.x-1,s.y-1,1.5,'#fff0d4');
    }c.restore();
  }
}
