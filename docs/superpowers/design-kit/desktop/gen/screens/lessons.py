"""Lessons area redrawn in the C4 look: the list, a new lesson, the lesson page and its states.

python3 -I lessons.py  -> canvas/project/S-lessons.dc.html
"""
import sys

import os
S = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
sys.path.insert(0, S + '/gen/kit')
import kit  # noqa: E402

LONG = 'Rueda · enchufla variations'

# --------------------------------------------------------------------------
# local building blocks (all from kit tokens)
# --------------------------------------------------------------------------


def date_tile(t, wd, day):
    """Leading tile of a lesson row: weekday over the day number (classes are weekly)."""
    return (f'<span aria-hidden="true" style="width: 48px; height: 54px; border-radius: 12px; background: {t["accent_soft"]}; display: flex; '
            f'flex-direction: column; align-items: center; justify-content: center; gap: 3px; flex: none">'
            f'<span style="font-size: 11px; font-weight: 800; letter-spacing: 0.06em; color: {t["accent_text"]}">{wd}</span>'
            f'<span style="{kit.ts("headline", t["ink"])}">{day}</span></span>')


def counts(t, s, r, f):
    """'6 sections · 1 routine · 3 figures' — always all three; a zero is muted, not hidden."""
    out = []
    for n, one, many in ((s, 'section', 'sections'), (r, 'routine', 'routines'), (f, 'figure', 'figures')):
        w = one if n == 1 else many
        if n:
            out.append(f'<span style="color: {t["ink2"]}"><b style="font-weight: 800; color: {t["ink"]}">{n}</b> {w}</span>')
        else:
            out.append(f'<span style="color: {t["muted"]}">{n} {w}</span>')
    return f'<span style="display: flex; gap: 12px; margin-top: 5px; font-size: 13px">{"".join(out)}</span>'


def lesson_row(t, wd, day, date_sr, title, meta, c):
    m = f'<span style="display: block">{meta}</span>{counts(t, *c)}' if meta else counts(t, *c)
    return dict(title=f'<span style="{kit.SR}">{date_sr}, </span>{title}', meta=m, trailing=kit.chevron(t),
                leading=date_tile(t, wd, day), href='#', min_h=84)


def split_row(t, title, meta=None, buttons='', leading=None, last=False, href='#', min_h=64, meta_tone=None):
    """A row whose text is a link and whose right side holds its own buttons (siblings, never nested)."""
    hair = '' if last else f'border-bottom: 1px solid {t["hairline"]};'
    mc, mw = (t['status'], 700) if meta_tone == 'status' else (t['muted'], 400)
    m = f'<span style="font-size: 13px; line-height: 1.35; font-weight: {mw}; color: {mc}">{meta}</span>' if meta else ''
    ld = f'<span style="display: flex; flex: none">{leading}</span>' if leading else ''
    return (f'<div style="padding-left: 16px"><div style="display: flex; align-items: center; gap: 2px; min-height: {min_h}px; box-sizing: border-box; padding-right: 6px; {hair}">'
            f'<a href="{href}" style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; padding: 9px 0; text-decoration: none; color: {t["ink"]}">{ld}'
            f'<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px">'
            f'<span style="font-size: 16px; line-height: 1.3; font-weight: 700; display: flex; align-items: center; gap: 8px; flex-wrap: wrap">{title}</span>{m}</span></a>'
            f'{buttons}</div></div>')


def group(t, rows):
    return f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">{"".join(rows)}</div>'


def via_badge(t, n=1):
    return kit.badge(t, 'via section' if n == 1 else f'via {n} sections', 'neutral', icon_name='link')


def toggle_icon(t, name, label, on):
    b = kit.icon_button(t, name, label, 'tonal' if on else 'bare', color=None if on else t['ink2'], on=t['surface'])
    return b.replace('<button type="button"', f'<button type="button" aria-pressed="{"true" if on else "false"}"', 1)


def speed(t, sel='1×'):
    """The 0.25–1× speed switch of an inline video (aria-pressed buttons, 44px tall)."""
    out = ''
    for r in ('0.25×', '0.5×', '0.75×', '1×'):
        on = r == sel
        st = (f'background: {t["surface"]}; color: {t["ink"]}; font-weight: 800; box-shadow: 0 1px 3px rgba(0,0,0,0.14)' if on
              else f'background: none; color: {t["ink2"]}; font-weight: 700')
        out += (f'<button type="button" aria-pressed="{"true" if on else "false"}" style="height: 38px; border: 0; border-radius: 19px; {st}; '
                f'font-size: 14px; cursor: pointer; padding: 0">{r}</button>')
    return (f'<div role="group" aria-label="Speed" style="height: 44px; box-sizing: border-box; border-radius: 22px; background: {t["chip"]}; padding: 3px; '
            f'display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 2px">{out}</div>')


