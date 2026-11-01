"""Moves area: Figures | Routines, Positions (the gap report), Coverage, and their sheets and states.

    python3 -I moves.py  -> canvas/project/S-moves.dc.html
"""
import sys

S = '/tmp/claude-1000/-home-tilen-Projects-salsaapp-wt-app-icons/cf18291b-f44a-483d-bf97-2da9a238a117/scratchpad'
sys.path.insert(0, S + '/gen/kit')
import kit  # noqa: E402

OUT = S + '/canvas/project/S-moves.dc.html'


# --------------------------------------------------------------------------
# content
# --------------------------------------------------------------------------

def styles(t):
    return ['Salsa', 'Son', 'Other'] if t['dance'] == 'salsa' else ['Dominican', 'Sensual', 'Traditional']


# (name, variations, recordings, has_section, has_lesson)
SALSA_FIGS = [
    ('Dile que no', 3, 2, True, True), ('Enchufla', 4, 3, True, True), ('Exhíbela', 1, 0, False, False),
    ('Kentucky', 2, 1, True, False), ('Setenta', 3, 2, True, True), ('Sombrero', 2, 1, False, True),
    ('Vacílala', 1, 1, True, True), ('Prima con la hermana', 1, 0, False, False),
]
BACHATA_FIGS = [
    ('Body wave', 3, 2, True, True), ('Cuddle turn', 1, 0, False, False), ('Hammerlock', 2, 1, True, True),
    ('Media luna', 1, 1, True, False), ('Shadow position', 4, 3, True, True), ('Hip roll', 2, 0, False, True),
]


def figs(t):
    return SALSA_FIGS if t['dance'] == 'salsa' else BACHATA_FIGS


def plural(n, one, many):
    return f'{n} {one if n == 1 else many}'


def fig_meta(t, v, r, sec, les):
    parts = [plural(v, 'variation', 'variations')]
    if r:
        parts.append(plural(r, 'recording', 'recordings'))
    st = f'color: {t["status"]}; font-weight: 700'
    if not sec:
        parts.append(f'<span style="{st}">No section</span>')
    if not les:
        parts.append(f'<span style="{st}">No lesson</span>')
    return ' · '.join(parts)


def fig_rows(t, items):
    return [dict(title=n, meta=fig_meta(t, v, r, s, l), trailing=kit.chevron(t), href='#') for n, v, r, s, l in items]


# --------------------------------------------------------------------------
# new building blocks (from kit tokens only)
# --------------------------------------------------------------------------

def nav_tile(t, icon_name, title, meta, meta_status=False):
    """A half-width link card: tonal icon disc, title, one meta line. Two sit side by side
    at the top of the Figures list (Positions, Coverage)."""
    mc, mw = (t['status'], 700) if meta_status else (t['muted'], 500)
    return (f'<a href="#" style="flex: 1; min-width: 0; min-height: 64px; box-sizing: border-box; background: {t["surface"]}; border-radius: 16px; '
            f'padding: 12px 12px; display: flex; align-items: center; gap: 10px; text-decoration: none; color: {t["ink"]}">'
            f'<span style="width: 38px; height: 38px; flex: none; border-radius: 19px; background: {t["accent_soft"]}; display: flex; align-items: center; justify-content: center">'
            f'{kit.icon(icon_name, 22, t["accent_text"])}</span>'
            f'<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px">'
            f'<span style="font-size: 16px; font-weight: 700; line-height: 1.3">{title}</span>'
            f'<span style="font-size: 13px; line-height: 1.3; font-weight: {mw}; color: {mc}; white-space: nowrap">{meta}</span></span></a>')


def tiles(t, unrouted=7):
    tagged = '31 / 41 tagged' if t['dance'] == 'salsa' else '14 / 17 tagged'
    cov = (f'{unrouted} in no routine', True) if unrouted else ('All in a routine', False)
    return (f'<div style="display: flex; gap: 8px; flex: none">{nav_tile(t, "positions", "Positions", tagged)}'
            f'{nav_tile(t, "routine", "Coverage", cov[0], cov[1])}</div>')


