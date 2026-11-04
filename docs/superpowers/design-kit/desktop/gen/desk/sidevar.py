"""Row 6: frame A with everything on the left — the nav at the bottom by Settings, the page's
controls in the side, the title top-left and the only thing that runs right.

    python3 -I sidevar.py  -> adds row 6 to the canvas and rebuilds it
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import desk  # noqa: E402
from desk import kit, icon, ts, CREAM  # noqa: E402
import options as O  # noqa: E402

SIDE = 248


# --------------------------------------------------------------------------
# the side's pieces
# --------------------------------------------------------------------------

def nav_rows(t, active, h=48):
    rows = ''.join(desk.side_item(t, g, l, l == active).replace('height: 48px', f'height: {h}px') for g, l in desk.NAV)
    return (f'<nav aria-label="Main" style="display: flex; flex-direction: column; gap: 4px; padding-top: 14px; '
            f'border-top: 1px solid {t["band_track"]}">{rows}</nav>')


def side_label(t, text):
    return f'<span style="{ts("label", t["band_small"])}; padding: 0 14px; opacity: 0.85">{text}</span>'


def side_seg(t, items, sel, lab):
    out = ''
    for i, it in enumerate(items):
        on = i == sel
        bg, fg, fw = (CREAM, t['band'], 800) if on else ('transparent', t['band_small'], 700)
        out += (f'<button type="button" aria-pressed="{"true" if on else "false"}" style="height: 40px; border: 0; border-radius: 20px; background: {bg}; '
                f'color: {fg}; font-size: 15px; font-weight: {fw}; text-align: left; padding: 0 16px; cursor: pointer">{it}</button>')
    return (f'<div role="group" aria-label="{lab}" style="background: {t["band_track"]}; border-radius: 24px; padding: 4px; '
            f'display: flex; flex-direction: column; gap: 2px">{out}</div>')


def side_back(t, text):
    return (f'<a href="#" style="height: 44px; display: flex; align-items: center; gap: 6px; padding: 0 10px; text-decoration: none; '
            f'color: {t["band_small"]}; font-size: 15px; font-weight: 800">{icon("back", 22, t["band_small"])}{text}</a>')


def side_list(t, items, sel, plus):
    out = ''
    for i, it in enumerate(items):
        on = i == sel
        bg, fg, fw = (CREAM, t['band'], 800) if on else ('transparent', t['band_small'], 700)
        cur = ' aria-current="page"' if on else ''
        out += (f'<a href="#"{cur} style="height: 40px; border-radius: 20px; background: {bg}; color: {fg}; font-size: 15px; font-weight: {fw}; '
                f'display: flex; align-items: center; padding: 0 16px; text-decoration: none">{it}</a>')
    out += (f'<button type="button" style="height: 40px; border-radius: 20px; border: 1.5px dashed {kit.rgba(CREAM, 0.55)}; background: none; '
            f'color: {t["band_small"]}; font-size: 15px; font-weight: 800; display: flex; align-items: center; gap: 6px; padding: 0 14px; cursor: pointer">'
            f'{icon("plus", 18, t["band_small"])}{plus}</button>')
    return f'<nav aria-label="Variations" style="display: flex; flex-direction: column; gap: 4px">{out}</nav>'


def side_pill(t, text, icon_name, ghost=False):
    bg, fg = (t['band_track'], t['band_small']) if ghost else (CREAM, t['band'])
    return (f'<button type="button" style="height: 44px; border: 0; border-radius: 22px; background: {bg}; color: {fg}; font-size: 15px; font-weight: 800; '
            f'display: flex; align-items: center; gap: 8px; padding: 0 16px 0 14px; cursor: pointer">{icon(icon_name, 20, fg, bg=bg if not ghost else t["band"])}{text}</button>')


def title_h(t, text, size='display'):
    return f'<h1 style="margin: 0; {ts(size, CREAM)}; white-space: nowrap">{text}</h1>'


def sub_inline(t, text):
    return f'<span style="{ts("subtitle", t["band_small"])}; white-space: nowrap">{text}</span>' if text else ''


def corner(left, top, band):
    """Rounds the sheet where the band turns a corner around it (an inside curve)."""
    return (f'<div aria-hidden="true" style="position: absolute; left: {left}; top: {top}; width: 28px; height: 28px; '
            f'background: radial-gradient(circle at 100% 100%, transparent 27.5px, {band} 28px)"></div>')


def root(t, inner):
    return (f'<div style="width: {desk.W}px; height: {desk.H}px; position: relative; overflow: hidden; background: {t["band"]}; color: {t["ink"]}; '
            f'{kit.MANROPE}">{inner}</div>')


def sheet(t, top, left, body):
    return (f'<main style="position: absolute; top: {top}px; left: {left}px; right: 0; bottom: 0; background: {t["ground"]}; border-radius: 28px 0 0 0; '
            f'overflow: hidden; display: flex; flex-direction: column">{body}</main>')


def side(t, top, controls, active, pad_top=6):
    return (f'<aside style="position: absolute; top: {top}px; left: 0; bottom: 0; width: {SIDE}px; box-sizing: border-box; padding: {pad_top}px 16px 20px; '
            f'display: flex; flex-direction: column; gap: 10px">{controls}<div style="margin-top: auto">{nav_rows(t, active)}</div></aside>')


# --------------------------------------------------------------------------
# 6A: a short strip — the title runs across, the sheet starts under it
# --------------------------------------------------------------------------

def frame_strip(t, active, title, sub, controls, body):
    strip = (f'<header style="position: absolute; top: 0; left: 0; right: 0; height: 92px; box-sizing: border-box; padding: 0 40px 0 30px; '
             f'display: flex; align-items: center; gap: 18px">{title_h(t, title)}<span style="padding-top: 12px">{sub_inline(t, sub)}</span></header>')
    return root(t, strip + side(t, 92, controls, active) + sheet(t, 92, SIDE, body))


# --------------------------------------------------------------------------
# 6B: the title is a tab of the band; the sheet rises to the top beside it
# --------------------------------------------------------------------------

def frame_tab(t, active, title, sub, controls, body):
    tab = (f'<header style="position: absolute; top: 0; left: 0; height: 92px; box-sizing: border-box; min-width: {SIDE}px; padding: 0 36px 0 30px; '
           f'background: {t["band"]}; border-radius: 0 0 28px 0; display: flex; align-items: center; gap: 18px; z-index: 2">'
           f'{title_h(t, title)}<span style="padding-top: 12px">{sub_inline(t, sub)}</span>'
           f'{corner("100%", "14px", t["band"])}</header>')
    return root(t, sheet(t, 14, SIDE, '<div style="height: 66px; flex: none"></div>' + body) + tab + corner(f'{SIDE}px', '92px', t['band']) + side(t, 92, controls, active))


# --------------------------------------------------------------------------
# 6C: no top band — the title heads the side, the sheet is nearly the whole window
# --------------------------------------------------------------------------

def frame_column(t, active, title, sub, controls, body, back=''):
    s = f'<span style="{ts("subtitle", t["band_small"])}">{sub}</span>' if sub else ''
    head = (f'{back}<div style="display: flex; flex-direction: column; gap: 4px; padding: 0 6px 6px">'
            f'<h1 style="margin: 0; {ts("display_s", CREAM)}; font-size: 38px; line-height: 1.05; overflow-wrap: anywhere">{title}</h1>{s}</div>'
            '<div style="height: 10px; flex: none"></div>')
    return root(t, side(t, 0, head + controls, active, pad_top=26) + sheet(t, 12, SIDE, body))


# --------------------------------------------------------------------------
# the pages
# --------------------------------------------------------------------------

def moves_controls(t):
    return (side_seg(t, ['Figures', 'Routines'], 0, 'Moves') + '<div style="height: 4px"></div>'
            + side_pill(t, 'New figure', 'plus'))


def figure_controls(t, back=True):
    b = side_back(t, 'Moves') if back else ''
    return (b + side_label(t, 'Variations · 3')
            + side_list(t, ['Basic', 'Doble', 'Complicada'], 1, 'Variation')
            + '<div style="height: 6px"></div>'
            + side_pill(t, 'Edit Doble', 'edit') + side_pill(t, 'More', 'more', ghost=True))


def figure_body(t):
    return O.q3_a_body(t)


def moves_body(t):
    return O.q2_a_body(t).replace('padding: 26px 40px; box-sizing', 'padding: 26px 32px; box-sizing', 1)


def s6a_moves(t):
    return frame_strip(t, 'Moves', 'Moves', None, moves_controls(t), moves_body(t))


def s6a_figure(t):
    return frame_strip(t, 'Moves', 'Enchufla', 'Doble', figure_controls(t), figure_body(t))


def s6b_moves(t):
    return frame_tab(t, 'Moves', 'Moves', None, moves_controls(t), moves_body(t))


def s6b_figure(t):
    return frame_tab(t, 'Moves', 'Enchufla', 'Doble', figure_controls(t), figure_body(t))


def s6c_moves(t):
    return frame_column(t, 'Moves', 'Moves', None, moves_controls(t), moves_body(t))


def s6c_figure(t):
    return frame_column(t, 'Moves', 'Enchufla', 'Doble', figure_controls(t, back=False), figure_body(t),
                        back=side_back(t, 'Moves'))


def s6a_today(t):
    return frame_strip(t, 'Today', 'Today', O.DATE, side_pill(t, 'Previous day', 'chevron-left', ghost=True), O.today_two_cols(t))


O.ROWS.append(('6 · Everything on the left: the nav at the bottom, the page’s controls in the side', [
    ('Q6-A1-strip-moves.dc.html', '6A · A short strip: the title runs across, the sheet starts under it', s6a_moves),
    ('Q6-A2-strip-figure.dc.html', '6A · The same, a figure (Back, variations and Edit in the side)', s6a_figure),
    ('Q6-B1-tab-moves.dc.html', '6B · The title is a tab of the band; the sheet rises to the top beside it', s6b_moves),
    ('Q6-B2-tab-figure.dc.html', '6B · The same, a figure', s6b_figure),
    ('Q6-C1-column-moves.dc.html', '6C · No top band: the title heads the side', s6c_moves),
    ('Q6-C2-column-figure.dc.html', '6C · The same, a figure', s6c_figure),
]))

if __name__ == '__main__':
    O.build()
