"""Today, redrawn in the C4 look: every band, the session, past days, empty/loading, New exercise.

    python3 today.py  -> canvas/project/S-today.dc.html
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
S = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(S, 'gen', 'kit'))
import kit  # noqa: E402
from kit import icon, ts  # noqa: E402

OUT = os.path.join(S, 'canvas', 'project', 'S-today.dc.html')

# --------------------------------------------------------------------------
# local building blocks (all from kit tokens)
# --------------------------------------------------------------------------

KINDS = {  # type -> (icon, accessible name)
    'partner': ('people', 'Figure, partner'),
    'solo': ('solo', 'Figure, solo'),
    'routine': ('route', 'Routine'),
    'lesson': ('lessons', 'Lesson review'),
    'drill': ('metronome', 'Drill'),
}


def type_tile(t, kind, tone='accent'):
    """40px rounded tile with the exercise's type glyph. tone: accent | quiet | done."""
    name, lab = KINDS.get(kind, ('check-circle', 'Done'))
    if tone == 'done':
        return (f'<span role="img" aria-label="Done today" style="width: 40px; height: 40px; border-radius: 12px; background: {t["done_soft"]}; '
                f'display: flex; align-items: center; justify-content: center; flex: none">{kit.done_check(t, 24)}</span>')
    bg, fg = (t['accent_soft'], t['accent_text']) if tone == 'accent' else (t['chip'], t['muted'])
    return (f'<span role="img" aria-label="{lab}" style="width: 40px; height: 40px; border-radius: 12px; background: {bg}; '
            f'display: flex; align-items: center; justify-content: center; flex: none">{icon(name, 22, fg)}</span>')


def dots(t, n):
    """Last rating as five 6px dots (filled up to n)."""
    d = ''.join(f'<span style="width: 6px; height: 6px; border-radius: 3px; background: {t["accent"] if i < n else t["field_line"]}"></span>'
                for i in range(5))
    return (f'<span role="img" aria-label="Last rated {n} of 5" style="display: inline-flex; gap: 3px; vertical-align: middle; '
            f'margin-left: 6px; position: relative; top: -1px">{d}</span>')


def sep():
    return ' · '


def ex_row(t, name, meta, kind, band='due', rating=None, last=False, nxt=False):
    """A Today row: the body is a link to the exercise page, the + beside it opens the log popup.
    band: due | upcoming | done | inactive. nxt: the session's next row (tinted + 'Up next')."""
    hair = '' if last else f'border-bottom: 1px solid {t["hairline"]};'
    tone = {'due': 'accent', 'upcoming': 'quiet', 'inactive': 'quiet', 'done': 'done'}[band]
    if nxt:
        tone = 'accent'
    tc = {'inactive': t['muted'], 'done': t['ink']}.get(band, t['ink'])
    m = meta + (dots(t, rating) if rating else '')
    badge = (' ' + kit.badge(t, 'Up next', 'accent', solid=True).replace('display: inline-flex', 'display: inline-flex; vertical-align: 2px; margin-left: 4px')) if nxt else ''
    plus_col = t['done'] if band == 'done' else t['accent']
    plus = kit.icon_button(t, 'plus', f'Log a set of {name}', 'bare', color=plus_col)
    bg = t['accent_soft'] if nxt else 'transparent'
    return (f'<div style="padding-left: 16px; background: {bg}"><div style="display: flex; align-items: center; min-height: 66px; box-sizing: border-box; '
            f'padding-right: 6px; {hair}">'
            f'<a href="#" style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; padding: 10px 4px 10px 0; text-decoration: none; color: {tc}">'
            f'{type_tile(t, kind, tone)}'
            f'<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px">'
            f'<span style="font-size: 16px; line-height: 1.3; font-weight: 700; color: {tc}">{name}{badge}</span>'
            f'<span style="font-size: 13px; line-height: 1.35; color: {t["muted"]}">{m}</span></span></a>{plus}</div></div>')


def st(t, text):
    """Status text inside a meta line (overdue / never done)."""
    return f'<span style="color: {t["status"]}; font-weight: 700">{text}</span>'