def filter_chips(t, selected=('All',), unlinked=5):
    """The Figures filters, one scrolling row: All, Not linked (with its count), the dance's styles,
    With partner, Solo. Each toggles, as today; All clears them."""
    items = ['All', 'Not linked'] + styles(t) + ['With partner', 'Solo']
    out = ''
    for it in items:
        cnt = unlinked if it == 'Not linked' else None
        out += kit.chip(t, it, it in selected, count=cnt)
    return (f'<div role="group" aria-label="Filter figures" style="display: flex; gap: 8px; flex-wrap: nowrap; margin-right: -16px; '
            f'overflow: hidden; white-space: nowrap; flex: none">{out}</div>')


def band_text(t, label):
    """A bare cream text button on the band (Select): 44px tall, band_small ink."""
    return (f'<button type="button" style="height: 44px; padding: 0 10px; border: 0; background: none; color: {t["band_small"]}; '
            f'font-size: 16px; font-weight: 800; cursor: pointer; flex: none">{label}</button>')


def pick_disc(t, n=None):
    """Selection-mode leading disc: empty ring, or accent disc carrying its tap order."""
    if n is None:
        return (f'<span aria-hidden="true" style="width: 26px; height: 26px; box-sizing: border-box; border-radius: 13px; '
                f'border: 2px solid {t["muted"]}; flex: none"></span>')
    return (f'<span aria-hidden="true" style="width: 26px; height: 26px; border-radius: 13px; background: {t["accent"]}; color: {t["on_accent"]}; '
            f'font-size: 13px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex: none">{n}</span>')


def group_label(t, text, count, status=False):
    c = t['status'] if status else t['muted']
    return f'<span style="padding: 14px 16px 0; {kit.ts("label", c)}">{text} · {count}</span>'


def selection_bar(t, n):
    """The bar pinned at the bottom while picking versions: n selected · Cancel · Create routine."""
    return (f'<div style="position: absolute; left: 0; right: 0; bottom: 0; box-sizing: border-box; background: {t["tab_bg"]}; '
            f'border-top: 1px solid {t["tab_line"]}; padding: 12px 16px 30px 20px; display: flex; align-items: center; gap: 4px">'
            f'<span role="status" style="flex: 1; font-size: 16px; font-weight: 700; color: {t["ink"]}">{n} selected</span>'
            f'{kit.button(t, "Cancel", "tertiary", size="sm", on=t["tab_bg"])}'
            f'{kit.button(t, "Create routine", "primary", size="sm", icon_name="plus", on=t["tab_bg"])}</div>')


def skel(t, w, h, r=8, extra=''):
    return f'<span aria-hidden="true" style="display: block; width: {w}; height: {h}px; border-radius: {r}px; background: {t["skeleton"]}; flex: none; {extra}"></span>'


def radio_chips(t, legend, options, sel):
    """A form radio group drawn as solid chips (the New figure sheet's Danced and Style)."""
    name = kit.uid('rc')
    out = ''.join(kit.chip(t, o, i == sel, role='radio') for i, o in enumerate(options))
    return (f'<div role="radiogroup" aria-labelledby="{name}" style="display: flex; flex-direction: column; gap: 4px; flex: none">'
            f'<span id="{name}" style="{kit.ts("label", t["ink2"])}; padding-left: 4px">{legend}</span>'
            f'<div style="display: flex; gap: 8px; flex-wrap: wrap">{out}</div></div>')


# --------------------------------------------------------------------------
# Moves · Figures
# --------------------------------------------------------------------------

def moves_header(t, seg=0):
    plus = kit.band_button(t, 'plus', 'New figure' if seg == 0 else 'New routine')
    return kit.band_header(t, 'Moves', right=plus, extra=kit.segmented(t, ['Figures', 'Routines'], seg, on_band=True, label='Moves'))


def figures(t, overlay=''):
    items = figs(t)
    body = (tiles(t) + kit.search_field(t, 'Search figures') + filter_chips(t)
            + kit.section_label(t, plural(len(items) + 33 if t['dance'] == 'salsa' else len(items) + 11, 'figure', 'figures'), 2)
            + kit.list_group(t, fig_rows(t, items)))
    return kit.page(t, moves_header(t), body, tab='Moves', overlay=overlay)


def figures_search(t):
    if t['dance'] == 'salsa':
        q, res = 'en', [('Enchufla', 4, 3, True, True), ('Kentucky', 2, 1, True, False), ('Setenta', 3, 2, True, True)]
    else:
        q, res = 'sha', [('Shadow position', 4, 3, True, True)]
    body = (kit.search_field(t, 'Search figures', q, 'focused') + filter_chips(t)
            + kit.section_label(t, plural(len(res), 'figure matches', 'figures match'), 2)
            + kit.list_group(t, fig_rows(t, res)))
    return kit.page(t, moves_header(t), body, tab='Moves')


