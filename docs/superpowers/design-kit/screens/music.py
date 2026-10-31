"""Music (the songs library) redrawn in the C4 look: the Music tab, adding a song,
the song page, and the song popup Practice uses. Light/dark pairs via kit.artboard.

    python3 music.py   -> canvas/project/S-music.dc.html
"""
import os
import sys

S = '/tmp/claude-1000/-home-tilen-Projects-salsaapp-wt-app-icons/cf18291b-f44a-483d-bf97-2da9a238a117/scratchpad'
sys.path.insert(0, S + '/gen/kit')
import kit  # noqa: E402
from kit import ts, icon  # noqa: E402

OUT = S + '/canvas/project/S-music.dc.html'

# --------------------------------------------------------------------------
# content
# --------------------------------------------------------------------------

SALSA = [  # title, artist, style, bpm (bpm x tempo factor), length
    ('Valió la pena', 'Marc Anthony', 'Salsa', 192, '5:23'),
    ('Periódico de ayer', 'Héctor Lavoe', 'Salsa', 178, '5:31'),
    ('Quimbara', 'Celia Cruz', 'Salsa', 206, '3:21'),
    ('Aguanile', 'Héctor Lavoe', 'Salsa', 184, '7:09'),
    ('Chan chan', 'Buena Vista Social Club', 'Son', 156, '4:16'),
    ('El cantante', 'Héctor Lavoe', 'Salsa', 172, '10:23'),
    ('Idilio', 'Willie Colón', 'Salsa', 182, '6:04'),
    ('Lágrimas negras', 'Compay Segundo', 'Son', 150, '5:02'),
    ('Llorarás', "Oscar D'León", 'Salsa', 194, '4:44'),
    ('Te conozco bien', 'Marc Anthony', 'Salsa', 190, '4:39'),
    ('Vivir mi vida', 'Marc Anthony', 'Salsa', 198, '4:11'),
]
BACHATA = [
    ('Propuesta indecente', 'Romeo Santos', 'Sensual', 128, '4:00'),
    ('Obsesión', 'Aventura', 'Traditional', 126, '4:10'),
    ('Eres mía', 'Romeo Santos', 'Dominican', 132, '3:52'),
    ('Bachata en Fukuoka', 'Juan Luis Guerra', 'Dominican', 140, '3:40'),
    ('Darte un beso', 'Prince Royce', 'Sensual', 124, '3:51'),
    ('Dile al amor', 'Aventura', 'Dominican', 128, '4:12'),
    ('Promise', 'Romeo Santos', 'Sensual', 120, '4:16'),
    ('Stand by me', 'Prince Royce', 'Traditional', 130, '3:30'),
]


def songs(t):
    return SALSA if t['dance'] == 'salsa' else BACHATA


def styles(t):
    return ['Salsa', 'Son', 'Other'] if t['dance'] == 'salsa' else ['Dominican', 'Sensual', 'Traditional']


def meta_of(s):
    return f'{s[2]} · {s[3]} BPM · {s[4]}'


def find(t, title):
    return next(s for s in songs(t) if s[0] == title)


# --------------------------------------------------------------------------
# new building blocks for this area (built from kit tokens only)
# --------------------------------------------------------------------------


def sample_btn(t, name, on=False, pct=38, size=48, disc_bg=None):
    """The sample control: a tonal 34px disc with a filled play glyph; while sampling,
    a stop glyph and an accent ring that fills over the 15 s (``pct``)."""
    disc = 34
    dbg = disc_bg or t['accent_soft']
    glyph = (icon('stop', 13, t['accent'], filled=True, bg=dbg) if on
             else icon('play', 15, t['accent'], filled=True, bg=dbg, style='margin-left: 2px'))
    ring = ''
    if on:
        r, c = 19, 42
        circ = 2 * 3.14159 * r
        ring = (f'<svg aria-hidden="true" width="{c}" height="{c}" viewBox="0 0 {c} {c}" style="position: absolute; left: -4px; top: -4px">'
                f'<circle cx="21" cy="21" r="{r}" fill="none" stroke="{t["hairline"]}" stroke-width="2.5"></circle>'
                f'<circle cx="21" cy="21" r="{r}" fill="none" stroke="{t["accent"]}" stroke-width="2.5" stroke-linecap="round" '
                f'stroke-dasharray="{circ * pct / 100:.1f} {circ:.1f}" transform="rotate(-90 21 21)"></circle></svg>')
    lab = 'Stop the sample' if on else f'Play a sample of {name}'
    return (f'<button type="button" aria-label="{lab}" aria-pressed="{"true" if on else "false"}" style="width: {size}px; height: {size}px; flex: none; {kit.BTN}">'
            f'<span style="position: relative; width: {disc}px; height: {disc}px; border-radius: {disc // 2}px; background: {dbg}; '
            f'display: flex; align-items: center; justify-content: center">{ring}{glyph}</span></button>')


