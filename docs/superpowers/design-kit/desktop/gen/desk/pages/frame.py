"""The agreed desktop frame and its building blocks (docs/superpowers/specs/2026-11-03-desktop-design.md).

Every board is 1440 x 900. Colours only from ``t`` (a kit theme). An area module (today.py, moves.py, ...)
defines SECTION = (id, name) and BOARDS = [Board(...)], each fn(t) returning a whole board via ``frame``.
"""
import os
import sys
from dataclasses import dataclass, field
from typing import Callable

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))  # gen/desk
import desk  # noqa: E402
from desk import kit, ts, icon, CREAM  # noqa: E402

W, H = 1440, 900
SIDE = 188
ROW_H = 88
LIST_W = 360
SIDE_PAD = 22   # the side's buttons are 144 wide, centred in the 188 side (round 3)


@dataclass
class Board:
    id: str                      # unique, kebab-case
    title: str                   # what it shows ("Moves · a figure open beside the list")
    fn: Callable                 # fn(t) -> board html
    note: str = ''               # one or two lines for the reviewer: what to look at, a call made
    themes: tuple = ('salsa-light', 'salsa-dark', 'bachata-light', 'bachata-dark')
    tags: list = field(default_factory=list)
    option: str = ''             # 'A', 'B', 'A1' ...: one of several ways to do the same thing
    rec: bool = False            # the option I recommend
    changed: bool = False        # redrawn in this round


def esc(s):
    return kit.esc(s)


# --------------------------------------------------------------------------
# the frame
# --------------------------------------------------------------------------

def root(t, inner):
    # data-art-layer: the band's art (a gradient, dancers, waves...), drawn by the viewer's CSS from <html data-band-art>.
    # It sits under the band row and the side; the sheet covers the rest. Plain when no art is picked.
    art = '<div data-art-layer aria-hidden="true" style="position: absolute; inset: 0; pointer-events: none"></div>'
    return (f'<div style="width: {W}px; height: {H}px; position: relative; overflow: hidden; background: {t["band"]}; color: {t["ink"]}; '
            f'{kit.MANROPE}">{art}{inner}</div>')


def is_long(title):
    return len(title) > 18 or any(len(w) > 10 for w in title.split())


def _titled(t, title, style, group):
    h = f'<h1 style="margin: 0; {style}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0">{title}</h1>'
    if not group:
        return h
    line = (f'<span style="display: flex; align-items: center; gap: 6px; color: {t["band_small"]}; font-size: 13px; font-weight: 700; white-space: nowrap">'
            f'{icon("people", 16, t["band_small"])}{esc(group)} · group</span>')
    return f'<div style="display: flex; flex-direction: column; gap: 4px; min-width: 0">{line}{h}</div>'


def band_row(t, title, sub=None, back=None, center='', right='', side=True, compact=None, group=None):
    """The 88 px band row: title left (from the window edge), toggles centred over the sheet, actions right."""
    compact = is_long(title) if compact is None else compact
    style = ts('display_s' if compact else 'display', CREAM)
    s = (f'<span style="{ts("subtitle", t["band_small"])}; white-space: nowrap; padding-top: {6 if compact else 10}px; flex: none">{sub}</span>'
         if sub else '')
    reach = (SIDE - (18 if back else 30)) if side else 0
    pad_l = 0 if side else (18 if back else 30)
    lead = (f'<div style="display: flex; align-items: center; gap: 14px; min-width: 0; margin-left: -{reach}px">'
            f'{back or ""}{_titled(t, title, style, group)}{s}</div>')
    mid = f'<div style="display: flex; justify-content: center; align-items: center">{center}</div>'
    r = f'<div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-right: -10px">{right}</div>'
    left = SIDE if side else 0
    return (f'<header style="position: absolute; top: 0; left: {left}px; right: 0; height: {ROW_H}px; box-sizing: border-box; padding: 0 40px 0 {pad_l}px; '
            f'display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 24px; z-index: 1">{lead}{mid}{r}</header>')


