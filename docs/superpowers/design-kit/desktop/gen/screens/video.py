"""S-video: the full-screen video player redrawn in the C4 look.

The player is always dark (it sits over video), so every screen is drawn in the
kit's MEDIA palette, once per dance: salsa on the left (or on top, for
landscape), bachata on the right (or below). The dance shows through the accent.

    python3 video.py   -> canvas/project/S-video.dc.html
"""
import os
import sys

S = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
sys.path.insert(0, S + '/gen/kit')
import kit  # noqa: E402

OUT = S + '/canvas/project/S-video.dc.html'
BLACK = '#000000'
WHITE = '#ffffff'

# --------------------------------------------------------------------------
# content
# --------------------------------------------------------------------------

CONTENT = {
    'salsa': dict(
        title='Enchufla · Doble', sub='Recording', lesson='Class · 28 October', lesson_sub='Lesson video',
        spots=[('Count in', 0.0, None, []), ('Prep · 1 2 3', 12.4, 16.0, []),
               ('Enchufla doble', 64.0, 71.2, ['Enchufla · Doble']), ('Hand change', 98.5, None, []),
               ('Exit to cross body', 122.0, 128.4, [])],
        linked2=['Enchufla · Doble', 'Count drill · 3-2 clave']),
    'bachata': dict(
        title='Hammerlock · Basic', sub='Recording', lesson='Class · 21 October', lesson_sub='Lesson video',
        spots=[('Count in', 0.0, None, []), ('Body wave in', 12.4, 16.0, []),
               ('Hammerlock wrap', 64.0, 71.2, ['Hammerlock · Basic']), ('Dip', 98.5, None, []),
               ('Cuddle exit', 122.0, 128.4, [])],
        linked2=['Hammerlock · Basic', 'Body wave · Drill']),
}
DUR = 161.0  # 2:41


def C(t):
    return CONTENT[t['dance']]


def spot_time(s):
    m, r = divmod(s, 60)
    return f'{int(m)}:{r:04.1f}'


def precise(s):
    m, r = divmod(s, 60)
    return f'{int(m)}:{r:05.2f}'


def length(s):
    return f'{s:.1f} s'


def rng(a, b):
    return f'{spot_time(a)}–{spot_time(b)}'


def pct(s, a=0.0, b=DUR):
    return max(0.0, min(100.0, (s - a) / (b - a) * 100))


# --------------------------------------------------------------------------
# frames
# --------------------------------------------------------------------------

def phone(t, inner):
    return kit.phone(t, inner, bg=BLACK)


def land(t, inner):
    """A phone on its side: 844x390, the same bezel and radius as kit.phone."""
    return (f'<div style="width: 844px; height: 390px; flex: none; border-radius: 44px; overflow: hidden; background: {BLACK}; '
            f'color: {t["ink"]}; {kit.MANROPE}; position: relative; box-shadow: 0 0 0 10px #111114, 0 24px 60px rgba(0,0,0,0.2)">{inner}</div>')


# --------------------------------------------------------------------------
# the picture (no real video exists: a lit studio wall, a floor, a couple)
# --------------------------------------------------------------------------

def _couple(t):
    sil = '#0b0b0d'
    return (f'<ellipse cx="46" cy="129" rx="30" ry="4" fill="rgba(0,0,0,0.45)"></ellipse>'
            f'<g fill="{sil}" stroke="{sil}" stroke-linecap="round" stroke-linejoin="round">'
            # leader
            f'<circle cx="35" cy="58" r="6" stroke="none"></circle>'
            f'<path d="M29 67h12l2 28H27z" stroke-width="2"></path>'
            f'<path d="M31 95l-2 33M39 95l4 33" stroke-width="5" fill="none"></path>'
            f'<path d="M30 70l-5 19M40 70l11-24" stroke-width="3.5" fill="none"></path>'
            # follower, mid-turn
            f'<circle cx="58" cy="56" r="5.5" stroke="none"></circle><circle cx="62.5" cy="53.5" r="3.4" stroke="none"></circle>'
            f'<path d="M53 65h10l1 18H52z" stroke-width="2"></path>'
            f'<path d="M50 83h16l5 16H45z" stroke-width="2"></path>'
            f'<path d="M55 99l-2 29M61 99l3 29" stroke-width="4" fill="none"></path>'
            f'<path d="M55 67l-3-22M62 68l5 15" stroke-width="3" fill="none"></path></g>')


def picture(t, wide=False, mirror=False, zoom=1.0, origin='50% 45%', fill=False):
    """The video frame. Upright (9:16) unless ``wide`` (16:9). ``fill``: size by width."""
    b = '#9a3270' if t['dance'] == 'bachata' else '#8f2a12'
    floor = 88 if wide else 80
    bg = (f'radial-gradient(ellipse 70% 60% at 50% 30%, rgba(255,214,180,0.34), rgba(0,0,0,0) 70%), '
          f'linear-gradient(180deg, {kit.mix(b, "#000000", 0.55)} 0%, {kit.mix(b, "#000000", 0.85)} {floor}%, '
          f'{kit.mix(b, "#000000", 0.45)} {floor}%, #060606 100%)')
    vb = '0 0 160 90' if wide else '0 0 90 160'
    g = f'<g transform="translate(43,-22) scale(0.8)">{_couple(t)}</g>' if wide else _couple(t)
    tr = []
    if zoom != 1:
        tr.append(f'scale({zoom})')
    if mirror:
        tr.append('scaleX(-1)')
    tf = f'transform: {" ".join(tr)}; transform-origin: {origin};' if tr else ''
    size = ('width: 100%; aspect-ratio: 16 / 9;' if fill or wide else 'height: 100%; aspect-ratio: 9 / 16;')
    return (f'<div aria-hidden="true" style="{size} position: relative; overflow: hidden; flex: none">'
            f'<div style="position: absolute; inset: 0; background: {bg}; {tf}">'
            f'<svg viewBox="{vb}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style="position: absolute; inset: 0">{g}</svg>'
            f'</div></div>')


def stage(t, inner_overlays='', wide=False, mirror=False, zoom=1.0, paused=False, loop_pct=None, origin='50% 45%'):
    """The black area holding the picture, flex 1, with overlays drawn over it."""
    pic = picture(t, wide, mirror, zoom, origin, fill=wide)
    play = ''
    if paused:
        play = (f'<span aria-hidden="true" style="position: absolute; left: 50%; top: 50%; width: 64px; height: 64px; margin: -32px 0 0 -32px; border-radius: 32px; '
                f'background: rgba(0,0,0,0.55); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.35); display: flex; align-items: center; justify-content: center">'
                f'{kit.icon("play", 30, WHITE, filled=True, style="margin-left: 3px")}</span>')
    lp = (f'<span aria-hidden="true" style="position: absolute; left: 0; bottom: 0; height: 3px; width: {loop_pct}%; background: {t["accent"]}"></span>'
          if loop_pct is not None else '')
    return (f'<div role="button" tabindex="0" aria-label="{"Play" if paused else "Pause"}" style="flex: 1; min-height: 120px; position: relative; background: {BLACK}; '
            f'display: flex; align-items: center; justify-content: center; overflow: hidden">{pic}{play}{lp}{inner_overlays}</div>')


# --------------------------------------------------------------------------
# small parts
# --------------------------------------------------------------------------

def pbtn(t, label, icon_name=None, kind='neutral', h=48, grow=None, disabled=False, aria=None, sub=None, fs=15, pad='0 16px', radius=None):
    """A player button. kind: neutral (grey) | accent | ghost | glass | outline | danger_text."""
    bg, fg, extra = {
        'neutral': (t['step'], t['ink'], ''),
        'accent': (t['accent'], t['on_accent'], ''),
        'ghost': ('transparent', t['ink'], ''),
        'glass': (t['glass'], t['ink'], f'box-shadow: inset 0 0 0 1px {t["glass_line"]};'),
        'outline': ('transparent', t['ink'], f'box-shadow: inset 0 0 0 1px {t["hairline"]};'),
        'danger_text': ('transparent', t['danger'], ''),
    }[kind]
    dis = ''
    if disabled:
        bg = t['disabled_bg'] if kind not in ('ghost', 'danger_text', 'outline') else 'transparent'
        fg, extra, dis = t['disabled_ink'], extra if kind == 'outline' else '', ' disabled'
    ic = kit.icon(icon_name, 20, fg) if icon_name else ''
    g = f'flex: {grow}; min-width: 0;' if grow else 'flex: none;'
    al = f' aria-label="{aria}"' if aria else ''
    r = radius if radius is not None else h // 2
    if sub:
        body = (f'<span style="display: flex; flex-direction: column; align-items: center; line-height: 1.1">'
                f'<span>{label}</span><span style="font-size: 12px; font-weight: 600; color: {t["disabled_ink"] if disabled else t["muted"]}">{sub}</span></span>')
    else:
        body = label
    return (f'<button type="button"{al}{dis} style="{g} height: {h}px; box-sizing: border-box; border: 0; border-radius: {r}px; background: {bg}; color: {fg}; {extra} '
            f'font-size: {fs}px; font-weight: 800; padding: {pad}; display: inline-flex; align-items: center; justify-content: center; gap: 8px; '
            f'cursor: pointer; white-space: nowrap; font-variant-numeric: tabular-nums">{ic}{body}</button>')


