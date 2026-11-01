"""Mockups: our own inline video player in every place VideoFrame shows, drawn with the design kit.

python3 -I inline.py OUT.html  (a plain page, not a .dc.html board)
"""
import os
import sys

K = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, K)
import kit  # noqa: E402  (the repo's kit, before the screens add their stale path)

sys.path.insert(0, K + '/screens')
import lessons  # noqa: E402
import figure  # noqa: E402
import logging as lg  # noqa: E402

WHITE = '#ffffff'
DUR = 68.0  # 1:08, the video in the screenshot
SECS = [(5.0, 13.7), (31.7, 40.3), (45.3, 56.9), (58.0, 63.0)]


def mmss(s):
    return f'{int(s) // 60}:{int(s) % 60:02d}'


def pct(s, dur=DUR):
    return max(0.0, min(100.0, s / dur * 100))


def seek(t, at, bands, dur=DUR):
    """The seek bar on the picture: the player's track, sections as bands, its playhead."""
    out = (f'<span style="position: absolute; left: 0; right: 0; top: 20px; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.3)"></span>'
           f'<span style="position: absolute; left: 0; top: 20px; height: 4px; border-radius: 2px; width: {pct(at, dur):.1f}%; background: rgba(255,255,255,0.7)"></span>')
    for a, b in bands:
        out += (f'<span style="position: absolute; top: 17px; height: 10px; min-width: 4px; border-radius: 3px; left: {pct(a, dur):.1f}%; '
                f'width: {pct(b, dur) - pct(a, dur):.1f}%; background: rgba(255,255,255,0.38)"></span>')
    out += (f'<span style="position: absolute; top: 11px; width: 4px; height: 22px; margin-left: -2px; border-radius: 2px; left: {pct(at, dur):.1f}%; '
            f'background: {WHITE}; box-shadow: 0 0 0 2px #000"></span>')
    return (f'<div role="slider" aria-label="Position" aria-valuetext="{mmss(at)}" '
            f'style="position: relative; height: 44px">{out}</div>')


def disc(size=48):
    """The board's play disc on a thumbnail, a little bigger: a tap target."""
    return (f'<button type="button" aria-label="Play" style="position: absolute; left: 50%; top: 50%; width: {size}px; height: {size}px; '
            f'margin: -{size // 2}px 0 0 -{size // 2}px; border: 0; padding: 0; border-radius: {size // 2}px; background: rgba(0,0,0,0.42); '
            f'display: flex; align-items: center; justify-content: center; cursor: pointer">'
            f'{kit.icon("play", size // 2, WHITE, filled=True, style="margin-left: 3px")}</button>')


def picture(t, state='idle', at=0.0, bands=SECS, dur=DUR, h=201, tone=0, upright=True):
    """The inline player. idle: never played (board thumbnail + duration). playing: bar on a scrim.
    paused: bar + the disc. buffering: bar + a spinner."""
    if upright:
        w = int(h * 9 / 16)
        art = kit.thumb(t, w, h, None, tone, play=False, radius=0)
        base = f'<div style="position: absolute; inset: 0; background: #000; display: flex; justify-content: center">{art}</div>'
    else:
        base = '<div style="position: absolute; inset: 0">' + kit.thumb(t, 358, h, None, tone, play=False, radius=0).replace('width: 358px', 'width: 100%') + '</div>'
    over = ''
    if state == 'idle':
        over = disc() + (f'<span style="position: absolute; right: 8px; bottom: 8px; height: 20px; padding: 0 7px; border-radius: 10px; background: rgba(0,0,0,0.62); '
                         f'color: {WHITE}; font-size: 12px; font-weight: 800; display: flex; align-items: center; font-variant-numeric: tabular-nums">{mmss(dur)}</span>')
    else:
        if state == 'paused':
            over += disc()
        if state == 'buffering':
            over += (f'<span style="position: absolute; left: 50%; top: 50%; margin: -18px 0 0 -18px">'
                     f'{kit.spinner(t, 36, WHITE, "rgba(255,255,255,0.25)")}</span>')
        over += (f'<div style="position: absolute; left: 0; right: 0; bottom: 0; padding: 22px 12px 0; '
                 f'background: linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.72))">'
                 f'<span style="display: block; color: {WHITE}; font-size: 12px; font-weight: 800; font-variant-numeric: tabular-nums; margin-bottom: -10px">'
                 f'{mmss(at)} <span style="color: rgba(255,255,255,0.7)">/ {mmss(dur)}</span></span>'
                 f'{seek(t, at, bands, dur)}</div>')
    return f'<div style="position: relative; width: 100%; height: {h}px; overflow: hidden; background: #000">{base}{over}</div>'