def side_nav(t, active, group=None, dot=False):
    """The side: the five tabs at the top, Settings at the bottom.
    group: in group mode Today is not a tab but a plain Mine button (back icon, no fill).
    dot: something new in your groups (a dot on Groups, never a number)."""
    rows = ''
    for g, l in desk.NAV[:5]:
        if l == 'Today' and group:
            rows += (f'<a href="#" style="height: 48px; padding: 0 18px 0 14px; border-radius: 24px; color: {t["band_small"]}; '
                     f'display: flex; align-items: center; gap: 12px; text-decoration: none; font-size: 16px; font-weight: 800">'
                     f'{icon("back", 24, t["band_small"])}Mine</a>')
            continue
        item = desk.side_item(t, g, l, l == active)
        if l == 'Groups' and dot:
            col_ = t['band'] if l == active else CREAM
            item = item.replace(f'{l}</a>', f'{l}<span aria-label="New in your groups" style="width: 9px; height: 9px; border-radius: 50%; '
                                f'background: {col_}; margin-left: -4px; align-self: flex-start; margin-top: 12px"></span></a>')
        rows += item
    if active == 'Settings':  # the kit has no filled sliders icon: the lit pill keeps the outline one
        settings = (f'<a href="#" aria-current="page" style="height: 48px; padding: 0 18px 0 14px; border-radius: 24px; background: {CREAM}; color: {t["band"]}; '
                    f'display: flex; align-items: center; gap: 12px; text-decoration: none; font-size: 16px; font-weight: 800">'
                    f'{icon("settings", 24, t["band"], bg=CREAM)}Settings</a>')
    else:
        settings = desk.side_item(t, 'settings', 'Settings', False)
    return (f'<aside style="position: absolute; top: {ROW_H}px; left: 0; bottom: 0; width: {SIDE}px; box-sizing: border-box; padding: 6px {SIDE_PAD}px 20px; '
            f'display: flex; flex-direction: column"><nav aria-label="Main" style="display: flex; flex-direction: column; gap: 4px">{rows}</nav>'
            f'<div style="margin-top: auto">{settings}</div></aside>')


def sheet(t, body, side=True):
    left = SIDE if side else 0
    radius = '28px 0 0 0' if side else '28px 28px 0 0'
    return (f'<main style="position: absolute; top: {ROW_H}px; left: {left}px; right: 0; bottom: 0; background: {t["ground"]}; border-radius: {radius}; '
            f'overflow: hidden; display: flex; flex-direction: column">{body}</main>')


def frame(t, active, title, body, sub=None, back=None, center='', right='', overlay='', side=True, compact=None, group=None, dot=False):
    """A whole board. active: 'Today' | 'Moves' | 'Lessons' | 'Groups' | 'Music' | 'Settings'. side=False: Practice, share.
    body: the sheet's content (use page / two_col_page / split). overlay: a dialog() / question() / toast().
    group: the group's name when in GROUP MODE. Build the board with t = in_group(t) first, so the band,
    the side and every accent are navy; the frame adds the striped edge, the "<name> · group" line and Mine.
    dot: the Groups tab's "something new" dot."""
    head = band_row(t, title, sub, back, center, right, side, compact, group)
    nav = side_nav(t, active, group, dot) if side else ''
    edge = group_edge(t) if group else ''
    return root(t, edge + head + nav + sheet(t, body, side) + overlay)


def group_edge(t):
    """Group mode: a thin striped edge along the window's top, from the band's own ink."""
    return ('<div aria-hidden="true" style="position: absolute; top: 0; left: 0; right: 0; height: 6px; z-index: 2; '
            'background: repeating-linear-gradient(135deg, rgba(234,240,255,0.35) 0 6px, transparent 6px 12px)"></div>')


def in_group(t):
    """Group mode's palette (tokens.ts GROUP): navy in place of the dance's colour, in both dances."""
    t = dict(t)
    light = t['ground'].lower() not in ('#0b0b0d',)
    acc = '#3a55a8' if light else '#8fa8ff'
    t.update(band='#26345E', band_small='#EAF0FF', accent=acc, accent_text=acc, status=acc,
             accent_soft=('#e7ebf5' if light else '#2a3044'), on_accent=('#ffffff' if light else '#0b0b0d'),
             inverse_accent=('#9db4ff' if light else '#3a55a8'), tab_tint=('#e7ebf5' if light else '#2a3044'),
             band_track='rgba(234,240,255,0.16)', band_shadow='rgba(10,16,40,0.3)', focus=acc, focus_halo=acc + '33')
    return t


def group_btn(t, inside=False):
    """The round group button beside + on Moves, Lessons and Music (owners and editors only):
    Work in a group outside, Switch group inside."""
    return kit.band_button(t, 'people', 'Switch group' if inside else 'Work in a group')


def back_btn(t, to='Back'):
    """‹ on the band, before the title."""
    return kit.band_button(t, 'back', f'Back to {to}' if to != 'Back' else 'Back')


def act(t, icon_name, label):
    """A bare cream icon on the band's right (New +, Edit pencil, More ⋯ ...)."""
    return kit.band_button(t, icon_name, label)


