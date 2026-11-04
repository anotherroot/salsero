"""Desktop boards · Today (round 3).

Option A (recommended): the list on the left, the open exercise on the right; the log form lives in the pane.
Option B: two columns (due and done left, not yet due right), the log as a dialog, the exercise page its own page.
Both: Custom exercise is a + on the band.
"""
import frame as F
from frame import kit, ts, icon
import options as O

TD, LG = O.TD, O.LG

SECTION = ('today', 'Today')
DATE = O.DATE  # 'Saturday, 31 October'
TODAY_W = 400  # Today's list is a little wider than the default 360: its rows carry two lines of meta

A = dict(option='A', rec=True, changed=True)
A_NONE = dict(option='A · nothing open until you pick', changed=True)
B = dict(option='B', changed=True)


# --------------------------------------------------------------------------
# the band
# --------------------------------------------------------------------------

def band_right(t):
    return F.act(t, 'chevron-left', 'Previous day') + F.act(t, 'plus', 'Custom exercise')


def today_frame(t, body, overlay='', right=None):
    return F.frame(t, 'Today', 'Today', body, sub=DATE, right=right or band_right(t), overlay=overlay)


# --------------------------------------------------------------------------
# rows and sample data
# --------------------------------------------------------------------------

G1, G2 = 'Salsa Tuesdays', 'Rueda club'


def group_head(t, name, n, top=6):
    """A group's heading inside a band: the people icon and "Salsa Tuesdays · 2"."""
    return (f'<h3 style="margin: 0; padding: {top}px 16px 0; display: flex; align-items: center; gap: 6px; {ts("label", t["muted"])}">'
            f'{icon("people", 16, t["muted"])}{name} · {n}</h3>')


def a_row(t, name, meta, kind, band='due', rating=None, last=False, nxt=False, sel=False):
    """Option A's row: the whole row opens the exercise in the pane (no + of its own: the pane has the log form).
    sel: the open one (tinted, an accent bar on its left edge)."""
    hair = '' if last else f'border-bottom: 1px solid {t["hairline"]};'
    tone = {'due': 'accent', 'upcoming': 'quiet', 'inactive': 'quiet', 'done': 'done'}[band]
    tc = t['muted'] if band == 'inactive' else t['ink']
    m = meta + (TD.dots(t, rating) if rating else '')
    badge = (' ' + kit.badge(t, 'Up next', 'accent', solid=True).replace('display: inline-flex', 'display: inline-flex; vertical-align: 2px; margin-left: 4px')) if nxt else ''
    bg = t['accent_soft'] if sel else 'transparent'
    bar = f'box-shadow: inset 4px 0 0 {t["accent"]};' if sel else ''
    cur = ' aria-current="true"' if sel else ''
    return (f'<a href="#"{cur} style="display: block; padding-left: 16px; background: {bg}; {bar} text-decoration: none; color: {tc}">'
            f'<span style="display: flex; align-items: center; gap: 12px; min-height: 66px; box-sizing: border-box; padding: 10px 16px 10px 0; {hair}">'
            f'{TD.type_tile(t, kind, tone)}'
            f'<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px">'
            f'<span style="font-size: 16px; line-height: 1.3; font-weight: 700; color: {tc}">{name}{badge}</span>'
            f'<span style="font-size: 13px; line-height: 1.35; color: {t["muted"]}">{m}</span></span></span></a>')


def own_due(t):
    return [('Enchufla · Doble', TD.st(t, '4 days ago') + TD.sep() + 'Every 3 days', 'partner', 3),
            ('Dile que no · Basic', TD.st(t, 'Never done') + TD.sep() + 'Every 3 days', 'partner', None),
            ('Clave clapping', TD.st(t, '2 days ago') + TD.sep() + 'Daily', 'drill', 5)]


def g1_due(t):
    return [('Week 6 · Setenta into Sombrero', TD.st(t, 'Never done') + TD.sep() + 'Tue 3 Nov class', 'lesson', None),
            ('Setenta into Sombrero', TD.st(t, '4 days ago') + TD.sep() + 'Every 3 days', 'routine', 3)]


def own_upcoming(t):
    return [('Setenta workshop', 'Wed 28 Oct class' + TD.sep() + 'Yesterday', 'lesson', 4),
            ('Rueda opener', 'Yesterday' + TD.sep() + 'Every 3 days', 'routine', 3),
            ('Kentucky · Basic', '2 days ago' + TD.sep() + 'Weekly', 'partner', 4),
            ('Son basic', 'Yesterday' + TD.sep() + 'Every 2 days', 'solo', None)]


def g2_upcoming(t):
    return [('Cross-body footwork', 'Yesterday' + TD.sep() + 'Every 2 days', 'drill', 4)]


def own_done(t, extra=()):
    rows = [(n, TD.done_txt(t, '1 set today') + TD.sep() + f, k, r) for n, f, k, r in extra]
    return rows + [('Sombrero · Basic', TD.done_txt(t, '1 set today') + TD.sep() + 'Weekly', 'partner', 3),
                   ('Tuesday class', TD.done_txt(t, '1 set today') + TD.sep() + 'Tue 27 Oct class', 'lesson', 5)]


