"""Clones and twins on the desktop: the pieces every area can draw (figure, routine, drill, song, lesson).

Words are the app's (src/lib/clones/view.ts); the layouts are the phone boards C0–C8 of the "Salsero group mode"
canvas ("Design 2 · clones and twins"), each bottom sheet as a centred dialog (4B).

    import _clones as C
    C.source_tabs(t, ['Yours', 'Salsa Tuesdays'], 0)          # the tab per source, top of the item
    C.compare_banner(t, 'Salsa Tuesdays changed it since you took it: timing, 1 recording')
    C.actions(t, copy=True, same=True, detach=True, drop=True)  # the trigger row under the tabs
    F.dialog(t, C.make_mine_title('Setenta · Básico'), C.make_mine_body(t, 'figure', ...), footer=C.make_mine_foot(t))
"""
import os
import sys

if os.path.dirname(os.path.abspath(__file__)) not in sys.path:
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import frame as F  # noqa: E402
from frame import kit, icon, ts  # noqa: E402

GETS = {
    'figure': 'Its name, timing, positions and notes, to change as you like.',
    'routine': 'Its name, notes and slots, to change as you like.',
    'drill': 'Its name, notes and practice, to change as you like.',
    'song': 'Its title, artist and count, to change as you like.',
    'lesson': 'Its title, notes, links, videos and sections, to change as you like. The videos count against your space.',
}
STAYS = {
    'figure': 'Its recordings and their sections. You still see them inside yours, and can take one (it then counts against your space).',
}


# --------------------------------------------------------------------------
# small parts
# --------------------------------------------------------------------------

def gtone(t):
    """The group colour (navy, tokens.ts GROUP) as a soft disc and its ink: a place that is a group."""
    return ('#e7ebf5', '#3a55a8') if t['mode'] == 'light' else ('#2a3044', '#8fa8ff')


def disc(t, place='group', size=40):
    """A round lead for a place: yours (a person, accent) or a group (people, navy)."""
    if place == 'mine':
        bg, ink, ic = t['accent_soft'], t['accent_text'], 'solo'
    elif place == 'trash':
        bg, ink, ic = t['danger_soft'], t['danger'], 'trash'
    else:
        bg, ink = gtone(t)
        ic = 'people'
    return (f'<span style="width: {size}px; height: {size}px; border-radius: 50%; background: {bg}; display: flex; align-items: center; '
            f'justify-content: center; flex: none">{icon(ic, size // 2, ink)}</span>')


def radio_mark(t, on, bg=None):
    bg = bg or t['sheet_bg']
    if on:
        return (f'<span style="width: 22px; height: 22px; border-radius: 50%; box-sizing: border-box; border: 2px solid {t["accent"]}; '
                f'display: flex; align-items: center; justify-content: center; flex: none"><span style="width: 12px; height: 12px; border-radius: 50%; '
                f'background: {t["accent"]}"></span></span>')
    return f'<span style="width: 22px; height: 22px; border-radius: 50%; box-sizing: border-box; border: 2px solid {t["field_line"]}; flex: none; background: {bg}"></span>'


def check_mark(t, on):
    if on:
        return (f'<span style="width: 22px; height: 22px; border-radius: 6px; background: {t["accent"]}; display: flex; align-items: center; '
                f'justify-content: center; flex: none">{icon("check", 16, t["on_accent"], stroke=3)}</span>')
    return f'<span style="width: 22px; height: 22px; border-radius: 6px; box-sizing: border-box; border: 2px solid {t["field_line"]}; flex: none"></span>'


def choice(t, lead, title, meta=None, mark='', selected=False, pad='10px 12px'):
    """A row in a dialog: lead disc, title and meta, a radio or a box at the right. The chosen one is tinted."""
    m = f'<span style="font-size: 13px; line-height: 1.35; color: {t["muted"]}">{meta}</span>' if meta else ''
    bg = t['accent_soft'] if selected else 'transparent'
    return (f'<label style="display: flex; align-items: center; gap: 12px; padding: {pad}; border-radius: 16px; background: {bg}; cursor: pointer; flex: none">'
            f'{lead}<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px">'
            f'<span style="font-size: 16px; line-height: 1.3; font-weight: 700; color: {t["ink"]}">{title}</span>{m}</span>{mark}</label>')


