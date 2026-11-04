"""Desktop · options to decide: four questions, two or three answers each, drawn at 1440 x 900.

    python3 -I options.py  -> canvas/project/*.dc.html + canvas/project/canvas.json
"""
import datetime
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import desk  # noqa: E402
from desk import kit, icon, ts, CREAM, col, label  # noqa: E402
import today as TD  # noqa: E402
import moves as MV  # noqa: E402
import figure as FG  # noqa: E402
import logging as LG  # noqa: E402  (the board's logging.py, not the stdlib)

OUT = os.path.join(desk.S, 'canvas', 'project')
DATE = 'Saturday, 31 October'


# --------------------------------------------------------------------------
# shared content
# --------------------------------------------------------------------------

def done_rows(t):
    return [TD.ex_row(t, 'Sombrero · Basic', TD.done_txt(t, '1 set today') + TD.sep() + 'Weekly', 'partner', 'done', 3),
            TD.ex_row(t, 'Tuesday class', TD.done_txt(t, '1 set today') + TD.sep() + 'Tue 27 Oct class', 'lesson', 'done', 5, last=True)]


SESSION = ('Resume session', 'Next: Enchufla · Doble · 1 logged')


def today_left(t, nxt=None, hero=('Start session', '3 due · 4 not yet due'), logged=()):
    rows = TD.due_rows(t, nxt=nxt, logged=logged)
    return (kit.hero_card(t, hero[0], hero[1], straddle=False)
            + label(t, f'Due · {len(rows)}', 12) + TD.group(t, rows))


def session_left(t):
    return today_left(t, 'Enchufla · Doble', SESSION, ('Dile que no · Basic',))


def today_right(t):
    return (label(t, 'Not yet due · 4') + TD.group(t, TD.upcoming_rows(t))
            + label(t, 'Done today · 2', 14) + TD.group(t, done_rows(t))
            + TD.fold_header(t, 'Inactive · 3')
            + kit.button(t, 'Custom exercise', 'secondary', icon_name='plus', full=True))


def today_two_cols(t):
    return desk.scroll_area(desk.grid2(today_left(t), today_right(t)), pad='28px 40px', max_w=1120)


def prev_day(t):
    return kit.band_button(t, 'chevron-left', 'Previous day')


def moves_head_a(t):
    seg = f'<div style="width: 340px">{kit.segmented(t, ["Figures", "Routines"], 0, on_band=True, label="Moves")}</div>'
    return desk.head_a(t, 'Moves', right=desk.band_pill_button(t, 'New figure', 'plus'), extra=seg)


def fig_chips(t, wrap=True):
    items = ['All', 'Not linked'] + MV.styles(t) + ['With partner', 'Solo']
    out = ''.join(kit.chip(t, it, it == 'All', count=5 if it == 'Not linked' else None) for it in items)
    return (f'<div role="group" aria-label="Filter figures" style="display: flex; gap: 8px; flex-wrap: {"wrap" if wrap else "nowrap"}; flex: none">{out}</div>')


def fig_list_rows(t, selected='Enchufla'):
    out = []
    items = MV.figs(t)
    for i, (n, v, r, s, l) in enumerate(items):
        html = kit.row(t, n, MV.fig_meta(t, v, r, s, l), kit.chevron(t), href='#', last=i == len(items) - 1)
        if n == selected:
            html = html.replace('background: transparent', f'background: {t["accent_soft"]}', 1).replace('<a href="#"', '<a href="#" aria-current="page"', 1)
        out.append(html)
    return out


def icon_tonal(t, name, lab):
    return kit.icon_button(t, name, lab, 'tonal', on=t['ground'])