def seg(t, items, sel, label, width=None):
    """The segmented switch on the band (cream pill on the dark track)."""
    w = width or 170 * len(items)
    return f'<div style="width: {w}px">{kit.segmented(t, items, sel, on_band=True, label=label)}</div>'


def band_text_button(t, text):
    """A text action on the band (Select on Coverage)."""
    return (f'<button type="button" style="height: 44px; border: 0; background: none; padding: 0 12px; color: {CREAM}; font-size: 16px; font-weight: 800; '
            f'cursor: pointer">{text}</button>')


def band_pill(t, text, icon_name=None):
    """A cream pill on the band (Back to today)."""
    ic = icon(icon_name, 18, t['band'], bg=CREAM) if icon_name else ''
    return (f'<a href="#" style="height: 40px; padding: 0 18px 0 {12 if icon_name else 18}px; border-radius: 20px; background: {CREAM}; color: {t["band"]}; '
            f'display: inline-flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 800; text-decoration: none">{ic}{text}</a>')


# --------------------------------------------------------------------------
# sheet layouts
# --------------------------------------------------------------------------

def col(inner, gap=8, extra=''):
    return f'<div style="display: flex; flex-direction: column; gap: {gap}px; min-width: 0; {extra}">{inner}</div>'


def label(t, text, top=0, trailing=None):
    return kit.section_label(t, text, top, trailing)


def scroll(inner, pad='28px 40px 40px', max_w=720, gap=8, left=False):
    """A scrolling area, content centred at max_w (720 one column, 1140 two). left: aligned left (a pane under its header)."""
    mw = (f'max-width: {max_w}px; margin: 0 {"auto 0 0" if left else "auto"}; ' if max_w else '')
    return (f'<div style="flex: 1; min-height: 0; overflow: hidden; box-sizing: border-box; padding: {pad}">'
            f'<div style="{mw}display: flex; flex-direction: column; gap: {gap}px">{inner}</div></div>')


def page(inner, max_w=720, footer='', pad='28px 40px 40px', gap=8):
    """One column, centred. footer: pinned() at the bottom of the sheet."""
    return scroll(inner, pad, max_w, gap) + footer


def cols(left, right, ratio=('1fr', '1fr'), gap=32):
    return (f'<div style="display: grid; grid-template-columns: minmax(0, {ratio[0]}) minmax(0, {ratio[1]}); gap: {gap}px; align-items: start">'
            f'{col(left)}{col(right)}</div>')


def two_col_page(left, right, ratio=('1fr', '1fr'), max_w=1140, footer='', pad='28px 40px 40px', top=''):
    """Two columns, centred at max_w. top: full-width content above the columns."""
    return scroll(top + cols(left, right, ratio), pad, max_w) + footer


def pinned(t, inner, max_w=720, bg=None):
    """A bar pinned to the bottom of the sheet or pane (Save, Log a set, Play, a selection bar)."""
    return (f'<div style="flex: none; border-top: 1px solid {t["hairline"]}; background: {bg or t["ground"]}; padding: 14px 40px 20px">'
            f'<div style="max-width: {max_w}px; margin: 0 auto; display: flex; gap: 10px; align-items: center">{inner}</div></div>')


# --------------------------------------------------------------------------
# a list and the item beside it (2A)
# --------------------------------------------------------------------------

def split(t, list_inner, pane_html, list_label='List', width=LIST_W):
    """The sheet as two panes: the list (360) and the open item."""
    lst = (f'<section aria-label="{list_label}" style="width: {width}px; flex: none; box-sizing: border-box; border-right: 1px solid {t["hairline"]}; '
           f'padding: 24px 20px 0 24px; overflow: hidden; display: flex; flex-direction: column; gap: 10px">{list_inner}</section>')
    return f'<div style="flex: 1; min-height: 0; display: flex">{lst}{pane_html}</div>'


def lit(t, row_html):
    """Mark a list row as the open one (tinted, aria-current)."""
    return (row_html.replace('background: transparent', f'background: {t["accent_soft"]}', 1)
            .replace('<a href="#"', '<a href="#" aria-current="page"', 1))


def tonal(t, name, lab):
    return kit.icon_button(t, name, lab, 'tonal', on=t['ground'])


