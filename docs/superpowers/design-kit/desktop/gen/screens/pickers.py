"""S-pickers: the shared picker, PickerField, the Link popup's levels and Link a section, in the C4 look.

    timeout 180 nix shell nixpkgs#python3 -c python3 -I pickers.py
"""
import sys

import os
S = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
sys.path.insert(0, S + '/gen/kit')
import kit  # noqa: E402

OUT = S + '/canvas/project/S-pickers.dc.html'
SHEET_H = 772          # a picker sheet: the page's band peeks out above it
RANGE = '0:42–0:55'


# ---------------------------------------------------------------------------
# new building blocks (from kit tokens): the picker's lines, its create row
# ---------------------------------------------------------------------------

def group_label(t, text, first=False):
    """The group heading of a picker ("In this lesson", "Figures")."""
    return kit.section_label(t, text, 0 if first else 10)


def heading_line(t, text):
    """A figure (or a video) over its rows: not a choice, only its rows can be picked."""
    return (f'<p style="margin: 0; padding: 14px 16px 2px; font-size: 13px; line-height: 1.3; font-weight: 800; '
            f'color: {t["ink2"]}; letter-spacing: 0.01em">{text}</p>')


def linked_mark(t):
    return (f'<span style="display: flex; align-items: center; gap: 4px; padding: 0 12px 0 4px; font-size: 13px; font-weight: 700; '
            f'color: {t["muted"]}; white-space: nowrap; flex: none">{kit.icon("check", 16, t["muted"], stroke=2.5)}Linked</span>')


def prow(t, label, meta=None, state='default', kind='link', indent=False, last=False, preview=False, meta_tone=None):
    """One picker row: the whole row is a button (pick), + is its own 44px button (link and keep going),
    ▶ previews a section. state: default | linked (greyed, can't be tapped) | pending (+ in flight)
    | chosen (field picker's current value) | pressed."""
    hair = '' if last else f'border-bottom: 1px solid {t["hairline"]};'
    linked = state == 'linked'
    bg = {'chosen': t['accent_soft'], 'pressed': t['pressed']}.get(state, 'transparent')
    tc = t['muted'] if linked else t['ink']
    mc, mw = (t['muted'], 400)
    if meta_tone == 'status' and not linked:
        mc, mw = t['status'], 700
    m = f'<span style="font-size: 13px; line-height: 1.35; font-weight: {mw}; color: {mc}">{meta}</span>' if meta else ''
    dis = ' disabled' if linked else ''
    cur = ' aria-current="true"' if state == 'chosen' else ''
    pr = 14
    if kind == 'link' and not linked:
        if state == 'pending':
            trail = (f'<span role="status" aria-label="Linking {label}" style="width: 44px; height: 44px; flex: none; display: flex; '
                     f'align-items: center; justify-content: center; margin-right: 6px">{kit.spinner(t, 22)}</span>')
        else:
            trail = f'<span style="margin-right: 6px; display: flex">{kit.icon_button(t, "plus", f"Link {label} and keep picking", "bare", color=t["accent"])}</span>'
        pr = 0
    elif linked:
        trail, pr = linked_mark(t), 0
    elif state == 'chosen':
        trail = f'<span style="padding-right: 14px; display: flex">{kit.icon("check", 22, t["accent_text"], stroke=2.5)}</span>'
        pr = 0
    else:
        trail = ''
    pv = ''
    if preview:
        pv = (f'<span style="margin-right: 10px; display: flex">'
              f'{kit.icon_button(t, "play", f"Play {label}", "tonal", size=44, icon_size=18, filled=True, on=t["surface"])}</span>')
    pl = 32 if indent else 16
    btn = (f'<button type="button"{dis}{cur} style="flex: 1; min-width: 0; min-height: 56px; border: 0; background: none; padding: 9px {pr}px 9px 0; '
           f'display: flex; flex-direction: column; justify-content: center; gap: 2px; text-align: left; cursor: {"default" if linked else "pointer"}; color: {tc}">'
           f'<span style="font-size: 16px; line-height: 1.3; font-weight: 700; color: {tc}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%">{label}</span>{m}</button>')
    return (f'<div style="display: flex; align-items: center; padding-left: {pl}px; background: {bg}">{pv}'
            f'<div style="flex: 1; min-width: 0; display: flex; align-items: center; {hair}">{btn}{trail}</div></div>')


