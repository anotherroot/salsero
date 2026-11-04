"""Desktop boards · Today, logging a set, the exercise page."""
import frame as F
from frame import kit, ts, icon
import options as O

TD, LG = O.TD, O.LG

SECTION = ('today', 'Today')
DATE = O.DATE  # 'Saturday, 31 October'


# --------------------------------------------------------------------------
# helpers (local)
# --------------------------------------------------------------------------

def prev_day(t):
    return F.act(t, 'chevron-left', 'Previous day')


def today_frame(t, body, overlay=''):
    return F.frame(t, 'Today', 'Today', body, sub=DATE, right=prev_day(t), overlay=overlay)


def done_hero(t, title, meta):
    """The all-done hero, in the sheet (not straddling the band)."""
    return TD.done_hero(t, title, meta).replace('margin: -42px 0 10px', 'margin: 0')


def hero(t, title, meta):
    return kit.hero_card(t, title, meta, straddle=False)


def done_rows(t):
    return [
        TD.ex_row(t, 'Sombrero · Basic', TD.done_txt(t, '1 set today') + TD.sep() + 'Weekly', 'partner', 'done', 3),
        TD.ex_row(t, 'Tuesday class', TD.done_txt(t, '1 set today') + TD.sep() + 'Tue 27 Oct class', 'lesson', 'done', 5, last=True),
    ]


def inactive_rows(t):
    return [
        TD.ex_row(t, 'Hammerlock · Wrap', '12 days ago' + TD.sep() + 'Weekly', 'partner', 'inactive', 2),
        TD.ex_row(t, 'Media luna · Basic', 'Never done' + TD.sep() + 'Every 2 weeks', 'partner', 'inactive', None),
        TD.ex_row(t, 'Shadow footwork', '21 days ago' + TD.sep() + 'Weekly', 'solo', 'inactive', None, last=True),
    ]


def custom_button(t):
    return '<div style="height: 6px; flex: none"></div>' + kit.button(t, 'Custom exercise', 'secondary', icon_name='plus', full=True)


# --------------------------------------------------------------------------
# a group's rows: what its lessons put on Today (groups spec, mockups 6: a heading per group)
# --------------------------------------------------------------------------

G1, G2 = 'Salsa Tuesdays', 'Rueda club'


def group_head(t, name, n, top=6):
    """A group's heading inside a band: the people icon and "Salsa Tuesdays · 2" (today.ts teamPart label)."""
    return (f'<h3 style="margin: 0; padding: {top}px 16px 0; display: flex; align-items: center; gap: 6px; {ts("label", t["muted"])}">'
            f'{icon("people", 16, t["muted"])}{name} · {n}</h3>')


def rows_of(t, items, band, nxt=None):
    return [TD.ex_row(t, n, m, k, band, r, last=i == len(items) - 1, nxt=(n == nxt)) for i, (n, m, k, r) in enumerate(items)]


def g1_due(t):
    return [('Week 6 · Setenta into Sombrero', TD.st(t, 'Never done') + TD.sep() + 'Tue 3 Nov class', 'lesson', None),
            ('Setenta into Sombrero', TD.st(t, '4 days ago') + TD.sep() + 'Every 3 days', 'routine', 3)]


def g2_upcoming(t):
    return [('Cross-body footwork', 'Yesterday' + TD.sep() + 'Every 2 days', 'drill', 4)]


def own_due(t, logged=()):
    rows = [('Dile que no · Basic', TD.st(t, 'Never done') + TD.sep() + 'Every 3 days', 'partner', None),
            ('Enchufla · Doble', TD.st(t, '4 days ago') + TD.sep() + 'Every 3 days', 'partner', 3),
            ('Clave clapping', TD.st(t, '2 days ago') + TD.sep() + 'Daily', 'drill', 5)]
    return [r for r in rows if r[0] not in logged]


def due_band(t, nxt=None, logged=()):
    own, g = own_due(t, logged), g1_due(t)
    return (F.label(t, f'Due · {len(own) + len(g)}', 12) + TD.group(t, rows_of(t, own, 'due', nxt))
            + group_head(t, G1, len(g)) + TD.group(t, rows_of(t, g, 'due', nxt)))