def done_txt(t, text):
    return f'<span style="color: {t["done"]}; font-weight: 700">{text}</span>'


def group(t, rows):
    return f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">{"".join(rows)}</div>'


def fold_header(t, text, open_=False):
    """The Inactive band's header: a full-width button that folds the band open/closed."""
    return (f'<button type="button" aria-expanded="{"true" if open_ else "false"}" style="display: flex; align-items: center; justify-content: space-between; '
            f'width: 100%; min-height: 44px; margin-top: 6px; border: 0; background: none; padding: 0 8px 0 16px; cursor: pointer; flex: none">'
            f'<span style="{ts("label", t["muted"])}">{text}</span>{icon("chevron-up" if open_ else "chevron-down", 20, t["muted"])}</button>')


def band_pill(t, text, icon_name):
    """A small cream pill button on the band (44px hit area, 32px pill)."""
    return (f'<button type="button" style="height: 44px; border: 0; background: none; padding: 0; display: inline-flex; align-items: center; cursor: pointer">'
            f'<span style="height: 32px; padding: 0 14px 0 10px; border-radius: 16px; background: {t["band_track"]}; color: {kit.CREAM}; '
            f'display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 800">{icon(icon_name, 18, kit.CREAM)}{text}</span></button>')


def done_hero(t, title, meta):
    """The all-done counterpart of the Start session hero: a quiet card, not a button."""
    return (f'<div role="status" style="margin: -42px 0 10px; min-height: 84px; box-sizing: border-box; border-radius: 22px; background: {t["surface"]}; '
            f'box-shadow: {t["shadow"]}; padding: 14px 14px 14px 20px; display: flex; align-items: center; gap: 14px; flex: none">'
            f'<span style="flex: 1; display: flex; flex-direction: column; gap: 3px"><span style="{ts("hero", t["ink"])}">{title}</span>'
            f'<span style="font-size: 14px; font-weight: 600; color: {t["muted"]}">{meta}</span></span>'
            f'<span style="width: 54px; height: 54px; border-radius: 27px; background: {t["done_soft"]}; display: flex; align-items: center; justify-content: center; flex: none">'
            f'{icon("check", 28, t["done"], stroke=2.6)}</span></div>')


def bone(t, w, h=12, r=6, c=None):
    return f'<span style="display: block; width: {w}; height: {h}px; border-radius: {r}px; background: {c or t["skeleton"]}; flex: none"></span>'


def logged_button(t):
    """Log set after a successful log: done-soft, 'Logged' with a check (it stays until Next/Finish in a session)."""
    return (f'<button type="button" style="width: 100%; height: 52px; border-radius: 26px; border: 0; background: {t["done_soft"]}; color: {t["done"]}; '
            f'font-size: 16px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px; flex: none">{icon("check", 20, t["done"], stroke=2.6)}Logged</button>')


def rating_row(t, q, val=None):
    btns = ''
    for n in range(1, 6):
        on = val is not None and n <= val
        bg, fg = (t['accent'], t['on_accent']) if on else (t['surface'], t['ink2'])
        line = '' if on else f'box-shadow: inset 0 0 0 1px {t["field_line"]};'
        btns += (f'<button type="button" aria-pressed="{"true" if val == n else "false"}" style="flex: 1; height: 44px; border-radius: 12px; border: 0; '
                 f'background: {bg}; color: {fg}; font-size: 16px; font-weight: 800; {line}">{n}</button>')
    return (f'<fieldset style="margin: 0; padding: 0; border: 0; min-width: 0; flex: none"><legend style="{ts("label", t["ink2"])}; padding: 0 0 6px 4px">{q}</legend>'
            f'<div style="display: flex; gap: 8px">{btns}</div></fieldset>')


def last_time(t, text):
    return (f'<div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: {t["ink2"]}; flex: none">'
            f'{icon("clock", 18, t["muted"])}<span>{text}</span></div>')