def pgroup(t, title, lines, first=False):
    """A picker group: its label, then one card of headings and rows."""
    return group_label(t, title, first) + kit.list_group(t, lines, label=title)


def plist(t, inner):
    """The scrolling part of a picker: only this scrolls; a fade says there is more."""
    fade = (f'<div aria-hidden="true" style="position: absolute; left: 0; right: 0; bottom: 0; height: 40px; '
            f'background: linear-gradient({kit.rgba(t["sheet_bg"], 0)}, {t["sheet_bg"]})"></div>')
    return (f'<div style="position: relative; flex: 1; min-height: 0; overflow: hidden; margin: 0 -16px">'
            f'<div style="padding: 2px 16px 24px; display: flex; flex-direction: column; gap: 8px">{inner}</div>{fade}</div>')


def create_button(t, label):
    """A create choice in the picker's create row: a tonal pill with a +, sized to share a row with two others."""
    return (f'<button type="button" style="flex: 1; min-width: 0; height: 44px; border: 0; border-radius: 22px; background: {t["accent_soft"]}; '
            f'color: {t["accent_text"]}; font-size: 15px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 4px; '
            f'padding: 0 8px; cursor: pointer; white-space: nowrap">{kit.icon("plus", 18, t["accent_text"], stroke=2.5)}{label}</button>')


def create_row(t, labels, typed=''):
    """Rule 6: pinned under the list, always visible; the search text goes into the create step's name."""
    lead = f'Not in the list? Create “{typed}” as' if typed else 'Not in the list?'
    btns = ''.join(create_button(t, x) for x in labels)
    return (f'<div style="margin: 0 -16px; padding: 12px 16px 0; border-top: 1px solid {t["hairline"]}; display: flex; flex-direction: column; gap: 8px">'
            f'<span style="{kit.ts("label", t["muted"])}; padding-left: 4px">{lead}</span>'
            f'<div style="display: flex; gap: 8px">{btns}</div></div>')


def done_button(t, n):
    return kit.button(t, f'Done · {n} linked', 'primary', full=True, on=t['sheet_bg'])


def empty_box(t, text, icon_name='search'):
    """Rule 7: one empty state, a quiet box under the search."""
    return (f'<div role="status" style="background: {t["surface"]}; border-radius: 16px; padding: 16px; display: flex; gap: 12px; align-items: flex-start; flex: none">'
            f'{kit.icon(icon_name, 22, t["muted"], style="margin-top: 1px")}'
            f'<span style="font-size: 15px; line-height: 1.45; font-weight: 500; color: {t["ink2"]}">{text}</span></div>')


def picker(t, title, body, placeholder, typed='', search_state=None, footer=None, back=False, sub=None,
           message=None, height=SHEET_H):
    """The shared picker sheet: search on top, the list, then the create row / Done pinned at the bottom."""
    st = search_state or ('filled' if typed else 'empty')
    inner = kit.search_field(t, placeholder, typed, st)
    if message:
        inner += message
    inner += plist(t, body)
    return kit.bottom_sheet(t, title, inner, footer=footer, height=height, back=back, sub=sub, close=not back)


def field_label(t, text):
    return f'<span style="{kit.ts("label", t["ink2"])}; padding-left: 4px">{text}</span>'


def stack(*parts, gap=6):
    return f'<div style="display: flex; flex-direction: column; gap: {gap}px; flex: none">{"".join(parts)}</div>'


# ---------------------------------------------------------------------------
# pages behind the sheets
# ---------------------------------------------------------------------------

