"""Logging a set and the exercise page, redrawn in the C4 look.

usage: python3 logging.py OUT.dc.html
Area: the log popup of every exercise type (figure, drill, lesson review, routine) over
Today, its states, the in-popup practice panel, and the exercise page.
Sources: src/lib/components/exercises/*, src/lib/components/player/PracticePanel.svelte,
src/routes/[dance]/exercises/[id]/+page.svelte, docs/.../2026-09-28-exercise-types-design.md.
"""
import os
import sys

KIT = '/tmp/claude-1000/-home-tilen-Projects-salsaapp-wt-app-icons/cf18291b-f44a-483d-bf97-2da9a238a117/scratchpad/gen/kit'
sys.path.insert(0, KIT)
import kit  # noqa: E402
import examples  # noqa: E402

ts, icon, esc = kit.ts, kit.icon, kit.esc


# ==========================================================================
# new building blocks (built from kit tokens only)
# ==========================================================================

def stars(t, n, size=14, color=None):
    """A read-only rating: n filled stars, spoken as "n of 5"."""
    c = color or t['accent']
    s = ''.join(icon('star', size, c, filled=True) for _ in range(n))
    return (f'<span role="img" aria-label="Rated {n} of 5" style="display: inline-flex; gap: 1px; vertical-align: -2px">{s}</span>')


def p(t, text, size=15, color=None, extra=''):
    return (f'<p style="margin: 0; padding: 0 4px; font-size: {size}px; line-height: 1.45; font-weight: 500; '
            f'color: {color or t["ink2"]}; {extra}">{text}</p>')


def link_text(t, text):
    """A URL inside notes, linkified (accent text, underlined)."""
    return f'<a href="#" style="color: {t["accent_text"]}; font-weight: 700; text-decoration: underline; text-underline-offset: 2px">{text}</a>'


def group_label(t, text):
    return f'<span style="{ts("label", t["muted"])}">{text}</span>'


def log_sheet(t, title, sub=None, content='', footer='', height=744, actions=None, scroll_hint=True):
    """The log popup: a tall bottom sheet with the exercise name, "Last time" under it, a
    "Details" link and Close in the header, a scrolling body and a PINNED footer (Log set)."""
    hid = kit.uid('log')
    acts = ''.join(actions or [])
    cl = kit.icon_button(t, 'close', 'Close', 'bare', on=t['sheet_bg'])
    sb = f'<span style="font-size: 13px; line-height: 1.35; color: {t["muted"]}">{sub}</span>' if sub else ''
    fade = (f'<div aria-hidden="true" style="position: absolute; left: 0; right: 0; bottom: 0; height: 28px; '
            f'background: linear-gradient({kit.rgba(_hex(t["sheet_bg"]), 0)}, {t["sheet_bg"]})"></div>') if scroll_hint else ''
    ft = (f'<div style="margin: 0 -16px; padding: 12px 16px 0; border-top: 1px solid {t["hairline"]}; display: flex; flex-direction: column; gap: 8px; flex: none">'
          f'{footer}</div>') if footer else ''
    return (kit.scrim(t) + f'<div role="dialog" aria-modal="true" aria-labelledby="{hid}" style="position: absolute; left: 0; right: 0; bottom: 0; height: {height}px; box-sizing: border-box; '
            f'background: {t["sheet_bg"]}; border-radius: 28px 28px 0 0; padding: 8px 16px 30px; display: flex; flex-direction: column; gap: 10px; '
            f'box-shadow: 0 -8px 30px rgba(0,0,0,0.18)">'
            f'<div aria-hidden="true" style="width: 40px; height: 5px; border-radius: 3px; background: {t["grabber"]}; margin: 0 auto 2px; flex: none"></div>'
            f'<div style="display: flex; align-items: flex-start; gap: 2px; padding-left: 4px; margin-right: -6px; flex: none">'
            f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; padding-top: 8px">'
            f'<h3 id="{hid}" style="margin: 0; {ts("headline", t["ink"])}">{title}</h3>{sb}</div>'
            f'<div style="display: flex; align-items: center">{acts}{cl}</div></div>'
            f'<div style="position: relative; flex: 1; min-height: 0; overflow: hidden; margin: 0 -16px">'
            f'<div style="padding: 4px 16px 24px; display: flex; flex-direction: column; gap: 12px">{content}</div>{fade}</div>'
            f'{ft}</div>')


def _hex(c):
    return c if c.startswith('#') else '#000000'


def details_link(t):
    """Header link to the exercise page ("Details and settings")."""
    return (f'<a href="#" aria-label="Details and settings" style="height: 44px; display: flex; align-items: center; gap: 2px; padding: 0 4px 0 10px; '
            f'color: {t["accent_text"]}; font-size: 15px; font-weight: 800; text-decoration: none">Details{kit.chevron(t).replace(t["chevron"], t["accent_text"])}</a>')


def skip_button(t):
    return (f'<button type="button" style="height: 44px; border: 0; background: none; padding: 0 10px; display: flex; align-items: center; gap: 2px; '
            f'color: {t["accent_text"]}; font-size: 15px; font-weight: 800; cursor: pointer">Skip{icon("chevron-right", 18, t["accent_text"])}</button>')


def last_time(days, n=None, note=None):
    s = f'Last time: {days}'
    if n:
        s += ' · ' + '★' * n
    if note:
        s += f' · “{note}”'
    return s


def last_time_html(t, days, n=None, note=None):
    s = f'Last time: {days}'
    if n:
        s += ' · ' + stars(t, n, 13)
    if note:
        s += f' · “{note}”'
    return s


def section_head(t, text, trailing=None):
    return kit.section_label(t, text, 4, trailing)


def hide_button(t, shown=True):
    lab = 'Hide' if shown else 'Show'
    ic = 'chevron-up' if shown else 'chevron-down'
    return (f'<button type="button" aria-expanded="{"true" if shown else "false"}" style="height: 32px; border: 0; background: none; padding: 0 10px; display: flex; '
            f'align-items: center; gap: 4px; color: {t["accent_text"]}; font-size: 14px; font-weight: 800; cursor: pointer">{lab}{icon(ic, 18, t["accent_text"])}</button>')


# ---- media ---------------------------------------------------------------