def set_lines(t, sets):
    """A popup's 'Sets today' list: time, summary."""
    rows = ''.join(f'<div style="display: flex; gap: 12px; padding: 10px 16px; font-size: 14px; {"" if i == len(sets) - 1 else "border-bottom: 1px solid " + t["hairline"]}">'
                   f'<span style="width: 40px; color: {t["muted"]}; font-variant-numeric: tabular-nums">{tm}</span><span style="color: {t["ink"]}">{s}</span></div>'
                   for i, (tm, s) in enumerate(sets))
    return f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">{rows}</div>'


def details_link(t):
    return (f'<a href="#" style="display: flex; align-items: center; justify-content: space-between; min-height: 44px; padding: 0 4px; '
            f'text-decoration: none; color: {t["accent_text"]}; font-size: 15px; font-weight: 800; flex: none">Details and settings{kit.chevron(t)}</a>')


# --------------------------------------------------------------------------
# headers
# --------------------------------------------------------------------------

DATE = 'Saturday, 31 October'


def today_header(t):
    return kit.band_header(t, 'Today', DATE, right=[kit.band_button(t, 'chevron-left', 'Previous day'),
                                                    kit.band_button(t, 'settings', 'Settings')], hero=True)


def past_header(t, day='Thu 29 Oct', ago='2 days ago'):
    return kit.band_header(t, day, ago, right=[kit.band_button(t, 'chevron-left', 'Previous day'),
                                                kit.band_button(t, 'chevron-right', 'Next day')],
                           extra=band_pill(t, 'Back to today', 'calendar'), bottom=46)


# --------------------------------------------------------------------------
# Today (salsa)
# --------------------------------------------------------------------------


def due_rows(t, nxt=None, logged=()):
    rows = [
        ('Dile que no · Basic', st(t, 'Never done') + sep() + 'Every 3 days', 'partner', None),
        ('Enchufla · Doble', st(t, '4 days ago') + sep() + 'Every 3 days', 'partner', 3),
        ('Clave clapping', st(t, '2 days ago') + sep() + 'Daily', 'drill', 5),
    ]
    rows = [r for r in rows if r[0] not in logged]
    return [ex_row(t, n, m, k, 'due', r, last=i == len(rows) - 1, nxt=(n == nxt)) for i, (n, m, k, r) in enumerate(rows)]


def upcoming_rows(t):
    rows = [
        ('Setenta workshop', 'Wed 28 Oct class' + sep() + 'Yesterday', 'lesson', 4),
        ('Rueda opener', 'Yesterday' + sep() + 'Every 3 days', 'routine', 3),
        ('Kentucky · Basic', '2 days ago' + sep() + 'Weekly', 'partner', 4),
        ('Son basic', 'Yesterday' + sep() + 'Every 2 days', 'solo', None),
    ]
    return [ex_row(t, n, m, k, 'upcoming', r, last=i == len(rows) - 1) for i, (n, m, k, r) in enumerate(rows)]


def today(t, overlay=''):
    hero = kit.hero_card(t, 'Start session', '3 due · 4 not yet due')
    body = (kit.section_label(t, 'Due · 3') + group(t, due_rows(t))
            + kit.section_label(t, 'Not yet due · 4', 14) + group(t, upcoming_rows(t)))
    return kit.page(t, today_header(t), body, tab='Today', hero=hero, overlay=overlay)


# --------------------------------------------------------------------------
# Today scrolled (bachata): the rest of the list
# --------------------------------------------------------------------------