def section_row(t, label, rng, links, last=False):
    title = label or rng
    parts = []
    if label:
        parts.append(rng)
    if links:
        parts.append(f'<span style="color: {t["ink2"]}; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; vertical-align: -2px">'
                     f'{kit.icon("link", 14, t["ink2"])}{links}</span>')
    else:
        parts.append(f'<span style="color: {t["muted"]}">not linked</span>')
    meta = ' · '.join(parts)
    play = kit.icon_button(t, 'play', f'Play {title}', 'tonal', icon_size=20, filled=True, on=t['surface'])
    lk = kit.icon_button(t, 'link', f'Link {title}', 'bare', color=t['ink2'] if links else t['accent'], on=t['surface'])
    return kit.row(t, title, meta, lk, leading=play, last=last, min_h=62)


def video_card(t, size='740 MB', dur='12:48', tone=0, sections=(), state='ok', mirror=False, rate='1×', source=False,
               refused=None, sec_note=True):
    """A lesson video: the inline player, its controls, size + delete, then its Sections."""
    if state == 'ok':
        top = (kit.thumb(t, 358, 201, dur, tone, radius=0).replace('width: 358px', 'width: 100%')
               + f'<div style="display: flex; align-items: center; gap: 2px; padding: 8px 12px 0 6px">'
               f'{kit.icon_button(t, "expand", "Full screen", "bare", color=t["ink2"], on=t["surface"])}'
               f'{toggle_icon(t, "mirror", "Mirror", mirror)}<div style="flex: 1; margin-left: 8px">{speed(t, rate)}</div></div>')
    elif state == 'missing':
        top = (f'<div style="padding: 22px 16px 6px; display: flex; gap: 12px; align-items: flex-start">{kit.icon("warning", 22, t["muted"])}'
               f'<span style="font-size: 15px; line-height: 1.4; color: {t["ink2"]}">The file for this video is missing.</span></div>')
    else:  # unplayable
        top = (f'<div style="padding: 20px 16px 4px; display: flex; gap: 12px; align-items: flex-start">{kit.icon("video", 22, t["muted"])}'
               f'<div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 15px; line-height: 1.4; color: {t["ink2"]}">'
               f'This browser can’t play this file. Download it, or open it on your phone.</span>'
               f'<span style="margin-left: -14px">{kit.button(t, "Download it", "tertiary", icon_name="download", size="sm", on=t["surface"])}</span></div></div>')
    src = (f'<a href="#" style="display: inline-flex; align-items: center; gap: 5px; min-height: 44px; font-size: 13px; font-weight: 700; color: {t["accent_text"]}; '
           f'text-decoration: none">{kit.icon("youtube", 16, t["accent_text"])}from YouTube{kit.icon("external", 14, t["accent_text"])}</a>') if source else ''
    sz = f'<span style="font-size: 13px; color: {t["muted"]}">{size}</span>'
    left = f'<div style="display: flex; align-items: center; gap: 12px">{sz}{src}</div>'
    meta = (f'<div style="display: flex; align-items: center; justify-content: space-between; padding: 0 6px 0 16px; min-height: 48px">{left}'
            f'{kit.icon_button(t, "trash", "Delete video", "bare", color=t["danger"], on=t["surface"])}</div>')
    ref = f'<div style="padding: 0 12px 10px">{kit.banner(t, "error", "Can’t delete this video", refused)}</div>' if refused else ''
    if sections:
        rows = ''.join(section_row(t, *s, last=i == len(sections) - 1) for i, s in enumerate(sections))
        sec = (f'<div style="border-top: 1px solid {t["hairline"]}; padding-top: 12px">'
               f'<span style="display: block; padding: 0 16px 2px; {kit.ts("label", t["muted"])}">Sections · {len(sections)}</span>{rows}</div>')
    else:
        sec = (f'<div style="border-top: 1px solid {t["hairline"]}; padding: 12px 16px 16px; display: flex; flex-direction: column; gap: 4px">'
               f'<span style="{kit.ts("label", t["muted"])}">Sections</span>'
               f'<span style="font-size: 14px; line-height: 1.4; color: {t["muted"]}">None yet. Open the video full screen and tap Section to mark one.</span></div>') if sec_note else ''
    return (f'<article aria-label="Lesson video" style="background: {t["surface"]}; border-radius: 22px; overflow: hidden; flex: none">'
            f'{top}{meta}{ref}{sec}</article>')