def inactive(t):
    return [('Hammerlock · Wrap', '12 days ago' + TD.sep() + 'Weekly', 'partner', 2),
            ('Media luna · Basic', 'Never done' + TD.sep() + 'Every 2 weeks', 'partner', None),
            ('Shadow footwork', '21 days ago' + TD.sep() + 'Weekly', 'solo', None)]


def a_rows(t, items, band, sel=None, nxt=None):
    return TD.group(t, [a_row(t, n, m, k, band, r, last=i == len(items) - 1, nxt=n == nxt, sel=n == sel) for i, (n, m, k, r) in enumerate(items)])


def b_rows(t, items, band, nxt=None):
    return TD.group(t, [TD.ex_row(t, n, m, k, band, r, last=i == len(items) - 1, nxt=n == nxt) for i, (n, m, k, r) in enumerate(items)])


def skip(items, names):
    return [r for r in items if r[0] not in names]


def hero(t, title='Start session', meta='5 due · 5 not yet due'):
    return kit.hero_card(t, title, meta, straddle=False)


def done_hero(t, title, meta):
    return TD.done_hero(t, title, meta).replace('margin: -42px 0 10px', 'margin: 0')


# --------------------------------------------------------------------------
# Option A: the list
# --------------------------------------------------------------------------

def a_list(t, sel=None, nxt=None, logged=(), hero_html=None, inactive_open=False, all_done=False):
    """Due, Done today, Not yet due, Inactive: today's first, what is not due yet below."""
    rows = rows_r = ''
    if not all_done:
        own, g = skip(own_due(t), logged), skip(g1_due(t), logged)
        rows += (F.label(t, f'Due · {len(own) + len(g)}', 12) + a_rows(t, own, 'due', sel, nxt)
                 + (group_head(t, G1, len(g)) + a_rows(t, g, 'due', sel, nxt) if g else ''))
    extra = [r for r in [('Enchufla · Doble', 'Every 3 days', 'partner', 4), ('Dile que no · Basic', 'Every 3 days', 'partner', 4),
                         ('Clave clapping', 'Daily', 'drill', 5)] if r[0] in logged]
    done = own_done(t, extra)
    rows += F.label(t, f'Done today · {len(done) + (2 if all_done else 0)}', 14) + a_rows(t, done, 'done', sel)
    if all_done:
        g = [('Week 6 · Setenta into Sombrero', TD.done_txt(t, '1 set today') + TD.sep() + 'Tue 3 Nov class', 'lesson', 4),
             ('Setenta into Sombrero', TD.done_txt(t, '1 set today') + TD.sep() + 'Every 3 days', 'routine', 4)]
        rows += group_head(t, G1, 2) + a_rows(t, g, 'done', sel)
    up = own_upcoming(t)
    rows_r += (F.label(t, f'Not yet due · {len(up) + 1}', 14) + a_rows(t, up, 'upcoming', sel)
               + group_head(t, G2, 1) + a_rows(t, g2_upcoming(t), 'upcoming', sel))
    rows_r += TD.fold_header(t, 'Inactive · 3', inactive_open)
    if inactive_open:
        rows_r += a_rows(t, inactive(t), 'inactive', sel)
    return (hero_html if hero_html is not None else hero(t)) + rows + rows_r


# --------------------------------------------------------------------------
# Option A: the pane (the exercise page and the log form in one)
# --------------------------------------------------------------------------

def pane_foot(t, inner, right=''):
    """The pane's pinned bar: the log buttons under the left column (370 wide), an aside on the right."""
    return (f'<div style="flex: none; border-top: 1px solid {t["hairline"]}; background: {t["ground"]}; padding: 14px 40px 20px; '
            f'display: flex; align-items: center; gap: 32px">'
            f'<div style="width: 370px; flex: none; display: flex; gap: 10px; align-items: center">{inner}</div>'
            f'<div style="flex: 1; min-width: 0; font-size: 13px; color: {t["muted"]}">{right}</div></div>')


def log_set(t, label='Log set'):
    return f'<div style="flex: 1">{kit.button(t, label, "primary", icon_name="check", full=True, on=t["ground"])}</div>'


def skip_btn(t):
    return kit.button(t, 'Skip', 'secondary', on=t['ground'])


def next_btn(t, name):
    return (f'<div style="flex: 1">{kit.button(t, "Next: " + name, "primary", icon_name="chevron-right", full=True, on=t["ground"])}</div>')


def logged_btn(t):
    return f'<div style="flex: 1">{LG.log_button(t, "logged")}</div>'