def wide_thumb(t, h=176, duration=None, tone=0, label='Play'):
    th = kit.thumb(t, 358, h, duration, tone, radius=0).replace('width: 358px', 'width: 100%')
    return f'<button type="button" aria-label="{label}" style="display: block; width: 100%; padding: 0; border: 0; background: none; cursor: pointer">{th}</button>'


def speed_switch(t, sel=3):
    items = ['¼×', '½×', '¾×', '1×']
    names = ['0.25×', '0.5×', '0.75×', '1×']
    out = ''
    for i, it in enumerate(items):
        on = i == sel
        bg = t['surface'] if on else 'transparent'
        sh = 'box-shadow: 0 1px 3px rgba(0,0,0,0.14);' if on else ''
        out += (f'<button type="button" aria-label="Speed {names[i]}" aria-pressed="{"true" if on else "false"}" style="width: 40px; height: 44px; border: 0; background: none; padding: 0; '
                f'display: flex; align-items: center; justify-content: center; cursor: pointer">'
                f'<span style="width: 36px; height: 30px; border-radius: 15px; background: {bg}; {sh} display: flex; align-items: center; justify-content: center; '
                f'font-size: 13px; font-weight: {800 if on else 700}; color: {t["ink"] if on else t["ink2"]}">{it}</span></button>')
    return (f'<div role="group" aria-label="Speed" style="height: 36px; border-radius: 18px; background: {t["chip"]}; display: flex; align-items: center; padding: 0 1px">{out}</div>')


def mirror_toggle(t, on=False):
    if on:
        return (f'<button type="button" aria-label="Mirror" aria-pressed="true" style="width: 44px; height: 44px; border: 0; border-radius: 22px; background: {t["accent_soft"]}; '
                f'display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0">{icon("mirror", 22, t["accent_text"])}</button>')
    return (f'<button type="button" aria-label="Mirror" aria-pressed="false" style="width: 44px; height: 44px; border: 0; border-radius: 22px; background: none; '
            f'display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0">{icon("mirror", 22, t["muted"])}</button>')


def video_frame(t, title, meta, duration='0:48', tone=0, mirror=False, speed=3, h=176):
    """A recording or lesson video (VideoFrame): picture, then Mirror · speed · Full screen."""
    return (f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">'
            f'{wide_thumb(t, h, duration, tone, "Play " + title)}'
            f'<div style="display: flex; align-items: center; gap: 4px; padding: 6px 6px 6px 14px">'
            f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px">'
            f'<span style="font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{title}</span>'
            f'<span style="font-size: 12px; color: {t["muted"]}">{meta}</span></div>'
            f'{kit.icon_button(t, "expand", "Full screen", "bare", color=t["muted"], icon_size=22, on=t["surface"])}</div>'
            f'<div style="display: flex; align-items: center; gap: 8px; padding: 0 12px 10px 8px; margin-top: -4px">'
            f'{mirror_toggle(t, mirror)}<span style="font-size: 13px; font-weight: 700; color: {t["muted"]}">Mirror</span>'
            f'<span style="flex: 1"></span>{speed_switch(t, speed)}</div></div>')


def yt_card(t, title, meta='youtube.com', tone=1, mirror=False, h=168, foot=None):
    """A YouTube link: a thumbnail that becomes the embed on tap, Mirror, Open on YouTube."""
    ft = (f'<div style="border-top: 1px solid {t["hairline"]}; padding: 0 6px 0 4px; display: flex; align-items: center; gap: 4px; min-height: 52px">{foot}</div>') if foot else ''
    return (f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">'
            f'{wide_thumb(t, h, None, tone, "Play " + title)}'
            f'<div style="display: flex; align-items: center; gap: 4px; padding: 8px 6px 8px 14px">'
            f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px">'
            f'<span style="font-size: 15px; font-weight: 700; line-height: 1.3">{title}</span>'
            f'<span style="display: flex; align-items: center; gap: 5px; font-size: 12px; color: {t["muted"]}">{icon("youtube", 15, t["muted"])}{meta}</span></div>'
            f'{mirror_toggle(t, mirror)}'
            f'<a href="#" aria-label="Open on YouTube" style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center">{icon("external", 22, t["muted"])}</a>'
            f'</div>{ft}</div>')


def web_link(t, title, host, last=True, remove=False):
    if remove:
        return kit.row(t, title, host, trailing=remove_button(t, title), leading=_lead(t, 'link'), last=last)
    return kit.row(t, title, host, trailing=icon('external', 20, t['chevron']), leading=_lead(t, 'link'), href='#', last=last)


def _lead(t, name, filled_bg=None):
    if filled_bg:
        return (f'<span style="width: 40px; height: 40px; border-radius: 20px; background: {t["accent"]}; display: flex; align-items: center; justify-content: center">'
                f'{icon(name, 18, t["on_accent"], filled=name in kit.FILLED, bg=t["accent"], style="margin-left: 2px" if name == "play" else "")}</span>')
    return (f'<span style="width: 40px; height: 40px; border-radius: 12px; background: {t["accent_soft"]}; display: flex; align-items: center; justify-content: center">'
            f'{icon(name, 20, t["accent_text"])}</span>')


def remove_button(t, what):
    return kit.icon_button(t, 'trash', f'Remove {what}', 'bare', color=t['muted'], icon_size=20, on=t['surface'])


def section_card(t, label, frm, span, unlink=False, last=True):
    """A linked section of a video: tap plays it looping, full screen."""
    tr = kit.icon_button(t, 'close', 'Unlink this section', 'bare', color=t['muted'], icon_size=20, on=t['surface']) if unlink else None
    if unlink:
        return kit.row(t, label, f'{frm} · {span}', trailing=tr, leading=_lead(t, 'play', True), last=last)
    return kit.row(t, label, f'{frm} · {span}', trailing=icon('repeat', 20, t['chevron']), leading=_lead(t, 'play', True), href='#', last=last)


# ---- practice panel -------------------------------------------------------

def panel_card(t, inner, gap=12):
    return (f'<section aria-label="Practice" style="background: {t["surface"]}; border-radius: 18px; padding: 12px 12px 14px 16px; '
            f'display: flex; flex-direction: column; gap: {gap}px; flex: none">{inner}</section>')