def section_row(t, name, meta, linked_to=None, last=False):
    """A lesson video's section, as the lesson page lists it: ▶, name, time · link line, the link button."""
    ln = ''
    if linked_to:
        ln = (f' · <span style="color: {t["ink2"]}; font-weight: 600; display: inline-flex; align-items: center; gap: 3px">'
              f'{kit.icon("link", 13, t["ink2"])}{linked_to}</span>')
    play = kit.icon_button(t, 'play', f'Play {name}', 'tonal', size=40, icon_size=18, filled=True, on=t['surface'])
    lk = kit.icon_button(t, 'link', f'Link {name}', 'bare', color=t['accent'] if not linked_to else t['ink2'])
    return kit.row(t, name, meta + ln, lk, leading=play, last=last)


def lesson_page(t, sections_linked=True):
    header = kit.band_header(t, 'Tuesday class', '27 Oct 2026 · Enchufla', left=kit.band_button(t, 'back', 'Back to Lessons'), tall=False)
    figs = kit.section_label(t, 'Figures') + kit.list_group(t, [
        dict(title='Enchufla · Basic', meta='Partner · every 3 days', trailing=kit.chevron(t), href='#'),
        dict(title='Dile que no · Basic', meta='Partner · weekly', trailing=kit.chevron(t), href='#'),
    ])
    opener = kit.button(t, 'Link an existing figure…', 'secondary', icon_name='search', full=True)
    vids = kit.section_label(t, 'Sections · Enchufla, slow', 10) + kit.list_group(t, [
        section_row(t, 'Doble entry', RANGE, 'Enchufla · Doble' if sections_linked else None),
        section_row(t, 'Turn pattern', '1:22–1:40', None),
        section_row(t, '2:05–2:31', 'no name', None, last=True),
    ])
    return header, figs + opener + vids


def lesson_with(t, overlay):
    h, b = lesson_page(t)
    return kit.page(t, h, b, overlay=overlay)


def figure_page(t, overlay, name='Enchufla', var='Doble'):
    header = kit.band_header(t, name, var, left=kit.band_button(t, 'back', 'Back to Moves'),
                             right=kit.band_button(t, 'more', 'More'))
    body = (kit.section_label(t, 'Sections') + kit.list_group(t, [
        dict(title='Doble entry', meta=f'Tuesday class · {RANGE}', trailing=kit.chevron(t), href='#')])
        + kit.button(t, 'Link a section…', 'secondary', icon_name='search', full=True))
    return kit.page(t, header, body, overlay=overlay)


def today_page(t, overlay):
    header = kit.band_header(t, 'Today', 'Tuesday, 27 October', right=kit.band_button(t, 'settings', 'Settings'))
    body = (kit.section_label(t, 'Done that day') + kit.list_group(t, [
        dict(title='Body wave · Basic', meta='2 sets', title_tone='muted', trailing=f'<span style="margin-right: 10px; display: flex">{kit.done_check(t)}</span>')])
        + kit.button(t, 'Pick an exercise…', 'secondary', icon_name='search', full=True))
    return kit.page(t, header, body, tab='Today', overlay=overlay)


# ---------------------------------------------------------------------------
# data
# ---------------------------------------------------------------------------

def salsa_figures(t, states=None, query=None):
    """The lesson's "Link a figure" list (Figures group). states: {label: state}."""
    st = states or {}
    def r(label, short=None, indent=False, last=False, meta=None):
        return prow(t, short or label, meta, st.get(label, 'default'), indent=indent, last=last)
    lines = [
        r('Dile que no · Basic'),
        heading_line(t, 'Enchufla'),
        r('Enchufla · Basic', 'Basic', True), r('Enchufla · Doble', 'Doble', True), r('Enchufla · Complicada', 'Complicada', True),
        r('Exhíbela · Basic'),
        r('Kentucky · Basic'),
        heading_line(t, 'Setenta'),
        r('Setenta · Basic', 'Basic', True), r('Setenta · Complicado', 'Complicado', True),
        heading_line(t, 'Sombrero'),
        r('Sombrero · Basic', 'Basic', True), r('Sombrero · Doble', 'Doble', True, last=True),
    ]
    return pgroup(t, 'Figures', lines, first=True)


