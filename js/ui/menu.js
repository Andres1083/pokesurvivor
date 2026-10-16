function showDetail(dex) {
    const s = G.DB.save;
    const p = G.DEX_BY[dex];
    const own = !!s.owned[dex];
    const hasSh = G.DB.ownsShiny(dex);
    const isPartner = dex === s.partner;
    if (!hasSh) viewShiny = false;
    else if (isPartner && dex !== showDetail.last) viewShiny = !!s.partnerShiny;
    showDetail.last = dex;

    // --- CÁLCULO DE ESTADÍSTICAS CON MEJORAS PERMANENTES ---
    const upg = (G.Upgrades && G.DB.upgradesOf) ? G.Upgrades.perks(G.DB.upgradesOf(dex)) : {};
    const vit = (G.Vitamins && G.DB.vitaminsOf) ? G.Vitamins.perks(G.DB.vitaminsOf(dex)) : {};
    
    const effectiveHp = Math.round(p.hp + (upg.hp || 0) + (vit.hp || 0));
    const effectiveAtk = p.atk * (upg.atkMul || 1) * (vit.atkMul || 1);
    const effectiveSpd = p.spd * (upg.spdMul || 1) * (vit.spdMul || 1);
    // -----------------------------------------------------

    const max = { hp: 183, atk: 1.55, spd: 137 };
    const bar = (label, v, m, txt) =>
      `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${Math.min(100, v / m * 100)}%"></i></div><span>${txt}</span></div>`;
    const usingThis = isPartner && (!hasSh || !!s.partnerShiny === viewShiny);

    const box = \$('dex-detail');
    box.innerHTML = `
      <canvas id="dex-big" class="stage" width="220" height="190"></canvas>
      ${hasSh ? `<div class="seg">
          <button class="\${viewShiny ? '' : 'on'}" data-v="0">Normal</button>
          <button class="${viewShiny ? 'on' : ''}" data-v="1">${G.Icons.html('shiny', 12)} Shiny</button></div>` : ''}
      <div class="center">
        <div style="color:var(--muted);font-size:13px">Nº ${String(p.dex).padStart(3, '0')} · ${GEN_NAMES[p.gen - 1]}</div>
        <h3>${own ? p.name : '???'}</h3>
        <div style="color:${G.Gacha.RARITY_COLOR[p.rarity]}">${G.UI.stars(p.rarity, 24)} ${G.Gacha.RARITY_NAME[p.rarity]}</div>
        <div style="margin:6px 0">${own ? G.UI.typeChips(p.types) : ''}</div>
      </div>
      ${own ? `
        \${bar('Vida', effectiveHp, max.hp, effectiveHp)}
        ${bar('Ataque', effectiveAtk, max.atk, '×' + effectiveAtk.toFixed(2))}${bar('Velocidad', effectiveSpd, max.spd, Math.round(effectiveSpd))}
        <p style="font-size:14px;margin:10px 0 4px">Empieza con <b class="gold">\${G.Moves.BY_ID[G.startMoveOf(dex)].name}</b></p>
        <p class="move-icons" title="Movimientos que puede aprender">
          \${G.Moves.poolFor(p).map(id => `<span title="${G.Moves.BY_ID[id].name}">${G.Icons.html('move:' + id, 16)}</span>`).join('')}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          \${usingThis
            ? '<button class="btn grow" disabled style="flex:1">Es tu compañero</button>'
            : `<button id="dex-pick" class="btn gold" data-sfx="confirm" style="flex:1">Elegir de compañero${viewShiny ? ' (shiny)' : ''}</button>`}
          <button id="dex-upgrade" class="btn" data-sfx="click" style="flex:1">Mejorar</button>
        </div>
      ` : `<p class="center" style="color:var(--muted)">Aún no lo tienes.<br>Consíguelo en el banner de <b class="gold">\${GEN_NAMES[p.gen - 1]}</b>
            o derrotándolo cuando salga shiny.</p>`}
    `;
    \$('dex-big').style.setProperty('--stage-c', !own ? '#5b83d6' : viewShiny ? '#9ae6ff' : G.U.TYPE_COLOR[p.types[0]]);
    \$('dex-big').classList.toggle('shiny', own && viewShiny);
    G.UI.sprite(\$('dex-big'), dex, { lively: own, spin: own, silhouette: !own, scale: 3, hero: true, shiny: own && viewShiny });
    box.querySelectorAll('.seg button').forEach(b => {
      b.onclick = () => { viewShiny = b.dataset.v === '1'; showDetail(dex); };
    });
    const pick = \$('dex-pick');
    if (pick) pick.onclick = () => {
      s.partner = dex;
      s.partnerShiny = hasSh && viewShiny;
      G.DB.commit();
      G.UI.toast(p.name + (s.partnerShiny ? ' shiny' : '') + ' es ahora tu compañero');
      renderGrid(); showDetail(dex);
    };
    const upgBtn = \$('dex-upgrade');
    if (upgBtn) upgBtn.onclick = () => openUpgrades(dex);
  }