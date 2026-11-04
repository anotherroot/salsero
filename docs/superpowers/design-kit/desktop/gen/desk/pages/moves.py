"""Desktop · Moves: Figures (under their move) and a figure, a move's page, Positions, Coverage, Routines and a routine,
group mode, and every clones-and-twins screen on a figure or routine (2A list + pane, 3A, 4B).

Names (2026-11-03): a `figures` row is a FIGURE ("Enchufla · Doble"), a `figure_groups` row is a MOVE ("Enchufla").
Drawn with frame.py for the frame, panes, dialogs and bars; _clones.py for the clone parts; the rest is the phone's (gen/screens).
"""
import os
import sys

# No sys.path insert of this folder: putting pages/ first would make options.py's `import today` find the
# desktop area files (pages/today.py) instead of the phone's gen/screens/today.py.
if os.path.dirname(os.path.abspath(__file__)) not in sys.path:
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import frame as F  # noqa: E402
from frame import kit, icon, ts  # noqa: E402
import _clones as C  # noqa: E402

# The phone's modules (gen/screens is on sys.path through desk). Loaded by path: this file is also called moves.
import importlib.util  # noqa: E402

_SCR = os.path.join(F.desk.S, 'gen', 'screens')


def _load(name):
    spec = importlib.util.spec_from_file_location(f'phone_{name}', os.path.join(_SCR, f'{name}.py'))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


MV = _load('moves')
FG = _load('figure')
RT = _load('routine')
import options as O  # noqa: E402

SECTION = ('moves', 'Moves')

STYLES = ['Salsa', 'Son', 'Timba', 'Other']   # round 6: Timba joins salsa's types

# A figure's facts say Positions (any number each side), named in the positions' own words.
def _positions_label(fg):
    orig = fg.summary
    def summary(*a, **k):
        return orig(*a, **k).replace('>Handholds<', '>Positions<')
    fg.summary = summary
for _fg in {id(FG): FG, id(O.FG): O.FG}.values():
    _positions_label(_fg)

# Every theme shows the salsa content; the phone's content helpers are salsa-only.
SAL = {'dance': 'salsa'}

FIGS = ['Basic', 'Doble', 'Complicada', 'Con mambo']   # Enchufla's figures
TUES = 'Salsa Tuesdays'

# Your moves, each with its figures: (figure, meta, has a section, has a lesson)
MOVES = [
    ('Dile que no', [('Básico', 'Starts on 1 · 8 counts · 2 recordings', True, True),
                     ('Con giro', 'Starts on 1 · 8 counts', False, True)]),
    ('Enchufla', [('Basic', 'Starts on 1 · 8 counts · 1 recording', True, True),
                  ('Doble', 'Starts on 1 · 16 counts · 2 recordings', True, True),
                  ('Complicada', 'Starts on 5 · 12 counts', False, False),
                  ('Con mambo', 'Starts on 1 · 16 counts · 1 recording', True, False)]),
    ('Exhíbela', [('Básica', 'Starts on 1 · 8 counts · 1 recording', True, True)]),
    ('Kentucky', [('Doble', 'Starts on 1 · 16 counts', False, True)]),
    ('Setenta', [('Con giro', 'Starts on 1 · 16 counts · 1 recording', True, True)]),
]
# What your groups gave you, through the lessons you added (viewed and practised, under a slight heading)
GROUP_MOVES = [(TUES, [('Setenta', [('Básico', 'Starts on 1 · 8 counts · 1 recording')]),
                       ('Sombrero', [('Básico', 'Starts on 1 · 16 counts')])])]
# Group mode: the group's own moves; False = no published lesson links it (members don't see it yet)
GROUP_OWN = [('Enchufla', [('Basic', 'Starts on 1 · 8 counts · 2 recordings', True), ('Doble', 'Starts on 1 · 16 counts · 1 recording', True)]),
             ('Exhíbela', [('Básica', 'Starts on 1 · 8 counts', True)]),
             ('Setenta', [('Básico', 'Starts on 1 · 8 counts · 1 recording', True)]),
             ('Sombrero', [('Básico', 'Starts on 1 · 16 counts', False)]),
             ('Vacílala', [('Básica', 'Starts on 1 · 8 counts', False), ('Con giro', 'Starts on 5 · 12 counts', False)])]


# --------------------------------------------------------------------------
# helpers (moves only)
# --------------------------------------------------------------------------

def head_kw(t, seg=0, group=False):
    """The band belongs to Moves: Figures | Routines in the middle; the group button (you edit a group) and + on the right."""
    plus = F.act(t, 'plus', ['New move', 'New routine', 'New position'][seg])
    return dict(center=F.seg(t, ['Figures', 'Routines', 'Positions'], seg, 'Moves', width=420), right=F.group_btn(t, group) + plus)


def moves(t, body, seg=0, overlay='', group=None):
    return F.frame(t, 'Moves', 'Moves', body, overlay=overlay, group=group, **head_kw(t, seg, bool(group)))


def tile(t, icon_name, title, meta, status=False, on=False):
    """A half-width tile at the top of the Figures list; tinted (and aria-current) while open in the pane."""
    html = MV.nav_tile(t, icon_name, title, meta, status)
    if on:
        html = (html.replace(f'background: {t["surface"]}', f'background: {t["accent_soft"]}; box-shadow: inset 0 0 0 2px {t["accent"]}', 1)
                .replace('<a href="#"', '<a href="#" aria-current="page"', 1)
                .replace(f'background: {t["accent_soft"]}; display: flex; align-items: center; justify-content: center">',
                         f'background: {t["accent"]}; display: flex; align-items: center; justify-content: center">', 1)
                .replace(f'{kit.icon(icon_name, 22, t["accent_text"])}', f'{kit.icon(icon_name, 22, t["on_accent"])}', 1))
    return html


def tiles(t, lit_=None, group=False):
    if group:  # group mode: coverage is the person's own; positions are in the switch now
        return ''
    return f'<div style="display: flex; gap: 8px; flex: none">{tile(t, "routine", "Coverage", "7 in no routine", True, on=lit_ == "coverage")}</div>'


def chips(t, selected=('All',), unlinked=5):
    """The Figures filters, wrapping onto a second line in the 360 column (not scrolling sideways)."""
    items = ['All', 'Not linked'] + STYLES + ['With partner', 'Solo']
    out = ''.join(kit.chip(t, it, it in selected, count=unlinked if it == 'Not linked' else None) for it in items)
    return f'<div role="group" aria-label="Filter figures" style="display: flex; gap: 0 6px; flex-wrap: wrap; flex: none">{out}</div>'


def gchip(t, name):
    """A group's name as a small chip in the group colour (a slot or a row that is a group's)."""
    bg, ink = C.gtone(t)
    return (f'<span style="height: 24px; box-sizing: border-box; padding: 0 9px 0 7px; border-radius: 12px; background: {bg}; color: {ink}; font-size: 12px; '
            f'font-weight: 800; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; vertical-align: 1px">{icon("people", 14, ink)}{name}</span>')


def twins_chip(t):
    return kit.badge(t, 'Twins', 'neutral', icon_name='link')


def hidden_mark(t):
    return (f'<span style="display: inline-flex; align-items: center; gap: 4px; white-space: nowrap">{icon("eye-off", 16, t["muted"])}'
            f'Members don’t see it yet</span>')


def fig_meta(t, base, sec=True, les=True):
    st = f'color: {t["status"]}; font-weight: 700'
    parts = [base] + ([f'<span style="{st}">No section</span>'] if not sec else []) + ([f'<span style="{st}">No lesson</span>'] if not les else [])
    return ' · '.join(parts)


def move_head(t, name, also=None, on=False):
    """A move's name over its figures: the heading opens the move's page (lit while that page is open)."""
    bg = f'background: {t["accent_soft"]}; padding: 2px 8px 2px 10px; margin-left: -10px; border-radius: 10px;' if on else 'padding: 2px 0;'
    cur = ' aria-current="page"' if on else ''
    a = (f'<a href="#"{cur} style="align-self: flex-start; display: inline-flex; align-items: center; gap: 2px; {bg} text-decoration: none; '
         f'color: {t["ink"]}; font-size: 17px; line-height: 1.3; font-weight: 700">{name}{kit.chevron(t)}</a>')
    m = f'<span style="font-size: 13px; line-height: 1.35; color: {t["muted"]}">{also}</span>' if also else ''
    return f'<div style="display: flex; flex-direction: column; padding: 4px 0 0 2px; flex: none">{a}{m}</div>'


