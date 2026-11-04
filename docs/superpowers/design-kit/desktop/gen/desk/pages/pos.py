"""Desktop and phone boards · Positions as their own part of Moves (round 5, a proposal).

Positions get the third place in Moves' switch (Figures | Routines | Positions) and a page each. They are owned like
figures (yours, a group's, with clones and twins), have one type from the same list as a figure's, the hold in a few
fields, notes, a picture, and links both ways: video sections and points, and lessons. Nobody starts with any:
templates (Salsa, Son, Timba) and "How positions work" are always one tap away.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.append(HERE)
import frame as F  # noqa: E402
from frame import kit, icon, ts  # noqa: E402
import importlib.util  # noqa: E402
import options as O  # noqa: E402
import posmap as PM  # noqa: E402


def _area(name):
    """Another desktop area module (pages/<name>.py): the phone's modules share these names, so by path."""
    key = f'area_{name}'
    if key not in sys.modules:
        spec = importlib.util.spec_from_file_location(key, os.path.join(HERE, name + '.py'))
        m = importlib.util.module_from_spec(spec)
        sys.modules[key] = m
        spec.loader.exec_module(m)
    return sys.modules[key]


LS = _area('lessons')
MVD = _area('moves')
C = MVD.C

LG, ML, MP = O.LG, LS.ML, LS.MP

SECTION = ('positions', 'Positions')
NEW = dict(changed=True)
TUES = 'Salsa Tuesdays'

# The same list as a figure's type. Timba is new for salsa (round 6: figures get it too).
TYPES = ['Salsa', 'Son', 'Timba', 'Other']
# yours: (name, type, in, out, neutral)
POS = [('Abierta (dos manos)', 'Salsa', 14, 16, False),
       ('Abierta (una mano)', 'Salsa', 5, 4, False),
       ('Cerrada', 'Salsa', 6, 5, False),
       ('Setenta, derecha', 'Salsa', 3, 3, False),
       ('Sombrero', 'Salsa', 2, 2, False),
       ('Manos cruzadas', 'Son', 4, 3, False),
       ('Caída', 'Timba', 2, 0, False),
       ('Sombra', 'Timba', 0, 0, False),
       ('Espalda con espalda', 'Other', 0, 1, False)]
# a group's, from the lessons you added: (name, type, meta)
GROUP_POS = [('Hammerlock', 'Salsa', 'from Week 6'), ('Cuddle', 'Salsa', 'from Week 4')]
OPEN = 'Manos cruzadas'
_ST, _IN, _OUT, _MAIN = PM.status()
POS = [(n, ty, _IN[n], _OUT[n], False) for n, ty in PM.POS.items()]


# --------------------------------------------------------------------------
# shared pieces (the same blocks on the desktop pane and the phone page)
# --------------------------------------------------------------------------

def pos_meta(t, ty, i, o, name=None):
    if name and _ST.get(name) == 'island':
        return f'{ty} · {i} in · {o} out · <span style="color: {t["warn"]}; font-weight: 700">island</span>'
    if i > 0 and o == 0:
        return f'{ty} · {i} in · <span style="color: {t["danger"]}; font-weight: 700">dead end</span>'
    if o > 0 and i == 0:
        return f'{ty} · {o} out · <span style="color: {t["danger"]}; font-weight: 700">orphan</span>'
    if i == 0 and o == 0:
        return f'{ty} · unused'
    return f'{ty} · {i} in · {o} out'


def pos_rows(t, sel=None, items=None):
    items = items or POS
    rows = []
    for n, ty, i, o, neu in items:
        tr = f'<span style="display: flex; align-items: center; gap: 6px">{kit.badge(t, "neutral", "accent") if neu else ""}{kit.chevron(t)}</span>'
        html = kit.row(t, n, pos_meta(t, ty, i, o, n), tr, href='#', title_tone='muted' if i == 0 and o == 0 else None, last=n == items[-1][0])
        rows.append(F.lit(t, html) if n == sel else html)
    return kit.list_group(t, rows)


def group_rows(t, sel=None, items=None):
    items = items or GROUP_POS
    rows = []
    for k, (n, ty, m) in enumerate(items):
        html = kit.row(t, n, f'{ty} · {m}', kit.chevron(t), href='#', last=k == len(items) - 1)
        rows.append(F.lit(t, html) if n == sel else html)
    return kit.list_group(t, rows)


def type_chips(t, sel='All', gaps=True):
    items = ['All'] + TYPES + (['Gaps'] if gaps else [])
    out = ''.join(kit.chip(t, it, it == sel, count=4 if it == 'Gaps' else None) for it in items)
    return f'<div role="group" aria-label="Filter positions" style="display: flex; gap: 0 6px; flex-wrap: wrap; flex: none">{out}</div>'


def helpers(t):
    """Always there, under the intro: Templates and How positions work."""
    return (f'<div style="display: flex; gap: 0; margin: -4px 0 -4px -10px; flex: none">'
            f'{kit.button(t, "Templates", "tertiary", icon_name="copy", size="sm")}{kit.button(t, "How positions work", "tertiary", icon_name="info", size="sm")}</div>')


def intro(t):
    return (f'<p style="margin: 0; padding: 0 4px; font-size: 14px; line-height: 1.45; color: {t["ink2"]}; flex: none">'
            f'<b style="color: {t["ink"]}">31 of 41 figures have positions.</b> Positions are optional: a figure without one fits anywhere in a routine.</p>')


NONE = [('Dile que no · Con giro', 'Salsa · starts on 1 · 8 counts'), ('Enchufla · Con mambo', 'Salsa · starts on 1 · 16 counts'),
        ('Exhíbela · Básica', 'Salsa · starts on 1 · 8 counts · 1 recording'), ('Vacílala · Básica', 'Salsa · starts on 1 · 8 counts'),
        ('Son basic turn', 'Son · solo'), ('Rueda: Dame', 'Other · starts on 1 · 8 counts'), ('Rueda: Enchufla', 'Other · starts on 1 · 8 counts')]


def none_row(t, sel=False):
    """The list's first row: the figures with no position at all, or with only a start or an end."""
    lead = (f'<span style="width: 40px; height: 40px; border-radius: 12px; border: 2px dashed {t["field_line"]}; box-sizing: border-box; display: flex; '
            f'align-items: center; justify-content: center">{icon("footprints", 20, t["muted"])}</span>')
    html = kit.row(t, 'No position', '10 figures · they fit anywhere', kit.chevron(t), leading=lead, href='#', last=True)
    return kit.list_group(t, [F.lit(t, html) if sel else html])


def picture(t, h=200):
    """The position's picture: a still from a linked point (the first one, or the one picked as its picture)."""
    cap = (f'<div style="display: flex; align-items: center; gap: 8px; padding: 10px 14px">{icon("spot", 18, t["muted"])}'
           f'<span style="flex: 1; font-size: 13px; color: {t["muted"]}">From <b style="color: {t["ink2"]}">Week 6 · Setenta into Sombrero</b>, video 1 at 1:12</span>'
           f'<a href="#" style="font-size: 13px; font-weight: 800; color: {t["accent_text"]}; text-decoration: none">Change</a></div>')
    return (f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">'
            f'{LG.wide_thumb(t, h, None, 2, "Play from 1:12")}{cap}</div>')


def hold_chips(t, items=(('Two hands', 'partner'), ('Crossed, right on top', None), ('Face to face', None), ('Open', None))):
    out = ''.join(kit.badge(t, x, 'neutral', icon_name=ic) for x, ic in items)
    return f'<div style="display: flex; gap: 6px; flex-wrap: wrap; flex: none">{out}</div>'


NOTES = ('Right hands joined on top, left hands under. Both arms soft and at chest height — the cross comes from the lead’s right going over, '
         'never from pulling. Her weight stays on the right foot after 7.')


def notes_block(t, text=NOTES):
    return ML.notes_card(t, text)


def fig_rows(t, items):
    rows = []
    for n, m in items:
        lead = (f'<span style="width: 40px; height: 40px; border-radius: 12px; background: {t["accent_soft"]}; display: flex; align-items: center; '
                f'justify-content: center">{icon("footprints", 20, t["accent_text"])}</span>')
        rows.append(dict(title=n, meta=m, leading=lead, trailing=kit.chevron(t), href='#', min_h=60))
    return kit.list_group(t, rows)


FROM_HERE = [('Enchufla · Complicada', 'Son → ends in Abierta (dos manos), Salsa'),
             ('Setenta · Con giro', 'Son → ends in Setenta, derecha, Salsa'),
             ('Kentucky · Doble', 'Son → ends in Manos cruzadas')]
INTO_HERE = [('Dile que no · Cruzado', 'from Cerrada, Salsa'), ('Enchufla · Doble', 'from Abierta (dos manos), Salsa'),
             ('Exhíbela · Básica', 'from Abierta (dos manos), Salsa'), ('Kentucky · Doble', 'from Manos cruzadas')]