def today_scrolled(t):
    up = [
        ex_row(t, 'Cuddle turn · Basic', '2 days ago' + sep() + 'Every 3 days', 'partner', 'upcoming', 4),
        ex_row(t, 'Sensual wave', 'Yesterday' + sep() + 'Every 2 days', 'routine', 'upcoming', 3, last=True),
    ]
    done = [
        ex_row(t, 'Body wave · Basic', done_txt(t, '2 sets today') + sep() + 'Every 2 days', 'partner', 'done', 4),
        ex_row(t, 'Tuesday class', done_txt(t, '1 set today') + sep() + 'Tue 27 Oct class', 'lesson', 'done', 5, last=True),
    ]
    inactive = [
        ex_row(t, 'Hammerlock · Wrap', '12 days ago' + sep() + 'Weekly', 'partner', 'inactive', 2),
        ex_row(t, 'Media luna · Basic', 'Never done' + sep() + 'Every 2 weeks', 'partner', 'inactive', None),
        ex_row(t, 'Shadow footwork', '21 days ago' + sep() + 'Weekly', 'solo', 'inactive', None, last=True),
    ]
    header = (f'<header style="background: {t["band"]}; padding: 18px 20px 44px; display: flex; align-items: center; justify-content: space-between; flex: none">'
              f'<span style="{ts("title", kit.CREAM)}; font-size: 18px; font-weight: 800">Today</span>'
              f'<span style="display: flex; margin-right: -10px">{kit.band_button(t, "chevron-left", "Previous day")}{kit.band_button(t, "settings", "Settings")}</span></header>')
    body = (f'<div style="height: 0; flex: none"></div>'
            + group(t, up)
            + kit.section_label(t, 'Done today · 2', 14) + group(t, done)
            + fold_header(t, 'Inactive · 3', True) + group(t, inactive)
            + '<div style="height: 6px; flex: none"></div>'
            + kit.button(t, 'Custom exercise', 'secondary', icon_name='plus', full=True))
    # scrolled: the band collapses to a slim bar with a small title
    return kit.page(t, header, body, tab='Today', pad='16px 16px 0')


# --------------------------------------------------------------------------
# Session
# --------------------------------------------------------------------------


def today_session(t):
    hero = kit.hero_card(t, 'Resume session', 'Next: Enchufla · Doble · 2 logged')
    done = [
        ex_row(t, 'Dile que no · Basic', done_txt(t, '1 set today') + sep() + 'Every 3 days', 'partner', 'done', 4),
        ex_row(t, 'Sombrero · Basic', done_txt(t, '1 set today') + sep() + 'Weekly', 'partner', 'done', 3, last=True),
    ]
    body = (kit.section_label(t, 'Due · 2') + group(t, due_rows(t, nxt='Enchufla · Doble', logged=('Dile que no · Basic',)))
            + kit.section_label(t, 'Not yet due · 4', 14) + group(t, upcoming_rows(t)[:2])
            + kit.section_label(t, 'Done today · 2', 14) + group(t, done))
    return kit.page(t, today_header(t), body, tab='Today', hero=hero)


def session_sheet(t, title, sub, inner, footer, height):
    return kit.bottom_sheet(t, title, inner, footer=footer, height=height, sub=sub)


def _with_overlay(phone_html, overlay):
    """Append an overlay inside an already-built phone (its last </div> closes the phone)."""
    return phone_html[:-6] + overlay + '</div>'


def session_before_v(t):
    inner = (last_time(t, 'Last time: 4 days ago · ★★★ · “late on the 5”')
             + kit.text_field(t, 'Minutes', '', state='empty', inputmode='numeric', suffix='min')
             + rating_row(t, 'How did it go?')
             + kit.textarea(t, 'Note', rows=2, optional=True))
    footer = (f'<div style="display: flex; gap: 8px">{kit.button(t, "Skip", "secondary", icon_name="skip-forward", on=t["sheet_bg"])}'
              f'<div style="flex: 1; display: flex">{kit.button(t, "Log set", "primary", full=True, on=t["sheet_bg"])}</div></div>')
    return _with_overlay(today_session(t), session_sheet(t, 'Enchufla · Doble', 'Session · 2 logged so far', inner, footer, 600))


def next_button(t, name):
    return (f'<button type="button" style="width: 100%; height: 52px; border-radius: 26px; border: 0; background: {t["accent"]}; color: {t["on_accent"]}; '
            f'font-size: 16px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0 20px; flex: none">'
            f'<span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap">Next: {name}</span>{icon("chevron-right", 20, t["on_accent"], stroke=2.4)}</button>')


def session_logged(t):
    inner = (last_time(t, 'Last time: Today · ★★★★')
             + kit.text_field(t, 'Minutes', '', state='empty', inputmode='numeric', suffix='min')
             + rating_row(t, 'How did it go?')
             + kit.section_label(t, 'Sets today', 6) + set_lines(t, [('10:42', '12 min · ★★★★')])
             + details_link(t))
    footer = logged_button(t) + next_button(t, 'Clave clapping')
    return _with_overlay(today_session(t), session_sheet(t, 'Enchufla · Doble', 'Session · 3 logged so far', inner, footer, 610))