def hl(t, title, q):
    """Title with the first case-insensitive match of ``q`` marked (accents in the data already match)."""
    i = title.lower().find(q.lower())
    if i < 0:
        return title
    return (f'{title[:i]}<mark style="background: {t["accent_soft"]}; color: {t["accent_text"]}; font-weight: 800; border-radius: 4px; '
            f'padding: 0 1px">{title[i:i + len(q)]}</mark>{title[i + len(q):]}')


def radio_dot(t, on):
    inner = f'<span style="width: 10px; height: 10px; border-radius: 5px; background: {t["accent"]}"></span>' if on else ''
    return (f'<span aria-hidden="true" style="width: 22px; height: 22px; box-sizing: border-box; border-radius: 11px; '
            f'border: 2px solid {t["accent"] if on else t["field_line"]}; display: flex; align-items: center; justify-content: center; flex: none">{inner}</span>')


def song_row(t, title, meta, kind='link', sample=None, last=False, meta_tone=None, picked=False, trailing=''):
    """A song row: the text part opens the song (kind='link'), picks it (kind='pick', a button
    with a radio dot) or is plain (kind='div'); the sample button is a SIBLING, never nested.
    meta_tone: None | 'accent' (sampling) | 'danger' | 'status'."""
    hair = '' if last else f'border-bottom: 1px solid {t["hairline"]};'
    mc, mw = t['muted'], 400
    if meta_tone == 'accent':
        mc, mw = t['accent_text'], 700
    elif meta_tone in ('danger', 'status'):
        mc, mw = t[meta_tone], 700
    m = f'<span style="font-size: 13px; line-height: 1.35; font-weight: {mw}; color: {mc}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{meta}</span>' if meta else ''
    text = (f'<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px">'
            f'<span style="font-size: 16px; line-height: 1.3; font-weight: 700; color: {t["ink"]}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{title}</span>{m}</span>')
    pr = 4 if (sample or trailing.lstrip().startswith('<button')) else 14
    common = f'flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; padding: 9px {0 if (sample or trailing) else pr}px 9px 0; text-decoration: none; color: {t["ink"]}'
    if kind == 'link':
        main = f'<a href="#" style="{common}">{text}</a>'
    elif kind == 'pick':
        cur = ' aria-current="true"' if picked else ''
        main = (f'<button type="button"{cur} style="{common}; border: 0; background: none; text-align: left; cursor: pointer; font: inherit">'
                f'{radio_dot(t, picked)}{text}</button>')
    else:
        main = f'<div style="{common}">{text}</div>'
    bg = t['accent_soft'] if picked else 'transparent'
    tr = sample or ''
    if trailing:
        tr += trailing
    return (f'<div style="padding-left: 16px; background: {bg}"><div style="display: flex; align-items: center; gap: 4px; min-height: 64px; '
            f'box-sizing: border-box; padding-right: {pr}px; {hair}">{main}{tr}</div></div>')


def group(t, rows):
    return f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">{"".join(rows)}</div>'


def count_only_row(t, last=True):
    lead = (f'<span style="width: 40px; height: 40px; border-radius: 20px; background: {t["accent_soft"]}; display: flex; align-items: center; '
            f'justify-content: center; flex: none">{icon("metronome", 22, t["accent_text"])}</span>')
    return kit.list_group(t, [dict(title='Count only', meta='The count and clave, no song', leading=lead,
                                   trailing=kit.chevron(t), href='#')], label='Practice')


def note(t, text, align='center'):
    return f'<p style="margin: 0; padding: 4px 12px 0; text-align: {align}; font-size: 13px; line-height: 1.45; color: {t["muted"]}">{text}</p>'