def panel_head(t, summary, expanded=False, play_state='default'):
    chev = icon('chevron-up' if expanded else 'chevron-down', 20, t['muted'])
    play = kit.icon_button(t, 'play', 'Play', 'filled', play_state, size=52, icon_size=24, filled=True, on=t['surface'])
    return (f'<div style="display: flex; align-items: center; gap: 10px">'
            f'<button type="button" aria-expanded="{"true" if expanded else "false"}" style="flex: 1; min-width: 0; min-height: 48px; border: 0; background: none; padding: 0; '
            f'text-align: left; display: flex; align-items: center; gap: 8px; cursor: pointer; color: {t["ink"]}">'
            f'<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px">'
            f'<span style="{ts("label", t["muted"])}">Practise with</span>'
            f'<span style="font-size: 15px; font-weight: 700; line-height: 1.3">{summary}</span></span>{chev}</button>{play}</div>')


def banked(t, text):
    return (f'<div style="display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 12px; background: {t["done_soft"]}; '
            f'font-size: 13px; font-weight: 700; color: {t["done"]}">{icon("clock", 18, t["done"])}{text}</div>')


def chip_group(t, label, items, sel):
    return (f'<div style="display: flex; flex-direction: column; gap: 4px">{group_label(t, label)}'
            f'{kit.chips(t, items, sel, label=label, scroll=False).replace("gap: 8px", "gap: 6px")}</div>')


def song_progress(t, pct, now, total):
    return (f'<div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: {t["muted"]}; font-variant-numeric: tabular-nums">'
            f'<span style="width: 34px; text-align: right">{now}</span>'
            f'<div role="slider" tabindex="0" aria-label="Song position" aria-valuemin="0" aria-valuemax="291" aria-valuenow="{int(291 * pct / 100)}" aria-valuetext="{now}" '
            f'style="flex: 1; height: 44px; position: relative">'
            f'<div style="position: absolute; left: 0; right: 0; top: 19px; height: 6px; border-radius: 3px; background: {t["hairline"]}">'
            f'<div style="width: {pct}%; height: 6px; border-radius: 3px; background: {t["accent"]}"></div></div>'
            f'<div style="position: absolute; top: 14px; left: calc({pct}% - 8px); width: 16px; height: 16px; border-radius: 8px; background: {t["accent"]}; '
            f'box-shadow: 0 1px 3px rgba(0,0,0,0.3)"></div></div>'
            f'<span style="width: 34px">{total}</span></div>')


COUNTS_SALSA = ['1 2 3 · 5 6 7', '2 3 4 · 6 7 8', '1–8', '1 3 5 7', '1 · 5', '1', 'Off']
COUNTS_BACHATA = ['1 2 3 · 5 6 7', '1–8', '1 3 5 7', '1 · 5', '1', 'Off']


def panel_settings(t, source='count', bpm=180, count=0, clave=2, cue=1, song=None, speed=1, salsa=True, song_state='filled', song_error=None):
    seg = kit.segmented(t, ['Count only', 'A song'], 0 if source == 'count' else 1, on_band=False, label='Source')
    out = f'<div style="display: flex; flex-direction: column; gap: 4px">{group_label(t, "Source")}{seg}</div>'
    if source == 'count':
        out += f'<div style="padding: 2px 0">{kit.stepper(t, bpm, "Tempo", "BPM", bg=t["field"])}</div>'
    else:
        out += kit.select_field(t, 'Song', song or '', 'Choose a song', song_state if song else 'empty', bg=t['field'],
                                error=song_error)
        out += chip_group(t, 'Speed', ['1×', '0.9×', '0.8×', '0.7×'], speed)
    out += chip_group(t, 'Voice count', COUNTS_SALSA if salsa else COUNTS_BACHATA, count)
    if salsa:
        out += chip_group(t, 'Clave', ['Off', '3-2', '2-3'], clave)
    if cue is not None:
        out += chip_group(t, 'Call it on cue', ['Off', 'Every 2', 'Every 4'], cue)
    return f'<div style="border-top: 1px solid {t["hairline"]}; padding-top: 12px; display: flex; flex-direction: column; gap: 12px">{out}</div>'


def big_count(t, n):
    col = t['accent'] if n == 1 else (t['ink'] if n == 5 else t['ink2'])
    dots = ''
    for i in range(1, 9):
        if i == n:
            c = t['accent'] if i == 1 else t['ink']
        else:
            c = t['hairline'] if i in (4, 8) else t['field_line']
        dots += f'<span style="width: 12px; height: 12px; border-radius: 6px; background: {c}"></span>'
    return (f'<div style="display: flex; flex-direction: column; align-items: center; gap: 10px; padding-top: 4px">'
            f'<span aria-live="off" style="{kit.BRIC}; font-size: 92px; line-height: 0.95; font-weight: 800; color: {col}; font-variant-numeric: tabular-nums">{n}</span>'
            f'<div aria-hidden="true" style="display: flex; gap: 7px">{dots}</div></div>')


def panel_running(t, n, caption, song=None, paused=False, vol=80):
    out = big_count(t, n)
    out += f'<span style="text-align: center; font-size: 13px; font-weight: 700; color: {t["muted"]}; font-variant-numeric: tabular-nums">{caption}</span>'
    if song:
        out += song_progress(t, *song)
    pause = kit.button(t, 'Resume' if paused else 'Pause', 'secondary', icon_name='play' if paused else 'pause', full=True, on=t['surface'])
    stop = kit.button(t, 'Stop', 'primary', icon_name='stop', full=True, on=t['surface'])
    out += f'<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">{pause}{stop}</div>'
    out += (f'<div style="display: flex; flex-direction: column; gap: 2px">{group_label(t, "Voice volume")}'
            f'{kit.slider(t, vol, "Voice volume", "volume", framed=False)}</div>')
    return panel_card(t, out, gap=10)


# ---- the log form ----------------------------------------------------------

