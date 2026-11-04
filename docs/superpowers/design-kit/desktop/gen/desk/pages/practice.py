"""Practice on desktop: no side; setup in one column (640) with Play pinned; running splits the
window under the band row: the stage on the band to the left, a 520 px sheet column on the right."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _pss as P  # noqa: E402
from _pss import F, kit, ts, icon, CREAM  # noqa: E402

MP = P.mobile('practice')
MU = P.mobile('music')
MA = P.area('music')  # the class playlist (CLASS)

SECTION = ('practice', 'Practice')

# A slot names a figure by its label, "Move · Figure" (figureLabels), since the rename.
SLOTS = [('Dile que no · Basic', None), ('Enchufla · Doble', 'or Enchufla · Basic'), ('Setenta · Basic', 'hand change here'),
         ('Sombrero · Basic', None), ('Kentucky · Basic', None), ('Dile que no · Basic', None)]
BACHATA_SLOTS = [('Body wave · Basic', None), ('Hammerlock · Basic', 'keep the frame soft'), ('Cuddle turn · Basic', None),
                 ('Shadow · Open', None), ('Media luna · Basic', None), ('Body wave · Basic', None)]
COL = 640


def dance(t):
    return t['dance']


def song(t):
    return MU.songs(t)[0]


def routine_name(t):
    return 'Casino basics' if dance(t) == 'salsa' else 'Sensual flow'


def chips(t, items, sel, lab):
    return MP.radio_chips(t, items, sel, lab)


def play_bar(t, label='Play', state='default'):
    return F.pinned(t, kit.button(t, label, 'primary', state=state, icon_name='play', size='lg', full=True), max_w=COL)


def clave(t):
    return MP.labelled(t, 'Clave', chips(t, MP.CLAVE, 1, 'Clave')) if dance(t) == 'salsa' else ''


def setup(t, src, sub, back, body, overlay=''):
    return F.frame(t, None, 'Practice', F.page(body, max_w=COL, footer=play_bar(t)), sub=sub, back=F.back_btn(t, back),
                   center=F.seg(t, ['Count only', 'A song'], src, 'Source'), side=False, overlay=overlay)


def setup_count_body(t):
    bpm = 180 if dance(t) == 'salsa' else 128
    return (MP.tempo_group(t, bpm)
            + MP.labelled(t, 'Voice count', chips(t, MP.COUNT[dance(t)], 0, 'Voice count'))
            + clave(t)
            + MP.labelled(t, 'Voice volume', kit.slider(t, 80, 'Voice volume')))


def setup_count(t, overlay=''):
    return setup(t, 0, None, 'Music', setup_count_body(t), overlay)


def setup_song_body(t):
    s = song(t)
    return (MP.song_field(t, s[0], MU.meta_of(s), 'ready', pct=0, cur='0:00', total=s[4])
            + MP.labelled(t, 'Speed', chips(t, MP.SPEEDS, 1, 'Speed'), 8)
            + MP.labelled(t, 'Calls · a figure every 1, 2 or 4 eights', chips(t, MP.CALLS, 2, 'Calls'))
            + MP.labelled(t, 'Voice count', chips(t, MP.COUNT[dance(t)], 0, 'Voice count'))
            + clave(t)
            + kit.list_group(t, [MP.voice_row(t)])
            + MP.labelled(t, 'Voice volume', kit.slider(t, 80, 'Voice volume')))


def setup_song(t, overlay=''):
    sub = f'{routine_name(t)} · 6 figures'
    return setup(t, 1, sub, routine_name(t), setup_song_body(t), overlay)


# --------------------------------------------------------------------------
# running: stage left on the band, sheet column right
# --------------------------------------------------------------------------

SHEET_W = 520


def slot_list(t, slots, active):
    """The whole routine; slots already danced are muted, the current one tinted with Now."""
    items = ''
    for i, (name, note) in enumerate(slots):
        on = i == active
        past = i < active
        bg = t['accent_soft'] if on else 'transparent'
        nc = t['accent_text'] if on else t['muted']
        tc = t['accent_text'] if on else (t['muted'] if past else t['ink2'])
        fw = 800 if on else 600
        cur = ' aria-current="step"' if on else ''
        nt = (f'<span style="display: block; font-size: 12px; font-weight: 600; color: {t["accent_text"] if on else t["muted"]}">{note}</span>'
              if note else '')
        hair = '' if i == len(slots) - 1 else f'border-bottom: 1px solid {t["hairline"]};'
        items += (f'<li{cur} style="background: {bg}; padding-left: 16px; list-style: none">'
                  f'<div style="display: flex; align-items: center; gap: 12px; min-height: 50px; padding: 6px 14px 6px 0; box-sizing: border-box; {hair}">'
                  f'<span style="width: 18px; flex: none; font-size: 13px; font-weight: 800; color: {nc}; font-variant-numeric: tabular-nums">{i + 1}</span>'
                  f'<span style="flex: 1; min-width: 0; font-size: 15px; line-height: 1.3; font-weight: {fw}; color: {tc}">{name}{nt}</span>'
                  + (kit.badge(t, 'Now', 'accent', solid=True) if on else '') + '</div></li>')
    return (kit.section_label(t, f'Routine · slot {active + 1} of {len(slots)}', 4)
            + f'<ol aria-label="Routine" style="margin: 0; padding: 0; background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">{items}</ol>')


def big_dots(html):
    """The phone's eight dots, scaled for the desktop stage (16/10 px -> 22/14 px)."""
    return (html.replace('gap: 12px', 'gap: 26px').replace('height: 16px; display: flex; align-items: center; gap: 10px', 'height: 22px; display: flex; align-items: center; gap: 16px')
            .replace('width: 16px; height: 16px; border-radius: 16px', 'width: 22px; height: 22px; border-radius: 22px')
            .replace('width: 10px; height: 10px; border-radius: 10px', 'width: 14px; height: 14px; border-radius: 14px'))