# ---------------------------------------------------------------------------
# screens
# ---------------------------------------------------------------------------

# 1 — the linking picker, as opened ------------------------------------------------

def link_open(t):
    body = salsa_figures(t, {'Dile que no · Basic': 'linked', 'Enchufla · Basic': 'linked'})
    sh = picker(t, 'Link a figure', body, 'Search figures', footer=create_row(t, ['Figure', 'Variation']))
    return lesson_with(t, sh)


def link_keep_going(t):
    body = salsa_figures(t, {'Dile que no · Basic': 'linked', 'Enchufla · Basic': 'linked', 'Enchufla · Doble': 'linked',
                             'Exhíbela · Basic': 'linked', 'Kentucky · Basic': 'pending'})
    foot = create_row(t, ['Figure', 'Variation']) + done_button(t, 2)
    return lesson_with(t, picker(t, 'Link a figure', body, 'Search figures', footer=foot))


def link_search(t):
    lines = [heading_line(t, 'Enchufla'), prow(t, 'Doble', indent=True),
             heading_line(t, 'Sombrero'), prow(t, 'Doble', indent=True, last=True)]
    body = pgroup(t, 'Figures', lines, first=True)
    return lesson_with(t, picker(t, 'Link a figure', body, 'Search figures', 'dob', 'focused',
                                 footer=create_row(t, ['Figure', 'Variation'], 'dob')))


def link_nomatch(t):
    body = empty_box(t, 'Nothing matches “Montaña”.')
    return lesson_with(t, picker(t, 'Link a figure', body, 'Search figures', 'Montaña', 'focused',
                                 footer=create_row(t, ['Figure', 'Variation'], 'Montaña')))


def bachata_lesson(t, overlay):
    header = kit.band_header(t, 'Saturday workshop', '24 Oct 2026', left=kit.band_button(t, 'back', 'Back to Lessons'), tall=False)
    body = (kit.section_label(t, 'Exercises') + kit.list_group(t, [
        dict(title='Hip roll isolation', meta='Drill · daily', trailing=kit.chevron(t), href='#')])
        + kit.button(t, 'Link an existing exercise…', 'secondary', icon_name='search', full=True))
    return kit.page(t, header, body, overlay=overlay)


def exercise_refused(t):
    msg = kit.banner(t, 'error', 'That could not be linked.', 'Body wave · Fast was not linked. Try it again.')
    figs = [heading_line(t, 'Body wave'),
            prow(t, 'Basic', 'Every 3 days', 'linked', indent=True), prow(t, 'Fast', 'Weekly', indent=True),
            prow(t, 'Cuddle turn · Basic', 'Every 2 days'), prow(t, 'Hammerlock · Basic', 'Weekly', last=True)]
    rts = [prow(t, 'Sensual opener', 'Every 3 days', last=True)]
    drs = [prow(t, 'Footwork · side basic', 'Weekly'), prow(t, 'Hip roll isolation', 'Daily', 'linked', last=True)]
    body = pgroup(t, 'Figures', figs, True) + pgroup(t, 'Routines', rts) + pgroup(t, 'Drills', drs)
    return bachata_lesson(t, picker(t, 'Link an exercise', body, 'Search exercises', message=msg,
                                    footer=create_row(t, ['Exercise'])))


def act_picker(t):
    figs = [heading_line(t, 'Body wave'),
            prow(t, 'Basic', 'Every 3 days', kind='act', indent=True), prow(t, 'Fast', 'Weekly', kind='act', indent=True),
            prow(t, 'Cuddle turn · Basic', 'Every 2 days', kind='act'),
            prow(t, 'Shadow position · Entry', 'Weekly', kind='act', last=True)]
    rts = [prow(t, 'Sensual opener', 'Every 3 days', kind='act', last=True)]
    drs = [prow(t, 'Hip roll isolation', 'Daily', kind='act'), prow(t, 'Footwork · side basic', 'Weekly', kind='act', last=True)]
    lss = [prow(t, 'Saturday workshop', 'Every 2 weeks', kind='act', last=True)]
    body = pgroup(t, 'Figures', figs, True) + pgroup(t, 'Routines', rts) + pgroup(t, 'Drills', drs) + pgroup(t, 'Lessons', lss)
    return today_page(t, picker(t, 'Log a set on Tue 27 Oct', body, 'Search exercises'))