# ---- the card as the app draws it now (VideoFrame with a caption) ---------------------------

def controls_row(t, mirror=False, full_here=True):
    fs = kit.icon_button(t, 'expand', 'Full screen', 'bare', color=t['muted'], icon_size=22, on=t['surface']) if full_here else ''
    return (f'<div style="display: flex; align-items: center; gap: 8px; padding: 0 12px 10px 8px">'
            f'{lg.mirror_toggle(t, mirror)}<span style="font-size: 13px; font-weight: 700; color: {t["muted"]}">Mirror</span>{fs}'
            f'<span style="flex: 1"></span>{lg.speed_switch(t, 3)}</div>')


def caption_row(t, title, meta, trailing):
    return (f'<div style="display: flex; align-items: center; gap: 4px; padding: 6px 6px 6px 14px">'
            f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px">'
            f'<span style="font-size: 15px; font-weight: 700">{title}</span>'
            f'<span style="font-size: 12px; color: {t["muted"]}">{meta}</span></div>{trailing}</div>')


LESSON_SECS = [('Madrid', '0:05.0–0:13.7', 'Paso Madrid · Basic'),
               ('Madrid to cradle', '0:31.7–0:40.3', 'Paso Madrid · To Cradle'),
               ('Madrid to shadow', '0:45.3–0:56.9', 'Paso Madrid · To shadow')]


def lesson_card(t, state, at):
    trash = kit.icon_button(t, 'trash', 'Delete video', 'bare', color=t['danger'], on=t['surface'])
    rows = ''
    for i, (title, rng, link) in enumerate(LESSON_SECS):
        lk = kit.icon_button(t, 'link', f'Link {title}', 'bare', color=t['accent_text'], on=t['surface'])
        rows += kit.row(t, title, f'{rng} · Linked to {link}', lk, leading=figure.play_disc(t, 40), last=i == len(LESSON_SECS) - 1, min_h=62)
    sec = (f'<div style="border-top: 1px solid {t["hairline"]}; padding-top: 12px">'
           f'<span style="display: block; padding: 0 16px 2px; {kit.ts("label", t["muted"])}">Sections · 4</span>{rows}</div>')
    return (f'<article style="background: {t["surface"]}; color: {t["ink"]}; border-radius: 22px; overflow: hidden; flex: none">'
            f'{picture(t, state, at)}{caption_row(t, "Video 1", "5 MB", trash)}{controls_row(t)}{sec}</article>')


def lesson_page(state, at):
    def fn(t):
        body = lessons.review_group(t) + kit.section_label(t, 'Videos · 1', 6) + lesson_card(t, state, at)
        return kit.page(t, lessons.lesson_header(t, 'Skupina 1', '13 May 2026'), body, pad='20px 16px 0')
    return fn


def recording_card(t, state, at):
    full = kit.icon_button(t, 'expand', 'Full screen', 'bare', color=t['muted'], icon_size=22, on=t['surface'])
    spots = [('Second turn', '0:12–0:19 · Linked to Hammerlock · Basic'), ('0:24–0:31', 'Not linked')]
    rows = ''
    for i, (title, m) in enumerate(spots):
        lk = kit.icon_button(t, 'link', f'Link {title}', 'bare', color=t['accent_text'], on=t['surface'])
        rows += kit.row(t, title, m, lk, leading=figure.play_disc(t, 36), last=i == len(spots) - 1, min_h=58)
    sec = (f'<div style="border-top: 1px solid {t["hairline"]}"><div style="padding: 10px 16px 0; {kit.ts("label", t["muted"])}">'
           f'Sections · 2</div>{rows}</div>')
    return (f'<div style="background: {t["surface"]}; color: {t["ink"]}; border-radius: 16px; overflow: hidden; flex: none">'
            f'{picture(t, state, at, [(12, 19), (24, 31)], 41.0, tone=0)}'
            f'{caption_row(t, "Wednesday 28 October", "34 MB", full)}{controls_row(t, full_here=False)}{sec}</div>')


def figure_page(t):
    body = (figure.label(t, 'Recordings · 1', 10) + recording_card(t, 'playing', 14.2)
            + kit.button(t, 'Add video or audio', 'secondary', icon_name='upload', full=True))
    return figure.scrolled(t, 'Enchufla', 'Doble', body, figure.var_bar(t, 'Enchufla', 'Doble', 2, 3))


# ---- the Today popups: swap the board's thumbnail for the player -----------------------------

POPUP = {'state': 'playing', 'at': 21.0, 'dur': 48.0, 'bands': [(14, 22), (30, 36)]}


_orig_thumb = lg.wide_thumb