def stage(t, n, call, clock, paused):
    """The count as big as the height allows (240), the 1 as a cream disc, eight dots, the call, the time."""
    callh = (f'<p aria-live="polite" style="margin: 0; min-height: 52px; text-align: center; {kit.BRIC}; font-size: 44px; line-height: 1.15; '
             f'font-weight: 800; letter-spacing: -0.01em; color: {CREAM}">{call}</p>') if call is not None else ''
    if paused:
        meta = (f'<span style="height: 36px; padding: 0 16px 0 12px; border-radius: 18px; box-shadow: inset 0 0 0 1.5px {CREAM}; color: {CREAM}; '
                f'display: inline-flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums">'
                f'{icon("pause", 18, CREAM, filled=True)}Paused · {clock}</span>')
    else:
        meta = (f'<span style="height: 36px; display: flex; align-items: center; font-size: 20px; font-weight: 700; color: {t["band_small"]}; '
                f'font-variant-numeric: tabular-nums">{clock}</span>')
    return (f'<section aria-label="Count" style="position: absolute; top: {F.ROW_H}px; left: 0; right: {SHEET_W}px; bottom: 0; '
            f'display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px; padding-bottom: 40px">'
            f'{big_dots(MP.live_count(t, n, 240, paused))}{callh}{meta}</section>')


def side_sheet(t, body, footer):
    return (f'<main style="position: absolute; top: {F.ROW_H}px; right: 0; bottom: 0; width: {SHEET_W}px; background: {t["ground"]}; '
            f'border-radius: 28px 0 0 0; overflow: hidden; display: flex; flex-direction: column">'
            f'<div style="flex: 1; min-height: 0; overflow: hidden; padding: 24px 28px 20px; display: flex; flex-direction: column; gap: 8px">{body}</div>'
            f'{footer}</main>')


def transport(t, paused):
    pause = (kit.button(t, 'Resume', 'primary', icon_name='play', size='lg', full=True) if paused
             else kit.button(t, 'Pause', 'primary', icon_name='pause', size='lg', full=True))
    return (f'<div style="flex: none; border-top: 1px solid {t["hairline"]}; padding: 14px 28px 22px; display: flex; gap: 10px">'
            f'{MP.stop_button(t)}<div style="flex: 1; display: flex">{pause}</div></div>')


def running(t, paused=False):
    salsa = dance(t) == 'salsa'
    s = song(t)
    n = 6 if paused else 1
    slots = SLOTS if salsa else BACHATA_SLOTS
    sub = f'{routine_name(t)} · {s[0]} · 0.9×' + (' · clave 3-2' if salsa else '')
    head = F.band_row(t, 'Practice', sub, kit.band_button(t, 'back', 'Stop and go back'), side=False)
    body = (MP.song_progress(t, 40, '1:42', s[4], '0')
            + slot_list(t, slots, 1)
            + MP.voice_card(t, dance(t), 0, 80, scroll=False))
    call = 'Enchufla · Doble' if salsa else 'Hammerlock · Basic'
    return F.root(t, head + stage(t, n, call, '1:42', paused) + side_sheet(t, body, transport(t, paused)))


# --------------------------------------------------------------------------
# dialogs
# --------------------------------------------------------------------------

def save_run(t):
    salsa = dance(t) == 'salsa'
    ex = ('Enchufla · Doble', 'Partner · every 3 days') if salsa else ('Hammerlock · Basic', 'Partner · every 3 days')
    exh = (f'<div style="display: flex; flex-direction: column; gap: 6px; flex: none"><span style="{ts("label", t["ink2"])}; padding-left: 4px">Exercise</span>'
           + kit.list_group(t, [dict(title=ex[0], meta=ex[1], min_h=56,
                                     leading=icon('check-circle', 24, t['accent'], filled=True, bg=t['on_accent']))]) + '</div>')
    inner = (exh + MP.rating(t, 4)
             + kit.textarea(t, 'Note', 'Doble felt late on the 5. Slow it down next time.', 'Anything to remember?', 'filled', rows=3, optional=True, bg=t['surface']))
    foot = (f'<div style="display: flex; gap: 8px; align-items: center">{kit.button(t, "Don’t save", "tertiary", on=t["sheet_bg"])}'
            f'<div style="flex: 1; display: flex">{kit.button(t, "Save", "primary", full=True, on=t["sheet_bg"])}</div></div>')
    dlg = F.dialog(t, 'Save this run', inner, sub='3:42 · 12 figures called · logged as a set', footer=foot)
    return F.frame(t, None, 'Practice', F.page(setup_count_body(t), max_w=COL, footer=play_bar(t)), back=F.back_btn(t, 'Today'),
                   center=F.seg(t, ['Count only', 'A song'], 0, 'Source'), side=False, overlay=dlg)