def rec_card(t, h, dur, spots, date='Wednesday 28 October', size='34 MB', tone=0):
    """A recording: the picture (our own controls on it), date · size, Mirror · speed · Full screen, its sections."""
    th = kit.thumb(t, 358, h, dur, tone, radius=0).replace('width: 358px', 'width: 100%')
    tools = (kit.icon_button(t, 'mirror', 'Mirror', 'bare', color=t['muted'], on=t['surface'])
             + LG.speed_switch(t, 3)
             + kit.icon_button(t, 'expand', 'Full screen', 'bare', color=t['muted'], on=t['surface']))
    meta = (f'<div style="display: flex; align-items: center; gap: 8px; padding: 6px 8px 6px 16px">'
            f'<span style="flex: 1; font-size: 13px; color: {t["muted"]}">{date} · {size}</span>{tools}</div>')
    rows = ''
    for i, (title, m, linked) in enumerate(spots):
        tr = kit.icon_button(t, 'link', f'Link {title}', 'bare', color=t['accent_text'], on=t['surface'])
        rows += kit.row(t, title, m, tr, leading=FG.play_disc(t, 36), last=i == len(spots) - 1, min_h=58)
    sec = (f'<div style="border-top: 1px solid {t["hairline"]}"><div style="padding: 10px 16px 0; {kit.ts("label", t["muted"])}">'
           f'Sections · {len(spots)}</div>{rows}</div>') if spots else ''
    return f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">{th}{meta}{sec}</div>'


SPOTS = [('Second turn', '0:12–0:19 · Linked to Hammerlock · Basic', True), ('0:24–0:31', 'Not linked', False)]


def fig_summary(t):
    return FG.summary(t, [kit.badge(t, 'Salsa', 'accent'), kit.badge(t, 'With partner', 'neutral', icon_name='people')],
                      1, 16, 'Open two hands', 'Hammerlock', FG.DOBLE_NOTES)


def fig_practice(t):
    return (label(t, 'Practice', 8)
            + kit.list_group(t, [dict(title='Every 3 days', meta='2 days overdue', meta_tone='status', trailing=kit.log_button(t, 'Enchufla · Doble')),
                                 dict(title='Its exercise', meta='History, how often, active', trailing=kit.chevron(t), href='#')]))


def fig_routines(t):
    return (label(t, 'In routines · 2', 8)
            + kit.list_group(t, [dict(title='Social set A', meta='Slots 2 and 5 · loops', trailing=kit.chevron(t), href='#'),
                                 dict(title='Cubana combo', meta='Slot 3 of 6', trailing=kit.chevron(t), href='#')]))


def follows_leads(t, side_by_side=True):
    def card(title, items):
        body = ''.join(
            f'<a href="#" style="display: flex; align-items: center; justify-content: space-between; gap: 4px; min-height: 44px; '
            f'{"" if i == len(items) - 1 else "border-bottom: 1px solid " + t["hairline"] + ";"} text-decoration: none; color: {t["ink"]}; font-size: 15px; font-weight: 700">'
            f'<span style="min-width: 0">{it}</span>{kit.chevron(t)}</a>' for i, it in enumerate(items))
        return (f'<div style="flex: 1; min-width: 0; background: {t["surface"]}; border-radius: 16px; padding: 12px 10px 4px 16px">'
                f'<span style="{kit.ts("label", t["muted"])}">{title}</span>{body}</div>')
    a = card('Follows from', ['Dile que no · Basic', 'Setenta · Basic'])
    b = card('Leads to', ['Hammerlock · Basic', 'Sombrero · Basic'])
    d = 'row' if side_by_side else 'column'
    return f'<div style="display: flex; flex-direction: {d}; gap: 8px; margin-top: 8px; flex: none">{a}{b}</div>'


def linked_sections(t):
    link_btn = kit.button(t, 'Link a section', 'tertiary', icon_name='link', size='sm')
    return (label(t, 'Linked sections · 2', 10, link_btn)
            + kit.list_group(t, [FG.section_row(t, 'Doble, slow', 'Cubana class · 13 Oct · 0:42–0:55'),
                                 FG.section_row(t, '1:06–1:14', 'Recording · Enchufla · Basic', last=True)]))


def taught_in(t):
    return (label(t, 'Taught in · 2', 10)
            + kit.list_group(t, [dict(title='Cubana class', meta='Tuesday 13 October', trailing=kit.chevron(t), href='#'),
                                 dict(title='Turn pattern workshop', meta='Saturday 3 October', trailing=kit.chevron(t), href='#')]))


# --------------------------------------------------------------------------
# 1 · where the four tabs go
# --------------------------------------------------------------------------

def q1_a(t):
    head = desk.head_a(t, 'Today', DATE, right=prev_day(t))
    return desk.frame_a(t, 'Today', head, today_two_cols(t))