def log_form(t, mins='', reps='', stars=None, note='', panel='Count 180 · 1 2 3 · 5 6 7 · clave 2-3 · call every 4', banked=None, reps_field=True):
    p = LG.panel_head(t, panel) + (LG.banked(t, banked) if banked else '')
    out = LG.section_head(t, 'Log a set') + LG.panel_card(t, p)
    m = LG.minutes_field(t, mins, 'filled' if mins else 'empty', helper=('From the practice: 6:12' if banked else None))
    out += LG.two(m, LG.reps_field(t, reps, 'filled' if reps else 'empty')) if reps_field else m
    out += LG.rating(t, 'How did it go?', stars)
    out += LG.note_field(t, note, 'filled' if note else 'empty')
    return out


def reference(t):
    return (LG.section_head(t, 'Reference', LG.hide_button(t, True)) + LG.p(t, LG.FIG_NOTES)
            + LG.video_frame(t, 'Recording · 26 Oct', 'Filmed after class', '0:48', 0, h=170)
            + kit.list_group(t, [LG.section_card(t, 'The double prep', 'Thursday class · 22 Oct', '1:12–1:31')])
            + f'<a href="#" style="display: flex; align-items: center; gap: 6px; padding: 4px 4px 0; font-size: 14px; font-weight: 800; color: {t["accent_text"]}; '
              f'text-decoration: none">Edit links on the figure page{icon("chevron-right", 18, t["accent_text"])}</a>')


def owner(t):
    return LG.owner_row(t, 'Enchufla · Doble', 'Figure · open the figure', 'footprints')


def settings_read(t):
    rows = [dict(title='How often', trailing=kit.row_value(t, 'Every 3 days'), min_h=56),
            dict(title='Active', meta='Shows on Today', trailing=kit.row_value(t, 'On'), min_h=56),
            dict(title='Practice notes', meta='Start at 160 BPM, then 180 once the prep is clean.', min_h=64)]
    return LG.section_head(t, 'Settings') + kit.list_group(t, rows)


def settings_form(t):
    s = kit.select_field(t, 'How often', 'Every 3 days', bg=t['field'])
    s += (f'<div style="display: flex; align-items: center; gap: 12px; min-height: 52px">'
          f'<span style="flex: 1; display: flex; flex-direction: column; gap: 1px"><span style="font-size: 16px; font-weight: 700">Active</span>'
          f'<span style="font-size: 13px; color: {t["muted"]}">Show it on Today</span></span>'
          f'{kit.switch(t, True, label="Active")}</div>')
    s += kit.textarea(t, 'Practice notes', 'Start at 160 BPM, then 180 once the prep is clean. Slow the turn down first.', state='focused', rows=3, bg=t['field'])
    s += f'<div style="display: flex; gap: 10px">{kit.button(t, "Save", "primary", on=t["surface"])}{kit.button(t, "Cancel", "secondary", on=t["surface"])}</div>'
    return LG.section_head(t, 'Settings') + kit.card(t, s, gap=14)


def history(t, today_set=None):
    out = LG.section_head(t, 'History · 23 sets') + LG.history_summary(t, '23', '4 h 10', '3.8 ★')
    if today_set:
        out += F.label(t, 'Today', 6) + kit.list_group(t, [dict(title=LG.set_summary(t, *today_set[1]), meta=today_set[0] + ' · ' + today_set[2], min_h=60,
                                                                trailing=kit.icon_button(t, 'trash', 'Delete set', 'bare', color=t['muted'], icon_size=20, on=t['surface']))])
    out += LG.sets_list(t, 'Tuesday, 27 October', [('20:05', LG.set_summary(t, 12, None, 3), 'lost the count at the break'),
                                                    ('07:50', LG.set_summary(t, 8, 20, None), None)]).replace(LG.section_head(t, 'Tuesday, 27 October'), F.label(t, 'Tuesday, 27 October', 6))
    out += LG.sets_list(t, 'Saturday, 24 October', [('13:10', LG.set_summary(t, 15, None, 4), None)]).replace(LG.section_head(t, 'Saturday, 24 October'), F.label(t, 'Saturday, 24 October', 6))
    return out


def archive(t):
    return f'<div style="padding-top: 6px">{kit.button(t, "Archive exercise", "danger_text")}</div>'


def last_line(t, days='4 days ago', n=3, note='lost the count at the break'):
    return (f'<span style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: {t["ink2"]}">{icon("clock", 18, t["muted"])}'
            f'<span>{LG.last_time_html(t, days, n, note)}</span></span>')


def ex_pane(t, sub, left, right, foot, actions=None, below=None):
    head = F.pane_head(t, 'Enchufla · Doble', sub,
                       actions=actions if actions is not None else F.tonal(t, 'edit', 'Edit settings'),
                       below=below if below is not None else last_line(t))
    return F.pane(t, head, F.pane_cols(left, right, ('1fr', '1fr')), foot, 'Enchufla · Doble')


def a_body(t, pane, scrolled=0, **kw):
    """scrolled: draw the list already scrolled down by that many px (to show an open row further down)."""
    lst = F.col(a_list(t, **kw), gap=8, extra=f'margin-top: -{scrolled}px' if scrolled else '')
    return F.split(t, lst, pane, 'Today', width=TODAY_W)