def upload_idle(t, app=False):
    fid = kit.uid('up')
    box = (f'height: 52px; box-sizing: border-box; border-radius: 16px; border: 1.5px dashed {t["field_line"]}; display: flex; align-items: center; '
           f'justify-content: center; gap: 8px; font-size: 16px; font-weight: 800; color: {t["accent_text"]}; text-decoration: none; cursor: pointer; flex: none')
    if app:
        return (f'<div style="display: flex; flex-direction: column; gap: 6px; flex: none"><a href="#" style="{box}">{kit.icon("upload", 20, t["accent_text"])}Add videos</a>'
                f'<span style="text-align: center; font-size: 13px; color: {t["muted"]}">Compressed and uploaded in the background</span></div>')
    return (f'<label for="{fid}" style="{box}">{kit.icon("upload", 20, t["accent_text"])}Add videos'
            f'<input id="{fid}" type="file" accept="video/*" multiple style="{kit.SR}"></label>')


def upload_card(t, title, helper, pct, tone='accent', icon_name='upload'):
    soft, ink = ('accent_soft', 'accent_text') if tone == 'accent' else ('warn_soft', 'warn')
    bar = kit.progress_bar(t, pct, tone=tone).replace('<div role=', '<div aria-label="Upload" role=', 1)
    return (f'<div role="status" style="background: {t["surface"]}; border-radius: 16px; padding: 14px 16px 16px 14px; display: flex; flex-direction: column; gap: 12px; flex: none">'
            f'<div style="display: flex; align-items: center; gap: 12px"><span style="width: 40px; height: 40px; border-radius: 20px; background: {t[soft]}; display: flex; '
            f'align-items: center; justify-content: center; flex: none">{kit.icon(icon_name, 20, t[ink])}</span>'
            f'<span style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 16px; font-weight: 800">{title}</span>'
            f'<span style="font-size: 13px; color: {t["muted"]}">{helper}</span></span></div>'
            f'{bar}</div>')


def yt_card(t, title, state='link', expanded=False, error='Video unavailable', mirror=False, tone=1):
    """A YouTube link on a lesson: a thumbnail that plays the embed in place, Save video and its states, Remove."""
    if expanded:
        head = (f'<div style="position: relative">{kit.thumb(t, 358, 201, None, tone, radius=0, play=False, progress=34).replace("width: 358px", "width: 100%")}'
                f'<span style="position: absolute; left: 10px; top: 10px; height: 24px; padding: 0 9px; border-radius: 12px; background: rgba(0,0,0,0.6); color: #ffffff; '
                f'font-size: 12px; font-weight: 800; display: flex; align-items: center; gap: 5px">{kit.icon("youtube", 14, "#ffffff")}YouTube player</span></div>'
                f'<div style="display: flex; align-items: center; gap: 4px; padding: 6px 6px 0 16px"><span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px">'
                f'<span style="font-size: 16px; font-weight: 700">{title}</span><span style="font-size: 13px; color: {t["muted"]}">youtube.com</span></span>'
                f'{toggle_icon(t, "mirror", "Mirror", mirror)}{kit.icon_button(t, "external", "Open on YouTube", "bare", color=t["ink2"], on=t["surface"])}</div>')
    else:
        th = kit.thumb(t, 112, 64, None, tone)
        head = (f'<div style="display: flex; align-items: center; gap: 12px; padding: 12px 6px 0 12px">'
                f'<button type="button" aria-label="Play {title}" style="border: 0; padding: 0; background: none; cursor: pointer; flex: none; display: flex">{th}</button>'
                f'<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 16px; font-weight: 700; line-height: 1.3">{title}</span>'
                f'<span style="display: flex; align-items: center; gap: 5px; font-size: 13px; color: {t["muted"]}">{kit.icon("youtube", 16, t["muted"])}youtube.com</span></span>'
                f'{kit.icon_button(t, "external", "Open on YouTube", "bare", color=t["ink2"], on=t["surface"])}</div>')
    rm = kit.icon_button(t, 'trash', f'Remove {title}', 'bare', color=t['muted'], on=t['surface'])
    if state == 'link':
        foot = (f'<div style="display: flex; align-items: center; gap: 8px">{kit.button(t, "Save video", "secondary", icon_name="download", size="sm", on=t["surface"])}'
                f'<span style="flex: 1; font-size: 13px; color: {t["muted"]}">Keeps it at 480p</span>{rm}</div>')
    elif state == 'saving':
        foot = (f'<div role="status" style="display: flex; align-items: center; gap: 10px">{kit.spinner(t, 22)}'
                f'<span style="flex: 1; display: flex; flex-direction: column; gap: 1px"><span style="font-size: 15px; font-weight: 800">Saving at 480p</span>'
                f'<span style="font-size: 13px; color: {t["muted"]}">The home worker picks it up within a few minutes</span></span>{rm}</div>')
    else:
        foot = (f'<div style="display: flex; align-items: center; gap: 4px"><span role="alert" style="flex: 1; display: flex; align-items: flex-start; gap: 6px; font-size: 13px; '
                f'line-height: 1.35; font-weight: 700; color: {t["danger"]}">{kit.icon("warning", 16, t["danger"], style="margin-top: 1px")}Couldn’t save: {error}</span>'
                f'{kit.button(t, "Retry", "tertiary", icon_name="refresh", size="sm", on=t["surface"])}{rm}</div>')
    return (f'<div style="background: {t["surface"]}; border-radius: {22 if expanded else 16}px; overflow: hidden; display: flex; flex-direction: column; gap: 10px; '
            f'padding-bottom: 8px; flex: none">{head}<div style="padding: 0 6px 0 12px">{foot}</div></div>')