def note(t, text, icon_name='refresh', tone='neutral'):
    """A quiet card in a dialog: what moves over (neutral), what would be lost (danger), what stays hidden (accent)."""
    bg, ink = {'neutral': (t['chip'], t['ink2']), 'danger': (t['danger_soft'], t['danger']),
               'accent': (t['accent_soft'], t['accent_text'])}[tone]
    return (f'<div style="display: flex; gap: 10px; align-items: flex-start; background: {bg}; border-radius: 14px; padding: 12px 14px; '
            f'font-size: 14px; line-height: 1.4; color: {ink}; font-weight: 600; flex: none">'
            f'<span style="flex: none; margin-top: 1px">{icon(icon_name, 18, ink)}</span><span>{text}</span></div>')


def caps(t, text):
    return f'<span style="font-size: 12px; font-weight: 800; letter-spacing: 0.04em; color: {t["muted"]}">{text}</span>'


def grey_card(t, inner):
    return (f'<div style="background: {t["chip"]}; border-radius: 16px; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; '
            f'font-size: 14px; line-height: 1.45; color: {t["ink"]}; flex: none">{inner}</div>')


def group_note(t, text):
    """The read-only note on a group's item opened from your app (accent card with the group icon)."""
    return (f'<p style="margin: 0; display: flex; align-items: flex-start; gap: 10px; border-radius: 16px; background: {t["accent_soft"]}; '
            f'padding: 12px 16px; font-size: 14px; line-height: 1.4; color: {t["accent_text"]}; flex: none">'
            f'<span style="flex: none; margin-top: 1px">{icon("group", 18, t["accent_text"])}</span><span>{text}</span></p>')


def compare_banner(t, text, button='Compare', icon_name='refresh'):
    """Over your copy when its source changed, or when another copy differs: accent card, Compare at the right."""
    return (f'<div style="display: flex; align-items: center; gap: 10px; border-radius: 16px; background: {t["accent_soft"]}; padding: 6px 6px 6px 16px; flex: none">'
            f'<span style="flex: none">{icon(icon_name, 18, t["accent_text"])}</span>'
            f'<span style="flex: 1; min-width: 0; padding: 6px 0; font-size: 14px; line-height: 1.4; color: {t["accent_text"]}; font-weight: 600">{text}</span>'
            f'{kit.button(t, button, "tertiary", size="sm", on=t["accent_soft"])}</div>')


def source_tabs(t, items, sel):
    """One tab per source (Yours, groups by name, twins): the same switch a clone's and a twin's page use."""
    return f'<div style="flex: none">{kit.segmented(t, items, sel, on_band=False, label="Versions")}</div>'


def actions(t, copy=False, same=False, move=False, detach=False, drop=False):
    """The clone triggers under the tabs, right-aligned small text buttons (the item pages have no ⋯)."""
    b = []
    if copy:
        b.append(kit.button(t, 'Copy to…', 'tertiary', icon_name='copy', size='sm'))
    if same:
        b.append(kit.button(t, 'Same as…', 'tertiary', icon_name='link', size='sm'))
    if move:
        b.append(kit.button(t, 'Move to…', 'tertiary', icon_name='move-to', size='sm'))
    if detach:
        b.append(kit.button(t, 'Detach', 'tertiary', icon_name='unlink', size='sm'))
    if drop:
        b.append(kit.button(t, 'Drop my copy', 'danger_text', icon_name='undo', size='sm'))
    return f'<div style="display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0 4px; flex: none">{"".join(b)}</div>'


def chip(t, text, tone):
    return kit.badge(t, text, {'neutral': 'neutral', 'accent': 'accent', 'warn': 'warn'}[tone])