def rating(t, question, value=None, state=None):
    btns = ''
    for i in range(1, 6):
        on = value is not None and i <= value
        sh = ''
        if state == ('focused', i):
            sh = f'box-shadow: {kit.ring(t)};'
        bg = t['accent_soft'] if on else t['surface']
        btns += (f'<button type="button" aria-label="{i} of 5" aria-pressed="{"true" if value == i else "false"}" style="flex: 1; height: 52px; border: 0; border-radius: 14px; '
                 f'background: {bg}; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; {sh}">'
                 f'{icon("star", 26, t["accent"] if on else t["chevron"], filled=on)}</button>')
    hint = (f'<span style="font-size: 12px; font-weight: 700; color: {t["muted"]}; padding-left: 4px">{value} of 5 · tap it again to clear</span>'
            if value else '')
    return (f'<fieldset style="margin: 0; border: 0; padding: 0; min-width: 0; display: flex; flex-direction: column; gap: 6px; flex: none">'
            f'<legend style="{ts("label", t["ink2"])}; padding: 0 0 6px 4px">{question}</legend>'
            f'<div style="display: flex; gap: 6px">{btns}</div>{hint}</fieldset>')


def minutes_field(t, value='', state='empty', helper=None, error=None):
    return kit.text_field(t, 'Minutes', value, '0', state, helper=helper, error=error, suffix='min', input_type='number', inputmode='numeric')


def reps_field(t, value='', state='empty'):
    return kit.text_field(t, 'Reps', value, '0', state, input_type='number', inputmode='numeric')


def two(a, b):
    return f'<div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; align-items: start">{a}{b}</div>'


def note_field(t, value='', state='empty', rows=2):
    return kit.textarea(t, 'Note', value, 'What went well, what to fix', state, rows=rows, optional=True)


def log_button(t, state='default', label='Log set'):
    if state == 'logged':
        return (f'<button type="button" style="width: 100%; height: 52px; border: 0; border-radius: 26px; background: {t["done_soft"]}; color: {t["done"]}; '
                f'font-size: 16px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer">'
                f'{icon("check", 22, t["done"], stroke=2.5)}Logged</button>')
    if state == 'loading':
        return kit.button(t, 'Saving…', 'primary', 'loading', full=True, on=t['sheet_bg'])
    b = kit.button(t, label, 'primary', state, icon_name='check' if state == 'default' else None, full=True, on=t['sheet_bg'])
    if state == 'disabled':
        b += f'<span style="text-align: center; font-size: 13px; font-weight: 700; color: {t["muted"]}">Stop the count to log it.</span>'
    return b


def sets_list(t, label, sets, delete=True):
    rows = []
    for time, summary, note in sets:
        meta = f'{time}' + (f' · {note}' if note else '')
        tr = kit.icon_button(t, 'trash', f'Delete set logged at {time}', 'bare', color=t['muted'], icon_size=20, on=t['surface']) if delete else None
        rows.append(dict(title=summary, meta=meta, trailing=tr, min_h=60))
    return section_head(t, label) + kit.list_group(t, rows)


def set_summary(t, mins=None, reps=None, n=None):
    parts = []
    if mins is not None:
        parts.append(f'{mins} min')
    if reps is not None:
        parts.append(f'{reps} reps')
    s = ' · '.join(parts)
    if n:
        s += (' · ' if s else '') + stars(t, n, 14)
    return s or 'Set'


# ==========================================================================
# content blocks per type
# ==========================================================================

FIG = 'Enchufla · Doble'
FIG_NOTES = 'Lead the double from the hip, not the arm. Prep on 3, turn on 5–6 — keep the hand loose over her head.'


def figure_reference(t, shown=True, short=False):
    out = section_head(t, 'Reference', hide_button(t, shown))
    if not shown:
        return out
    out += p(t, FIG_NOTES)
    out += video_frame(t, 'Recording · 26 Oct', 'Filmed after class', '0:48', 0, h=150 if short else 176)
    if not short:
        out += kit.list_group(t, [section_card(t, 'The double prep', 'Thursday class · 22 Oct', '1:12–1:31')])
        out += yt_card(t, 'Enchufla doble — slow breakdown', 'youtube.com · from 1:30', 2)
    return out


def today_under(t, overlay):
    return examples.today(t, overlay)


def drill_content(t, short=False, salsa=True):
    if salsa:
        out = p(t, 'Clap the clave over the count, then switch to son on the next eight without stopping. '
                   'Ten rounds, eyes closed for the last three.')
        out += yt_card(t, 'Son clave vs rumba clave', 'youtube.com', 3, h=150)
        if not short:
            out += kit.list_group(t, [web_link(t, 'Clave patterns explained', 'salsaclave.com')])
    else:
        out = p(t, 'Basic in place, the hip lands on 4 and 8. Then side basic, then turning — keep the knees soft.')
        out += kit.list_group(t, [section_card(t, 'Hip on 4', 'Recording · Body wave', '0:08–0:20')])
    return out


# ==========================================================================
# screens: the log popup
# ==========================================================================

def figure_default(t):
    """1. Figure practice popup as it opens: reference open, panel folded."""
    c = figure_reference(t)
    c += panel_card(t, panel_head(t, 'Count 180 · 1 2 3 · 5 6 7 · clave 2-3 · call every 4'))
    sheet = log_sheet(t, FIG, last_time_html(t, '3 days ago', 3, 'lost the count at the break'), c, log_button(t), actions=[details_link(t)])
    return today_under(t, sheet)


def figure_filled(t):
    """2. After a run: minutes filled from the panel, rating chosen, the note focused."""
    c = section_head(t, 'Reference', hide_button(t, False))
    c += panel_card(t, panel_head(t, 'Count 180 · 1 2 3 · 5 6 7 · clave 2-3 · call every 4')
                    + banked(t, '6:12 practised — Play carries on'))
    c += minutes_field(t, '6', 'filled', helper='From the practice: 6:12')
    c += rating(t, 'How did it go?', 4)
    c += note_field(t, 'Turn felt late on 6 — prep earlier', 'focused')
    sheet = log_sheet(t, FIG, last_time_html(t, '3 days ago', 3, 'lost the count at the break'), c, log_button(t), actions=[details_link(t)])
    return today_under(t, sheet)


def figure_expanded(t):
    """3. Practice panel opened: source, tempo, count, clave, call on cue."""
    c = section_head(t, 'Reference', hide_button(t, False))
    c += panel_card(t, panel_head(t, 'Count 180 · 1 2 3 · 5 6 7 · clave 2-3 · call every 4', True) + panel_settings(t, cue=2))
    sheet = log_sheet(t, FIG, last_time_html(t, '3 days ago', 3, 'lost the count at the break'), c, log_button(t), actions=[details_link(t)], height=800)
    return today_under(t, sheet)


