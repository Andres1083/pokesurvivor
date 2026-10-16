/* ============ vitamins.js — vitaminas permanentes por Pokémon ============
 * Se compran con Pokémonedas en la pantalla de Mejoras (sección desplegable).
 * Precio base 10.000 y se duplica cada nivel.
 * Valores moderados para no romper el balance de las mejoras normales.
 */
G.Vitamins = (() => {
  const LIST = [
    { id: 'hp',     icon: 'heart',  name: 'HP Up',      unit: '+4 vida',                 max: 10, base: 10000 },
    { id: 'atk',    icon: 'fist',   name: 'Proteína',   unit: '+1,5% daño',              max: 10, base: 10000 },
    { id: 'def',    icon: 'shield', name: 'Hierro',     unit: '+1% reducción de daño',   max: 8,  base: 10000 },
    { id: 'spd',    icon: 'boot',   name: 'Carbos',     unit: '+1,5% velocidad',         max: 8,  base: 10000 },
    { id: 'crit',   icon: 'star',   name: 'Calcio',     unit: '+1,5% de críticos',       max: 8,  base: 10000 },
    { id: 'regen',  icon: 'sprout', name: 'Zinc',       unit: '+0,1 vida/s',             max: 5,  base: 10000 }
  ];
  const BY = {};
  for (const v of LIST) BY[v.id] = v;

  /** Precio del siguiente nivel (base * 2^nivel actual). */
  function cost(id, lvl) {
    const v = BY[id];
    if (!v) return 999999;
    return Math.round(v.base * Math.pow(2, lvl));
  }

  /** Niveles comprados -> modificadores que se suman a los de G.Upgrades.perks. */
  function perks(levels = {}) {
    const L = id => Math.max(0, Math.min(BY[id].max, Math.floor(+levels[id] || 0)));
    return {
      hp: L('hp') * 4,
      atkMul: 1 + L('atk') * 0.015,
      dmgReduce: L('def') * 0.01,
      spdMul: 1 + L('spd') * 0.015,
      crit: L('crit') * 0.015,
      regen: L('regen') * 0.1
    };
  }

  /** Mejoras + vitaminas de un Pokémon ya combinadas (multiplicadores se multiplican, planos se suman).
   *  Lo usan la partida (game.js) y la ficha de la colección (menu.js), para que ambas coincidan. */
  function merged(dex) {
    const upg = G.Upgrades.perks(G.DB.upgradesOf(dex));
    const vit = perks(G.DB.vitaminsOf(dex));
    return {
      hp: (upg.hp || 0) + (vit.hp || 0),
      atkMul: (upg.atkMul || 1) * (vit.atkMul || 1),
      spdMul: (upg.spdMul || 1) * (vit.spdMul || 1),
      cdMul: upg.cdMul || 1,
      dmgReduce: (upg.dmgReduce || 0) + (vit.dmgReduce || 0),
      regen: (upg.regen || 0) + (vit.regen || 0),
      magnetMul: upg.magnetMul || 1,
      xpMul: upg.xpMul || 1,
      coinMul: upg.coinMul || 1,
      startMoves: upg.startMoves || 1,
      crit: (upg.crit || 0) + (vit.crit || 0),
      rerolls: upg.rerolls || 0,
      bans: upg.bans || 0
    };
  }

  return { LIST, BY, cost, perks, merged };
})();