def move_section(t, name, rows, open_=None, also=None, on=False):
    """rows: (figure, meta html, chip html or ''). open_: the figure open in the pane."""
    out = []
    for i, (n, meta, extra) in enumerate(rows):
        title = f'{n}&nbsp; {extra}' if extra else n
        html = kit.row(t, title, meta, kit.chevron(t), href='#', last=i == len(rows) - 1)
        out.append(F.lit(t, html) if n == open_ else html)
    return move_head(t, name, also, on) + kit.list_group(t, out, name)


def group_heading(t, name, n):
    return (f'<span style="display: flex; align-items: center; gap: 6px; padding: 10px 16px 0; {ts("label", t["muted"])}">'
            f'{icon("people", 16, t["muted"])}{name} · {n}</span>')


def figure_list(t, open_=None, lit_tile=None, search='', selected=('All',), count=None, open_move=None, twins=False, items=None, group_open=None, tail=False, groups=None):
    """The Figures column: tiles, search, chips, "Yours · 14 figures", figures under each move, then each group's.
    open_: (move, figure) open in the pane; open_move: a move whose page is open; group_open: (move, figure) of a group's.
    tail: the column scrolled to its end (the open row is a group's, or near the bottom): the last of yours, then the groups."""
    top = '' if search else tiles(t, lit_tile)
    srch = kit.search_field(t, 'Search figures', search, 'focused' if search else 'empty')
    out = top + srch + chips(t, selected) + F.label(t, count or 'Yours · 14 figures', 4)
    ms = items or MOVES
    if tail:
        out, ms = '', ms[-2:]
    for mv, figs in ms:
        rows = []
        for n, base, sec, les in figs:
            extra = twins_chip(t) if twins and (mv, n) == ('Enchufla', 'Doble') else ''
            rows.append((n, fig_meta(t, base, sec, les), extra))
        also = f'{len(figs)} figures · also in {TUES}, Rueda club' if twins and mv == 'Enchufla' else None
        out += move_section(t, mv, rows, open_[1] if open_ and open_[0] == mv else None, also, open_move == mv)
    if not search:
        for g, gm in (GROUP_MOVES if groups is None else groups):
            out += group_heading(t, g, sum(len(f) for _, f in gm))
            for mv, figs in gm:
                out += move_section(t, mv, [(n, base, '') for n, base in figs],
                                    group_open[1] if group_open and group_open[0] == mv else None)
    return out


def group_list(t, open_=None):
    """Group mode's Figures column: Positions only, the members note, then the group's own moves."""
    note = (f'<p style="margin: 0; border-radius: 16px; background: {t["surface"]}; padding: 12px 16px; font-size: 13px; line-height: 1.4; '
            f'color: {t["muted"]}; flex: none">Anything not in a published lesson stays with the editors. Link it from a lesson and members get it.</p>')
    out = tiles(t, group=True) + note + kit.search_field(t, 'Search figures') + F.label(t, '9 figures', 4)
    for mv, figs in GROUP_OWN:
        rows = [(n, base + ('' if seen else ' · ' + hidden_mark(t)), '') for n, base, seen in figs]
        out += move_section(t, mv, rows, open_[1] if open_ and open_[0] == mv else None)
    return out


def pane_head_x(t, title, sub=None, actions=''):
    """The pane's header while editing or selecting: × (Stop) before the title, as ‹ goes there."""
    return F.pane_head(t, title, sub, back=True, actions=actions).replace('aria-label="Back"', 'aria-label="Stop"', 1).replace(
        kit.icon('back', 24, t['ink']), kit.icon('close', 24, t['ink']), 1)


def tonal(t, name, lab):
    return F.tonal(t, name, lab)


def rule(t):
    return f'<div style="height: 1px; background: {t["hairline"]}; margin: 14px 0 6px; flex: none"></div>'


def chip_lead(t, icon_name):
    return (f'<span style="width: 40px; height: 40px; border-radius: 20px; background: {t["chip"]}; display: flex; align-items: center; '
            f'justify-content: center">{kit.icon(icon_name, 21, t["ink2"])}</span>')


# --------------------------------------------------------------------------
# a figure in its pane (3A)
# --------------------------------------------------------------------------

def fig_tabs(t, move, names, sel, plus=True):
    """The move's figures as tabs under the figure's label (desktop: no bar at the bottom), + Figure, and Open <move> ›
    (the phone's "Figures of Enchufla" sheet links to the move's page the same way)."""
    out = ''
    for i, n in enumerate(names):
        on = i == sel
        bg, fg = (t['accent'], t['on_accent']) if on else (t['chip'], t['chip_ink'])
        cur = ' aria-current="page"' if on else ''
        out += (f'<a href="#"{cur} style="height: 36px; padding: 0 16px; border-radius: 18px; background: {bg}; color: {fg}; display: inline-flex; '
                f'align-items: center; font-size: 14px; font-weight: {800 if on else 700}; text-decoration: none; flex: none">{n}</a>')
    if plus:
        c = t['accent_text']
        out += (f'<button type="button" style="height: 36px; padding: 0 14px 0 10px; border-radius: 18px; border: 1.5px dashed {c}; '
                f'background: none; color: {c}; display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 800; cursor: pointer; flex: none">'
                f'{icon("plus", 18, c)}Figure</button>')
    link = (f'<a href="#" style="margin-left: auto; height: 36px; display: inline-flex; align-items: center; gap: 2px; color: {t["accent_text"]}; '
            f'font-size: 14px; font-weight: 800; text-decoration: none; flex: none">Open {move}{icon("chevron-right", 16, t["accent_text"])}</a>')
    return (f'<nav aria-label="Figures of {move}" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap">{out}{link}</nav>')


def summary_doble(t):
    return FG.summary(t, [kit.badge(t, 'Salsa', 'accent'), kit.badge(t, 'With partner', 'neutral', icon_name='people')],
                      1, 16, 'Abierta (dos manos) or Manos cruzadas', 'Abierta (una mano) or Candado', FG.DOBLE_NOTES)


def summary_basic(t):
    return FG.summary(t, [kit.badge(t, 'Salsa', 'accent'), kit.badge(t, 'With partner', 'neutral', icon_name='people')],
                      1, 8, 'Cerrada', 'Abierta (dos manos) or Manos cruzadas', 'Pull on 1, she turns right under the arm on 5–6, step back to open on 7.')


def summary_setenta(t, start=1, notes='Turn on 5, not before.'):
    return FG.summary(t, [kit.badge(t, 'Salsa', 'accent'), kit.badge(t, 'With partner', 'neutral', icon_name='people')],
                      start, 8, 'Cerrada', 'Candado', notes)


def links(t):
    plain = kit.row(t, 'Rueda calls glossary', 'ruedadecasino.example',
                    kit.icon_button(t, 'trash', 'Remove link', 'bare', color=t['muted'], on=t['surface']),
                    leading=chip_lead(t, 'external'), last=True)
    return (F.label(t, 'Links · 2', 10) + kit.youtube_card(t, 'Enchufla doble — Cuban style', 'youtube.com · 3:12', 'link')
            + kit.list_group(t, [plain]) + kit.button(t, 'Add a link', 'secondary', icon_name='plus', full=True))


def fig_left(t, fig='Doble', summary=None):
    move = kit.row(t, f'Move {fig} to…', 'A move of its own, or another move', kit.chevron(t),
                   leading=chip_lead(t, 'move-to'), href='#', last=True)
    return ((summary or summary_doble)(t) + O.fig_practice(t) + O.fig_routines(t)
            + O.follows_leads(t, False) + O.taught_in(t) + rule(t) + kit.list_group(t, [move])
            + kit.button(t, f'Archive {fig}', 'danger_text', icon_name='trash', full=True)
            + FG.caption(t, f'{fig} leaves Enchufla. Its recordings and practice history are kept.'))