def session_done(t):
    inner = (last_time(t, 'Last time: Today · ★★★★★ · 200 reps')
             + kit.text_field(t, 'Minutes', '', state='empty', inputmode='numeric', suffix='min')
             + kit.text_field(t, 'Reps', '', state='empty', inputmode='numeric')
             + kit.section_label(t, 'Sets today', 6) + set_lines(t, [('10:58', '6 min · 200 reps · ★★★★★')]))
    summary = (f'<div role="status" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 16px; background: {t["done_soft"]}; flex: none">'
               f'{kit.done_check(t, 28)}<span style="display: flex; flex-direction: column; gap: 2px"><span style="{ts("headline", t["ink"])}; font-size: 18px">Session done</span>'
               f'<span style="font-size: 14px; font-weight: 600; color: {t["ink2"]}">4 exercises, 26 min</span></span></div>')
    footer = logged_button(t) + summary + kit.button(t, 'Finish', 'primary', full=True, on=t['sheet_bg'])
    return _with_overlay(today_session(t), session_sheet(t, 'Clave clapping', 'Session · last on the list', inner, footer, 660))


# --------------------------------------------------------------------------
# All done, first run, loading
# --------------------------------------------------------------------------


def all_done(t):
    hero = done_hero(t, 'All done for today', '5 exercises · 7 sets')
    done = [
        ex_row(t, 'Clave clapping', done_txt(t, '2 sets today') + sep() + 'Daily', 'drill', 'done', 5),
        ex_row(t, 'Enchufla · Doble', done_txt(t, '1 set today') + sep() + 'Every 3 days', 'partner', 'done', 4),
        ex_row(t, 'Dile que no · Basic', done_txt(t, '2 sets today') + sep() + 'Every 3 days', 'partner', 'done', 3),
        ex_row(t, 'Setenta workshop', done_txt(t, '1 set today') + sep() + 'Wed 28 Oct class', 'lesson', 'done', 4),
        ex_row(t, 'Rueda opener', done_txt(t, '1 set today') + sep() + 'Every 3 days', 'routine', 'done', 4, last=True),
    ]
    body = (kit.section_label(t, 'Done today · 5') + group(t, done) + fold_header(t, 'Inactive · 2'))
    return kit.page(t, today_header(t), body, tab='Today', hero=hero)


def first_run(t):
    acts = (f'<div style="display: flex; flex-direction: column; gap: 8px; width: 260px">'
            f'{kit.button(t, "Build a routine", "primary", icon_name="route", full=True)}'
            f'{kit.button(t, "Custom exercise", "secondary", icon_name="plus", full=True)}</div>')
    es = kit.empty_state(t, 'calendar', 'Nothing to practise yet',
                         'Build a routine from your figures, or add a custom exercise.', acts)
    header = kit.band_header(t, 'Today', DATE, right=[kit.band_button(t, 'chevron-left', 'Previous day'),
                                                      kit.band_button(t, 'settings', 'Settings')])
    return kit.page(t, header, '<div style="height: 40px; flex: none"></div>' + es, tab='Today')