def live_player(t, count=1, pos=32, cur='1:44', total='5:23', anchors=(2, 31, 58), playing=True):
    """The song page's player card: the live count (big number + eight dots, 4 and 8 quieter)
    over the transport (play/pause, the timeline with the user's 1s as ticks, times)."""
    if count == 1:
        nc = t['accent_text']
    elif count == 5:
        nc = t['ink']
    else:
        nc = t['ink2']
    dots = ''
    for n in range(1, 9):
        if n == count:
            c = t['accent'] if n == 1 else t['ink']
        else:
            c = t['hairline'] if n in (4, 8) else t['field_line']
        dots += f'<span style="width: 12px; height: 12px; border-radius: 6px; background: {c}"></span>'
    num = (f'<div aria-live="off" style="display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 6px 0 4px">'
           f'<span style="{kit.BRIC}; font-size: 88px; line-height: 1; font-weight: 800; letter-spacing: -0.02em; color: {nc}; font-variant-numeric: tabular-nums">{count}</span>'
           f'<span aria-hidden="true" style="display: flex; gap: 8px">{dots}</span></div>')
    ticks = ''.join(f'<span aria-hidden="true" style="position: absolute; left: {a}%; top: -7px; width: 2px; height: 20px; border-radius: 1px; '
                    f'background: {t["accent_text"]}; opacity: 0.55"></span>' for a in anchors)
    track = (f'<div style="position: relative; height: 6px; border-radius: 3px; background: {t["hairline"]}">'
             f'<div style="width: {pos}%; height: 6px; border-radius: 3px; background: {t["accent"]}"></div>{ticks}'
             f'<div role="slider" tabindex="0" aria-label="Position in the song" aria-valuemin="0" aria-valuemax="100" aria-valuenow="{pos}" aria-valuetext="{cur}" '
             f'style="position: absolute; left: calc({pos}% - 10px); top: -7px; width: 20px; height: 20px; border-radius: 10px; background: #ffffff; '
             f'box-shadow: 0 1px 4px rgba(0,0,0,0.3), 0 0 0 0.5px rgba(0,0,0,0.08)"></div></div>')
    times = (f'<div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; color: {t["muted"]}; '
             f'font-variant-numeric: tabular-nums"><span>{cur}</span><span>{total}</span></div>')
    pp = kit.icon_button(t, 'pause' if playing else 'play', 'Pause the song' if playing else 'Play the song', 'filled', size=52,
                         filled=True, on=t['surface'])
    transport = (f'<div style="display: flex; align-items: center; gap: 14px">{pp}'
                 f'<div style="flex: 1; display: flex; flex-direction: column; gap: 10px; padding-top: 14px">{track}{times}</div></div>')
    return (f'<div style="background: {t["surface"]}; border-radius: 22px; padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 12px; flex: none">'
            f'{num}{transport}</div>')


def got_it(t):
    """The tap button's confirmation (600 ms after a tap): done colours and a check."""
    return (f'<button type="button" aria-live="polite" style="width: 100%; height: 64px; border-radius: 32px; border: 0; background: {t["done_soft"]}; color: {t["done"]}; '
            f'{kit.BRIC}; font-size: 22px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 10px; flex: none">'
            f'{icon("check", 24, t["done"], stroke=2.6)}Got it</button>')


def steps(t, rows):
    """The status of a song that is being added: Added → Download → Find the beat."""
    out = []
    for i, (state, title, meta) in enumerate(rows):
        if state == 'done':
            lead = kit.done_check(t, 24)
        elif state == 'now':
            lead = kit.spinner(t, 24)
        else:
            lead = icon('circle', 24, t['field_line'])
        out.append(kit.row(t, title, meta, leading=lead, last=i == len(rows) - 1,
                           title_tone='muted' if state == 'todo' else None))
    return kit.list_group(t, out, label='Progress')


def field_label(t, text, top=0):
    return f'<span style="padding: {top}px 4px 0; {ts("label", t["ink2"])}">{text}</span>'


def or_rule(t):
    line = f'<span style="flex: 1; height: 1px; background: {t["hairline"]}"></span>'
    return (f'<div aria-hidden="true" style="display: flex; align-items: center; gap: 12px; padding: 2px 0; flex: none">'
            f'{line}<span style="{ts("label", t["muted"])}">or</span>{line}</div>')


# --------------------------------------------------------------------------
# screens
# --------------------------------------------------------------------------


def music_header(t):
    return kit.band_header(t, 'Music', right=kit.band_button(t, 'plus', 'Add a song'))