def round_btn(t, label, text=None, icon_name=None, size=56, kind='neutral', filled=False, fs=13, isize=24):
    bg, fg, extra = {
        'neutral': (t['step'], t['ink'], ''),
        'accent': (t['accent'], t['on_accent'], ''),
        'glass': (t['glass'], WHITE, f'box-shadow: inset 0 0 0 1px {t["glass_line"]};'),
        'ghost': ('transparent', t['ink'], ''),
    }[kind]
    inner = kit.icon(icon_name, isize, fg, filled=filled, bg=bg, style='margin-left: 3px' if icon_name == 'play' else '') if icon_name else text
    return (f'<button type="button" aria-label="{label}" style="width: {size}px; height: {size}px; flex: none; border: 0; border-radius: {size // 2}px; background: {bg}; '
            f'color: {fg}; {extra} font-size: {fs}px; font-weight: 800; padding: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; '
            f'font-variant-numeric: tabular-nums; white-space: nowrap">{inner}</button>')


def transport(t, size='normal', paused=False, overlay=False):
    """−1 s, −0.1 s, Play/Pause, +0.1 s, +1 s. compact: no ±1 s, a small grey play."""
    side = 'glass' if overlay else 'neutral'
    play_icon = 'play' if paused else 'pause'
    pl = 'Play' if paused else 'Pause'
    if size == 'compact':
        return (f'<div style="display: flex; align-items: center; gap: 4px">'
                f'{round_btn(t, "Back 0.1 s", "−0.1 s", size=48, kind="ghost")}'
                f'{round_btn(t, pl, icon_name=play_icon, size=44, kind="neutral", filled=True, isize=22)}'
                f'{round_btn(t, "Forward 0.1 s", "+0.1 s", size=48, kind="ghost")}</div>')
    s, p, gap, isz = {'normal': (54, 66, 10, 28), 'large': (58, 78, 12, 32), 'overlay': (48, 56, 10, 24)}[('overlay' if overlay else size)]
    return (f'<div style="display: flex; align-items: center; justify-content: center; gap: {gap}px">'
            f'{round_btn(t, "Back 1 s", "−1 s", size=s, kind=side, fs=14)}'
            f'{round_btn(t, "Back 0.1 s", "−0.1 s", size=s, kind=side)}'
            f'{round_btn(t, pl, icon_name=play_icon, size=p, kind="accent", filled=True, isize=isz)}'
            f'{round_btn(t, "Forward 0.1 s", "+0.1 s", size=s, kind=side)}'
            f'{round_btn(t, "Forward 1 s", "+1 s", size=s, kind=side, fs=14)}</div>')


def timeline(t, at, a=0.0, b=DUR, bands=None, active=None, pending=None, accent_fill=False, overlay=False):
    """A scrubbable track: sections as bands, points as ticks, the playhead."""
    bands = bands if bands is not None else C(t)['spots']
    trk = 'rgba(255,255,255,0.3)' if overlay else t['track']
    fill = t['accent'] if accent_fill else 'rgba(255,255,255,0.62)'
    out = (f'<span style="position: absolute; left: 0; right: 0; top: 19px; height: 6px; border-radius: 3px; background: {trk}"></span>'
           f'<span style="position: absolute; left: 0; top: 19px; height: 6px; border-radius: 3px; width: {pct(at, a, b):.2f}%; background: {fill}"></span>')
    for (name, s, e, _l) in bands:
        if e is None:
            out += (f'<span style="position: absolute; top: 10px; width: 3px; height: 24px; margin-left: -1.5px; border-radius: 2px; '
                    f'left: {pct(s, a, b):.2f}%; background: rgba(255,255,255,0.9)"></span>')
        else:
            c = t['accent'] if name == active else 'rgba(255,255,255,0.34)'
            out += (f'<span style="position: absolute; top: 15px; height: 14px; min-width: 5px; border-radius: 4px; left: {pct(s, a, b):.2f}%; '
                    f'width: {pct(e, a, b) - pct(s, a, b):.2f}%; background: {c}"></span>')
    if pending is not None:
        lo, hi = min(pending, at), max(pending, at)
        out += (f'<span style="position: absolute; top: 15px; height: 14px; border-radius: 4px; left: {pct(lo, a, b):.2f}%; width: {pct(hi, a, b) - pct(lo, a, b):.2f}%; '
                f'background: {t["accent"]}; opacity: 0.6"></span>')
    out += (f'<span style="position: absolute; top: 7px; width: 4px; height: 30px; margin-left: -2px; border-radius: 2px; left: {pct(at, a, b):.2f}%; '
            f'background: {WHITE}; box-shadow: 0 0 0 2px {BLACK}"></span>')
    return (f'<div role="slider" tabindex="-1" aria-label="Position" aria-valuemin="{int(a * 1000)}" aria-valuemax="{int(b * 1000)}" aria-valuenow="{int(at * 1000)}" '
            f'aria-valuetext="{precise(at)}" style="position: relative; height: 44px; flex: none">{out}</div>')


def ends_row(t, a, b, middle=None, overlay=False):
    c = 'rgba(255,255,255,0.85)' if overlay else t['muted']
    m = f'<span style="font-weight: 800; color: {WHITE}">{middle}</span>' if middle else ''
    return (f'<div style="display: flex; justify-content: space-between; margin-top: -6px; font-size: 12px; font-weight: 700; color: {c}; '
            f'font-variant-numeric: tabular-nums">{"<span>" + a + "</span>"}{m}{"<span>" + b + "</span>"}</div>')


def big_time(t, main, rest=None, size=26):
    r = f'<span style="font-size: 14px; font-weight: 600; color: {t["muted"]}; font-variant-numeric: tabular-nums">{rest}</span>' if rest else ''
    return (f'<span style="display: flex; align-items: baseline; gap: 8px"><span style="{kit.BRIC}; font-size: {size}px; font-weight: 800; letter-spacing: -0.01em; '
            f'font-variant-numeric: tabular-nums; color: {t["ink"]}">{main}</span>{r}</span>')


def hide_btn(t, show=False):
    return pbtn(t, 'Show' if show else 'Hide', None, 'ghost', h=44, pad='0 8px 0 12px', fs=14).replace(
        '</button>', kit.icon('chevron-up' if show else 'chevron-down', 18, t['ink2']) + '</button>').replace(
        f'color: {t["ink"]};', f'color: {t["ink2"]};', 1)


def section_chips(t, active=None, fade=True):
    sp = C(t)['spots']
    out = kit.chip(t, 'All', False, icon_name='list', count=len(sp))
    names = [x[0] for x in sp]
    first = 0
    if active in names and names.index(active) > 1:
        # scrolled so the open section is in view: a fade on both sides says there is more
        first = names.index(active) - 1
        out = ''
    for (name, s, e, _l) in sp[first:]:
        on = name == active
        out += kit.chip(t, name, on, icon_name='flag' if e is None else 'repeat', count=None if e is None else length(e - s)).replace(
            'aria-pressed="true"', 'aria-current="true"').replace(' aria-pressed="false"', '')
    g = 'linear-gradient(90deg, transparent, #000 10%, #000 86%, transparent)' if first else 'linear-gradient(90deg, #000 86%, transparent)'
    m = f'mask-image: {g}; -webkit-mask-image: {g};' if fade else ''
    return (f'<div role="group" aria-label="Sections and points" style="display: flex; gap: 8px; padding: 0 16px; overflow: hidden; white-space: nowrap; flex: none; {m}{' margin-left: -40px;' if first else ''}">'
            f'{out}</div>')