def graph_block(t, short=False):
    out = F.label(t, 'Figures from here · 3', 6, kit.button(t, 'New', 'tertiary', icon_name='plus', size='sm')) + fig_rows(t, FROM_HERE)
    out += F.label(t, 'Figures into here · 4', 10) + fig_rows(t, INTO_HERE[:2] if short else INTO_HERE)
    return out


def video_rows(t):
    play = LG._lead(t, 'play', True)
    pt = (f'<span style="width: 40px; height: 40px; border-radius: 20px; background: {t["accent_soft"]}; display: flex; align-items: center; '
          f'justify-content: center">{icon("spot", 20, t["accent_text"])}</span>')
    rp = icon('repeat', 20, t['chevron'])
    rows = [dict(title='The cross on 7', meta='Week 6 · Setenta into Sombrero · section 1:12–1:31', leading=play, trailing=rp, href='#', min_h=64),
            dict(title='Point at 1:12', meta='Week 6 · Setenta into Sombrero · the picture', leading=pt, trailing=rp, href='#', min_h=64),
            dict(title='Into the cross', meta='Recording · Kentucky · Doble · 0:08–0:20', leading=play, trailing=rp, href='#', min_h=64)]
    return kit.list_group(t, rows)


def lesson_rows(t):
    lead = (f'<span style="width: 40px; height: 40px; border-radius: 12px; background: {t["accent_soft"]}; display: flex; align-items: center; '
            f'justify-content: center">{icon("lessons", 20, t["accent_text"])}</span>')
    rows = [dict(title='Week 6 · Setenta into Sombrero', meta=f'Salsa Tuesdays · 3 Nov · {ML.via_badge(t)}', leading=lead, trailing=kit.chevron(t), href='#', min_h=64),
            dict(title='Cubana class', meta='Tuesday 13 October', leading=lead, trailing=kit.chevron(t), href='#', min_h=64)]
    return kit.list_group(t, rows)


def link_btn(t, text, on=None):
    return kit.button(t, text, 'secondary', icon_name='link', full=True, on=on or t['ground'])


def media_block(t):
    return (F.label(t, 'Video · 3', 0) + video_rows(t) + link_btn(t, 'Link a section or point…')
            + F.label(t, 'Lessons · 2', 10) + lesson_rows(t) + link_btn(t, 'Link a lesson…')
            + F.label(t, 'In routines · 4', 10)
            + kit.list_group(t, [dict(title='Kentucky line', meta='Slots 2 → 3', trailing=kit.chevron(t), href='#', min_h=56),
                                 dict(title='Social night', meta='Slots 5 → 6 and 9 → 10', trailing=kit.chevron(t), href='#', min_h=56)])
            + f'<a href="#" style="padding: 4px 4px 0; font-size: 14px; font-weight: 800; color: {t["accent_text"]}; text-decoration: none">and 2 more</a>')


# --------------------------------------------------------------------------
# How positions work (the explanation) and the templates
# --------------------------------------------------------------------------

def pill(t, text, on=False):
    bg, fg = (t['accent'], t['on_accent']) if on else (t['surface'], t['ink'])
    return (f'<span style="height: 34px; padding: 0 14px; border-radius: 17px; background: {bg}; color: {fg}; font-size: 14px; font-weight: 800; '
            f'display: inline-flex; align-items: center; box-shadow: inset 0 0 0 1px {t["hairline"]}; flex: none">{text}</span>')


def arrow(t, text):
    return (f'<span style="display: inline-flex; flex-direction: column; align-items: center; gap: 0; color: {t["muted"]}; font-size: 12px; font-weight: 700; flex: none">'
            f'{text}<span style="font-size: 18px; line-height: 1; color: {t["accent"]}">⟶</span></span>')


def how_diagram(t):
    return (f'<div aria-label="A position, a figure, the next position" role="img" style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; '
            f'padding: 16px; border-radius: 16px; background: {t["accent_soft"]}; flex: none">'
            f'{pill(t, "Cerrada")}{arrow(t, "Dile que no")}{pill(t, "Abierta", True)}{arrow(t, "Enchufla")}{pill(t, "Abierta", True)}</div>')


HOW = [('What is a position?', 'How the two of you hold each other between figures: open with two hands, closed, crossed hands, a hammerlock, side by side.'),
       ('Why tag figures with them?', 'Every figure starts in a position and ends in one. That tells the app what can follow what: the routine editor offers only '
                                      'what fits, and the map shows where you get stuck.'),
       ('Types', 'Give each one a type, the same as a figure’s: Salsa, Son, Timba. When you tag a figure, positions of its type come first; '
                 'a figure can still go from one type to another.'),
       ('Optional', 'A figure has no position until you give it one, and then it fits anywhere: the routine editor checks nothing for it. '
                    'Use positions if they help you; leave them out if they don’t.'),
       ('Where to start', 'Add a template’s rough positions and rename or change them as you go, or make your own. Groups have their own, '
                          'like figures, and you can copy them.')]


def how_inner(t):
    out = how_diagram(t)
    for h, p in HOW:
        out += (f'<div style="display: flex; flex-direction: column; gap: 4px; flex: none"><h3 style="margin: 0; font-size: 16px; font-weight: 800; color: {t["ink"]}">{h}</h3>'
                f'<p style="margin: 0; font-size: 15px; line-height: 1.5; color: {t["ink2"]}">{p}</p></div>')
    return out


TEMPLATES = {
    'Salsa': [('Abierta (dos manos)', 'Open, both hands', 'have'), ('Abierta (una mano)', 'Open, his left in her right', 'have'),
              ('Cerrada', 'Closed, the basic frame', 'have'), ('Hammerlock', 'Her right arm folded behind her back', True),
              ('Cuddle', 'Side by side, her wrapped in his arms', True), ('Sombra', 'Shadow: he is behind her, same direction', True)],
    'Son': [('Cerrada de son', 'Closed and low, close together', True), ('Abierta', 'Open, one hand, loose', True),
            ('Manos cruzadas', 'Both hands crossed, right on top', 'have'), ('Paseo', 'Side by side, walking', True)],
    'Timba': [('Despelote', 'Apart, no hands', True), ('Pegao', 'Very close, hip to hip', True), ('Caída', 'Her weight dropped back, caught', 'have'),
              ('Sombra', 'Shadow, his hands on her hips', True), ('Cerrada', 'Closed, the basic frame', 'have')],
}


def template_inner(t, sel='Salsa'):
    rows = ''
    items = TEMPLATES[sel]
    for k, (n, m, st) in enumerate(items):
        have = st == 'have'
        hair = '' if k == len(items) - 1 else f'border-bottom: 1px solid {t["hairline"]};'
        mark = (kit.badge(t, 'You have it', 'neutral') if have
                else f'<span style="width: 24px; height: 24px; border-radius: 7px; background: {t["accent"]}; display: flex; align-items: center; justify-content: center">'
                     f'{icon("check", 16, t["on_accent"], stroke=3)}</span>')
        rows += (f'<label style="display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 0 14px 0 16px; {hair} cursor: pointer">'
                 f'<span style="flex: 1; display: flex; flex-direction: column; gap: 1px"><span style="font-size: 16px; font-weight: 700; color: {t["muted"] if have else t["ink"]}">{n}</span>'
                 f'<span style="font-size: 13px; color: {t["muted"]}">{m}</span></span>{mark}</label>')
    n_new = sum(1 for x in items if x[2] is True)
    return (kit.segmented(t, ['Salsa', 'Son', 'Timba'], ['Salsa', 'Son', 'Timba'].index(sel), on_band=False, label='Template')
            + f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">{rows}</div>'
            + f'<span style="font-size: 13px; line-height: 1.45; color: {t["muted"]}; padding: 0 4px">Rough positions to start from: rename, change or remove them later. '
              f'They get the type {sel}. What you already have by name is skipped.</span>'), n_new


def b_templates(t):
    inner, n = template_inner(t)
    dlg = F.dialog(t, 'Start from a template', inner, sub='Always here: Templates, at the top of Positions',
                   footer=kit.button(t, f'Add {n} positions', 'primary', icon_name='plus', full=True, on=t['sheet_bg']), height=720)
    return board(t, F.split(t, pos_list(t), map_pane(t), 'Positions'), dlg)


def b_how(t):
    dlg = F.dialog(t, 'How positions work', how_inner(t), footer=kit.button(t, 'Got it', 'primary', full=True, on=t['sheet_bg']), height=800)
    return board(t, F.split(t, pos_list(t), map_pane(t), 'Positions'), dlg)


def b_first(t):
    es = kit.empty_state(t, 'positions', 'No positions yet', 'Your 41 figures have none, and that is fine: they fit anywhere. '
                         'Add positions when you want routines checked for what can follow what.',
                         f'<div style="display: flex; flex-direction: column; gap: 8px; align-items: stretch">'
                         f'{kit.button(t, "Start from a template", "primary", icon_name="copy")}{kit.button(t, "New position", "secondary", icon_name="plus")}</div>')
    lst = f'<div style="flex: 1; display: flex; align-items: center; justify-content: center; padding-bottom: 80px">{es}</div>'
    head = F.pane_head(t, 'How positions work', 'Optional: read once, then decide')
    pane = F.pane(t, head, F.pane_body(how_inner(t), max_w=640, gap=16), label_='How positions work')
    return board(t, F.split(t, lst, pane, 'Positions'))


