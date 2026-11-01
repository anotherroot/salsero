"""S · A routine — the routine editor (/[dance]/routines/[id]) redrawn in the C4 look.

usage: python3 routine.py   -> canvas/project/S-routine.dc.html
"""
import os
import sys

S = '/tmp/claude-1000/-home-tilen-Projects-salsaapp-wt-app-icons/cf18291b-f44a-483d-bf97-2da9a238a117/scratchpad'
sys.path.insert(0, S + '/gen/kit')
import kit  # noqa: E402
from kit import ts, icon, BTN, SR  # noqa: E402

OUT = S + '/canvas/project/S-routine.dc.html'

# --------------------------------------------------------------------------
# glyphs the kit lacks (same 24 grid, 2px rounded strokes)
# --------------------------------------------------------------------------
GLYPH = {
    'add-above': '<path d="M12 3v8M8 7h8"></path><rect x="4" y="14.5" width="16" height="6" rx="2"></rect>',
    'add-below': '<rect x="4" y="3.5" width="16" height="6" rx="2"></rect><path d="M12 13v8M8 17h8"></path>',
    'copy': '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"></rect><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"></path>',
    'arrow-down': '<path d="M12 5v14M6.5 13.5L12 19l5.5-5.5"></path>',
    'arrow-up': '<path d="M12 19V5M6.5 10.5L12 5l5.5 5.5"></path>',
}