def on_video_pill(t, inner, button=False, label=None, accent=False):
    tag = 'button type="button"' if button else 'span'
    end = 'button' if button else 'span'
    al = f' aria-label="{label}"' if label else ''
    col = t['accent_text'] if accent else 'rgba(255,255,255,0.92)'
    pad = 'padding: 0 10px; height: 30px;'
    return (f'<{tag}{al} style="{pad} border: 0; border-radius: 15px; background: rgba(0,0,0,0.6); color: {col}; font-size: 12.5px; font-weight: {800 if accent else 700}; '
            f'display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; cursor: pointer; font-variant-numeric: tabular-nums">{inner}</{end}>')


def loop_badges(t, name, link=None, can_link=True, top=10):
    """Top left of the video in a section: the loop's name, and under it what it links to."""
    out = on_video_pill(t, kit.icon('repeat', 15, t['accent']) + name)
    if link:
        out += on_video_pill(t, kit.icon('link', 14, 'rgba(255,255,255,0.8)') + link, button=can_link, label=f'Links: {link}')
    elif can_link:
        out += on_video_pill(t, kit.icon('link', 14, t['accent_text']) + 'Link', button=True, label='Link this section', accent=True)
    return f'<div style="position: absolute; left: 10px; top: {top}px; display: flex; flex-direction: column; align-items: flex-start; gap: 6px">{out}</div>'


def corner_badge(t, text, top=10):
    return f'<div style="position: absolute; right: 10px; top: {top}px">{on_video_pill(t, text)}</div>'


def zoom_chip(t, z='2×', top=10):
    return (f'<div style="position: absolute; right: 10px; top: {top}px; height: 36px; display: flex; align-items: center; gap: 2px; padding-left: 12px; border-radius: 18px; '
            f'background: rgba(0,0,0,0.6); font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.92)">'
            f'{kit.icon("search", 15, "rgba(255,255,255,0.8)")}<span style="margin-left: 4px">Zoom {z}</span>'
            f'<button type="button" style="height: 44px; margin: -4px 0; padding: 0 14px 0 10px; border: 0; background: none; color: {t["accent_text"]}; '
            f'font-size: 13px; font-weight: 800; cursor: pointer">Reset</button></div>')


def jump_mark(t, side='left', text='« 3 s'):
    """Double-tap feedback: a soft half-disc on that side of the picture with the jump."""
    pos = 'left: -60px' if side == 'left' else 'right: -60px'
    tpos = 'left: 74px' if side == 'left' else 'right: 74px'
    if side == 'left':
        inner = kit.icon('chevron-left', 22, WHITE) + kit.icon('chevron-left', 22, WHITE, style='margin-left: -14px')
    else:
        inner = kit.icon('chevron-right', 22, WHITE) + kit.icon('chevron-right', 22, WHITE, style='margin-left: -14px')
    return (f'<div aria-hidden="true" style="position: absolute; top: 12%; bottom: 12%; {pos}; width: 200px; border-radius: 50%; background: rgba(255,255,255,0.14)"></div>'
            f'<div role="status" style="position: absolute; top: 50%; {tpos}; transform: translateY(-50%); display: flex; flex-direction: column; align-items: center; gap: 4px; '
            f'color: {WHITE}"><span style="display: flex">{inner}</span><span style="{kit.BRIC}; font-size: 20px; font-weight: 800">{text}</span></div>')


def toast(t, text, actions=(), bottom=20, icon_name=None, top=None):
    ac = ''.join(f'<button type="button" style="height: 44px; border: 0; background: none; padding: 0 12px; color: {t["inverse_accent"]}; font-size: 15px; '
                 f'font-weight: 800; cursor: pointer; flex: none">{a}</button>' for a in actions)
    ic = kit.icon(icon_name, 22, t['inverse_ink']) if icon_name else ''
    pos = f'top: {top}px' if top is not None else f'bottom: {bottom}px'
    return (f'<div role="status" style="position: absolute; left: 16px; right: 16px; {pos}; min-height: 52px; box-sizing: border-box; border-radius: 16px; '
            f'background: {t["inverse_bg"]}; color: {t["inverse_ink"]}; display: flex; align-items: center; gap: 10px; padding: 4px {4 if actions else 16}px 4px 16px; '
            f'box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 5">{ic}<span style="flex: 1; font-size: 15px; font-weight: 700; line-height: 1.35; '
            f'font-variant-numeric: tabular-nums">{text}</span>{ac}</div>')


# --------------------------------------------------------------------------
# top bars
# --------------------------------------------------------------------------

def mirror_btn(t, on=False, glass=False):
    if on:
        inner = (f'<span style="width: 40px; height: 40px; border-radius: 20px; background: {t["accent"]}; display: flex; align-items: center; justify-content: center">'
                 f'{kit.icon("mirror", 22, t["on_accent"])}</span>')
    elif glass:
        inner = (f'<span style="width: 40px; height: 40px; border-radius: 20px; background: {t["glass"]}; box-shadow: inset 0 0 0 1px {t["glass_line"]}; '
                 f'display: flex; align-items: center; justify-content: center">{kit.icon("mirror", 22, WHITE)}</span>')
    else:
        inner = kit.icon('mirror', 24, WHITE)
    return (f'<button type="button" aria-label="Mirror" aria-pressed="{"true" if on else "false"}" style="width: 44px; height: 44px; flex: none; {kit.BTN}">{inner}</button>')


def speed_btn(t, rate='1×', open_=False, glass=False):
    bg = t['glass'] if glass else t['step']
    sh = f'box-shadow: {kit.ring(t)};' if open_ else (f'box-shadow: inset 0 0 0 1px {t["glass_line"]};' if glass else '')
    return (f'<button type="button" aria-label="Speed {rate}" aria-expanded="{"true" if open_ else "false"}" style="height: 44px; flex: none; {kit.BTN}">'
            f'<span style="height: 36px; min-width: 52px; box-sizing: border-box; padding: 0 10px; border-radius: 18px; background: {bg}; {sh} color: {WHITE}; '
            f'font-size: 15px; font-weight: 800; display: flex; align-items: center; justify-content: center; font-variant-numeric: tabular-nums">{rate}</span></button>')


def close_btn(t, glass=False):
    if glass:
        inner = (f'<span style="width: 40px; height: 40px; border-radius: 20px; background: {t["glass"]}; box-shadow: inset 0 0 0 1px {t["glass_line"]}; '
                 f'display: flex; align-items: center; justify-content: center">{kit.icon("close", 22, WHITE)}</span>')
    else:
        inner = kit.icon('close', 24, WHITE)
    return f'<button type="button" aria-label="Close player" style="width: 44px; height: 44px; flex: none; {kit.BTN}">{inner}</button>'


def title_block(t, title, sub):
    return (f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; padding-left: 2px">'
            f'<span style="font-size: 16px; font-weight: 800; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{title}</span>'
            f'<span style="font-size: 12.5px; font-weight: 600; color: {t["muted"]}">{sub}</span></div>')


def top_bar(t, title=None, sub=None, mirror=False, rate='1×', section=False, speed_open=False, lesson=False):
    c = C(t)
    title = title or (c['lesson'] if lesson else c['title'])
    sub = sub or (c['lesson_sub'] if lesson else c['sub'])
    if section:
        mid = (pbtn(t, 'Full video', 'chevron-left', 'ghost', h=44, pad='0 12px 0 4px', fs=15)
               + '<span style="flex: 1"></span>'
               + pbtn(t, 'Edit', 'edit', 'accent', h=40, pad='0 14px 0 12px', fs=15)).replace(
            kit.icon('edit', 20, t['on_accent']), kit.icon('edit', 18, t['on_accent']))
    else:
        mid = title_block(t, title, sub)
    pop = ''
    if speed_open:
        opts = ''
        for r in ('0.25×', '0.5×', '0.75×', '1×'):
            on = r == rate
            opts += (f'<button type="button" aria-pressed="{"true" if on else "false"}" style="height: 44px; min-width: 62px; border: 0; border-radius: 22px; '
                     f'background: {t["accent"] if on else "transparent"}; color: {t["on_accent"] if on else WHITE}; font-size: 15px; font-weight: 800; cursor: pointer; '
                     f'font-variant-numeric: tabular-nums">{r}</button>')
        pop = (f'<div role="group" aria-label="Speed" style="position: absolute; right: 8px; top: 58px; z-index: 6; padding: 5px; border-radius: 27px; display: flex; gap: 2px; '
               f'background: {t["surface"]}; box-shadow: 0 12px 30px rgba(0,0,0,0.6), inset 0 0 0 1px {t["glass_line"]}">{opts}</div>')
    return (f'<div style="position: relative; height: 56px; flex: none; display: flex; align-items: center; gap: 4px; padding: 0 8px; background: {BLACK}">'
            f'{close_btn(t)}{mid}{mirror_btn(t, mirror)}{speed_btn(t, rate, speed_open)}{pop}</div>')