def pane_enchufla(t):
    left = log_form(t) + reference(t)
    right = owner(t) + history(t) + settings_read(t) + archive(t)
    return ex_pane(t, 'Figure practice · Every 3 days · due', left, right, pane_foot(t, log_set(t), 'Or Start session to go through everything due, one after another.'))


# --------------------------------------------------------------------------
# boards: Option A
# --------------------------------------------------------------------------

def a_today(t):
    return today_frame(t, a_body(t, pane_enchufla(t), sel='Enchufla · Doble'))


def a_none(t):
    es = kit.empty_state(t, 'calendar', 'Pick an exercise', '5 are due today. Start a session to go through them in order.',
                         kit.button(t, 'Start session', 'primary', icon_name='play'))
    pane = f'<section aria-label="Nothing open" style="flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center; padding-bottom: 60px">{es}</section>'
    return today_frame(t, a_body(t, pane))


def a_session(t):
    left = log_form(t, '6', '', 4, 'Turn felt late on 6 — prep earlier', banked='6:12 practised — Play carries on') + reference(t)
    right = owner(t) + history(t) + settings_read(t)
    pane = ex_pane(t, 'Session · 2 of 5 · 1 logged so far', left, right,
                   pane_foot(t, skip_btn(t) + log_set(t), 'Next up: Clave clapping'))
    h = hero(t, 'Resume session', 'Next: Enchufla · Doble · 1 logged')
    return today_frame(t, a_body(t, pane, sel='Enchufla · Doble', nxt='Enchufla · Doble', logged=('Dile que no · Basic',), hero_html=h))


def a_logged(t):
    left = log_form(t, '6', '', 4, 'Turn felt late on 6 — prep earlier', banked='6:12 practised — Play carries on') + reference(t)
    right = owner(t) + history(t, ('12:42', (6, None, 4), 'Turn felt late on 6 — prep earlier')) + settings_read(t)
    pane = ex_pane(t, 'Session · 2 of 5 · 2 logged so far', left, right,
                   pane_foot(t, logged_btn(t) + next_btn(t, 'Clave clapping'), 'Logged at 12:42. It moved to Done today.'),
                   below=last_line(t, 'Today', 4, 'Turn felt late on 6 — prep earlier'))
    h = hero(t, 'Resume session', 'Next: Clave clapping · 2 logged')
    return today_frame(t, a_body(t, pane, sel='Enchufla · Doble', nxt='Clave clapping', logged=('Dile que no · Basic', 'Enchufla · Doble'), hero_html=h))


def a_session_done(t):
    done = (f'<div role="status" style="display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 16px; background: {t["done_soft"]}">'
            f'{kit.done_check(t, 30)}<span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 17px; font-weight: 800; color: {t["ink"]}">Session done</span>'
            f'<span style="font-size: 13px; font-weight: 700; color: {t["done"]}">5 exercises, 24 min</span></span></div>')
    left = done + log_form(t, '6', '200', 5, panel='Valió la pena 0.9× · 1 2 3 · 5 6 7 · clave 2-3') + LG.section_head(t, 'Reference') + LG.drill_content(t, short=True)
    right = (LG.section_head(t, 'History · 41 sets') + LG.history_summary(t, '41', '5 h 30', '4.6 ★')
             + LG.sets_list(t, 'Today', [('12:58', LG.set_summary(t, 6, 200, 5), None)]).replace(LG.section_head(t, 'Today'), F.label(t, 'Today', 6)))
    head = F.pane_head(t, 'Clave clapping · 2-3', 'Session · last on the list', actions=F.tonal(t, 'edit', 'Edit settings'),
                       below=last_line(t, 'Today', 5, None))
    pane = F.pane(t, head, F.pane_cols(left, right, ('1fr', '1fr')),
                  pane_foot(t, logged_btn(t) + f'<div style="flex: 1">{kit.button(t, "Finish", "primary", full=True, on=t["ground"])}</div>'), 'Clave clapping')
    lst = F.col(done_hero(t, 'Session done', '5 exercises · 6 sets') + a_list(t, sel='Clave clapping', all_done=True, hero_html='',
                                                                           logged=('Dile que no · Basic', 'Enchufla · Doble', 'Clave clapping')), gap=8)
    return today_frame(t, F.split(t, lst, pane, 'Today', width=TODAY_W))