def figures_unlinked(t):
    res = [f for f in figs(t) if not (f[3] and f[4])]
    body = (tiles(t) + kit.search_field(t, 'Search figures') + filter_chips(t, ('Not linked',))
            + kit.section_label(t, f'{len(res)} with no section or no lesson', 2)
            + kit.list_group(t, fig_rows(t, res)))
    return kit.page(t, moves_header(t), body, tab='Moves')


def figures_empty(t):
    body = kit.empty_state(t, 'moves', 'No figures yet', 'Add the first one you learned.',
                           kit.button(t, 'New figure', 'primary', icon_name='plus'))
    return kit.page(t, moves_header(t), '<div style="height: 40px; flex: none"></div>' + body, tab='Moves')


def figures_all_linked(t):
    body = (kit.search_field(t, 'Search figures') + filter_chips(t, ('Not linked',), unlinked=0)
            + kit.empty_state(t, 'check-circle', 'All linked', 'Every figure has a section and a lesson.'))
    return kit.page(t, moves_header(t), body, tab='Moves')


def figures_loading(t):
    tile = (f'<div style="flex: 1; height: 64px; border-radius: 16px; background: {t["surface"]}; display: flex; align-items: center; gap: 10px; padding: 0 12px">'
            f'{skel(t, "38px", 38, 19)}<div style="flex: 1; display: flex; flex-direction: column; gap: 7px">{skel(t, "70%", 11, 6)}{skel(t, "50%", 9, 5)}</div></div>')
    chipsk = ''.join(skel(t, f'{w}px', 36, 18) for w in (52, 112, 66, 54, 70))
    body = (f'<div aria-hidden="true" style="display: flex; gap: 8px; flex: none">{tile}{tile}</div>'
            + skel(t, '100%', 44, 22) + f'<div aria-hidden="true" style="display: flex; gap: 8px; padding: 4px 0; overflow: hidden; margin-right: -16px">{chipsk}</div>'
            + skel(t, '72px', 10, 5, 'margin: 6px 0 2px 16px') + kit.skeleton_rows(t, 5, 'Loading figures'))
    return kit.page(t, moves_header(t), body, tab='Moves')


# --------------------------------------------------------------------------
# New figure sheet
# --------------------------------------------------------------------------

def new_figure_sheet(t, error=False):
    if error:
        name = kit.text_field(t, 'Figure name', 'Hammerlock' if t['dance'] == 'bachata' else 'Enchufla', state='error',
                              error=f"There's already a figure called {'Hammerlock' if t['dance'] == 'bachata' else 'Enchufla'}.")
        var = kit.text_field(t, 'Variation name', 'From closed', state='filled')
        notes = kit.textarea(t, 'Notes', 'Lead the turn early, on 1.', state='filled', rows=2)
        sel_style = 1
    else:
        name = kit.text_field(t, 'Figure name', 'Enchu', 'e.g. Dile que no, Enchufla', state='focused')
        var = kit.text_field(t, 'Variation name', '', 'e.g. Basic, Doble, From cross')
        notes = kit.textarea(t, 'Notes', '', 'Count, hand holds, what the teacher said…', rows=2)
        sel_style = 0
    inner = (f'<div style="display: flex; flex-direction: column; gap: 14px">{name}{var}'
             f'{radio_chips(t, "Danced", ["With partner", "Solo"], 0)}{radio_chips(t, "Style", styles(t), sel_style)}{notes}</div>')
    foot = (kit.button(t, 'Add figure', 'primary', full=True, on=t['sheet_bg'])
            + f'<span style="text-align: center; font-size: 13px; color: {t["muted"]}">You can add recordings next.</span>')
    return kit.bottom_sheet(t, 'New figure', inner, foot)


def new_figure(t):
    return figures(t, overlay=new_figure_sheet(t))


def new_figure_error(t):
    return figures(t, overlay=new_figure_sheet(t, error=True))


def new_figure_unsaved(t):
    acts = [kit.button(t, 'Save', 'primary', full=True, on=t['raised']), kit.button(t, 'Stay', 'secondary', full=True, on=t['raised']),
            kit.button(t, 'Close without saving', 'danger_text', full=True, on=t['raised'])]
    dlg = kit.dialog(t, 'Unsaved changes', 'New figure is not saved yet.', acts, icon_name='warning', tone='warn')
    return figures(t, overlay=new_figure_sheet(t) + dlg)