# 2 — the field picker (Move to…) ----------------------------------------------------

def move_sheet(t, chosen=False, field_state='focused', height=None):
    new = kit.radio(t, 'A new figure of its own', not chosen, name='mv', meta='Doble becomes its first variation')
    opt = f'<div style="background: {t["surface"]}; border-radius: 16px; padding: 6px 16px; flex: none">{new}</div>'
    parts = [opt]
    if not chosen:
        parts.append(kit.text_field(t, 'New figure’s name', 'Enchufla doble', state='filled'))
    parts.append(kit.section_label(t, 'Or join a figure', 8))
    if chosen:
        parts.append(kit.select_field(t, 'Figure', 'Sombrero', 'Choose a figure…', 'filled'))
        parts.append(kit.text_field(t, 'Name in Sombrero', 'Doble', state='error',
                                    error='Sombrero already has a Doble. Pick another name.'))
        foot = kit.button(t, 'Move to Sombrero', 'primary', 'disabled', full=True)
    else:
        parts.append(kit.select_field(t, 'Figure', '', 'Choose a figure…', field_state))
        foot = kit.button(t, 'Make it its own figure', 'primary', full=True, on=t['sheet_bg'])
    return kit.bottom_sheet(t, 'Move “Doble” to…', ''.join(parts), footer=foot, height=height)


def field_closed(t):
    return figure_page(t, move_sheet(t, False, 'focused'))


def field_open(t):
    rows = [prow(t, 'Dile que no', 'Basic', kind='field'),
            prow(t, 'Exhíbela', 'Basic', kind='field'),
            prow(t, 'Kentucky', 'Basic', kind='field'),
            prow(t, 'Setenta', 'Basic, Complicado', kind='field'),
            prow(t, 'Sombrero', 'Basic, Doble', 'chosen', kind='field'),
            prow(t, 'Vacilala', 'Basic', kind='field', last=True)]
    body = pgroup(t, 'Figures', rows, True)
    sh = picker(t, 'Join a figure', body, 'Search figures', height=700)
    return figure_page(t, move_sheet(t, False, 'focused', height=760) + sh)


def field_filled(t):
    return figure_page(t, move_sheet(t, True))


# 3 — the Link popup -------------------------------------------------------------------

def near_list(t, states=None):
    st = states or {}
    def r(label, short=None, indent=False, last=False, meta=None):
        return prow(t, short or label, meta, st.get(label, 'default'), indent=indent, last=last)
    near = [heading_line(t, 'Enchufla'),
            r('Enchufla · Basic', 'Basic', True), r('Enchufla · Doble', 'Doble', True), r('Enchufla · Complicada', 'Complicada', True),
            r('Dile que no · Basic'),
            r('Count drill · 3-2 clave', meta='Daily', last=True)]
    figs = [r('Exhíbela · Basic'), r('Kentucky · Basic'),
            heading_line(t, 'Setenta'), r('Setenta · Basic', 'Basic', True), r('Setenta · Complicado', 'Complicado', True, last=True)]
    drs = [r('Shines · Suzie Q', meta='Every 2 days', last=True)]
    return pgroup(t, 'In this lesson', near, True) + pgroup(t, 'Figures', figs) + pgroup(t, 'Drills', drs)


def popup_direct(t):
    body = near_list(t)
    sh = picker(t, f'Link {RANGE} to…', body, 'Search figures and drills', sub='Doble entry · 13 s',
                footer=create_row(t, ['Variation', 'Figure', 'Drill']))
    return lesson_with(t, sh)