def fig_right(t):
    up = kit.button(t, 'Add video or audio', 'secondary', icon_name='upload', full=True)
    return (F.label(t, 'Recordings · 2') + O.rec_card(t, 300, '0:41', O.SPOTS) + up
            + O.linked_sections(t) + links(t))


def figure_pane(t, sel=1, back=False, summary=None, top='', sub=None, left=None):
    fig = FIGS[sel]
    sub = sub or ('Figure · starts on 1 · 16 counts' if sel == 1 else 'Figure · starts on 1 · 8 counts')
    head = F.pane_head(t, f'Enchufla · {fig}', sub, back=back, actions=tonal(t, 'edit', f'Edit {fig}'), below=fig_tabs(t, 'Enchufla', FIGS, sel))
    lft = left if left is not None else fig_left(t, fig, summary)
    return F.pane(t, head, F.pane_cols(lft, fig_right(t), top=top), label_=f'Enchufla · {fig}')


# --------------------------------------------------------------------------
# boards: figures
# --------------------------------------------------------------------------

def b_figures(t, overlay=''):
    empty = F.empty_pane(t, 'moves', 'Pick a figure', 'Its timing, recordings and routines open here, beside the list. A move’s name opens the move.',
                         kit.button(t, 'New move', 'secondary', icon_name='plus'))
    return moves(t, F.split(t, figure_list(t), empty, 'Figures'), overlay=overlay)


def b_figure(t, overlay=''):
    return moves(t, F.split(t, figure_list(t, ('Enchufla', 'Doble')), figure_pane(t), 'Figures'), overlay=overlay)


def b_figure_from_routine(t):
    # Round 4: the switch stays on Routines and the routines stay on the left, the routine you came from lit.
    return moves(t, F.split(t, routine_list(t, 'Shine combo'), figure_pane(t, 0, back=True, summary=summary_basic), 'Routines'), seg=1)


def b_figure_filtered(t):
    res = [('Enchufla', [('Basic', 'Starts on 1 · 8 counts · 1 recording', True, True), ('Doble', 'Starts on 1 · 16 counts · 2 recordings', True, True)]),
           ('Kentucky', [('Doble', 'Starts on 1 · 16 counts', False, True)]),
           ('Setenta', [('Con giro', 'Starts on 1 · 16 counts · 1 recording', True, True)])]
    lst = figure_list(t, ('Enchufla', 'Doble'), search='en', selected=('Salsa', 'With partner'), count='4 figures match', items=res)
    return moves(t, F.split(t, lst, figure_pane(t), 'Figures'))


def edit_left(t):
    sp = FG.SP
    return (kit.text_field(t, 'Move name', 'Enchufla', state='filled', helper='Shared by its 4 figures')
            + sp + kit.text_field(t, 'Figure name', 'Doble', 'e.g. Basic, Doble, From cross', 'focused') + sp
            + f'<div style="display: flex; flex-direction: column; gap: 6px; flex: none">{FG.field_label(t, "Danced")}'
              f'{kit.segmented(t, ["With partner", "Solo"], 0, on_band=False, label="Danced")}</div>' + sp
            + f'<div style="display: flex; flex-direction: column; gap: 2px; flex: none">{FG.field_label(t, "Style")}'
              f'{kit.chips(t, STYLES, 0, label="Style", scroll=False)}</div>'
            + kit.textarea(t, 'Notes', FG.DOBLE_NOTES, 'Count, hand holds, what the teacher said…', 'filled', rows=4))


def pos_field(t, lab, values):
    """The shared picker's opener for a figure's positions: chips of what is chosen, or No position, and ›."""
    if values:
        inner = ''.join(f'<span style="height: 30px; padding: 0 12px; border-radius: 15px; background: {t["accent_soft"]}; color: {t["accent_text"]}; '
                        f'font-size: 14px; font-weight: 800; display: inline-flex; align-items: center">{v}</span>' for v in values)
    else:
        inner = f'<span style="font-size: 16px; color: {t["muted"]}">No position · fits anywhere</span>'
    return (f'<div style="display: flex; flex-direction: column; gap: 6px; flex: none"><span style="{ts("label", t["ink2"])}; padding-left: 4px">{lab}</span>'
            f'<button type="button" style="min-height: 56px; border: 0; border-radius: 14px; background: {t["field"]}; box-shadow: inset 0 0 0 1px {t["field_line"]}; '
            f'padding: 10px 10px 10px 12px; display: flex; align-items: center; gap: 8px; text-align: left; cursor: pointer">'
            f'<span style="flex: 1; display: flex; gap: 6px; flex-wrap: wrap">{inner}</span>{kit.chevron(t)}</button></div>')


def edit_right(t):
    sp = FG.SP
    counts = (kit.text_field(t, 'Counts', '16', state='filled', inputmode='numeric', suffix='counts')
              + f'<div style="margin-top: -4px">{kit.chips(t, ["4", "8", "16"], {2}, label="Length shortcuts", scroll=False)}</div>')
    rec = FG.recording(t, 'Wednesday 28 October', '34 MB', '0:41', 0,
                       [('Second turn', '0:12–0:19 · Linked to Hammerlock · Basic'), ('0:24–0:31', 'Not linked')], editing=True)
    return (F.label(t, 'Timing') + pos_field(t, 'Starts in', ('Abierta (dos manos)', 'Manos cruzadas')) + sp
            + pos_field(t, 'Ends in', ('Abierta (una mano)', 'Candado'))
            + f'<span style="font-size: 13px; line-height: 1.4; color: {t["muted"]}; padding: 0 4px; margin-top: -4px">Any number of each; '
              f'none means no position (fits anywhere).</span>' + sp + FG.count_grid(t, 1) + sp + counts
            + F.label(t, 'Recordings · 2', 14) + rec)


def b_figure_edit(t):
    head = pane_head_x(t, 'Enchufla · Doble', 'Editing Doble')
    save = (f'<span style="flex: 1; font-size: 14px; color: {t["muted"]}">Stop editing asks first if something is not saved.</span>'
            + kit.button(t, 'Save', 'primary', icon_name='check'))
    p = F.pane(t, head, F.pane_cols(edit_left(t), edit_right(t), ratio=('1fr', '1fr')), F.pinned(t, save, max_w=1140), 'Editing Enchufla · Doble')
    return moves(t, F.split(t, figure_list(t, ('Enchufla', 'Doble')), p, 'Figures'))


def new_move_fields(t, move='Enchu', fig='', focus='move'):
    s = STYLES
    return (kit.text_field(t, 'Move name', move, 'e.g. Dile que no, Enchufla', state='focused' if focus == 'move' else 'filled')
            + kit.text_field(t, 'Figure name', fig, 'e.g. Basic, Doble, From cross', state='focused' if focus == 'fig' else ('filled' if fig else 'empty'))
            + f'<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px">{MV.radio_chips(t, "Danced", ["With partner", "Solo"], 0)}'
              f'{MV.radio_chips(t, "Style", s, 0)}</div>'
            + kit.textarea(t, 'Notes', '', 'Count, hand holds, what the teacher said…', rows=3))


def b_new_figure(t):
    foot = (kit.button(t, 'Add move', 'primary', full=True, on=t['sheet_bg'])
            + f'<span style="text-align: center; font-size: 13px; color: {t["muted"]}">You can add recordings next.</span>')
    return b_figures(t, overlay=F.dialog(t, 'New move', new_move_fields(t), footer=foot))


def b_new_variation(t):
    inner = (kit.text_field(t, 'Name', 'Con salida', 'e.g. Doble, From cross', 'focused')
             + f'<p style="margin: 0; padding: 0 4px; font-size: 14px; line-height: 1.45; color: {t["muted"]}">It starts as a copy of Doble — handholds, timing and '
               f'notes, not its recordings. Change them with Edit.</p>')
    foot = kit.button(t, 'Add figure', 'primary', icon_name='plus', full=True, on=t['sheet_bg'])
    return b_figure(t, overlay=F.dialog(t, 'New figure', inner, sub='of Enchufla, copied from Doble', footer=foot))