def a_all_done(t):
    """Nothing due: no exercise is open; the pane shows the day so far."""
    body = (F.label(t, 'Logged today · 7')
            + TD.day_group(t, 'Enchufla · Doble', 'partner', [('12:42', '6 min · ★★★★', 'Turn felt late on 6 — prep earlier')])
            + TD.day_group(t, 'Dile que no · Basic', 'partner', [('12:30', '5 min · ★★★★', None), ('19:10', '8 min · ★★★', None)])
            + TD.day_group(t, 'Clave clapping · 2-3', 'drill', [('12:58', '6 min · 200 reps · ★★★★★', None)])
            + TD.day_group(t, 'Week 6 · Setenta into Sombrero', 'lesson', [('18:05', '20 min · ★★★★', 'the comb on 5 finally')]))
    head = F.pane_head(t, 'Today so far', '7 exercises · 9 sets · 1 h 05')
    pane = F.pane(t, head, F.pane_body(body), label_='Today so far')
    lst = F.col(done_hero(t, 'All done for today', '7 exercises · 9 sets')
                + a_list(t, all_done=True, hero_html='', logged=('Dile que no · Basic', 'Enchufla · Doble', 'Clave clapping')), gap=8)
    return today_frame(t, F.split(t, lst, pane, 'Today', width=TODAY_W))


def a_upcoming(t):
    """A not-yet-due routine open: you can log it early."""
    slots = [('Basic · Side', None), ('Cuddle turn', None), ('Hammerlock / Shadow position', 'either — whichever she offers'),
             ('Media luna', 'slow it down'), ('Body wave', None)]
    rows = []
    for i, (name, note) in enumerate(slots, 1):
        lead = (f'<span style="width: 28px; height: 28px; border-radius: 14px; background: {t["chip"]}; color: {t["ink2"]}; font-size: 13px; font-weight: 800; '
                f'display: flex; align-items: center; justify-content: center">{i}</span>')
        rows.append(dict(title=name, meta=note, leading=lead, min_h=52))
    left = (LG.section_head(t, 'Log a run') + kit.button(t, 'Practise in player', 'secondary', icon_name='play', full=True, on=t['ground'])
            + f'<span style="font-size: 13px; color: {t["muted"]}; padding: 0 4px">A run in the player logs itself. Log here when you practised away from the app.</span>'
            + LG.minutes_field(t) + LG.rating(t, 'How did it go?') + LG.note_field(t))
    right = (kit.list_group(t, [dict(title='Rueda opener', meta='Routine · open the routine', leading=LG._lead(t, 'route'), trailing=kit.chevron(t), href='#', min_h=60)])
             + LG.section_head(t, 'The routine · 5 slots') + f'<ol style="margin: 0; padding: 0; list-style: none">{kit.list_group(t, rows)}</ol>'
             + LG.section_head(t, 'History · 9 sets') + LG.history_summary(t, '9', '1 h 20', '3.4 ★'))
    head = F.pane_head(t, 'Rueda opener', 'Routine practice · Every 3 days · due in 2 days', actions=F.tonal(t, 'edit', 'Edit settings'),
                       below=last_line(t, 'Yesterday', 3, 'clean until the media luna'))
    pane = F.pane(t, head, F.pane_cols(left, right, ('1fr', '1fr')), pane_foot(t, log_set(t), 'Not due yet: logging now is fine, it counts from today.'), 'Rueda opener')
    return today_frame(t, a_body(t, pane, sel='Rueda opener', scrolled=560))


def a_lesson(t):
    """A group lesson's entry open: the lesson to review, how well you remember it."""
    lesson = (f'<a href="#" style="display: flex; align-items: center; gap: 12px; padding: 10px 14px 10px 12px; border-radius: 16px; background: {t["surface"]}; '
              f'text-decoration: none; color: {t["ink"]}; flex: none">{LG._lead(t, "lessons")}'
              f'<span style="flex: 1; display: flex; flex-direction: column; gap: 1px"><span style="font-size: 16px; font-weight: 700">Week 6 · Setenta into Sombrero</span>'
              f'<span style="font-size: 13px; color: {t["muted"]}">Salsa Tuesdays · Tue 3 Nov · 2 videos</span></span>{kit.chevron(t)}</a>')
    figs = ''.join(f'<a href="#" style="height: 36px; padding: 0 14px; border-radius: 18px; background: {t["chip"]}; color: {t["chip_ink"]}; font-size: 14px; '
                   f'font-weight: 600; display: inline-flex; align-items: center; gap: 4px; text-decoration: none; margin: 4px 0">{f}{icon("chevron-right", 16, t["muted"])}</a>'
                   for f in ['Setenta · Comb', 'Sombrero · Basic'])
    left = (LG.section_head(t, 'Log a review') + LG.minutes_field(t) + LG.rating(t, 'How well do you remember it?') + LG.note_field(t))
    right = (lesson + LG.p(t, 'Setenta with the hair comb on 5, straight into the sombrero. Keep the frame through the comb.')
             + LG.section_head(t, 'Figures') + f'<div style="display: flex; flex-wrap: wrap; gap: 0 8px; margin-top: -6px">{figs}</div>'
             + LG.video_frame(t, 'Video 1', '3:24 · 4 sections', '3:24', 2, h=170))
    head = F.pane_head(t, 'Week 6 · Setenta into Sombrero', 'Lesson review · Salsa Tuesdays · due', actions=F.tonal(t, 'edit', 'Edit settings'),
                       below=last_line(t, 'Never', None, None).replace('Last time: Never', 'Not reviewed yet'))
    pane = F.pane(t, head, F.pane_cols(left, right, ('1fr', '1fr')), pane_foot(t, log_set(t)), 'Week 6')
    return today_frame(t, a_body(t, pane, sel='Week 6 · Setenta into Sombrero'))