# --------------------------------------------------------------------------
# the map (the nothing-open pane): positions as nodes, figures as arrows
# --------------------------------------------------------------------------

NODES = {'Abierta (dos manos)': (380, 290, ''), 'Cerrada': (150, 120, ''), 'Abierta (una mano)': (620, 120, ''),
         'Manos cruzadas': (640, 300, ''), 'Setenta, derecha': (590, 480, ''), 'Sombrero': (180, 480, ''),
         'Caída': (110, 300, 'dead'), 'Espalda con espalda': (380, 50, 'orphan')}
EDGES = [('Abierta (dos manos)', 'Cerrada', 4), ('Cerrada', 'Abierta (dos manos)', 5), ('Abierta (dos manos)', 'Abierta (una mano)', 3),
         ('Abierta (una mano)', 'Abierta (dos manos)', 3), ('Abierta (dos manos)', 'Manos cruzadas', 3), ('Manos cruzadas', 'Abierta (dos manos)', 2),
         ('Manos cruzadas', 'Setenta, derecha', 1), ('Setenta, derecha', 'Abierta (dos manos)', 3), ('Abierta (dos manos)', 'Sombrero', 2),
         ('Sombrero', 'Abierta (dos manos)', 2), ('Cerrada', 'Caída', 2), ('Espalda con espalda', 'Abierta (dos manos)', 1)]


def _wh(name):
    return len(name) * 8.4 + 36, 40


def pos_map(t, sel=None):
    W_, H_ = 760, 540
    acc, muted, danger = t['accent'], t['muted'], t['danger']
    out = (f'<svg viewBox="0 0 {W_} {H_}" width="{W_}" height="{H_}" role="img" aria-label="The map of your positions: which figures lead where" '
           f'style="display: block; max-width: 100%; height: auto; flex: none">'
           f'<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto-start-reverse">'
           f'<path d="M0 0 L10 5 L0 10 z" fill="{muted}"/></marker>'
           f'<marker id="ahs" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto-start-reverse">'
           f'<path d="M0 0 L10 5 L0 10 z" fill="{acc}"/></marker></defs>')
    for a, b, n in EDGES:
        ax, ay, _ = NODES[a]
        bx, by, _ = NODES[b]
        dx, dy = bx - ax, by - ay
        L = (dx * dx + dy * dy) ** 0.5
        nx, ny = -dy / L, dx / L
        ax2, ay2, bx2, by2 = ax + nx * 12, ay + ny * 12, bx + nx * 12, by + ny * 12

        def clip(px, py, qx, qy, name):
            w, h = _wh(name)
            ddx, ddy = qx - px, qy - py
            s = min((w / 2 + 6) / abs(ddx) if ddx else 9e9, (h / 2 + 6) / abs(ddy) if ddy else 9e9)
            return px + ddx * s, py + ddy * s
        sx, sy = clip(ax2, ay2, bx2, by2, a)
        ex, ey = clip(bx2, by2, ax2, ay2, b)
        hot = sel in (a, b)
        col = acc if hot else muted
        out += (f'<line x1="{sx:.0f}" y1="{sy:.0f}" x2="{ex:.0f}" y2="{ey:.0f}" stroke="{col}" stroke-opacity="{1 if hot else 0.55}" '
                f'stroke-width="{1 + n * 0.6:.1f}" marker-end="url(#{"ahs" if hot else "ah"})"/>')
        mx, my = (sx + ex) / 2 + nx * 8, (sy + ey) / 2 + ny * 8
        out += (f'<text x="{mx:.0f}" y="{my + 4:.0f}" text-anchor="middle" font-family="Manrope" font-size="12" font-weight="800" '
                f'fill="{col}">{n}</text>')
    for name, (x, y, kind) in NODES.items():
        w, h = _wh(name)
        on = name == sel
        fill = acc if on else t['surface']
        ink = t['on_accent'] if on else t['ink']
        stroke = danger if kind in ('dead', 'orphan') else (acc if kind == 'neutral' else t['hairline'])
        sw = 2 if kind else 1
        dash = ' stroke-dasharray="5 4"' if kind == 'orphan' else ''
        out += (f'<a href="#"><rect x="{x - w / 2:.0f}" y="{y - h / 2:.0f}" width="{w:.0f}" height="{h}" rx="20" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{dash}/>'
                f'<text x="{x}" y="{y + 5}" text-anchor="middle" font-family="Manrope" font-size="14" font-weight="800" fill="{ink}">{name}</text></a>')
    # the figures with no position: a box of their own, no arrows (they fit anywhere)
    out += (f'<a href="#"><rect x="20" y="16" width="190" height="58" rx="18" fill="none" stroke="{t["field_line"]}" stroke-width="2" stroke-dasharray="6 5"/>'
            f'<text x="115" y="41" text-anchor="middle" font-family="Manrope" font-size="14" font-weight="800" fill="{t["ink2"]}">No position</text>'
            f'<text x="115" y="60" text-anchor="middle" font-family="Manrope" font-size="12" font-weight="700" fill="{muted}">10 figures · fit anywhere</text></a>')
    return out + '</svg>'


def map_legend(t):
    def k(text, col, dash=False):
        return (f'<span style="display: inline-flex; align-items: center; gap: 6px"><span style="width: 22px; height: 12px; border-radius: 6px; '
                f'border: 2px {"dashed" if dash else "solid"} {col}"></span>{text}</span>')
    return (f'<div style="display: flex; gap: 18px; flex-wrap: wrap; font-size: 13px; color: {t["muted"]}; flex: none">'
            f'{k("no position: fits anywhere", t["field_line"], True)}{k("dead end: nothing leaves", t["danger"])}{k("orphan: nothing gets there", t["danger"], True)}'
            f'<span>Arrows: figures, with how many</span><span>Not on the map: Sombra (unused)</span></div>')


# --------------------------------------------------------------------------
# desktop
# --------------------------------------------------------------------------

def moves_band(t, sel=2, group=False):
    plus = F.act(t, 'plus', ['New move', 'New routine', 'New position'][sel])
    return dict(center=F.seg(t, ['Figures', 'Routines', 'Positions'], sel, 'Moves', width=420), right=F.group_btn(t, group) + plus)


def board(t, body, overlay=''):
    return F.frame(t, 'Moves', 'Moves', body, overlay=overlay, **moves_band(t))


def pos_list(t, sel=None, chip='All', items=None, group_sel=None, groups=True, tail=False):
    out = '' if tail else (intro(t) + helpers(t) + kit.search_field(t, 'Search positions') + type_chips(t, chip))
    its = items or POS
    if tail:
        its = its[-3:]
    else:
        out += none_row(t, sel == 'none') + F.label(t, f'Yours · {len(its)}', 4)
    out += pos_rows(t, sel, its)
    if groups:
        out += MVD.group_heading(t, TUES, len(GROUP_POS)) + group_rows(t, group_sel)
    return out


MAP_REC = 'force'
MAP_SUB = f'{len(PM.POS)} positions · 32 figures between them · 10 with none · 4 stranded'


def map_pane(t, sel=None, layout=None):
    lay = layout or MAP_REC
    head = F.pane_head(t, 'The map', MAP_SUB)
    body = PM.render(t, lay, 772, 620, sel, uid='m' + lay) + PM.legend(t)
    return F.pane(t, head, F.pane_body(body, max_w=800, gap=12), label_='The map')


def b_map(layout):
    return lambda t: board(t, F.split(t, pos_list(t), map_pane(t, layout=layout), 'Positions'))


def type_badge(t, ty):
    return f'<div style="display: flex; gap: 6px">{kit.badge(t, ty, "accent")}</div>'


def pos_head(t, name=OPEN, ty='Son', edit=False, sub='Position · 4 in · 3 out'):
    acts = F.tonal(t, 'close', 'Stop editing') if edit else (F.tonal(t, 'graph', 'Show on the map') + F.tonal(t, 'edit', f'Edit {name}'))
    return F.pane_head(t, name, 'Editing' if edit else sub, actions=acts, below='' if edit else type_badge(t, ty))


def pos_pane(t):
    left = picture(t) + hold_chips(t) + notes_block(t) + graph_block(t)
    top = C.actions(t, copy=True, same=True)
    return F.pane(t, pos_head(t), F.pane_cols(left, media_block(t), ('1fr', '1fr'), top=top), label_=OPEN)


def b_list(t):
    return board(t, F.split(t, pos_list(t), map_pane(t), 'Positions'))


def b_open(t):
    return board(t, F.split(t, pos_list(t, OPEN), pos_pane(t), 'Positions'))