def today_left(t, nxt=None, hero=('Start session', '5 due · 5 not yet due'), logged=()):
    return hero_card(t, *hero) + due_band(t, nxt, logged)


def upcoming_band(t):
    g = g2_upcoming(t)
    return (F.label(t, 'Not yet due · 5') + TD.group(t, TD.upcoming_rows(t))
            + group_head(t, G2, len(g)) + TD.group(t, rows_of(t, g, 'upcoming')))


def hero_card(t, title, meta):
    return kit.hero_card(t, title, meta, straddle=False)


def right_col(t, done=None, inactive_open=False):
    out = upcoming_band(t)
    out += F.label(t, f'Done today · {len(done or done_rows(t))}', 14) + TD.group(t, done or done_rows(t))
    out += TD.fold_header(t, 'Inactive · 3', inactive_open)
    if inactive_open:
        out += TD.group(t, inactive_rows(t))
    return out + custom_button(t)


def today_body(t):
    return F.two_col_page(today_left(t), right_col(t), max_w=1120)


def session_done_rows(t):
    return [
        TD.ex_row(t, 'Dile que no · Basic', TD.done_txt(t, '1 set today') + TD.sep() + 'Every 3 days', 'partner', 'done', 4),
    ] + done_rows(t)


def session_body(t):
    return F.two_col_page(today_left(t, 'Enchufla · Doble', ('Resume session', 'Next: Enchufla · Doble · 1 logged'), ('Dile que no · Basic',)),
                          right_col(t, session_done_rows(t)), max_w=1120)


def stars_sub(t, days, n=None, note=None):
    return LG.last_time_html(t, days, n, note)


# --------------------------------------------------------------------------
# boards: Today
# --------------------------------------------------------------------------

def today(t):
    return today_frame(t, today_body(t))


def session(t):
    return today_frame(t, session_body(t))


def log(t):
    dlg = F.dialog(t, 'Enchufla · Doble', O.log_inner(t), sub=O.session_sub(t), footer=LG.log_button(t),
                   actions=O.log_actions(t), height=780)
    return today_frame(t, session_body(t), dlg)


def logged(t):
    c = LG.section_head(t, 'Reference', LG.hide_button(t, False))
    c += LG.panel_card(t, LG.panel_head(t, 'Count 180 · 1 2 3 · 5 6 7 · clave 2-3 · call every 4'))
    c += LG.two(LG.minutes_field(t), LG.reps_field(t))
    c += LG.rating(t, 'How did it go?')
    c += LG.note_field(t)
    c += LG.sets_list(t, 'Sets today', [('12:42', LG.set_summary(t, 6, None, 4), 'Turn felt late on 6 — prep earlier')])
    sub = 'Session · 2 logged so far<br>' + stars_sub(t, 'Today', 4, 'Turn felt late on 6 — prep earlier')
    foot = LG.log_button(t, 'logged') + TD.next_button(t, 'Clave clapping')
    dlg = F.dialog(t, 'Enchufla · Doble', c, sub=sub, footer=foot, actions=O.log_actions(t), height=780)
    return today_frame(t, session_body(t), dlg)