def b_move_to(t):
    new = kit.radio(t, 'A move of its own', True, name='mv', meta='Doble becomes its first figure')
    inner = (f'<div style="background: {t["surface"]}; border-radius: 16px; padding: 6px 16px; flex: none">{new}</div>'
             + kit.text_field(t, 'New move’s name', 'Enchufla doble', state='filled')
             + kit.section_label(t, 'Or join a move', 8)
             + kit.select_field(t, 'Move', '', 'Choose a move…', 'empty'))
    foot = kit.button(t, 'Make it its own move', 'primary', full=True, on=t['sheet_bg'])
    return b_figure(t, overlay=F.dialog(t, 'Move “Doble” to…', inner, footer=foot))


def b_archive(t):
    q = F.question(t, 'Archive Doble?', 'Doble leaves Enchufla. Its recordings and practice history are kept.',
                   [kit.button(t, 'Cancel', 'tertiary', size='sm', on=t['raised']),
                    kit.button(t, 'Archive', 'danger', size='sm', on=t['raised'])], 'trash', 'danger')
    return b_figure(t, overlay=q)


# --------------------------------------------------------------------------
# boards: a move's page, in the pane
# --------------------------------------------------------------------------

def move_pane(t):
    figs = [('Enchufla · Basic', 'Starts on 1 · 8 counts · 1 recording'), ('Enchufla · Doble', 'Starts on 1 · 16 counts · 2 recordings'),
            ('Enchufla · Complicada', 'Starts on 5 · 12 counts'), ('Enchufla · Con mambo', 'Starts on 1 · 16 counts · 1 recording')]
    used = [('Shine combo', 'Routine · Basic and Doble'), ('Social set A', 'Routine · Doble'),
            ('Cubana class', 'Lesson · Tuesday 13 October'), ('Turn pattern workshop', 'Lesson · Saturday 3 October')]
    body = (F.label(t, 'Figures') + kit.list_group(t, [dict(title=n, meta=m, trailing=kit.chevron(t), href='#') for n, m in figs])
            + kit.button(t, 'New figure', 'secondary', icon_name='plus', full=True)
            + F.label(t, 'Used in', 14) + kit.list_group(t, [dict(title=n, meta=m, trailing=kit.chevron(t), href='#') for n, m in used]))
    head = F.pane_head(t, 'Enchufla', 'Move · 4 figures', actions=tonal(t, 'pencil', 'Rename Enchufla'))
    return F.pane(t, head, F.pane_body(body), label_='Enchufla')


def b_move(t, overlay=''):
    return moves(t, F.split(t, figure_list(t, open_move='Enchufla'), move_pane(t), 'Figures'), overlay=overlay)


def b_move_rename(t):
    inner = kit.text_field(t, 'Move name', 'Enchufla', state='focused')
    foot = kit.button(t, 'Save', 'primary', full=True, on=t['sheet_bg'])
    return b_move(t, overlay=F.dialog(t, 'Rename move', inner, sub='Its 4 figures keep their own names.', footer=foot, width=480))


# --------------------------------------------------------------------------
# boards: a group's figure (you added the lesson; you only read it) and your copy of it
# --------------------------------------------------------------------------

def rec_row(t, title, meta, take=False, last=False):
    tr = kit.button(t, 'Take', 'secondary', size='sm') if take else None
    th = (f'<span style="width: 64px; height: 40px; border-radius: 10px; background: {kit.mix(t["ink"], t["surface"], 0.85)}; display: flex; '
          f'align-items: center; justify-content: center; flex: none">{icon("play", 18, "#ffffff", filled=True)}</span>')
    return kit.row(t, title, meta, tr, leading=th, last=last, min_h=64)


def group_fig_left(t, start=1, notes='Turn on 5, not before.'):
    return summary_setenta(t, start, notes) + O.follows_leads(t, False) + F.label(t, 'Taught in · 1', 10) + kit.list_group(
        t, [dict(title='Week 6', meta=f'{TUES} · Tuesday 3 November', trailing=kit.chevron(t), href='#')])


def group_fig_right(t):
    return (F.label(t, 'Recordings · 1') + O.rec_card(t, 300, '0:38', [('Setenta, slow', '0:04–0:12 · Linked to Setenta · Básico', True)],
                                                         date='Ana, 3 Nov', size='12 MB'))


def reader_bar(t):
    return F.pinned(t, kit.button(t, 'Edit', 'secondary', icon_name='pencil') + f'<div style="flex: 1">{kit.button(t, "Practise", "primary", icon_name="play", full=True)}</div>',
                    max_w=1140)


def group_figure_pane(t):
    head = F.pane_head(t, 'Setenta · Básico', f'{TUES}’ figure · starts on 1 · 8 counts')
    top = (C.group_note(t, f'From Week 6. Use it in your routines as it is; it stays {TUES}’.')
           + C.actions(t, copy=True, same=True))
    return F.pane(t, head, F.pane_cols(group_fig_left(t), group_fig_right(t), top=top), reader_bar(t), 'Setenta · Básico')


def b_group_figure(t, overlay=''):
    return moves(t, F.split(t, figure_list(t, group_open=('Setenta', 'Básico'), tail=True), group_figure_pane(t), 'Figures'), overlay=overlay)


def b_make_mine(t):
    return b_group_figure(t, C.make_mine(t, 'Setenta · Básico'))


def copy_left(t, tabs=0, banner=None):
    notes = 'I turn her a bit earlier, on 4.' if tabs == 0 else 'Turn on 5, not before.'
    if tabs:  # theirs, as it is now: no practice of yours on it
        return summary_setenta(t, 3, notes) + O.follows_leads(t, False)
    return summary_setenta(t, 1, notes) + O.fig_practice(t).replace('Enchufla · Doble', 'Setenta · Básico')


def copy_right(t, tabs=0):
    if tabs == 0:
        rows = [rec_row(t, 'Ana, 3 Nov', f'Taken from {TUES} · 0:38', last=True)]
        return F.label(t, 'Recordings · 1') + kit.list_group(t, rows) + kit.button(t, 'Add video or audio', 'secondary', icon_name='upload', full=True)
    rows = [rec_row(t, 'Ana, 3 Nov', '0:38 · already in yours'), rec_row(t, 'Ana, 10 Nov', 'New · 0:41', take=True, last=True)]
    return F.label(t, 'Recordings · 2') + kit.list_group(t, rows)


def your_copy_pane(t, tab=0, banner='changed', overlay_actions=True):
    sub = f'Your copy · from {TUES}'
    acts = tonal(t, 'edit', 'Edit Setenta · Básico') if tab == 0 else ''
    head = F.pane_head(t, 'Setenta · Básico', sub, actions=acts)
    top = C.source_tabs(t, ['Yours', TUES], tab)
    if tab == 0:
        if banner == 'changed':
            top += C.compare_banner(t, f'{TUES} changed it since you took it: timing, 1 recording')
        elif banner == 'rejoined':
            top += C.compare_banner(t, f'Reconnected with {TUES}: 3 changes while you were away')
        top += C.actions(t, copy=True, same=True, detach=True, drop=True)
    else:
        top += C.group_note(t, f'{TUES}’ version, read-only. Take what you want into yours.')
    return F.pane(t, head, F.pane_cols(copy_left(t, tab), copy_right(t, tab), top=top), label_='Setenta · Básico')


def copy_list(t):
    """Your copy stands in the group's place in your list: under your own Setenta, the group's heading no longer has it."""
    items = MOVES[:4] + [('Setenta', [('Básico', 'Starts on 1 · 8 counts · 1 recording', True, True), ('Con giro', 'Starts on 1 · 16 counts · 1 recording', True, True)])]
    return figure_list(t, ('Setenta', 'Básico'), items=items, count='Yours · 15 figures', tail=True,
                       groups=[(TUES, [m for m in GROUP_MOVES[0][1] if m[0] != 'Setenta'])])


def b_your_copy(t, overlay=''):
    return moves(t, F.split(t, copy_list(t), your_copy_pane(t), 'Figures'), overlay=overlay)


def b_source_tab(t):
    return moves(t, F.split(t, copy_list(t), your_copy_pane(t, 1), 'Figures'))


def b_compare(t):
    cards = [C.compare_card(t, 'Timing', 'Only theirs changed', 'Starts on 1 · 8 counts', 'Starts on 3 · 8 counts', 'theirs'),
             C.compare_card(t, 'Notes', 'Both changed: pick', 'I turn her a bit earlier, on 4.', 'Turn on 5, not before.', None, mine_changed=True),
             C.compare_card(t, 'Recordings', 'New on theirs', '1 of theirs taken', '+ Ana, 10 Nov', 'theirs', theirs_changed=True)]
    return b_your_copy(t, C.compare(t, TUES, cards))