def loading(t):
    small = kit.rgba(kit.CREAM, 0.28)
    header = (f'<header aria-hidden="true" style="background: {t["band"]}; padding: 30px 20px 92px; display: flex; flex-direction: column; gap: 6px; flex: none">'
              f'<div style="display: flex; align-items: center; justify-content: space-between; gap: 12px">'
              f'<h2 style="margin: 0; {ts("display")}; color: {kit.CREAM}">Today</h2>'
              f'<div style="display: flex; margin-right: -10px">{kit.band_button(t, "chevron-left", "Previous day", "disabled")}{kit.band_button(t, "settings", "Settings")}</div></div>'
              f'<span style="display: block; width: 150px; height: 14px; border-radius: 7px; background: {small}; margin-top: 4px"></span></header>')
    hero = (f'<div aria-hidden="true" style="margin: -42px 0 10px; min-height: 84px; box-sizing: border-box; border-radius: 22px; background: {t["surface"]}; '
            f'box-shadow: {t["shadow"]}; padding: 14px 14px 14px 20px; display: flex; align-items: center; gap: 14px; flex: none">'
            f'<span style="flex: 1; display: flex; flex-direction: column; gap: 10px">{bone(t, "58%", 18, 9)}{bone(t, "38%", 11)}</span>'
            f'<span style="width: 54px; height: 54px; border-radius: 27px; background: {t["skeleton"]}; flex: none"></span></div>')
    body = (f'<span style="padding: 2px 16px 0">{bone(t, "64px", 10, 5)}</span>' + kit.skeleton_rows(t, 3, 'Loading Today', leading=True)
            + f'<span style="padding: 14px 16px 0">{bone(t, "96px", 10, 5)}</span>' + kit.skeleton_rows(t, 2, 'Loading', leading=True))
    return kit.page(t, header, hero + body, tab='Today', pad='0 16px')


# --------------------------------------------------------------------------
# Past days
# --------------------------------------------------------------------------


def day_group(t, name, kind, sets):
    head = (f'<div style="padding-left: 16px"><div style="display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 8px 6px 8px 0; '
            f'border-bottom: 1px solid {t["hairline"]}">{type_tile(t, kind, "done")}'
            f'<span style="flex: 1; min-width: 0; {ts("title", t["ink"])}">{name}</span>'
            f'{kit.icon_button(t, "plus", f"Add a set of {name} to this day", "bare", color=t["accent"])}</div></div>')
    lines = ''
    for i, (tm, s, note) in enumerate(sets):
        hair = '' if i == len(sets) - 1 else f'border-bottom: 1px solid {t["hairline"]};'
        n = f'<span style="display: block; color: {t["muted"]}; font-size: 13px; margin-top: 2px">“{note}”</span>' if note else ''
        lines += (f'<div style="padding-left: 68px"><div style="display: flex; gap: 12px; padding: 11px 16px 11px 0; {hair}">'
                  f'<span style="width: 40px; flex: none; font-size: 14px; font-weight: 700; color: {t["muted"]}; font-variant-numeric: tabular-nums">{tm}</span>'
                  f'<span style="flex: 1; font-size: 14px; color: {t["ink"]}">{s}{n}</span></div></div>')
    return f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">{head}{lines}</div>'


def forgot(t):
    return (f'<div style="margin-top: 14px; flex: none">'
            + kit.select_field(t, 'Forgot to log something that day?', '', 'Pick an exercise…', state='empty') + '</div>')


def past_day(t):
    body = (kit.section_label(t, 'Logged that day · 3')
            + day_group(t, 'Body wave · Basic', 'partner', [('19:42', '15 min · ★★★★', 'smoother on the left side'), ('20:10', '5 min · ★★★', None)])
            + day_group(t, 'Hip roll drill', 'drill', [('18:05', '8 min · 120 reps', None)])
            + day_group(t, 'Tuesday class', 'lesson', [('21:30', '10 min · ★★★★★', None)])
            + forgot(t))
    return kit.page(t, past_header(t), body, tab='Today')


def past_empty(t, overlay=''):
    es = (f'<div style="display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 28px 24px 8px; text-align: center; flex: none">'
          f'<span style="width: 56px; height: 56px; border-radius: 28px; background: {t["chip"]}; display: flex; align-items: center; justify-content: center">'
          f'{icon("calendar", 26, t["muted"])}</span>'
          f'<span style="{ts("title", t["ink"])}; margin-top: 6px">Nothing logged on this day</span></div>')
    return kit.page(t, past_header(t, 'Mon 26 Oct', '5 days ago'), es + forgot(t), tab='Today', overlay=overlay)


def picker_heading(t, text, open_=True):
    return (f'<button type="button" aria-expanded="{"true" if open_ else "false"}" style="width: 100%; display: flex; align-items: center; gap: 8px; min-height: 52px; '
            f'border: 0; border-bottom: 1px solid {t["hairline"]}; background: none; padding: 0 14px 0 16px; text-align: left; cursor: pointer">'
            f'<span style="flex: 1; {ts("title", t["ink"])}">{text}</span>{icon("chevron-up" if open_ else "chevron-down", 20, t["muted"])}</button>')


