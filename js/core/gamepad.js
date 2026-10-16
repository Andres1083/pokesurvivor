/* ============ gamepad.js — mando / Steam Deck en menús ============
 * - Cruceta / stick izquierdo / flechas: mover el foco entre botones
 * - A (botón 0): activar lo que tiene el foco (botones, pestañas, casillas de Pokémon...)
 * - B (botón 1) / Escape: Volver / Cerrar de la pantalla que está arriba
 * - LB / RB (botones 4 y 5) o LT / RT (6 y 7), o Q / E o RePág / AvPág:
 *     pestaña anterior / siguiente (regiones de la colección, pestañas de Ajustes, Misiones...)
 * - Ajustes > Controles > "Intercambiar A y B": para mandos con la distribución de Nintendo
 *   (donde el botón de abajo es B). Se guarda en este dispositivo.
 * Sólo actúa cuando hay una pantalla de menú abierta (no durante la run), y SÓLO sobre la
 * pantalla que está encima: el menú principal se queda abierto debajo de la colección, las
 * mejoras, etc., y antes el foco se quedaba en sus botones, por detrás.
 */
G.Gamepad = (() => {
  const FOCUS_CLS = 'gp-focus';
  let prev = { a: false, b: false, l: false, r: false, up: false, down: false, left: false, right: false };
  let focused = null;
  let opener = null;     // botón del menú principal que abrió la pantalla actual (al volver, el foco regresa ahí)
  let cool = 0;          // anti-repetición al mantener dirección
  let styleInjected = false;

  function injectStyle() {
    if (styleInjected) return;
    styleInjected = true;
    const s = document.createElement('style');
    s.textContent = `
      .${FOCUS_CLS} {
        outline: 3px solid #ffd23f !important;
        outline-offset: 3px !important;
        box-shadow: 0 0 0 2px rgba(0,0,0,.5), 0 0 12px rgba(255,210,63,.55) !important;
        position: relative;
        z-index: 2;
      }
    `;
    document.head.appendChild(s);
  }

  /** ¿Estamos en un menú (no en partida activa)? */
  function inMenu() {
    // Durante la run el canvas de juego suele estar visible y no hay scr-* de menú
    const open = document.querySelector('.scr:not(.hidden), section.scr:not(.hidden)');
    if (!open) return false;
    // Si está la HUD de run y no hay overlay de pausa/cartas, no navegar menús
    const runHud = document.getElementById('hud') || document.querySelector('.hud');
    const pause = document.querySelector('#scr-pause:not(.hidden), .pause:not(.hidden), #levelup:not(.hidden)');
    if (runHud && !runHud.classList.contains('hidden') && !pause) {
      // Puede ser menú principal con chrome; si scr-menu está abierto, sí es menú
      const menu = document.getElementById('scr-menu');
      if (menu && !menu.classList.contains('hidden')) return true;
      // Otras pantallas de menú
      const ids = ['scr-dex', 'scr-upgrades', 'scr-gacha', 'scr-goals', 'scr-friends',
                   'scr-rank', 'scr-settings', 'scr-login', 'scr-test'];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && !el.classList.contains('hidden')) return true;
      }
      return false;
    }
    return true;
  }

  /** La pantalla que se ve encima de todas (la última abierta; a igual capa gana la posterior en el HTML). */
  function topScreen() {
    const pull = document.getElementById('pull-fx');     // la tirada del gacha va por encima de todo
    if (pull && !pull.classList.contains('hidden')) return pull;
    let best = null, bz = -Infinity;
    document.querySelectorAll('.scr:not(.hidden)').forEach(el => {
      const z = parseInt(getComputedStyle(el).zIndex, 10) || 0;
      if (z >= bz) { bz = z; best = el; }
    });
    return best;
  }

  function isVisible(el) {
    if (!el || el.disabled) return false;
    if (el.classList.contains('hidden')) return false;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return false;
    if (el.offsetParent === null && st.position !== 'fixed') return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  }

  const SELECTORS = [
    '[data-go]', '.btn', 'button', '.menu-item', '.chip', '.gen-tab', '.tab', '.cell',
    '.dex-card', '[data-back]', 'select.field', 'a.btn'
  ].join(',');

  /** Candidatos enfocables en la pantalla de arriba (sólo ella). */
  function candidates() {
    const top = topScreen();
    if (!top) return [];
    const list = [];
    top.querySelectorAll(SELECTORS).forEach(el => {
      if (isVisible(el) && !list.includes(el)) list.push(el);
    });
    return list;
  }

  function setFocus(el) {
    if (focused) focused.classList.remove(FOCUS_CLS);
    focused = el || null;
    if (focused) {
      focused.classList.add(FOCUS_CLS);
      try { focused.focus({ preventScroll: true }); } catch (_) {}
      focused.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }

  /** Dónde poner el foco al abrir una pantalla: lo que está elegido (Pokémon, pestaña) o lo primero. */
  function pickDefault(list) {
    return list.find(el => el.matches('.cell.on')) ||
           list.find(el => el.matches('.gen-tab.on, .tab.on')) ||
           list[0];
  }

  function ensureFocus() {
    const list = candidates();
    if (!list.length) { setFocus(null); return list; }
    if (!focused || !list.includes(focused) || !isVisible(focused)) {
      setFocus(pickDefault(list));
    }
    return list;
  }

  function moveFocus(dx, dy) {
    const list = ensureFocus();
    if (!list.length || !focused) return;
    const fr = focused.getBoundingClientRect();
    const fx = fr.left + fr.width / 2;
    const fy = fr.top + fr.height / 2;

    let best = null, bestScore = Infinity;
    for (const el of list) {
      if (el === focused) continue;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const ox = cx - fx, oy = cy - fy;
      // Debe estar en la dirección pedida
      if (dx && ox * dx <= 4) continue;
      if (dy && oy * dy <= 4) continue;
      if (dx && Math.abs(oy) > Math.abs(ox) * 1.8) continue; // demasiado desviado
      if (dy && Math.abs(ox) > Math.abs(oy) * 1.8) continue;
      const dist = Math.hypot(ox, oy) + (dx ? Math.abs(oy) * 0.35 : Math.abs(ox) * 0.35);
      if (dist < bestScore) { bestScore = dist; best = el; }
    }
    // Fallback: orden DOM
    if (!best) {
      const i = list.indexOf(focused);
      if (dx > 0 || dy > 0) best = list[(i + 1) % list.length];
      else best = list[(i - 1 + list.length) % list.length];
    }
    if (best) {
      setFocus(best);
      if (G.Audio) G.Audio.sfx('select');
    }
  }

  /** Botón de volver / cerrar de la pantalla de arriba. */
  function visibleBack() {
    const top = topScreen();
    if (!top) return null;
    const backs = top.querySelectorAll('[data-back], #set-close, #legal-close, #pull-close');
    for (const b of backs) if (isVisible(b)) return b;
    return null;
  }

  /** Pestaña anterior (-1) o siguiente (+1): regiones de la colección, Ajustes, Misiones, ranking... */
  function stepTab(dir) {
    const top = topScreen();
    if (!top) return;
    const bar = [...top.querySelectorAll('.gen-tabs, .tabs')].find(isVisibleBar);
    if (!bar) return;
    const tabs = [...bar.querySelectorAll('.gen-tab, .tab')].filter(isVisible);
    if (tabs.length < 2) return;
    let i = tabs.findIndex(t => t.classList.contains('on'));
    if (i < 0) i = 0;
    tabs[(i + dir + tabs.length) % tabs.length].click();
    // La colección se redibuja al cambiar de región: el foco pasa a la pestaña activa nueva.
    requestAnimationFrame(() => {
      const on = [...top.querySelectorAll('.gen-tabs .gen-tab.on, .tabs .gen-tab.on, .tabs .tab.on')].find(isVisible);
      if (on) { setFocus(on); on.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); }
    });
  }
  function isVisibleBar(el) {
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2 && getComputedStyle(el).display !== 'none';
  }

  function readPad() {
    const out = { a: false, b: false, l: false, r: false, up: false, down: false, left: false, right: false };
    const swap = !!(G.Settings && G.Settings.get('padSwap'));
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const btn = i => p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5);
      // Standard: 0=A 1=B | 4=LB 5=RB 6=LT 7=RT | D-pad 12=Up 13=Down 14=Left 15=Right
      if (btn(swap ? 1 : 0)) out.a = true;
      if (btn(swap ? 0 : 1)) out.b = true;
      if (btn(4) || btn(6)) out.l = true;
      if (btn(5) || btn(7)) out.r = true;
      if (btn(12)) out.up = true;
      if (btn(13)) out.down = true;
      if (btn(14)) out.left = true;
      if (btn(15)) out.right = true;
      // Stick izquierdo
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (ay < -0.55) out.up = true;
      if (ay > 0.55) out.down = true;
      if (ax < -0.55) out.left = true;
      if (ax > 0.55) out.right = true;
    }
    // Teclado (pruebas en PC). Mientras se escribe en un campo no cuenta (si no, la Q o la E
    // de un apodo cambiarían de pestaña y la W, A, S, D moverían el foco).
    const ae = document.activeElement;
    const typing = !!ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);
    if (G.Input && !typing) {
      if (G.Input.held('escape')) out.b = true;
      if (G.Input.held('enter') || G.Input.held('space')) out.a = true;
      if (G.Input.held('keyq') || G.Input.held('pageup')) out.l = true;
      if (G.Input.held('keye') || G.Input.held('pagedown')) out.r = true;
      if (G.Input.held('arrowup') || G.Input.held('keyw')) out.up = true;
      if (G.Input.held('arrowdown') || G.Input.held('keys')) out.down = true;
      if (G.Input.held('arrowleft') || G.Input.held('keya')) out.left = true;
      if (G.Input.held('arrowright') || G.Input.held('keyd')) out.right = true;
    }
    return out;
  }

  function edge(cur, key) {
    const on = cur[key] && !prev[key];
    prev[key] = cur[key];
    return on;
  }

  function poll() {
    requestAnimationFrame(poll);
    if (!inMenu()) {
      if (focused) setFocus(null);
      opener = null;
      // reset edges so next press in menu works
      const cur = readPad();
      prev = cur;
      cool = 0;
      return;
    }
    injectStyle();
    ensureFocus();
    const cur = readPad();
    const now = performance.now();

    // (Los sonidos de pulsar y volver los pone ui.js al recibir el clic.)
    if (edge(cur, 'b')) {
      const back = visibleBack();
      if (back) {
        back.click();
        // Al volver al menú principal, el foco regresa al botón desde el que se entró.
        const menu = document.getElementById('scr-menu');
        if (opener && menu && topScreen() === menu && isVisible(opener)) setFocus(opener);
        else setFocus(null);
        opener = null;
      }
    }
    if (edge(cur, 'a')) {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && focused && isVisible(focused)) {
        const el = focused;
        if (el.matches('#scr-menu [data-go], #scr-menu .menu-item')) opener = el;
        el.click();
      }
    }
    if (edge(cur, 'l')) stepTab(-1);
    if (edge(cur, 'r')) stepTab(1);

    // Dirección: primer toque inmediato, luego repetición con cooldown
    let dx = 0, dy = 0;
    if (cur.up) dy = -1;
    else if (cur.down) dy = 1;
    else if (cur.left) dx = -1;
    else if (cur.right) dx = 1;

    const dirEdge = (cur.up && !prev.up) || (cur.down && !prev.down) ||
                    (cur.left && !prev.left) || (cur.right && !prev.right);
    prev.up = cur.up; prev.down = cur.down; prev.left = cur.left; prev.right = cur.right;

    if (dx || dy) {
      if (dirEdge || now > cool) {
        moveFocus(dx, dy);
        cool = now + (dirEdge ? 280 : 140);
      }
    } else {
      cool = 0;
    }
  }

  function init() {
    injectStyle();
    window.addEventListener('gamepadconnected', () => {});
    // Cualquier pulsación despierta el gamepad en algunos navegadores
    window.addEventListener('keydown', () => {});
    requestAnimationFrame(poll);
  }

  return { init, setFocus };
})();