# --------------------------------------------------------------------------
# Moves · Routines
# --------------------------------------------------------------------------

def routine_meta(t, slots, breaks=0, noloop=False):
    b = ''
    if breaks:
        b += kit.badge(t, plural(breaks, 'break', 'breaks'), 'danger')
    if noloop:
        b += kit.badge(t, 'does not loop', 'warn')
    return (f'<span style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding-top: 2px">'
            f'<span>{plural(slots, "slot", "slots")}</span>{b}</span>')


def routines(t, overlay=''):
    if t['dance'] == 'salsa':
        rs = [('Basic loop', 4, 0, False), ('Friday combo', 8, 2, False), ('Setenta combo', 6, 0, True),
              ('Kentucky line', 5, 1, True), ('Rueda warm-up', 3, 0, False), ('Social night', 12, 0, False)]
    else:
        rs = [('Sensual basic', 4, 0, False), ('Wave combo', 6, 1, False), ('Shadow line', 5, 0, True)]
    rows = [dict(title=n, meta=routine_meta(t, s, b, nl), trailing=kit.chevron(t), href='#', min_h=68) for n, s, b, nl in rs]
    body = kit.section_label(t, plural(len(rs), 'routine', 'routines'), 4) + kit.list_group(t, rows)
    return kit.page(t, moves_header(t, 1), body, tab='Moves', overlay=overlay)


def routines_empty(t):
    body = kit.empty_state(t, 'routine', 'No routines yet', 'String some figures together into one you can call as a single set.',
                           kit.button(t, 'New routine', 'primary', icon_name='plus'))
    return kit.page(t, moves_header(t, 1), '<div style="height: 40px; flex: none"></div>' + body, tab='Moves')


def new_routine(t):
    inner = (f'<div style="display: flex; flex-direction: column; gap: 14px">'
             f'{kit.text_field(t, "Name", "Friday comb", "Basic combo", state="focused")}'
             f'{kit.textarea(t, "Notes", "", "What this is for, when to reach for it…", rows=4)}</div>')
    sheet = kit.bottom_sheet(t, 'New routine', inner, kit.button(t, 'Create routine', 'primary', full=True, on=t['sheet_bg']))
    return routines(t, overlay=sheet)


# --------------------------------------------------------------------------
# Positions (the gap report)
# --------------------------------------------------------------------------

# (name, in, out, neutral)
SALSA_POS = [('Abierta (dos manos)', 14, 16, True), ('Abierta (una mano)', 5, 4, False), ('Cerrada', 6, 5, False),
             ('Manos cruzadas', 4, 3, False), ('Caída', 2, 0, False), ('Setenta, derecha', 3, 3, False),
             ('Setenta, izquierda', 1, 1, False), ('Sombrero', 2, 2, False), ('Sombra', 0, 0, False),
             ('Espalda con espalda', 0, 1, False)]
BACHATA_POS = [('Closed', 9, 10, True), ('Open, two hands', 4, 3, False), ('Open, one hand', 2, 2, False),
               ('Cross-hand', 1, 1, False), ('Hammerlock', 2, 0, False), ('Shadow', 1, 2, False), ('Side by side', 0, 0, False)]


def pos_row(t, name, i, o, neutral):
    meta, tone, trail = f'{i} in · {o} out', None, ''
    title_tone, state = None, 'default'
    if i > 0 and o == 0:
        meta, tone = f'{i} in · 0 out · dead end', 'danger'
    elif o > 0 and i == 0:
        meta, tone = f'0 in · {o} out · orphan', 'danger'
    elif i == 0 and o == 0:
        meta, title_tone = '0 in · 0 out · unused', 'muted'
    if neutral:
        trail = kit.badge(t, 'neutral', 'accent')
    trailing = f'<span style="display: flex; align-items: center; gap: 6px">{trail}{kit.chevron(t)}</span>'
    return dict(title=name, meta=meta, meta_tone=tone, title_tone=title_tone, trailing=trailing, href='#', state=state)