# --------------------------------------------------------------------------
# portrait panels under the video
# --------------------------------------------------------------------------

def full_controls(t, at=64.23, paused=False, pending=None, empty=False, load_failed=False):
    c = C(t)
    mark = pbtn(t, 'Mark point', 'flag', 'neutral', h=48, grow=1)
    if pending is None:
        sec = pbtn(t, 'Start section', 'scissors', 'neutral', h=48, grow=1.4)
    else:
        sec = pbtn(t, f'End section · {length(at - pending)}', 'scissors', 'accent', h=48, grow=1.4)
    if load_failed:
        row = (f'<p role="alert" style="margin: 0; padding: 4px 20px 0; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: {t["danger"]}">'
               f'{kit.icon("warning", 16, t["danger"])}Couldn’t load spots</p>')
    elif empty:
        row = (f'<p style="margin: 0; padding: 2px 20px 0; font-size: 13px; line-height: 1.45; color: {t["muted"]}">Nothing marked yet. <b style="color: {t["ink2"]}">Mark point</b> '
               f'saves this moment; <b style="color: {t["ink2"]}">Start section</b> saves a stretch to loop.</p>')
    else:
        row = section_chips(t)
    bands = [] if (empty or load_failed) else c['spots']
    return (f'<div style="flex: none; display: flex; flex-direction: column; gap: 6px; padding: 6px 0 22px; background: {BLACK}">'
            f'<div style="display: flex; align-items: center; padding: 0 8px 0 20px">{big_time(t, precise(at), "/ 2:41.00")}<span style="flex: 1"></span>{hide_btn(t)}</div>'
            f'<div style="padding: 0 20px">{timeline(t, at, bands=bands, pending=pending)}</div>'
            f'<div style="padding: 2px 16px 4px">{transport(t, "normal", paused)}</div>'
            f'<div style="display: flex; gap: 8px; padding: 2px 16px 6px">{mark}{sec}</div>{row}</div>')


def section_controls(t, name, a, b, at, paused=False):
    prog = f'{at - a:.1f} / {length(b - a)}'
    return (f'<div style="flex: none; display: flex; flex-direction: column; gap: 6px; padding: 6px 0 22px; background: {BLACK}">'
            f'<div style="display: flex; align-items: center; padding: 0 8px 0 20px">{big_time(t, prog)}<span style="flex: 1"></span>{hide_btn(t)}</div>'
            f'<div style="padding: 0 20px">{timeline(t, at, a, b, bands=[], accent_fill=True)}{ends_row(t, spot_time(a), spot_time(b))}</div>'
            f'<div style="padding: 10px 16px 10px">{transport(t, "large", paused)}</div>'
            f'{section_chips(t, active=name)}</div>')


def slim_bar(t, at, a=None, b=None):
    if a is None:
        tl = timeline(t, at)
        right = precise(at)
    else:
        tl = timeline(t, at, a, b, bands=[], accent_fill=True)
        right = f'{at - a:.1f} / {length(b - a)}'
    return (f'<div style="flex: none; display: flex; flex-direction: column; padding: 4px 16px 22px; background: {BLACK}">'
            f'<div style="padding: 0 4px">{tl}</div>'
            f'<div style="display: flex; align-items: center; margin: 0 -4px">{hide_btn(t, show=True)}<span style="flex: 1"></span>'
            f'{transport(t, "compact")}<span style="flex: 1"></span>'
            f'<span style="width: 92px; text-align: right; font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums">{right}</span></div></div>')


def trim_strip(t, a, b, sel='start', at=None, point=False, win=None):
    """The editor's zoomed timeline: the spot ± 3 s, a handle per edge, ticks, the playhead."""
    lo, hi = win or (max(0.0, a - 3), (b if b is not None else a) + 3)
    if point:
        lo, hi = max(0.0, a - 3), a + 3 if a >= 3 else 6.0

    def p(s):
        return (s - lo) / (hi - lo) * 100
    ticks = ''
    s0 = int(lo) + (1 if lo != int(lo) else 0)
    for s in range(s0, int(hi) + 1):
        major = s % 5 == 0
        ticks += (f'<span style="position: absolute; bottom: 0; width: 1px; left: {p(s):.2f}%; height: {18 if major else 9}px; '
                  f'background: rgba(255,255,255,{0.45 if major else 0.25})"></span>')
    body = ''
    grey = '#d4d4da'
    if point:
        body = (f'<span style="position: absolute; top: 0; bottom: 0; width: 24px; margin-left: -12px; left: {p(a):.2f}%; border-radius: 10px; background: {t["accent"]}; '
                f'display: flex; align-items: center; justify-content: center">{kit.icon("flag", 15, t["on_accent"])}</span>')
    else:
        sa, sb = p(a), p(b)
        hs = t['accent'] if sel == 'start' else grey
        he = t['accent'] if sel == 'end' else grey
        body = (f'<span style="position: absolute; top: 0; bottom: 0; left: {sa:.2f}%; width: {sb - sa:.2f}%; box-sizing: border-box; '
                f'border-top: 3px solid {t["accent"]}; border-bottom: 3px solid {t["accent"]}; background: {kit.rgba(t["accent"], 0.16)}"></span>'
                f'<span role="slider" tabindex="0" aria-label="Start" aria-valuetext="{precise(a)}" style="position: absolute; top: 0; bottom: 0; width: 22px; '
                f'left: calc({sa:.2f}% - 22px); border-radius: 10px 0 0 10px; background: {hs}; display: flex; align-items: center; justify-content: center">'
                f'<span style="width: 2px; height: 22px; border-radius: 1px; background: rgba(0,0,0,0.45)"></span></span>'
                f'<span role="slider" tabindex="0" aria-label="End" aria-valuetext="{precise(b)}" style="position: absolute; top: 0; bottom: 0; width: 22px; '
                f'left: {sb:.2f}%; border-radius: 0 10px 10px 0; background: {he}; display: flex; align-items: center; justify-content: center">'
                f'<span style="width: 2px; height: 22px; border-radius: 1px; background: rgba(0,0,0,0.45)"></span></span>')
    ph = ''
    if at is not None:
        ph = f'<span style="position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; left: {p(at):.2f}%; background: {WHITE}"></span>'
    return (f'<div style="display: flex; flex-direction: column; gap: 4px; flex: none">'
            f'<div role="group" aria-label="Section edges: drag a handle, tap to seek" style="position: relative; height: 64px; border-radius: 12px; overflow: hidden; '
            f'background: {t["surface"]}">{ticks}{body}{ph}</div>'
            f'<div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 600; color: {t["muted"]}; font-variant-numeric: tabular-nums">'
            f'<span>{spot_time(lo)}</span><span>drag a handle · tap to seek</span><span>{spot_time(hi)}</span></div></div>')


def edge_selectors(t, a, b, sel='start'):
    out = ''
    for e, v, ic in (('start', a, 'Start'), ('end', b, 'End')):
        on = e == sel
        sh = f'box-shadow: inset 0 0 0 2px {t["accent"]};' if on else ''
        out += (f'<button type="button" aria-pressed="{"true" if on else "false"}" style="flex: 1; height: 56px; box-sizing: border-box; border: 0; border-radius: 14px; '
                f'background: {t["raised"] if on else t["surface"]}; {sh} color: {t["ink"]}; padding: 0 14px; display: flex; flex-direction: column; align-items: flex-start; '
                f'justify-content: center; gap: 1px; cursor: pointer">'
                f'<span style="font-size: 12px; font-weight: 700; color: {t["accent_text"] if on else t["muted"]}">{ic}</span>'
                f'<span style="font-size: 18px; font-weight: 800; font-variant-numeric: tabular-nums">{precise(v)}</span></button>')
    return f'<div style="display: flex; gap: 8px; flex: none">{out}</div>'


def small_label(t, text):
    return f'<span style="font-size: 12px; font-weight: 700; color: {t["muted"]}">{text}</span>'