def b_map_sel(t):
    return board(t, F.split(t, pos_list(t, OPEN), map_pane(t, OPEN), 'Positions'))


def b_map_sel_web(t):
    return board(t, F.split(t, pos_list(t, OPEN), map_pane(t, OPEN, 'force'), 'Positions'))


def type_field(t, sel='Son'):
    chips = ''.join(kit.chip(t, x, x == sel, role='radio') for x in TYPES)
    return (f'<div style="display: flex; flex-direction: column; gap: 6px; flex: none"><span style="{ts("label", t["ink2"])}; padding-left: 4px">Type</span>'
            f'<div role="radiogroup" aria-label="Type" style="display: flex; gap: 6px; flex-wrap: wrap">{chips}</div>'
            f'<span style="font-size: 13px; color: {t["muted"]}; padding-left: 4px">One, the same list as a figure’s type.</span></div>')


def seg_field(t, lab, items, sel):
    return (f'<div style="display: flex; flex-direction: column; gap: 6px; flex: none">'
            f'<span style="{ts("label", t["ink2"])}; padding-left: 4px">{lab}</span>{kit.segmented(t, items, sel, on_band=False, label=lab)}</div>')


def crossed(t):
    return (f'<div style="display: flex; align-items: center; gap: 12px; min-height: 52px; flex: none">'
            f'<span style="flex: 1; display: flex; flex-direction: column; gap: 1px"><span style="font-size: 16px; font-weight: 700">Crossed</span>'
            f'<span style="font-size: 13px; color: {t["muted"]}">Right hands on top</span></span>{kit.switch(t, True, label="Crossed")}</div>')


def form_left(t, name=OPEN, focused=True, sel='Son', frame_=True):
    out = kit.text_field(t, 'Name', name, state='focused' if focused else 'filled') + type_field(t, sel)
    out += seg_field(t, 'Hands', ['Two', 'One', 'None'], 0) + crossed(t)
    out += seg_field(t, 'Facing', ['Face to face', 'Side by side', 'Shadow', 'Back to back'], 0)
    if frame_:
        out += seg_field(t, 'Frame', ['Open', 'Closed'], 0)
    return out


def form_right(t):
    return (kit.textarea(t, 'Notes', NOTES, state='filled', rows=5)
            + F.label(t, 'Picture', 6) + picture(t, 150)
            + kit.button(t, 'Archive position', 'danger_text', icon_name='trash')
            + f'<span style="font-size: 13px; color: {t["muted"]}; padding: 0 4px">Archived like a figure: Restore brings it back. Its figures lose it '
              f'and, with no other, have no position.</span>')


def b_edit(t):
    save = F.pinned(t, kit.button(t, 'Save', 'primary', full=True), max_w=None)
    p = F.pane(t, pos_head(t, edit=True), F.pane_cols(form_left(t), form_right(t), ('1fr', '1fr')), save, OPEN)
    return board(t, F.split(t, pos_list(t, OPEN), p, 'Positions'))


def b_new(t):
    inner = form_left(t, '', True, sel='Salsa') + kit.textarea(t, 'Notes', '', 'How the hands are, what to watch', rows=3)
    dlg = F.dialog(t, 'New position', inner, sub='Type starts as your “New figures” type (Settings)',
                   footer=kit.button(t, 'Add position', 'primary', full=True, on=t['sheet_bg']), height=820, width=600)
    return board(t, F.split(t, pos_list(t), map_pane(t), 'Positions'), dlg)


def b_dead_end(t):
    ban = kit.banner(t, 'warning', 'Dead end', 'Two figures end in Caída and nothing you know leaves it. A routine that gets here stops.',
                     action='New figure from Caída')
    left = (ban + hold_chips(t, (('One hand', None), ('Side by side', None)))
            + notes_block(t, 'Her weight drops back on 5 and he catches with the right hand at her shoulder blade. Short — out on 7 at the latest.')
            + F.label(t, 'Figures from here · 0', 6) + kit.card(t, f'<span style="font-size: 14px; color: {t["muted"]}">None yet.</span>')
            + F.label(t, 'Figures into here · 2', 10)
            + fig_rows(t, [('Dile que no · Con caída', 'from Cerrada, Salsa'), ('Setenta · Timba', 'from Abierta (dos manos), Salsa')]))
    right = (F.label(t, 'Video · 1', 0) + kit.list_group(t, [dict(title='The dip', meta='Timba workshop · section 2:40–2:52', leading=LG._lead(t, 'play', True),
                                                                   trailing=icon('repeat', 20, t['chevron']), href='#', min_h=64)])
             + link_btn(t, 'Link a section or point…') + F.label(t, 'Lessons · 1', 10)
             + kit.list_group(t, [dict(title='Timba workshop', meta='Saturday 17 October', trailing=kit.chevron(t), href='#', min_h=60)])
             + link_btn(t, 'Link a lesson…'))
    p = F.pane(t, pos_head(t, 'Caída', 'Timba', sub='Position · 2 in · 0 out'), F.pane_cols(left, right, ('1fr', '1fr')), label_='Caída')
    gaps = [p_ for p_ in POS if _ST[p_[0]] in ('dead', 'orphan', 'island')]
    return board(t, F.split(t, pos_list(t, 'Caída', 'Gaps', gaps, groups=False), p, 'Positions'))