def library_body(t, sampling='Quimbara', recent=None):
    s = songs(t)
    recent = recent or tuple(x[0] for x in (s[:1] + s[2:3] + s[4:5]))
    if sampling and sampling not in [x[0] for x in s]:
        sampling = s[2][0]
    rec = [find(t, x) for x in recent]
    rest = sorted([x for x in s if x[0] not in recent], key=lambda x: x[0])

    def r(x, last):
        on = x[0] == sampling
        return song_row(t, x[0], 'Sample from 1:07' if on else meta_of(x), meta_tone='accent' if on else None,
                        sample=sample_btn(t, x[0], on=on), last=last)
    body = ('<div style="height: 2px; flex: none"></div>' + kit.search_field(t, 'Search songs')
            + count_only_row(t)
            + kit.section_label(t, 'Recent', 10) + group(t, [r(x, i == len(rec) - 1) for i, x in enumerate(rec)])
            + kit.section_label(t, f'All songs A–Z · {len(rest)}', 10) + group(t, [r(x, i == len(rest) - 1) for i, x in enumerate(rest)]))
    return body


def music(t, overlay=''):
    return kit.page(t, music_header(t), library_body(t), tab='Music', overlay=overlay)


def music_plain(t):
    return kit.page(t, music_header(t), library_body(t, sampling=None), tab='Music')


def uploading_row(t, name, pct, done_mb, total_mb):
    bar = (f'<div role="progressbar" aria-label="Uploading {name}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="{pct}" '
           f'style="height: 6px; border-radius: 3px; background: {t["hairline"]}; overflow: hidden">'
           f'<div style="width: {pct}%; height: 6px; border-radius: 3px; background: {t["accent"]}"></div></div>')
    return (f'<div style="padding-left: 16px"><div style="display: flex; align-items: center; gap: 12px; min-height: 76px; padding: 12px 16px 12px 0; '
            f'box-sizing: border-box; border-bottom: 1px solid {t["hairline"]}">'
            f'{icon("upload", 24, t["accent_text"])}'
            f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px">'
            f'<div style="display: flex; justify-content: space-between; gap: 8px"><span style="font-size: 16px; font-weight: 700; white-space: nowrap; overflow: hidden; '
            f'text-overflow: ellipsis">{name}</span><span style="font-size: 15px; font-weight: 800; color: {t["ink"]}; font-variant-numeric: tabular-nums">{pct}%</span></div>'
            f'{bar}<span style="font-size: 13px; color: {t["muted"]}">Uploading · {done_mb} of {total_mb} MB · keep the app open</span></div></div></div>')


def music_adding(t):
    trail = lambda txt, tone, ic: f'<span style="display: flex; align-items: center; gap: 4px; flex: none">{kit.badge(t, txt, tone, icon_name=ic)}{kit.chevron(t)}</span>'
    failed_link = song_row(t, 'Pedro Navaja', 'Failed: video unavailable', meta_tone='danger', last=True,
                           trailing=f'<span style="display: flex; flex: none">{kit.chevron(t)}</span>')
    retry = (f'<div style="padding: 4px 8px 8px; border-top: 1px solid {t["hairline"]}; display: flex; gap: 4px">'
             f'{kit.button(t, "Retry", "tertiary", icon_name="refresh", size="sm", on=t["surface"])}</div>')
    adding = group(t, [
        uploading_row(t, 'Vivir mi vida.mp3', 62, 6, 9.7),
        song_row(t, 'La rebelión', 'Salsa', trailing=trail('Waiting to download', 'neutral', 'clock')),
        song_row(t, 'Juliana', 'Salsa', trailing=trail('Finding the beat', 'accent', 'metronome')),
        failed_link + retry,
    ])
    rec = [find(t, 'Valió la pena'), find(t, 'Quimbara')]
    body = ('<div style="height: 2px; flex: none"></div>' + kit.search_field(t, 'Search songs')
            + count_only_row(t)
            + kit.section_label(t, 'Being added · 4', 10) + adding
            + kit.banner(t, 'info', 'Runs on the laptop at home',
                         'Downloads and beat analysis happen about once a minute while it is on.')
            + kit.section_label(t, 'Recent', 10)
            + group(t, [song_row(t, x[0], meta_of(x), sample=sample_btn(t, x[0]), last=i == 1) for i, x in enumerate(rec)]))
    return kit.page(t, music_header(t), body, tab='Music')


