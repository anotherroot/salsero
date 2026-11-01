"""Practice (the player), redrawn in the C4 look.

Source: src/routes/[dance]/player/, src/lib/components/player/ (Setup, SourcePicker,
SongPicker, CountChips, ClaveChips, SongProgress, Running, SaveSetSheet), LiveCount,
the player sections of the design spec and the count-voice spec.

    python3 practice.py OUT.dc.html
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'kit'))
import kit  # noqa: E402

CREAM = kit.CREAM

COUNT = {'salsa': ['1 2 3 · 5 6 7', '2 3 4 · 6 7 8', '1–8', '1 3 5 7', '1 · 5', '1', 'Off'],
         'bachata': ['1 2 3 · 5 6 7', '1–8', '1 3 5 7', '1 · 5', '1', 'Off']}
CLAVE = ['Off', '3-2', '2-3']
CALLS = ['Off', 'Every 1', 'Every 2', 'Every 4']
SPEEDS = ['1×', '0.9×', '0.8×', '0.7×']

SALSA_SLOTS = [('Dile que no', None), ('Enchufla · Doble  /  Enchufla · Basic', None),
               ('Setenta', 'hand change here'), ('Sombrero', None), ('Kentucky', None), ('Dile que no', None)]
BACHATA_SLOTS = [('Body wave', None), ('Hammerlock', 'keep the frame soft'), ('Cuddle turn', None),
                 ('Shadow position', None), ('Media luna', None)]


# --------------------------------------------------------------------------
# new building blocks (from kit tokens only)
# --------------------------------------------------------------------------


def radio_chips(t, items, selected, label, scroll=False):
    """A radiogroup of kit chips (the real CountChips/ClaveChips are radios)."""
    out = ''.join(kit.chip(t, it, i == selected, role='radio') for i, it in enumerate(items))
    lay = 'flex-wrap: nowrap; margin-right: -16px; overflow: hidden; white-space: nowrap' if scroll else 'flex-wrap: wrap; row-gap: 4px'
    return f'<div role="radiogroup" aria-label="{label}" style="display: flex; gap: 8px; {lay}; flex: none">{out}</div>'


def labelled(t, text, inner, top=6):
    """A section label with its control under it."""
    return kit.section_label(t, text, top) + inner


def song_progress(t, pct, cur, total, pad='0'):
    """SongProgress: time, a seekable 6px track with a 16px thumb, length. role=slider."""
    tm = f'font-size: 12px; font-weight: 700; color: {t["muted"]}; font-variant-numeric: tabular-nums; width: 36px; flex: none'
    return (f'<div style="display: flex; align-items: center; gap: 8px; padding: {pad}">'
            f'<span style="{tm}; text-align: right">{cur}</span>'
            f'<div role="slider" tabindex="0" aria-label="Song position" aria-valuemin="0" aria-valuemax="252" aria-valuetext="{cur}" '
            f'style="position: relative; flex: 1; height: 44px">'
            f'<div style="position: absolute; left: 8px; right: 8px; top: 19px; height: 6px; border-radius: 3px; background: {t["hairline"]}">'
            f'<div style="width: {pct}%; height: 6px; border-radius: 3px; background: {t["accent"]}"></div>'
            f'<div style="position: absolute; left: calc({pct}% - 8px); top: -5px; width: 16px; height: 16px; border-radius: 8px; background: {t["accent"]}; '
            f'box-shadow: 0 1px 3px rgba(0,0,0,0.25)"></div></div></div>'
            f'<span style="{tm}">{total}</span></div>')


def song_field(t, title, meta, state='ready', pct=0, cur='0:00', total='4:12'):
    """The SongPicker field: a ▶ that samples the pick, the rest opens "Pick a song";
    under it, once the grid has loaded, SongProgress (seek before Play)."""
    if state == 'error':
        box = f'box-shadow: inset 0 0 0 2px {t["danger"]};'
    else:
        box = ''
    sample = kit.icon_button(t, 'play', f'Play a sample of {title}', 'tonal', filled=True, on=t['surface'])
    head = (f'<div style="display: flex; align-items: center; gap: 12px; padding: 10px 10px 10px 12px">{sample}'
            f'<button type="button" aria-haspopup="dialog" style="flex: 1; min-width: 0; min-height: 44px; border: 0; background: none; padding: 0; display: flex; '
            f'align-items: center; gap: 8px; text-align: left; cursor: pointer; color: {t["ink"]}">'
            f'<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px">'
            f'<span style="font-size: 16px; font-weight: 700; line-height: 1.3">{title}</span>'
            f'<span style="font-size: 13px; color: {t["muted"]}">{meta}</span></span>{kit.icon("chevron-down", 20, t["muted"])}</button></div>')
    prog = ''
    if state == 'ready':
        prog = f'<div style="border-top: 1px solid {t["hairline"]}">{song_progress(t, pct, cur, total, "0 8px 0 4px")}</div>'
    elif state == 'loading':
        prog = (f'<div style="border-top: 1px solid {t["hairline"]}; display: flex; align-items: center; gap: 10px; padding: 12px 16px; '
                f'font-size: 13px; font-weight: 600; color: {t["muted"]}">{kit.spinner(t, 18)}Loading the beat grid…</div>')
    under = ''
    if state == 'error':
        under = (f'<span role="alert" style="display: flex; align-items: flex-start; gap: 6px; padding: 0 4px; font-size: 13px; line-height: 1.4; font-weight: 700; color: {t["danger"]}">'
                 f'{kit.icon("warning", 16, t["danger"], style="margin-top: 1px")}That song could not be loaded. Pick another, or use the count.</span>')
    return (kit.section_label(t, 'Song', 2)
            + f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none; {box}">{head}{prog}</div>' + under)


def play_footer(t, label='Play', state='default'):
    """The pinned Play, over a fade so the settings scroll under it."""
    g = t['ground']
    btn = kit.button(t, label, 'primary', state=state, icon_name='play', size='lg', full=True)
    return (f'<div style="position: absolute; left: 0; right: 0; bottom: 0; padding: 28px 16px 34px; '
            f'background: linear-gradient({kit.rgba(g, 0)}, {g} 34%)">{btn}</div>')


def stop_button(t):
    """Stop: a tonal danger pill, as tall as Pause, so the two never get confused mid-dance."""
    return (f'<button type="button" style="height: 64px; box-sizing: border-box; border-radius: 32px; border: 0; background: {t["danger_soft"]}; '
            f'color: {t["danger"]}; {kit.BRIC}; font-size: 22px; font-weight: 800; padding: 0 24px 0 20px; display: inline-flex; align-items: center; gap: 10px; '
            f'cursor: pointer; flex: none">{kit.icon("stop", 22, t["danger"], filled=True)}Stop</button>')


def transport(t, paused=False):
    pause = (kit.button(t, 'Resume', 'primary', icon_name='play', size='lg', full=True) if paused
             else kit.button(t, 'Pause', 'primary', icon_name='pause', size='lg', full=True))
    return (f'<div style="position: absolute; left: 16px; right: 16px; bottom: 34px; display: flex; gap: 10px">'
            f'{stop_button(t)}<div style="flex: 1; display: flex">{pause}</div></div>')


def live_count(t, n, size=168, paused=False):
    """LiveCount on the band: the number huge in cream; on the 1 it sits in a cream
    disc (the 1 is what you look for across a room); eight dots under it."""
    fs = int(size * 0.82)
    num_css = f'{kit.BRIC}; font-size: {fs}px; line-height: 1; font-weight: 800; letter-spacing: -0.03em; font-variant-numeric: tabular-nums'
    if n == 1 and not paused:
        disc = (f'<span style="width: {size}px; height: {size}px; border-radius: {size // 2}px; background: {CREAM}; display: flex; align-items: center; '
                f'justify-content: center; {num_css}; color: {t["band"]}; box-shadow: 0 10px 30px {t["band_shadow"]}">1</span>')
    else:
        col = kit.rgba(CREAM, 0.6) if paused else CREAM
        disc = (f'<span style="width: {size}px; height: {size}px; display: flex; align-items: center; justify-content: center; {num_css}; color: {col}">'
                f'{n}</span>')
    dots = ''
    for i in range(1, 9):
        if i == n:
            d, c = 16, (kit.rgba(CREAM, 0.6) if paused else CREAM)
        else:
            d, c = 10, kit.rgba(CREAM, 0.2 if i in (4, 8) else 0.36)
        dots += f'<span style="width: {d}px; height: {d}px; border-radius: {d}px; background: {c}; flex: none"></span>'
    return (f'<div aria-live="off" style="display: flex; flex-direction: column; align-items: center; gap: 12px">'
            f'<span role="img" aria-label="Count {n}" style="display: flex">{disc}</span>'
            f'<span aria-hidden="true" style="height: 16px; display: flex; align-items: center; gap: 10px">{dots}</span></div>')


def stage_header(t, title, subtitle, back, n, call=None, clock='2:14', paused=False, size=160, bottom=50):
    """The running band: back + compact title, the run's settings, then the stage —
    the live count, the figure being called, the elapsed time (or Paused)."""
    lead = (f'<div style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 4px; margin-left: -10px">'
            f'{kit.band_button(t, "back", back)}{kit.band_title(t, title, tall=False)}</div>')
    sub = f'<span style="padding-left: 38px; {kit.ts("subtitle", t["band_small"])}">{subtitle}</span>'
    callh = ''
    if call is not None:
        callh = (f'<p aria-live="polite" style="margin: 0; min-height: 36px; text-align: center; {kit.BRIC}; font-size: 32px; line-height: 1.1; '
                 f'font-weight: 800; letter-spacing: -0.01em; color: {CREAM}">{call}</p>')
    if paused:
        meta = (f'<span style="height: 30px; padding: 0 14px 0 10px; border-radius: 15px; box-shadow: inset 0 0 0 1.5px {CREAM}; color: {CREAM}; '
                f'display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 800; font-variant-numeric: tabular-nums">'
                f'{kit.icon("pause", 16, CREAM, filled=True)}Paused · {clock}</span>')
    else:
        meta = f'<span style="height: 30px; display: flex; align-items: center; font-size: 16px; font-weight: 700; color: {t["band_small"]}; font-variant-numeric: tabular-nums">{clock}</span>'
    stage = (f'<div style="margin-top: 8px; display: flex; flex-direction: column; align-items: center; gap: 10px">'
             f'{live_count(t, n, size, paused)}{callh}{meta}</div>')
    return (f'<header style="background: {t["band"]}; padding: 22px 20px {bottom}px; display: flex; flex-direction: column; gap: 6px; flex: none">'
            f'<div style="display: flex; align-items: center; gap: 12px">{lead}</div>{sub}{stage}</header>')


def slot_list(t, slots, active, rows_visible=2.5):
    """The routine as danced, the current slot scrolled to the top of its own list."""
    rh = 48
    items = ''
    for i, (name, note) in enumerate(slots):
        if i < active:
            continue  # scrolled out of view above
        on = i == active
        bg = t['accent_soft'] if on else 'transparent'
        nc = t['accent_text'] if on else t['muted']
        tc = t['accent_text'] if on else t['ink2']
        fw = 800 if on else 600
        cur = ' aria-current="step"' if on else ''
        nt = f'<span style="display: block; font-size: 12px; font-weight: 600; color: {t["muted"] if not on else t["accent_text"]}">{note}</span>' if note else ''
        items += (f'<li{cur} style="background: {bg}; padding-left: 14px; list-style: none">'
                  f'<div style="display: flex; align-items: center; gap: 12px; min-height: {rh}px; padding: 6px 14px 6px 0; box-sizing: border-box; border-bottom: 1px solid {t["hairline"]}">'
                  f'<span style="width: 18px; flex: none; font-size: 13px; font-weight: 800; color: {nc}; font-variant-numeric: tabular-nums">{i + 1}</span>'
                  f'<span style="flex: 1; min-width: 0; font-size: 15px; line-height: 1.3; font-weight: {fw}; color: {tc}">{name}{nt}</span>'
                  + (kit.badge(t, 'Now', 'accent', solid=True) if on else '') + '</div></li>')
    h = int(rh * rows_visible) + (10 if any(s[1] for s in slots[active:active + 3]) else 0)
    return (f'<ol aria-label="Routine" style="margin: 0; padding: 0; height: {h}px; overflow: hidden; background: {t["surface"]}; border-radius: 16px; flex: none; '
            f'-webkit-mask-image: linear-gradient(#000 70%, transparent); mask-image: linear-gradient(#000 70%, transparent)">{items}</ol>')


def voice_card(t, dance, count_sel, vol, scroll=True):
    """Mid-run: the count pattern and the voice volume, both adjustable while it plays."""
    chips = radio_chips(t, COUNT[dance], count_sel, 'Voice count', scroll=scroll)
    return (kit.section_label(t, 'Voice', 4)
            + f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">'
            f'<div style="padding: 6px 0 6px 12px">{chips}</div>'
            f'<div style="border-top: 1px solid {t["hairline"]}; padding: 10px 16px">{kit.slider(t, vol, "Voice volume", framed=False)}</div></div>')


def voice_row(t, value='Built-in'):
    """Voice: built-in clips, or the user's own takes when they exist (derived, not a choice).
    The row goes to My count (/voice), where the user records their own."""
    return kit.row(t, 'Voice', 'Record your own count', trailing=kit.row_value(t, value) + kit.chevron(t), href='#', min_h=58)


# --------------------------------------------------------------------------
# setup
# --------------------------------------------------------------------------


def setup_header(t, source, subtitle=None, back='Back'):
    return kit.band_header(t, 'Practice', subtitle, left=kit.band_button(t, 'back', back),
                           extra=kit.segmented(t, ['Count only', 'A song'], source, on_band=True, label='Source'))


def tempo_group(t, bpm, dance_voice='Built-in'):
    return kit.list_group(t, [kit.stepper_row(t, bpm, 'Tempo', 'BPM'), voice_row(t, dance_voice)])


def setup_count(t, overlay='', play_state='default', banner=''):
    body = (banner + tempo_group(t, 180)
            + labelled(t, 'Voice count', radio_chips(t, COUNT['salsa'], 0, 'Voice count'))
            + labelled(t, 'Clave', radio_chips(t, CLAVE, 1, 'Clave'))
            + labelled(t, 'Voice volume', kit.slider(t, 80, 'Voice volume')))
    return kit.page(t, setup_header(t, 0, back='Back to Music'), body, footer=play_footer(t, state=play_state), overlay=overlay)


def setup_song(t, state='ready', play_state='default', banner=''):
    play = play_footer(t, 'Starting…' if play_state == 'loading' else 'Play',
                       'disabled' if state == 'error' else play_state)
    field = song_field(t, 'Vivir mi vida', 'Salsa · 96 BPM · 4:12', state, pct=0 if play_state == 'default' else 9,
                       cur='0:00' if play_state == 'default' else '0:24')
    body = (banner + field
            + labelled(t, 'Speed', radio_chips(t, SPEEDS, 1, 'Speed'), 8)
            + labelled(t, 'Voice count', radio_chips(t, COUNT['salsa'], 0, 'Voice count'))
            + labelled(t, 'Clave', radio_chips(t, CLAVE, 1, 'Clave'))
            + kit.list_group(t, [voice_row(t)])
            + labelled(t, 'Voice volume', kit.slider(t, 80, 'Voice volume')))
    return kit.page(t, setup_header(t, 1, back='Back to Vivir mi vida'), body, footer=play)


def setup_song_failed(t):
    return setup_song(t, 'error')


def setup_starting(t):
    return setup_song(t, 'ready', 'loading')


def setup_start_error(t):
    return setup_count(t, banner=kit.banner(t, 'error', 'Could not start the player.', 'Nothing is playing. Tap Play to try again.'))


def setup_routine(t):
    body = (tempo_group(t, 180)
            + labelled(t, 'Calls · a figure every 1, 2 or 4 eights', radio_chips(t, CALLS, 2, 'Calls'))
            + labelled(t, 'Voice count', radio_chips(t, COUNT['salsa'], 0, 'Voice count'))
            + labelled(t, 'Clave', radio_chips(t, CLAVE, 1, 'Clave'))
            + labelled(t, 'Voice volume', kit.slider(t, 80, 'Voice volume')))
    return kit.page(t, setup_header(t, 0, 'Casino basics · 6 figures', back='Back to Casino basics'), body, footer=play_footer(t))


def setup_bachata(t):
    note = kit.banner(t, 'info', 'Its song is not ready', 'Pick another, or use the count.', dismiss=False)
    body = (note + tempo_group(t, 128, 'Yours')
            + labelled(t, 'Voice count', radio_chips(t, COUNT['bachata'], 0, 'Voice count'))
            + labelled(t, 'Voice volume', kit.slider(t, 80, 'Voice volume')))
    return kit.page(t, setup_header(t, 0, back='Back to Today'), body, footer=play_footer(t))


# --------------------------------------------------------------------------
# running
# --------------------------------------------------------------------------


def running_page(t, header, body):
    return kit.phone(t, header + kit.sheet(t, body, '16px 16px 0') + transport(t, header.count('Paused ·') > 0))


def running_routine_song(t, paused=False):
    n = 6 if paused else 1
    header = stage_header(t, 'Vivir mi vida', 'Casino basics · 0.9× · clave 3-2', 'Stop and go back', n,
                          call='Enchufla · Doble', clock='1:42', paused=paused, size=136, bottom=46)
    body = (song_progress(t, 40, '1:42', '4:12', '0')
            + slot_list(t, SALSA_SLOTS, 1)
            + voice_card(t, 'salsa', 0, 80))
    return running_page(t, header, body)


def running_paused(t):
    return running_routine_song(t, paused=True)


def running_count(t):
    header = stage_header(t, 'Practice', '180 BPM · clave 2-3', 'Stop and go back', 5, call=None, clock='3:08', size=230, bottom=56)
    body = voice_card(t, 'salsa', 3, 70, scroll=False)
    return running_page(t, header, body)


def running_bachata(t):
    header = stage_header(t, 'Practice', 'Sensual flow · 128 BPM', 'Stop and go back', 4, call='Hammerlock', clock='0:52', size=176)
    body = slot_list(t, BACHATA_SLOTS, 1, 2.6) + voice_card(t, 'bachata', 0, 80)
    return running_page(t, header, body)


# --------------------------------------------------------------------------
# finished: Save this run
# --------------------------------------------------------------------------


def rating(t, value, label='How did it go?'):
    """1–5, filled up to the pick (tap the pick again to clear it). aria-pressed buttons."""
    out = ''
    for n in range(1, 6):
        on = value is not None and n <= value
        bg = t['accent'] if on else t['surface']
        fg = t['on_accent'] if on else t['ink2']
        sh = '' if on else f'box-shadow: inset 0 0 0 1px {t["field_line"]};'
        out += (f'<button type="button" aria-pressed="{"true" if value == n else "false"}" style="flex: 1; height: 48px; border: 0; border-radius: 14px; '
                f'background: {bg}; color: {fg}; {sh} font-size: 17px; font-weight: 800; cursor: pointer">{n}</button>')
    return (f'<fieldset style="margin: 0; padding: 0; border: 0; min-width: 0; flex: none; display: flex; flex-direction: column; gap: 6px">'
            f'<legend style="{kit.ts("label", t["ink2"])}; padding: 0 0 6px 4px">{label}</legend>'
            f'<div style="display: flex; gap: 8px">{out}</div></fieldset>')


def save_sheet(t, sub, exercise=None, picked=None, rate=None, note='', error=None):
    if exercise:
        ex = (f'<div style="display: flex; flex-direction: column; gap: 6px; flex: none"><span style="{kit.ts("label", t["ink2"])}; padding-left: 4px">Exercise</span>'
              + kit.list_group(t, [dict(title=exercise[0], meta=exercise[1], min_h=56,
                                        leading=kit.icon('check-circle', 24, t['accent'], filled=True, bg=t['on_accent']))]) + '</div>')
    else:
        ex = kit.select_field(t, 'Exercise', picked or '', 'Choose an exercise…', 'filled' if picked else 'empty', bg=t['surface'])
    inner = ex + rating(t, rate) + kit.textarea(t, 'Note', note, 'Anything to remember?', 'filled' if note else 'empty', rows=2, optional=True, bg=t['surface'])
    if error:
        inner += kit.banner(t, 'error', error)
    can = bool(exercise or picked)
    foot = (f'<div style="display: flex; gap: 8px; align-items: center">{kit.button(t, "Don’t save", "tertiary", on=t["sheet_bg"])}'
            f'<div style="flex: 1; display: flex">{kit.button(t, "Save", "primary", "default" if can else "disabled", full=True, on=t["sheet_bg"])}</div></div>')
    return kit.bottom_sheet(t, 'Save this run', inner, foot, sub=sub, gap=14)


def done_from_exercise(t):
    return setup_count(t, overlay=save_sheet(t, '3:42 · 12 figures called · logged as a set', ('Enchufla · Doble', 'Partner · every 3 days'),
                                             rate=4, note='Doble felt late on the 5. Slow it down next time.'))


def done_from_song(t):
    return setup_count(t, overlay=save_sheet(t, '4:12 · logged as a set'))


def setup_count_bachata_bg(t, overlay=''):
    body = (tempo_group(t, 128, 'Yours')
            + labelled(t, 'Voice count', radio_chips(t, COUNT['bachata'], 0, 'Voice count'))
            + labelled(t, 'Voice volume', kit.slider(t, 80, 'Voice volume')))
    return kit.page(t, setup_header(t, 0, back='Back to Today'), body, footer=play_footer(t), overlay=overlay)


def done_failed(t):
    return setup_count_bachata_bg(t, save_sheet(t, '5:06 · 9 figures called · logged as a set', picked='Hammerlock · Basic', rate=3,
                                               note='Arms too stiff.', error='That exercise no longer exists.'))


def done_unsaved(t):
    dlg = kit.dialog(t, 'Unsaved changes', 'This run is not saved yet.', [
        kit.button(t, 'Save', 'primary', full=True, on=t['raised']),
        kit.button(t, 'Stay', 'secondary', full=True, on=t['raised']),
        kit.button(t, 'Close without saving', 'danger_text', full=True, on=t['raised'])])
    return setup_count(t, overlay=save_sheet(t, '3:42 · 12 figures called · logged as a set', ('Enchufla · Doble', 'Partner · every 3 days'), rate=4) + dlg)


SCREENS = [
    ('Setup · count only', 'Source on the band. Tempo, voice (links to My count), count pattern, clave, voice volume. Play pinned.', setup_count, 'salsa'),
    ('Setup · a song', 'The song field: ▶ samples it, the rest opens Pick a song. Seek bar before Play; speed instead of tempo.', setup_song, 'salsa'),
    ('Setup · a routine', 'Opened from a routine: its name and size on the band; Calls appear only here (default every 2).', setup_routine, 'salsa'),
    ('Running · routine to a song', 'The stage: count on the 1 (cream disc), the figure being called, time. Next slots, voice mid-run.', running_routine_song, 'salsa'),
    ('Running · count only', 'No song, no routine: the count fills the band. Count pattern and volume stay adjustable.', running_count, 'salsa'),
    ('Paused', 'Holds the run in place: dimmed count, Paused pill, Resume. Stop stays where it was.', running_paused, 'salsa'),
    ('Running · bachata', 'A routine at 128 BPM, count only. No clave anywhere in bachata; no son pattern.', running_bachata, 'bachata'),
    ('Setup · bachata', 'From an exercise whose remembered song is no longer ready. Voice is the user’s own takes.', setup_bachata, 'bachata'),
    ('Starting…', 'Play pressed: Starting… until the clips decode, so a second tap cannot build a second player.', setup_starting, 'salsa'),
    ('Song failed to load', 'The grid fetch failed: the field in error, the message under it, Play disabled.', setup_song_failed, 'salsa'),
    ('Could not start', 'The player threw on start (audio context, clips): an error banner, Play is live again.', setup_start_error, 'salsa'),
    ('Save this run · from an exercise', 'The run ended (Stop, song end): logged as a set on its exercise, with a rating and a note.', done_from_exercise, 'salsa'),
    ('Save this run · from a song', 'Opened from Music, no exercise yet: pick one (the shared picker). Save waits for it.', done_from_song, 'salsa'),
    ('Save failed', 'What was entered is kept; the server’s message as an error banner.', done_failed, 'bachata'),
    ('Unsaved changes', '✕, the scrim, Back or a navigation ask first. Don’t save is the one way out that does not.', done_unsaved, 'salsa'),
]


if __name__ == '__main__':
    html, w, h = kit.artboard('Practice · the player', 'Setup for each source, the running stage, paused, errors, and Save this run — salsa and bachata, light and dark.',
                              SCREENS, per_row=3, doc_title='Practice')
    kit.write(sys.argv[1], html)
    print(w, h)