def b_rejoined(t):
    return moves(t, F.split(t, copy_list(t), your_copy_pane(t, banner='rejoined'), 'Figures'))


def b_drop(t):
    d = C.drop(t, [(f'{TUES}’', 'You copied it from here', True),
                   ('Rueda club’s', 'Not in a lesson you added: your practice can’t follow · Add Week 2 too', False)],
               f'Only in yours: your notes. You edit {TUES}.')
    return b_your_copy(t, d)


def b_dropped(t):
    toast = F.toast(t, f'Back on {TUES}’. Your copy is archived.', icon_name='check', bottom=110)
    return moves(t, F.split(t, figure_list(t, group_open=('Setenta', 'Básico'), tail=True), group_figure_pane(t), 'Figures'), overlay=toast)


def b_detach(t):
    return b_your_copy(t, C.detach(t))


# --------------------------------------------------------------------------
# boards: your figure in two groups (the hub), Send mine, Copy to…, twins
# --------------------------------------------------------------------------

def hub_left(t):
    fam = C.family(t, [('mine', 'Yours', 'This one · you changed notes, +1 recording', None, False),
                       ('group', TUES, 'Owner · behind yours: notes, 1 recording', ('Behind', 'neutral'), True),
                       ('group', 'Rueda club', 'Editor · differs both ways', ('Differs', 'warn'), True)])
    return fam + rule(t) + summary_doble(t) + O.fig_practice(t) + O.fig_routines(t)


def hub_pane(t):
    head = F.pane_head(t, 'Enchufla · Doble', 'Yours · in 2 groups', actions=tonal(t, 'edit', 'Edit Doble'), below=fig_tabs(t, 'Enchufla', FIGS, 1))
    top = C.compare_banner(t, 'Rueda club’s copy differs: timing') + C.actions(t, copy=True, same=True)
    return F.pane(t, head, F.pane_cols(hub_left(t), fig_right(t), top=top), label_='Enchufla · Doble')


def b_copies(t, overlay=''):
    return moves(t, F.split(t, figure_list(t, ('Enchufla', 'Doble')), hub_pane(t), 'Figures'), overlay=overlay)


def b_send(t):
    d = C.send(t, [(TUES, 'Notes · 1 new recording (charged to the group)', True),
                   ('Rueda club', 'Notes · 1 new recording (charged to the group) · timing: they changed it too, you’ll pick', True)],
               [('Also delete “old take” there', 'Gone from the copy you’re sending. Refused where a lesson links its section.')])
    return b_copies(t, d)


def b_send_pick(t):
    card = C.compare_card(t, 'Timing', 'Both changed: pick', 'Starts on 1 · 16 counts', 'Starts on 5 · 16 counts', 'mine', mine_changed=True)
    d = C.send_pick(t, 'Rueda club', card, 'Pick yours and theirs is replaced in Rueda club. Pick theirs and you send only the rest.')
    return b_copies(t, d)


def b_copy_to(t):
    d = C.copy_to(t, 'Enchufla · Doble',
                  [('group', TUES, 'Owner · 412 MB of 1 GB used', False), ('group', 'Rueda club', 'Editor · 80 MB of 1 GB used', True)],
                  '2 recordings (46 MB, charged to the group) · notes')
    return b_figure(t, overlay=d)


def b_copy_which(t):
    d = C.which(t, 'Enchufla · Doble', TUES, [('mine', 'Yours', 'Last changed 30 Oct', True), ('group', 'Rueda club’s', 'Marko’s · last changed 2 Nov', False)])
    return b_figure(t, overlay=d)


def twins_pane(t):
    head = F.pane_head(t, 'Enchufla · Doble', 'Twins · 3 versions', actions=tonal(t, 'edit', 'Edit Doble'), below=fig_tabs(t, 'Enchufla', FIGS, 1))
    sep = f'<div style="display: flex; justify-content: center; flex: none">{kit.button(t, "Not the same? Separate", "tertiary", size="sm")}</div>'
    top = C.source_tabs(t, ['Yours', TUES, 'Rueda club'], 0) + sep
    return F.pane(t, head, F.pane_cols(fig_left(t), fig_right(t), top=top), label_='Enchufla · Doble')


def b_twins(t):
    return moves(t, F.split(t, figure_list(t, ('Enchufla', 'Doble'), twins=True), twins_pane(t), 'Figures'))


def b_same_as(t):
    d = C.same_as(t, 'Enchufla · Doble', [('group', 'Enchufla · Básica', f'{TUES}’', True), ('group', 'Enchufla · Doble', 'Rueda club’s', True),
                                           ('mine', 'Enchufla · Con mambo', 'Yours', False)])
    return b_figure(t, overlay=d)


# --------------------------------------------------------------------------
# boards: group mode (owners and editors work inside one group)
# --------------------------------------------------------------------------

def gm_figure_pane(t):
    head = F.pane_head(t, 'Sombrero · Básico', f'{TUES}’ figure · starts on 1 · 16 counts',
                       actions=tonal(t, 'clock', 'History') + tonal(t, 'edit', 'Edit Básico'))
    top = (C.note(t, 'Members don’t see it yet: no published lesson links it.', 'eye-off', 'accent')
           + f'<span style="font-size: 13px; color: {t["muted"]}; padding: 0 4px">Edited by Ana · 2 days ago</span>')
    left = FG.summary(t, [kit.badge(t, 'Salsa', 'accent'), kit.badge(t, 'With partner', 'neutral', icon_name='people')],
                      1, 16, 'Abierta', 'Abierta', 'Hat over her head on 3, over yours on 7.')
    left += F.label(t, 'Taught in', 10) + kit.list_group(t, [dict(title='Not in a lesson yet', meta='Link it from a lesson’s sections or Figures', min_h=56)])
    right = F.label(t, 'Recordings') + kit.button(t, 'Add video or audio', 'secondary', icon_name='upload', full=True)
    return F.pane(t, head, F.pane_cols(left, right, top=top), label_='Sombrero · Básico')


def b_group_mode(t):
    g = F.in_group(t)
    return moves(g, F.split(g, group_list(g, ('Sombrero', 'Básico')), gm_figure_pane(g), 'Figures'), group=TUES)


def b_group_new(t):
    g = F.in_group(t)
    inner = (new_move_fields(g, 'Kentucky', 'Básico', focus='fig')
             + C.note(g, 'Only the group’s editors see it until a published lesson links it.', 'eye-off', 'accent'))
    foot = kit.button(g, 'Add move', 'primary', full=True, on=g['sheet_bg'])
    empty = F.empty_pane(g, 'moves', 'Pick a figure', 'The group’s figures open here.')
    return moves(g, F.split(g, group_list(g), empty, 'Figures'), group=TUES,
                 overlay=F.dialog(g, f'New move in {TUES}', inner, sub='It belongs to the group, not to you.', footer=foot))


def gm_routines(t):
    rs = [('Setenta into Sombrero', '4 slots · loops · in Week 6', True), ('Rueda warm-up', '8 slots · in Week 4', True), ('Vacílala loop', '3 slots', False)]
    out = [kit.row(t, n, m + ('' if seen else ' · ' + hidden_mark(t)), kit.chevron(t), href='#', last=i == len(rs) - 1, min_h=68)
           for i, (n, m, seen) in enumerate(rs)]
    note = (f'<p style="margin: 0; border-radius: 16px; background: {t["surface"]}; padding: 12px 16px; font-size: 13px; line-height: 1.4; '
            f'color: {t["muted"]}; flex: none">Anything not in a published lesson stays with the editors. Link it from a lesson and members get it.</p>')
    return note + F.label(t, '3 routines', 4) + kit.list_group(t, out)


def b_group_mode_routines(t):
    g = F.in_group(t)
    empty = F.empty_pane(g, 'routine', 'Pick a routine', 'Sketch a routine first, link it from a lesson later. The editor is the same as for your own.',
                         kit.button(g, 'New routine', 'secondary', icon_name='plus'))
    return moves(g, F.split(g, gm_routines(g), empty, 'Routines'), seg=1, group=TUES)