def session_done(t):
    c = LG.drill_content(t, short=True)
    c += LG.panel_card(t, LG.panel_head(t, 'Valió la pena 0.9× · 1 2 3 · 5 6 7 · clave 2-3'))
    c += LG.two(LG.minutes_field(t), LG.reps_field(t))
    c += LG.sets_list(t, 'Sets today', [('12:58', LG.set_summary(t, 6, 200, 5), None)])
    done = (f'<div role="status" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 16px; background: {t["done_soft"]}">'
            f'{kit.done_check(t, 28)}<span style="display: flex; flex-direction: column; gap: 1px"><span style="font-size: 16px; font-weight: 800; color: {t["ink"]}">Session done</span>'
            f'<span style="font-size: 13px; font-weight: 700; color: {t["done"]}">3 exercises, 24 min</span></span></div>')
    foot = LG.log_button(t, 'logged') + done + kit.button(t, 'Finish', 'primary', full=True, on=t['sheet_bg'])
    dlg = F.dialog(t, 'Clave clapping · 2-3', c, sub='Session · last on the list<br>' + stars_sub(t, 'Today', 5),
                   footer=foot, actions=LG.details_link(t), height=780)
    g = [TD.ex_row(t, 'Week 6 · Setenta into Sombrero', TD.done_txt(t, '1 set today') + TD.sep() + 'Tue 3 Nov class', 'lesson', 'done', 4),
         TD.ex_row(t, 'Setenta into Sombrero', TD.done_txt(t, '1 set today') + TD.sep() + 'Every 3 days', 'routine', 'done', 4, last=True)]
    left = (done_hero(t, 'All done for today', '5 exercises · 6 sets')
            + F.label(t, 'Done today · 5', 12) + TD.group(t, [
                TD.ex_row(t, 'Dile que no · Basic', TD.done_txt(t, '1 set today') + TD.sep() + 'Every 3 days', 'partner', 'done', 4),
                TD.ex_row(t, 'Enchufla · Doble', TD.done_txt(t, '1 set today') + TD.sep() + 'Every 3 days', 'partner', 'done', 4),
                TD.ex_row(t, 'Clave clapping · 2-3', TD.done_txt(t, '1 set today') + TD.sep() + 'Daily', 'drill', 'done', 5, last=True)])
            + group_head(t, G1, 2) + TD.group(t, g))
    right = upcoming_band(t) + TD.fold_header(t, 'Inactive · 3') + custom_button(t)
    return today_frame(t, F.two_col_page(left, right, max_w=1120), dlg)


def all_done(t):
    rows = [
        TD.ex_row(t, 'Clave clapping', TD.done_txt(t, '2 sets today') + TD.sep() + 'Daily', 'drill', 'done', 5),
        TD.ex_row(t, 'Enchufla · Doble', TD.done_txt(t, '1 set today') + TD.sep() + 'Every 3 days', 'partner', 'done', 4),
        TD.ex_row(t, 'Dile que no · Basic', TD.done_txt(t, '2 sets today') + TD.sep() + 'Every 3 days', 'partner', 'done', 3),
        TD.ex_row(t, 'Sombrero · Basic', TD.done_txt(t, '1 set today') + TD.sep() + 'Weekly', 'partner', 'done', 3),
        TD.ex_row(t, 'Tuesday class', TD.done_txt(t, '1 set today') + TD.sep() + 'Tue 27 Oct class', 'lesson', 'done', 5, last=True),
    ]
    g = [TD.ex_row(t, 'Week 6 · Setenta into Sombrero', TD.done_txt(t, '1 set today') + TD.sep() + 'Tue 3 Nov class', 'lesson', 'done', 4),
         TD.ex_row(t, 'Setenta into Sombrero', TD.done_txt(t, '1 set today') + TD.sep() + 'Every 3 days', 'routine', 'done', 4, last=True)]
    left = (done_hero(t, 'All done for today', '7 exercises · 9 sets') + F.label(t, 'Done today · 7', 12) + TD.group(t, rows)
            + group_head(t, G1, 2) + TD.group(t, g))
    right = upcoming_band(t) + TD.fold_header(t, 'Inactive · 3', True) + TD.group(t, inactive_rows(t)) + custom_button(t)
    return today_frame(t, F.two_col_page(left, right, max_w=1120))


def first_run(t):
    acts = (f'<div style="display: flex; gap: 10px; justify-content: center">'
            f'{kit.button(t, "Build a routine", "primary", icon_name="route")}'
            f'{kit.button(t, "Custom exercise", "secondary", icon_name="plus")}</div>')
    es = kit.empty_state(t, 'calendar', 'Nothing to practise yet',
                         'Build a routine from your figures, or add a custom exercise.', acts)
    body = f'<div style="flex: 1; display: flex; align-items: center; justify-content: center; padding-bottom: 60px">{es}</div>'
    return today_frame(t, body)


