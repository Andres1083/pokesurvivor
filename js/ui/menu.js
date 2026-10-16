/* ============ menu.js — menú principal, colección y mejoras ============ */
G.MenuUI = (() => {
  const $ = G.UI.$;
  const GEN_NAMES = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Teselia', 'Kalos', 'Alola', 'Galar', 'Paldea'];
  let dexFilter = 'all', dexGen = 1, dexSel = null;
  // Orden de la lista: 'num' (número de Pokédex) o 'power' (del más fuerte al más débil). Se recuerda.
  let dexSort = 'num';
  try { if (localStorage.getItem('ps_dexsort') === 'power') dexSort = 'power'; } catch (e) { /* sin almacenamiento */ }

  // Tope de cada barra: el mayor Pokémon con todo al máximo (mejoras + vitaminas).
  const STAT_MAX = { hp: 183 + 120, atk: 1.55 * 1.4 * 1.15, spd: 137 * 1.24 * 1.12 };
  /** Vida, ataque y velocidad de un Pokémon; si lo tienes, con tus mejoras y vitaminas (como en partida). */
  function monStats(p, own) {
    const pk = own ? G.Vitamins.merged(p.dex) : null;
    return {
      pk,
      hp: Math.round(p.hp + (pk ? pk.hp : 0)),
      atk: p.atk * (pk ? pk.atkMul : 1),
      spd: Math.round(p.spd * (pk ? pk.spdMul : 1))
    };
  }
  /** Fuerza 0-100: media de vida, ataque y velocidad frente al tope de cada una. */
  function powerOf(st) {
    return Math.round((st.hp / STAT_MAX.hp + st.atk / STAT_MAX.atk + st.spd / STAT_MAX.spd) / 3 * 100);
  }

  function init() {
    if (G.Gamepad && G.Gamepad.init) G.Gamepad.init();
    const ICON = { play: 'ball', dex: 'book', upgrades: 'up', gacha: 'ball4', goals: 'medal3', friends: 'friends', rank: 'trophy', settings: 'gear' };
    document.querySelectorAll('#scr-menu [data-go]').forEach(b => {
      // Steam Deck / mando: las mejoras se abren desde la ficha del Pokémon, no desde el menú.
      if (b.dataset.go === 'upgrades') { b.classList.add('hidden'); b.style.display = 'none'; return; }
      b.insertAdjacentHTML('afterbegin', `<span class="mi-ico">${G.Icons.html(ICON[b.dataset.go], 26)}</span>`);
      b.dataset.sfx = b.dataset.go === 'play' ? 'confirm' : 'click';
      b.onclick = () => {
        const go = b.dataset.go;
        if (go === 'play') { if (G.Social.room) G.LobbyUI.open(); else G.Flow.play(); }
        else if (go === 'dex') openDex();
        else if (go === 'gacha') G.GachaUI.open();
        else if (go === 'goals') G.GoalsUI.open();
        else if (go === 'friends') G.FriendsUI.open();
        else if (go === 'rank') G.RankingUI.open();
        else if (go === 'settings') G.SettingsUI.open();
      };
    });
    document.querySelectorAll('[data-back]').forEach(b => { b.onclick = open; });
    G.Social.on(() => { if (G.UI.isOpen('scr-menu')) socialLine(); });
    $('btn-logout').onclick = () => {
      if (G.DB.guest && !confirm('Eres invitado: se perderá todo el progreso. ¿Salir?')) return;
      G.Audio.music(null);
      G.DB.logout().then(() => G.Flow.toLogin());
    };
  }

  // ---------------- menú principal ----------------

  function open() {
    const s = G.DB.save;
    const mon = G.DEX_BY[s.partner];
    const shiny = !!s.partnerShiny && G.DB.ownsShiny(mon.dex);
    G.UI.chrome(true);
    G.UI.show('scr-menu');
    G.UI.sprite($('menu-partner'), mon.dex, { lively: true, scale: 4, hero: true, shiny });
    $('menu-partner').style.setProperty('--stage-c', shiny ? '#9ae6ff' : G.U.TYPE_COLOR[mon.types[0]]);
    $('menu-partner').classList.toggle('shiny', shiny);
    $('menu-partner-name').innerHTML = mon.name + (shiny ? ' ' + G.Icons.html('shiny', 24) : '');
    $('menu-partner-info').innerHTML = G.UI.typeChips(mon.types) + ' ' + G.UI.stars(mon.rarity);
    // Normal / shiny a mano, aquí mismo (en el móvil no se encontraba en la ficha).
    const seg = $('menu-shiny');
    seg.classList.toggle('hidden', !G.DB.ownsShiny(mon.dex));
    seg.lastChild.innerHTML = G.Icons.html('shiny', 12) + ' Shiny';
    seg.querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', (b.dataset.v === '1') === shiny);
      b.onclick = () => {
        if ((b.dataset.v === '1') === shiny) return;
        s.partnerShiny = b.dataset.v === '1';
        G.DB.commit();
        G.Audio.sfx('confirm');
        open();
      };
    });

    const owned = Object.keys(s.owned).filter(d => G.DEX_BY[d]).length;
    const shinies = Object.keys(s.shiny || {}).length;
    $('menu-dex-count').textContent = `${owned} / ${G.DEX.length}` + (shinies ? ` · ${shinies} shiny` : '');

    const st = s.stats;
    $('menu-stats').innerHTML = '<div class="stats-text">' +
      `Runs <b style="color:#fff">${st.runs}</b> · Mejor tiempo <b style="color:#fff">${G.U.mmss(st.bestTime)}</b><br>` +
      `Mejor nivel <b style="color:#fff">${st.bestLevel}</b> · Derrotados <b style="color:#fff">${st.totalKills.toLocaleString('es')}</b>` +
      (G.DB.guest ? '<br><span style="color:#ffb0b8">Modo invitado: no se guarda</span>' : '') +
      '</div><div class="stats-recs"></div>';
    // A la derecha, UN solo Pokémon: el que logró el mejor tiempo (en partidas antiguas sin dato, tu compañero).
    const recDex = G.DEX_BY[st.bestTimeDex] ? st.bestTimeDex : s.partner;
    if (G.DEX_BY[recDex]) {
      const wrap = document.createElement('div');
      wrap.className = 'rec-mon';
      wrap.title = `Mejor tiempo: ${G.DEX_BY[recDex].name}`;
      wrap.appendChild(G.UI.spriteCanvas(Number(recDex), 92, 80, { scale: 2, shadow: true, shiny: !!st.bestTimeShiny }));
      $('menu-stats').querySelector('.stats-recs').appendChild(wrap);
    }

    socialLine();
    // Premios de misiones por recoger.
    G.Progress.checkAch();
    const pend = G.Progress.pending();
    $('menu-goals-sub').textContent = pend ? pend + (pend === 1 ? ' premio por recoger' : ' premios por recoger') : 'Misiones, logros y perfil';
    $('menu-goals-sub').classList.toggle('gold', pend > 0);
    // Con cuenta en la nube: amigos en línea, invitaciones y (una vez) el apodo.
    if (G.DB.online && !G.Social.started) {
      G.Social.start().then(r => {
        if (r === 'need-nick' && !G.NickUI.skipped && G.UI.isOpen('scr-menu')) G.NickUI.open();
        socialLine();
      });
    }
    G.InvitePop.refresh();
  }

  /** Texto bajo "Amigos" y "Jugar": quién está en línea, solicitudes, sala. */
  function socialLine() {
    const room = G.Social.room;
    const play = document.querySelector('#scr-menu [data-go=play] small');
    if (play) play.textContent = room ? 'Volver a tu sala (' + room.members.length + '/' + G.Social.MAX_PLAYERS + ')' : 'Entra en la mazmorra';
    const fr = G.Social.friends;
    const on = fr.filter(f => f.status === 'ok' && f.online).length;
    const req = fr.filter(f => f.status === 'in').length;
    const parts = [];
    if (on) parts.push(on + ' en línea');
    if (req) parts.push(req + (req === 1 ? ' solicitud' : ' solicitudes'));
    $('menu-friends-sub').textContent = parts.length ? parts.join(' · ') : 'Juega en grupo, hasta 4';
    $('menu-friends-sub').classList.toggle('gold', req > 0);
  }

  // ---------------- colección ----------------

  function openDex() {
    G.UI.show('scr-dex', true);
    const s = G.DB.save;
    if (dexSel == null) { dexSel = s.partner; dexGen = G.DEX_BY[s.partner].gen; }
    const owned = Object.keys(s.owned).filter(d => G.DEX_BY[d]).length;
    $('dex-total').textContent = `${owned} / ${G.DEX.length}`;

    // Pestañas de generación, con cuántos tienes de cada una.
    const tabs = $('dex-gens');
    tabs.innerHTML = '';
    GEN_NAMES.forEach((name, i) => {
      const g = i + 1;
      const total = G.DEX.filter(p => p.gen === g).length;
      const have = G.DEX.filter(p => p.gen === g && s.owned[p.dex]).length;
      const b = document.createElement('button');
      b.className = 'gen-tab' + (g === dexGen ? ' on' : '');
      b.innerHTML = `<b>${name}</b><small>${have}/${total}</small>`;
      b.onclick = () => { dexGen = g; openDex(); };
      tabs.appendChild(b);
    });

    const F = [['all', 'Todos'], ['own', 'Tengo'], ['miss', 'Me faltan'], ['shiny', 'Shiny'],
               ['5', 5], ['4', 4], ['3', 3], ['2', 2], ['1', 1]];
    const fb = $('dex-filters');
    fb.innerHTML = '';
    const sortChip = document.createElement('button');
    sortChip.className = 'chip' + (dexSort === 'power' ? ' on' : '');
    sortChip.title = 'Ordenar la lista';
    sortChip.textContent = dexSort === 'power' ? 'Orden: fuerza ↓' : 'Orden: Nº';
    sortChip.onclick = () => {
      dexSort = dexSort === 'power' ? 'num' : 'power';
      try { localStorage.setItem('ps_dexsort', dexSort); } catch (e) { /* sin almacenamiento */ }
      openDex();
    };
    fb.appendChild(sortChip);
    for (const [k, label] of F) {
      const c = document.createElement('button');
      c.className = 'chip' + (k === dexFilter ? ' on' : '');
      c.innerHTML = k === 'shiny' ? G.Icons.html('shiny', 12) + ' Shiny'
                  : typeof label === 'number' ? G.Icons.rarity(label, 12) + ' ' + G.Gacha.RARITY_NAME[label] : label;
      c.onclick = () => { dexFilter = k; openDex(); };
      fb.appendChild(c);
    }
    renderGrid();
    showDetail(dexSel);
  }

  function renderGrid() {
    const s = G.DB.save;
    const grid = $('dex-grid');
    grid.innerHTML = '';
    const rows = [];
    for (const p of G.DEX) {
      if (p.gen !== dexGen) continue;
      const own = !!s.owned[p.dex], sh = !!(s.shiny && s.shiny[p.dex]);
      if (dexFilter === 'own' && !own) continue;
      if (dexFilter === 'miss' && own) continue;
      if (dexFilter === 'shiny' && !sh) continue;
      if (/^\d$/.test(dexFilter) && p.rarity !== +dexFilter) continue;
      rows.push({ p, own, sh, pw: own ? powerOf(monStats(p, true)) : -1 });
    }
    // Por fuerza: los que tienes primero, del más fuerte al más débil (los que no, al final y por número).
    if (dexSort === 'power') rows.sort((a, b) => b.pw - a.pw || a.p.dex - b.p.dex);
    for (const { p, own, sh, pw } of rows) {
      const cell = document.createElement('div');
      cell.className = 'cell' + (own ? '' : ' locked') + (sh ? ' has-shiny' : '') + (p.dex === dexSel ? ' on' : '');
      if (dexSort === 'power' && own) cell.insertAdjacentHTML('beforeend', `<span class="pw" title="Fuerza">${pw}</span>`);
      cell.insertAdjacentHTML('beforeend', `<span class="no">${String(p.dex).padStart(3, '0')}</span>`);
      if (p.dex === s.partner) cell.insertAdjacentHTML('beforeend', `<span class="badge-r" title="Compañero">${G.Icons.html('crown', 14)}</span>`);
      else if (sh) cell.insertAdjacentHTML('beforeend', `<span class="badge-r" title="Tienes su shiny">${G.Icons.html('shiny', 12)}</span>`);
      const useShiny = sh && p.dex === s.partner && s.partnerShiny;
      cell.appendChild(G.UI.spriteCanvas(p.dex, 92, 80, { scale: 2, silhouette: !own, shadow: own, shiny: useShiny }));
      cell.insertAdjacentHTML('beforeend', `<b>${own ? p.name : '???'}</b>${G.UI.stars(p.rarity, 9)}`);
      cell.onclick = () => {
        dexSel = p.dex;
        grid.querySelectorAll('.cell').forEach(c => c.classList.remove('on'));
        cell.classList.add('on');
        showDetail(p.dex);
      };
      grid.appendChild(cell);
    }
    if (!grid.children.length) grid.innerHTML = '<p class="sub" style="grid-column:1/-1">Ninguno con este filtro.</p>';
  }

  // Variante que se está viendo en la ficha (normal o shiny).
  let viewShiny = false;

  function showDetail(dex) {
    const s = G.DB.save;
    const p = G.DEX_BY[dex];
    const own = !!s.owned[dex];
    const hasSh = G.DB.ownsShiny(dex);
    const isPartner = dex === s.partner;
    if (!hasSh) viewShiny = false;
    else if (isPartner && dex !== showDetail.last) viewShiny = !!s.partnerShiny;
    showDetail.last = dex;

    // Con las mejoras y vitaminas ya compradas (mismo cálculo que en partida).
    const st = own ? monStats(p, true) : null;
    const pk = st && st.pk;
    const tHp = own ? st.hp : 0;
    const tAtk = own ? st.atk : 0;
    const tSpd = own ? st.spd : 0;
    const max = STAT_MAX;
    const bar = (label, v, m, txt) =>
      `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${Math.min(100, v / m * 100)}%"></i></div><span>${txt}</span></div>`;
    const pct = v => (Math.round(v * 1000) / 10).toString().replace('.', ',') + '%';
    const row = (label, val, cls = '') => `<div class="stat2 ${cls}"><span>${label}</span><b>${val}</b></div>`;
    const extras = own ? [
      row('Fuerza', powerOf(st) + ' / 100', 'full'),
      row('Defensa', pct(pk.dmgReduce)),
      row('Críticos', pct(pk.crit)),
      row('Regeneración', (Math.round(pk.regen * 10) / 10).toString().replace('.', ',') + ' vida/s'),
      row('Recarga', pk.cdMul < 1 ? '-' + pct(1 - pk.cdMul) : '0%'),
      row('Imán', '+' + pct(pk.magnetMul - 1)),
      row('Experiencia', '+' + pct(pk.xpMul - 1)),
      row('Pokémonedas', '+' + pct(pk.coinMul - 1)),
      row('Cambios de carta', pk.rerolls + 1),
      row('Veto', pk.bans),
      row('Movs. iniciales', pk.startMoves)
    ].join('') : '';
    const usingThis = isPartner && (!hasSh || !!s.partnerShiny === viewShiny);

    const box = $('dex-detail');
    box.classList.toggle('shiny', own && viewShiny);
    box.innerHTML = `
      <canvas id="dex-big" class="stage" width="220" height="190"></canvas>
      ${hasSh ? `<div class="seg">
          <button class="${viewShiny ? '' : 'on'}" data-v="0">Normal</button>
          <button class="${viewShiny ? 'on' : ''}" data-v="1">${G.Icons.html('shiny', 12)} Shiny</button></div>` : ''}
      <div class="center">
        <div style="color:var(--muted);font-size:13px">Nº ${String(p.dex).padStart(3, '0')} · ${GEN_NAMES[p.gen - 1]}</div>
        <h3>${own ? p.name : '???'}</h3>
        <div style="color:${G.Gacha.RARITY_COLOR[p.rarity]}">${G.UI.stars(p.rarity, 24)} ${G.Gacha.RARITY_NAME[p.rarity]}</div>
        <div style="margin:6px 0">${own ? G.UI.typeChips(p.types) : ''}</div>
      </div>
      ${own ? `
        ${bar('Vida', tHp, max.hp, tHp)}
        ${bar('Ataque', tAtk, max.atk, '×' + tAtk.toFixed(2))}
        ${bar('Velocidad', tSpd, max.spd, tSpd)}
        <p class="sub" style="margin:2px 0 6px;font-size:12px">Base ${p.hp} · ×${p.atk.toFixed(2)} · ${p.spd}${
          (tHp !== p.hp || tAtk !== p.atk || tSpd !== p.spd) ? ' — más tus mejoras y vitaminas' : ''}</p>
        <div class="stats2">${extras}</div>
        <p style="font-size:14px;margin:10px 0 4px">Empieza con <b class="gold">${G.Moves.BY_ID[G.startMoveOf(dex)].name}</b></p>
        <p class="move-icons" title="Movimientos que puede aprender">
          ${G.Moves.poolFor(p).map(id => `<span title="${G.Moves.BY_ID[id].name}">${G.Icons.html('move:' + id, 16)}</span>`).join('')}</p>
        <div class="dex-actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          ${usingThis
            ? '<button class="btn grow" disabled style="flex:1">Es tu compañero</button>'
            : `<button id="dex-pick" class="btn gold" data-sfx="confirm" style="flex:1">Elegir de compañero${viewShiny ? ' (shiny)' : ''}</button>`}
          <button id="dex-upgrade" class="btn" data-sfx="click" style="flex:1">Mejorar</button>
        </div>
      ` : `<p class="center" style="color:var(--muted)">Aún no lo tienes.<br>Consíguelo en el banner de <b class="gold">${GEN_NAMES[p.gen - 1]}</b>
            o derrotándolo cuando salga shiny.</p>`}
    `;
    $('dex-big').style.setProperty('--stage-c', !own ? '#5b83d6' : viewShiny ? '#9ae6ff' : G.U.TYPE_COLOR[p.types[0]]);
    $('dex-big').classList.toggle('shiny', own && viewShiny);
    G.UI.sprite($('dex-big'), dex, { lively: own, spin: own, silhouette: !own, scale: 3, hero: true, shiny: own && viewShiny });
    box.querySelectorAll('.seg button').forEach(b => {
      b.onclick = () => { viewShiny = b.dataset.v === '1'; showDetail(dex); };
    });
    const pick = $('dex-pick');
    if (pick) pick.onclick = () => {
      s.partner = dex;
      s.partnerShiny = hasSh && viewShiny;
      G.DB.commit();
      G.UI.toast(p.name + (s.partnerShiny ? ' shiny' : '') + ' es ahora tu compañero');
      renderGrid(); showDetail(dex);
    };
    const upgBtn = $('dex-upgrade');
    if (upgBtn) upgBtn.onclick = () => openUpgrades(dex);
  }

  // ---------------- mejoras ----------------

  let upgDex = null;

  /** Abre mejoras del Pokémon indicado (desde su ficha). Sin lista de 900. */
  function openUpgrades(dex) {
    G.UI.show('scr-upgrades', true);
    const s = G.DB.save;
    upgDex = (dex && s.owned[dex]) ? +dex : (s.partner || upgDex);
    // Ocultar el selector: se entra siempre desde la ficha del Pokémon (Steam Deck / mando).
    const sel = $('upg-mon');
    if (sel) {
      sel.classList.add('hidden');
      sel.style.display = 'none';
    }
    const lab = document.querySelector('label[for="upg-mon"]');
    if (lab) lab.style.display = 'none';
    // Volver regresa a la colección, no al menú principal.
    const back = document.querySelector('#scr-upgrades [data-back]');
    if (back) back.onclick = () => openDex();
    renderUpgrades();
  }

  function renderUpgrades() {
    const s = G.DB.save;
    const levels = G.DB.upgradesOf(upgDex);
    const mon = G.DEX_BY[upgDex];
    const shiny = upgDex === s.partner && !!s.partnerShiny && G.DB.ownsShiny(upgDex);
    G.UI.sprite($('upg-stage'), upgDex, { lively: true, scale: 2, hero: true, shiny });
    $('upg-stage').style.setProperty('--stage-c', shiny ? '#9ae6ff' : G.U.TYPE_COLOR[mon.types[0]]);
    const box = $('upg-list');
    box.innerHTML = '';
    for (const u of G.Upgrades.LIST) {
      const lvl = levels[u.id] || 0;
      const maxed = lvl >= u.max;
      const cost = maxed ? 0 : G.Upgrades.cost(u.id, lvl);
      const el = document.createElement('div');
      el.className = 'panel upg-item';
      el.innerHTML = `
        <div class="ic">${G.Icons.html(u.icon, 32)}</div>
        <div>
          <b>${u.name}</b> <span style="color:var(--muted);font-size:13px">${u.unit}</span>
          <div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>
        </div>
        <div class="upg-btns">
          ${u.id === 'ban' && lvl > 0 ? `<button class="btn small" data-ban>Elegir (${banList().length}/${lvl})</button>` : ''}
          <button class="btn small ${maxed ? '' : 'gold'}" data-buy data-sfx="none" ${maxed || s.coins < cost ? 'disabled' : ''}>
          ${maxed ? 'Máx.' : `<span class="coin"></span> ${cost}`}</button></div>`;
      if (u.id === 'ban' && lvl > 0) el.querySelector('[data-ban]').onclick = () => { banOpen = !banOpen; renderUpgrades(); };
      el.querySelector('[data-buy]').onclick = () => {
        // Se vuelve a leer todo al pulsar (la partida puede haber cambiado desde que se dibujó).
        const sv = G.DB.save, lv = G.DB.upgradesOf(upgDex), now = lv[u.id] || 0;
        if (now >= u.max) { renderUpgrades(); return; }
        const price = G.Upgrades.cost(u.id, now);
        if (sv.coins < price) { renderUpgrades(); return; }
        sv.coins -= price;
        lv[u.id] = now + 1;
        G.DB.commit(true);
        G.Audio.sfx('buy');
        G.UI.refreshCoins();
        G.UI.toast(`${mon.name} · ${u.name}: nivel ${now + 1}`);
        renderUpgrades();
      };
      box.appendChild(el);
      if (u.id === 'ban' && lvl > 0 && banOpen) box.appendChild(banPicker(lvl));
    }

    // ---------- Vitaminas (desplegable como Veto) ----------
    if (G.Vitamins) {
      const vitLevels = G.DB.vitaminsOf(upgDex);
      const totalVit = Object.values(vitLevels).reduce((a, b) => a + b, 0);
      const vitEl = document.createElement('div');
      vitEl.className = 'panel upg-item';
      vitEl.innerHTML = `
        <div class="ic">${G.Icons.html('sprout', 32)}</div>
        <div>
          <b>Vitaminas</b> <span style="color:var(--muted);font-size:13px">mejora permanente suave</span>
          <div class="pips">${totalVit ? `<span style="font-size:12px;color:var(--gold)">${totalVit} aplicadas</span>` : ''}</div>
        </div>
        <div class="upg-btns">
          <button class="btn small" data-vit>${vitOpen ? 'Cerrar' : 'Abrir'}</button>
        </div>`;
      vitEl.querySelector('[data-vit]').onclick = () => { vitOpen = !vitOpen; renderUpgrades(); };
      box.appendChild(vitEl);
      if (vitOpen) box.appendChild(vitaminsPanel());
    }

    box.appendChild(bindPanel());
  }

  // ---------------- atajos: hueco fijo para cada movimiento ----------------
  // save.pbind[dex] = [movimiento del hueco 1, del 2, del 3, del 4] (o null).
  function bindPanel() {
    const s = G.DB.save;
    s.pbind = s.pbind || {};
    const list = s.pbind[upgDex] || [null, null, null, null];
    const mon = G.DEX_BY[upgDex];
    const ids = G.Moves.poolFor(mon).concat([G.startMoveOf(upgDex)]).filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => G.Moves.BY_ID[a].name.localeCompare(G.Moves.BY_ID[b].name, 'es'));
    const el = document.createElement('div');
    el.className = 'panel bind-panel';
    el.innerHTML = `<b>Atajos de movimientos</b>
      <p class="sub" style="margin:2px 0 8px">Elige qué movimiento va siempre en cada hueco (teclas 1-4 o los iconos de abajo), para la memoria muscular. Si aún no tienes tantos movimientos, va al hueco más cercano.</p>
      <div class="bind-slots">${[0, 1, 2, 3].map(i => `<label class="bind-slot"><span>${i + 1}</span>
        <select class="field" data-slot="${i}"><option value="">Libre</option>${ids.map(id =>
          `<option value="${id}" ${list[i] === id ? 'selected' : ''}>${G.Moves.BY_ID[id].name}</option>`).join('')}</select></label>`).join('')}</div>`;
    el.querySelectorAll('select[data-slot]').forEach(sel => {
      sel.onchange = () => {
        const l = (s.pbind[upgDex] || [null, null, null, null]).slice(0, 4);
        while (l.length < 4) l.push(null);
        const i = +sel.dataset.slot, id = sel.value || null;
        // Un movimiento sólo puede estar en un hueco.
        for (let j = 0; j < 4; j++) if (id && l[j] === id) l[j] = null;
        l[i] = id;
        s.pbind[upgDex] = l;
        G.DB.commit();
        G.Audio.sfx('select');
        renderUpgrades();
      };
    });
    return el;
  }

  // ---------------- vitaminas ----------------
  let vitOpen = false;
  function vitaminsPanel() {
    const s = G.DB.save;
    const levels = G.DB.vitaminsOf(upgDex);
    const mon = G.DEX_BY[upgDex];
    const el = document.createElement('div');
    el.className = 'panel ban-picker';
    el.innerHTML = `<p class="sub" style="margin:0 0 8px">Vitaminas permanentes para <b>${mon.name}</b>. Precio inicial 10.000, se duplica cada nivel.</p>`;
    for (const v of G.Vitamins.LIST) {
      const lvl = levels[v.id] || 0;
      const maxed = lvl >= v.max;
      const cost = maxed ? 0 : G.Vitamins.cost(v.id, lvl);
      const row = document.createElement('div');
      row.className = 'panel upg-item';
      row.style.margin = '6px 0';
      row.innerHTML = `
        <div class="ic">${G.Icons.html(v.icon, 28)}</div>
        <div>
          <b>${v.name}</b> <span style="color:var(--muted);font-size:13px">${v.unit}</span>
          <div class="pips">${Array.from({ length: v.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>
        </div>
        <div class="upg-btns">
          <button class="btn small ${maxed ? '' : 'gold'}" data-buy-vit data-id="${v.id}" data-sfx="none" ${maxed || s.coins < cost ? 'disabled' : ''}>
          ${maxed ? 'Máx.' : `<span class="coin"></span> ${cost.toLocaleString('es')}`}</button>
        </div>`;
      row.querySelector('[data-buy-vit]').onclick = () => {
        const sv = G.DB.save, lv = G.DB.vitaminsOf(upgDex), now = lv[v.id] || 0;
        if (now >= v.max) { renderUpgrades(); return; }
        const price = G.Vitamins.cost(v.id, now);
        if (sv.coins < price) { renderUpgrades(); return; }
        sv.coins -= price;
        lv[v.id] = now + 1;
        G.DB.commit(true);
        G.Audio.sfx('buy');
        G.UI.refreshCoins();
        G.UI.toast(`${mon.name} · ${v.name}: nivel ${now + 1}`);
        renderUpgrades();
      };
      el.appendChild(row);
    }
    return el;
  }

  // ---------------- veto: movimientos bloqueados ----------------
  // Lista por Pokémon en save.pban[dex]; con N niveles de Veto, N movimientos.
  let banOpen = false;
  function banList() {
    const s = G.DB.save;
    s.pban = s.pban || {};
    return s.pban[upgDex] || (s.pban[upgDex] = []);
  }
  function banPicker(max) {
    const mon = G.DEX_BY[upgDex];
    const start = G.startMoveOf(upgDex);
    const ids = G.Moves.poolFor(mon).filter(id => id !== start)
      .sort((a, b) => G.Moves.BY_ID[a].name.localeCompare(G.Moves.BY_ID[b].name, 'es'));
    const list = banList();
    const el = document.createElement('div');
    el.className = 'panel ban-picker';
    el.innerHTML = `<p class="sub" style="margin:0 0 8px">Toca los movimientos que no quieres que te salgan en las cartas (${list.length}/${max}). El movimiento de inicio no se puede vetar.</p>
      <div class="ban-moves">${ids.map(id => { const d = G.Moves.BY_ID[id]; const on = list.includes(id);
        return `<button class="chip ${on ? 'on ban' : ''}" data-id="${id}">${G.Icons.html('move:' + id, 16)} ${d.name}${on ? ' ' + G.Icons.html('ban', 14) : ''}</button>`; }).join('')}</div>`;
    el.querySelectorAll('[data-id]').forEach(b => {
      b.onclick = () => {
        const l = banList(), id = b.dataset.id, i = l.indexOf(id);
        if (i >= 0) l.splice(i, 1);
        else if (l.length >= max) { G.UI.toast('Ya tienes ' + max + ' vetados: quita uno primero'); return; }
        else l.push(id);
        G.DB.commit();
        G.Audio.sfx('select');
        renderUpgrades();
      };
    });
    return el;
  }

  return { init, open, GEN_NAMES };
})();