def a_edit(t):
    left = log_form(t) + reference(t)
    right = owner(t) + settings_form(t) + history(t)
    pane = ex_pane(t, 'Figure practice · Every 3 days · due', left, right, pane_foot(t, log_set(t)),
                   actions=F.tonal(t, 'close', 'Stop editing'))
    return today_frame(t, a_body(t, pane, sel='Enchufla · Doble'))


def a_loading(t):
    small = kit.rgba(kit.CREAM, 0.28)
    sub = f'<span style="display: inline-block; width: 170px; height: 14px; border-radius: 7px; background: {small}; vertical-align: middle"></span>'
    hero_sk = (f'<div aria-hidden="true" style="min-height: 84px; box-sizing: border-box; border-radius: 22px; background: {t["surface"]}; '
               f'box-shadow: {t["shadow"]}; padding: 14px 14px 14px 20px; display: flex; align-items: center; gap: 14px; flex: none">'
               f'<span style="flex: 1; display: flex; flex-direction: column; gap: 10px">{TD.bone(t, "52%", 18, 9)}{TD.bone(t, "34%", 11)}</span>'
               f'<span style="width: 54px; height: 54px; border-radius: 27px; background: {t["skeleton"]}; flex: none"></span></div>')

    def lab(w, top):
        return f'<span style="padding: {top}px 16px 0">{TD.bone(t, w, 10, 5)}</span>'
    lst = F.col(hero_sk + lab('64px', 12) + kit.skeleton_rows(t, 4, 'Loading Today', leading=True) + lab('84px', 14)
                + kit.skeleton_rows(t, 3, 'Loading', leading=True), gap=8)
    ph = (f'<div aria-hidden="true" style="padding: 30px 40px; display: flex; flex-direction: column; gap: 14px">'
          f'{TD.bone(t, "260px", 26, 10)}{TD.bone(t, "200px", 12)}<span style="height: 18px"></span>'
          f'<span style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px">'
          f'<span style="display: flex; flex-direction: column; gap: 12px">{TD.bone(t, "100%", 70, 18)}{TD.bone(t, "100%", 56, 14)}{TD.bone(t, "100%", 52, 14)}</span>'
          f'<span style="display: flex; flex-direction: column; gap: 12px">{TD.bone(t, "100%", 60, 16)}{TD.bone(t, "100%", 70, 16)}{TD.bone(t, "100%", 120, 16)}</span>'
          f'</span></div>')
    pane = f'<section aria-label="Loading" style="flex: 1; min-width: 0">{ph}</section>'
    head_right = kit.band_button(t, 'chevron-left', 'Previous day', 'disabled') + kit.band_button(t, 'plus', 'Custom exercise', 'disabled')
    return F.frame(t, 'Today', 'Today', F.split(t, lst, pane, 'Today', width=TODAY_W), sub=sub, right=head_right)


# --------------------------------------------------------------------------
# boards: Option B
# --------------------------------------------------------------------------

def b_left(t, nxt=None, logged=(), hero_html=None, all_done=False):
    out = hero_html if hero_html is not None else hero(t)
    if not all_done:
        own, g = skip(own_due(t), logged), skip(g1_due(t), logged)
        out += (F.label(t, f'Due · {len(own) + len(g)}', 12) + b_rows(t, own, 'due', nxt)
                + group_head(t, G1, len(g)) + b_rows(t, g, 'due', nxt))
    extra = [r for r in [('Enchufla · Doble', 'Every 3 days', 'partner', 4), ('Dile que no · Basic', 'Every 3 days', 'partner', 4),
                         ('Clave clapping', 'Daily', 'drill', 5)] if r[0] in logged]
    done = own_done(t, extra)
    out += F.label(t, f'Done today · {len(done) + (2 if all_done else 0)}', 14) + b_rows(t, done, 'done')
    if all_done:
        g = [('Week 6 · Setenta into Sombrero', TD.done_txt(t, '1 set today') + TD.sep() + 'Tue 3 Nov class', 'lesson', 4),
             ('Setenta into Sombrero', TD.done_txt(t, '1 set today') + TD.sep() + 'Every 3 days', 'routine', 4)]
        out += group_head(t, G1, 2) + b_rows(t, g, 'done')
    return out


def b_right(t, inactive_open=False):
    up = own_upcoming(t)
    out = (F.label(t, f'Not yet due · {len(up) + 1}', 12) + b_rows(t, up, 'upcoming')
           + group_head(t, G2, 1) + b_rows(t, g2_upcoming(t), 'upcoming'))
    out += TD.fold_header(t, 'Inactive · 3', inactive_open)
    if inactive_open:
        out += b_rows(t, inactive(t), 'inactive')
    return out