def figure_running(t):
    """4. Running: the big count, elapsed time, Pause/Stop, voice volume; Log set waits."""
    c = section_head(t, 'Reference', hide_button(t, False))
    c += panel_running(t, 1, '2:47 · Count 180 · 1 2 3 · 5 6 7 · clave 2-3 · call every 4')
    c += minutes_field(t)
    sheet = log_sheet(t, FIG, last_time_html(t, '3 days ago', 3, 'lost the count at the break'), c, log_button(t, 'disabled'), actions=[details_link(t)])
    return today_under(t, sheet)


def drill_default(t):
    """5. Drill popup: description, links, panel (song), Minutes + Reps."""
    c = drill_content(t, short=True)
    c += panel_card(t, panel_head(t, 'Valió la pena 0.9× · 1 2 3 · 5 6 7 · clave 2-3'))
    c += two(minutes_field(t), reps_field(t))
    c += rating(t, 'How did it go?')
    sheet = log_sheet(t, 'Clave clapping · 2-3', last_time_html(t, 'Yesterday', 4), c, log_button(t), actions=[details_link(t)])
    return today_under(t, sheet)


def drill_song_running(t):
    """6. Bachata drill playing to a song (no clave in bachata): progress bar you can drag."""
    c = drill_content(t, salsa=False)
    c += panel_running(t, 5, '4:05 · Obsesión 0.8× · 1 2 3 · 5 6 7', song=(38, '1:52', '4:51'))
    sheet = log_sheet(t, 'Hip motion · Basic', last_time_html(t, '5 days ago', 2, 'hips late at 0.9×'), c, log_button(t, 'disabled'), actions=[details_link(t)])
    return today_under(t, sheet)


def song_gone(t):
    """7. Its remembered song is no longer ready: the panel opens expanded with a warning."""
    c = p(t, 'Clap the clave over the count, then switch to son on the next eight without stopping.')
    c += panel_card(t, panel_head(t, 'Count 180 · 1 2 3 · 5 6 7 · clave 2-3', True, 'disabled')
                    + kit.banner(t, 'warning', 'Its song is not ready', 'Pick another, or use the count.')
                    + panel_settings(t, source='song', song=None, speed=1, cue=None))
    sheet = log_sheet(t, 'Clave clapping · 2-3', last_time_html(t, 'Yesterday', 4), c, log_button(t), actions=[details_link(t)])
    return today_under(t, sheet)


def lesson_review(t):
    """8. Lesson review: the lesson, its notes (links clickable), links, videos, figures; no panel."""
    c = (f'<a href="#" style="display: flex; align-items: center; gap: 12px; padding: 10px 14px 10px 12px; border-radius: 16px; background: {t["surface"]}; '
         f'text-decoration: none; color: {t["ink"]}; flex: none">{_lead(t, "lessons")}'
         f'<span style="flex: 1; display: flex; flex-direction: column; gap: 1px"><span style="font-size: 16px; font-weight: 700">Thursday class</span>'
         f'<span style="font-size: 13px; color: {t["muted"]}">Thursday, 22 October · 2 videos</span></span>{kit.chevron(t)}</a>')
    c += p(t, f'Shines first, then the setenta with the hair comb. Recap from the teacher: {link_text(t, "youtu.be/x7Qe2…")}')
    figs = ''.join(f'<a href="#" style="height: 36px; padding: 0 14px; border-radius: 18px; background: {t["chip"]}; color: {t["chip_ink"]}; font-size: 14px; '
                   f'font-weight: 600; display: inline-flex; align-items: center; gap: 4px; text-decoration: none; margin: 4px 0">{f}{icon("chevron-right", 16, t["muted"])}</a>'
                   for f in ['Setenta', 'Sombrero · Basic', 'Enchufla · Doble'])
    c += section_head(t, 'Figures') + f'<div style="display: flex; flex-wrap: wrap; gap: 0 8px; margin-top: -6px">{figs}</div>'
    c += yt_card(t, 'Setenta recap — Thursday class', 'youtube.com', 1, h=96)
    c += video_frame(t, 'Video 1', '3:24 · 4 sections', '3:24', 2, h=96)
    c += minutes_field(t, '15', 'filled')
    c += rating(t, 'How well do you remember it?', 3)
    sheet = log_sheet(t, 'Thursday class · 22 Oct', last_time_html(t, '6 days ago', 2), c, log_button(t), actions=[details_link(t)])
    return today_under(t, sheet)


def routine_popup(t):
    """9. Routine: its slots, Practise in player, and the form for a run away from the app."""
    slots = [('Basic · Side', None), ('Cuddle turn', None), ('Hammerlock / Shadow position', 'either — whichever she offers'),
             ('Media luna', 'slow it down'), ('Body wave', None)]
    rows = []
    for i, (name, note) in enumerate(slots, 1):
        lead = (f'<span style="width: 28px; height: 28px; border-radius: 14px; background: {t["chip"]}; color: {t["ink2"]}; font-size: 13px; font-weight: 800; '
                f'display: flex; align-items: center; justify-content: center; font-variant-numeric: tabular-nums">{i}</span>')
        rows.append(dict(title=name, meta=note, leading=lead, min_h=52))
    c = p(t, 'The Friday social opener. Loops back to the basic.')
    c += f'<ol style="margin: 0; padding: 0; list-style: none">{kit.list_group(t, rows)}</ol>'
    c += kit.button(t, 'Practise in player', 'secondary', icon_name='play', full=True, on=t['sheet_bg'])
    c += f'<span style="font-size: 13px; color: {t["muted"]}; padding: 0 4px; margin-top: -4px">A run there saves itself. Log here when you practised away from the app.</span>'
    c += minutes_field(t)
    c += rating(t, 'How did it go?')
    sheet = log_sheet(t, 'Friday combo', last_time_html(t, 'Yesterday', 4, 'clean until the media luna'), c, log_button(t), actions=[details_link(t)])
    return today_under(t, sheet)