def link_row_btn(t, text):
    """The last row of a linked group: opens the shared picker."""
    return (f'<button type="button" aria-haspopup="dialog" style="width: 100%; min-height: 54px; border: 0; background: none; padding: 0 16px; display: flex; align-items: center; '
            f'gap: 12px; cursor: pointer; color: {t["accent_text"]}; font-size: 16px; font-weight: 700; text-align: left">{kit.icon("search", 20, t["accent_text"])}{text}</button>')


def new_btn(t, what):
    return kit.button(t, 'New', 'tertiary', icon_name='plus', size='sm', aria=f'New {what}')


def lesson_header(t, title=LONG, date='28 October 2026', editing=False):
    right = kit.band_button(t, 'check', 'Done') if editing else kit.band_button(t, 'edit', 'Edit lesson')
    return kit.band_header(t, title, 'Editing' if editing else date, left=kit.band_button(t, 'back', 'Back to Lessons'),
                           right=right, tall=False)


def notes_card(t, text):
    return (f'<div style="background: {t["surface"]}; border-radius: 16px; padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 6px; flex: none">'
            f'<span style="{kit.ts("label", t["muted"])}">Notes</span><p style="margin: 0; {kit.ts("body", t["ink"])}; white-space: pre-line">{text}</p></div>')


def review_group(t, every='Every 3 days', inactive=False):
    lead = (f'<span style="width: 40px; height: 40px; border-radius: 20px; background: {t["accent_soft"]}; display: flex; align-items: center; justify-content: center">'
            f'{kit.icon("repeat", 20, t["accent_text"])}</span>')
    meta = every + (' · <span style="font-weight: 700">inactive</span>' if inactive else '') + ' · review exercise'
    return group(t, [split_row(t, 'Go over this lesson', meta, kit.log_button(t, 'Go over this lesson'), leading=lead, last=True)])


SEC1 = [('Enchufla doble breakdown', '0:42.0–1:05.5', 'Enchufla · Doble'),
        (None, '2:10.4–2:31.0', 'Footwork drill'),
        ('Ending into the hook turn', '4:02.0–4:30.2', None)]
NOTES = ('Enchufla doble: keep the left hand low on 3, don’t pull. Lead the second turn with the wrist, not the arm.\n'
         f'Her breakdown: <a href="#" style="color: {{a}}; text-decoration: underline; overflow-wrap: anywhere">youtu.be/4kT9w2pQx1s</a>')


def notes(t):
    return NOTES.replace('{a}', t['accent_text'])