def add_sheet(t, url_state='focused', url_value='https://youtu.be/7hdQ', upload_error=False, title_value=''):
    err = 'Paste a full link, starting with https://' if url_state == 'error' else None
    inner = (kit.text_field(t, 'YouTube link', url_value, 'https://www.youtube.com/watch?v=…', url_state, error=err,
                            lead_icon='youtube', input_type='url', inputmode='url', bg=t['surface'])
             + kit.text_field(t, 'Title', title_value, 'Song title', 'filled' if title_value else 'empty', optional=True, bg=t['surface'])
             + f'<div style="display: flex; flex-direction: column; gap: 2px; flex: none">{field_label(t, "Style")}'
             + kit.chips(t, styles(t), 0, label='Style', scroll=False) + '</div>'
             + kit.button(t, 'Add song', 'primary', full=True, on=t['sheet_bg'])
             + or_rule(t)
             + kit.button(t, 'Upload an audio file', 'secondary', icon_name='upload', full=True, on=t['sheet_bg'])
             + (kit.banner(t, 'error', 'That file is 120 MB; the limit is 95 MB.') if upload_error
                else note(t, 'Up to 95 MB. It gets the style above.')))
    return kit.bottom_sheet(t, 'Add a song', inner)


def music_add(t):
    return music_plain(t)[:-6] + add_sheet(t) + '</div>'


def page_with(t, page_html, overlay):
    """Append an overlay inside a finished phone (kit.page closes the phone with </div>)."""
    return page_html[:-6] + overlay + '</div>'


def music_add_error(t):
    return page_with(t, music_plain(t), add_sheet(t, 'error', 'youtube.com/watch?v=7hdQ'))


def music_add_upload_error(t):
    return page_with(t, music_plain(t), add_sheet(t, 'empty', '', upload_error=True))


def music_empty(t):
    body = ('<div style="height: 2px; flex: none"></div>' + count_only_row(t)
            + kit.empty_state(t, 'music', 'No songs yet',
                              'Add one from YouTube or upload an audio file. The laptop at home downloads it and finds the beat.',
                              kit.button(t, 'Add a song', 'primary', icon_name='plus')))
    return kit.page(t, music_header(t), body, tab='Music')


def music_search(t):
    q = 'pe'
    hits = sorted([x for x in songs(t) if q in x[0].lower()] + [('Pedro Navaja', '', 'Salsa', 0, '')], key=lambda x: x[0])
    rows = []
    for i, x in enumerate(hits):
        last = i == len(hits) - 1
        if x[0] == 'Pedro Navaja':
            rows.append(song_row(t, hl(t, x[0], q), 'Failed: video unavailable', meta_tone='danger', last=last,
                                 trailing=f'<span style="display: flex; flex: none">{kit.chevron(t)}</span>'))
        else:
            rows.append(song_row(t, hl(t, x[0], q), meta_of(x), sample=sample_btn(t, x[0]), last=last))
    body = ('<div style="height: 2px; flex: none"></div>' + kit.search_field(t, 'Search songs', 'pe', 'focused')
            + kit.section_label(t, f'{len(hits)} matches · title or artist', 6) + group(t, rows)
            + note(t, 'Accents and case aside: “valio” finds Valió la pena.'))
    return kit.page(t, music_header(t), body, tab='Music')


# ---- the song page --------------------------------------------------------

def song_header(t, title, sub):
    return kit.band_header(t, title, sub, left=kit.band_button(t, 'back', 'Back to Music'),
                           right=kit.band_button(t, 'edit', 'Song details'), tall=False)


def song_page(t, overlay=''):
    s = songs(t)[0]
    head = song_header(t, s[0], f'{s[1]} · {s[2]} · {s[3]} BPM')
    body = (kit.button(t, 'Practice with this song', 'secondary', icon_name='play', full=True)
            + live_player(t, 1)
            + kit.button(t, 'Tap on the 1', 'primary', size='lg', full=True)
            + note(t, 'If the count slips after a break, tap the 1 again there.')
            + kit.section_label(t, 'Sample', 14)
            + group(t, [song_row(t, f'From 1:55 <span style="margin-left: 6px; vertical-align: 1px">{kit.badge(t, "Yours", "accent")}</span>',
                                 'Set by you', kind='div', sample=sample_btn(t, s[0]), last=True)]))
    return kit.page(t, head, body, pad='20px 16px 0', overlay=overlay)