def b_body(t, **kw):
    io = kw.pop('inactive_open', False)
    return F.two_col_page(b_left(t, **kw), b_right(t, io), max_w=1120)


def b_today(t):
    return today_frame(t, b_body(t))


def b_log(t):
    dlg = F.dialog(t, 'Enchufla · Doble', O.log_inner(t), sub=O.session_sub(t), footer=LG.log_button(t),
                   actions=O.log_actions(t), height=780)
    h = hero(t, 'Resume session', 'Next: Enchufla · Doble · 1 logged')
    return today_frame(t, b_body(t, nxt='Enchufla · Doble', logged=('Dile que no · Basic',), hero_html=h), dlg)


def b_all_done(t):
    body = b_body(t, all_done=True, hero_html=done_hero(t, 'All done for today', '7 exercises · 9 sets'),
                  logged=('Dile que no · Basic', 'Enchufla · Doble', 'Clave clapping'), inactive_open=True)
    return today_frame(t, body)


def b_ex_frame(t, body, right):
    return F.frame(t, 'Today', 'Enchufla · Doble', body, sub='Figure practice', back=F.back_btn(t, 'Today'), right=right)


def b_exercise(t):
    left = owner(t) + LG.section_head(t, 'Summary') + LG.history_summary(t, '23', '4 h 10', '3.8 ★') + settings_read(t) + reference(t) + archive(t)
    body = F.two_col_page(left, history(t).replace(LG.history_summary(t, '23', '4 h 10', '3.8 ★'), ''), ratio=('5fr', '6fr'),
                          footer=F.pinned(t, kit.button(t, 'Log a set', 'primary', icon_name='plus', full=True), max_w=1140))
    return b_ex_frame(t, body, F.act(t, 'edit', 'Edit settings'))


# --------------------------------------------------------------------------
# boards: both
# --------------------------------------------------------------------------

def first_run(t):
    acts = (f'<div style="display: flex; gap: 10px; justify-content: center">'
            f'{kit.button(t, "Build a routine", "primary", icon_name="route")}'
            f'{kit.button(t, "Custom exercise", "secondary", icon_name="plus")}</div>')
    es = kit.empty_state(t, 'calendar', 'Nothing to practise yet',
                         'Build a routine from your figures, or add a custom exercise.', acts)
    body = f'<div style="flex: 1; display: flex; align-items: center; justify-content: center; padding-bottom: 60px">{es}</div>'
    return today_frame(t, body)


NEW_H = 540


def new_exercise(t):
    inner = TD.new_ex_inner(t, 'focused', 'Hip roll drill|').replace('Hip roll drill|', 'Hip roll drill')
    dlg = F.dialog(t, 'New exercise', inner, footer=TD.new_ex_footer(t), height=NEW_H)
    return today_frame(t, a_body(t, pane_enchufla(t), sel='Enchufla · Doble'), dlg)


def how_often(t):
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
    dlg = F.dialog(t, 'How often', lst, sub='For Hip roll drill', back=True, height=NEW_H)
    return today_frame(t, a_body(t, pane_enchufla(t), sel='Enchufla · Doble'), dlg)


def past_frame(t, body, overlay=''):
    right = F.act(t, 'chevron-left', 'Previous day') + F.act(t, 'chevron-right', 'Next day')
    return F.frame(t, 'Today', 'Thu 29 Oct', body, sub='2 days ago', center=F.band_pill(t, 'Back to today', 'calendar'), right=right,
                   overlay=overlay, compact=True)


def past_body(t):
    body = (F.label(t, 'Logged that day · 4')
            + TD.day_group(t, 'Enchufla · Doble', 'partner', [('19:42', '15 min · ★★★★', 'smoother on the left side'), ('20:10', '5 min · ★★★', None)])
            + TD.day_group(t, 'Clave clapping · 2-3', 'drill', [('18:05', '8 min · 120 reps', None)])
            + TD.day_group(t, 'Tuesday class', 'lesson', [('21:30', '10 min · ★★★★★', 'the cross-body variation clicked')])
            + TD.day_group(t, 'Week 2 · Basics · Salsa Thursdays (deleted)', 'lesson', [('17:15', '20 min · ★★★', None)])
            + TD.forgot(t))
    return F.page(body, max_w=720)


def past_day(t):
    return past_frame(t, past_body(t))


def past_picker(t):
    g = lambda rows: f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">{rows}</div>'  # noqa: E731
    inner = (kit.search_field(t, 'Search exercises', state='focused')
             + F.label(t, 'Figures', 4)
             + g(TD.picker_heading(t, 'Dile que no', False)
                 + TD.picker_heading(t, 'Enchufla', True)
                 + TD.pick_row(t, 'Basic', 'Every 3 days', True) + TD.pick_row(t, 'Doble', 'Every 3 days', True)
                 + TD.picker_heading(t, 'Kentucky', False).replace(f'border-bottom: 1px solid {t["hairline"]}; ', ''))
             + F.label(t, 'Routines', 8) + g(TD.pick_row(t, 'Rueda opener', 'Every 3 days', last=True))
             + F.label(t, 'Drills', 8) + g(TD.pick_row(t, 'Clave clapping · 2-3', 'Daily') + TD.pick_row(t, 'Son basic', 'Every 2 days', last=True)))
    dlg = F.dialog(t, 'Log a set on Thu 29 Oct', inner, height=760)
    return past_frame(t, past_body(t), dlg)