def lessons_list(t, overlay=''):
    header = kit.band_header(t, 'Lessons', 'Videos on disk: 3.4 GB', right=kit.band_button(t, 'plus', 'New lesson'))
    oct_ = kit.section_label(t, 'October 2026') + kit.list_group(t, [
        lesson_row(t, 'WED', '28', '28 October 2026', LONG, '3 videos · 1.2 GB', (6, 1, 3)),
        lesson_row(t, 'SAT', '24', '24 October 2026', 'Workshop: son montuno basics', '2 videos · 820 MB', (2, 0, 2)),
        lesson_row(t, 'WED', '21', '21 October 2026', 'Setenta and the hook turn', '1 video · 410 MB', (0, 0, 1)),
        lesson_row(t, 'WED', '14', '14 October 2026', 'Shines with Marta', None, (0, 0, 0)),
    ], label='October 2026')
    sep = kit.section_label(t, 'September 2026', 14) + kit.list_group(t, [
        lesson_row(t, 'WED', '30', '30 September 2026', 'Cross-body lead timing', '2 videos · 960 MB', (4, 1, 2)),
    ], label='September 2026')
    return kit.page(t, header, oct_ + sep, tab='Lessons', overlay=overlay)


def lessons_empty(t):
    header = kit.band_header(t, 'Lessons', right=kit.band_button(t, 'plus', 'New lesson'))
    body = ('<div style="height: 60px; flex: none"></div>' + kit.empty_state(
        t, 'lessons', 'No lessons yet',
        'Add one after your next class — the videos, the notes, and something on Today to make you go back over it.',
        kit.button(t, 'New lesson', 'primary', icon_name='plus')))
    return kit.page(t, header, body, tab='Lessons')


def new_lesson_fields(t, error=False):
    if error:
        day = kit.text_field(t, 'Day of the class', '4 November 2026', state='error', lead_icon='calendar',
                             error='That day is in the future.')
        title = kit.text_field(t, 'Title', 'Sensual footwork', state='filled')
        notes_ = kit.textarea(t, 'Notes', 'Body roll into the cuddle turn, slow on 4.', state='filled', rows=3, optional=True)
    else:
        day = kit.text_field(t, 'Day of the class', '31 October 2026', state='filled', lead_icon='calendar')
        title = kit.text_field(t, 'Title', 'Wednesday rueda', placeholder='Wednesday rueda — enchufla variations', state='focused')
        notes_ = kit.textarea(t, 'Notes', placeholder='What the teacher said, what to fix, what you kept getting wrong…', rows=3, optional=True)
    freq = kit.select_field(t, 'Go over it again', 'Every 3 days', helper='Puts “Review: …” on Today; lower it as it settles.')
    return f'<div style="display: flex; flex-direction: column; gap: 14px">{day}{title}{notes_}{freq}</div>'


def new_lesson(t):
    sheet = kit.bottom_sheet(t, 'New lesson', new_lesson_fields(t), kit.button(t, 'Create lesson', 'primary', full=True, on=t['sheet_bg']), gap=14)
    return lessons_list(t, overlay=sheet)


def new_lesson_error(t):
    sheet = kit.bottom_sheet(t, 'New lesson', new_lesson_fields(t, True), kit.button(t, 'Create lesson', 'primary', full=True, on=t['sheet_bg']), gap=14)
    header = kit.band_header(t, 'Lessons', 'Videos on disk: 1.1 GB', right=kit.band_button(t, 'plus', 'New lesson'))
    body = kit.section_label(t, 'October 2026') + kit.list_group(t, [
        lesson_row(t, 'SAT', '24', '24 October 2026', 'Hammerlock & shadow position', '2 videos · 640 MB', (3, 1, 2)),
        lesson_row(t, 'SAT', '17', '17 October 2026', 'Body wave drills', '1 video · 450 MB', (1, 0, 1)),
    ])
    return kit.page(t, header, body, tab='Lessons', overlay=sheet)


def lesson_top(t):
    body = (notes_card(t, notes(t)) + review_group(t)
            + kit.section_label(t, 'Videos · 2', 14) + video_card(t, sections=SEC1))
    return kit.page(t, lesson_header(t), body, pad='20px 16px 0')


def lesson_uploading(t):
    body = (kit.section_label(t, 'Videos · 2') + video_card(t, '96 MB', '6:12', 2, source=True)
            + upload_card(t, 'Uploading 2 of 3… 46%', 'Keep this page open — a reload starts over', 46)
            + kit.section_label(t, 'Links', 14) + yt_card(t, 'Enchufla doble — slow', 'link'))
    return kit.page(t, lesson_header(t), body, pad='20px 16px 0')


