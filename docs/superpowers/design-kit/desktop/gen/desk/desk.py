"""Desktop building blocks: the three app frames and the shared pieces, from the C4 kit.

Every board is 1440 x 900 (a common laptop / work-PC window). Colours only from ``t``.
"""
import os
import sys

S = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
sys.path.insert(0, os.path.join(S, 'gen', 'kit'))
sys.path.insert(0, os.path.join(S, 'gen', 'screens'))
import kit  # noqa: E402
from kit import icon, ts, CREAM  # noqa: E402

W, H = 1440, 900
NAV = kit.TABS + [('settings', 'Settings')]


def esc(s):
    return kit.esc(s)


def col(inner, gap=8, extra=''):
    return f'<div style="display: flex; flex-direction: column; gap: {gap}px; min-width: 0; {extra}">{inner}</div>'


def label(t, text, top=0, trailing=None):
    return kit.section_label(t, text, top, trailing)


# --------------------------------------------------------------------------
# the band's own pieces, sized for a desktop window
# --------------------------------------------------------------------------

def band_title(t, title, subtitle=None, left='', right='', extra='', tall=True, pad='30px 40px 26px 40px', bg='transparent', center=False):
    if center:
        sub = f'<span style="{ts("subtitle", t["band_small"])}">{subtitle}</span>' if subtitle else ''
        ex = f'<div style="margin-top: 14px; display: flex; justify-content: center">{extra}</div>' if extra else ''
        mid = (f'<div style="display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; min-width: 0">'
               f'{kit.band_title(t, title, tall, "h1")}{sub}{ex}</div>')
        return (f'<header style="background: {bg}; padding: {pad}; display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); '
                f'align-items: start; gap: 16px; flex: none">'
                f'<div style="display: flex; align-items: center; margin-left: -10px; padding-top: 2px">{left}</div>{mid}'
                f'<div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-right: -10px; padding-top: 2px">{right}</div></header>')
    """A page title on the band: optional back, the Bricolage title, a subtitle, actions at the right."""
    sub = (f'<span style="{ts("subtitle", t["band_small"])}; {"padding-left: 40px" if left else ""}">{subtitle}</span>') if subtitle else ''
    lead = f'<div style="display: flex; align-items: center; gap: 4px; min-width: 0; {"margin-left: -10px" if left else ""}">{left}{kit.band_title(t, title, tall, "h1")}</div>'
    r = f'<div style="display: flex; align-items: center; gap: 4px; margin-right: -10px">{right}</div>' if right else ''
    ex = f'<div style="margin-top: 14px">{extra}</div>' if extra else ''
    return (f'<header style="background: {bg}; padding: {pad}; display: flex; flex-direction: column; gap: 4px; flex: none">'
            f'<div style="display: flex; align-items: center; justify-content: space-between; gap: 16px">{lead}{r}</div>{sub}{ex}</header>')


def band_pill_button(t, text, icon_name=None):
    """A labelled cream pill on the band (New figure, Edit) — desktop has room for words."""
    ic = icon(icon_name, 20, t['band'], bg=CREAM) if icon_name else ''
    return (f'<button type="button" style="height: 44px; border: 0; background: none; padding: 0; display: inline-flex; align-items: center; cursor: pointer; flex: none">'
            f'<span style="height: 40px; padding: 0 18px 0 {14 if icon_name else 18}px; border-radius: 20px; background: {CREAM}; color: {t["band"]}; '
            f'display: inline-flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 800">{ic}{text}</span></button>')


def band_ghost_button(t, text, icon_name=None):
    ic = icon(icon_name, 20, t['band_small']) if icon_name else ''
    return (f'<button type="button" style="height: 44px; border: 0; background: none; padding: 0; display: inline-flex; align-items: center; cursor: pointer; flex: none">'
            f'<span style="height: 40px; padding: 0 16px 0 {12 if icon_name else 16}px; border-radius: 20px; background: {t["band_track"]}; color: {t["band_small"]}; '
            f'display: inline-flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 800">{ic}{text}</span></button>')