def popup_thumb(t, h=176, duration=None, tone=0, label='Play'):
    if duration is None:  # a YouTube card keeps its embed's thumbnail
        return _orig_thumb(t, 168, None, tone, label)
    return picture(t, POPUP['state'], POPUP['at'], POPUP['bands'], POPUP['dur'], h=188, tone=tone)


lg.wide_thumb = popup_thumb


def figure_popup(t):
    POPUP.update(state='playing', at=21.0, dur=48.0, bands=[(14, 22), (30, 36)])
    return lg.figure_default(t)


def lesson_popup(t):
    POPUP.update(state='paused', at=95.0, dur=204.0, bands=[(20, 41), (88, 110), (130, 150), (170, 190)])
    yt, lg.yt_card = lg.yt_card, lambda *a, **k: ''  # the YouTube card pushed the video below the fold
    try:
        return lg.lesson_review(t)
    finally:
        lg.yt_card = yt


# ---- close-up: every state of the picture ----------------------------------------------------

def closeups(t):
    st = [('Not played yet', 'idle', 0.0, SECS), ('Playing', 'playing', 9.1, SECS), ('Paused', 'paused', 36.4, SECS),
          ('Loading', 'buffering', 36.4, SECS), ('No sections', 'playing', 22.0, [])]
    cells = ''
    for name, s, at, b in st:
        cells += (f'<figure style="margin: 0; width: 358px; flex: none; display: flex; flex-direction: column; gap: 8px">'
                  f'<div style="border-radius: 16px; overflow: hidden">{picture(t, s, at, b)}</div>'
                  f'<figcaption style="font-size: 15px; font-weight: 700; color: #e8e8ea">{name}</figcaption></figure>')
    return f'<div style="display: flex; flex-wrap: wrap; gap: 24px">{cells}</div>'


def section(title, note, phones):
    return (f'<section style="margin: 0 0 56px"><h2 style="margin: 0 0 4px; font-size: 24px; {kit.BRIC}">{title}</h2>'
            f'<p style="margin: 0 0 20px; font-size: 15px; color: #a0a0a8; max-width: 900px">{note}</p>'
            f'<div style="display: flex; flex-wrap: wrap; gap: 28px; align-items: flex-start">{phones}</div></section>')


def cap(html, text):
    return (f'<div style="display: flex; flex-direction: column; gap: 10px; flex: none">{html}'
            f'<span style="font-size: 14px; font-weight: 700; color: #c8c8cc">{text}</span></div>')


if __name__ == '__main__':
    sd, sl, bd = kit.THEMES[('salsa', 'dark')], kit.THEMES[('salsa', 'light')], kit.THEMES[('bachata', 'dark')]
    body = (
        section('The picture, close up',
                'Our controls replace the browser’s: no volume, no ⋮ menu, no browser full screen. Before the first play it is the '
                'board’s thumbnail as drawn. Once played, the time and a seek bar sit on a dark fade, with the sections as bands, '
                'as in the full-screen player. Tap the picture to play or pause. Mirror, speed and Full screen stay under it, where the board has them.',
                closeups(bd))
        + section('Lesson page', 'The card from your screenshot (bachata, dark). Caption row with Delete; Mirror, Full screen and speed beneath; sections below, unchanged.',
                  cap(lesson_page('idle', 0)(bd), 'Not played yet') + cap(lesson_page('playing', 9.1)(bd), 'Playing')
                  + cap(lesson_page('paused', 36.4)(bd), 'Paused') + cap(lesson_page('playing', 9.1)(sl), 'Playing · salsa, light theme'))
        + section('Figure page · a recording', 'Full screen sits in the caption row here (no Delete outside editing), as now.',
                  cap(figure_page(sd), 'Playing · salsa dark') + cap(figure_page(bd), 'Playing · bachata dark'))
        + section('Today · the log popups', 'The figure popup’s reference and the lesson review popup: the same player inside the sheet.',
                  cap(figure_popup(bd), 'Figure popup · playing') + cap(lesson_popup(bd), 'Lesson review popup · paused'))
    )
    html = (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
            f'<title>Inline video player</title>{kit.FONTS_LINK}<style>body{{margin:0}}button{{font:inherit}}</style></head>'
            f'<body style="background: #141416; color: #f2f2f4; {kit.MANROPE}; padding: 40px">'
            f'<h1 style="margin: 0 0 6px; font-size: 32px; {kit.BRIC}">Our player in the page</h1>'
            f'<p style="margin: 0 0 40px; font-size: 16px; color: #a0a0a8">Every place a video shows inline, drawn with the design board’s building blocks.</p>'
            f'{body}</body></html>')
    kit.write(sys.argv[1], html)