def lesson_reconnect(t):
    body = (kit.section_label(t, 'Videos · 1') + video_card(t, '1.1 GB', '24:05', 3, sections=[SEC1[0]])
            + upload_card(t, 'Connection dropped — retrying', 'Picks up from what the server already has · 46%', 46, 'warn', 'refresh'))
    return kit.page(t, lesson_header(t), body, pad='20px 16px 0')


def lesson_broken(t):
    body = (kit.section_label(t, 'Videos · 3') + video_card(t, '1.0 GB', state='missing', sec_note=False)
            + video_card(t, '310 MB', state='unplayable', sec_note=False)
            + kit.banner(t, 'error', 'Some files were skipped', '1 video added. Skipped notes.txt (not a video), Clase 3.mov (the connection dropped).', dismiss=True)
            + upload_idle(t))
    return kit.page(t, lesson_header(t, 'Hammerlock & shadow position', '24 October 2026'), body, pad='20px 16px 0')


def lesson_links(t):
    plain = group(t, [split_row(t, 'Class playlist', 'salsaschool.example', kit.icon_button(t, 'trash', 'Remove Class playlist', 'bare', color=t['muted'], on=t['surface']),
                                leading=f'<span style="width: 40px; height: 40px; border-radius: 12px; background: {t["chip"]}; display: flex; align-items: center; justify-content: center">{kit.icon("external", 20, t["ink2"])}</span>',
                                last=True)])
    body = (kit.section_label(t, 'Links · 4') + yt_card(t, 'Enchufla doble — slow', 'link')
            + yt_card(t, 'Setenta full breakdown', 'saving', tone=2)
            + yt_card(t, 'Rueda calls explained', 'failed', error='Video unavailable', tone=3) + plain)
    return kit.page(t, lesson_header(t), body, pad='20px 16px 0')


def lesson_add_link(t):
    form = (kit.textarea(t, 'Add links', 'https://youtu.be/4kT9w2pQx1s\nhttps://youtu.be/Zq7mB1c0aXk', state='focused', rows=2,
                         helper='YouTube or other links, one per line', bg=t['field'])
            + kit.text_field(t, 'Title', placeholder='For one link', optional=True, bg=t['field'])
            + kit.button(t, 'Add link', 'secondary', icon_name='link', full=True))
    body = (kit.section_label(t, 'Links · 1') + yt_card(t, 'Enchufla doble — slow', 'link', expanded=True, mirror=True)
            + f'<div style="background: {t["surface"]}; border-radius: 16px; padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 14px; flex: none">{form}</div>')
    return kit.page(t, lesson_header(t), body, pad='20px 16px 0')


def linked(t):
    un = lambda n: kit.icon_button(t, 'unlink', f'Unlink {n}', 'bare', color=t['muted'], on=t['surface'])  # noqa: E731
    figs = group(t, [
        split_row(t, f'Enchufla · Doble {via_badge(t)}', '0:42.0–1:05.5', un('Enchufla · Doble')),
        split_row(t, f'Setenta · Basic {via_badge(t, 2)}', '1:12.0–1:30.4, 3:05.0–3:22.8', un('Setenta · Basic')),
        split_row(t, 'Dile que no · Basic', 'With partner', un('Dile que no · Basic')),
        link_row_btn(t, 'Link a figure…'),
    ])
    rts = group(t, [split_row(t, 'Rueda opener', 'Every 3 days · 6 figures', un('Rueda opener')), link_row_btn(t, 'Link a routine…')])
    exs = group(t, [
        split_row(t, f'Footwork drill {via_badge(t)}', '2:10.4–2:31.0', kit.log_button(t, 'Footwork drill') + un('Footwork drill')),
        split_row(t, 'Shine: Suzie Q', 'Solo · daily', kit.log_button(t, 'Shine: Suzie Q') + un('Shine: Suzie Q')),
        link_row_btn(t, 'Link an exercise…'),
    ])
    return (kit.section_label(t, 'Figures · 3', 0, new_btn(t, 'figure')) + figs
            + kit.section_label(t, 'Routines · 1', 10, new_btn(t, 'routine')) + rts
            + kit.section_label(t, 'Exercises · 2', 10, new_btn(t, 'exercise')) + exs)


def lesson_linked(t, overlay=''):
    return kit.page(t, lesson_header(t), linked(t), pad='16px 16px 0', overlay=overlay)