def song_page_lower(t):
    s = songs(t)[0]
    head = song_header(t, s[0], f'{s[1]} · {s[2]} · {s[3]} BPM')
    yours = f'From 1:55 <span style="margin-left: 6px; vertical-align: 1px">{kit.badge(t, "Yours", "accent")}</span>'
    sample = group(t, [song_row(t, yours, 'Set by you', kind='div',
                                sample=sample_btn(t, s[0], on=True, pct=64), last=True)])
    anchors = kit.list_group(t, [
        dict(title=f'<span style="font-variant-numeric: tabular-nums">{a}</span>', meta=m,
             trailing=kit.button(t, 'Remove', 'danger_text', size='sm', on=t['surface']), min_h=56)
        for a, m in (('0:07', 'First 1'), ('2:41', 'After the break'), ('4:58', 'Coro'))], label='Your 1s')
    body = (kit.section_label(t, 'Sample') + sample
            + kit.button(t, 'Start the sample at 2:05', 'secondary', full=True)
            + '<div style="display: flex; justify-content: center; margin-top: -4px">' + kit.button(t, 'Back to automatic', 'tertiary', size='sm') + '</div>'
            + kit.section_label(t, 'Count speed', 8)
            + kit.segmented(t, ['×½', '×1', '×2'], 1, on_band=False, label='Count speed')
            + note(t, 'If the count runs at half or double your steps, switch it. This clears your taps.', 'left')
            + kit.section_label(t, 'Your 1s · 3', 12, trailing=kit.button(t, 'Clear all', 'tertiary', size='sm'))
            + anchors)
    return kit.page(t, head, body, pad='20px 16px 0')


def song_page_tapped(t):
    s = songs(t)[0]
    head = song_header(t, s[0], f'{s[1]} · {s[2]} · {s[3]} BPM')
    body = (kit.button(t, 'Practice with this song', 'secondary', icon_name='play', full=True)
            + live_player(t, 2, pos=12, cur='0:29', total='4:00', anchors=(), playing=True)
            + got_it(t)
            + note(t, 'The count is a guess. Play the song and tap on every “1” you hear until it lines up. · 128 BPM'))
    return kit.page(t, head, body, pad='20px 16px 0')


def song_page_play_first(t):
    s = songs(t)[0]
    head = song_header(t, s[0], f'{s[1]} · {s[2]} · {s[3]} BPM')
    body = (kit.button(t, 'Practice with this song', 'secondary', icon_name='play', full=True)
            + live_player(t, '–', pos=0, cur='0:00', total=s[4], anchors=(2, 31, 58), playing=False)
            .replace(f'color: {t["ink2"]}; font-variant', f'color: {t["chevron"]}; font-variant')
            + kit.button(t, 'Tap on the 1', 'primary', size='lg', full=True)
            + kit.banner(t, 'error', 'Play the song first.', 'A tap marks the beat that is playing.'))
    return kit.page(t, head, body, pad='20px 16px 0')


def song_failed(t):
    head = song_header(t, 'Pedro Navaja', 'Rubén Blades · Salsa')
    body = (kit.banner(t, 'error', 'This song failed', 'Video unavailable')
            + kit.button(t, 'Retry', 'primary', icon_name='refresh', full=True)
            + kit.button(t, 'Upload a file instead', 'secondary', icon_name='upload', full=True)
            + note(t, 'From https://www.youtube.com/watch?v=Kd3Qe0bP2sA'))
    return kit.page(t, head, body, pad='20px 16px 0')


def song_waiting(t):
    head = song_header(t, 'La rebelión', 'Joe Arroyo · Salsa')
    body = (steps(t, [('done', 'Added', 'From YouTube'),
                      ('now', 'Download', 'Waiting for the home fetcher'),
                      ('todo', 'Find the beat', 'Beat analysis on the laptop')])
            + note(t, 'It runs on the laptop about once a minute while it is on. This page updates by itself.'))
    return kit.page(t, head, body, pad='20px 16px 0')


def details_sheet(t):
    s = songs(t)[0]
    inner = (kit.text_field(t, 'Title', s[0], 'Title', 'focused', bg=t['surface'])
             + kit.text_field(t, 'Artist', s[1], 'Artist', 'filled', bg=t['surface'])
             + f'<div style="display: flex; flex-direction: column; gap: 2px; flex: none">{field_label(t, "Style")}'
             + kit.chips(t, styles(t), 0, label='Style', scroll=False) + '</div>'
             + kit.button(t, 'Save', 'primary', full=True, on=t['sheet_bg'])
             + note(t, 'From https://www.youtube.com/watch?v=hT9bF1d1w3c')
             + f'<div style="border-top: 1px solid {t["hairline"]}; padding-top: 6px; display: flex">'
             + kit.button(t, 'Archive song', 'danger_text', icon_name='trash', size='sm', on=t['sheet_bg']) + '</div>')
    return kit.bottom_sheet(t, 'Song details', inner)