def family(t, rows, send=True):
    """Copies you can see: this one first, then the rest (Yours, then groups by name), each with a status chip.
    rows: (place 'mine'|'group', title, meta, chip (text, tone) | None, href)."""
    out = []
    for i, (place, title, meta, ch, href) in enumerate(rows):
        tr = (chip(t, *ch) if ch else '') + (kit.chevron(t) if href else '')
        tr = f'<span style="display: flex; align-items: center; gap: 6px">{tr}</span>' if tr else None
        out.append(kit.row(t, title, meta, tr, leading=disc(t, place), href='#' if href else None, last=i == len(rows) - 1))
    foot = kit.button(t, 'Send mine…', 'primary', icon_name='share', full=True) if send else ''
    return F.label(t, 'Copies you can see', 6) + kit.list_group(t, out, 'Copies you can see') + foot


def option(t, side, changed, text, picked):
    """One side of a compare card: Yours / Theirs, 'changed' in accent, ringed when picked."""
    ring = f'box-shadow: inset 0 0 0 2px {t["accent"]};' if picked else f'box-shadow: inset 0 0 0 1px {t["hairline"]};'
    ch = f' <span style="color: {t["accent_text"]}; font-weight: 800">changed</span>' if changed else ''
    return (f'<button type="button" aria-pressed="{"true" if picked else "false"}" style="flex: 1; min-width: 0; text-align: left; border: 0; '
            f'border-radius: 12px; background: {t["surface"]}; {ring} padding: 10px 12px; display: flex; flex-direction: column; gap: 3px; cursor: pointer">'
            f'<span style="font-size: 12px; font-weight: 700; color: {t["muted"]}">{side}{ch}</span>'
            f'<span style="font-size: 15px; line-height: 1.35; font-weight: 700; color: {t["ink"]}">{text}</span></button>')


def compare_card(t, field, status, mine, theirs, pick, mine_changed=False, theirs_changed=True):
    """A field in Compare: its name, how it stands (Only theirs changed · Both changed: pick · New on theirs), the two sides."""
    tone = 'warn' if status.startswith('Both') else 'done'
    return (f'<div style="background: {t["chip"]}; border-radius: 16px; padding: 12px; display: flex; flex-direction: column; gap: 10px; flex: none">'
            f'<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 2px">'
            f'<span style="font-size: 15px; font-weight: 800; color: {t["ink"]}">{field}</span>{kit.badge(t, status, tone)}</div>'
            f'<div style="display: flex; gap: 8px">{option(t, "Yours", mine_changed, mine, pick == "mine")}'
            f'{option(t, "Theirs", theirs_changed, theirs, pick == "theirs")}</div></div>')


# --------------------------------------------------------------------------
# the dialogs (each returns F.dialog(...) html, to pass as a board's overlay)
# --------------------------------------------------------------------------

def make_mine(t, label, kind='figure', follows='Your routine Week 4 loop and your practice of it switch to your copy.', size=None):
    """Edit on a group's thing you only read: asks once (board C2 p1)."""
    got = caps(t, 'YOU GET') + f'<span>{GETS[kind]}</span>'
    if kind in STAYS:
        got += caps(t, 'STAYS SALSA TUESDAYS’').replace('<span style="', '<span style="margin-top: 8px; ', 1) + f'<span>{STAYS[kind]}</span>'
    inner = grey_card(t, got) + note(t, follows)
    if size:
        inner += f'<span style="font-size: 13px; color: {t["muted"]}; padding: 0 4px">{size}</span>'
    foot = (f'<div style="display: flex; gap: 10px">{kit.button(t, "Cancel", "tertiary", on=t["sheet_bg"])}'
            f'<div style="flex: 1">{kit.button(t, "Make it mine", "primary", icon_name="pencil", full=True, on=t["sheet_bg"])}</div></div>')
    return F.dialog(t, f'Make {label} yours?', inner, sub='Editing makes your own copy. The class’s stays as it is.', footer=foot)