def loading(t):
    small = kit.rgba(kit.CREAM, 0.28)
    sub = f'<span style="display: inline-block; width: 170px; height: 14px; border-radius: 7px; background: {small}; vertical-align: middle"></span>'
    hero_sk = (f'<div aria-hidden="true" style="min-height: 84px; box-sizing: border-box; border-radius: 22px; background: {t["surface"]}; '
               f'box-shadow: {t["shadow"]}; padding: 14px 14px 14px 20px; display: flex; align-items: center; gap: 14px; flex: none">'
               f'<span style="flex: 1; display: flex; flex-direction: column; gap: 10px">{TD.bone(t, "52%", 18, 9)}{TD.bone(t, "34%", 11)}</span>'
               f'<span style="width: 54px; height: 54px; border-radius: 27px; background: {t["skeleton"]}; flex: none"></span></div>')

    def lab(w, top):
        return f'<span style="padding: {top}px 16px 0">{TD.bone(t, w, 10, 5)}</span>'
    left = hero_sk + lab('64px', 12) + kit.skeleton_rows(t, 3, 'Loading Today', leading=True)
    right = lab('96px', 2) + kit.skeleton_rows(t, 4, 'Loading', leading=True) + lab('84px', 14) + kit.skeleton_rows(t, 2, 'Loading', leading=True)
    head_right = kit.band_button(t, 'chevron-left', 'Previous day', 'disabled')
    return F.frame(t, 'Today', 'Today', F.two_col_page(left, right, max_w=1120), sub=sub, right=head_right)


# --------------------------------------------------------------------------
# boards: a past day
# --------------------------------------------------------------------------