def move_row(t, what, now='1:04.2', disabled=()):
    b = [pbtn(t, '−1 s', None, 'neutral', h=52, grow=1, pad='0 4px', disabled='-1' in disabled, radius=16),
         pbtn(t, '−0.1 s', None, 'neutral', h=52, grow=1, pad='0 4px', disabled='-0.1' in disabled, radius=16),
         pbtn(t, 'Now', None, 'neutral', h=52, grow=1.3, pad='0 4px', sub=now, radius=16),
         pbtn(t, '+0.1 s', None, 'neutral', h=52, grow=1, pad='0 4px', radius=16),
         pbtn(t, '+1 s', None, 'neutral', h=52, grow=1, pad='0 4px', radius=16)]
    return (f'<div style="display: flex; flex-direction: column; gap: 6px; flex: none">{small_label(t, what)}'
            f'<div style="display: flex; gap: 6px">{"".join(b)}</div></div>')


def whole_row(t, ln):
    b = ''.join(pbtn(t, x, None, 'outline', h=44, grow=1, pad='0 4px', fs=14) for x in ('‹ Earlier', 'Shorter', 'Longer', 'Later ›'))
    return (f'<div style="display: flex; flex-direction: column; gap: 6px; flex: none">{small_label(t, f"Whole section · {ln}")}'
            f'<div style="display: flex; gap: 6px">{b}</div></div>')


def editor_head(t, name, sub, loop=True, section=True, link=None, can_link=True):
    lp = ''
    if section:
        lp = pbtn(t, 'Looping' if loop else 'Loop', 'repeat', 'accent' if loop else 'neutral', h=36, pad='0 12px 0 10px', fs=13).replace(
            kit.icon('repeat', 20, t['on_accent'] if loop else t['ink']), kit.icon('repeat', 16, t['on_accent'] if loop else t['ink']))
        lp = lp.replace('<button type="button"', f'<button type="button" aria-pressed="{"true" if loop else "false"}"', 1)
        lp = f'<span style="height: 44px; display: flex; align-items: center; flex: none">{lp}</span>'
    ln = ''
    if section:
        if link:
            ln = (f'<button type="button" style="align-self: flex-start; height: 32px; margin: -6px 0 -4px; border: 0; background: none; padding: 0; display: flex; '
                  f'align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: {t["ink2"]}; cursor: pointer">'
                  f'{kit.icon("link", 15, t["ink2"])}Linked to {link}{kit.icon("chevron-right", 16, t["muted"])}</button>')
        elif can_link:
            ln = (f'<button type="button" style="align-self: flex-start; height: 32px; margin: -6px 0 -4px; border: 0; background: none; padding: 0; display: flex; '
                  f'align-items: center; gap: 6px; font-size: 13px; font-weight: 800; color: {t["accent_text"]}; cursor: pointer">'
                  f'{kit.icon("link", 15, t["accent_text"])}Link to a figure or drill</button>')
    return (f'<div style="display: flex; align-items: flex-start; gap: 8px; flex: none">'
            f'<button type="button" aria-label="Rename {name}" style="flex: 1; min-width: 0; border: 0; background: none; padding: 0; text-align: left; color: {t["ink"]}; '
            f'cursor: pointer; display: flex; flex-direction: column; gap: 2px">'
            f'<span style="display: flex; align-items: center; gap: 8px"><span style="{kit.ts("headline")}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{name}</span>'
            f'{kit.icon("edit", 16, t["muted"])}</span>'
            f'<span style="font-size: 13px; color: {t["muted"]}; font-variant-numeric: tabular-nums">{sub}</span></button>{lp}</div>{ln}')


def editor_footer(t, pad='10px 16px 22px'):
    return (f'<div style="flex: none; display: flex; align-items: center; gap: 8px; padding: {pad}; border-top: 1px solid {t["surface"]}; background: {BLACK}">'
            f'{pbtn(t, "Delete", "trash", "danger_text", h=48, pad="0 12px")}<span style="flex: 1"></span>'
            f'{pbtn(t, "Done", "check", "accent", h=52, pad="0 36px", fs=16)}</div>')


def compact_transport_row(t, at, paused=True):
    return (f'<div style="flex: none; height: 52px; display: flex; align-items: center; padding: 0 8px 0 20px; border-bottom: 1px solid {t["surface"]}; background: {BLACK}">'
            f'<span style="font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums">{precise(at)}</span><span style="flex: 1"></span>'
            f'{transport(t, "compact", paused)}</div>')


def editor_panel(t, spot, sel='start', at=None, loop=True, can_link=True, now='1:04.2', disabled=(), pad='14px 16px 8px'):
    name, a, b, linked = spot
    point = b is None
    if point:
        sub = f'Point at {precise(a)}'
    else:
        sub = f'{rng(a, b)} · {length(b - a)}'
    link = (linked[0] if len(linked) == 1 else (f'{linked[0]} +{len(linked) - 1}' if linked else None))
    body = editor_head(t, name, sub, loop, not point, link, can_link)
    body += trim_strip(t, a, b, sel, at if at is not None else a, point)
    if not point:
        body += edge_selectors(t, a, b, sel)
    body += move_row(t, 'Move the point' if point else ('Move the start' if sel == 'start' else 'Move the end'), now, disabled)
    if not point:
        body += whole_row(t, length(b - a))
    return f'<div style="flex: none; display: flex; flex-direction: column; gap: 12px; padding: {pad}; background: {BLACK}">{body}</div>'


def spot_by(t, i):
    return C(t)['spots'][i]


# --------------------------------------------------------------------------
# portrait screens
# --------------------------------------------------------------------------

def full_video(t):
    ov = ''
    return phone(t, top_bar(t) + stage(t, ov) + full_controls(t, 64.23))


def full_paused_speed(t):
    ov = corner_badge(t, '0.5× · Mirrored')
    return phone(t, top_bar(t, mirror=True, rate='0.5×', speed_open=True) + stage(t, ov, mirror=True, paused=True) + full_controls(t, 64.23, paused=True))


def full_marking(t):
    return phone(t, top_bar(t) + stage(t) + full_controls(t, 125.2, pending=122.0))


def full_saved_toast(t):
    return phone(t, top_bar(t) + stage(t) + full_controls(t, 128.4)
                 + toast(t, 'Section saved · 6.4 s', ('Edit', 'Link'), bottom=22, icon_name='check-circle'))


def full_hidden(t):
    return phone(t, top_bar(t) + stage(t) + slim_bar(t, 64.23))


def full_empty_wide(t):
    return phone(t, top_bar(t, lesson=True) + stage(t, wide=True, paused=True) + full_controls(t, 0.0, paused=True, empty=True))


def full_errors(t):
    spin = (f'<span role="status" aria-label="Loading video" style="position: absolute; left: 50%; top: 50%; width: 64px; height: 64px; margin: -32px 0 0 -32px; '
            f'border-radius: 32px; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center">'
            f'{kit.spinner(t, 30, WHITE, "rgba(255,255,255,0.25)")}</span>')
    return phone(t, top_bar(t) + stage(t, spin) + full_controls(t, 64.23, paused=True, load_failed=True)
                 + toast(t, 'Couldn’t save', top=392, icon_name='warning'))


def section_view(t):
    name, a, b, linked = spot_by(t, 2)
    ov = loop_badges(t, name, linked[0] if linked else None)
    return phone(t, top_bar(t, section=True) + stage(t, ov, loop_pct=38) + section_controls(t, name, a, b, 66.7))


def section_hidden_zoom(t):
    name, a, b, linked = spot_by(t, 2)
    ov = loop_badges(t, name, linked[0] if linked else None) + zoom_chip(t, '2×')
    return phone(t, top_bar(t, section=True) + stage(t, ov, zoom=2.0, origin='52% 42%', loop_pct=38) + slim_bar(t, 66.7, a, b))


def section_doubletap(t):
    name, a, b, linked = spot_by(t, 4)
    ov = loop_badges(t, name, None) + jump_mark(t, 'left', '« 3 s')
    return phone(t, top_bar(t, section=True) + stage(t, ov, loop_pct=20) + section_controls(t, name, a, b, 123.3))


def editor_section(t):
    sp = spot_by(t, 2)
    return phone(t, top_bar(t) + stage(t, loop_pct=None) + compact_transport_row(t, 64.23, paused=False)
                 + editor_panel(t, sp, 'start', 64.0, now='1:04.2') + editor_footer(t))