def q1_b(t):
    return desk.frame_b(t, 'Today', 'Today', DATE, right=prev_day(t), body=today_two_cols(t))


def q1_c(t):
    return desk.frame_c(t, 'Today', 'Today', DATE, right=prev_day(t), body=today_two_cols(t))


# --------------------------------------------------------------------------
# 2 · opening something from a list
# --------------------------------------------------------------------------

def figure_pane(t):
    """The figure page as the right-hand pane of Moves."""
    head = (f'<div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex: none">'
            f'<div style="display: flex; flex-direction: column; gap: 12px; min-width: 0">'
            f'<h2 style="margin: 0; {ts("display_s", t["ink"])}">Enchufla</h2>{desk.var_tabs(t, ["Basic", "Doble", "Complicada"], 1, on_band=False)}</div>'
            f'<div style="display: flex; gap: 8px">{icon_tonal(t, "edit", "Edit Doble")}{icon_tonal(t, "more", "More")}</div></div>')
    body = desk.grid2(fig_summary(t) + fig_practice(t), fig_routines(t) + follows_leads(t, False), gap=24)
    rec = label(t, 'Recordings · 2', 8) + rec_card(t, 300, '0:41', SPOTS)
    return (f'<section aria-label="Enchufla · Doble" style="flex: 1; min-width: 0; overflow: hidden; padding: 26px 40px; box-sizing: border-box; '
            f'display: flex; flex-direction: column; gap: 18px">{head}{body}{col(rec)}</section>')


def q2_a_body(t):
    lst = (kit.search_field(t, 'Search figures') + MV.tiles(t) + fig_chips(t)
           + label(t, '8 figures', 6) + kit.list_group(t, fig_list_rows(t)))
    pane = (f'<section aria-label="Figures" style="width: 392px; flex: none; box-sizing: border-box; border-right: 1px solid {t["hairline"]}; '
            f'padding: 24px 20px 0 24px; overflow: hidden; display: flex; flex-direction: column; gap: 10px">{lst}</section>')
    return f'<div style="flex: 1; min-height: 0; display: flex">{pane}{figure_pane(t)}</div>'


def q2_a(t):
    return desk.frame_a(t, 'Moves', moves_head_a(t), q2_a_body(t))


ROUTINES = {'Dile que no': 3, 'Enchufla': 2, 'Exhíbela': 0, 'Kentucky': 1, 'Setenta': 2, 'Sombrero': 1, 'Vacílala': 0, 'Prima con la hermana': 0}


def q2_b(t):
    cols = 'minmax(0, 2.2fr) repeat(5, minmax(0, 1fr)) 44px'
    hstyle = f'{kit.ts("label", t["muted"])}; display: flex; align-items: center; gap: 4px'
    heads = ['Figure', 'Variations', 'Recordings', 'Sections', 'Lessons', 'Routines', '']
    hrow = ''.join(f'<span style="{hstyle}">{h}{icon("chevron-down", 16, t["muted"]) if h == "Figure" else ""}</span>' for h in heads)
    head = (f'<div role="row" style="display: grid; grid-template-columns: {cols}; gap: 12px; padding: 12px 8px 10px 20px; '
            f'border-bottom: 1px solid {t["hairline"]}">{hrow}</div>')
    rows = ''
    items = MV.figs(t)
    st = f'color: {t["status"]}; font-weight: 700'
    for i, (n, v, r, s, l) in enumerate(items):
        rt = ROUTINES.get(n, 0)
        cells = [f'<span style="font-size: 16px; font-weight: 700; color: {t["ink"]}">{n}</span>',
                 f'<span>{v}</span>', f'<span>{r or "—"}</span>',
                 f'<span>{r if s else ""}</span>' if s else f'<span style="{st}">None</span>',
                 '<span>1</span>' if l else f'<span style="{st}">None</span>',
                 f'<span>{rt}</span>' if rt else f'<span style="{st}">None</span>',
                 kit.chevron(t)]
        hover = f'background: {t["pressed"]};' if n == 'Kentucky' else ''
        hair = '' if i == len(items) - 1 else f'border-bottom: 1px solid {t["hairline"]};'
        rows += (f'<a href="#" role="row" style="display: grid; grid-template-columns: {cols}; gap: 12px; align-items: center; min-height: 56px; '
                 f'padding: 0 8px 0 20px; text-decoration: none; color: {t["ink2"]}; font-size: 15px; font-weight: 600; {hair} {hover}">{"".join(cells)}</a>')
    table = (f'<div role="table" aria-label="Figures" style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">'
             f'{head}{rows}</div>')
    tools = (f'<div style="display: flex; align-items: center; gap: 16px; flex: none">'
             f'<div style="width: 340px; flex: none">{kit.search_field(t, "Search figures")}</div>{fig_chips(t, wrap=False)}</div>')
    tiles = f'<div style="width: 600px">{MV.tiles(t)}</div>'
    body = desk.scroll_area(tiles + tools + label(t, '8 figures', 10) + table, pad='26px 40px', gap=12)
    return desk.frame_a(t, 'Moves', moves_head_a(t), body)