def loading(t):
    """10. Content is one request after opening: the form is usable while it loads."""
    sk = (f'<div aria-hidden="true" style="height: 150px; border-radius: 16px; background: {t["skeleton"]}; flex: none"></div>')
    bar = lambda w, h=12: f'<span aria-hidden="true" style="display: block; width: {w}%; height: {h}px; border-radius: 6px; background: {t["skeleton"]}"></span>'
    c = (f'<div aria-busy="true" style="display: flex; flex-direction: column; gap: 10px; padding: 4px 4px 0"><span role="status" style="{kit.SR}">Loading</span>'
         f'{bar(92)}{bar(80)}{bar(56)}</div>') + sk + kit.skeleton_rows(t, 1, leading=True)
    c += minutes_field(t)
    c += rating(t, 'How did it go?')
    sheet = log_sheet(t, FIG, f'<span style="display: inline-block; width: 190px; height: 10px; border-radius: 5px; background: {t["skeleton"]}"></span>',
                      c, log_button(t), actions=[details_link(t)])
    return today_under(t, sheet)


def saving(t):
    """11. Saving: the button spins, the form waits."""
    c = section_head(t, 'Reference', hide_button(t, False))
    c += panel_card(t, panel_head(t, 'Count 180 · 1 2 3 · 5 6 7 · clave 2-3 · call every 4') + banked(t, '6:12 practised — Play carries on'))
    c += minutes_field(t, '6', 'filled', helper='From the practice: 6:12')
    c += rating(t, 'How did it go?', 4)
    c += note_field(t, 'Turn felt late on 6 — prep earlier', 'filled')
    sheet = log_sheet(t, FIG, last_time_html(t, '3 days ago', 3, 'lost the count at the break'), c, log_button(t, 'loading'), actions=[details_link(t)])
    return today_under(t, sheet)


def logged(t):
    """12. Logged: the button says so for a moment, the form is empty again, the set is listed."""
    c = section_head(t, 'Reference', hide_button(t, False))
    c += panel_card(t, panel_head(t, 'Count 180 · 1 2 3 · 5 6 7 · clave 2-3 · call every 4'))
    c += minutes_field(t)
    c += rating(t, 'How did it go?')
    c += sets_list(t, 'Sets today', [('19:42', set_summary(t, 6, None, 4), 'Turn felt late on 6 — prep earlier'),
                                     ('08:15', set_summary(t, 10, None, 3), None)])
    sheet = log_sheet(t, FIG, last_time_html(t, 'Today', 4, 'Turn felt late on 6 — prep earlier'), c, log_button(t, 'logged'), actions=[details_link(t)])
    return today_under(t, sheet)


def error_state(t):
    """13. The content failed to load, and the last log was refused."""
    c = kit.banner(t, 'error', 'Could not load this exercise’s details.', 'You can still log a set.')
    c += two(minutes_field(t, '700', 'error', error='0–600'), reps_field(t, '40', 'filled'))
    c += rating(t, 'How did it go?', 3)
    c += note_field(t)
    c += kit.banner(t, 'error', 'Check the values and try again.')
    sheet = log_sheet(t, 'Clave clapping · 2-3', None, c, log_button(t), actions=[details_link(t)])
    return today_under(t, sheet)


def backfill(t):
    """14. Back-filling a past day: the same popup, no practice panel, "Add set to this day"."""
    c = (f'<div style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 14px; background: {t["accent_soft"]}; '
         f'color: {t["accent_text"]}; font-size: 14px; font-weight: 800">{icon("calendar", 20, t["accent_text"])}Adding to Wednesday, 28 October</div>')
    c += figure_reference(t, True, short=True)
    c += minutes_field(t, '20', 'filled')
    c += rating(t, 'How did it go?', 3)
    c += sets_list(t, 'Sets that day', [('18:30', set_summary(t, 12, None, 2), 'class warm-up')])
    sheet = log_sheet(t, FIG, last_time_html(t, '3 days ago', 3, 'lost the count at the break'), c, log_button(t, label='Add set to this day'),
                      actions=[details_link(t)])
    return today_under(t, sheet)


def session_next(t):
    """15. In a session: Skip in the header; after a log, Next names the following exercise."""
    c = section_head(t, 'Reference', hide_button(t, False))
    c += panel_card(t, panel_head(t, 'Count 180 · 1 2 3 · 5 6 7 · clave 2-3 · call every 4'))
    c += minutes_field(t)
    c += rating(t, 'How did it go?')
    c += sets_list(t, 'Sets today', [('19:42', set_summary(t, 6, None, 4), None)])
    nxt = kit.button(t, f'Next: Count drill · 3-2 clave{icon("chevron-right", 20, t["accent_text"])}', 'secondary', full=True, on=t['sheet_bg'])
    sheet = log_sheet(t, FIG, last_time_html(t, 'Today', 4), c, log_button(t, 'logged') + nxt, actions=[details_link(t)])
    return today_under(t, sheet)


def session_done(t):
    """16. The last one logged: the session's tally and Finish."""
    c = drill_content(t, short=True)
    c += panel_card(t, panel_head(t, 'Valió la pena 0.9× · 1 2 3 · 5 6 7 · clave 2-3'))
    c += two(minutes_field(t), reps_field(t))
    done = (f'<div role="status" style="display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 16px; background: {t["done_soft"]}">'
            f'{kit.done_check(t, 28)}<span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 15px; font-weight: 800; color: {t["ink"]}">Session done</span>'
            f'<span style="font-size: 13px; font-weight: 700; color: {t["done"]}">3 exercises, 24 min</span></span></div>')
    sheet = log_sheet(t, 'Clave clapping · 2-3', last_time_html(t, 'Today', 4), c,
                      done + kit.button(t, 'Finish', 'primary', full=True, on=t['sheet_bg']), actions=[details_link(t)])
    return today_under(t, sheet)


def _unsaved(t, blocked):
    c = section_head(t, 'Reference', hide_button(t, False))
    if blocked:
        c += panel_running(t, 3, '4:20 · Count 180 · 1 2 3 · 5 6 7 · clave 2-3 · call every 4')
    else:
        c += panel_card(t, panel_head(t, 'Count 180 · 1 2 3 · 5 6 7 · clave 2-3 · call every 4') + banked(t, '6:12 practised — Play carries on'))
        c += minutes_field(t, '6', 'filled', helper='From the practice: 6:12')
        c += rating(t, 'How did it go?', 4)
    sheet = log_sheet(t, FIG, last_time_html(t, '3 days ago', 3, 'lost the count at the break'), c,
                      log_button(t, 'disabled' if blocked else 'default'), actions=[details_link(t)])
    on = t['raised']
    acts = [kit.button(t, 'Save', 'primary', 'disabled' if blocked else 'default', full=True, on=on),
            kit.button(t, 'Stay', 'secondary', full=True, on=on),
            kit.button(t, 'Close without saving', 'danger_text', full=True, on=on)]
    body = 'Practice log is not saved yet.'
    if blocked:
        body += f'</p><p style="margin: 0; font-size: 14px; font-weight: 700; color: {t["muted"]}">Stop the count to log it.'
    dlg = kit.dialog(t, 'Unsaved changes', body, acts, 'warning', 'warn')
    return today_under(t, sheet + dlg)