def positions(t, overlay=''):
    ps = SALSA_POS if t['dance'] == 'salsa' else BACHATA_POS
    header = kit.band_header(t, 'Positions', 'Hands before and after a figure', left=kit.band_button(t, 'back', 'Back to Moves'),
                             right=kit.band_button(t, 'plus', 'New position'))
    tagged = '31 of 41 figures tagged' if t['dance'] == 'salsa' else '14 of 17 figures tagged'
    intro = (f'<p style="margin: 0; padding: 0 4px; font-size: 14px; line-height: 1.45; color: {t["ink2"]}">'
             f'<b style="color: {t["ink"]}">{tagged}.</b> A figure with none tagged starts and ends at the neutral hold.</p>')
    gaps = sum(1 for _, i, o, _n in ps if (i > 0) != (o > 0))
    ban = kit.banner(t, 'warning', f'{gaps} gaps in the graph' if gaps != 1 else '1 gap in the graph',
                     'Dead end: nothing you know leaves it. Orphan: nothing you know gets you there.')
    body = (intro + ban + kit.section_label(t, plural(len(ps), 'position', 'positions'), 6)
            + kit.list_group(t, [pos_row(t, *p) for p in ps]))
    return kit.page(t, header, body, overlay=overlay)


def position_rename(t):
    name = 'Caída' if t['dance'] == 'salsa' else 'Hammerlock'
    inner = (kit.text_field(t, 'Name', name, state='focused')
             + f'<div style="display: flex; gap: 8px; flex-wrap: wrap">{kit.badge(t, "2 in", "neutral")}{kit.badge(t, "0 out", "neutral")}'
             f'{kit.badge(t, "dead end", "danger", icon_name="warning")}</div>')
    foot = (kit.button(t, 'Save', 'primary', full=True, on=t['sheet_bg'])
            + kit.button(t, 'Remove position', 'danger_text', icon_name='trash', full=True, on=t['sheet_bg']))
    return positions(t, overlay=kit.bottom_sheet(t, name, inner, foot, sub='Position'))


def position_new_error(t):
    inner = kit.text_field(t, 'Name', 'Shadow', state='error', error='That position already exists.')
    foot = kit.button(t, 'Add position', 'primary', full=True, on=t['sheet_bg'])
    return positions(t, overlay=kit.bottom_sheet(t, 'New position', inner, foot))


# --------------------------------------------------------------------------
# Coverage
# --------------------------------------------------------------------------

def cov_data(t):
    if t['dance'] == 'salsa':
        none = ['Exhíbela', 'Kentucky · Doble', 'Prima con la hermana', 'Setenta · Con giro', 'Sombrero · Doble',
                'Vacílala · Mano por detrás', 'Enchufla · Con mambo']
        one = [('Dile que no · Cross', 'Friday combo'), ('Enchufla · Doble', 'Setenta combo'), ('Kentucky', 'Kentucky line'),
               ('Setenta', 'Setenta combo'), ('Vacílala', 'Social night')]
        many = [('Dile que no', 'Basic loop, Friday combo, Rueda warm-up, Social night'), ('Enchufla', 'Basic loop, Friday combo, Social night'),
                ('Sombrero', 'Friday combo, Social night')]
    else:
        none = ['Cuddle turn', 'Hip roll · Slow', 'Media luna · Reverse']
        one = [('Hammerlock', 'Wave combo'), ('Hip roll', 'Sensual basic')]
        many = [('Body wave', 'Sensual basic, Wave combo, Shadow line'), ('Shadow position', 'Shadow line, Wave combo')]
    return none, one, many


def coverage(t, picked=None, overlay='', bar=None):
    picked = picked or {}
    none, one, many = cov_data(t)
    sel = bool(picked) or bar is not None

    def r(title, meta=None):
        n = picked.get(title)
        lead = pick_disc(t, n) if sel else None
        return dict(title=title, meta=meta, trailing=None if sel else kit.chevron(t), href='#', leading=lead,
                    state='selected' if n else 'default', min_h=52 if not meta else 64)
    right = None if sel else band_text(t, 'Select')
    header = kit.band_header(t, 'Coverage', 'Versions by how many routines use them', left=kit.band_button(t, 'back', 'Back to Moves'), right=right)
    hint = (f'<span style="padding: 0 16px; font-size: 13px; color: {t["muted"]}">Tap in the order the routine should call them.</span>'
            if sel else '')
    body = (hint + group_label(t, 'In no routine', len(none), True).replace('padding: 14px', 'padding: 2px')
            + kit.list_group(t, [r(n) for n in none])
            + group_label(t, 'In 1 routine', len(one)) + kit.list_group(t, [r(n, m) for n, m in one])
            + group_label(t, 'In 2+ routines', len(many)) + kit.list_group(t, [r(n, m) for n, m in many]))
    footer = selection_bar(t, bar) if bar is not None else ''
    return kit.page(t, header, body, footer=footer, overlay=overlay)