def var_tabs(t, names, sel, on_band=True):
    """The variation switcher as tabs under the figure's name (desktop: no bottom bar)."""
    out = ''
    for i, n in enumerate(names):
        on = i == sel
        if on_band:
            bg, fg = (CREAM, t['band']) if on else (t['band_track'], t['band_small'])
        else:
            bg, fg = (t['accent'], t['on_accent']) if on else (t['chip'], t['chip_ink'])
        cur = ' aria-current="page"' if on else ''
        out += (f'<a href="#"{cur} style="height: 36px; padding: 0 16px; border-radius: 18px; background: {bg}; color: {fg}; display: inline-flex; '
                f'align-items: center; font-size: 14px; font-weight: {800 if on else 700}; text-decoration: none; flex: none">{n}</a>')
    plus_c = t['band_small'] if on_band else t['accent_text']
    out += (f'<button type="button" style="height: 36px; padding: 0 14px 0 10px; border-radius: 18px; border: 1.5px dashed {kit.rgba(plus_c, 0.6) if plus_c.startswith("#") else plus_c}; '
            f'background: none; color: {plus_c}; display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 800; cursor: pointer; flex: none">'
            f'{icon("plus", 18, plus_c)}Variation</button>')
    return f'<nav aria-label="Variations" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap">{out}</nav>'


# --------------------------------------------------------------------------
# frame A: the band wraps the sheet (band-coloured sidebar + band title)
# --------------------------------------------------------------------------

def side_item(t, g, lab, on):
    if on:
        return (f'<a href="#" aria-current="page" style="height: 48px; padding: 0 18px 0 14px; border-radius: 24px; background: {CREAM}; color: {t["band"]}; '
                f'display: flex; align-items: center; gap: 12px; text-decoration: none; font-size: 16px; font-weight: 800">{icon(g, 24, t["band"], filled=True, bg=CREAM)}{lab}</a>')
    return (f'<a href="#" style="height: 48px; padding: 0 18px 0 14px; border-radius: 24px; color: {t["band_small"]}; '
            f'display: flex; align-items: center; gap: 12px; text-decoration: none; font-size: 16px; font-weight: 700">{icon(g, 24, t["band_small"])}{lab}</a>')


def frame_a(t, active, head, body, overlay=''):
    """The band runs down the left as the nav and across the top as the page title; the sheet is a
    big panel rounded at its top-left corner, as the phone's sheet is rounded at the top."""
    items = ''.join(side_item(t, g, l, l == active) for g, l in NAV[:4])
    nav = (f'<nav aria-label="Main" style="width: 224px; flex: none; box-sizing: border-box; padding: 32px 14px 22px; display: flex; flex-direction: column; gap: 6px">'
           f'{items}<div style="margin-top: auto">{side_item(t, "settings", "Settings", active == "Settings")}</div></nav>')
    main = (f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column">{head}'
            f'<main style="flex: 1; min-height: 0; background: {t["ground"]}; border-radius: 28px 0 0 0; overflow: hidden; position: relative; display: flex; flex-direction: column">{body}</main></div>')
    return (f'<div style="width: {W}px; height: {H}px; position: relative; overflow: hidden; background: {t["band"]}; color: {t["ink"]}; {kit.MANROPE}; display: flex">'
            f'{nav}{main}{overlay}</div>')


def head_a(t, title, subtitle=None, left='', right='', extra='', tall=True, center=False):
    return band_title(t, title, subtitle, left, right, extra, tall, pad=f'30px 40px {26 if not extra else 22}px {40 if center else 16}px', center=center)


# --------------------------------------------------------------------------
# frame B: one band across the top, the tabs in it
# --------------------------------------------------------------------------

def top_item(t, g, lab, on):
    if on:
        return (f'<a href="#" aria-current="page" style="height: 40px; padding: 0 16px 0 12px; border-radius: 20px; background: {CREAM}; color: {t["band"]}; '
                f'display: flex; align-items: center; gap: 8px; text-decoration: none; font-size: 15px; font-weight: 800">{icon(g, 22, t["band"], filled=True, bg=CREAM)}{lab}</a>')
    return (f'<a href="#" style="height: 40px; padding: 0 16px 0 12px; border-radius: 20px; color: {t["band_small"]}; '
            f'display: flex; align-items: center; gap: 8px; text-decoration: none; font-size: 15px; font-weight: 700">{icon(g, 22, t["band_small"])}{lab}</a>')