def unsaved(t):
    """17. Close (✕, backdrop, Escape, Back) with practice time banked: the app's one question."""
    return _unsaved(t, False)


def unsaved_blocked(t):
    """18. Close while the count plays: Save waits for Stop."""
    return _unsaved(t, True)


# ==========================================================================
# screens: the exercise page
# ==========================================================================

def pinned_log(t):
    return (f'<div style="position: absolute; left: 0; right: 0; bottom: 0; padding: 12px 16px 30px; background: {t["ground"]}; '
            f'border-top: 1px solid {t["hairline"]}">{kit.button(t, "Log a set", "primary", icon_name="plus", size="md", full=True)}</div>')


def page_header(t, title, typ):
    return kit.band_header(t, title, typ, left=kit.band_button(t, 'back', 'Back to Today'), tall=False)


def owner_row(t, label, kind, icon_name):
    return kit.list_group(t, [dict(title=label, meta=kind, leading=_lead(t, icon_name), trailing=kit.chevron(t), href='#', min_h=60)])


def history_summary(t, sets, time, recent):
    def stat(v, lab):
        return (f'<div style="flex: 1; display: flex; flex-direction: column; gap: 2px; padding: 12px 14px">'
                f'<span style="{kit.BRIC}; font-size: 24px; font-weight: 800; line-height: 1.05; color: {t["ink"]}">{v}</span>'
                f'<span style="font-size: 12px; font-weight: 700; color: {t["muted"]}">{lab}</span></div>')
    sep = f'<span aria-hidden="true" style="width: 1px; background: {t["hairline"]}; margin: 12px 0"></span>'
    return (f'<div style="background: {t["surface"]}; border-radius: 16px; display: flex; flex: none">'
            f'{stat(sets, "sets")}{sep}{stat(time, "practised")}{sep}{stat(recent, "recent rating")}</div>')


def exercise_page_top(t):
    """19. Exercise page (figure): owner, the reference, history begins; Log a set pinned."""
    body = owner_row(t, 'Enchufla · Doble', 'Figure', 'footprints')
    body += f'<div style="height: 2px"></div>' + section_head(t, 'Reference')
    body += p(t, FIG_NOTES)
    body += video_frame(t, 'Recording · 26 Oct', 'Filmed after class', '0:48', 0, h=150)
    body += kit.list_group(t, [section_card(t, 'The double prep', 'Thursday class · 22 Oct', '1:12–1:31')])
    body += (f'<a href="#" style="display: flex; align-items: center; gap: 6px; padding: 4px 4px 0; font-size: 14px; font-weight: 800; color: {t["accent_text"]}; '
             f'text-decoration: none">Edit links on the figure page{icon("chevron-right", 18, t["accent_text"])}</a>')
    body += section_head(t, 'History') + history_summary(t, '23', '4 h 10', '3.8 ★')
    return kit.page(t, page_header(t, 'Enchufla · Doble', 'Figure practice'), body, footer=pinned_log(t))


def exercise_page_history(t):
    """20. Exercise page scrolled: history by day with delete, then settings."""
    body = history_summary(t, '23', '4 h 10', '3.8 ★')
    body += sets_list(t, 'Today', [('19:42', set_summary(t, 6, None, 4), 'Turn felt late on 6 — prep earlier')])
    body += sets_list(t, 'Tuesday, 27 October', [('20:05', set_summary(t, 12, None, 3), 'lost the count at the break'),
                                                  ('07:50', set_summary(t, 8, 20, None), None)])
    hid = kit.uid('act')
    settings = kit.select_field(t, 'How often', 'Every 3 days', bg=t['field'])
    settings += (f'<div style="display: flex; align-items: center; gap: 12px; min-height: 52px">'
                 f'<span id="{hid}" style="flex: 1; display: flex; flex-direction: column; gap: 1px"><span style="font-size: 16px; font-weight: 700">Active</span>'
                 f'<span style="font-size: 13px; color: {t["muted"]}">Show it in the to-do list</span></span>'
                 f'{kit.switch(t, True, label="Active")}</div>')
    settings += kit.textarea(t, 'Practice notes', 'Start at 160 BPM, then 180 once the prep is clean.', state='filled', rows=2, bg=t['field'])
    settings += kit.button(t, 'Save settings', 'secondary', full=True, on=t['surface'])
    body += section_head(t, 'Settings') + kit.card(t, settings, gap=14)
    return kit.page(t, page_header(t, 'Enchufla · Doble', 'Figure practice'), body, pad='20px 16px 0', footer=pinned_log(t))


def drill_page_links(t):
    """21. Drill page: its own links and sections, editable here; a bad line refused."""
    body = section_head(t, 'Sections')
    body += kit.list_group(t, [section_card(t, 'Clave on its own', 'Thursday class · 22 Oct', '0:20–0:44', unlink=True)])
    body += (f'<button type="button" aria-haspopup="dialog" style="height: 48px; border: 0; border-radius: 16px; background: {t["surface"]}; display: flex; align-items: center; '
             f'gap: 10px; padding: 0 14px; color: {t["accent_text"]}; font-size: 15px; font-weight: 800; cursor: pointer; flex: none">{icon("link", 20, t["accent_text"])}Link a section…</button>')
    body += section_head(t, 'Links')
    foot = (f'<span style="flex: 1"></span>{kit.button(t, "Remove", "danger_text", icon_name="trash", size="sm", on=t["surface"])}')
    body += yt_card(t, 'Son clave vs rumba clave', 'youtube.com', 3, h=110, foot=foot)
    body += kit.list_group(t, [web_link(t, 'Clave patterns explained', 'salsaclave.com', remove=True)])
    body += kit.textarea(t, 'Add links', 'https://youtu.be/9bZkp7q19f0\nwww salsa clave', 'Paste YouTube or other links, one per line', 'error',
                         error='Not a web link: www salsa clave', rows=2)
    body += kit.text_field(t, 'Title', '', 'For a single link', 'empty', optional=True)
    body += kit.button(t, 'Add link', 'secondary', icon_name='plus', full=True)
    return kit.page(t, page_header(t, 'Clave clapping · 2-3', 'Drill'), body, footer=pinned_log(t))