PICKS_SALSA = {'Kentucky · Doble': 2, 'Exhíbela': 1, 'Setenta · Con giro': 3}
PICKS_BACHATA = {'Cuddle turn': 1, 'Media luna · Reverse': 2}


def picks(t):
    return PICKS_SALSA if t['dance'] == 'salsa' else PICKS_BACHATA


def coverage_select(t):
    p = picks(t)
    return coverage(t, p, bar=len(p))


def coverage_create(t):
    p = picks(t)
    order = sorted(p, key=p.get)
    rows = [dict(title=n, leading=pick_disc(t, i + 1), min_h=48) for i, n in enumerate(order)]
    inner = (kit.text_field(t, 'Name', 'Friday comb', 'Basic combo', state='focused')
             + kit.list_group(t, rows, label='Picked versions')
             + f'<span style="padding: 0 4px; font-size: 13px; line-height: 1.4; color: {t["muted"]}">{plural(len(p), "figure", "figures")}, in the order you picked them. '
               f'Put them in order on the routine page.</span>')
    sheet = kit.bottom_sheet(t, 'New routine', inner, kit.button(t, 'Create routine', 'primary', full=True, on=t['sheet_bg']))
    return coverage(t, p, overlay=sheet, bar=len(p))


# --------------------------------------------------------------------------

SCREENS = [
    ('Moves · Figures', 'Positions and Coverage tiles on top (their counts kept); Not linked is a chip with its count.', figures, 'salsa'),
    ('Figures · searching', 'Tiles step aside while a search runs; the filters stay; results counted.', figures_search, 'salsa'),
    ('Figures · Not linked', 'The old “5 not linked →” link is now this chip; status words in the meta.', figures_unlinked, 'salsa'),

    ('New figure', 'Band + opens the sheet (also ?new=1 from an empty Today). Figure name focused.', new_figure, 'salsa'),
    ('New figure · name taken', 'Bachata. The refusal lands under the field it is about.', new_figure_error, 'bachata'),
    ('New figure · unsaved', 'Closing a filled sheet asks first: Save, Stay, Close without saving.', new_figure_unsaved, 'salsa'),

    ('Figures · empty', 'Nothing yet: no tiles, one way forward.', figures_empty, 'salsa'),
    ('Figures · all linked', 'Not linked with nothing left. (Other filters: “No figures match.”)', figures_all_linked, 'salsa'),
    ('Figures · loading', 'Skeleton of the same layout while the list arrives.', figures_loading, 'salsa'),

    ('Moves · Routines', 'Slots, plus breaks and does-not-loop as badges. Band + = New routine.', routines, 'salsa'),
    ('Routines · empty', 'No routines yet.', routines_empty, 'salsa'),
    ('New routine', 'Name focused, notes, Create routine → the routine page.', new_routine, 'salsa'),

    ('Positions · gap report', 'Pushed from the Positions tile. Dead ends and orphans in the row, neutral badged.', positions, 'salsa'),
    ('Position · rename / remove', 'A row opens its sheet: rename, or Remove (never on the neutral hold).', position_rename, 'salsa'),
    ('New position · exists', 'Bachata. Band + opens it; the duplicate refused under the field.', position_new_error, 'bachata'),

    ('Coverage', 'Pushed from the Coverage tile. Versions, fewest routines first; Select for the mouse.', coverage, 'salsa'),
    ('Coverage · selecting', 'Long-press or Select. Discs carry the tap order; bar: Cancel · Create routine.', coverage_select, 'salsa'),
    ('Coverage · make routine', 'Name it; the picked versions shown in their order.', coverage_create, 'salsa'),
]


if __name__ == '__main__':
    html, w, h = kit.artboard('Moves · every screen', 'Figures | Routines, Positions (the gap report) and Coverage, with their sheets, '
                              'empty, loading and error states. Light and dark side by side.', SCREENS, doc_title='S · Moves')
    kit.write(OUT, html)
    print(w, h)