def linked_item(t, label, drill=False, archived=False, last=False):
    hair = '' if last else f'border-bottom: 1px solid {t["hairline"]};'
    tc = t['muted'] if archived else t['ink']
    tag = ' ' + kit.badge(t, 'Drill', 'neutral') if drill else ''
    arch = ' ' + kit.badge(t, 'Archived', 'warn') if archived else ''
    x = kit.icon_button(t, 'close', f'Unlink {label}', 'bare', color=t['muted'], on=t['surface'])
    return (f'<div style="padding-left: 16px"><div style="display: flex; align-items: center; gap: 8px; min-height: 56px; padding-right: 6px; {hair}">'
            f'<span style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 16px; font-weight: 700; color: {tc}">'
            f'{label}{tag}{arch}</span>{x}</div></div>')


def popup_links_sheet(t, height=None):
    inner = (kit.section_label(t, 'Linked')
             + kit.list_group(t, [linked_item(t, 'Enchufla · Doble'), linked_item(t, 'Count drill · 3-2 clave', drill=True),
                                  linked_item(t, 'Enchufla · Vieja', archived=True, last=True)], label='Linked')
             + f'<div style="height: 4px"></div>'
             + kit.button(t, 'Link a figure or drill…', 'secondary', icon_name='search', full=True, on=t['sheet_bg']))
    return kit.bottom_sheet(t, f'Link {RANGE}', inner, sub='Doble entry · 13 s', height=height)


def popup_links(t):
    return lesson_with(t, popup_links_sheet(t))


def popup_pick_over(t):
    body = near_list(t, {'Enchufla · Doble': 'linked', 'Count drill · 3-2 clave': 'linked', 'Kentucky · Basic': 'linked'})
    foot = create_row(t, ['Variation', 'Figure', 'Drill']) + done_button(t, 1)
    sh = picker(t, f'Link {RANGE} to…', body, 'Search figures and drills', footer=foot, back=True, height=740)
    return lesson_with(t, popup_links_sheet(t, height=520) + sh)


# 4 — create steps ---------------------------------------------------------------------

def create_sheet(t, title, fields, foot, sub=f'Linked to {RANGE} and to Tuesday class', height=None):
    return kit.bottom_sheet(t, title, fields, footer=foot, back=True, close=False, sub=sub, height=height, gap=14)


def create_variation(t):
    fields = (kit.select_field(t, 'Figure', 'Enchufla', 'Choose a figure…', 'filled')
              + kit.text_field(t, 'Variation name', 'Dob', state='focused'))
    foot = kit.button(t, 'Create and link', 'primary', full=True, on=t['sheet_bg'])
    back = popup_direct_sheet_only(t)
    return lesson_with(t, back + create_sheet(t, 'New variation', fields, foot))


def popup_direct_sheet_only(t):
    body = pgroup(t, 'In this lesson', [heading_line(t, 'Enchufla'), prow(t, 'Doble', indent=True, last=True)], True)
    return picker(t, f'Link {RANGE} to…', body, 'Search figures and drills', 'dob',
                  footer=create_row(t, ['Variation', 'Figure', 'Drill'], 'dob'))


def create_figure_error(t):
    fields = (kit.text_field(t, 'Figure name', 'Enchufla', state='error', error='There’s already a figure called Enchufla.')
              + kit.text_field(t, 'Variation name', 'Basic', state='filled')
              + stack(field_label(t, 'Danced'), kit.segmented(t, ['With partner', 'Solo'], 0, on_band=False, label='Danced'))
              + stack(field_label(t, 'Style'), kit.segmented(t, ['Salsa', 'Son', 'Other'], 0, on_band=False, label='Style')))
    foot = kit.button(t, 'Create and link', 'primary', full=True, on=t['sheet_bg'])
    return lesson_with(t, create_sheet(t, 'New figure', fields, foot))