def pane_head(t, title, sub=None, back=False, actions='', below=''):
    """The open item's header: ‹ (only when opened from elsewhere), its name, subtitle, actions (tonal icons)."""
    b = kit.icon_button(t, 'back', 'Back', 'bare', on=t['ground']) if back else ''
    s = f'<span style="{ts("subtitle", t["muted"])}">{sub}</span>' if sub else ''
    return (f'<div style="display: flex; flex-direction: column; gap: 12px; flex: none; padding: 24px 40px 4px">'
            f'<div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px">'
            f'<div style="display: flex; align-items: center; gap: 6px; min-width: 0; margin-left: {-10 if back else 0}px">{b}'
            f'<div style="display: flex; flex-direction: column; gap: 4px; min-width: 0">'
            f'<h2 style="margin: 0; {ts("display_s", t["ink"])}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{title}</h2>{s}</div></div>'
            f'<div style="display: flex; gap: 8px; flex: none">{actions}</div></div>{below}</div>')


def pane(t, head, body, footer='', label_='Open item'):
    """The item pane: head (pane_head), body (pane_body / pane_cols), footer (pinned)."""
    return (f'<section aria-label="{label_}" style="flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden">'
            f'{head}{body}{footer}</section>')


def pane_body(inner, max_w=720, pad='18px 40px 40px', gap=8):
    """The open item's content, left-aligned under its header."""
    return scroll(inner, pad, max_w, gap, left=True)


def pane_cols(left, right, ratio=('5fr', '7fr'), pad='18px 40px 40px', top=''):
    """3A inside the pane: about left, videos right (the pane at 1440 is 892 wide: two columns)."""
    return scroll(top + cols(left, right, ratio), pad, 1140)


def empty_pane(t, icon_name, title, body, action=None):
    return (f'<section aria-label="Nothing open" style="flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center">'
            f'{kit.empty_state(t, icon_name, title, body, action)}</section>')


# --------------------------------------------------------------------------
# overlays (4B)
# --------------------------------------------------------------------------

def scrim(t):
    return f'<div aria-hidden="true" style="position: absolute; inset: 0; background: {t["scrim"]}; z-index: 2"></div>'


def dialog(t, title, inner, sub=None, footer='', actions='', back=False, width=560, height=None, below=False):
    """A bottom sheet as a centred dialog: header (title, sub, actions, × or Back), body, pinned footer.
    height: fixed px (else as tall as the content, at most 836). below: draw a second, hidden level under it
    (a stacked level shows only one scrim)."""
    hid = kit.uid('dlg')
    lead = kit.icon_button(t, 'back', 'Back', 'bare', on=t['sheet_bg']) if back else ''
    close = '' if back else kit.icon_button(t, 'close', 'Close', 'bare', on=t['sheet_bg'])
    sb = f'<span style="font-size: 13px; line-height: 1.4; color: {t["muted"]}">{sub}</span>' if sub else ''
    ft = (f'<div style="padding: 14px 28px 22px; border-top: 1px solid {t["hairline"]}; display: flex; flex-direction: column; gap: 8px; flex: none">{footer}</div>'
          if footer else '')
    hgt = f'height: {height}px;' if height else 'max-height: 836px;'
    return (scrim(t) + f'<div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 3">'
            f'<div role="dialog" aria-modal="true" aria-labelledby="{hid}" style="width: {width}px; {hgt} box-sizing: border-box; background: {t["sheet_bg"]}; '
            f'border-radius: 28px; box-shadow: 0 24px 70px rgba(0,0,0,0.32); display: flex; flex-direction: column; overflow: hidden">'
            f'<div style="padding: 22px 18px 10px {16 if back else 28}px; display: flex; align-items: flex-start; gap: 4px; flex: none">{lead}'
            f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; padding-top: 6px">'
            f'<h2 id="{hid}" style="margin: 0; {ts("headline", t["ink"])}">{title}</h2>{sb}</div>'
            f'<div style="display: flex; align-items: center">{actions}{close}</div></div>'
            f'<div style="flex: 1; min-height: 0; overflow: hidden; padding: 6px 28px 20px; display: flex; flex-direction: column; gap: 12px">{inner}</div>'
            f'{ft}</div></div>')


def question(t, title, body, actions, icon_name=None, tone='accent'):
    """The kit's small question dialog (archive, delete, unsaved), centred over the whole window."""
    return f'<div style="position: absolute; inset: 0; z-index: 3">{kit.dialog(t, title, body, actions, icon_name, tone)}</div>'


def toast(t, text, action=None, icon_name=None, tone=None, side=True, bottom=28):
    """A toast at the bottom centre of the sheet (raise ``bottom`` above a pinned bar)."""
    left = SIDE if side else 0
    return (f'<div style="position: absolute; left: {left}px; right: 0; bottom: {bottom}px; display: flex; justify-content: center; z-index: 2">'
            f'<div style="width: 420px">{kit.toast_inline(t, text, action, icon_name, tone)}</div></div>')


def theme(key):
    dance, mode = key.split('-')
    return kit.theme(dance, mode)