def song_details(t):
    return song_page(t, overlay=details_sheet(t))


def song_archive(t):
    s = songs(t)[0]
    dlg = kit.dialog(t, 'Archive this song?', f'{s[0]} leaves Music and the song popup. Sets you logged with it stay.',
                     [kit.button(t, 'Cancel', 'tertiary', size='sm', on=t['raised']),
                      kit.button(t, 'Archive', 'danger', size='sm', on=t['raised'])], icon_name='trash', tone='danger')
    return song_page(t, overlay=dlg)


# ---- the song popup over Practice ------------------------------------------

def song_field(t, s, on=False):
    """SongPicker's closed field: the pick + its meta (opens the popup), and a sibling sample button."""
    return (f'<div style="display: flex; flex-direction: column; gap: 6px; flex: none">{field_label(t, "Song")}'
            f'<div style="display: flex; align-items: center; border-radius: 14px; background: {t["surface"]}; box-shadow: inset 0 0 0 1px {t["field_line"]}; padding-right: 4px">'
            f'<button type="button" aria-haspopup="dialog" style="flex: 1; min-width: 0; min-height: 60px; border: 0; background: none; display: flex; align-items: center; gap: 8px; '
            f'padding: 8px 4px 8px 14px; text-align: left; cursor: pointer; color: {t["ink"]}">'
            f'<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 16px; font-weight: 700">{s[0]}</span>'
            f'<span style="font-size: 13px; color: {t["muted"]}">{meta_of(s)}</span></span>{icon("chevron-down", 20, t["muted"])}</button>'
            f'{sample_btn(t, s[0], on)}</div></div>')


def practice_bg(t, overlay):
    s = songs(t)[0]
    head = kit.band_header(t, 'Practice', left=kit.band_button(t, 'back', 'Back to Music'))
    body = (kit.section_label(t, 'Source') + kit.segmented(t, ['Count only', 'Song'], 1, on_band=False, label='Source')
            + song_field(t, s)
            + kit.section_label(t, 'Speed', 8) + kit.chips(t, ['0.7×', '0.8×', '0.9×', '1×'], 3, label='Speed'))
    return kit.page(t, head, body, pad='22px 16px 0', overlay=overlay)


def popup(t, inner, count_text):
    line = (f'<div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 0 4px; flex: none; '
            f'font-size: 13px; color: {t["muted"]}"><span style="font-weight: 700">{count_text}</span>'
            f'<span style="display: flex; align-items: center; gap: 4px">{icon("play", 12, t["muted"], filled=True)}hear 15 s · tap a song to pick it</span></div>')
    return inner[0], line, inner[1]


def picker_sheet(t, query='', state='empty', sampling=None, picked=None):
    s = songs(t)
    picked = picked or s[0][0]
    search = kit.search_field(t, 'Search songs', query, state)

    def r(x, last, q=None):
        on = x[0] == sampling
        return song_row(t, hl(t, x[0], q) if q else x[0], 'Sample from 1:07' if on else meta_of(x), kind='pick',
                        meta_tone='accent' if on else None, picked=x[0] == picked,
                        sample=sample_btn(t, x[0], on=on, disc_bg=t['accent_soft_pressed'] if x[0] == picked else None), last=last)
    if query:
        hits = sorted([x for x in s if query.lower() in x[0].lower() or query.lower() in x[1].lower()], key=lambda x: x[0])
        if hits:
            lst = group(t, [r(x, i == len(hits) - 1, query) for i, x in enumerate(hits)])
            ct = f'{len(hits)} matches' if len(hits) != 1 else '1 match'
        else:
            lst = kit.empty_state(t, 'search', f'No song matches “{query}”',
                                  'Once it is added and ready, it shows here.',
                                  f'<a href="#" style="font-size: 15px; font-weight: 800; color: {t["accent_text"]}; text-decoration: none; display: inline-flex; '
                                  f'align-items: center; min-height: 44px">Add it in Music</a>')
            ct = '0 matches'
    else:
        rec_names = [x[0] for x in s[:3]]
        rec = s[:3]
        rest = sorted([x for x in s if x[0] not in rec_names], key=lambda x: x[0])
        lst = (kit.section_label(t, 'Recent') + group(t, [r(x, i == 2) for i, x in enumerate(rec)])
               + kit.section_label(t, 'All songs A–Z', 8) + group(t, [r(x, i == len(rest) - 1) for i, x in enumerate(rest)]))
        ct = f'{len(s)} songs'
    line = (f'<div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 0 4px; flex: none; '
            f'font-size: 13px; color: {t["muted"]}"><span style="font-weight: 700">{ct}</span>'
            f'<span style="display: flex; align-items: center; gap: 4px">{icon("play", 12, t["muted"], filled=True)}hear 15 s · tap a song to pick it</span></div>')
    inner = (search + line
             + f'<div style="flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: 8px; margin: 0 -16px -34px; padding: 0 16px">{lst}</div>')
    return kit.bottom_sheet(t, 'Pick a song', inner, height=590)