def editor_end_now(t):
    sp = spot_by(t, 4)
    return phone(t, top_bar(t) + stage(t) + compact_transport_row(t, 128.4)
                 + editor_panel(t, sp, 'end', 128.4, loop=False, now='2:08.4') + editor_footer(t)
                 + toast(t, 'End set to 2:08.40', top=200))


def editor_point(t):
    sp = spot_by(t, 0)
    return phone(t, top_bar(t) + stage(t, paused=True) + compact_transport_row(t, 0.0)
                 + editor_panel(t, sp, 'start', 0.0, now='0:00.0', disabled=('-1', '-0.1')) + editor_footer(t))


def _editor_base(t, i=2):
    sp = spot_by(t, i)
    return top_bar(t) + stage(t) + compact_transport_row(t, 64.23, paused=True) + editor_panel(t, sp, 'start', 64.0) + editor_footer(t)


def two(t, a, b):
    fx = lambda h: h.replace('width: 100%; ', '').replace('flex: none;', 'flex: 1; min-width: 0;')
    return f'<div style="display: flex; gap: 8px">{fx(a)}{fx(b)}</div>'


def rename_sheet(t):
    name, a, b, _ = spot_by(t, 2)
    field = kit.text_field(t, 'Name', name, rng(a, b), 'filled', helper='Leave it empty to show the times.')
    foot = two(t, kit.button(t, "Cancel", "secondary", size="md", on=t["sheet_bg"]), kit.button(t, "Save", "primary", size="md", on=t["sheet_bg"]))
    return phone(t, _editor_base(t) + kit.bottom_sheet(t, 'Rename', field, foot, sub=f'{rng(a, b)} · {length(b - a)}'))


def delete_sheet(t):
    name, a, b, _ = spot_by(t, 4)
    body = f'<p style="margin: 0; font-size: 15px; line-height: 1.45; color: {t["ink2"]}">The section goes from this video. You can undo it for a few seconds.</p>'
    foot = two(t, kit.button(t, "Keep it", "secondary", size="md", on=t["sheet_bg"]), kit.button(t, "Delete", "danger", icon_name="trash", size="md", on=t["sheet_bg"]))
    return phone(t, _editor_base(t, 4) + kit.bottom_sheet(t, f'Delete “{name}”?', body, foot, sub=f'{rng(a, b)} · {length(b - a)}'))


def delete_linked(t):
    name, a, b, linked = spot_by(t, 2)
    body = kit.banner(t, 'warning', f'Linked to {linked[0]}', 'Unlink it there first; until then this section stays.')
    foot = two(t, kit.button(t, "Keep it", "secondary", size="md", on=t["sheet_bg"]), kit.button(t, "Delete", "danger", state="disabled", icon_name="trash", size="md", on=t["sheet_bg"]))
    return phone(t, _editor_base(t) + kit.bottom_sheet(t, f'Delete “{name}”?', body, foot, sub=f'{rng(a, b)} · {length(b - a)}'))


def deleted_undo(t):
    name = spot_by(t, 4)[0]
    sp = [s for s in C(t)['spots'] if s[0] != name]
    saved = CONTENT[t['dance']]['spots']
    CONTENT[t['dance']]['spots'] = sp
    try:
        out = phone(t, top_bar(t) + stage(t) + full_controls(t, 122.0)
                    + toast(t, f'Deleted {name}', ('Undo',), bottom=22, icon_name='trash'))
    finally:
        CONTENT[t['dance']]['spots'] = saved
    return out


def all_sheet(t):
    sp = C(t)['spots']
    rows = ''
    for i, (name, a, b, linked) in enumerate(sp):
        last = i == len(sp) - 1
        hair = '' if last else f'border-bottom: 1px solid {t["hairline"]};'
        kind = 'point' if b is None else length(b - a)
        meta = f'{spot_time(a) if b is None else rng(a, b)} · {kind}'
        lk = (f'<span style="display: flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 600; color: {t["ink2"]}">'
              f'{kit.icon("link", 13, t["ink2"])}Linked to {", ".join(linked)}</span>') if linked else ''
        tile = (f'<span style="width: 40px; height: 40px; border-radius: 12px; flex: none; background: {t["step"]}; display: flex; align-items: center; justify-content: center">'
                f'{kit.icon("flag" if b is None else "repeat", 20, t["ink2"])}</span>')
        rows += (f'<li style="list-style: none; display: flex; align-items: center; gap: 4px; padding-left: 14px">'
                 f'<button type="button" style="flex: 1; min-width: 0; min-height: 62px; border: 0; background: none; padding: 8px 0; display: flex; align-items: center; gap: 12px; '
                 f'text-align: left; color: {t["ink"]}; cursor: pointer; {hair}">{tile}'
                 f'<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 16px; font-weight: 700">{name}</span>'
                 f'<span style="font-size: 13px; color: {t["muted"]}; font-variant-numeric: tabular-nums">{meta}</span>{lk}</span></button>'
                 f'<span style="align-self: stretch; display: flex; align-items: center; padding-right: 8px; {hair}">'
                 f'{pbtn(t, "Edit", "edit", "neutral", h=36, pad="0 12px 0 10px", fs=13).replace(kit.icon("edit", 20, t["ink"]), kit.icon("edit", 15, t["ink"]))}</span></li>')
    lst = f'<ul style="margin: 0; padding: 0; background: {t["surface"]}; border-radius: 16px; overflow: hidden">{rows}</ul>'
    panel = (f'<div role="dialog" aria-label="Sections and points" style="flex: none; background: {t["sheet_bg"]}; border-radius: 28px 28px 0 0; padding: 8px 16px 22px; '
             f'display: flex; flex-direction: column; gap: 8px">'
             f'<div aria-hidden="true" style="width: 40px; height: 5px; border-radius: 3px; background: {t["grabber"]}; margin: 0 auto"></div>'
             f'<div style="display: flex; align-items: center; min-height: 44px; padding-left: 4px; margin-right: -6px">'
             f'<h3 style="margin: 0; flex: 1; {kit.ts("headline", t["ink"])}">Sections and points</h3>'
             f'<span style="font-size: 14px; font-weight: 700; color: {t["muted"]}; margin-right: 4px">{len(sp)}</span>'
             f'{kit.icon_button(t, "close", "Close list", "bare", on=t["sheet_bg"])}</div>{lst}</div>')
    return phone(t, top_bar(t) + stage(t) + panel)


def link_sheet(t):
    name, a, b, linked = spot_by(t, 2)
    two = C(t)['linked2']
    rows = []
    for i, l in enumerate(two):
        drill = 'drill' in l.lower()
        rows.append(kit.row(t, l.replace(' · Drill', '') if drill else l, 'Drill' if drill else 'Variation',
                            kit.icon_button(t, 'close', f'Unlink {l}', 'bare', color=t['muted'], on=t['surface']), last=i == len(two) - 1, min_h=58))
    trig = (f'<button type="button" aria-haspopup="dialog" style="height: 52px; border: 0; border-radius: 26px; background: {t["surface"]}; '
            f'box-shadow: inset 0 0 0 1px {t["field_line"]}; display: flex; align-items: center; gap: 10px; padding: 0 16px; color: {t["ink"]}; font-size: 16px; '
            f'font-weight: 700; cursor: pointer; flex: none">{kit.icon("search", 20, t["muted"])}<span style="flex: 1; text-align: left">Link a figure or drill…</span>'
            f'{kit.chevron(t)}</button>')
    inner = kit.section_label(t, 'Linked') + kit.list_group(t, rows) + trig
    ov = loop_badges(t, name, f'{two[0]} +1')
    return phone(t, top_bar(t, section=True) + stage(t, ov, loop_pct=38) + section_controls(t, name, a, b, 66.7)
                 + kit.bottom_sheet(t, f'Link {rng(a, b)}', inner, sub=f'{name} · {length(b - a)}'))


# --------------------------------------------------------------------------
# landscape screens (844 x 390)
# --------------------------------------------------------------------------