# --------------------------------------------------------------------------
# 3 · a figure page with room
# --------------------------------------------------------------------------

def figure_head(t):
    return desk.head_a(t, 'Enchufla', left=kit.band_button(t, 'back', 'Back to Moves'),
                       right=desk.band_pill_button(t, 'Edit Doble', 'edit') + kit.band_button(t, 'more', 'More'),
                       extra=f'<div style="padding-left: 40px">{desk.var_tabs(t, ["Basic", "Doble", "Complicada"], 1)}</div>', tall=True)


def q3_a(t):
    return desk.frame_a(t, 'Moves', figure_head(t), q3_a_body(t))


def q3_a_body(t):
    left = fig_summary(t) + fig_practice(t) + fig_routines(t) + follows_leads(t, True) + taught_in(t)
    right = label(t, 'Recordings · 2') + rec_card(t, 340, '0:41', SPOTS) + linked_sections(t)
    return desk.scroll_area(desk.grid2(left, right, left='minmax(0, 5fr)', right='minmax(0, 7fr)'), pad='26px 40px', max_w=1140)


def q3_b(t):
    th = kit.thumb(t, 358, 380, '0:41', 0, radius=16).replace('width: 358px', 'width: 100%')
    tools = (f'<div style="display: flex; align-items: center; gap: 8px; padding: 2px 0 0 4px">'
             f'<span style="flex: 1; font-size: 13px; color: {t["muted"]}">Wednesday 28 October · 34 MB</span>'
             f'{kit.icon_button(t, "mirror", "Mirror", "bare", color=t["muted"], on=t["ground"])}{LG.speed_switch(t, 3)}'
             f'{kit.icon_button(t, "expand", "Full screen", "bare", color=t["muted"], on=t["ground"])}</div>')
    recs = (f'<div role="group" aria-label="Recordings" style="display: flex; gap: 8px">'
            + kit.chip(t, 'Wed 28 Oct · 0:41', True) + kit.chip(t, 'Sat 24 Oct · 1:12') + kit.chip(t, 'Add', icon_name='upload') + '</div>')
    spots = kit.list_group(t, [kit.row(t, a, b, kit.icon_button(t, 'link', f'Link {a}', 'bare', color=t['accent_text'], on=t['surface']),
                                       leading=FG.play_disc(t, 36), last=i == len(SPOTS) - 1, min_h=58) for i, (a, b, _) in enumerate(SPOTS)])
    side = (label(t, 'Recordings · 2') + recs + label(t, 'Sections on this recording · 2', 10) + spots + linked_sections(t))
    top = (f'<div style="display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 4fr); gap: 28px; align-items: start; flex: none">'
           f'{col(th + tools, 6)}{col(side)}</div>')
    facts = (f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; align-items: start; margin-top: 18px; flex: none">'
             f'{col(fig_summary(t))}{col(fig_practice(t).replace("padding: 8px 16px 0", "padding: 0 16px 0", 1))}{col(follows_leads(t, False))}</div>')
    body = desk.scroll_area(top + facts, pad='26px 40px', max_w=1140)
    return desk.frame_a(t, 'Moves', figure_head(t), body)


# --------------------------------------------------------------------------
# 4 · popups (the phone's bottom sheets) — here, logging a set
# --------------------------------------------------------------------------