def frame_b(t, active, title, subtitle=None, right='', body='', overlay='', center=False):
    items = ''.join(top_item(t, g, l, l == active) for g, l in NAV[:4])
    if center:
        nav = (f'<div style="display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center">'
               f'<span></span><nav aria-label="Main" style="display: flex; gap: 4px">{items}</nav>'
               f'<div style="justify-self: end; margin-right: -10px">{kit.band_button(t, "settings", "Settings")}</div></div>')
    else:
        nav = (f'<div style="display: flex; align-items: center; justify-content: space-between">'
               f'<nav aria-label="Main" style="display: flex; gap: 4px">{items}</nav>'
               f'{kit.band_button(t, "settings", "Settings")}</div>')
    sub = f'<span style="{ts("subtitle", t["band_small"])}">{subtitle}</span>' if subtitle else ''
    r = f'<div style="display: flex; align-items: center; gap: 4px; margin-right: -10px">{right}</div>' if right else ''
    if center:
        head = (f'<header style="background: {t["band"]}; padding: 16px 40px 58px; display: flex; flex-direction: column; flex: none">{nav}'
                + band_title(t, title, subtitle, '', right, pad='22px 0 0', center=True) + '</header>')
    else:
        head = (f'<header style="background: {t["band"]}; padding: 16px 40px 58px; display: flex; flex-direction: column; flex: none">{nav}'
            f'<div style="margin-top: 22px; display: flex; align-items: flex-end; justify-content: space-between; gap: 16px">'
                f'<div style="display: flex; flex-direction: column; gap: 4px">{kit.band_title(t, title, True, "h1")}{sub}</div>{r}</div></header>')
    main = (f'<main style="flex: 1; min-height: 0; margin-top: -28px; background: {t["ground"]}; border-radius: 28px 28px 0 0; overflow: hidden; '
            f'position: relative; display: flex; flex-direction: column">{body}</main>')
    return (f'<div style="width: {W}px; height: {H}px; position: relative; overflow: hidden; background: {t["ground"]}; color: {t["ink"]}; {kit.MANROPE}; '
            f'display: flex; flex-direction: column">{head}{main}{overlay}</div>')


# --------------------------------------------------------------------------
# frame C: a light rail on the left (the tab bar stood up), the page's band beside it
# --------------------------------------------------------------------------

def rail_item(t, g, lab, on):
    if on:
        return (f'<a href="#" aria-current="page" style="display: flex; flex-direction: column; align-items: center; gap: 4px; text-decoration: none; width: 80px">'
                f'<span style="width: 60px; height: 34px; border-radius: 17px; background: {t["tab_tint"]}; display: flex; align-items: center; justify-content: center">'
                f'{icon(g, 26, t["accent"], filled=True, bg=t["tab_bg"])}</span>'
                f'<span style="font-size: 12px; font-weight: 800; color: {t["accent_text"]}">{lab}</span></a>')
    return (f'<a href="#" style="display: flex; flex-direction: column; align-items: center; gap: 4px; text-decoration: none; width: 80px">'
            f'<span style="width: 60px; height: 34px; border-radius: 17px; display: flex; align-items: center; justify-content: center">{icon(g, 26, t["muted"])}</span>'
            f'<span style="font-size: 12px; font-weight: 700; color: {t["muted"]}">{lab}</span></a>')


def frame_c(t, active, title, subtitle=None, right='', body='', overlay='', left=''):
    items = ''.join(rail_item(t, g, l, l == active) for g, l in NAV[:4])
    nav = (f'<nav aria-label="Main" style="width: 96px; flex: none; box-sizing: border-box; background: {t["tab_bg"]}; border-right: 1px solid {t["tab_line"]}; '
           f'padding: 30px 8px 22px; display: flex; flex-direction: column; align-items: center; gap: 18px">'
           f'{items}<div style="margin-top: auto">{rail_item(t, "settings", "Settings", active == "Settings")}</div></nav>')
    head = band_title(t, title, subtitle, left, right, pad='34px 40px 60px', bg=t['band'])
    main = (f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column">{head}'
            f'<main style="flex: 1; min-height: 0; margin-top: -28px; background: {t["ground"]}; border-radius: 28px 28px 0 0; overflow: hidden; position: relative; '
            f'display: flex; flex-direction: column">{body}</main></div>')
    return (f'<div style="width: {W}px; height: {H}px; position: relative; overflow: hidden; background: {t["ground"]}; color: {t["ink"]}; {kit.MANROPE}; display: flex">'
            f'{nav}{main}{overlay}</div>')