def glyph(name, size, color):
    if name not in GLYPH:
        return icon(name, size, color)
    return (f'<svg aria-hidden="true" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            f'stroke-linecap="round" stroke-linejoin="round" style="flex: none; color: {color}">{GLYPH[name]}</svg>')


def col(inner, gap=8, extra=''):
    return f'<div style="display: flex; flex-direction: column; gap: {gap}px; flex: none; {extra}">{inner}</div>'


# --------------------------------------------------------------------------
# the routine's building blocks
# --------------------------------------------------------------------------


def number(t, n, sel=False):
    bg, fg = (t['accent'], t['on_accent']) if sel else (t['accent_soft'], t['accent_text'])
    return (f'<span aria-hidden="true" style="width: 26px; height: 26px; border-radius: 13px; background: {bg}; color: {fg}; font-size: 12px; '
            f'font-weight: 800; display: flex; align-items: center; justify-content: center; flex: none; font-variant-numeric: tabular-nums">{n}</span>')


def handle(t, n, state='default'):
    sh = f'box-shadow: {kit.ring(t)}; border-radius: 12px;' if state == 'focused' else ''
    bg = f'background: {t["pressed"]}; border-radius: 12px;' if state == 'pressed' else ''
    return (f'<button type="button" aria-label="Move slot {n}. Arrow keys move it." style="width: 44px; height: 44px; flex: none; {BTN}; cursor: grab; {sh}{bg}">'
            f'{icon("drag", 20, t["muted"])}</button>')


def select_mark(t, on):
    if on:
        m = icon('check-circle', 24, t['accent'], filled=True, bg=t['on_accent'])
    else:
        m = f'<span style="width: 24px; height: 24px; box-sizing: border-box; border-radius: 12px; border: 2px solid {t["muted"]}"></span>'
    return f'<span aria-hidden="true" style="width: 44px; height: 44px; flex: none; display: flex; align-items: center; justify-content: center">{m}</span>'


def slot(t, n, title, meta=None, note=None, alts=None, routine=False, mode='edit', state='default',
         note_state='filled', alt_swiped=None, empty=False, handle_state='default', failure=None):
    """One slot card.

    mode: edit (drag handle) | select (check circle, selection mode on);
    state: default | expanded | selected | lifted | swiped;
    alts: list of alternative labels (the variation's own name: 'Doble');
    note_state for an expanded card: empty | filled | focused."""
    alts = alts or []
    expanded = state == 'expanded'
    selected = state == 'selected'
    bg = t['accent_soft'] if selected else (t['raised'] if state == 'lifted' else t['surface'])
    ring = ''
    if expanded:
        ring = f'box-shadow: inset 0 0 0 2px {t["accent"]};'
    elif state == 'lifted':
        ring = f'box-shadow: {t["shadow"]}, 0 18px 40px rgba(0,0,0,0.22); transform: scale(1.03) rotate(-0.8deg);'
    lead = select_mark(t, selected) if mode == 'select' else handle(t, n, handle_state)
    tcol = t['muted'] if empty else t['ink']
    rt = icon('route', 18, t['accent_text'], style='margin-right: 6px; vertical-align: -3px') if routine else ''
    lines = f'<span style="display: block; font-size: 16px; line-height: 1.3; font-weight: 700; color: {tcol}">{rt}{title}</span>'
    if meta:
        lines += f'<span style="display: block; font-size: 13px; line-height: 1.35; color: {t["muted"]}; margin-top: 2px">{meta}</span>'
    if not expanded:
        if note:
            lines += f'<span style="display: block; font-size: 13px; line-height: 1.35; font-style: italic; color: {t["ink2"]}; margin-top: 3px">{note}</span>'
        if alts:
            lines += (f'<span style="display: block; font-size: 13px; line-height: 1.35; color: {t["muted"]}; margin-top: 2px">'
                      f'<span style="font-weight: 700">or</span> {", ".join(alts)}</span>')
    aria = f'aria-pressed="{"true" if selected else "false"}"' if mode == 'select' else f'aria-expanded="{"true" if expanded else "false"}"'
    body = (f'<div role="button" tabindex="0" {aria} style="flex: 1; min-width: 0; padding: 4px 0; cursor: pointer">{lines}</div>')
    open_link = ''
    if expanded:
        open_link = (f'<a href="#" style="height: 44px; flex: none; padding: 0 6px 0 10px; display: flex; align-items: center; gap: 2px; color: {t["accent_text"]}; '
                     f'font-size: 15px; font-weight: 800; text-decoration: none">Open{icon("chevron-right", 18, t["accent_text"])}</a>')
    head = (f'<div style="display: flex; align-items: center; gap: 6px; min-height: 48px">{lead}{number(t, n, selected)}{body}{open_link}</div>')
    note_html = ''
    if expanded:
        nid = kit.uid('note')
        line = f'border-bottom: 2px solid {t["accent"]};' if note_state == 'focused' else f'border-bottom: 1.5px dashed {t["field_line"]};'
        val = '' if note_state == 'empty' else (note or '')
        caret = (f'<span aria-hidden="true" style="width: 2px; height: 20px; background: {t["accent"]}; margin-left: -8px; flex: none"></span>'
                 if note_state == 'focused' else '')
        note_html = (f'<div style="padding: 2px 14px 6px 78px">'
                     f'<label for="{nid}" style="{SR}">Note for slot {n}</label>'
                     f'<div style="display: flex; align-items: center; gap: 8px; height: 40px; {line}">{icon("edit", 16, t["accent_text"] if note_state == "focused" else t["muted"])}'
                     f'<input id="{nid}" value="{val}" placeholder="Add a note…" maxlength="200" style="flex: 1; min-width: 0; height: 36px; border: 0; background: none; '
                     f'font: inherit; font-size: 15px; font-weight: 500; color: {t["ink"]}; outline: none; padding: 0">{caret}</div></div>')
    card = (f'<div style="background: {bg}; border-radius: 16px; padding: 8px 6px 8px 2px; {ring} position: relative">'
            f'{head}{note_html}</div>')
    if state == 'swiped':
        card = (f'<div style="position: relative; border-radius: 16px; background: {t["danger"]}; overflow: hidden">'
                f'<button type="button" style="position: absolute; right: 0; top: 0; bottom: 0; width: 100px; border: 0; background: none; color: {t["on_danger"]}; '
                f'display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 14px; font-weight: 800; cursor: pointer">'
                f'{icon("trash", 22, t["on_danger"])}Delete</button>'
                f'<div style="transform: translateX(-100px); box-shadow: 4px 0 12px rgba(0,0,0,0.12); border-radius: 16px">{card}</div></div>')
    out = card
    if expanded and not routine:
        rail = ''
        for a in alts:
            rail += alt_row(t, a, swiped=a == alt_swiped)
        rail += (f'<button type="button" style="height: 44px; border-radius: 12px; border: 1.5px dashed {kit.rgba(t["accent"], 0.5)}; background: none; color: {t["accent_text"]}; '
                 f'font-size: 15px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer">{icon("plus", 18, t["accent_text"])}Alternative</button>')
        out += (f'<div role="group" aria-label="Alternatives for slot {n}" style="margin: 0 0 0 28px; padding: 2px 0 2px 12px; border-left: 2px solid {t["accent_soft_pressed"]}; '
                f'display: flex; flex-direction: column; gap: 8px">{rail}</div>')
    if failure:
        out += kit.banner(t, 'error', failure)
    return col(out, 8)


def alt_row(t, label, swiped=False):
    tile = (f'<div role="button" tabindex="0" style="flex: 1; min-width: 0; height: 44px; box-sizing: border-box; border-radius: 12px; background: {t["accent_soft"]}; '
            f'display: flex; align-items: center; padding: 0 14px; font-size: 15px; font-weight: 700; color: {t["ink"]}">{label}</div>')
    if swiped:
        tile = (f'<div style="flex: 1; min-width: 0; position: relative; height: 44px; border-radius: 12px; background: {t["danger"]}; overflow: hidden">'
                f'<button type="button" style="position: absolute; right: 0; top: 0; bottom: 0; width: 88px; border: 0; background: none; color: {t["on_danger"]}; '
                f'font-size: 14px; font-weight: 800; cursor: pointer">Remove</button>'
                f'<div style="transform: translateX(-88px); height: 44px; box-sizing: border-box; border-radius: 12px; background: {t["accent_soft"]}; '
                f'display: flex; align-items: center; padding: 0 14px; font-size: 15px; font-weight: 700; color: {t["ink"]}; box-shadow: 4px 0 10px rgba(0,0,0,0.12)">{label}</div></div>')
    sq = 'width: 44px; height: 44px; flex: none; border-radius: 12px; border: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0'
    return (f'<div style="display: flex; gap: 6px; align-items: center">{tile}'
            f'<a href="#" aria-label="Open {label}" style="{sq}; background: {t["accent_soft"]}">{icon("external", 18, t["accent_text"])}</a>'
            f'<button type="button" aria-label="Remove {label}" style="{sq}; background: {t["danger_soft"]}">{icon("trash", 18, t["danger"])}</button></div>')


def seam_button(t, text, glyph_name, label, primary=False):
    bg, fg = (t['accent'], t['on_accent']) if primary else (t['surface'], t['accent_text'])
    return (f'<button type="button" aria-label="{label}" style="height: 44px; flex: none; {BTN}">'
            f'<span style="height: 36px; padding: 0 14px 0 10px; border-radius: 18px; background: {bg}; color: {fg}; font-size: 14px; font-weight: 800; '
            f'display: flex; align-items: center; gap: 6px; white-space: nowrap">{glyph(glyph_name, 18, fg)}{text}</span></button>')


def seam(t, above, below, text, bridge=False):
    """Where two slots do not connect: what is missing, and the ways to build."""
    btns = (seam_button(t, f'After {above}', 'arrow-down', f'Add after slot {above}')
            + seam_button(t, f'Before {below}', 'arrow-up', f'Add before slot {below}'))
    if bridge:
        btns += seam_button(t, 'Bridge', 'plus', f'Add between slot {above} and slot {below}', primary=True)
    return (f'<div role="group" aria-label="Slots {above} and {below} do not connect" style="flex: none; background: {t["warn_soft"]}; border-radius: 14px; '
            f'padding: 10px 10px 4px 12px; display: flex; flex-direction: column; gap: 2px; border-left: 3px solid {t["warn"]}">'
            f'<span style="display: flex; align-items: flex-start; gap: 7px; font-size: 13px; line-height: 1.35; font-weight: 700; color: {t["warn"]}">'
            f'{icon("warning", 16, t["warn"], style="margin-top: 1px")}{text}</span>'
            f'<div style="display: flex; gap: 6px; flex-wrap: wrap">{btns}</div></div>')


def add_top(t, disabled=False):
    c = t['disabled_ink'] if disabled else t['accent_text']
    dis = ' disabled' if disabled else ''
    return (f'<div style="display: flex; justify-content: center; flex: none"><button type="button" aria-label="Add before slot 1"{dis} style="width: 44px; height: 44px; {BTN}">'
            f'<span style="width: 36px; height: 36px; box-sizing: border-box; border-radius: 18px; border: 1.5px dashed {kit.rgba(t["accent"], 0.5) if not disabled else t["field_line"]}; '
            f'display: flex; align-items: center; justify-content: center">{icon("plus", 18, c)}</span></button></div>')


def add_end(t, n, disabled=False):
    c = t['disabled_ink'] if disabled else t['accent_text']
    bd = t['field_line'] if disabled else kit.rgba(t['accent'], 0.5)
    dis = ' disabled' if disabled else ''
    return (f'<button type="button" aria-label="Add after slot {n}"{dis} style="flex: none; height: 52px; border-radius: 16px; border: 1.5px dashed {bd}; background: none; '
            f'color: {c}; font-size: 15px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer">'
            f'{icon("plus", 20, c)}Add a slot</button>')


def facts(t, starts, end, loops, breaks=0, tbreaks=0):
    b = kit.badge(t, 'Loops', 'done', icon_name='repeat') if loops else kit.badge(t, 'Doesn’t loop', 'warn', icon_name='repeat')
    if breaks:
        b += kit.badge(t, f'{breaks} break{"s" if breaks > 1 else ""}', 'warn')
    if tbreaks:
        b += kit.badge(t, f'{tbreaks} timing break{"s" if tbreaks > 1 else ""}', 'warn')
    return (f'<div style="flex: none; display: flex; flex-direction: column; gap: 8px; padding: 2px 4px 4px">'
            f'<span style="font-size: 14px; font-weight: 600; color: {t["ink2"]}">Starts from <b style="color: {t["ink"]}">{starts}</b> · ends at <b style="color: {t["ink"]}">{end}</b></span>'
            f'<div style="display: flex; gap: 6px; flex-wrap: wrap">{b}</div></div>')


def header(t, name, compact=False, sub=None, hero=False):
    return kit.band_header(t, name, sub, left=kit.band_button(t, 'back', 'Back to Moves'),
                           right=kit.band_button(t, 'edit', 'Edit routine'), tall=not compact, hero=hero,
                           bottom=(44 if compact else None))


def selecting_header(t, count):
    return kit.band_header(t, f'{count} selected', left=kit.band_button(t, 'close', 'Stop selecting'), tall=False, bottom=44)


def selection_bar(t, can_one=False, can_make=True, hint=None):
    def item(label, g, enabled=True, danger=False):
        c = t['danger'] if danger else t['ink']
        if not enabled:
            c = t['disabled_ink']
        ad = '' if enabled else ' aria-disabled="true"'
        return (f'<button type="button"{ad} style="min-height: 60px; border: 0; background: none; border-radius: 14px; padding: 6px 2px; display: flex; flex-direction: column; '
                f'align-items: center; justify-content: center; gap: 5px; color: {c}; font-size: 12px; line-height: 1.2; font-weight: 700; cursor: pointer; text-align: center">'
                f'{glyph(g, 24, c)}{label}</button>')
    h = (f'<p role="status" style="margin: 0 4px 6px; padding: 10px 12px; border-radius: 12px; background: {t["warn_soft"]}; color: {t["ink"]}; font-size: 13px; '
         f'line-height: 1.4; font-weight: 600; display: flex; gap: 8px; align-items: flex-start">{icon("info", 16, t["warn"], style="margin-top: 1px")}{hint}</p>') if hint else ''
    return (f'<div role="toolbar" aria-label="Selected slots" style="position: absolute; left: 0; right: 0; bottom: 0; background: {t["tab_bg"]}; border-top: 1px solid {t["tab_line"]}; '
            f'padding: 8px 8px 26px; box-shadow: 0 -8px 24px rgba(0,0,0,0.08)">{h}'
            f'<div style="display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 2px">'
            f'{item("Add above", "add-above", can_one)}{item("Add below", "add-below", can_one)}{item("Duplicate", "copy")}'
            f'{item("Make routine", "route", can_make)}{item("Delete", "trash", danger=True)}</div></div>')


# --------------------------------------------------------------------------
# the routine's content
# --------------------------------------------------------------------------
SL = [  # salsa: Shine combo
    dict(n=1, title='Dile que no · Basic', meta='1→1 · Open → Closed'),
    dict(n=2, title='Enchufla · Basic', meta='1→1 · Closed → Open', note='Lead the turn early', alts=['Doble', 'Complicada']),
    dict(n=3, title='Setenta · Basic', meta='1→1 · Open → Hammerlock'),
    dict(n=4, title='Hammerlock combo', meta='Routine · 3 slots · 1→1 · Open → Open', routine=True),
    dict(n=5, title='Sombrero · Basic', meta='1→5 · Open → Open'),
    dict(n=6, title='Kentucky · Basic', meta='1→1 · Open → Closed'),
]
SEAM_3 = 'Ends in Hammerlock, next starts from Open'
SEAM_5 = 'Ready for 5, next starts on 1'


def slots_salsa(t, mode='edit', states=None, seams=True, expand=None, note_state='filled', alt_swiped=None, only=None,
                failure_at=None):
    states = states or {}
    out = ''
    for s in SL:
        if only and s['n'] not in only:
            continue
        st = states.get(s['n'], 'default')
        if expand == s['n']:
            st = 'expanded'
        out += slot(t, mode=mode, state=st, note_state=note_state, alt_swiped=alt_swiped,
                    failure=failure_at[1] if failure_at and failure_at[0] == s['n'] else None, **s)
        if seams and mode == 'edit' and s['n'] == 3:
            out += seam(t, 3, 4, SEAM_3, bridge=True)
        if seams and mode == 'edit' and s['n'] == 5:
            out += seam(t, 5, 6, SEAM_5)
    return out


def overview_body(t):
    return (facts(t, 'Open', 'Closed', False, 1, 1)
            + kit.section_label(t, 'Slots · 6', 6) + add_top(t) + slots_salsa(t) + add_end(t, 6))


def overview(t, overlay=''):
    hero = kit.hero_card(t, 'Practise', 'Count only or with a song', label='Practise Shine combo')
    return kit.page(t, header(t, 'Shine combo', hero=True), overview_body(t), hero=hero, overlay=overlay)


def scrolled(t, body, overlay='', footer='', name='Shine combo'):
    """The page scrolled down to its slots: the large title has collapsed to the compact one."""
    return kit.page(t, header(t, name, compact=True), body, pad='18px 16px 0', overlay=overlay, footer=footer)


def expanded(t, overlay='', note_state='focused', alt_swiped=None):
    body = kit.section_label(t, 'Slots · 6') + add_top(t) + slots_salsa(t, expand=2, note_state=note_state, alt_swiped=alt_swiped)
    return scrolled(t, body, overlay)


def alt_swipe(t):
    return expanded(t, note_state='filled', alt_swiped='Doble')


# ---- edit -----------------------------------------------------------------

def edit(t, overlay=''):
    head = kit.band_header(t, 'Edit routine', left=kit.band_button(t, 'close', 'Stop editing'),
                           right=kit.band_button(t, 'check', 'Done'))
    body = (kit.text_field(t, 'Name', 'Shine combo', state='focused', helper='Up to 200 characters')
            + kit.textarea(t, 'Notes', 'Shines between the turns. Keep the Setenta tight and land the Kentucky on 1.', state='filled', rows=4, optional=True)
            + '<div style="height: 4px; flex: none"></div>'
            + kit.button(t, 'Save', 'primary', full=True)
            + kit.section_label(t, 'More', 18)
            + kit.list_group(t, [
                dict(title='Duplicate routine', meta='Makes a copy and opens it', leading=glyph('copy', 22, t['accent_text']), trailing=kit.chevron(t), href='#'),
                dict(title=f'<span style="color: {t["danger"]}">Archive routine</span>', meta='Its slots and practice history are kept',
                     leading=icon('trash', 22, t['danger']), href='#'),
            ]))
    return kit.page(t, head, body, pad='24px 16px 0', overlay=overlay)


def archive(t):
    dlg = kit.dialog(t, 'Archive “Shine combo”?',
                     'It leaves the Routines list. Its slots and practice history are kept.',
                     [kit.button(t, 'Cancel', 'tertiary', size='sm', on=t['raised']),
                      kit.button(t, 'Archive', 'danger', size='sm', on=t['raised'])], icon_name='trash', tone='danger')
    return edit(t, overlay=dlg)


# ---- picker ---------------------------------------------------------------

def pick_row(t, title, meta, indent=False, last=False):
    hair = '' if last else f'border-bottom: 1px solid {t["hairline"]};'
    return (f'<button type="button" style="display: block; width: 100%; border: 0; background: none; padding: 0 0 0 {34 if indent else 16}px; text-align: left; '
            f'cursor: pointer; color: {t["ink"]}"><span style="display: flex; flex-direction: column; justify-content: center; gap: 2px; min-height: 60px; '
            f'box-sizing: border-box; padding: 9px 16px 9px 0; {hair}"><span style="font-size: 16px; line-height: 1.3; font-weight: 700">{title}</span>'
            f'<span style="font-size: 13px; color: {t["muted"]}; font-variant-numeric: tabular-nums">{meta}</span></span></button>')


def pick_heading(t, name):
    return (f'<div role="presentation" style="padding: 14px 16px 2px; display: flex; align-items: center; gap: 8px">'
            f'<span style="font-size: 15px; font-weight: 800; color: {t["ink2"]}">{name}</span>'
            f'<span style="font-size: 12px; font-weight: 700; color: {t["muted"]}">variations</span></div>')


def pick_group(t, items):
    """items: ('row', title, meta) | ('head', name) | ('var', title, meta). Builds one card."""
    out = ''
    for i, it in enumerate(items):
        last = i == len(items) - 1
        if it[0] == 'head':
            out += pick_heading(t, it[1])
        else:
            out += pick_row(t, it[1], it[2], indent=it[0] == 'var', last=last)
    return f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">{out}</div>'


def filter_chips(t, count=True, hold=True):
    return (f'<div role="group" aria-label="Filters" style="display: flex; gap: 8px; flex: none">'
            f'{kit.chip(t, "Count", count, icon_name="check" if count else None)}{kit.chip(t, "Hold", hold, icon_name="check" if hold else None)}</div>')


def picker(t, title, context, groups, chips=True, search='', empty=None, height=730):
    """The shared picker as the routine editor uses it: context line, Count/Hold, groups.
    groups: list of (label, items)."""
    top = kit.search_field(t, 'Search figures and routines', search, 'filled' if search else 'empty')
    if chips:
        top += filter_chips(t, *(chips if isinstance(chips, tuple) else (True, True)))
    lst = ''
    for label, items in groups:
        lst += kit.section_label(t, label, 6) + pick_group(t, items)
    if empty:
        lst += (f'<div role="status" style="flex: none; background: {t["chip"]}; border-radius: 16px; padding: 16px; font-size: 15px; line-height: 1.5; color: {t["ink2"]}">{empty}</div>')
    inner = (top + f'<div style="flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: 8px; '
             f'margin: 0 -16px; padding: 0 16px; -webkit-mask-image: linear-gradient(#000 88%, transparent)">{lst}</div>')
    sub = (f'<span style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: {t["ink2"]}">'
           f'{icon("flag", 15, t["accent_text"])}{context}</span>') if context else None
    return kit.bottom_sheet(t, title, inner, height=height, sub=sub)


def picker_after(t):
    groups = [
        ('Figures', [('row', 'Dile que no · Hammerlock out', '1→1 · Hammerlock → Closed'),
                     ('head', 'Setenta'),
                     ('var', 'Salida', '1→1 · Hammerlock → Open'),
                     ('var', 'Con vuelta', '1→1 · Hammerlock → Open'),
                     ('row', 'Vacílala · Hammerlock', '1→1 · Hammerlock / Closed → Open')]),
        ('Routines', [('row', 'Hammerlock exit', '1→1 · Hammerlock → Open · 2 slots')]),
    ]
    return expanded_bg(t, picker(t, 'Add after slot 3', 'Starts on 1 from Hammerlock', groups))


def expanded_bg(t, overlay):
    body = kit.section_label(t, 'Slots · 6') + add_top(t) + slots_salsa(t)
    return scrolled(t, body, overlay)


def picker_bridge(t):
    groups = [('Figures', [('head', 'Setenta'),
                           ('var', 'Salida', '1→1 · Hammerlock → Open'),
                           ('var', 'Con vuelta', '1→1 · Hammerlock → Open')])]
    return expanded_bg(t, picker(t, 'Add between slots 3 and 4', 'Starts on 1 from Hammerlock · ends on 8 at Open', groups, height=600))


def picker_alt(t):
    groups = [('Figures', [('head', 'Enchufla'),
                           ('var', 'Con mambo', '1→1 · Closed → Open'),
                           ('row', 'Exhíbela · Basic', '1→1 · Closed → Open'),
                           ('row', 'Vacílala · Basic', '1→1 · Closed / Open → Open')])]
    return expanded(t, picker(t, 'Alternative for Enchufla', 'Closed → Open, 1→1', groups, chips=False, height=560), note_state='filled')


# ---- drag, swipe, toast ---------------------------------------------------

def drag(t):
    # Slot 5 (Sombrero) lifted, dragged up between 2 and 3; the others slid apart. Seams hidden mid-drag.
    out = ''
    for s in SL:
        if s['n'] == 5:
            continue
        if s['n'] == 3:
            out += (f'<div aria-hidden="true" style="flex: none; height: 66px; border-radius: 16px; border: 2px dashed {kit.rgba(t["accent"], 0.45)}; '
                    f'background: {kit.rgba(t["accent"], 0.06)}"></div>')
        out += slot(t, **s)
    lifted = SL[4]
    card = slot(t, state='lifted', handle_state='pressed', **lifted)
    finger = (f'<span aria-hidden="true" style="position: absolute; left: 14px; top: 22px; width: 40px; height: 40px; border-radius: 20px; '
              f'background: {kit.rgba(t["accent"], 0.22)}; box-shadow: 0 0 0 6px {kit.rgba(t["accent"], 0.1)}"></span>')
    lst = (f'<div style="position: relative; display: flex; flex-direction: column; gap: 8px; flex: none">{out}'
           f'<div style="position: absolute; left: 0; right: 0; top: 124px; z-index: 2">{card}{finger}</div></div>')
    body = kit.section_label(t, 'Slots · 6') + add_top(t) + lst + add_end(t, 6)
    return scrolled(t, body)


def swipe(t):
    body = kit.section_label(t, 'Slots · 6') + add_top(t) + slots_salsa(t, states={4: 'swiped'})
    return scrolled(t, body)


def undo(t):
    # Slot 4 (the embedded routine) deleted: 3 now meets Sombrero, and the seam moved.
    out = ''
    for s in SL:
        if s['n'] == 4:
            continue
        n = s['n'] if s['n'] < 4 else s['n'] - 1
        out += slot(t, **{**s, 'n': n})
        if s['n'] == 3:
            out += seam(t, 3, 4, 'Ends in Hammerlock, next starts from Open', bridge=True)
        if s['n'] == 5:
            out += seam(t, 4, 5, SEAM_5)
    body = kit.section_label(t, 'Slots · 5') + add_top(t) + out
    return scrolled(t, body, overlay=kit.toast(t, 'Slot 4 deleted', 'Undo', icon_name='trash', bottom=34))


# ---- selection ------------------------------------------------------------

def select(t, overlay=''):
    body = (kit.section_label(t, 'Slots · 6') + add_top(t, disabled=True)
            + slots_salsa(t, mode='select', states={1: 'selected', 2: 'selected', 3: 'selected'}))
    return kit.page(t, selecting_header(t, 3), body, pad='18px 16px 0',
                    footer=selection_bar(t, can_one=False, can_make=True), overlay=overlay)


def make_routine(t):
    inner = (kit.text_field(t, 'Name', 'Shine opener', state='focused')
             + f'<p style="margin: 0; font-size: 14px; line-height: 1.45; color: {t["muted"]}">The 3 slots move into the new routine, and it takes their place here as one slot.</p>'
             + f'<div style="display: flex; flex-direction: column; gap: 6px; flex: none">'
             + ''.join(f'<span style="display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 600; color: {t["ink2"]}">{number(t, s["n"])}{s["title"]}</span>' for s in SL[:3])
             + '</div>')
    sheet = kit.bottom_sheet(t, 'Make a routine', inner, footer=kit.button(t, 'Make routine', 'primary', icon_name='route', full=True, on=t['sheet_bg']))
    return select(t, overlay=sheet)


BL = [  # bachata: Opener
    dict(n=1, title='Body wave · Basic', meta='1→1 · Closed → Closed', note='Slow, from the chest'),
    dict(n=2, title='Cuddle turn · Basic', meta='1→1 · Closed → Cuddle', alts=['Double']),
    dict(n=3, title='Shadow intro', meta='Routine · 2 slots · 1→1 · Cuddle → Shadow', routine=True),
    dict(n=4, title='Media luna · Basic', meta='1→1 · Shadow → Closed'),
]

BL_LOOP = BL[:2] + [dict(n=3, title='Shadow intro', meta='Routine · 3 slots · 1→1 · Cuddle → Closed', routine=True)]


def select_blocked(t):
    body = kit.section_label(t, 'Slots · 4') + add_top(t, disabled=True)
    states = {1: 'selected', 3: 'selected'}
    for s in BL:
        body += slot(t, mode='select', state=states.get(s['n'], 'default'), **s)
    return kit.page(t, selecting_header(t, 2), body, pad='18px 16px 0',
                    footer=selection_bar(t, can_one=False, can_make=False, hint='Slot 3 is a routine — embedding is one level.'))


# ---- bachata overview, empty, refused ------------------------------------

def bachata_overview(t):
    hero = kit.hero_card(t, 'Practise', 'Count only or with a song', label='Practise Opener')
    body = (f'<p style="margin: 0; padding: 2px 4px 0; font-size: 15px; line-height: 1.45; color: {t["ink2"]}; flex: none">Opens every social. Slow on the wave.</p>'
            + facts(t, 'Closed', 'Closed', True)
            + kit.section_label(t, 'Slots · 3', 6) + add_top(t)
            + ''.join(slot(t, **s) for s in BL_LOOP) + add_end(t, 3)
            + kit.section_label(t, 'More', 14)
            + kit.list_group(t, [dict(title='Exercise', meta='Every 3 days · done yesterday', leading=icon('repeat', 22, t['accent_text']), trailing=kit.chevron(t), href='#'),
                                 dict(title='Sensual class · 28 October', meta='Taught in · 2 videos', leading=icon('lessons', 22, t['accent_text']), trailing=kit.chevron(t), href='#')]))
    return kit.page(t, header(t, 'Opener', hero=True), body, hero=hero)


def empty(t):
    head = header(t, 'Footwork', hero=False)
    body = (kit.empty_state(t, 'route', 'No slots yet', 'The first slot is where the routine starts. Add a figure, then build from it.',
                            kit.button(t, 'Add a figure', 'primary', icon_name='plus'))
            + kit.section_label(t, 'More', 8)
            + kit.list_group(t, [dict(title='Exercise', meta='Every 7 days · new', leading=icon('repeat', 22, t['accent_text']), trailing=kit.chevron(t), href='#')]))
    return kit.page(t, head, body, pad='28px 16px 0')


def refused(t):
    msg = 'That figure does not start and land like this slot’s figure, so it is not an alternative.'
    body = (kit.banner(t, 'error', 'Those slots could not be put back.', dismiss=True)
            + kit.section_label(t, 'Slots · 4', 6)
            + slot(t, 1, 'Dile que no · Basic', '1→1 · Open → Closed')
            + slot(t, 2, 'Enchufla · Basic', '1→1 · Closed → Open', alts=['Doble'], state='expanded', note_state='empty', failure=msg)
            + slot(t, 3, 'Sombrero · Basic <span style="font-weight: 600; color: inherit">(archived)</span>', '1→1 · Open → Open')
            + slot(t, 4, 'Empty — nothing to call here', None, empty=True))
    return scrolled(t, body)


def picker_empty(t):
    empty_txt = (f'Nothing you know starts on 5 from Shadow. '
                 f'<button type="button" style="border: 0; background: none; padding: 0; font: inherit; font-weight: 800; color: {t["accent_text"]}; '
                 f'text-decoration: underline; text-underline-offset: 3px; cursor: pointer; min-height: 24px">Turn off Hold</button> to see the rest.')
    sheet = picker(t, 'Add after slot 2', 'Starts on 5 from Shadow', [], chips=True, empty=empty_txt, height=520)
    body = kit.section_label(t, 'Slots · 4') + add_top(t) + ''.join(slot(t, **s) for s in BL)
    return scrolled(t, body, overlay=sheet, name='Opener')


SCREENS = [
    ('A routine', 'Practise hero, start/end and loop badges, a slot with alternatives and a note, an embedded routine, two seams', overview),
    ('A slot tapped open', 'Note field focused in the card, Open, the alternatives rail, + Alternative. Title collapsed on scroll', expanded),
    ('Picker · Add after slot 3', 'Opened from “After 3”: context line, Count and Hold on, a figure with variations as a heading', picker_after),
    ('Picker · Bridge', 'The seam’s Bridge: fits both sides in one step. Only drawn when something does', picker_bridge),
    ('Picker · Alternative', 'Must start and land like the main figure; no filters, no routines', picker_alt),
    ('Picker · filters left nothing', 'Bachata. The empty box offers the way out: Turn off Hold', picker_empty, 'bachata'),
    ('Dragging a slot', 'Sombrero lifted by its handle, the others open a gap where it lands; seams hidden mid-drag', drag),
    ('Swipe to delete', 'Swiped left on the embedded routine: Delete under the card, red behind its corners', swipe),
    ('Deleted · Undo', 'No confirm: the slot goes at once, the seam moves, a toast offers Undo for 6 s', undo),
    ('Alternative swiped', 'Doble swiped left on an alternative reveals Remove; the trash square does the same', alt_swipe),
    ('Selecting', 'Long-press: 3 selected. Add above/below need exactly one (greyed, tap says why)', select),
    ('Make a routine', 'The run becomes a new routine and one slot here. Name focused', make_routine),
    ('Make routine refused', 'Bachata. A greyed action still takes a tap, to say why', select_blocked, 'bachata'),
    ('A routine that loops', 'Bachata. Clean: no seams, a Loops badge. Notes, its exercise, Taught in', bachata_overview, 'bachata'),
    ('Empty routine', 'Not danceable yet, so no Practise. One Add a figure, with no filters', empty),
    ('Edit routine', 'Name focused. Save; Duplicate and Archive below', edit),
    ('Archive?', 'The one confirm on this page (it was a browser confirm)', archive),
    ('Refused, archived, empty', 'A refusal under the slot it aimed at; a routine-level one in a banner; an archived figure; an empty slot', refused),
]


if __name__ == '__main__':
    html, w, h = kit.artboard('S · A routine',
                              'The routine editor: slots, seams and how they build, the picker, drag, swipe and undo, selection and Make routine. Salsa, three pairs in bachata.',
                              SCREENS, per_row=3, doc_title='S · A routine')
    kit.write(OUT, html)
    print(w, h)