def b_work_in(t):
    return b_figures(t, overlay=C.work_in(t))


# --------------------------------------------------------------------------
# boards: Positions and Coverage, in the pane
# --------------------------------------------------------------------------

def positions_pane(t):
    ps = MV.SALSA_POS
    tagged = '31 of 41 figures tagged'
    intro = (f'<p style="margin: 0; padding: 0 4px; font-size: 14px; line-height: 1.45; color: {t["ink2"]}">'
             f'<b style="color: {t["ink"]}">{tagged}.</b> A figure with none tagged starts and ends at the neutral hold.</p>')
    gaps = sum(1 for _, i, o, _n in ps if (i > 0) != (o > 0))
    ban = kit.banner(t, 'warning', f'{gaps} gaps in the graph',
                     'Dead end: nothing you know leaves it. Orphan: nothing you know gets you there.')
    body = intro + ban + F.label(t, MV.plural(len(ps), 'position', 'positions'), 6) + kit.list_group(t, [MV.pos_row(t, *p) for p in ps])
    head = F.pane_head(t, 'Positions', 'Hands before and after a figure', actions=tonal(t, 'plus', 'New position'))
    return F.pane(t, head, F.pane_body(body), label_='Positions')


def b_positions(t, overlay=''):
    return moves(t, F.split(t, figure_list(t, lit_tile='positions'), positions_pane(t), 'Figures'), overlay=overlay)


def b_position_rename(t):
    name = 'Caída'
    inner = (kit.text_field(t, 'Name', name, state='focused')
             + f'<div style="display: flex; gap: 8px; flex-wrap: wrap">{kit.badge(t, "2 in", "neutral")}{kit.badge(t, "0 out", "neutral")}'
               f'{kit.badge(t, "dead end", "danger", icon_name="warning")}</div>')
    foot = (kit.button(t, 'Save', 'primary', full=True, on=t['sheet_bg'])
            + kit.button(t, 'Remove position', 'danger_text', icon_name='trash', full=True, on=t['sheet_bg']))
    return b_positions(t, overlay=F.dialog(t, name, inner, sub='Position', footer=foot))


def coverage_pane(t):
    picked = MV.picks(SAL)
    none, one, many = MV.cov_data(SAL)

    def r(title, meta=None):
        n = picked.get(title)
        return dict(title=title, meta=meta, href='#', leading=MV.pick_disc(t, n), state='selected' if n else 'default',
                    min_h=52 if not meta else 64)
    gl = lambda text, n, status=False: F.label(t, f'{text} · {n}', 10).replace(t['muted'], t['status'], 1) if status else F.label(t, f'{text} · {n}', 10)  # noqa: E731
    body = (gl('In no routine', len(none), True).replace('padding: 10px', 'padding: 0', 1) + kit.list_group(t, [r(n) for n in none])
            + gl('In 1 routine', len(one)) + kit.list_group(t, [r(n, m) for n, m in one])
            + gl('In 2+ routines', len(many)) + kit.list_group(t, [r(n, m) for n, m in many]))
    head = pane_head_x(t, f'{len(picked)} selected', 'Coverage · figures by how many routines use them')
    bar = (f'<span style="flex: 1; font-size: 14px; color: {t["muted"]}">Tap in the order the routine should call them.</span>'
           + kit.button(t, 'Cancel', 'tertiary', size='sm') + kit.button(t, 'Create routine', 'primary', size='sm', icon_name='plus'))
    return F.pane(t, head, F.pane_body(body), F.pinned(t, bar), 'Coverage')


def b_coverage_select(t):
    return moves(t, F.split(t, figure_list(t, lit_tile='coverage'), coverage_pane(t), 'Figures'))


# --------------------------------------------------------------------------
# boards: Routines and a routine
# --------------------------------------------------------------------------

ROUTINES_S = [('Basic loop', 4, 0, False), ('Friday combo', 8, 2, False), ('Kentucky line', 5, 1, True),
              ('Rueda warm-up', 3, 0, False), ('Setenta combo', 6, 0, True), ('Shine combo', 6, 1, True), ('Social night', 12, 0, False)]
GROUP_ROUTINES = [('Setenta into Sombrero', '4 slots · loops · from Week 6'), ('Rueda warm-up', '8 slots · loops · from Week 4')]


def routine_list(t, open_=None, group_open=None):
    rs = ROUTINES_S
    out = []
    for i, (n, s, b, nl) in enumerate(rs):
        html = kit.row(t, n, MV.routine_meta(t, s, b, nl), kit.chevron(t), href='#', last=i == len(rs) - 1, min_h=68)
        out.append(F.lit(t, html) if n == open_ else html)
    gr = []
    for i, (n, m) in enumerate(GROUP_ROUTINES):
        html = kit.row(t, n, m, kit.chevron(t), href='#', last=i == len(GROUP_ROUTINES) - 1, min_h=68)
        gr.append(F.lit(t, html) if n == group_open else html)
    return (F.label(t, f'Yours · {len(rs)}', 4) + kit.list_group(t, out)
            + group_heading(t, TUES, len(GROUP_ROUTINES)) + kit.list_group(t, gr))


def b_routines(t):
    empty = F.empty_pane(t, 'routine', 'Pick a routine', 'Its slots, where it breaks and whether it loops open here, beside the list.',
                         kit.button(t, 'New routine', 'secondary', icon_name='plus'))
    return moves(t, F.split(t, routine_list(t), empty, 'Routines'), seg=1)


def more_rows(t):
    return (F.label(t, 'More', 14)
            + kit.list_group(t, [dict(title='Its exercise', meta='Every week · done 2 days ago', trailing=kit.chevron(t), href='#'),
                                 dict(title='Taught in', meta='Cubana class · Tuesday 13 October', trailing=kit.chevron(t), href='#')]))


def routine_head(t):
    return F.pane_head(t, 'Shine combo', 'Routine · 6 slots · loops', actions=tonal(t, 'edit', 'Edit routine') + tonal(t, 'more', 'More'))


def b_routine(t):
    hero = kit.hero_card(t, 'Practise', 'Count only or with a song', straddle=False, label='Practise Shine combo')
    body = (hero + '<div style="height: 6px; flex: none"></div>' + RT.facts(t, 'Abierta (dos manos)', 'Cerrada', False, 1, 1)
            + F.label(t, 'Slots · 6', 6) + RT.add_top(t) + RT.slots_salsa(t) + RT.add_end(t, 6) + more_rows(t))
    p = F.pane(t, routine_head(t), F.pane_body(body), label_='Shine combo')
    return moves(t, F.split(t, routine_list(t, 'Shine combo'), p, 'Routines'), seg=1)


def b_routine_group_slot(t):
    out = ''
    for s in RT.SL:
        s = dict(s)
        if s['n'] == 3:
            s['title'] = f'Setenta · Básico&nbsp; {gchip(t, TUES)}'
        out += RT.slot(t, **s)
    note = C.group_note(t, f'Setenta is {TUES}’. If you leave the group, you keep a copy and this routine keeps working.')
    hero = kit.hero_card(t, 'Practise', 'Count only or with a song', straddle=False, label='Practise Shine combo')
    body = (hero + '<div style="height: 6px; flex: none"></div>' + RT.facts(t, 'Abierta (dos manos)', 'Cerrada', False, 1, 1)
            + F.label(t, 'Slots · 6', 6) + RT.add_top(t) + out + RT.add_end(t, 6) + note)
    p = F.pane(t, routine_head(t), F.pane_body(body), label_='Shine combo')
    return moves(t, F.split(t, routine_list(t, 'Shine combo'), p, 'Routines'), seg=1)


def ro_slot(t, n, title, meta):
    return (f'<div style="display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 6px 16px; background: {t["surface"]}; '
            f'border-radius: 16px; flex: none">{RT.number(t, n)}<span style="display: flex; flex-direction: column; gap: 2px">'
            f'<span style="font-size: 16px; font-weight: 700; color: {t["ink"]}">{title}</span>'
            f'<span style="font-size: 13px; color: {t["muted"]}">{meta}</span></span></div>')