def past_frame(t, body, overlay='', day='Thu 29 Oct', ago='2 days ago'):
    right = F.act(t, 'chevron-left', 'Previous day') + F.act(t, 'chevron-right', 'Next day')
    return F.frame(t, 'Today', day, body, sub=ago, center=F.band_pill(t, 'Back to today', 'calendar'), right=right,
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
# boards: New exercise
# --------------------------------------------------------------------------

NEW_H = 540


def new_exercise(t):
    inner = TD.new_ex_inner(t, 'focused', 'Hip roll drill|').replace('Hip roll drill|', 'Hip roll drill')
    dlg = F.dialog(t, 'New exercise', inner, footer=TD.new_ex_footer(t), height=NEW_H)
    return today_frame(t, today_body(t), dlg)


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
    return today_frame(t, today_body(t), dlg)


# --------------------------------------------------------------------------
# boards: the exercise page
# --------------------------------------------------------------------------

def owner(t):
    return LG.owner_row(t, 'Enchufla · Doble', 'Figure · open the figure', 'footprints')


def reference(t):
    return (LG.section_head(t, 'Reference')
            + LG.p(t, LG.FIG_NOTES)
            + kit.list_group(t, [LG.section_card(t, 'The double prep', 'Thursday class · 22 Oct', '1:12–1:31')])
            + f'<a href="#" style="display: flex; align-items: center; gap: 6px; padding: 4px 4px 0; font-size: 14px; font-weight: 800; color: {t["accent_text"]}; '
              f'text-decoration: none">Edit links on the figure page{icon("chevron-right", 18, t["accent_text"])}</a>')


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
    return LG.section_head(t, 'Settings') + kit.card(t, s, gap=14)


def archive(t):
    return f'<div style="display: flex; justify-content: flex-start; padding-top: 6px">{kit.button(t, "Archive exercise", "danger_text")}</div>'


def history(t):
    out = LG.section_head(t, 'History · 23 sets')
    out += LG.sets_list(t, 'Today', [('12:42', LG.set_summary(t, 6, None, 4), 'Turn felt late on 6 — prep earlier')]).replace(
        LG.section_head(t, 'Today'), F.label(t, 'Today', 4))
    out += LG.sets_list(t, 'Tuesday, 27 October', [('20:05', LG.set_summary(t, 12, None, 3), 'lost the count at the break'),
                                                    ('07:50', LG.set_summary(t, 8, 20, None), None)])
    out += LG.sets_list(t, 'Saturday, 24 October', [('13:10', LG.set_summary(t, 15, None, 4), None)])
    out += LG.sets_list(t, 'Wednesday, 21 October', [('12:30', LG.set_summary(t, 10, None, 3), 'prep on 3 is late')])
    return out


def ex_frame(t, body, right, overlay=''):
    return F.frame(t, 'Today', 'Enchufla · Doble', body, sub='Figure practice', back=F.back_btn(t, 'Today'), right=right, overlay=overlay)


def log_bar(t):
    return F.pinned(t, kit.button(t, 'Log a set', 'primary', icon_name='plus', full=True), max_w=1140)


def exercise(t):
    left = owner(t) + LG.section_head(t, 'Summary') + LG.history_summary(t, '23', '4 h 10', '3.8 ★') + settings_read(t) + reference(t) + archive(t)
    body = F.two_col_page(left, history(t), ratio=('5fr', '6fr'), footer=log_bar(t))
    return ex_frame(t, body, F.act(t, 'edit', 'Edit settings'))


def exercise_edit(t):
    left = owner(t) + LG.section_head(t, 'Summary') + LG.history_summary(t, '23', '4 h 10', '3.8 ★') + settings_form(t) + archive(t)
    save = F.pinned(t, kit.button(t, 'Save', 'primary', full=True), max_w=1140)
    body = F.two_col_page(left, history(t), ratio=('5fr', '6fr'), footer=save)
    return ex_frame(t, body, F.act(t, 'close', 'Stop editing'))


# --------------------------------------------------------------------------

BOARDS = [
    F.Board('today', 'Today · a session not started', today,
            'Two equal columns (max 1120): the hero and Due on the left; Not yet due, Done today, Inactive and Custom exercise on the right. '
            'New: what a group’s lessons put on Today sits under a heading per group after your own rows, in each band (“Salsa Tuesdays · 2”). '
            'The side has five tabs now (Groups between Lessons and Music).'),
    F.Board('session', 'Today · a session running', session,
            'Resume session in the hero; the next row tinted with Up next; what was logged moves to Done today.'),
    F.Board('log', 'Logging a set · the dialog in a session', log,
            'The phone’s tall log sheet as a 560 px dialog: Skip and Details in the header, Log set pinned in its footer. The scrim covers the band and side too.'),
    F.Board('logged', 'Logging a set · logged, Next', logged,
            'After Log set: Logged (done colours), Next: Clave clapping as the main button; the set listed under Sets today.'),
    F.Board('session-done', 'Logging a set · session done', session_done,
            'The last exercise logged: the Session done card and Finish in the dialog. Behind it Today has nothing due left.'),
    F.Board('all-done', 'Today · all done', all_done,
            'Nothing due: the quiet All done card takes the hero’s place; Inactive shown open.'),
    F.Board('first-run', 'Today · first run', first_run,
            'No exercises at all: the empty state centred across the sheet, its two buttons side by side (my call: on the phone they stack).'),
    F.Board('past-day', 'A past day', past_day,
            'Compact title and “2 days ago” beside it; Back to today in the middle of the band; ‹ › on the right. One column (720): sets per exercise, + adds a set to that day. '
            'A lesson whose group was deleted keeps its name: “… · Salsa Thursdays (deleted)”.'),
    F.Board('past-picker', 'A past day · pick an exercise', past_picker,
            'The shared picker as a dialog; its search is focused on open (no on-screen keyboard to pop up on a PC).'),
    F.Board('new-exercise', 'New exercise · the dialog', new_exercise,
            'From Custom exercise. Name focused, How often, Notes; Add exercise and the hint pinned in the footer.'),
    F.Board('how-often', 'New exercise · How often (stacked level)', how_often,
            'The stacked level opens in the same place and size as New exercise, with Back on the left and no ×; one scrim.'),
    F.Board('exercise', 'The exercise page', exercise,
            'Lights Today, ‹ back. Left: the owner (a figure: “Enchufla · Doble”, move · figure), the three stat tiles, the settings (read), the figure’s reference, Archive. Right: the sets by day. '
            'Log a set pinned at the bottom of the sheet. My call: the reference sits in the left column under the settings.'),
    F.Board('exercise-edit', 'The exercise page · editing its settings', exercise_edit,
            'The pencil turns into × (Stop editing); the settings become the form; one Save pinned. My call: the history stays beside the form.'),
    F.Board('loading', 'Today · loading', loading,
            'The skeleton draws the frame and both columns: the hero’s shape, then rows.'),
]
