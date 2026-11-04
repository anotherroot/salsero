"""Row 7: one short top row on the band — the title left, the page's toggles centred over the
content, the actions at the right as on the phone. The side holds only the nav.

    python3 -I toprow.py  -> adds rows 6 and 7 to the canvas and rebuilds it
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import desk  # noqa: E402
from desk import kit, icon, ts, CREAM  # noqa: E402
import options as O  # noqa: E402
import sidevar as SV  # noqa: E402  (registers row 6)

SIDE = SV.SIDE
ROW_H = 88


def top_row(t, title, sub=None, back='', center='', right=''):
    """The band's one row. The grid spans the content (so the centre sits over the panel); the
    title column reaches back over the side to start at the window's left edge."""
    s = f'<span style="{ts("subtitle", t["band_small"])}; white-space: nowrap; padding-top: 10px">{sub}</span>' if sub else ''
    lead = (f'<div style="display: flex; align-items: center; gap: 14px; min-width: 0; margin-left: -{SIDE - (18 if back else 30)}px">'
            f'{back}<h1 style="margin: 0; {ts("display", CREAM)}; white-space: nowrap">{title}</h1>{s}</div>')
    mid = f'<div style="display: flex; justify-content: center">{center}</div>'
    r = f'<div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-right: -10px">{right}</div>'
    return (f'<header style="position: absolute; top: 0; left: {SIDE}px; right: 0; height: {ROW_H}px; box-sizing: border-box; padding: 0 40px 0 0; '
            f'display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 24px">{lead}{mid}{r}</header>')


def frame(t, active, head, body, nav_top=False):
    if nav_top:
        tabs = ''.join(desk.side_item(t, g, l, l == active) for g, l in desk.NAV[:4])
        settings = desk.side_item(t, 'settings', 'Settings', active == 'Settings')
        side = (f'<aside style="position: absolute; top: {ROW_H}px; left: 0; bottom: 0; width: {SIDE}px; box-sizing: border-box; padding: 6px 16px 20px; '
                f'display: flex; flex-direction: column; gap: 4px"><nav aria-label="Main" style="display: flex; flex-direction: column; gap: 4px">{tabs}</nav>'
                f'<div style="margin-top: auto">{settings}</div></aside>')
    else:
        side = (f'<aside style="position: absolute; top: {ROW_H}px; left: 0; bottom: 0; width: {SIDE}px; box-sizing: border-box; padding: 0 16px 20px; '
                f'display: flex; flex-direction: column; justify-content: flex-end">{SV.nav_rows(t, active)}</aside>')
    return SV.root(t, head + side + SV.sheet(t, ROW_H, SIDE, body))


def seg(t, items, sel, lab, width=340):
    return f'<div style="width: {width}px">{kit.segmented(t, items, sel, on_band=True, label=lab)}</div>'


def s7_today(t, nav_top=False):
    head = top_row(t, 'Today', O.DATE, right=O.prev_day(t))
    return frame(t, 'Today', head, O.today_two_cols(t), nav_top)


def s7_moves(t, nav_top=False):
    head = top_row(t, 'Moves', center=seg(t, ['Figures', 'Routines'], 0, 'Moves'),
                   right=kit.band_button(t, 'plus', 'New figure'))
    return frame(t, 'Moves', head, SV.moves_body(t), nav_top)


def s7_figure(t):
    head = top_row(t, 'Enchufla', back=kit.band_button(t, 'back', 'Back to Moves'),
                   center=desk.var_tabs(t, ['Basic', 'Doble', 'Complicada'], 1),
                   right=kit.band_button(t, 'edit', 'Edit Doble') + kit.band_button(t, 'more', 'More'))
    return frame(t, 'Moves', head, O.q3_a_body(t))


O.ROWS.append(('7 · One short top row: title left, toggles in the middle, actions right', [
    ('Q7-A-today.dc.html', '7 · Today: the date beside the title, ‹ previous day at the right', s7_today),
    ('Q7-B-moves.dc.html', '7 · Moves: Figures | Routines centred over the content, + at the right', s7_moves),
    ('Q7-C-figure.dc.html', '7 · A figure: ‹ and the name left, the variations centred, Edit and ⋯ right', s7_figure),
    ('Q7-D-moves-nav-top.dc.html', '7 · The same Moves with the nav at the top of the side instead', lambda t: s7_moves(t, nav_top=True)),
]))

if __name__ == '__main__':
    O.build()