def bachata_video_lesson(t, overlay):
    header = kit.band_header(t, 'Saturday workshop', '24 Oct 2026', left=kit.band_button(t, 'back', 'Back to Lessons'), tall=False)
    body = kit.section_label(t, 'Sections · Sensual combo') + kit.list_group(t, [
        section_row(t, 'Hip roll in', '0:12–0:27', None),
        section_row(t, 'Cuddle exit', '0:40–0:58', 'Cuddle turn · Basic', last=True)])
    return kit.page(t, header, body, overlay=overlay)


def create_drill_saving(t):
    fields = (kit.text_field(t, 'Name', 'Hip roll in', state='filled')
              + kit.select_field(t, 'How often', 'Every 2 days', state='filled'))
    foot = kit.button(t, 'Create and link', 'primary', 'loading', full=True, on=t['sheet_bg'])
    return bachata_video_lesson(t, create_sheet(t, 'New drill', fields, foot, sub='Linked to 0:12–0:27 and to Saturday workshop'))


def unlink_question(t):
    acts = [kit.button(t, 'Only from this section', 'secondary', size='sm', full=True, on=t['raised']),
            kit.button(t, 'From the section and the lesson', 'danger', size='sm', full=True, on=t['raised']),
            kit.button(t, 'Cancel', 'tertiary', size='sm', full=True, on=t['raised'])]
    dlg = kit.dialog(t, 'Unlink Enchufla · Doble?', 'It’s also linked to this lesson.', acts, 'unlink', 'danger')
    return lesson_with(t, popup_links_sheet(t) + dlg)


# 5 — Link a section, the player ------------------------------------------------------

def link_section(t):
    near = [heading_line(t, 'Tuesday class · 27 Oct 2026'),
            prow(t, 'Doble entry', f'{RANGE} · → Enchufla · Doble', 'linked', indent=True, preview=True),
            prow(t, '0:58–1:10', None, 'linked', indent=True, preview=True),
            prow(t, 'Turn pattern', '1:22–1:40', indent=True, preview=True, last=True)]
    other = [heading_line(t, 'Saturday bootcamp · 17 Oct 2026'),
             prow(t, 'Warm-up shines', '0:00–0:48', indent=True, preview=True),
             prow(t, 'Enchufla doble, slow', '3:10–3:32', indent=True, preview=True, last=True),
             heading_line(t, 'Recording · Setenta'),
             prow(t, 'Full figure', '0:00–0:16 · → Setenta · Basic', indent=True, preview=True, last=True)]
    body = pgroup(t, 'In this lesson', near, True) + pgroup(t, 'Other videos', other)
    return figure_page(t, picker(t, 'Link a section', body, 'Search sections', footer=done_button(t, 1)))


def link_section_empty(t):
    body = empty_box(t, 'No sections to link. Open a lesson video full screen and tap Section to mark one.', 'bookmark')
    return figure_page(t, picker(t, 'Link a section', body, 'Search sections', height=520), 'Body wave', 'Basic')


def player_bg(m):
    pic = kit.thumb(kit.THEMES[(m['dance'], 'dark')], 390, 844, None, 1, play=False, radius=0)
    top = (f'<div style="position: absolute; left: 0; right: 0; top: 0; height: 120px; background: {m["top_scrim"]}; display: flex; '
           f'justify-content: space-between; padding: 22px 12px 0; box-sizing: border-box">'
           f'{kit.icon_button(m, "close", "Close the player", "bare", color="#ffffff")}'
           f'{kit.icon_button(m, "more", "More", "bare", color="#ffffff")}</div>')
    return f'<div style="position: absolute; inset: 0">{pic}</div>{top}'


def player(t):
    """Both phones are the player, which is always dark: the media palette (kit.MEDIA)."""
    m = kit.MEDIA[t['dance']]
    if t['mode'] == 'light':
        inner = player_bg(m) + popup_links_sheet(m)
    else:
        body = near_list(m, {'Enchufla · Doble': 'linked', 'Count drill · 3-2 clave': 'linked', 'Dile que no · Basic': 'linked'})
        foot = create_row(m, ['Variation', 'Figure', 'Drill']) + done_button(m, 1)
        inner = player_bg(m) + popup_links_sheet(m, height=520) + picker(m, f'Link {RANGE} to…', body, 'Search figures and drills',
                                                                       footer=foot, back=True, height=740)
    return kit.phone(m, inner, bg='#000000')