def compare(t, place, cards, button='Take what’s picked', sub='Since you last took from it. Pick where both of you changed something.'):
    """Compare with a source, field by field (board C2 p4). cards: compare_card() html."""
    foot = kit.button(t, button, 'primary', full=True, on=t['sheet_bg'])
    return F.dialog(t, f'Compare with {place}’', ''.join(cards), sub=sub, footer=foot)


def send(t, targets, deletes=(), kind_line='Changes land on the groups’ own figure: members’ practice and lesson links stay.', n=2):
    """Send mine (board C3 p2). targets: (title, meta, ticked); deletes: (title, meta)."""
    rows = ''.join(choice(t, disc(t), ti, me, check_mark(t, on), pad='10px 8px') for ti, me, on in targets)
    rows += ''.join(choice(t, disc(t, 'trash'), ti, me, check_mark(t, False), pad='10px 8px') for ti, me in deletes)
    inner = rows + note(t, kind_line)
    foot = kit.button(t, f'Send to {n} groups', 'primary', full=True, on=t['sheet_bg'])
    return F.dialog(t, 'Send your changes', inner, sub='Adds and changes travel. Deletes only if you tick them.', footer=foot)


def send_pick(t, place, card, line):
    """A field both changed, asked on a second level of Send (board C3 p3)."""
    inner = card + note(t, line, 'warning')
    foot = kit.button(t, 'Send', 'primary', full=True, on=t['sheet_bg'])
    return F.dialog(t, f'{place}: both changed the timing', inner, back=True,
                    sub='You and Rueda club both changed it since you were last in step.', footer=foot)


def copy_to(t, name, targets, goes, already=None, sub='The group gets a copy. You keep yours.', button='Copy'):
    """Copy to… (board C4 p2). targets: (place 'mine'|'group', title, meta, chosen)."""
    rows = ''.join(choice(t, disc(t, p), ti, me, radio_mark(t, on), selected=on) for p, ti, me, on in targets)
    card = caps(t, 'WHAT GOES') + f'<span>{goes}</span>'
    if already:
        card += caps(t, 'ALREADY THERE').replace('<span style="', '<span style="margin-top: 8px; ', 1) + f'<span>{already}</span>'
    foot = kit.button(t, button, 'primary', icon_name='copy', full=True, on=t['sheet_bg'])
    return F.dialog(t, f'Copy {name} to…', rows + grey_card(t, card), sub=sub, footer=foot)


def which(t, label, place, versions):
    """Which twin goes (board C4 p4), a level over Copy to…. versions: (place, title, meta, chosen)."""
    rows = ''.join(choice(t, disc(t, p), ti, me, radio_mark(t, on), selected=on) for p, ti, me, on in versions)
    inner = rows + note(t, 'They’re twins in your app. Only one goes; the group never gets twins.', 'link')
    foot = kit.button(t, 'Continue', 'primary', full=True, on=t['sheet_bg'])
    return F.dialog(t, f'Which {label}?', inner, back=True,
                    sub=f'You see two versions of this figure. Which one goes to {place}?', footer=foot)


def keep_switch(t, keep):
    """Keep mine as well | Use the group’s, a small two-way switch inside a row."""
    def seg(text, on):
        st = (f'background: {t["surface"]}; color: {t["accent_text"]}; box-shadow: 0 1px 3px rgba(0,0,0,0.12);' if on
              else f'background: none; color: {t["ink2"]};')
        return (f'<button type="button" aria-pressed="{"true" if on else "false"}" style="flex: 1; height: 36px; border: 0; border-radius: 18px; {st} '
                f'font-size: 14px; font-weight: {800 if on else 600}; cursor: pointer">{text}</button>')
    return (f'<div role="group" style="display: flex; gap: 2px; padding: 3px; border-radius: 21px; background: {t["chip"]}">'
            f'{seg("Keep mine as well", keep)}{seg("Use the group’s", not keep)}</div>')