def unlink_via(t):
    d = kit.dialog(t, 'Unlink Enchufla · Doble?',
                   '<b>Enchufla · Doble</b> is on this lesson through section 0:42.0–1:05.5. Unlink it from the lesson and the section?',
                   [kit.button(t, 'Cancel', 'tertiary', size='sm', on=t['raised']), kit.button(t, 'Unlink', 'danger', size='sm', on=t['raised'])],
                   icon_name='unlink', tone='danger')
    return lesson_linked(t, d)


def delete_confirm(t):
    d = kit.dialog(t, 'Delete this video?',
                   'Its 3 sections go with it. Lesson videos aren’t backed up, so this can’t be undone.',
                   [kit.button(t, 'Cancel', 'tertiary', size='sm', on=t['raised']), kit.button(t, 'Delete', 'danger', size='sm', on=t['raised'])],
                   icon_name='trash', tone='danger')
    sec = [(None, '0:18.0–0:40.2', None), (None, '1:02.5–1:20.0', None), ('Outro', '5:40.0–6:01.0', None)]
    body = kit.section_label(t, 'Videos · 2') + video_card(t, '410 MB', '6:20', 1, sections=sec)
    return kit.page(t, lesson_header(t, 'Setenta and the hook turn', '21 October 2026'), body, pad='20px 16px 0', overlay=d)


def delete_refused(t):
    body = (kit.section_label(t, 'Videos · 2')
            + video_card(t, sections=SEC1, refused='Linked to Enchufla · Doble, Footwork drill — unlink it first.'))
    return kit.page(t, lesson_header(t), body, pad='20px 16px 0')


EDIT_NOTES = ('Enchufla doble: keep the left hand low on 3, don’t pull.\nLead the second turn with the wrist, not the arm.\n'
              'Her breakdown: https://youtu.be/4kT9w2pQx1s\nNext week: the hook turn ending')


def edit(t, overlay='', notes_state='focused'):
    body = (kit.text_field(t, 'Day of the class', '28 October 2026', state='filled', lead_icon='calendar')
            + kit.text_field(t, 'Title', LONG, state='filled')
            + kit.textarea(t, 'Notes', EDIT_NOTES, state=notes_state, rows=7, helper='Links in notes open when tapped.')
            + '<div style="height: 4px; flex: none"></div>' + kit.button(t, 'Save', 'primary', full=True)
            + f'<div style="display: flex; justify-content: center">{kit.button(t, "Archive lesson", "danger_text", size="sm")}</div>')
    return kit.page(t, lesson_header(t, editing=True), body, pad='22px 16px 0', overlay=overlay)


def archive_confirm(t):
    d = kit.dialog(t, 'Archive this lesson?', 'Its review exercise goes too. The videos, links and sets are kept.',
                   [kit.button(t, 'Cancel', 'tertiary', size='sm', on=t['raised']), kit.button(t, 'Archive', 'danger', size='sm', on=t['raised'])],
                   icon_name='warning', tone='danger')
    return edit(t, d, 'filled')


def new_variation(t):
    inner = (kit.segmented(t, ['New figure', 'Variation of a figure'], 1, on_band=False, label='Make')
             + kit.select_field(t, 'Figure', 'Enchufla', helper='Figures in this lesson come first')
             + kit.text_field(t, 'Variation name', 'Doble con giro', placeholder='e.g. Basic, Doble, From cross', state='focused')
             + f'<div style="display: flex; flex-direction: column; gap: 4px"><span style="{kit.ts("label", t["ink2"])}; padding-left: 4px">Danced</span>'
             + kit.chips(t, ['With partner', 'Solo'], 0, label='Danced', scroll=False) + '</div>'
             + f'<div style="display: flex; flex-direction: column; gap: 4px"><span style="{kit.ts("label", t["ink2"])}; padding-left: 4px">Style</span>'
             + kit.chips(t, ['Salsa', 'Son', 'Other'], 0, label='Style', scroll=False) + '</div>'
             + kit.textarea(t, 'Notes', placeholder='Count, hand holds, what the teacher said…', rows=2, optional=True))
    sheet = kit.bottom_sheet(t, 'New variation', inner, kit.button(t, 'Add variation', 'primary', full=True, on=t['sheet_bg']), gap=12)
    return lesson_linked(t, sheet)