def log_inner(t):
    ref = label(t, 'Reference', 0, LG.hide_button(t, False))
    panel = LG.panel_card(t, LG.panel_head(t, 'Count 180 · 1 2 3 · 5 6 7 · clave 2-3 · call every 4')
                          + LG.banked(t, '6:12 practised — Play carries on'))
    return (ref + panel
            + LG.two(LG.minutes_field(t, '6', 'filled', helper='From the practice: 6:12'), kit.text_field(t, 'Reps', '', '0', 'empty', optional=True))
            + LG.rating(t, 'How did it go?', 4)
            + LG.note_field(t, 'Turn felt late on 6 — prep earlier', 'filled'))


def log_sub(t):
    return LG.last_time_html(t, '3 days ago', 3, 'lost the count at the break')


def log_actions(t):
    return LG.skip_button(t) + LG.details_link(t)


def session_sub(t):
    return 'Session · 1 logged so far<br>' + log_sub(t)


def q4_a(t):
    head = desk.head_a(t, 'Today', DATE, right=prev_day(t))
    page = desk.scroll_area(session_left(t) + label(t, 'Not yet due · 4', 14) + TD.group(t, TD.upcoming_rows(t)),
                            pad='28px 500px 28px 40px', max_w=None)
    panel = desk.side_panel(t, 'Enchufla · Doble', session_sub(t), log_inner(t), LG.log_button(t), log_actions(t), width=460)
    body = page + panel
    return desk.frame_a(t, 'Today', head, body)


def q4_b(t):
    head = desk.head_a(t, 'Today', DATE, right=prev_day(t))
    dlg = desk.center_dialog(t, 'Enchufla · Doble', session_sub(t), log_inner(t), LG.log_button(t), log_actions(t), width=560, height=780)
    return desk.frame_a(t, 'Today', head, today_two_cols(t), overlay=dlg)


def q4_c(t):
    head = desk.head_a(t, 'Today', DATE, right=prev_day(t))
    left = (f'<section aria-label="Today" style="width: 520px; flex: none; box-sizing: border-box; border-right: 1px solid {t["hairline"]}; '
            f'padding: 26px 24px 0 32px; overflow: hidden; display: flex; flex-direction: column; gap: 8px">'
            f'{session_left(t)}{label(t, "Not yet due · 4", 14)}{TD.group(t, TD.upcoming_rows(t))}</section>')
    title = (f'<div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex: none">'
             f'<div style="display: flex; flex-direction: column; gap: 4px; min-width: 0"><h2 style="margin: 0; {ts("display_s", t["ink"])}">Enchufla · Doble</h2>'
             f'<span style="font-size: 13px; line-height: 1.4; color: {t["muted"]}">{session_sub(t)}</span></div><div style="display: flex">{log_actions(t)}</div></div>')
    form = (f'<div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 24px; align-items: start">'
            f'{col(log_inner(t), 12)}'
            f'{col(LG.sets_list(t, "Sets today", [("10:42", "12 min · ★★★★", None)]) + label(t, "Earlier", 10) + kit.list_group(t, [dict(title="Wed 28 Oct", meta="2 sets · 14 min · ★★★", min_h=56), dict(title="Sun 25 Oct", meta="1 set · 8 min · ★★★★", min_h=56)]), 8)}</div>')
    right = (f'<section aria-label="Enchufla · Doble" style="flex: 1; min-width: 0; overflow: hidden; padding: 26px 40px; box-sizing: border-box; '
             f'display: flex; flex-direction: column; gap: 18px">{title}{form}'
             f'<div style="width: 300px">{LG.log_button(t)}</div></section>')
    return desk.frame_a(t, 'Today', head, f'<div style="flex: 1; min-height: 0; display: flex">{left}{right}</div>')


# --------------------------------------------------------------------------
# 5 · the title centred
# --------------------------------------------------------------------------

def q5_a(t):
    head = desk.head_a(t, 'Today', DATE, right=prev_day(t), center=True)
    return desk.frame_a(t, 'Today', head, today_two_cols(t))


def q5_b(t):
    return desk.frame_b(t, 'Today', 'Today', DATE, right=prev_day(t), body=today_two_cols(t), center=True)


def q5_c(t):
    seg = f'<div style="width: 340px">{kit.segmented(t, ["Figures", "Routines"], 0, on_band=True, label="Moves")}</div>'
    head = desk.head_a(t, 'Moves', right=desk.band_pill_button(t, 'New figure', 'plus'), extra=seg, center=True)
    return desk.frame_a(t, 'Moves', head, q2_a_body(t))


