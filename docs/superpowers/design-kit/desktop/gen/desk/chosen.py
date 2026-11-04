"""The chosen frame (agreed 2026-11-03): one short band row — the title left (from the window's
edge), the page's toggles centred over the content, the actions right as on the phone — and a
narrow band-coloured side with the four tabs at the top and Settings at the bottom.

The open questions (rows 2-4) are redrawn in it on the canvas page "In the chosen frame"; the
frame explorations move to the page "Frame explorations".

    python3 -I chosen.py  -> rebuilds the whole canvas
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import desk  # noqa: E402
from desk import kit, ts, CREAM  # noqa: E402
import options as O  # noqa: E402
import sidevar as SV  # noqa: E402
import toprow  # noqa: E402,F401  (registers rows 6 and 7)

SIDE = 188
ROW_H = 88


# --------------------------------------------------------------------------
# the frame
# --------------------------------------------------------------------------

def top_row(t, title, sub=None, back='', center='', right=''):
    s = f'<span style="{ts("subtitle", t["band_small"])}; white-space: nowrap; padding-top: 10px">{sub}</span>' if sub else ''
    lead = (f'<div style="display: flex; align-items: center; gap: 14px; min-width: 0; margin-left: -{SIDE - (18 if back else 30)}px">'
            f'{back}<h1 style="margin: 0; {ts("display", CREAM)}; white-space: nowrap">{title}</h1>{s}</div>')
    mid = f'<div style="display: flex; justify-content: center">{center}</div>'
    r = f'<div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-right: -10px">{right}</div>'
    return (f'<header style="position: absolute; top: 0; left: {SIDE}px; right: 0; height: {ROW_H}px; box-sizing: border-box; padding: 0 40px 0 0; '
            f'display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 24px; z-index: 1">{lead}{mid}{r}</header>')


def side(t, active):
    tabs = ''.join(desk.side_item(t, g, l, l == active) for g, l in desk.NAV[:4])
    settings = desk.side_item(t, 'settings', 'Settings', active == 'Settings')
    return (f'<aside style="position: absolute; top: {ROW_H}px; left: 0; bottom: 0; width: {SIDE}px; box-sizing: border-box; padding: 6px 12px 20px; '
            f'display: flex; flex-direction: column"><nav aria-label="Main" style="display: flex; flex-direction: column; gap: 4px">{tabs}</nav>'
            f'<div style="margin-top: auto">{settings}</div></aside>')


def frame(t, active, head, body, overlay=''):
    return SV.root(t, head + side(t, active) + SV.sheet(t, ROW_H, SIDE, body) + overlay)


# --------------------------------------------------------------------------
# the earlier boards, redrawn: their frame_a / head_a calls are routed here
# --------------------------------------------------------------------------

def _head(t, title, subtitle=None, left='', right='', extra='', tall=True, center=False):
    return top_row(t, title, subtitle, back=left, center=extra.replace('padding-left: 40px', ''), right=right)


def _pill(t, text, icon_name=None):
    """The phone's bare cream icon, named for screen readers."""
    return kit.band_button(t, icon_name or 'plus', text)


def _frame(t, active, head, body, overlay=''):
    return frame(t, active, head, body, overlay)


def in_frame(fn):
    def draw(t):
        saved = desk.frame_a, desk.head_a, desk.band_pill_button
        desk.frame_a, desk.head_a, desk.band_pill_button = _frame, _head, _pill
        try:
            return fn(t)
        finally:
            desk.frame_a, desk.head_a, desk.band_pill_button = saved
    return draw


# --------------------------------------------------------------------------
# the canvas: two pages
# --------------------------------------------------------------------------

O.PAGES[:] = [{'id': 'chosen', 'name': 'In the chosen frame'}, {'id': 'explore', 'name': 'Frame explorations'}]
O.LAUNCH.clear()
O.LAUNCH.update({'view': 'canvas', 'page': 'chosen'})
O.ROWS[:] = [(r[0], r[1], 'explore') for r in O.ROWS]

O.ROWS += [
    ('Decided (2026-11-03): the frame, list beside page, two-column figure, dialogs', [
        ('D-today.dc.html', 'The frame · Today', in_frame(O.q1_a)),
        ('D2-A-side-by-side.dc.html', '2A · A list and the open item side by side', in_frame(O.q2_a)),
        ('D3-A-two-columns.dc.html', '3A · A figure: about on the left, videos on the right', in_frame(O.q3_a)),
        ('D4-B-dialog.dc.html', '4B · A popup is a dialog in the middle', in_frame(O.q4_b)),
    ], 'chosen'),
    ('Not picked: 2B, 3B, 4A, 4C', [
        ('D2-B-table.dc.html', '2B · The list as a table, the page on its own', in_frame(O.q2_b)),
        ('D3-B-video-first.dc.html', '3B · The video first, everything else under it', in_frame(O.q3_b)),
        ('D4-A-side-panel.dc.html', '4A · A panel on the right, the page stays usable', in_frame(O.q4_a)),
        ('D4-C-workbench.dc.html', '4C · No popup: Today keeps the exercise open beside the list', in_frame(O.q4_c)),
    ], 'explore'),
]

if __name__ == '__main__':
    O.build()