def pick_row(t, label, meta, indent=False, last=False):
    hair = '' if last else f'border-bottom: 1px solid {t["hairline"]};'
    return (f'<button type="button" style="width: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-height: 56px; justify-content: center; '
            f'border: 0; {hair} background: none; padding: 8px 16px 8px {36 if indent else 16}px; text-align: left; cursor: pointer">'
            f'<span style="font-size: 16px; font-weight: 600; color: {t["ink"]}">{label}</span>'
            f'<span style="font-size: 13px; color: {t["muted"]}">{meta}</span></button>')


def past_picker(t):
    g = lambda rows: f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">{rows}</div>'  # noqa: E731
    inner = (kit.search_field(t, 'Search exercises')
             + f'<div style="display: flex; flex-direction: column; gap: 8px; overflow: hidden; flex: 1; min-height: 0">'
             + kit.section_label(t, 'Figures', 4)
             + g(picker_heading(t, 'Dile que no', False)
                 + picker_heading(t, 'Enchufla', True)
                 + pick_row(t, 'Basic', 'Every 3 days', True) + pick_row(t, 'Doble', 'Every 3 days', True)
                 + picker_heading(t, 'Kentucky', False).replace(f'border-bottom: 1px solid {t["hairline"]}; ', ''))
             + kit.section_label(t, 'Routines', 8) + g(pick_row(t, 'Rueda opener', 'Every 3 days', last=True))
             + kit.section_label(t, 'Drills', 8) + g(pick_row(t, 'Clave clapping', 'Daily') + pick_row(t, 'Son basic', 'Every 2 days', last=True))
             + '</div>')
    return past_empty(t, kit.bottom_sheet(t, 'Log a set on Mon 26 Oct', inner, height=720))


# --------------------------------------------------------------------------
# New exercise sheet
# --------------------------------------------------------------------------

HINT = 'To practise a figure on its own, open it and tap Practise on its own.'


def new_ex_inner(t, name_state='empty', name='', freq='Every 3 days', freq_state='filled', notes='', notes_state='empty', error=None):
    return (kit.text_field(t, 'Name', name, 'e.g. Son basic, clave clapping', state=name_state, error=error)
            + kit.select_field(t, 'How often', freq, state=freq_state)
            + kit.textarea(t, 'Notes', notes, state=notes_state, rows=3, optional=True))


def new_ex_footer(t, state='default'):
    return (kit.button(t, 'Add exercise', 'primary', state=state, full=True, on=t['sheet_bg'])
            + f'<p style="margin: 4px 4px 0; font-size: 13px; line-height: 1.4; color: {t["muted"]}">{HINT}</p>')


def new_sheet(t, inner, state='default'):
    return kit.bottom_sheet(t, 'New exercise', inner, footer=new_ex_footer(t, state), gap=14)


def new_empty(t):
    return today(t, new_sheet(t, new_ex_inner(t)))


def new_focused(t):
    return today(t, new_sheet(t, new_ex_inner(t, 'focused', 'Hip roll drill|')).replace('Hip roll drill|', 'Hip roll drill'))


def new_freq(t):
    rows = ''
    opts = ['Daily', 'Every 2 days', 'Every 3 days', 'Weekly', 'Every 2 weeks']
    for i, o in enumerate(opts):
        chosen = o == 'Weekly'
        hair = '' if i == len(opts) - 1 else f'border-bottom: 1px solid {t["hairline"]};'
        mark = icon('check', 22, t['accent'], stroke=2.6) if chosen else ''
        rows += (f'<button type="button" role="option" aria-selected="{"true" if chosen else "false"}" style="width: 100%; display: flex; align-items: center; '
                 f'min-height: 56px; border: 0; {hair} background: none; padding: 0 16px; text-align: left; cursor: pointer; font-size: 16px; '
                 f'font-weight: {800 if chosen else 600}; color: {t["accent_text"] if chosen else t["ink"]}"><span style="flex: 1">{o}</span>{mark}</button>')
    lst = f'<div role="listbox" aria-label="How often" style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">{rows}</div>'
    under = new_sheet(t, new_ex_inner(t, 'filled', 'Hip roll drill', 'Weekly', 'focused'))
    top = kit.bottom_sheet(t, 'How often', lst, back=True, close=False)
    return today(t, under + top)