def _land_stage(t, ov='', zoom=1.0, paused=False, loop_pct=None, mirror=False):
    pic = picture(t, wide=True, zoom=zoom, mirror=mirror, origin='55% 45%').replace('width: 100%; aspect-ratio: 16 / 9;', 'height: 100%; aspect-ratio: 16 / 9;')
    play = ''
    if paused:
        play = (f'<span aria-hidden="true" style="position: absolute; left: 50%; top: 50%; width: 64px; height: 64px; margin: -32px 0 0 -32px; border-radius: 32px; '
                f'background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center">{kit.icon("play", 30, WHITE, filled=True, style="margin-left: 3px")}</span>')
    lp = (f'<span style="position: absolute; left: 0; bottom: 0; height: 3px; width: {loop_pct}%; background: {t["accent"]}"></span>' if loop_pct is not None else '')
    return (f'<div role="button" tabindex="0" aria-label="Pause" style="position: absolute; inset: 0; background: {BLACK}; display: flex; justify-content: center; overflow: hidden">'
            f'{pic}{play}{lp}{ov}</div>')


def _land_top(t, section=False, spots=True, mirror=False, rate='1×', sub=None):
    c = C(t)
    if section:
        mid = (pbtn(t, 'Full video', 'chevron-left', 'glass', h=40, pad='0 14px 0 8px', fs=14)
               + title_block(t, c['lesson'], 'Looping')
               + pbtn(t, 'Edit', 'edit', 'glass', h=40, pad='0 14px 0 12px', fs=14))
    else:
        mid = title_block(t, c['lesson'], sub or c['lesson_sub'])
        if spots:
            mid += pbtn(t, f'Sections ({len(c["spots"])})', 'list', 'glass', h=40, pad='0 14px 0 12px', fs=14)
    return (f'<div style="position: absolute; left: 0; right: 0; top: 0; padding: 10px 44px 30px; display: flex; align-items: center; gap: 8px; background: {t["top_scrim"]}">'
            f'{close_btn(t, glass=True)}{mid}{mirror_btn(t, mirror, glass=True)}{speed_btn(t, rate, glass=True)}</div>')


def land_full(t):
    bottom = (f'<div style="position: absolute; left: 0; right: 0; bottom: 0; padding: 40px 48px 14px; background: {t["bottom_scrim"]}">'
              f'{timeline(t, 64.23, overlay=True)}'
              f'<div style="display: flex; align-items: center; gap: 8px; margin-top: 2px">'
              f'<span style="width: 170px">{big_time(t, "1:04.23", "/ 2:41.00", 20)}</span><span style="flex: 1"></span>'
              f'{transport(t, overlay=True)}<span style="flex: 1"></span>'
              f'<span style="width: 170px; display: flex; justify-content: flex-end; gap: 6px">{pbtn(t, "Mark", "flag", "glass", h=44, pad="0 12px", fs=14)}'
              f'{pbtn(t, "Section", "scissors", "glass", h=44, pad="0 12px", fs=14)}</span></div></div>')
    return land(t, _land_stage(t) + _land_top(t) + bottom)


def land_section(t):
    name, a, b, linked = spot_by(t, 2)
    badge = (f'<div style="display: flex; margin-bottom: 4px">'
             f'{on_video_pill(t, kit.icon("repeat", 15, t["accent"]) + name)}<span style="width: 6px"></span>'
             f'{on_video_pill(t, kit.icon("link", 14, "rgba(255,255,255,0.8)") + linked[0], button=True, label="Links: " + linked[0])}</div>')
    bottom = (f'<div style="position: absolute; left: 0; right: 0; bottom: 0; padding: 30px 48px 12px; background: {t["bottom_scrim"]}">{badge}'
              f'{timeline(t, 66.7, a, b, bands=[], accent_fill=True, overlay=True)}{ends_row(t, spot_time(a), spot_time(b), "2.7 / 7.2 s", overlay=True)}'
              f'<div style="margin-top: 6px">{transport(t, overlay=True)}</div></div>')
    return land(t, _land_stage(t, loop_pct=38) + _land_top(t, section=True) + bottom)


def _land_left(t, inner_bottom, paused=True):
    c = C(t)
    top = (f'<div style="height: 52px; flex: none; display: flex; align-items: center; gap: 4px; padding: 0 4px 0 40px">'
           f'{close_btn(t)}{title_block(t, c["lesson"], c["lesson_sub"])}{mirror_btn(t)}{speed_btn(t)}</div>')
    vid = (f'<div style="flex: 1; min-height: 0; background: {BLACK}; display: flex; justify-content: center; overflow: hidden; position: relative">'
           f'{picture(t, wide=True).replace("width: 100%; aspect-ratio: 16 / 9;", "height: 100%; aspect-ratio: 16 / 9;")}</div>')
    return (f'<div style="position: absolute; left: 0; top: 0; bottom: 0; width: 472px; display: flex; flex-direction: column; background: {BLACK}">'
            f'{top}{vid}{inner_bottom}</div>')


def _land_panel(t, inner):
    return (f'<div style="position: absolute; right: 0; top: 0; bottom: 0; width: 372px; box-sizing: border-box; display: flex; flex-direction: column; '
            f'border-left: 1px solid {t["surface"]}; background: {BLACK}; padding-right: 28px">{inner}</div>')


def land_editor(t):
    sp = spot_by(t, 2)
    under = (f'<div style="height: 60px; flex: none; display: flex; align-items: center; gap: 8px; padding: 0 12px 0 44px">'
             f'<span style="font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums">1:04.23</span><span style="flex: 1"></span>'
             f'{transport(t, "compact", True)}</div>')
    ed = editor_panel(t, sp, 'start', 64.0, pad='12px 16px 8px')
    scroll = (f'<div style="flex: 1; min-height: 0; overflow: hidden; position: relative">{ed}'
              f'<div aria-hidden="true" style="position: absolute; left: 0; right: 0; bottom: 0; height: 36px; background: linear-gradient(rgba(0,0,0,0), {BLACK})"></div></div>')
    return land(t, _land_left(t, under) + _land_panel(t, scroll + editor_footer(t, '8px 16px 12px')))


def land_list(t):
    sp = C(t)['spots']
    under = (f'<div style="height: 64px; flex: none; display: flex; align-items: center; gap: 8px; padding: 0 12px 0 44px">'
             f'<span style="font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums">1:04.23</span><span style="flex: 1"></span>'
             f'{transport(t, "overlay", True)}</div>')
    rows = ''
    for i, (name, a, b, linked) in enumerate(sp):
        hair = '' if i == len(sp) - 1 else f'border-bottom: 1px solid {t["hairline"]};'
        meta = f'{spot_time(a) if b is None else rng(a, b)} · {"point" if b is None else length(b - a)}'
        lk = f' · <span style="color: {t["ink2"]}">linked</span>' if linked else ''
        rows += (f'<li style="list-style: none; display: flex; align-items: center; gap: 6px; padding-left: 12px">'
                 f'<button type="button" style="flex: 1; min-width: 0; min-height: 52px; border: 0; background: none; padding: 6px 0; display: flex; align-items: center; gap: 10px; '
                 f'text-align: left; color: {t["ink"]}; cursor: pointer; {hair}">{kit.icon("flag" if b is None else "repeat", 20, t["ink2"])}'
                 f'<span style="flex: 1; min-width: 0; display: flex; flex-direction: column"><span style="font-size: 15px; font-weight: 700">{name}</span>'
                 f'<span style="font-size: 12.5px; color: {t["muted"]}; font-variant-numeric: tabular-nums">{meta}{lk}</span></span></button>'
                 f'<span style="align-self: stretch; display: flex; align-items: center; padding-right: 6px; {hair}">'
                 f'{pbtn(t, "Edit", "edit", "neutral", h=36, pad="0 12px 0 10px", fs=13).replace(kit.icon("edit", 20, t["ink"]), kit.icon("edit", 15, t["ink"]))}</span></li>')
    head = (f'<div style="height: 52px; flex: none; display: flex; align-items: center; padding: 0 4px 0 16px">'
            f'<h3 style="margin: 0; flex: 1; {kit.ts("title", t["ink"])}">Sections and points · {len(sp)}</h3>'
            f'{kit.icon_button(t, "close", "Close list", "bare", on=BLACK)}</div>')
    lst = f'<ul style="margin: 0 12px; padding: 0; background: {t["surface"]}; border-radius: 16px; overflow: hidden">{rows}</ul>'
    return land(t, _land_left(t, under) + _land_panel(t, head + lst))


def land_faded_zoom(t):
    ov = zoom_chip(t, '2.4×', top=16) + jump_mark(t, 'right', '1 s »')
    return land(t, _land_stage(t, ov, zoom=2.4))


# --------------------------------------------------------------------------
# board
# --------------------------------------------------------------------------