# --------------------------------------------------------------------------

BOARDS = [
    # Option A
    F.Board('a-today', 'Today · the list and the open exercise', a_today,
            'Option A. Left (400 wide): Start session, Due, Done today, then Not yet due and Inactive below. Right: the open exercise — the log form '
            'and its reference on the left, the figure, history and settings on the right, Log set pinned under the form. One is always open: '
            'the first due one when you arrive. A row has no + of its own any more: clicking it opens the form. '
            'The exercise page and the log dialog both become this pane; an exercise opened from elsewhere (a figure, a lesson) opens Today with it selected.',
            **A),
    F.Board('a-none', 'Today · nothing open until you pick', a_none,
            'The other way to do Option A: the pane waits for a click, with Start session in it. I recommend the one above (always one open): '
            'on a computer the right half is never empty, and arriving shows what to do first.', **A_NONE),
    F.Board('a-session', 'Today · a session running', a_session,
            'Start session opens the first due one; the pane says “Session · 2 of 5”. Skip and Log set pinned under the form; the Up next row is the open one.', **A),
    F.Board('a-logged', 'Today · logged, Next', a_logged,
            'After Log set: Logged, and Next: Clave clapping as the main button. The set shows under History · Today; the row moved to Done today '
            'and stays open until you go Next.', **A),
    F.Board('a-session-done', 'Today · session done', a_session_done,
            'The last one logged: the Session done card at the top of the form, Finish pinned. The list has nothing due left.', **A),
    F.Board('a-all-done', 'Today · all done', a_all_done,
            'Nothing due: nothing is open, and the pane shows the day so far (every set logged today), like a past day. My call.', **A),
    F.Board('a-upcoming', 'Today · a not-yet-due routine open', a_upcoming,
            'Any row opens, due or not: logging early is fine. A routine’s form is Practise in player plus minutes and rating; its slots on the right.', **A),
    F.Board('a-lesson', 'Today · a group lesson to review', a_lesson,
            'A lesson’s entry (from Salsa Tuesdays): minutes and “How well do you remember it?” on the left, the lesson, its figures and videos on the right.', **A),
    F.Board('a-edit', 'Today · editing an exercise’s settings', a_edit,
            'The pencil in the pane turns into ×; the settings become the form in place with Save and Cancel. The log form stays usable.', **A),
    F.Board('a-loading', 'Today · loading', a_loading,
            'The skeleton draws the list and the pane.', **A),
    # Option B
    F.Board('b-today', 'Today · two columns', b_today,
            'Option B, from your second idea. Left: Start session, Due, and Done today at the bottom. Right: Not yet due and Inactive. '
            'A row opens the exercise page; its + opens the log dialog (as on the phone).', **B),
    F.Board('b-log', 'Today · logging a set in a session', b_log,
            'Option B keeps the log as a dialog in the middle (Skip, Details, Log set pinned).', **B),
    F.Board('b-all-done', 'Today · all done', b_all_done,
            'Nothing due: the All done card in the hero’s place, Done today under it; Inactive open on the right.', **B),
    F.Board('b-exercise', 'The exercise page', b_exercise,
            'Option B keeps the exercise page as its own page (‹ back to Today): the figure, summary, settings and reference left, the sets right, Log a set pinned.', **B),
    # Both
    F.Board('first-run', 'Today · first run', first_run,
            'Both options: no exercises yet, the empty state across the sheet. + on the band does the same as Custom exercise.', changed=True),
    F.Board('new-exercise', 'New exercise · the dialog', new_exercise,
            'From + on the band (Custom exercise). Name focused, How often, Notes; Add exercise pinned. Drawn over Option A.', changed=True),
    F.Board('how-often', 'New exercise · How often (stacked level)', how_often,
            'The stacked level in the same place and size, Back on the left, one scrim.', changed=True),
    F.Board('past-day', 'A past day', past_day,
            'Both options, unchanged: one column of the sets that day; Back to today in the middle of the band; ‹ › on the right. '
            'A lesson whose group was deleted keeps its name with “(deleted)”.'),
    F.Board('past-picker', 'A past day · pick an exercise', past_picker,
            'The shared picker as a dialog; its search is focused on open.'),
]


# Round 4: Option A is settled. Option B and the nothing-open variant are dropped; the rest lose their option labels.
BOARDS = [b for b in BOARDS if b.option in ('', 'A')]
for _b in BOARDS:
    _b.option, _b.rec, _b.changed = '', False, False