def move_to_group(t, lesson, place, items):
    """Move a lesson to a group (board C4 p3). items: (label, reason, keep)."""
    rows = ''
    for i, (lab, why, keep) in enumerate(items):
        hair = f'border-top: 1px solid {t["hairline"]}; ' if i else ''
        rows += (f'<div style="{hair}padding: 12px 0 10px; display: flex; flex-direction: column; gap: 8px; flex: none">'
                 f'<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px">'
                 f'<span style="font-size: 16px; font-weight: 700; color: {t["ink"]}">{lab}</span>'
                 f'<span style="font-size: 12px; font-weight: 700; color: {t["muted"]}">{why}</span></div>{keep_switch(t, keep)}</div>')
    inner = rows + note(t, '“Use the group’s”: your copy is dropped, and your other lessons and routines use the group’s.', 'undo')
    foot = kit.button(t, 'Move as a draft', 'primary', full=True, on=t['sheet_bg'])
    return F.dialog(t, f'Move {lesson} to {place}', inner, sub='The lesson lives in the group and leaves your lessons. What it brings:', footer=foot)


def drop(t, versions, lost, send_first=True, follows=None):
    """Drop my copy (board C5). versions: (title, meta, chosen) — several: you pick; one: just named (follows)."""
    inner = ''
    if versions:
        inner += F.label(t, 'Use instead') + ''.join(choice(t, disc(t), ti, me, radio_mark(t, on), selected=on) for ti, me, on in versions)
    if follows:
        inner += note(t, follows)
    inner += note(t, lost, 'warning', 'danger')
    foot = ''
    if send_first:
        foot += kit.button(t, 'Send mine first', 'secondary', icon_name='share', full=True, on=t['sheet_bg'])
    foot += kit.button(t, 'Drop my copy', 'danger', icon_name='undo', full=True, on=t['sheet_bg'])
    sub = ('Your routines and practice move to the one you pick.' if versions
           else 'You go back to the class’s version, read-only. Your copy is archived.')
    return F.dialog(t, 'Drop your copy?', inner, sub=sub, footer=foot)


def detach(t, place='Salsa Tuesdays', kind='figure'):
    """Detach (board C8 p1)."""
    inner = (note(t, 'Your copy stays yours, as it is, on its own. To still show it with theirs, use Same as…', 'link')
             + note(t, 'No more “updated since”, and no Take theirs to hit by mistake.'))
    foot = (kit.button(t, 'Detach', 'primary', icon_name='unlink', full=True, on=t['sheet_bg'])
            + kit.button(t, 'Cancel', 'tertiary', full=True, on=t['sheet_bg']))
    return F.dialog(t, f'Stop following {place}?', inner, sub=f'In a group, Detach just makes it an ordinary group {kind}.', footer=foot)


def same_as(t, label, rows, kind='figure'):
    """Same as… (board C7 p1). rows: (place, title, meta, ticked)."""
    inner = (kit.search_field(t, f'Search your {kind}s', 'Enchufla', 'filled')
             + ''.join(choice(t, disc(t, p), ti, me, check_mark(t, on), pad='8px 8px') for p, ti, me, on in rows)
             + note(t, f'Twins show as one {kind}. They never sync, and only you see the grouping.', 'link'))
    foot = kit.button(t, 'Mark as the same', 'primary', icon_name='link', full=True, on=t['sheet_bg'])
    return F.dialog(t, f'{label} is the same as…', inner, footer=foot)


def work_in(t, chosen=None):
    """Work in (the group button's sheet): Mine and each group you own or edit, one tap each."""
    def r(p, title, meta, on):
        mark = icon('check', 22, t['accent'], stroke=2.5) if on else ''
        return choice(t, disc(t, p), title, meta, mark, selected=on)
    inner = (r('mine', 'Mine', 'Your own moves, lessons, songs', chosen is None)
             + r('group', 'Salsa Tuesdays', 'Owner · 14 people', chosen == 'Salsa Tuesdays')
             + r('group', 'Rueda club', 'Editor · 6 people', chosen == 'Rueda club'))
    return F.dialog(t, 'Work in', inner, width=480)