PORTRAIT = [
    ('Full video · playing', 'Upright recording: every control under the picture. Time, Hide, the timeline (sections as bands, points as ticks), the transport, Mark point / Start section, the row of sections.', full_video),
    ('Speed and Mirror', 'Paused (play glyph on the picture). The speed pill opens 0.25 – 1×; Mirror on flips the picture and lights up. The corner badge says so.', full_paused_speed),
    ('Marking a section', 'Start section became End section · 3.2 s in the accent; the growing band shows on the timeline.', full_marking),
    ('Saved', 'The toast after End section offers Edit and Link (Link only where the page manages links; stays 6 s).', full_saved_toast),
    ('Hidden', 'Hide folds the controls to a slim bar: the timeline, Show, ±0.1 s around Play, the time. The top bar stays.', full_hidden),
    ('Nothing marked · wide video', 'A wide lesson video sits centred with black above and below. With no spots the row becomes the hint.', full_empty_wide),
    ('Loading and errors', 'The video buffering (spinner on the picture), spots that failed to load, and a failed write as a toast.', full_errors),
    ('Section view', 'Looping one section: ‹ Full video and a coloured Edit in the top bar, the name and its link on the picture, the section\'s own timeline, the large transport, its chip lit.', section_view),
    ('Section · hidden and zoomed', 'Hide in a section keeps its timeline and 2.7 / 7.2 s. Pinched in: the Zoom 2× chip with Reset sits top right.', section_hidden_zoom),
    ('Double-tap a side', 'A double tap on the left third jumps back; each further tap adds a second (« 3 s). Nothing is linked here and the page may link: the badge says Link.', section_doubletap),
    ('Editor · section', 'Compact transport under the video; the name opens Rename; Looping; Linked to … opens the Link popup; the trim strip; Start | End; Move the start; Whole section; Delete / Done.', editor_section),
    ('Editor · end, Now', 'End chosen (its handle lit), Loop rested for this visit, nothing linked yet. Now set the end without seeking and says so.', editor_end_now),
    ('Editor · point', 'A point: one marker, no Start | End, no Whole section, no Loop. At 0:00.00 the backward steps are disabled.', editor_point),
    ('Rename', 'A sheet over the editor. The field is not focused: the keyboard opens only when it is tapped. Empty shows the times.', rename_sheet),
    ('Delete asks', 'Nothing destructive in one tap: Keep it / Delete.', delete_sheet),
    ('Delete · linked section', 'A linked section cannot go: the sheet says why and Delete is disabled.', delete_linked),
    ('Deleted · Undo', 'Back at the full video, the section gone from the row and the timeline; Undo for about 4 s.', deleted_undo),
    ('All · the list', 'All opens every spot as a sheet over the controls, video still in view. A card opens its level; Edit opens the editor.', all_sheet),
    ('Link popup in the player', 'The Link entry from the badge, toast or editor line: the shared Link popup as a player sheet (its levels belong to the Links area).', link_sheet),
]

LANDSCAPE = [
    ('Landscape · full video', 'The picture fills the screen; controls float over it on scrims and fade after 3 s of playing. Sections (n) opens the list beside the video.', land_full),
    ('Landscape · section view', '‹ Full video and Edit in the top bar, "Looping" under the title; the name and link above the section\'s timeline.', land_section),
    ('Landscape · editor', 'The editor is a panel beside the video, not over it; it scrolls, Delete / Done stay pinned.', land_editor),
    ('Landscape · the list', 'Sections (n): the list as the same right panel, Edit on every card; the video shrinks beside it.', land_list),
    ('Landscape · faded, zoomed', 'Playing with the controls faded (a tap brings them back). Zoom 2.4× with Reset; a double tap on the right jumps 1 s.', land_faded_zoom),
]

PW, PH, LW, LH = 390, 844, 844, 390
PAIR_GAP, COL_GAP, ROW_GAP, PAD = 48, 96, 72, 48
CAP_H = 84


def caption(name, note, w):
    return (f'<div style="width: {w}px; height: {CAP_H}px; display: flex; flex-direction: column; gap: 4px; padding-left: 4px; box-sizing: border-box">'
            f'<span style="font-size: 22px; font-weight: 800; letter-spacing: -0.01em; color: {kit.BOARD_INK}">{kit.esc(name)}</span>'
            f'<span style="font-size: 15px; font-weight: 600; line-height: 1.35; color: {kit.BOARD_MUTED}">{kit.esc(note)}</span></div>')


def tag(text):
    return f'<span style="font-size: 13px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: {kit.BOARD_MUTED}">{text}</span>'


def portrait_cell(name, note, fn):
    s, b = fn(kit.theme('salsa', 'media')), fn(kit.theme('bachata', 'media'))
    w = PW * 2 + PAIR_GAP
    return (f'<!-- {kit.esc(name)} --><div style="width: {w}px; flex: none; display: flex; flex-direction: column; gap: 20px">'
            f'<div style="display: flex; gap: {PAIR_GAP}px">{s}{b}</div>{caption(name, note, w)}</div>')


def land_cell(name, note, fn):
    s, b = fn(kit.theme('salsa', 'media')), fn(kit.theme('bachata', 'media'))
    return (f'<!-- {kit.esc(name)} --><div style="width: {LW}px; flex: none; display: flex; flex-direction: column; gap: 20px">'
            f'<div style="display: flex; flex-direction: column; gap: {PAIR_GAP}px">{s}{b}</div>{caption(name, note, LW)}</div>')


def section_head(title, sub):
    return (f'<div style="height: 64px; flex: none; display: flex; flex-direction: column; gap: 6px; justify-content: flex-end">'
            f'<h2 style="margin: 0; font-size: 26px; font-weight: 800; {kit.BRIC}">{title}</h2>'
            f'<p style="margin: 0; font-size: 16px; color: {kit.BOARD_MUTED}">{sub}</p></div>')


def board():
    per = 3
    prow_w = per * (PW * 2 + PAIR_GAP) + (per - 1) * COL_GAP
    lrow_w = per * LW + (per - 1) * COL_GAP
    width = PAD * 2 + max(prow_w, lrow_w)
    prow_h = PH + 20 + CAP_H
    lrow_h = LH * 2 + PAIR_GAP + 20 + CAP_H
    prows = [PORTRAIT[i:i + per] for i in range(0, len(PORTRAIT), per)]
    lrows = [LANDSCAPE[i:i + per] for i in range(0, len(LANDSCAPE), per)]
    blocks = []
    blocks.append(f'<div style="height: 64px; flex: none; display: flex; flex-direction: column; gap: 6px">'
                  f'<h1 style="margin: 0; font-size: 30px; font-weight: 800; {kit.BRIC}">Video player</h1>'
                  f'<p style="margin: 0; font-size: 16px; color: {kit.BOARD_MUTED}">The full-screen player in the C4 look. It is always dark because it sits over video, '
                  f'so there is no light/dark pair: every screen is drawn in the kit\'s media palette for each dance — salsa left (or on top), bachata right (or below).</p></div>')
    h = PAD + 64
    blocks.append(section_head('Portrait · 390 × 844', 'Laid out for upright videos: the controls are sized first, the video takes what is left and nothing covers it.'))
    h += ROW_GAP + 64
    for r in prows:
        blocks.append(f'<div style="display: flex; gap: {COL_GAP}px; align-items: flex-start; height: {prow_h}px; flex: none">{"".join(portrait_cell(*c) for c in r)}</div>')
        h += ROW_GAP + prow_h
    blocks.append(section_head('Phone landscape · 844 × 390', 'The picture fills the screen and the controls float over it; the editor and the list open as a panel beside it.'))
    h += ROW_GAP + 64
    for r in lrows:
        blocks.append(f'<div style="display: flex; gap: {COL_GAP}px; align-items: flex-start; height: {lrow_h}px; flex: none">{"".join(land_cell(*c) for c in r)}</div>')
        h += ROW_GAP + lrow_h
    h += PAD
    body = (f'<div style="width: {width}px; height: {h}px; box-sizing: border-box; padding: {PAD}px; background: {kit.BOARD_BG}; color: {kit.BOARD_INK}; {kit.MANROPE}; '
            f'display: flex; flex-direction: column; gap: {ROW_GAP}px; overflow: hidden">' + '\n'.join(blocks) + '</div>')
    return kit.document(body, width, h, 'Video player'), width, h


if __name__ == '__main__':
    html, w, h = board()
    kit.write(OUT, html)
    print(w, h)