def song_picker(t, klass=False):
    """The song popup as a dialog. klass: a group's drill; the list is drawn scrolled to the group's shared songs."""
    s = MU.songs(t)
    gname, gsongs, _ = MA.klass(t)
    picked = gsongs[0][0] if klass else song(t)[0]
    sampling = None if klass else s[1][0]

    def r(x, last):
        on = x[0] == sampling
        return MU.song_row(t, x[0], 'Sample from 1:07' if on else f'{x[1]} · ' + MU.meta_of(x), kind='pick',
                           meta_tone='accent' if on else None, picked=x[0] == picked,
                           sample=MU.sample_btn(t, x[0], on=on, disc_bg=t['accent_soft_pressed'] if x[0] == picked else None), last=last)
    rec = s[:3]
    rest = sorted([x for x in s if x not in rec], key=lambda x: x[0])
    own = 'Your songs' if klass else 'All songs A–Z'
    lst = (kit.section_label(t, 'Recent') + MU.group(t, [r(x, i == 2) for i, x in enumerate(rec)])
           + kit.section_label(t, own, 8) + MU.group(t, [r(x, i == len(rest) - 1) for i, x in enumerate(rest)]))
    if klass:
        lst += kit.section_label(t, gname, 8) + MU.group(t, [r(x, i == len(gsongs) - 1) for i, x in enumerate(gsongs)])
        lst = f'<div style="display: flex; flex-direction: column; gap: 8px; margin-top: -560px">{lst}</div>'
    n = len(s) + (len(gsongs) if klass else 0)
    line = (f'<div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 0 4px; flex: none; '
            f'font-size: 13px; color: {t["muted"]}"><span style="font-weight: 700">{n} songs</span>'
            f'<span style="display: flex; align-items: center; gap: 4px">{icon("play", 12, t["muted"], filled=True)}hear 15 s · click a song to pick it</span></div>')
    inner = (kit.search_field(t, 'Search songs', '', 'focused') + line
             + f'<div style="flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: 8px; '
               f'-webkit-mask-image: linear-gradient(#000 88%, transparent); mask-image: linear-gradient(#000 88%, transparent)">{lst}</div>')
    dlg = F.dialog(t, 'Pick a song', inner, height=760)
    if not klass:
        return setup_song(t, overlay=dlg)
    g = gsongs[0]
    body = (MP.song_field(t, g[0], MU.meta_of(g), 'ready', pct=0, cur='0:00', total=g[4])
            + MP.labelled(t, 'Speed', chips(t, MP.SPEEDS, 1, 'Speed'), 8)
            + MP.labelled(t, 'Voice count', chips(t, MP.COUNT[dance(t)], 0, 'Voice count'))
            + clave(t)
            + MP.labelled(t, 'Voice volume', kit.slider(t, 80, 'Voice volume')))
    drill = 'Shines on the 1' if dance(t) == 'salsa' else 'Basic with hip action'
    return setup(t, 1, f'{drill} · {gname}', 'Today', body, overlay=dlg)


BOARDS = [
    F.Board('setup-count', 'Practice · count only', setup_count,
            'No side, as the phone has no tab bar here; the sheet is rounded at both top corners. One column at 640, Play pinned at the bottom of the sheet.'),
    F.Board('setup-song', 'Practice · a song, opened from a routine', setup_song,
            'The routine is the subtitle beside the title; Count only | A song centred over the sheet. Calls appear only for a routine.'),
    F.Board('running', 'Practice · running', running,
            'The phone-on-its-side layout made big: the stage on the band (count up to 240 px, the 1 as a cream disc) and a 520 px sheet on the right. '
            'My call: the whole routine is listed, danced slots muted, since there is room; the phone scrolls the current slot to the top.'),
    F.Board('paused', 'Practice · paused', lambda t: running(t, paused=True),
            'The count dims and the time becomes “Paused · 1:42”; Pause becomes Resume. Stop stays where it was.'),
    F.Board('save-run', 'Practice · Save this run', save_run,
            'A dialog (4B) over the setup it returns to. Don’t save and Save in the footer.'),
    F.Board('song-picker', 'Practice · Pick a song', song_picker,
            'The song popup as a dialog. Its search is focused when it opens (desktop has no on-screen keyboard to pop up). A row samples on ▶, picks on a click.'),
    F.Board('song-picker-class', 'Practice · a group’s drill, picking a class song', lambda t: song_picker(t, klass=True),
            'A drill Added from a group lesson starts with no song. The popup lists Recent, Your songs, then each group’s shared songs '
            '(drawn scrolled down to them). If the teacher stops sharing it, the practice falls back to count only.'),
]