def b_group_routine(t):
    slots = [('Setenta · Básico', '1→1 · Closed → Hammerlock · 8 counts'), ('Enchufla · Doble', '1→1 · Hammerlock → Open · 16 counts'),
             ('Sombrero · Básico', '1→1 · Open → Open · 16 counts'), ('Dile que no · Básico', '1→1 · Open → Closed · 8 counts')]
    body = (C.group_note(t, 'From Week 6. The group’s editors change it; you practise it.') + C.actions(t, copy=True, same=True)
            + RT.facts(t, 'Cerrada', 'Cerrada', True, 0, 0) + F.label(t, 'Slots · 4', 6)
            + ''.join(ro_slot(t, i + 1, n, m) for i, (n, m) in enumerate(slots)))
    head = F.pane_head(t, 'Setenta into Sombrero', f'{TUES}’ routine · 4 slots · loops')
    p = F.pane(t, head, F.pane_body(body), reader_bar(t), 'Setenta into Sombrero')
    return moves(t, F.split(t, routine_list(t, group_open='Setenta into Sombrero'), p, 'Routines'), seg=1)


def pointer(t):
    """A mouse pointer, so the board reads as hovered."""
    return ('<svg aria-hidden="true" width="22" height="26" viewBox="0 0 22 26" style="position: absolute; right: 22px; top: 34px; z-index: 2; '
            'filter: drop-shadow(0 1px 2px rgba(0,0,0,0.35))"><path d="M2 2v19l5-4.6 3.4 7.6 3.2-1.4-3.3-7.4H17z" fill="#ffffff" stroke="#111114" '
            'stroke-width="1.6" stroke-linejoin="round"/></svg>')


def hovered_slot(t, s):
    """Slot card under the pointer: the hover overlay and the trash button (desktop stand-in for swipe to delete)."""
    card = RT.slot(t, **s)
    card = card.replace(f'background: {t["surface"]}; border-radius: 16px; padding: 8px 6px 8px 2px;',
                        f'background: {kit.mix(t["surface"], t["ink"], 0.95)}; box-shadow: inset 0 0 0 1px {t["hairline"]}; '
                        f'border-radius: 16px; padding: 8px 6px 8px 2px;', 1)
    trash = kit.icon_button(t, 'trash', f'Delete slot {s["n"]}', 'tonal', color=t['danger'], on=t['surface'])
    return (f'<div style="position: relative">{card}'
            f'<div style="position: absolute; right: 12px; top: 10px">{trash}</div>{pointer(t)}</div>')


def b_routine_edit(t):
    out = ''
    for s in RT.SL:
        if s['n'] == 3:
            out += hovered_slot(t, s)
        else:
            out += RT.slot(t, state='expanded' if s['n'] == 2 else 'default', note_state='focused', **s)
        if s['n'] == 3:
            out += RT.seam(t, 3, 4, RT.SEAM_3, bridge=True)
        if s['n'] == 5:
            out += RT.seam(t, 5, 6, RT.SEAM_5)
    body = RT.facts(t, 'Abierta (dos manos)', 'Cerrada', False, 1, 1) + F.label(t, 'Slots · 6', 6) + RT.add_top(t) + out + RT.add_end(t, 6)
    p = F.pane(t, routine_head(t), F.pane_body(body), label_='Shine combo')
    return moves(t, F.split(t, routine_list(t, 'Shine combo'), p, 'Routines'), seg=1)


def b_routine_picker(t):
    groups = [
        ('Figures', [('row', 'Dile que no · Hammerlock out', '1→1 · Hammerlock → Closed'),
                     ('head', 'Setenta'),
                     ('var', 'Salida', '1→1 · Hammerlock → Open'),
                     ('var', 'Con vuelta', '1→1 · Hammerlock → Open'),
                     ('row', 'Setenta · Básico', f'{TUES}’ · used as it is'),
                     ('row', 'Vacílala · Hammerlock', '1→1 · Hammerlock / Closed → Open')]),
        ('Routines', [('row', 'Hammerlock exit', '1→1 · Hammerlock → Open · 2 slots')]),
    ]
    lst = ''.join(F.label(t, lab, 6) + RT.pick_group(t, items) for lab, items in groups)
    lst = lst.replace('>variations</span>', '>figures</span>')
    inner = (kit.search_field(t, 'Search figures and routines', '', 'focused') + RT.filter_chips(t)
             + f'<div style="flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: 8px">{lst}</div>')
    sub = (f'<span style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: {t["ink2"]}">'
           f'{icon("flag", 15, t["accent_text"])}Starts on 1 from Hammerlock</span>')
    body = RT.facts(t, 'Abierta (dos manos)', 'Cerrada', False, 1, 1) + F.label(t, 'Slots · 6', 6) + RT.add_top(t) + RT.slots_salsa(t) + RT.add_end(t, 6)
    p = F.pane(t, routine_head(t), F.pane_body(body), label_='Shine combo')
    dlg = F.dialog(t, 'Add after slot 3', inner, sub=sub)
    return moves(t, F.split(t, routine_list(t, 'Shine combo'), p, 'Routines'), seg=1, overlay=dlg)


def b_routine_select(t):
    out = RT.add_top(t, disabled=True) + RT.slots_salsa(t, mode='select', states={1: 'selected', 2: 'selected'})
    body = F.label(t, 'Slots · 6') + out
    bar = (RT.selection_bar(t, can_one=False, can_make=True)
           .replace('position: absolute; left: 0; right: 0; bottom: 0; ', 'flex: none; ', 1)
           .replace(f'background: {t["tab_bg"]}; border-top: 1px solid {t["tab_line"]}', f'background: {t["ground"]}; border-top: 1px solid {t["hairline"]}', 1)
           .replace('padding: 8px 8px 26px; box-shadow: 0 -8px 24px rgba(0,0,0,0.08)', 'padding: 8px 40px 14px', 1)
           .replace('display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 2px',
                    'display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 2px; max-width: 720px; margin: 0 auto', 1))
    p = F.pane(t, pane_head_x(t, '2 selected', 'Shine combo'), F.pane_body(body), bar, 'Selecting slots of Shine combo')
    return moves(t, F.split(t, routine_list(t, 'Shine combo'), p, 'Routines'), seg=1)


# --------------------------------------------------------------------------
# a lesson behind Move to… a group (the one clone sheet that only a lesson has)
# --------------------------------------------------------------------------

def b_move_lesson(t):
    rows = [dict(title='Week 3 · Enchufla', meta='Tuesday 27 October · 3 figures · 2 videos', trailing=kit.chevron(t), href='#'),
            dict(title='Week 2 · Setenta', meta='Tuesday 20 October · 2 figures · 1 video', trailing=kit.chevron(t), href='#')]
    lst = F.label(t, 'October 2026', 4) + F.lit(t, kit.list_group(t, rows))
    figs = kit.list_group(t, [dict(title='Enchufla · Doble', meta='2 sections', trailing=kit.chevron(t), href='#'),
                              dict(title='Setenta · Básico', meta='1 section', trailing=kit.chevron(t), href='#'),
                              dict(title='Dile que no · Básico', trailing=kit.chevron(t), href='#', min_h=52)])
    body = (C.actions(t, copy=True, same=True, move=True)
            + kit.card(t, f'<span style="{ts("label", t["muted"])}">Notes</span><p style="margin: 6px 0 0; {ts("body", t["ink"])}">Enchufla doble: left hand low on 3.</p>')
            + F.label(t, 'Figures · 3', 10) + figs)
    head = F.pane_head(t, 'Week 3 · Enchufla', 'Your lesson · 27 Oct', actions=tonal(t, 'edit', 'Edit lesson'))
    pane = F.pane(t, head, F.pane_body(body), label_='Week 3 · Enchufla')
    d = C.move_to_group(t, 'Week 3', TUES, [('Enchufla · Doble', 'Used by 2 other lessons', True),
                                             ('Setenta · Básico', 'Only this lesson', False),
                                             ('Dile que no · Básico', 'Used by Week 4 loop', True)])
    return F.frame(t, 'Lessons', 'Lessons', F.split(t, lst, pane, 'Lessons'), right=F.group_btn(t) + F.act(t, 'plus', 'New lesson'), overlay=d)


# --------------------------------------------------------------------------