# 6 — loading, couldn't load ---------------------------------------------------------

def popup_loading(t):
    body = (f'<span aria-hidden="true" style="margin-left: 16px; width: 96px; height: 12px; border-radius: 6px; background: {t["skeleton"]}"></span>'
            + kit.skeleton_rows(t, 5, 'Loading this section’s links'))
    return lesson_with(t, picker(t, f'Link {RANGE} to…', body, 'Search figures and drills', search_state='disabled', sub='Doble entry · 13 s'))


def popup_failed(t):
    body = kit.banner(t, 'error', 'Couldn’t load this section’s links.', 'Close and tap the link button again.')
    return lesson_with(t, picker(t, 'Link a section to…', body, 'Search figures and drills', search_state='disabled', height=420))


SCREENS = [
    ('Link a figure · open', 'Linking picker (lesson page). Headings for a figure with several variations; linked ones stay, greyed. Create row pinned.', link_open),
    ('+ to keep going', 'Each + links at once and turns its row “Linked”; one is in flight. Done only closes.', link_keep_going),
    ('Search', 'Folded search keeps the heading over a matching variation. The text is carried into Create.', link_search),

    ('No match', 'One empty box under the search. Creating stays in the pinned row, never inside the box.', link_nomatch),
    ('Refused link', 'Bachata · Link an exercise: the server’s refusal sits above the list; the row stays as it was.', exercise_refused, 'bachata'),
    ('Pick an exercise · act', 'Bachata · Today, a past day: a tap opens that exercise’s log. Plain rows, no +.', act_picker, 'bachata'),

    ('Field · closed, focused', 'Move to…: the Figure field shows a placeholder and a chevron; keyboard focus ring.', field_closed),
    ('Field · open', 'The field’s picker stacks over its form. The current value has an accent check. No +, no create.', field_open),
    ('Field · filled, error', 'Picked: the field shows it and the form follows (name clash, Move disabled).', field_filled),

    ('Link popup · nothing linked', 'The section’s link button opens straight into the picker: near group first, three create choices.', popup_direct),
    ('Link popup · links', 'Something linked: the links (× unlinks), Drill and Archived badges, one “Link a figure or drill…”.', popup_links),
    ('Picker over the popup', 'A stacked level: Back returns to the popup; a tap, Done or a create closes both.', popup_pick_over),

    ('Create · New variation', 'Over the picker, Back keeps the search. Figure field filled from the near group; name focused, from “dob”.', create_variation),
    ('Create · name taken', 'New figure refused: the message sits under the field it is about.', create_figure_error),
    ('Create · saving', 'Bachata · New drill, Create and link in flight (one transaction).', create_drill_saving, 'bachata'),

    ('Unlink · also on the lesson', 'Destructive question over the popup: only the section, or the section and the lesson.', unlink_question),
    ('Link a section', 'Figure page: ▶ previews a section looping; a heading per video; near group first.', link_section),
    ('In the player · media palette', 'Both phones are the player (always dark, kit.MEDIA): left the popup, right the picker over it.', player),

    ('Loading', 'The picker opens at once; skeleton rows until the options arrive. Search disabled.', popup_loading),
    ('Couldn’t load', 'The options failed: an error box in place of the list.', popup_failed),
    ('Link a section · nothing to link', 'The picker’s own “nothing left” sentence, no create row.', link_section_empty, 'bachata'),
]


if __name__ == '__main__':
    html, w, h = kit.artboard('Pickers · the shared picker and the Link popup',
                              'One picker for every list (link, field, act), PickerField, the Link popup’s levels, '
                              'create-and-link, Link a section, and the player’s media form. Light and dark.',
                              SCREENS, per_row=3, doc_title='S-pickers')
    kit.write(OUT, html)
    print(w, h)
