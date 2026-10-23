import { shopHTML, routeHTML, eventHTML } from './progression-view.js';
import { RUN_RULES } from './run.js';
import { Game, resolveSpell } from './game.js';
import { Renderer } from './renderer.js';
import { EQUIPMENT, equipmentById } from './equipment.js';
import { bossStatus } from './bosses.js';
import { SPELLS, HERO, RELICS, spellRelics } from './config.js';
const $ = id => document.getElementById(id);
const game = new Game(), canvas = $('arena'), renderer = new Renderer(canvas, game);
const colors = { Q: '#83dcff', W: '#b49aff', E: '#ffb17f' }, symbols = { Q: '❄', W: 'ϟ', E: '♨' };
const formatTime = t => `${Math.floor(t / 60).toString().padStart(2, '0')}:${Math.floor(t % 60).toString().padStart(2, '0')}`;
let rightDown = false, lastState = '', modal = null, soundOn = false, audio, inventoryKey = '';
let startingEquipment = 'blink', shopPage = 0;
function loadoutHTML() {
  return `<div class="loadout"><span class="eyebrow">选择初始装备 · 主动 / 被动共用单槽 · 免费携带一件</span><div class="loadout-options">${EQUIPMENT.map(item => `<button data-loadout="${item.id}" aria-pressed="${startingEquipment === item.id}" class="${startingEquipment === item.id ? 'selected' : ''}" style="--equipment:${item.color}" title="${item.desc}"><span>${item.icon}</span>${item.name}</button>`).join('')}</div><p>${equipmentById(startingEquipment).desc}<br>${equipmentById(startingEquipment).kind === 'passive' ? '被动持续生效' : `空格使用 · 冷却 ${equipmentById(startingEquipment).cd} 秒`} · 商店购买会替换旧装备</p></div>`;
}
const combo = id => [...id].map(e => `<span style="color:${colors[e]}">${e}</span>`).join('');
$('spell-list').innerHTML = SPELLS.map(s => `<button class="spell-row" id="spell-${s.id}" data-spell="${s.id}" title="${s.id} · ${s.desc}"><span class="spell-icon" style="color:${s.color}">${s.icon}</span><span class="spell-info"><b>${s.name}</b><span class="combo">${combo(s.id)}</span></span><span class="spell-cd">就绪</span></button>`).join('');
function tone(freq = 400) {
  if (!soundOn) return;
  try { audio ||= new AudioContext(); audio.resume(); const o = audio.createOscillator(), a = audio.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(freq, audio.currentTime); o.frequency.exponentialRampToValueAtTime(freq / 2, audio.currentTime + .2); a.gain.setValueAtTime(.06, audio.currentTime); a.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .25); o.connect(a).connect(audio.destination); o.start(); o.stop(audio.currentTime + .26); } catch { /* Audio is optional. */ }
}
function updateHUD() {
  document.querySelector('.training-tools').hidden = !game.training;
  const p = game.player, spell = resolveSpell(game.queue);
  $('timer').textContent = formatTime(game.time); $('kills').textContent = game.kills; $('gold').textContent = game.gold;
  $('wave-title').textContent = game.training ? '试炼场 · 角色免伤' : game.bossSpawned ? `第 ${game.run.round} / ${RUN_RULES.rounds} 轮 Boss · ${game.boss?.name || ''}` : `第 ${game.run.round} / ${RUN_RULES.rounds} 轮 · 路线 ${Math.min(RUN_RULES.nodesPerRound, game.run.completed + 1)} / ${RUN_RULES.nodesPerRound}`;
  if (!game.training && game.state === 'playing') $('wave-title').textContent += ` · 剩余敌人 ${game.remainingEnemies}`;
  $('wave-progress').style.width = `${game.encounterTotal ? Math.min(100, game.encounterKills / game.encounterTotal * 100) : 0}%`;
  $('player-name').textContent = game.character.name; $('portrait').style.color = p.color;
  $('hp-text').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`; $('hp-fill').style.width = `${p.hp / p.maxHp * 100}%`;
  $('spirit-count').textContent = `${game.spirits.length} / ${p.spiritCap}`; $('power').textContent = `${Math.round(p.power * (p.buff > 0 ? p.buffPower || 1.45 : 1) * 100)}%`;
  $('training-boss').hidden = !game.training; $('training-boss').disabled = game.state !== 'playing' || !!modal || game.boss?.hp > 0;
  $('training-boss').textContent = '召唤斧王';
  $('training-timber').hidden = !game.training; $('training-timber').disabled = $('training-boss').disabled;
  $('training-enrage').hidden = !game.training; $('training-enrage').disabled = game.state !== 'playing' || !!modal || !game.boss || game.boss.hp <= 0 || game.boss.ai.enraged;
  $('training-squad').hidden = !game.training; $('training-squad').disabled = game.state !== 'playing' || !!modal || game.enemies.length > 90;
  $('training-shop').hidden = !game.training; $('training-shop').disabled = game.state !== 'playing' || !!modal;
  $('relic-count').textContent = game.relics.length;
  const item = equipmentById(game.equipment), cd = item ? game.equipmentCooldowns[item.id] : 0;
  $('equipment-icon').textContent = item?.icon || '◇'; $('equipment-slot').style.setProperty('--equipment', item?.color || '#8a9c89');
  $('equipment-name').textContent = item?.name || '装备槽';
  $('equipment-state').textContent = p.stasis > 0 ? `凝滞 ${p.stasis.toFixed(1)} 秒` : p.bkb > 0 ? `天神下凡 ${p.bkb.toFixed(1)} 秒` : cd > 0 ? `冷却 ${cd.toFixed(1)} 秒` : item ? item.kind === 'passive' ? '被动生效 · 无需使用' : '已就绪 · 空格使用' : '出战前选择一件装备';
  $('equipment-slot').disabled = !item || item.kind === 'passive' || game.state !== 'playing' || !!modal || cd > 0 || p.stasis > 0;
  $('equipment-slot').title = item ? `${item.desc}${item.kind === 'active' ? `\n冷却 ${item.cd} 秒。空格使用。` : ''}` : '在营地选择初始装备';
  $('equipment-slot').classList.toggle('cooling', cd > 0);
  $('equipment-progress').style.width = `${item ? item.cd > 0 ? 100 * (1 - cd / item.cd) : 100 : 0}%`;
  $('equipment-slot').querySelector('kbd').textContent = item?.kind === 'passive' ? '被动' : 'SPACE';
  const newKey = game.relics.join(',');
  if (inventoryKey !== newKey || !$('relic-inventory').children.length) {
    inventoryKey = newKey;
    $('relic-inventory').innerHTML = game.relics.length ? game.relics.map(id => { const r = RELICS.find(r => r.id === id); return `<button class="relic-token" style="--relic:${r.color}" data-relic="${r.id}" title="${r.name}：${r.desc}" aria-label="遗物：${r.name}">${r.icon}</button>`; }).join('') : '<small>在阶段商店中选择遗物，改变咒语形态</small>';
  }
  $('orb-slots').innerHTML = [0, 1, 2].map(i => `<span class="orb-slot ${game.queue[i] ? 'filled' : ''}" style="--orb:${colors[game.queue[i]] || '#4a5741'}">${symbols[game.queue[i]] || '·'}<small>${game.queue[i] || i + 1}</small></span>`).join('');
  $('current-icon').textContent = spell?.icon || '✧'; $('current-icon').style.color = spell?.color || '#b1d8a0';
  const empowered = spell && spellRelics(spell.id, game.relics).length > 0;
  $('current-name').textContent = spell ? `${spell.name}${empowered ? ' · 遗物强化' : ''}` : '等待元素';
  $('current-description').textContent = spell ? `${spell.type} · ${game.cooldowns[spell.id] > 0 ? `冷却 ${game.cooldowns[spell.id].toFixed(1)} 秒` : '已就绪，按 R 施放'}` : '三个元素，唤醒你的力量';
  for (const s of SPELLS) { const row = $(`spell-${s.id}`), cd = game.cooldowns[s.id]; row.classList.toggle('selected', s.id === spell?.id); row.classList.toggle('cooling', cd > 0); row.classList.toggle('empowered', spellRelics(s.id, game.relics).length > 0); row.querySelector('.spell-cd').textContent = cd > 0 ? `${cd.toFixed(1)}s` : '就绪'; }
  $('toast').textContent = game.feedbackUntil > game.time ? game.feedback : '';
  $('status-buffs').innerHTML = [p.ghost > 0 ? `<span>◈ 隐身 ${p.ghost.toFixed(1)}s</span>` : '', p.buff > 0 ? `<span>✧ 灵动迅捷 ${p.buff.toFixed(1)}s</span>` : '', p.bkb > 0 ? `<span class="equipment-buff">♛ 控制免疫 · 魔法减伤 80% · ${p.bkb.toFixed(1)}s</span>` : '', p.stasis > 0 ? `<span class="equipment-buff">⌛ 无敌 · 无法操作 · ${p.stasis.toFixed(1)}s</span>` : '', p.root > 0 ? `<span>定身 ${p.root.toFixed(1)}s</span>` : '', p.slowTime > 0 ? `<span>减速 ${Math.round(p.slow * 100)}%</span>` : '', game.effects.some(f => f.kind === 'boss-hunger' && f.age < f.duration) ? '<span>战斗饥渴 · 击杀或伤害斧王解除</span>' : ''].join('');
  $('boss-hud').hidden = !game.boss || game.boss.hp <= 0;
  if (game.boss) {
    const b = game.boss, ult = b.bossType === 'timber' ? '锯齿飞轮' : '淘汰之刃';
    $('boss-name').textContent = b.name;
    $('boss-health').style.width = `${Math.max(0, b.hp / b.maxHp * 100)}%`; $('boss-health-text').textContent = `${Math.max(0, Math.ceil(b.hp))} / ${b.maxHp}`;
    $('boss-mana').style.width = `${b.mana / b.maxMana * 100}%`;
    $('boss-mana-text').textContent = `${Math.floor(b.mana)} / ${b.maxMana}`;
    $('boss-mana-track').setAttribute('aria-valuenow', Math.floor(b.mana));
    $('boss-mana-track').classList.toggle('ready', b.mana >= b.maxMana);
    $('boss-ultimate').textContent = `${ult} · ${b.mana >= b.maxMana ? '已蓄满 · 等待出招' : '满蓝释放'}`;
    $('boss-status').textContent = bossStatus(b);
  }
  $('pause-button').disabled = !['playing', 'paused'].includes(game.state) || !!modal;
  $('pause-button').innerHTML = `${game.state === 'paused' ? '继续' : '暂停'} <kbd>ESC</kbd>`;
  if (lastState !== game.state) { rightDown = false; lastState = game.state; renderOverlay(); }
}
function renderOverlay() {
  let html = '';
  if (modal?.kind === 'help') html = `<span class="eyebrow">FIELD NOTES</span><h2>每一次输入，都是力量</h2><div class="guide-grid"><div><b>01 / 移动与瞄准</b>右键点击地面移动；按住右键调整路线。鼠标位置决定施法目标，允许移动施法。</div><div><b>02 / 编织与施放</b>Q 冰、W 雷、E 火。最近三个元素组成法术，顺序无关。R 施法后保留组合。</div><div><b>03 / 推荐连招</b>QEE + R 召唤精灵，再输入 QWE + R 释放声波。EEE + R 在敌人落点引爆阳炎。</div><div><b>04 / 远征目标</b>每关清理全部敌人即可过关，无时间限制。每轮选择 5 次路线后迎战 Boss，共 2 轮。每关结束可在商店消费金币、刷新商品，红色圈内即将受到伤害。</div></div><p class="subtitle">点击左侧秘典可查看技能详情。H 查看指南，Esc 暂停。游戏需要键盘与鼠标。</p><button class="primary-button" data-action="close-modal">明白了</button>`;
  else if (modal?.kind === 'relic') { const r = RELICS.find(r => r.id === modal.id); html = `<span class="sigil" style="color:${r.color}">${r.icon}</span><span class="eyebrow">${r.rarity} · 已生效</span><h2>${r.name}</h2><div class="spell-detail">${r.desc}<br>本局唯一拥有，重新开始后清空。</div><button class="primary-button" data-action="close-modal">返回远征</button>`; }
  else if (modal?.kind === 'spell') { const s = SPELLS.find(s => s.id === modal.id), rs = spellRelics(s.id, game.relics); html = `<span class="sigil" style="color:${s.color}">${s.icon}</span><span class="eyebrow">${s.en}</span><h2>${s.name}</h2><div class="combo" style="justify-content:center;font-size:18px">${combo(s.id)}</div><div class="spell-detail">${s.desc}<br>施法类型：${s.type}<br>标签：${s.tags.join(" / ")}<br>当前冷却：${game.spellStats(s).cooldown} 秒<br>当前施法次数：${game.spellStats(s).castCount}${s.range ? `<br>当前射程：${Math.round(game.spellStats(s).range)}` : ''}<br>输入此组合后按 R，三个元素的顺序不影响结果。${rs.map(r => `<div class="active-relic"><b style="color:${r.color}">${r.icon} ${r.name} · 已生效</b><br>${r.desc}</div>`).join('')}</div><button class="primary-button" data-action="close-modal">返回${modal.previous === 'playing' ? '战斗' : '远征'}</button>`; }
  else if (game.state === 'menu') html = `<span class="sigil">✧</span><span class="eyebrow">WEAVE YOUR OWN SURVIVAL</span><h2>以咒语，回应黑暗。</h2><p class="subtitle">踏入遗忘之庭，在涌来的怪潮中编织元素。<br>与小卡尔一起，挑战裂隙深处的领主。</p><div class="carl-intro"><img src="/assets/carl.svg" alt="小卡尔：白发、紫金法袍与三颗元素球"><div><span class="eyebrow">THE YOUNG INVOKER</span><h3>${HERO.name}</h3><p>${HERO.desc}</p><div class="carl-stats"><span>♡ 120 生命</span><span>✧ 十种咒语</span><span>◇ 遗物流派</span></div></div></div><button class="primary-button" data-action="start">开启远征 <span style="margin-left:20px">→</span></button><p class="dialog-footnote">右键移动 · Q / W / E 组合 · R 施法</p>${matchMedia('(pointer:coarse)').matches ? '<p class="mobile-warning">请使用键盘和鼠标游玩，触屏暂不支持战斗操作。</p>' : ''}`;
  else if (game.state === 'paused') html = `<span class="sigil">Ⅱ</span><span class="eyebrow">A MOMENT OF STILLNESS</span><h2>远征已暂停</h2><p class="subtitle">喘息片刻，重新编织你的下一道咒语。</p><div class="dialog-actions"><button class="primary-button" data-action="resume">继续战斗</button><button class="secondary-button" data-action="restart">重新开始</button></div><p class="dialog-footnote">按 ESC 继续</p>`;
  else if (game.state === 'shop') html = shopHTML(game, shopPage);
  else if (game.state === 'route') html = routeHTML(game);
  else if (game.state === 'event') html = eventHTML();
  else if (['dead', 'victory'].includes(game.state)) { const r = game.result; html = `<span class="sigil">${r.win ? '♜' : '◇'}</span><span class="eyebrow">${r.win ? 'THE RIFT IS SEALED' : 'EVERY END IS A BEGINNING'}</span><h2>${r.win ? '裂隙已封印' : '远征落幕'}</h2><p class="subtitle">${r.win ? '统帅倒下，遗忘之庭重归宁静。你的咒语值得被铭记。' : '黑暗暂时占据了上风。记住你的连招，再次踏入庭院。'}</p><div class="result-stats"><span><b>${formatTime(r.time)}</b><small>存活时间</small></span><span><b>${r.kills}</b><small>击败敌人</small></span><span><b>${r.casts}</b><small>施放法术</small></span><span><b>${r.gold}</b><small>收集金币</small></span></div><div class="dialog-actions"><button class="primary-button" data-action="start">再来一局 →</button><button class="secondary-button" data-action="restart">返回营地</button></div>`; }
  if (game.state === 'menu' && !modal) {
    html = html.replace('<button class="primary-button" data-action="start">', `${loadoutHTML()}<button class="primary-button" data-action="start">`);
    html = html.replace('<p class="dialog-footnote">', '<button class="training-button" data-action="training">进入遗物试炼 →</button><p class="dialog-footnote">空格使用主动装备 · ');
  }
  if (modal?.kind === 'help') html = html.replace('游戏需要键盘与鼠标。', '空格使用主动装备；出战前选择，被动装备自动生效；主动与被动只能携带一件，商店购买即替换。商店分为属性、遗物和装备三类，各随机三项。中亚凝滞期间无法操作。游戏需要键盘与鼠标。');
  $('overlay').classList.toggle('shop-overlay', game.state === 'shop' && !modal);
  const overlayParent = game.state === 'shop' && !modal ? document.body : $('arena-shell');
  if ($('overlay').parentElement !== overlayParent) overlayParent.append($('overlay'));
  $('overlay').innerHTML = html ? `<div class="dialog ${!modal && game.state === 'shop' ? 'shop-dialog' : !modal && game.state === 'menu' ? 'menu-dialog' : ''}" role="dialog" aria-modal="true" aria-label="${modal ? '远征指南' : '远征面板'}">${html}</div>` : '';
}
function openModal(kind, id) { if (modal) return; const previous = game.state; if (previous === 'playing') game.pause(); modal = { kind, id, previous }; rightDown = false; updateHUD(); renderOverlay(); }
function closeModal() { const previous = modal?.previous; modal = null; if (previous === 'playing' && game.state === 'paused') game.pause(); renderOverlay(); updateHUD(); }
document.addEventListener('click', e => {
  if (e.target.closest('.training-tools button')) document.querySelector('.training-tools').open = false;
  const route = e.target.closest('[data-route]'); if (route) { game.chooseRoute(route.dataset.route); updateHUD(); return; }
  const event = e.target.closest('[data-event]'); if (event) { game.resolveEvent(event.dataset.event); updateHUD(); return; }
  const loadout = e.target.closest('[data-loadout]'); if (loadout) { startingEquipment = loadout.dataset.loadout; renderOverlay(); return; }
  const relic = e.target.closest('[data-relic]'); if (relic) { openModal('relic', relic.dataset.relic); return; }
  const spell = e.target.closest('[data-spell]'); if (spell) { openModal('spell', spell.dataset.spell); return; }
  const buy = e.target.closest('[data-buy]'); if (buy) { if (game.buy(buy.dataset.buy)) tone(660); renderOverlay(); updateHUD(); return; }
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (action === 'shop-prev' || action === 'shop-next') { shopPage += action === 'shop-next' ? 1 : -1; renderOverlay(); return; }
  if (action === 'start') { modal = null; game.start(false, startingEquipment); tone(530); canvas.focus(); }
  if (action === 'training') { modal = null; game.start(true, startingEquipment); tone(530); canvas.focus(); game.message('遗物试炼 · 角色免伤，点击「试炼补给」体验强化和主动装备'); }
  if (action === 'resume') game.pause();
  if (action === 'restart') { modal = null; game.reset(); game.state = 'menu'; updateHUD(); renderOverlay(); }
  if (action === 'refresh') { game.refreshShop(); renderOverlay(); updateHUD(); }
  if (action === 'next') { game.nextWave(); canvas.focus(); }
  if (action === 'close-modal') closeModal();
  updateHUD();
});
$('help-button').onclick = () => modal ? closeModal() : openModal('help');
$('equipment-slot').onclick = () => { if (game.equipment === 'blink') { game.message('闪烁匕首：鼠标指向战场，按空格使用'); canvas.focus(); return; } if (game.useEquipment(renderer.mouse, renderer.validMouse)) tone(740); canvas.focus(); updateHUD(); };
$('training-boss').onclick = () => { game.trainingBoss(); updateHUD(); canvas.focus(); };
$('training-timber').onclick = () => { game.trainingBoss('timber'); updateHUD(); canvas.focus(); };
$('training-enrage').onclick = () => { if (game.training && game.state === 'playing' && game.boss?.hp > 0) game.boss.hp = Math.min(game.boss.hp, game.boss.maxHp * .5); updateHUD(); canvas.focus(); };
$('training-squad').onclick = () => { game.trainingSquad(); updateHUD(); canvas.focus(); };
$('training-shop').onclick = () => { rightDown = false; shopPage = 0; game.trainingShop(); updateHUD(); };
$('pause-button').onclick = () => { game.pause(); updateHUD(); };
$('sound-button').onclick = () => { soundOn = !soundOn; $('sound-button').textContent = soundOn ? '♫' : '♩'; $('sound-button').setAttribute('aria-label', soundOn ? '关闭音效' : '开启音效'); tone(540); };
window.addEventListener('keydown', e => {
  if (e.code === 'Space' && !e.ctrlKey && !e.metaKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && game.state === 'playing' && !modal) e.preventDefault();
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const key = e.key.toUpperCase();
  if (key === 'ESCAPE') { e.preventDefault(); if (modal) closeModal(); else game.pause(); updateHUD(); return; }
  if (key === 'H') { e.preventDefault(); if (modal) closeModal(); else openModal('help'); return; }
  if (game.state !== 'playing' || modal) return;
  if (e.code === 'Space') { e.preventDefault(); renderer.syncPointer(); if (game.useEquipment(renderer.mouse, renderer.validMouse)) { rightDown = false; tone(740); } updateHUD(); return; }
  if (['Q', 'W', 'E'].includes(key)) { e.preventDefault(); game.input(key); tone({ Q: 420, W: 530, E: 650 }[key]); }
  if (key === 'R') { e.preventDefault(); renderer.syncPointer(); if (game.cast(renderer.mouse, renderer.validMouse)) tone(800); }
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointermove', e => { renderer.mouse = renderer.point(e.clientX, e.clientY); renderer.validMouse = true; if (rightDown && (e.buttons & 2)) game.move(renderer.mouse); });
canvas.addEventListener('pointerdown', e => { renderer.mouse = renderer.point(e.clientX, e.clientY); renderer.validMouse = true; if (e.button === 2 && game.state === 'playing') { e.preventDefault(); rightDown = true; game.move(renderer.mouse); canvas.focus(); } });
canvas.addEventListener('pointerleave', () => { renderer.validMouse = false; rightDown = false; });
window.addEventListener('pointerup', e => { if (e.button === 2) rightDown = false; });
document.addEventListener('pointermove', e => { if (e.target !== canvas) renderer.validMouse = false; });
function autoPause() { rightDown = false; renderer.validMouse = false; if (game.state === 'playing') { game.pause(); updateHUD(); } }
window.addEventListener('blur', autoPause); document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
game.listeners.push(updateHUD); updateHUD(); renderOverlay();
let last = performance.now(), hudAccumulator = 0;
function loop(now) { const dt = (now - last) / 1000; last = now; renderer.syncPointer(); if (rightDown && renderer.validMouse) game.move(renderer.mouse); game.tick(dt); renderer.render(); hudAccumulator += dt; if (hudAccumulator > .08) { updateHUD(); hudAccumulator = 0; } requestAnimationFrame(loop); }
requestAnimationFrame(loop);