BOARDS = [
    F.Board('figures', 'Figures · nothing open', b_figures,
            'Figures under their move’s name (the name opens the move), “Yours · 14 figures”, then each group’s figures under a slight heading. '
            'The band: Figures | Routines, the group button (you edit a group) and + New move.'),
    F.Board('figure', 'A figure open beside the list', b_figure,
            'The pane title is the label, “Enchufla · Doble”, with “Figure · starts on 1 · 16 counts”. The move’s other figures are tabs under it, '
            'with + Figure and “Open Enchufla ›” (my call: the phone keeps its switcher at the bottom; desktop keeps the tabs).'),
    F.Board('figure-from-routine', 'A figure opened from a routine’s slot', b_figure_from_routine,
            'Opened from a slot of Shine combo: the switch stays on Routines and the routines stay on the left, Shine combo lit. '
            '‹ in the pane goes back to the routine. Opened from the Figures list, a figure has no ‹.', changed=True),
    F.Board('figure-filtered', 'Searching and filtering, a figure open', b_figure_filtered,
            'The search and chips stay put. A search keeps each move’s heading over its matching figures, as the pickers do.'),
    F.Board('figure-edit', 'Editing a figure in the pane', b_figure_edit,
            '× (Stop editing) where ‹ would be, the tabs hidden, Move name (shared by its 4 figures) and Figure name, timing and recordings on the right.'),
    F.Board('new-figure', 'New move (a dialog)', b_new_figure,
            'The band’s + makes a move with its first figure: Move name, Figure name, Add move.'),
    F.Board('new-variation', 'New figure in Enchufla (from + Figure)', b_new_variation,
            'Opened from the dashed + Figure tab. It starts as a copy of the open figure.'),
    F.Board('move-to', 'Move Doble to…', b_move_to, 'A move of its own, or join another move. Moving the last figure warns: “Move and remove move”.'),
    F.Board('archive', 'Archive Doble?', b_archive, 'The question dialog. Archiving the last figure says “Archive and remove move”.'),
    F.Board('move', 'A move’s page beside the list', b_move,
            'New. The move’s heading is lit in the list. Its figures, New figure, and where they are used (routines and lessons). '
            'Rename is the pencil (my call: the phone’s ⋯ has only Rename and New figure, and New figure is already in the page).'),
    F.Board('move-rename', 'Rename a move', b_move_rename, 'The rename sheet as a small dialog.'),
    F.Board('group-figure', 'A group’s figure, from a lesson you added', b_group_figure,
            'The list is scrolled to the group’s figures, under their slight heading. Read-only and marked as the group’s: the note says where it came from. Copy to… and Same as… under it; Edit and Practise pinned at the bottom (board C1 p1).'),
    F.Board('make-mine', 'Edit on a group’s figure: Make it mine', b_make_mine,
            'Edit asks once: what you get, what stays the group’s, and what of yours moves over (C2 p1).'),
    F.Board('your-copy', 'Your copy: a tab per source', b_your_copy,
            'Yours | Salsa Tuesdays at the top of the pane, the “changed since you took it” banner with Compare, then Copy to… · Same as… · Detach · Drop my copy. '
            'Your copy takes the group’s place in the list (under your own Setenta).'),
    F.Board('source-tab', 'The source’s tab: theirs, read-only, Take a recording', b_source_tab,
            'Their version as it is now. Take on a recording that is not in yours yet (C2 p3).'),
    F.Board('compare', 'Compare with Salsa Tuesdays’', b_compare,
            'Field by field: one side changed is preselected, both changed you pick (C2 p4). Yours and theirs side by side fit the 560 dialog.'),
    F.Board('rejoined', 'Rejoining: reconnected', b_rejoined, 'The banner after rejoining: nothing changes until you Compare (C8 p2).'),
    F.Board('drop', 'Drop your copy? (several versions)', b_drop,
            'With several versions you pick; the one you copied from is preselected. Send mine first sits above Drop when you edit that group (C5 p2).'),
    F.Board('dropped', 'Back on the class’s', b_dropped, 'After Drop: the group’s figure again, read-only, and the toast.'),
    F.Board('detach', 'Detach: stop following Salsa Tuesdays?', b_detach, 'A clone becomes a twin: same move, separate from now on (C8 p1).'),
    F.Board('copies', 'Your figure in two groups: copies you can see', b_copies,
            'Your Enchufla · Doble as the hub: every copy you can see, with a chip for how it stands, and Send mine… at the list’s foot (C3 p1).'),
    F.Board('send', 'Send your changes', b_send, 'Each group you edit, ticked when something would land; a delete is its own box, unticked (C3 p2).'),
    F.Board('send-pick', 'Send: both changed, pick first', b_send_pick, 'A second level (‹ Back) for a field both changed (C3 p3).'),
    F.Board('copy-to', 'Copy Enchufla · Doble to…', b_copy_to,
            'Your figure into a group you own or edit. What goes, charged to the group. (A lesson or song into a group says “Copy as a draft”.)'),
    F.Board('copy-which', 'Copy: which Enchufla · Doble?', b_copy_which, 'Asked only when what you send has twins; a level over Copy to… (C4 p4).'),
    F.Board('same-as', 'Same as…', b_same_as, 'Tick the figures you see that are the same move, from any group (C7 p1).'),
    F.Board('twins', 'Twins: one figure, a tab per source', b_twins,
            'In the list a twinned figure is one row with a Twins chip, and its move says “also in Salsa Tuesdays, Rueda club”. '
            'The pane: Yours | Salsa Tuesdays | Rueda club, and Not the same? Separate (C7 p2, p3).'),
    F.Board('group-mode', 'Group mode: the group’s Moves', b_group_mode,
            'Navy band and side, the stripe and “Salsa Tuesdays · group” over the title, Mine where Today was. No tiles: Coverage is personal, the group’s positions are under Positions in the switch. '
            'The note at the top; “Members don’t see it yet” on what no published lesson links. A figure open with History and Edit (my call: History as a pane action).'),
    F.Board('group-new', 'Group mode: + makes the group’s move', b_group_new,
            'The usual New move dialog, saying whose it is and who sees it (F2 p3).'),
    F.Board('group-mode-routines', 'Group mode: the group’s routines', b_group_mode_routines, 'Routines in the group, with the same marker (F2 p2).'),
    F.Board('work-in', 'Work in (the group button)', b_work_in,
            'Mine and each group you own or edit, one tap each. With one group the button goes straight in, no dialog.'),
    F.Board('coverage-select', 'Coverage, picking figures for a routine', b_coverage_select,
            'Coverage in the pane, its tile lit. Selecting: “3 selected” with ×, numbered discs in tap order, the bar pinned at the pane’s bottom. '
            'Select lives in the pane (my call: the band is Moves’).'),
    F.Board('routines', 'Routines · nothing open', b_routines,
            'Yours, then each group’s routines from the lessons you added (read-only), under the same slight heading Figures uses.'),
    F.Board('routine', 'A routine open beside the list', b_routine,
            'One column (720) in the pane: Practise, starts/ends, the slots with their seams, More. Edit and ⋯ (Select slots) in the pane header.'),
    F.Board('routine-group-slot', 'Your routine using a group’s figure', b_routine_group_slot,
            'Slot 3 is Salsa Tuesdays’ Setenta, marked with the group; the note under the slots says it keeps working if you leave (C1 p3).'),
    F.Board('group-routine', 'A group’s routine, read-only', b_group_routine,
            'From a lesson you added: no drag, no pencil in the header; Edit (makes it yours) and Practise pinned (F1 p2).'),
    F.Board('routine-edit', 'Working on the slots: one open, the pointer over another', b_routine_edit,
            'Slot 2 open with its note and alternatives. The pointer over slot 3 shows the hover tint and a trash button (stands in for swipe to delete).'),
    F.Board('routine-picker', 'Add after slot 3 (the routine picker)', b_routine_picker,
            'The picker as a dialog, search focused. It offers your groups’ figures too: “Salsa Tuesdays’ · used as it is” (C1 p2).'),
    F.Board('routine-select', 'Selecting slots', b_routine_select,
            '“2 selected” with × in the pane header; the five actions pinned at the pane’s bottom, centred at 720.'),
]


# The phone's content helpers are salsa-only, so these boards are drawn in the two salsa themes.
for _b in BOARDS:
    _b.themes = ('salsa-light', 'salsa-dark')