# --------------------------------------------------------------------------
# panes and overlays
# --------------------------------------------------------------------------

def scroll_area(inner, pad='28px 40px', max_w=None, gap=8):
    mw = f'max-width: {max_w}px; margin: 0 auto; ' if max_w else ''
    return (f'<div style="flex: 1; min-height: 0; overflow: hidden; box-sizing: border-box; padding: {pad}">'
            f'<div style="{mw}display: flex; flex-direction: column; gap: {gap}px">{inner}</div></div>')


def grid2(a, b, left='minmax(0, 1fr)', right='minmax(0, 1fr)', gap=32):
    return (f'<div style="display: grid; grid-template-columns: {left} {right}; gap: {gap}px; align-items: start">'
            f'{col(a)}{col(b)}</div>')


def scrim(t):
    return f'<div aria-hidden="true" style="position: absolute; inset: 0; background: {t["scrim"]}"></div>'


def side_panel(t, title, sub, inner, footer='', actions='', width=460, shadow=True):
    """A panel on the right, full height (a desktop bottom sheet)."""
    hid = kit.uid('panel')
    cl = kit.icon_button(t, 'close', 'Close', 'bare', on=t['sheet_bg'])
    sb = f'<span style="font-size: 13px; line-height: 1.4; color: {t["muted"]}">{sub}</span>' if sub else ''
    ft = (f'<div style="padding: 14px 24px 22px; border-top: 1px solid {t["hairline"]}; display: flex; flex-direction: column; gap: 8px; flex: none">{footer}</div>') if footer else ''
    sh = 'box-shadow: -12px 0 40px rgba(0,0,0,0.16);' if shadow else f'border-left: 1px solid {t["hairline"]};'
    return (f'<aside role="dialog" aria-labelledby="{hid}" style="position: absolute; top: 0; right: 0; bottom: 0; width: {width}px; box-sizing: border-box; '
            f'background: {t["sheet_bg"]}; {sh} display: flex; flex-direction: column; z-index: 3">'
            f'<div style="padding: 22px 16px 10px 24px; display: flex; align-items: flex-start; gap: 4px; flex: none">'
            f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; padding-top: 6px">'
            f'<h2 id="{hid}" style="margin: 0; {ts("headline", t["ink"])}">{title}</h2>{sb}</div>'
            f'<div style="display: flex; align-items: center">{actions}{cl}</div></div>'
            f'<div style="flex: 1; min-height: 0; overflow: hidden; padding: 6px 24px 20px; display: flex; flex-direction: column; gap: 12px">{inner}</div>'
            f'{ft}</aside>')


def center_dialog(t, title, sub, inner, footer='', actions='', width=560, height=760):
    hid = kit.uid('dlg')
    cl = kit.icon_button(t, 'close', 'Close', 'bare', on=t['raised'])
    sb = f'<span style="font-size: 13px; line-height: 1.4; color: {t["muted"]}">{sub}</span>' if sub else ''
    ft = (f'<div style="padding: 14px 28px 22px; border-top: 1px solid {t["hairline"]}; display: flex; flex-direction: column; gap: 8px; flex: none">{footer}</div>') if footer else ''
    return (scrim(t) + f'<div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 3">'
            f'<div role="dialog" aria-modal="true" aria-labelledby="{hid}" style="width: {width}px; height: {height}px; box-sizing: border-box; background: {t["sheet_bg"]}; '
            f'border-radius: 28px; box-shadow: 0 24px 70px rgba(0,0,0,0.32); display: flex; flex-direction: column; overflow: hidden">'
            f'<div style="padding: 22px 18px 10px 28px; display: flex; align-items: flex-start; gap: 4px; flex: none">'
            f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; padding-top: 6px">'
            f'<h2 id="{hid}" style="margin: 0; {ts("headline", t["ink"])}">{title}</h2>{sb}</div>'
            f'<div style="display: flex; align-items: center">{actions}{cl}</div></div>'
            f'<div style="flex: 1; min-height: 0; overflow: hidden; padding: 6px 28px 20px; display: flex; flex-direction: column; gap: 12px">{inner}</div>'
            f'{ft}</div></div>')


def document(body, title):
    return kit.document(body, W, H, title)