def new_routine(t):
    inner = (kit.text_field(t, 'Name', 'Rueda opener', state='focused')
             + kit.select_field(t, 'How often', 'Every 3 days')
             + kit.textarea(t, 'Notes', placeholder='', rows=2, optional=True))
    sheet = kit.bottom_sheet(t, 'New routine from this lesson', inner,
                             kit.button(t, 'Add routine and build it', 'primary', full=True, on=t['sheet_bg']),
                             sub='Linked here, then opened to build its slots', gap=14)
    return lesson_linked(t, sheet)


def in_app_empty(t):
    body = (review_group(t, 'Weekly')
            + kit.section_label(t, 'Videos', 14) + upload_idle(t, app=True)
            + kit.section_label(t, 'Links', 14)
            + f'<div style="background: {t["surface"]}; border-radius: 16px; padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 12px; flex: none">'
            + kit.textarea(t, 'Add links', placeholder='Paste YouTube or other links, one per line', rows=2, bg=t['field'])
            + kit.button(t, 'Add link', 'secondary', icon_name='link', full=True) + '</div>'
            + kit.section_label(t, 'Figures', 14, new_btn(t, 'figure')) + group(t, [link_row_btn(t, 'Link a figure…')])
            + kit.section_label(t, 'Routines', 10, new_btn(t, 'routine')) + group(t, [link_row_btn(t, 'Link a routine…')])
            + kit.section_label(t, 'Exercises', 10, new_btn(t, 'exercise')) + group(t, [link_row_btn(t, 'Link an exercise…')]))
    return kit.page(t, lesson_header(t, 'Sensual footwork', '31 October 2026'), body, pad='20px 16px 0')


SCREENS = [
    ('Lessons', 'The library: weekday tile, videos and size, and always all three counts (a zero is muted). Disk use under the title.', lessons_list),
    ('Lessons · empty', 'Nothing yet: one line on what a lesson is for, and the same New lesson as the band’s +.', lessons_empty),
    ('New lesson', 'Sheet over the list, Title focused. The day defaults to today; the frequency feeds its review exercise.', new_lesson),
    ('New lesson · refused', 'A future day is refused; the message now sits under the field it is about.', new_lesson_error, 'bachata'),
    ('Lesson', 'Notes with a live link, the review exercise (+ logs it), then each video with its sections. ⤢ opens the full-screen player; the link icon opens the Link popup.', lesson_top),
    ('Lesson · uploading', 'A saved YouTube video (“from YouTube”), a batch upload in progress, and a link with Save video.', lesson_uploading),
    ('Lesson · upload reconnecting', 'A dropped chunk retries and resyncs to the server’s offset — shown in warn, the bar holds.', lesson_reconnect),
    ('Lesson · upload failed, broken files', 'Missing file, unplayable file (Download it), and the batch summary when files were skipped.', lesson_broken, 'bachata'),
    ('Lesson · links', 'YouTube links: Save video (480p, by the home worker), saving, failed + Retry; a plain link. Saved, a link becomes a video.', lesson_links),
    ('Lesson · a link playing, add links focused', 'A tapped thumbnail plays the embed in place (Mirror on). Paste several links at once; the title is for one.', lesson_add_link),
    ('Lesson · in this lesson', 'Figures, routines, exercises — by hand or “via section”. ⊘ unlinks, + logs, the last row opens the shared picker.', lesson_linked),
    ('Unlink via section', 'Unlinking something that comes through a section takes the section link too — so it asks.', unlink_via),
    ('Delete video', 'The bin asks first; its unlinked sections go with it.', delete_confirm),
    ('Delete video · refused', 'A linked section blocks the delete; the refusal names what to unlink, right on the video.', delete_refused),
    ('Edit lesson · notes focused', 'Edit swaps the page for its fields; ✓ on the band saves, as Save does. Archive lives at the bottom.', edit),
    ('Archive lesson', 'Archive, not delete: the review exercise goes, everything else stays.', archive_confirm),
    ('New variation from a lesson', 'New figure | Variation of a figure; the figure picker offers this lesson’s figures first.', new_variation),
    ('New routine from this lesson', 'Links it, then opens the routine to build. New exercise is the same sheet with Add exercise.', new_routine),
    ('Lesson · in the app, nothing yet', 'In the Android app, Add videos hands over to the app’s background upload.', in_app_empty, 'bachata'),
]

if __name__ == '__main__':
    html, w, h = kit.artboard('Lessons', 'The lessons library, a lesson with its videos, sections, links and what it teaches; uploads, saves, refusals and confirms.',
                              SCREENS, per_row=3)
    kit.write(S + '/canvas/project/S-lessons.dc.html', html)
    print(w, h)