def _drill_settings_body(t):
    body = section_head(t, 'Settings')
    s = kit.text_field(t, 'Name', 'Clave clapping · 2-3', state='filled', bg=t['field'])
    s += kit.select_field(t, 'How often', 'Daily', bg=t['field'])
    hid = kit.uid('act')
    s += (f'<div style="display: flex; align-items: center; gap: 12px; min-height: 52px">'
          f'<span id="{hid}" style="flex: 1; display: flex; flex-direction: column; gap: 1px"><span style="font-size: 16px; font-weight: 700">Active</span>'
          f'<span style="font-size: 13px; color: {t["muted"]}">Show it in the to-do list</span></span>'
          f'{kit.switch(t, True, label="Active")}</div>')
    s += kit.textarea(t, 'Description', 'Clap the clave over the count, then switch to son on the next eight without stopping.', state='focused', rows=3, bg=t['field'])
    s += kit.button(t, 'Save settings', 'secondary', full=True, on=t['surface'])
    body += kit.card(t, s, gap=14)
    body += f'<div style="display: flex; justify-content: center; padding-top: 4px">{kit.button(t, "Archive exercise", "danger_text")}</div>'
    return body


def drill_page_settings(t):
    """22. Drill page, settings: name, frequency, active, description, Archive."""
    body = history_summary(t, '41', '6 h 05', '4.1 ★')
    body += _drill_settings_body(t)
    return kit.page(t, page_header(t, 'Clave clapping · 2-3', 'Drill'), body, footer=pinned_log(t))


def archive_confirm(t):
    """23. Archive asks first: the drill leaves every list, its history stays."""
    body = history_summary(t, '41', '6 h 05', '4.1 ★') + _drill_settings_body(t)
    on = t['raised']
    dlg = kit.dialog(t, 'Archive this drill?', 'Clave clapping · 2-3 leaves Today and every list. Its 41 sets are kept.',
                     [kit.button(t, 'Cancel', 'tertiary', size='sm', on=on), kit.button(t, 'Archive', 'danger', size='sm', on=on)])
    return kit.page(t, page_header(t, 'Clave clapping · 2-3', 'Drill'), body, footer=pinned_log(t), overlay=dlg)


def empty_history(t):
    """24. A new bachata drill: nothing logged, no links yet."""
    body = section_head(t, 'Description')
    body += p(t, 'Basic in place, the hip lands on 4 and 8. Then side basic, then turning.')
    body += section_head(t, 'History')
    body += kit.card(t, kit.empty_state(t, 'clock', 'Nothing logged yet', 'Log a set after you practise — it shows up here, grouped by day.'), pad='0')
    body += kit.textarea(t, 'Add links', '', 'Paste YouTube or other links, one per line', 'empty', rows=2)
    body += kit.button(t, 'Add link', 'secondary', icon_name='plus', full=True)
    return kit.page(t, page_header(t, 'Hip motion · Basic', 'Drill'), body, footer=pinned_log(t))


SCREENS = [
    ('Figure popup · as it opens', 'Over Today. Last time under the name, reference open, practice folded to one line + Play', figure_default),
    ('Figure popup · filled in', 'After a run: Minutes from the panel, rating 4 chosen, the note focused', figure_filled),
    ('Practice panel · opened', 'Source, tempo, voice count, clave, call it on cue (figure only)', figure_expanded),
    ('Practice panel · running', 'The big count (1 in accent), elapsed time, Pause / Stop, voice volume; Log set waits', figure_running),
    ('Drill popup', 'Description, links, the panel set to a song; Minutes and Reps', drill_default),
    ('Drill popup · song running', 'Bachata: no clave; the song bar can be tapped or dragged', drill_song_running, 'bachata'),
    ('Panel · song not ready', 'Its remembered song is gone: opens expanded, Play disabled until a song or the count', song_gone),
    ('Lesson review popup', 'The lesson, notes with live links, link, video, its figures; no practice panel', lesson_review),
    ('Routine popup', 'The slots in order, Practise in player, and the form for a run away from the app', routine_popup, 'bachata'),
    ('Popup · loading', 'The content is one request after opening; the form is usable meanwhile', loading),
    ('Popup · saving', 'Log set spins while the set posts', saving),
    ('Popup · logged', '"Logged" for a moment, the form cleared, the set listed under Sets today', logged),
    ('Popup · error', 'Content failed to load; the log refused a value (field error + the server message)', error_state),
    ('Popup · back-filling a day', 'From a past day on Today: no panel, "Add set to this day", Sets that day', backfill),
    ('Session · next', 'Skip sits in the header until a log; then Next names the following exercise', session_next),
    ('Session · done', 'Nothing left: the tally and Finish', session_done),
    ('Unsaved changes', 'Closing with practice time banked: Save · Stay · Close without saving', unsaved),
    ('Unsaved · count playing', 'Save waits: "Stop the count to log it."', unsaved_blocked),
    ('Exercise page · figure', 'Pushed from Today. Owner, the reference, history summary; Log a set pinned', exercise_page_top),
    ('Exercise page · history and settings', 'Sets by day with delete; How often, Active, Practice notes', exercise_page_history),
    ('Drill page · links and sections', 'A drill owns its links: remove, Link a section…, Add links with a bad line refused', drill_page_links),
    ('Drill page · settings', 'Name and Archive exist for a drill only; the description field focused', drill_page_settings),
    ('Archive · confirm', 'Asks before archiving; the history is kept', archive_confirm),
    ('Exercise page · empty history', 'A new bachata drill: nothing logged yet, no links', empty_history, 'bachata'),
]


if __name__ == '__main__':
    html, w, h = kit.artboard('Logging a set · the exercise page',
                              'Every exercise type’s log popup over Today and its states, the in-popup practice panel, and the exercise page.',
                              SCREENS, per_row=3, doc_title='Logging')
    kit.write(sys.argv[1], html)
    print(w, h)
