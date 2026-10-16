#!/usr/bin/env python3
"""Aplica las mejoras de PokéSurvivor sobre una copia local del repositorio."""
from pathlib import Path
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()

CHANGES = {
    "dev.html": [
        (
            '<input id="f-user" class="field" maxlength="16" spellcheck="false">',
            '<input id="f-user" class="field" type="text" maxlength="16" spellcheck="false" autocapitalize="none" autocorrect="off" autocomplete="username" inputmode="text" enterkeyhint="next">'
        ),
        (
            '<input id="f-pass" class="field" type="password" maxlength="64">',
            '<input id="f-pass" class="field" type="password" maxlength="64" autocomplete="current-password" enterkeyhint="go">'
        ),
        (
            '<p id="pause-coop" class="note hidden">Partida en grupo: el juego sigue mientras estás aquí.</p>',
            '<p id="pause-coop" class="note hidden">Partida en grupo: el juego sigue mientras estás aquí.</p>\n    <div id="pause-stats" class="pause-stats" aria-live="polite"></div>'
        ),
    ],
    "js/ui/login.js": [
        (
            "    document.querySelectorAll('#scr-login .tab').forEach(t => {\n      t.onclick = () => setMode(t.dataset.tab);\n    });",
            """    document.querySelectorAll('#scr-login .tab').forEach(t => {
      t.onclick = () => setMode(t.dataset.tab);
    });
    // iOS puede interpretar el nombre como un campo de contraseña y activar
    // el autocompletado/cambio de foco. Mantener el avance bajo control.
    $('f-user').setAttribute('autocapitalize', 'none');
    $('f-user').setAttribute('autocorrect', 'off');
    $('f-user').setAttribute('autocomplete', 'username');
    $('f-user').setAttribute('inputmode', 'text');
    $('f-user').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        $('f-pass').focus();
      }
    });"""
        ),
        (
            "    setTimeout(() => $('f-user').focus(), 50);",
            """    setTimeout(() => {
      // Evita que iOS restaure una selección/cursor anterior del campo.
      const user = $('f-user');
      user.setSelectionRange(user.value.length, user.value.length);
      user.focus();
    }, 50);"""
        ),
    ],
    "js/ui/run-ui.js": [
        (
            """    $('btn-quit').textContent = coop ? 'Salir de la partida' : 'Abandonar run';
    G.UI.show('scr-pause');""",
            """    $('btn-quit').textContent = coop ? 'Salir de la partida' : 'Abandonar run';
    const p = G.Game.player;
    const stats = $('pause-stats');
    if (p) {
      const fmt = n => Math.max(0, Math.floor(n || 0)).toLocaleString('es');
      stats.innerHTML =
        '<h3>Estadísticas de esta run</h3>' +
        `<div><span>Tiempo</span><b>${G.U.mmss(G.Game.st.time)}</b></div>` +
        `<div><span>Nivel</span><b>${fmt(p.level)}</b></div>` +
        `<div><span>Experiencia</span><b>${fmt(p.xp)} / ${fmt(p.xpNext)}</b></div>` +
        `<div><span>Pokémon derrotados</span><b>${fmt(p.kills)}</b></div>` +
        `<div><span>Jefes derrotados</span><b>${fmt(p.bosses)}</b></div>` +
        `<div><span>Monedas recogidas</span><b>${fmt(p.coins)}</b></div>`;
    } else {
      stats.innerHTML = '';
    }
    G.UI.show('scr-pause');"""
        ),
    ],
    "js/game.js": [
        (
            "    const record = time > save.stats.bestTime;",
            "    const record = time > save.stats.bestTime;\n    const bestLevelRecord = pl.level > (save.stats.bestLevel || 0);"
        ),
        (
            "    save.stats.bestTime = Math.max(save.stats.bestTime, Math.floor(time));",
            "    if (record) save.stats.bestTimeDex = pl.dex;\n    save.stats.bestTime = Math.max(save.stats.bestTime, Math.floor(time));"
        ),
        (
            "    save.stats.bestLevel = Math.max(save.stats.bestLevel, pl.level);",
            "    if (bestLevelRecord) save.stats.bestLevelDex = pl.dex;\n    save.stats.bestLevel = Math.max(save.stats.bestLevel, pl.level);"
        ),
    ],
    "js/ui/menu.js": [
        (
            """    $('menu-stats').innerHTML =
      `Runs <b style="color:#fff">${st.runs}</b> · Mejor tiempo <b style="color:#fff">${G.U.mmss(st.bestTime)}</b><br>` +
      `Mejor nivel <b style="color:#fff">${st.bestLevel}</b> · Derrotados <b style="color:#fff">${st.totalKills.toLocaleString('es')}</b>` +
      (G.DB.guest ? '<br><span style="color:#ffb0b8">Modo invitado: no se guarda</span>' : '');""",
            """    $('menu-stats').innerHTML =
      `Runs <b style="color:#fff">${st.runs}</b> · Mejor tiempo <b style="color:#fff">${G.U.mmss(st.bestTime)}</b> <canvas id="best-time-mon" class="record-mon" width="32" height="32" title="Pokémon del récord de tiempo"></canvas><br>` +
      `Mejor nivel <b style="color:#fff">${st.bestLevel}</b> <canvas id="best-level-mon" class="record-mon" width="32" height="32" title="Pokémon del récord de nivel"></canvas> · Derrotados <b style="color:#fff">${st.totalKills.toLocaleString('es')}</b>` +
      (G.DB.guest ? '<br><span style="color:#ffb0b8">Modo invitado: no se guarda</span>' : '');
    // En partidas antiguas sin Pokémon asociado, usar el compañero actual.
    const timeDex = G.DEX_BY[st.bestTimeDex] ? st.bestTimeDex : s.partner;
    const levelDex = G.DEX_BY[st.bestLevelDex] ? st.bestLevelDex : s.partner;
    if (G.DEX_BY[timeDex]) G.UI.sprite($('best-time-mon'), Number(timeDex), { scale: 1 });
    if (G.DEX_BY[levelDex]) G.UI.sprite($('best-level-mon'), Number(levelDex), { scale: 1 });"""
        ),
    ],
    "css/style.css": [
        (
            ".login-links a { color: #9fd4ff; }",
            """.login-links a { color: #9fd4ff; }
.record-mon { display: inline-block; width: 30px; height: 30px; vertical-align: middle; margin: -7px 2px -7px 3px; image-rendering: pixelated; }
.pause-stats { margin: 10px auto 12px; padding: 9px 12px; width: min(320px, 100%); text-align: left; border: 1px solid rgba(244,248,255,.2); border-radius: 8px; background: rgba(0,0,0,.18); }
.pause-stats h3 { margin: 0 0 5px; color: var(--gold); font-size: 15px; }
.pause-stats div { display: flex; justify-content: space-between; gap: 12px; padding: 2px 0; font-size: 13px; }
.pause-stats span { color: var(--muted); }
.pause-stats b { color: var(--ink); font-variant-numeric: tabular-nums; }"""
        ),
    ],
}

def main():
    errors = []
    staged = {}
    for rel, replacements in CHANGES.items():
        path = ROOT / rel
        if not path.is_file():
            errors.append(f"No encuentro {rel}")
            continue
        original = path.read_text(encoding="utf-8")
        updated = original
        for old, new in replacements:
            count = updated.count(old)
            if count != 1:
                errors.append(f"{rel}: esperaba encontrar una vez un bloque; encontré {count}. No se modificó.")
                break
            updated = updated.replace(old, new, 1)
        else:
            staged[path] = updated

    if errors:
        print("No se aplicaron cambios porque la estructura no coincide exactamente:")
        print("\n".join(errors))
        print("Usa una copia actual del repositorio antes de volver a intentarlo.")
        sys.exit(1)

    for path, content in staged.items():
        backup = path.with_suffix(path.suffix + ".bak")
        if not backup.exists():
            backup.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
        path.write_text(content, encoding="utf-8")
        print(f"Modificado: {path.relative_to(ROOT)} (copia: {backup.name})")
    print("\nCambios aplicados. Revisa el juego en navegador antes de publicar.")

if __name__ == "__main__":
    main()