def popup_sampling(t):
    s = songs(t)
    return practice_bg(t, picker_sheet(t, sampling=s[1][0]))


def popup_search(t):
    return practice_bg(t, picker_sheet(t, 'pro', 'focused', sampling='Promise'))


def popup_nomatch(t):
    return practice_bg(t, picker_sheet(t, 'Cali pachanguero', 'focused'))


# --------------------------------------------------------------------------

SCREENS = [
    ('Music', 'The library: Count only first, then Recent and A–Z. Quimbara is sampling: ■, the ring fills over 15 s, “Sample from 1:07”', music, 'salsa'),
    ('Music · songs being added', 'An upload in progress, then the worker’s states as badges — waiting to download, finding the beat — and a failed song with Retry', music_adding, 'salsa'),
    ('Music · search', 'Matches anywhere in the title or artist, accents and case aside; the match is marked. Failed songs show too', music_search, 'salsa'),
    ('Add a song', 'The + on the band: a YouTube link (focused), an optional title, the style; or upload an audio file instead', music_add, 'salsa'),
    ('Add a song · bad link', 'The link is not a full https:// URL: the field turns red and says so; the typed text stays', music_add_error, 'bachata'),
    ('Add a song · file too large', 'The upload is checked before it starts (95 MB, audio only); the reason shows under the button', music_add_upload_error, 'salsa'),
    ('Music · empty', 'No songs yet: Count only still works; one action to add the first song', music_empty, 'bachata'),
    ('Song', 'Pushed from Music. Listening and tapping the 1: the live count on 1, your 1s as ticks on the timeline', song_page, 'salsa'),
    ('Song · lower down', 'The sample (yours, playing), Start the sample at the playhead, Count speed ×½ ×1 ×2, and your 1s with Remove', song_page_lower, 'salsa'),
    ('Song · tap registered', 'Right after a tap the button says “Got it” for a moment. No 1s yet: the count is a guess', song_page_tapped, 'bachata'),
    ('Song · tapped before playing', 'A tap needs the playhead: “Play the song first.” The count shows – until the song plays', song_page_play_first, 'salsa'),
    ('Song · waiting', 'A song still being added: the three steps, the one in progress spinning. The page polls by itself', song_waiting, 'salsa'),
    ('Song · failed', 'The worker gave up: the reason, Retry, or upload the audio file instead', song_failed, 'salsa'),
    ('Song details', 'The pencil on the band: title (focused), artist, style, Save; the source link; Archive song', song_details, 'salsa'),
    ('Archive song', 'Archive, not delete — asked in the app’s own dialog, never the browser’s confirm()', song_archive, 'salsa'),
    ('Pick a song', 'The song popup over Practice: no keyboard on a phone, Recent then A–Z, the pick tinted, Obsesión sampling', popup_sampling, 'bachata'),
    ('Pick a song · search', 'Typing filters to one flat A–Z list with the match marked; a sample keeps playing while its row is listed', popup_search, 'bachata'),
    ('Pick a song · no match', 'Nothing matches: the typed text stays, with a way to add the song in Music', popup_nomatch, 'salsa'),
]


if __name__ == '__main__':
    html, w, h = kit.artboard('Music', 'The songs library, adding a song, the song page and the song popup — the C4 look, light and dark.',
                              SCREENS, doc_title='S · Music')
    kit.write(OUT, html)
    print(w, h)