def video_picker_inner(t):
    def vid(title, sub, rows):
        r = ''
        for k, (kind, lab, rng, picked) in enumerate(rows):
            mark = icon('check', 22, t['accent'], stroke=2.6) if picked else icon('plus', 22, t['accent'])
            hair = '' if k == len(rows) - 1 else f'border-bottom: 1px solid {t["hairline"]};'
            r += (f'<button type="button" aria-pressed="{"true" if picked else "false"}" style="width: 100%; display: flex; align-items: center; gap: 12px; '
                  f'min-height: 56px; border: 0; background: {t["accent_soft"] if picked else "none"}; padding: 0 14px 0 16px; text-align: left; cursor: pointer; {hair}">'
                  f'{icon("spot" if kind == "point" else "play", 20, t["accent_text"])}<span style="flex: 1; display: flex; flex-direction: column; gap: 1px">'
                  f'<span style="font-size: 15px; font-weight: 700; color: {t["ink"]}">{lab}</span>'
                  f'<span style="font-size: 13px; color: {t["muted"]}">{rng}</span></span>{mark}</button>')
        return (f'<span style="padding: 6px 16px 0; {ts("label", t["muted"])}">{title} · {sub}</span>'
                f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">{r}</div>')
    return (kit.search_field(t, 'Search lessons, recordings, sections', state='focused')
            + f'<span style="font-size: 13px; color: {t["muted"]}; padding: 0 4px">A section loops; a point is one moment, and can be the picture.</span>'
            + vid('Week 6 · Setenta into Sombrero', 'video 1', [('section', 'The cross on 7', 'Section · 1:12–1:31', True),
                                                                ('point', 'Point at 1:12', 'Point', True),
                                                                ('section', 'Comb on 5', 'Section · 2:05–2:20', False)])
            + vid('Kentucky · Doble', 'recording 26 Oct', [('section', 'Into the cross', 'Section · 0:08–0:20', True),
                                                          ('point', 'Point at 0:15', 'Point', False)])
            + vid('Cubana class', 'video 2', [('section', '0:42.0–1:05.5', 'Section, no name', False)]))


def b_link_video(t):
    dlg = F.dialog(t, 'Link to Manos cruzadas', video_picker_inner(t), sub='Sections and points of your lessons and recordings',
                   footer=kit.button(t, 'Done · 3 linked', 'primary', full=True, on=t['sheet_bg']), height=800)
    return board(t, F.split(t, pos_list(t, OPEN), pos_pane(t), 'Positions'), dlg)


def b_link_lesson(t):
    def les(title, meta, picked, last=False):
        hair = '' if last else f'border-bottom: 1px solid {t["hairline"]};'
        mark = icon('check', 22, t['accent'], stroke=2.6) if picked else icon('plus', 22, t['accent'])
        return (f'<button type="button" aria-pressed="{"true" if picked else "false"}" style="width: 100%; display: flex; align-items: center; gap: 12px; min-height: 60px; '
                f'border: 0; {hair} background: {t["accent_soft"] if picked else "none"}; padding: 0 14px 0 16px; text-align: left; cursor: pointer">'
                f'<span style="flex: 1; display: flex; flex-direction: column; gap: 1px"><span style="font-size: 15px; font-weight: 700; color: {t["ink"]}">{title}</span>'
                f'<span style="font-size: 13px; color: {t["muted"]}">{meta}</span></span>{mark}</button>')
    g = lambda rows: f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">{rows}</div>'  # noqa: E731
    inner = (kit.search_field(t, 'Search lessons', state='focused')
             + F.label(t, 'November', 4) + g(les('Week 6 · Setenta into Sombrero', 'Salsa Tuesdays · Tue 3 Nov · through a section', True)
                                             + les('Week 3 · Enchufla', 'Wed 4 Nov', False, True))
             + F.label(t, 'October', 8) + g(les('Wednesday class', 'Wed 28 Oct · 2 videos', False) + les('Timba workshop', 'Sat 17 Oct', False)
                                            + les('Cubana class', 'Tue 13 Oct', True, True)))
    dlg = F.dialog(t, 'Lessons with Manos cruzadas', inner, sub='A lesson linked here shows the position on its page too',
                   footer=kit.button(t, 'Done', 'primary', full=True, on=t['sheet_bg']), height=720)
    return board(t, F.split(t, pos_list(t, OPEN), pos_pane(t), 'Positions'), dlg)


# --- owned like figures: a group's, your copy, twins, group mode ---

def group_pane(t):
    head = F.pane_head(t, 'Hammerlock', f'{TUES}’ position · 3 in · 3 out', below=type_badge(t, 'Salsa'))
    top = C.group_note(t, f'From Week 6. Tag your figures with it as it is; it stays {TUES}’.') + C.actions(t, copy=True, same=True)
    left = (hold_chips(t, (('Two hands', 'partner'), ('Her right behind her back', None), ('Face to face', None)))
            + notes_block(t, 'Her right hand folded behind her back at the waist, his left keeps her left. Don’t lift it past the hip.')
            + F.label(t, 'Figures from here · 2', 6) + fig_rows(t, [('Setenta · Básico', 'Salsa Tuesdays’ · ends in Abierta (dos manos)'),
                                                                   ('Hammerlock · Out', 'Salsa Tuesdays’ · ends in Abierta (una mano)')]))
    right = (F.label(t, 'Video · 1', 0) + kit.list_group(t, [dict(title='Into the hammerlock', meta='Week 6 · section 0:48–1:02',
                                                                   leading=LG._lead(t, 'play', True), trailing=icon('repeat', 20, t['chevron']), href='#', min_h=64)])
             + F.label(t, 'Lessons · 1', 10) + kit.list_group(t, [dict(title='Week 6 · Setenta into Sombrero', meta='Salsa Tuesdays · 3 Nov', trailing=kit.chevron(t), href='#', min_h=60)]))
    bar = F.pinned(t, kit.button(t, 'Edit', 'secondary', icon_name='pencil')
                   + f'<span style="flex: 1; font-size: 13px; color: {t["muted"]}">Edit makes it yours (Make it mine); your figures tagged with it move over.</span>', max_w=1140)
    return F.pane(t, head, F.pane_cols(left, right, ('1fr', '1fr'), top=top), bar, 'Hammerlock')


def b_group(t, overlay=''):
    return board(t, F.split(t, pos_list(t, group_sel='Hammerlock', tail=True), group_pane(t), 'Positions'), overlay)


def b_make_mine(t):
    C.GETS.setdefault('position', 'Its name, type, hold, notes and video links, to change as you like.')
    C.STAYS.setdefault('position', 'The lessons and videos it was linked from. You still see them on yours.')
    return b_group(t, C.make_mine(t, 'Hammerlock', kind='position',
                                  follows='Your Setenta · Con giro, tagged with it, switches to your copy.'))


def copy_pane(t):
    head = F.pane_head(t, OPEN, f'Your copy · from {TUES} · 4 in · 3 out', actions=F.tonal(t, 'edit', f'Edit {OPEN}'), below=type_badge(t, 'Son'))
    top = (C.source_tabs(t, ['Yours', TUES], 0) + C.compare_banner(t, f'{TUES} changed it since you took it: notes, 1 video section')
           + C.actions(t, copy=True, same=True, detach=True, drop=True))
    return F.pane(t, head, F.pane_cols(picture(t) + hold_chips(t) + notes_block(t) + graph_block(t), media_block(t), ('1fr', '1fr'), top=top), label_=OPEN)


def b_copy(t):
    return board(t, F.split(t, pos_list(t, OPEN), copy_pane(t), 'Positions'))


def b_same_as(t):
    d = C.same_as(t, 'Abierta (dos manos)', [('group', 'Open, two hands', 'Rueda club’s', True), ('group', 'Abierta', f'{TUES}’', True),
                                             ('mine', 'Abierta (una mano)', 'Yours', False)], kind='position')
    return board(t, F.split(t, pos_list(t, 'Abierta (dos manos)'), map_pane(t, 'Abierta (dos manos)'), 'Positions'), d)


def b_group_mode(t):
    tg = F.in_group(t)
    items = [('Abierta', 'Salsa', 9, 9, False), ('Cerrada', 'Salsa', 4, 4, False), ('Hammerlock', 'Salsa', 3, 3, False),
             ('Cuddle', 'Salsa', 2, 2, False), ('Manos cruzadas', 'Son', 2, 1, False)]
    note = (f'<p style="margin: 0; border-radius: 16px; background: {tg["surface"]}; padding: 12px 16px; font-size: 13px; line-height: 1.4; '
            f'color: {tg["muted"]}; flex: none">The group’s own positions. Its figures can only be tagged with these.</p>')
    lst = (note + helpers(tg) + kit.search_field(tg, 'Search positions') + type_chips(tg, gaps=False) + F.label(tg, '5 positions', 4)
           + pos_rows(tg, 'Hammerlock', items))
    head = F.pane_head(tg, 'Hammerlock', 'Position · 3 in · 3 out', actions=F.tonal(tg, 'clock', 'History') + F.tonal(tg, 'edit', 'Edit Hammerlock'),
                       below=type_badge(tg, 'Salsa'))
    left = (hold_chips(tg, (('Two hands', 'partner'), ('Her right behind her back', None), ('Face to face', None)))
            + notes_block(tg, 'Her right hand folded behind her back at the waist, his left keeps her left. Don’t lift it past the hip.')
            + F.label(tg, 'Figures from here · 2', 6) + fig_rows(tg, [('Setenta · Básico', 'ends in Abierta'), ('Hammerlock · Out', 'ends in Cerrada')]))
    right = (F.label(tg, 'Video · 1', 0) + kit.list_group(tg, [dict(title='Into the hammerlock', meta='Week 6 · section 0:48–1:02',
                                                                     leading=LG._lead(tg, 'play', True), trailing=icon('repeat', 20, tg['chevron']), href='#', min_h=64)])
             + link_btn(tg, 'Link a section or point…'))
    pane = F.pane(tg, head, F.pane_cols(left, right, ('1fr', '1fr')), label_='Hammerlock')
    return F.frame(tg, 'Moves', 'Moves', F.split(tg, lst, pane, 'Positions'), group=TUES, **moves_band(tg, group=True))


def none_pane(t):
    rows = []
    for n, m in NONE:
        rows.append(dict(title=n, meta=m, trailing=kit.button(t, 'Positions', 'tertiary', icon_name='plus', size='sm', on=t['surface']), min_h=64))
    body = (kit.banner(t, 'info', 'Fits anywhere', 'A figure with no position can follow anything and lead into anything: '
                       'the routine editor offers it everywhere and never marks a break for it.')
            + F.label(t, 'No start and no end · 7', 6) + kit.list_group(t, rows)
            + F.label(t, 'Only an end · 2', 10) + fig_rows(t, [('Kentucky · Complicada', 'ends in Manos cruzadas'), ('Setenta · Timba', 'ends in Caída')])
            + F.label(t, 'Only a start · 1', 10) + fig_rows(t, [('Sombrero · Doble', 'starts in Sombrero')]))
    head = F.pane_head(t, 'No position', '10 figures · 7 with none, 3 with only a start or an end')
    return F.pane(t, head, F.pane_body(body), label_='No position')


def b_none(t):
    return board(t, F.split(t, pos_list(t, 'none'), none_pane(t), 'Positions'))


# --- picking a figure's positions: the figure's type first ---

def pick_inner(t, on):
    def row(n, meta, picked, last=False):
        hair = '' if last else f'border-bottom: 1px solid {t["hairline"]};'
        mark = icon('check', 22, t['accent'], stroke=2.6) if picked else ''
        return (f'<button type="button" aria-pressed="{"true" if picked else "false"}" style="width: 100%; display: flex; align-items: center; gap: 12px; '
                f'min-height: 56px; border: 0; {hair} background: {t["accent_soft"] if picked else "none"}; padding: 0 14px 0 16px; text-align: left; cursor: pointer">'
                f'<span style="flex: 1; display: flex; flex-direction: column; gap: 1px"><span style="font-size: 16px; font-weight: 700; color: {t["ink"]}">{n}</span>'
                f'<span style="font-size: 13px; color: {t["muted"]}">{meta}</span></span>{mark}</button>')
    g = lambda rows: f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">{rows}</div>'  # noqa: E731
    return (kit.search_field(t, 'Search positions', state='focused')
            + g(row('No position', 'The default: fits after anything', False, True))
            + F.label(t, 'Salsa · the figure’s type', 4)
            + g(row('Abierta (dos manos)', '14 in · 16 out', True) + row('Abierta (una mano)', '5 in · 4 out', False)
                + row('Cerrada', '6 in · 5 out', False) + row('Setenta, derecha', '3 in · 3 out', False) + row('Sombrero', '2 in · 2 out', False, True))
            + F.label(t, 'Other types', 8)
            + g(row('Manos cruzadas', 'Son · 4 in · 3 out', True) + row('Caída', 'Timba · dead end', False) + row('Sombra', 'Timba · unused', False)
                + row('Espalda con espalda', 'Other', False, True))
            + f'<span style="font-size: 13px; color: {t["muted"]}; padding: 0 4px">A figure can start in one type and end in another: '
              f'everything is here, its own type first.</span>')


HOLD = {'Abierta (dos manos)': 'Two hands · face to face', 'Abierta (una mano)': 'One hand · face to face', 'Cerrada': 'Closed frame',
        'Setenta, derecha': 'One hand · her right turn', 'Sombrero': 'Two hands · over her head', 'Candado': 'Two hands · her right behind her',
        'Abrazo': 'Side by side · wrapped', 'Manos cruzadas': 'Two hands · crossed', 'Paseo': 'Side by side · walking',
        'Caída': 'One hand · dropped back', 'Pegao': 'Closed · hip to hip', 'Sombra': 'Shadow', 'Espalda con espalda': 'No hands · back to back',
        'Rueda: círculo': 'In the circle', 'Rueda: centro': 'In the middle'}


def picker_body(t, chosen=(), first=True):
    """The shared picker's rows (pickers spec): groups by type, the figure's own first, then the others, then a group's.
    A tap toggles ✓ (this field takes any number); No position clears them."""
    def r(n, last=False):
        return MP.prow(t, n, HOLD.get(n), 'chosen' if n in chosen else 'default', kind='field', last=last)
    by = {}
    for n, ty in PM.POS.items():
        by.setdefault(ty, []).append(n)
    out = MP.pgroup(t, 'No position', [MP.prow(t, 'No position', 'Fits anywhere · the default', 'chosen' if not chosen else 'default', kind='field', last=True)], first=True)
    out += MP.pgroup(t, 'Salsa · this figure’s type', [r(n, i == len(by['Salsa']) - 1) for i, n in enumerate(sorted(by['Salsa']))])
    for ty in ('Son', 'Timba', 'Other'):
        out += MP.pgroup(t, ty, [r(n, i == len(by[ty]) - 1) for i, n in enumerate(sorted(by[ty]))])
    out += MP.pgroup(t, f'{TUES}’', [MP.prow(t, 'Hammerlock', 'Salsa · tag with it as it is', kind='field'),
                                      MP.prow(t, 'Cuddle', 'Salsa · tag with it as it is', kind='field', last=True)])
    return out


def picker_foot(t, n, typed=''):
    lead = f'Not in the list? Create “{typed}” as' if typed else 'Not in the list?'
    return (f'<div style="display: flex; align-items: center; gap: 10px"><span style="{ts("label", t["muted"])}; flex: 1">{lead}</span>'
            f'<div style="width: 170px; display: flex">{MP.create_button(t, "Position")}</div></div>'
            + kit.button(t, f'Done · {n}' if n else 'Done', 'primary', full=True, on=t['sheet_bg']))


def picker_dialog(t, title='Ends in', chosen=('Abierta (una mano)', 'Candado'), typed=''):
    if typed:
        body = MP.empty_box(t, f'Nothing matches “{typed}”.')
    else:
        body = picker_body(t, chosen)
    inner = kit.search_field(t, 'Search positions', typed, 'focused') + f'<div style="display: flex; flex-direction: column; gap: 8px">{body}</div>'
    return F.dialog(t, title, inner, sub='Enchufla · Doble · Salsa · any number', footer=picker_foot(t, len(chosen), typed), height=836)


def pos_field(t, lab, values):
    """A field picker's opener (PickerField): the chosen positions as chips, or a muted No position, and ›."""
    if values:
        inner = ''.join(f'<span style="height: 30px; padding: 0 12px; border-radius: 15px; background: {t["accent_soft"]}; color: {t["accent_text"]}; '
                        f'font-size: 14px; font-weight: 800; display: inline-flex; align-items: center">{v}</span>' for v in values)
    else:
        inner = f'<span style="font-size: 16px; color: {t["muted"]}">No position · fits anywhere</span>'
    return (f'<div style="display: flex; flex-direction: column; gap: 6px; flex: none"><span style="{ts("label", t["ink2"])}; padding-left: 4px">{lab}</span>'
            f'<button type="button" style="min-height: 56px; border: 0; border-radius: 14px; background: {t["field"]}; box-shadow: inset 0 0 0 1px {t["field_line"]}; '
            f'padding: 10px 10px 10px 12px; display: flex; align-items: center; gap: 8px; text-align: left; cursor: pointer">'
            f'<span style="flex: 1; display: flex; gap: 6px; flex-wrap: wrap">{inner}</span>{kit.chevron(t)}</button></div>')


def timing_fields(t, starts=('Abierta (dos manos)', 'Manos cruzadas'), ends=('Abierta (una mano)', 'Candado')):
    sp = MVD.FG.SP
    counts = (kit.text_field(t, 'Counts', '16', state='filled', inputmode='numeric', suffix='counts')
              + f'<div style="margin-top: -4px">{kit.chips(t, ["4", "8", "16"], {2}, label="Length shortcuts", scroll=False)}</div>')
    return (pos_field(t, 'Starts in', starts) + sp + pos_field(t, 'Ends in', ends)
            + f'<span style="font-size: 13px; line-height: 1.4; color: {t["muted"]}; padding: 0 4px; margin-top: -4px">Any number of each. In a routine, the next figure '
              f'fits when it starts in any of these ends.</span>' + sp + MVD.FG.count_grid(t, 1) + sp + counts)


def fig_edit_board(t, overlay=''):
    head = MVD.pane_head_x(t, 'Enchufla · Doble', 'Editing Doble')
    save = (f'<span style="flex: 1; font-size: 14px; color: {t["muted"]}">Stop editing asks first if something is not saved.</span>'
            + kit.button(t, 'Save', 'primary', icon_name='check'))
    right = F.label(t, 'Timing') + timing_fields(t)
    left = MVD.edit_left(t).replace(kit.chips(t, MVD.MV.styles(MVD.SAL), 0, label="Style", scroll=False),
                                     kit.chips(t, ["Salsa", "Son", "Timba", "Other"], 0, label="Style", scroll=False))
    p = F.pane(t, head, F.pane_cols(left, right, ratio=('1fr', '1fr')), F.pinned(t, save, max_w=1140), 'Editing Enchufla · Doble')
    lst = MVD.figure_list(t, ('Enchufla', 'Doble')).replace(
        MVD.tiles(t), f'<div style="display: flex; gap: 8px; flex: none">{MVD.tile(t, "routine", "Coverage", "7 in no routine", True)}</div>')
    return F.frame(t, 'Moves', 'Moves', F.split(t, lst, p, 'Figures'), overlay=overlay, **moves_band(t, sel=0))


def b_fig_edit(t):
    return fig_edit_board(t)


def b_figure_pick(t):
    return fig_edit_board(t, picker_dialog(t))


def b_figure_pick_none(t):
    return fig_edit_board(t, picker_dialog(t, 'Ends in', (), 'tornillo'))


# --- lessons and the Link popup ---

def lesson_positions(t):
    un = lambda n: kit.icon_button(t, 'unlink', f'Unlink {n}', 'bare', color=t['muted'], on=t['surface'])  # noqa: E731
    rows = [ML.split_row(t, f'Manos cruzadas {ML.via_badge(t)}', '1:12.0–1:31.0 · Son', un('Manos cruzadas')),
            ML.split_row(t, 'Abierta (dos manos)', 'Salsa', un('Abierta (dos manos)')),
            ML.link_row_btn(t, 'Link a position…')]
    return kit.section_label(t, 'Positions · 2', 10, ML.new_btn(t, 'position')) + ML.group(t, rows)


def b_lesson(t):
    left = (ML.notes_card(t, ML.notes(t)) + F.label(t, 'Review', 6) + ML.review_group(t) + '<div style="height: 6px; flex: none"></div>'
            + LS.linked(t) + lesson_positions(t))
    p = F.pane(t, LS.head(t), F.pane_cols(left, LS.right_col(t)), label_=LS.LONG)
    p = p.replace('<div style="display: grid; grid-template-columns', '<div style="margin-top: -560px; display: grid; grid-template-columns', 1)
    return LS.board(t, F.split(t, LS.lesson_list(t), p, 'Lessons'))


def link_sheet_inner(t):
    return (F.label(t, 'Linked')
            + kit.list_group(t, [MP.linked_item(t, 'Enchufla · Doble'),
                                 MP.linked_item(t, 'Manos cruzadas').replace('Manos cruzadas</span>', 'Manos cruzadas ' + kit.badge(t, 'Position', 'accent') + '</span>', 1),
                                 MP.linked_item(t, 'Count drill · 3-2 clave', drill=True, last=True)], label='Linked')
            + '<div style="height: 4px"></div>'
            + kit.button(t, 'Link a figure, drill or position…', 'secondary', icon_name='search', full=True, on=t['sheet_bg'])
            + kit.button(t, 'Use this moment as a point', 'tertiary', icon_name='spot', full=True, on=t['sheet_bg']))


def b_section_link(t):
    inner = link_sheet_inner(t) + (f'<p style="margin: 4px 4px 0; font-size: 13px; line-height: 1.45; color: {t["muted"]}">'
                                   'What a section links to shows on this lesson too, positions included.</p>')
    return LS.board(t, LS.lesson_split(t), F.dialog(t, f'Link {LS.RANGE}', inner, sub='Doble entry · 13 s', height=560))


def b_figure_tags(t, overlay=''):
    summ = lambda t_: MVD.FG.summary(t_, [kit.badge(t_, 'Salsa', 'accent'), kit.badge(t_, 'With partner', 'neutral', icon_name='people')],  # noqa: E731
                                     1, 16, 'Abierta (dos manos) or Manos cruzadas', 'Abierta (una mano) or Candado', 'Second turn from the wrist. Ends open, or straight into the candado.')
    pane = MVD.figure_pane(t, 1, summary=summ)
    link = f'color: {t["accent_text"]}; text-decoration: underline; text-underline-offset: 3px'
    for a_, b_ in (('Abierta (dos manos) or Manos cruzadas', f'<a href="#" style="{link}">Abierta (dos manos)</a> or <a href="#" style="{link}">Manos cruzadas</a>'),
                   ('Abierta (una mano) or Candado', f'<a href="#" style="{link}">Abierta (una mano)</a> or <a href="#" style="{link}">Candado</a>')):
        pane = pane.replace(a_, b_, 1)
    lst = MVD.figure_list(t, ('Enchufla', 'Doble')).replace(
        MVD.tiles(t), f'<div style="display: flex; gap: 8px; flex: none">{MVD.tile(t, "routine", "Coverage", "7 in no routine", True)}</div>')
    return F.frame(t, 'Moves', 'Moves', F.split(t, lst, pane, 'Figures'), overlay=overlay, **moves_band(t, sel=0))


# --------------------------------------------------------------------------
# phone
# --------------------------------------------------------------------------

def phones(t, *screens):
    light = t['ground'].lower() not in ('#0b0b0d',)
    bg = '#e2e1e7' if light else '#1a1a1f'
    inner = ''.join(f'<div style="transform: scale(0.97); transform-origin: top center">{s}</div>' for s in screens)
    return (f'<div style="width: {F.W}px; height: {F.H}px; background: {bg}; display: flex; justify-content: center; gap: 56px; padding-top: 20px; '
            f'box-sizing: border-box; overflow: hidden; {kit.MANROPE}">{inner}</div>')


def m_header(t):
    return kit.band_header(t, 'Moves', right=kit.band_button(t, 'plus', 'New position'),
                           extra=kit.segmented(t, ['Figures', 'Routines', 'Positions'], 2, on_band=True, label='Moves'))


def m_chips(t):
    chips = ''.join(kit.chip(t, it, it == 'All', count=4 if it == 'Gaps' else None) for it in ['All'] + TYPES + ['Gaps'])
    return f'<div style="display: flex; gap: 6px; overflow: hidden; margin: 0 -16px; padding: 0 16px; flex: none">{chips}</div>'


def m_list(t):
    body = (intro(t) + helpers(t) + kit.search_field(t, 'Search positions') + m_chips(t) + none_row(t) + kit.section_label(t, f'Yours · {len(POS)}', 4) + pos_rows(t))
    return kit.page(t, m_header(t), body, tab='Moves')


def m_pos_header(t, name=OPEN, sub='Position · Son'):
    return kit.band_header(t, name, sub, left=kit.band_button(t, 'back', 'Back to Positions'),
                           right=[kit.band_button(t, 'graph', 'Show on the map'), kit.band_button(t, 'edit', f'Edit {name}')], tall=False)


def m_pos_top(t):
    return kit.page(t, m_pos_header(t), picture(t, 180) + hold_chips(t) + notes_block(t) + graph_block(t, short=True), tab='Moves')


def m_pos_bottom(t):
    body = F.label(t, 'Figures into here · 4', 0) + fig_rows(t, INTO_HERE[2:]) + '<div style="height: 4px"></div>' + media_block(t)
    return kit.page(t, m_pos_header(t), body, tab='Moves', pad='14px 16px 0')


def m_edit(t):
    inner = form_left(t, OPEN, False, frame_=False)
    sh = kit.bottom_sheet(t, f'Edit {OPEN}', inner, kit.button(t, 'Save', 'primary', full=True, on=t['sheet_bg']))
    return kit.page(t, m_pos_header(t), picture(t, 180) + hold_chips(t), tab='Moves', overlay=sh)


def m_link_video(t):
    sh = kit.bottom_sheet(t, 'Link to Manos cruzadas', video_picker_inner(t), kit.button(t, 'Done · 3 linked', 'primary', full=True, on=t['sheet_bg']), height=780)
    return kit.page(t, m_pos_header(t), picture(t, 180), tab='Moves', overlay=sh)


def m_lesson(t):
    body = ML.linked(t).split(kit.section_label(t, 'Exercises · 2', 10, ML.new_btn(t, 'exercise')))[0] + lesson_positions(t)
    return kit.page(t, ML.lesson_header(t), body, pad='16px 16px 0', tab='Lessons')


def m_first(t):
    es = kit.empty_state(t, 'positions', 'No positions yet', 'Start from a template’s rough positions, or make your own.',
                         f'<div style="display: flex; flex-direction: column; gap: 8px; align-items: stretch">'
                         f'{kit.button(t, "Start from a template", "primary", icon_name="copy")}{kit.button(t, "New position", "secondary", icon_name="plus")}'
                         f'{kit.button(t, "How positions work", "tertiary", icon_name="info")}</div>')
    body = f'<div style="flex: 1; display: flex; align-items: center; justify-content: center; padding-bottom: 120px">{es}</div>'
    return kit.page(t, m_header(t), body, tab='Moves')


def m_templates(t):
    inner, n = template_inner(t, 'Son')
    sh = kit.bottom_sheet(t, 'Start from a template', inner, kit.button(t, f'Add {n} positions', 'primary', icon_name='plus', full=True, on=t['sheet_bg']))
    return kit.page(t, m_header(t), intro(t) + helpers(t), tab='Moves', overlay=sh)


def m_how(t):
    sh = kit.bottom_sheet(t, 'How positions work', how_inner(t), kit.button(t, 'Got it', 'primary', full=True, on=t['sheet_bg']), height=800)
    return kit.page(t, m_header(t), intro(t) + helpers(t), tab='Moves', overlay=sh)


def m_edit_header(t):
    return kit.band_header(t, 'Enchufla', 'Editing Doble', left=kit.band_button(t, 'close', 'Stop editing'), tall=False)


def m_fig_edit(t):
    save = kit.bottom_action(t, kit.button(t, 'Save', 'primary', full=True))
    return kit.page(t, m_edit_header(t), F.label(t, 'Timing', 0) + timing_fields(t), pad='14px 16px 0', footer=save)


def m_pick(t, typed=''):
    chosen = () if typed else ('Abierta (una mano)', 'Candado')
    body = MP.empty_box(t, f'Nothing matches “{typed}”.') if typed else picker_body(t, chosen)
    foot = MP.create_row(t, ['Position'], typed) + kit.button(t, f'Done · {len(chosen)}' if chosen else 'Done', 'primary', full=True, on=t['sheet_bg'])
    sh = MP.picker(t, 'Ends in', body, 'Search positions', typed, 'focused' if typed else None, footer=foot, sub='Enchufla · Doble · Salsa')
    return kit.page(t, m_edit_header(t), F.label(t, 'Timing', 0) + timing_fields(t), pad='14px 16px 0', overlay=sh)


def m_section_link(t):
    return MP.lesson_with(t, kit.bottom_sheet(t, f'Link {MP.RANGE}', link_sheet_inner(t), sub='Doble entry · 13 s'))


def m_group(t):
    body = (C.group_note(t, f'From Week 6. Tag your figures with it as it is; it stays {TUES}’.') + C.actions(t, copy=True, same=True)
            + hold_chips(t, (('Two hands', 'partner'), ('Her right behind her back', None)))
            + notes_block(t, 'Her right hand folded behind her back at the waist, his left keeps her left.')
            + F.label(t, 'Figures from here · 2', 6) + fig_rows(t, [('Setenta · Básico', 'Salsa Tuesdays’'), ('Hammerlock · Out', 'Salsa Tuesdays’')]))
    foot = kit.bottom_action(t, kit.button(t, 'Edit (make it mine)', 'secondary', icon_name='pencil', full=True), above_tab=True)
    return kit.page(t, m_pos_header(t, 'Hammerlock', f'{TUES}’ position · Salsa'), body, tab='Moves', footer=foot)


def p1(t):
    return phones(t, m_list(t), m_pos_top(t), m_pos_bottom(t))


def p2(t):
    return phones(t, m_first(t), m_templates(t), m_how(t))


def p3(t):
    return phones(t, m_edit(t), m_link_video(t), m_map(t))


def m_map(t):
    body = (f'<div style="margin: 0 -8px">{PM.render(t, MAP_REC, 374, 470, None, uid="pm", compact=True)}</div>'
            + f'<span style="font-size: 13px; color: {t["muted"]}; padding: 0 4px">Pinch to zoom, tap a position to light its figures.</span>')
    hdr = kit.band_header(t, 'The map', MAP_SUB.split(' · 32')[0], left=kit.band_button(t, 'back', 'Back to Positions'), tall=False)
    return kit.page(t, hdr, body, tab='Moves', pad='10px 8px 0')


def p5(t):
    return phones(t, m_fig_edit(t), m_pick(t), m_pick(t, 'tornillo'))


def p4(t):
    return phones(t, m_group(t), m_lesson(t), m_section_link(t))


# --------------------------------------------------------------------------

BOARDS = [
    F.Board('first-run', 'Positions · nobody starts with any', b_first,
            'Positions are yours, like figures, and optional: you start with none and your figures have none. The list offers Start from a template '
            'and New position; the pane explains how positions work.', **NEW),
    F.Board('templates', 'Start from a template', b_templates,
            'Rough positions per type (Salsa, Son, Timba): tick what you want, the ones you already have by name are skipped. Always under Templates at '
            'the top of the list; How positions work sits beside it.', **NEW),
    F.Board('how', 'How positions work', b_how,
            'The explanation as a dialog, from How positions work: what a position is, why figures are tagged, types, that it is optional, where to start.', **NEW),
    F.Board('list', 'Positions · the list and the map', b_list,
            'Positions take the third place in Moves’ switch (Figures | Routines | Positions); the Positions tile on Figures goes. + on the band is New position. '
            'Left: Templates and How positions work, search, a chip per type and Gaps; Yours, then each group’s (from lessons you added). '
            'Nothing open: the map (Web).', **NEW),
    F.Board('open', 'A position open', b_open,
            'Two columns. Left: the picture (a still from a linked point), the hold, notes, figures from here and into here (+ New figure from it). '
            'Right: linked video sections and points, lessons, routines through it. Copy to… and Same as… like a figure.', **NEW),
    F.Board('no-position', 'No position: the figures without one', b_none,
            'The first row of the list, and a box on the map. Positions are optional: a figure has none until you give it one, and then it fits anywhere. '
            'Here: the figures with none, then those with only a start or only an end, each with + Positions.', **NEW),
    F.Board('map-web', 'The map · Web (recommended)', b_map('force'),
            'Option A. A small force simulation, worked out in the browser: linked positions pull together, the rest push apart, then a pass that keeps '
            'circles and names from touching. 400 steps from the same start every time, so your map never jumps about between visits. '
            'Bigger circles: more figures; colour: type. Stranded positions are marked where they are (dead end, orphan); islands and positions '
            'with no figures sit in the tray under the map, with No position.', option='A · Web', rec=True, changed=True),
    F.Board('map-rings', 'The map · Rings', b_map('rings'),
            'Option B. Your most-used position in the middle, a ring per figure away from it (walking the figures out). '
            'Says how far everything is from home; busier in the middle.', option='B · Rings', changed=True),
    F.Board('map-circle', 'The map · Circle by type', b_map('circle'),
            'Option C. One circle, grouped by type with a coloured band; arrows bend through the middle. Nothing to simulate, very tidy, '
            'but distance means nothing.', option='C · Circle', changed=True),
    F.Board('map-selected', 'The map with a position picked', b_map_sel,
            'Picking Manos cruzadas (a tap, or the map button on its page): its figures in and out light up in its type’s colour, the rest fades. '
            'Tap again or Esc to clear; a second tap on a lit position opens it.', option='A · Web', rec=True, changed=True),
    F.Board('edit', 'Editing a position', b_edit,
            'In place. Type is one, from the same list as a figure’s (Salsa, Son, Timba, Other). The hold: Hands, Crossed, Facing, Frame. '
            'Notes and the picture; Archive like a figure. No neutral any more.', **NEW),
    F.Board('new', 'New position · a dialog', b_new, 'The same fields. Type starts as your “New figures” type.', **NEW),
    F.Board('figure-edit', 'Editing a figure: any number of starts and ends', b_fig_edit,
            'Starts in and Ends in are both field pickers now, each taking any number (Ends at was one). A figure that can finish two ways is one figure. '
            'Empty reads “No position · fits anywhere”.', **NEW),
    F.Board('figure-pick', 'The position picker (the shared picker)', b_figure_pick,
            'The same picker as every other list: search on top, groups (No position, the figure’s own type, the other types, a group’s), '
            'the hold as the second line, ✓ on what’s chosen, “Not in the list? + Position” and Done pinned. Here a tap toggles: this field takes any number.', **NEW),
    F.Board('figure-pick-none', 'The position picker · nothing matches, create it', b_figure_pick_none,
            'Typed “tornillo”: the one empty state, and Create “tornillo” as Position — a New position step on top (type preset to the figure’s), '
            'then it is chosen and you are back in the picker.', **NEW),
    F.Board('dead-end', 'A dead end, from the Gaps chip', b_dead_end,
            'Gaps lists the dead ends and orphans. A dead end says so, with New figure from Caída.', **NEW),
    F.Board('link-video', 'Link a section or point to a position', b_link_video,
            'Your lessons’ and recordings’ videos, each with its sections and points; tick any. A point is one moment and can be the picture.', **NEW),
    F.Board('link-lesson', 'Link a lesson to a position', b_link_lesson,
            'Lessons by month. A lesson that reaches it through a section is ticked already.', **NEW),
    F.Board('group', 'A group’s position, from a lesson you added', b_group,
            'Read-only and marked as the group’s, like a group’s figure: tag your figures with it as it is, Copy to…, Same as…; Edit makes it yours.', **NEW),
    F.Board('make-mine', 'Edit on a group’s position: Make it mine', b_make_mine,
            'The same question as a figure’s: you get your own copy, and your figures tagged with theirs move to it.', **NEW),
    F.Board('your-copy', 'Your copy: a tab per source', b_copy,
            'Yours | Salsa Tuesdays, the “changed since you took it” banner with Compare, Copy to…, Same as…, Detach, Drop my copy — as for a figure.', **NEW),
    F.Board('same-as', 'Same as… for positions', b_same_as,
            'Twins: positions from different places that are the same hold show as one in lists and pickers, and the map and routines count them as one — marked as a twin.', **NEW),
    F.Board('group-mode', 'Group mode: the group’s positions', b_group_mode,
            'Inside a group (navy): only its positions, History and Edit in the header. A group’s figures are tagged with its own positions only.', **NEW),
    F.Board('lesson', 'A lesson with its positions', b_lesson,
            'A Positions group in the lesson, linked by hand or through a section (the via badge), as figures are. Drawn scrolled down.', **NEW),
    F.Board('section-link', 'Linking a section: positions too', b_section_link,
            'The Link popup offers positions with figures and drills, and Use this moment as a point.', **NEW),
    F.Board('figure-tags', 'A figure: its positions are links', b_figure_tags,
            'On a figure, the start and end positions open their pages.', **NEW),
    F.Board('phone-1', 'Phone · the list, a position, scrolled', p1,
            'Positions in Moves’ switch; a position’s page; the same page scrolled to its videos, lessons and routines.', **NEW),
    F.Board('phone-2', 'Phone · no positions yet, templates, how they work', p2,
            'The empty state with its three buttons; Start from a template as a sheet (Son picked); How positions work.', **NEW),
    F.Board('phone-3', 'Phone · editing a position, linking a video, the map', p3,
            'Edit as a sheet; the video picker; the map (Web) on the phone, pinch to zoom.', **NEW),
    F.Board('phone-5', 'Phone · a figure’s positions, the picker, create', p5,
            'Editing a figure: Starts in and Ends in, any number each; the shared picker sheet; nothing matches, Create as Position.', **NEW),
    F.Board('phone-4', 'Phone · a group’s position, a lesson, the Link popup', p4,
            'A group’s position, read-only, Edit makes it yours; a lesson’s Positions; the Link popup with a position.', **NEW),
]
for _b in BOARDS:
    _b.themes = ('salsa-light', 'salsa-dark')


# Round 8: the Web map is settled; Rings and Circle are dropped, and the map boards lose their option labels.
BOARDS = [b for b in BOARDS if b.id not in ('map-rings', 'map-circle')]
for _b in BOARDS:
    if _b.option.startswith('A · Web'):
        _b.option, _b.rec = '', False