def new_error(t):
    return today(t, new_sheet(t, new_ex_inner(t, 'error', '', notes='Ten in a row on each side, then switch.', notes_state='filled',
                                              error='Give it a name (up to 200 characters) and a frequency.')))


def new_saving(t):
    return today(t, new_sheet(t, new_ex_inner(t, 'filled', 'Hip roll drill', 'Weekly', notes='Ten in a row on each side, then switch.',
                                              notes_state='filled'), 'loading'))


def new_unsaved(t):
    sheet = new_sheet(t, new_ex_inner(t, 'filled', 'Hip roll drill', 'Weekly'))
    dlg = kit.dialog(t, 'Unsaved changes', 'New exercise is not saved yet.', [
        kit.button(t, 'Save', 'primary', full=True, on=t['raised']),
        kit.button(t, 'Stay', 'secondary', full=True, on=t['raised']),
        kit.button(t, 'Close without saving', 'danger_text', full=True, on=t['raised'])], icon_name='warning', tone='warn')
    return today(t, sheet + dlg)


# --------------------------------------------------------------------------

SCREENS = [
    ('Today', 'Hero first; then Due (status-coloured “last done”) and Not yet due (quiet tiles). + logs, the row opens the exercise.', today, 'salsa'),
    ('Today · further down', 'Band shrinks on scroll. Done today, Inactive (folded open), then Custom exercise. Bachata.', today_scrolled, 'bachata'),
    ('Today · session running', 'Hero turns into Resume session with the next name and the tally; the next row is tinted “Up next”.', today_session, 'salsa'),
    ('Session · before logging', 'The type’s popup (body owned by the log-popup board); in a session Skip sits beside Log set.', session_before_v, 'salsa'),
    ('Session · logged', 'Log set turns into Logged; Next: <name> takes the primary place.', session_logged, 'salsa'),
    ('Session · done', 'Nothing left: the summary card and Finish. Finish closes the popup and drops ?session=1.', session_done, 'salsa'),
    ('All done for today', 'Due and Not yet due empty: no Start session; a quiet done card in its place.', all_done, 'salsa'),
    ('First run', 'No exercises at all: empty state with Build a routine and Custom exercise.', first_run, 'salsa'),
    ('Loading', 'Skeleton shaped like Today: real title, bones for date, hero and rows.', loading, 'salsa'),
    ('Past day', '‹ › step days, Back to today; sets grouped by exercise, + adds a set to that day. Bachata.', past_day, 'bachata'),
    ('Past day · nothing logged', 'Quiet empty line, then the forgotten-set field.', past_empty, 'salsa'),
    ('Past day · pick an exercise', 'The shared picker: search, figure headings, groups. A tap opens that exercise’s popup for that day.', past_picker, 'salsa'),
    ('New exercise', 'From Custom exercise. Name, How often (default Every 3 days), optional Notes.', new_empty, 'salsa'),
    ('New exercise · typing', 'Name focused: accent ring and halo. Bachata.', new_focused, 'bachata'),
    ('New exercise · How often', 'The field opens a stacked picker level; Back returns to the form.', new_freq, 'salsa'),
    ('New exercise · error', 'The action failed: the message sits under Name, typed notes kept.', new_error, 'salsa'),
    ('New exercise · saving', 'Add exercise shows a spinner until the action returns, then the sheet closes.', new_saving, 'salsa'),
    ('New exercise · leaving', 'Closing with typed text asks first (the app’s one Unsaved changes dialog).', new_unsaved, 'salsa'),
]

if __name__ == '__main__':
    html, w, h = kit.artboard('Today', 'Every state of Today: the four bands, the session, past days, empty and loading, and New exercise — light and dark.',
                              SCREENS, per_row=3, doc_title='S · Today')
    kit.write(OUT, html)
    print(w, h, OUT)