def q5_d(t):
    head = desk.head_a(t, 'Enchufla', left=kit.band_button(t, 'back', 'Back to Moves'),
                       right=desk.band_pill_button(t, 'Edit Doble', 'edit') + kit.band_button(t, 'more', 'More'),
                       extra=desk.var_tabs(t, ['Basic', 'Doble', 'Complicada'], 1), center=True)
    return desk.frame_a(t, 'Moves', head, q3_a_body(t))


# --------------------------------------------------------------------------
# the canvas
# --------------------------------------------------------------------------

ROWS = [
    ('1 · Where the four tabs go', [
        ('Main.dc.html', '1A · The band wraps the page', q1_a),
        ('Q1-B-top-band.dc.html', '1B · One band on top, tabs in it', q1_b),
        ('Q1-C-rail.dc.html', '1C · A light rail, the band per page', q1_c),
    ]),
    ('2 · Opening something from a list', [
        ('Q2-A-side-by-side.dc.html', '2A · List and page side by side', q2_a),
        ('Q2-B-table.dc.html', '2B · The list as a table, the page on its own', q2_b),
    ]),
    ('3 · A figure page with room', [
        ('Q3-A-two-columns.dc.html', '3A · About on the left, videos on the right', q3_a),
        ('Q3-B-video-first.dc.html', '3B · The video first, everything else under it', q3_b),
    ]),
    ('4 · Popups (the phone’s bottom sheets), logging a set', [
        ('Q4-A-side-panel.dc.html', '4A · A panel on the right, the page stays usable', q4_a),
        ('Q4-B-dialog.dc.html', '4B · A dialog in the middle', q4_b),
        ('Q4-C-workbench.dc.html', '4C · No popup: Today keeps the exercise open beside the list', q4_c),
    ]),
    ('5 · The title centred', [
        ('Q5-A-centred-band-frame.dc.html', '5A · 1A with the title centred', q5_a),
        ('Q5-B-centred-top-band.dc.html', '5B · 1B with the tabs and title centred', q5_b),
        ('Q5-C-centred-moves.dc.html', '5C · Moves: the switch under the centred title', q5_c),
        ('Q5-D-centred-figure.dc.html', '5D · A figure: Back stays left, the tabs centre under the name', q5_d),
    ]),
]

GAP_X, ROW_H, TITLE_ABOVE = 80, 900 + 120 + 260, 250


PAGES = []          # [{'id', 'name'}]; empty = one page
LAUNCH = {'view': 'canvas'}


def build():
    os.makedirs(OUT, exist_ok=True)
    t = kit.THEMES[('salsa', 'light')]
    boards, order, notes = {}, [], {}
    row_in_page = {}
    for r, row in enumerate(ROWS):
        title, items = row[0], row[1]
        page = row[2] if len(row) > 2 else None
        k = row_in_page.get(page, 0)
        row_in_page[page] = k + 1
        y = k * ROW_H
        note = {'x': 0, 'y': y - TITLE_ABOVE, 'text': title, 'kind': 'title1',
                'maxW': len(items) * desk.W + (len(items) - 1) * GAP_X}
        if page:
            note['page'] = page
        notes[f'q{r + 1}'] = note
        for i, (fname, name, fn) in enumerate(items):
            html = desk.document(fn(t), name)
            kit.write(os.path.join(OUT, fname), html)
            b = {'x': i * (desk.W + GAP_X), 'y': y, 'w': desk.W, 'h': desk.H, 'title': name}
            if page:
                b['page'] = page
            boards[fname] = b
            order.append(fname)
    created = {'v': 1, 'at': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}
    old = os.path.join(OUT, 'canvas.json')
    if os.path.exists(old):
        created = json.load(open(old, encoding='utf-8')).get('createdOnFiles', created)
    index = {'v': 3, 'createdOnFiles': created,
             'title': 'Salsa app · desktop', 'launch': LAUNCH, 'pages': PAGES, 'boards': boards, 'order': order,
             'notes': notes, 'designSystems': []}
    with open(os.path.join(OUT, 'canvas.json'), 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
    print('\n'.join(order))


if __name__ == '__main__':
    build()
