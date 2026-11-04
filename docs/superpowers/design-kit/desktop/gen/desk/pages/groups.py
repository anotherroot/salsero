"""Desktop boards · Groups: the list of groups beside the open group (2A), its pages in the pane, every popup as a dialog (4B).

Words from the built app: src/routes/[dance]/groups/**, src/lib/components/teams/, src/lib/teams/view.ts,
leave-view.ts, add.ts, deleted.ts, history.ts, src/lib/clash/clash.ts.
"""
import importlib.util
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import frame as F  # noqa: E402
from frame import kit, ts, icon, CREAM  # noqa: E402

SCREENS = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'screens')


def mobile(name):
    key = f'm_{name}'
    if key in sys.modules:
        return sys.modules[key]
    spec = importlib.util.spec_from_file_location(key, os.path.join(SCREENS, name + '.py'))
    mod = importlib.util.module_from_spec(spec)
    sys.modules[key] = mod
    spec.loader.exec_module(mod)
    return mod


ML = mobile('lessons')

SECTION = ('groups', 'Groups')

OWN = 'Salsa Tuesdays'
MEM = 'Salsa nadaljevalna'
EDIT = 'Cuban style workshop'


def salsa(t):
    return t['dance'] == 'salsa'


def names(t):
    """The three groups, by dance."""
    if salsa(t):
        return OWN, MEM, EDIT
    return 'Bachata Thursdays', 'Bachata sensual 2', 'Dominican footwork'


# --------------------------------------------------------------------------
# the list column
# --------------------------------------------------------------------------

def tile(t, name='group'):
    return (f'<span aria-hidden="true" style="width: 48px; height: 48px; border-radius: 12px; background: {t["accent_soft"]}; display: flex; '
            f'align-items: center; justify-content: center; flex: none">{icon(name, 24, t["accent_text"])}</span>')


def group_row(t, name, meta, badges='', last=False, deleted=False):
    """Badges sit beside the name (the 360 column has no room for them before the chevron)."""
    tr = (kit.button(t, 'Restore', 'secondary', size='sm', on=t['surface'], aria=f'Restore {name}') if deleted
          else f'<span style="display: flex; margin-left: 2px">{kit.chevron(t)}</span>')
    return kit.row(t, titled(t, name, badges), meta, tr, leading=tile(t), href=None if deleted else '#', last=last, min_h=72)


def group_list(t, lit=None, member_new=True, working=None, deleted=False, own_new=False):
    """Your groups in this dance. lit: index of the open one; working: index marked "Working in" (group mode)."""
    own, mem, ed = names(t)
    items = [(own, '14 people · Owner', '1 new' if own_new else ''),
             (mem, '22 people · Member', '2 new' if member_new else ''),
             (ed, '6 people · Editor', '')]
    rows = []
    for i, (n, m, nw) in enumerate(items):
        on = i == lit  # a soft pill vanishes on the lit row's tint: solid there
        b = (kit.badge(t, 'Working in', 'accent', solid=on) if working == i else '') + (kit.badge(t, nw, 'accent', solid=on) if nw else '')
        last = i == len(items) - 1 and not deleted
        h = group_row(t, n, m, b, last=last)
        rows.append(F.lit(t, h) if i == lit else h)
    if deleted:
        d = group_row(t, 'Summer bootcamp' if salsa(t) else 'Summer sensual', '9 people · Owner',
                      kit.badge(t, 'Deleted'), last=True, deleted=True)
        rows.append(F.lit(t, d) if lit == 3 else d)
    return kit.list_group(t, rows, label='Your groups')


def band(t, body, overlay='', dot=False, group=None):
    return F.frame(t, 'Groups', 'Groups', body, sub='Share lessons with a class', right=F.act(t, 'plus', 'New group'),
                   overlay=overlay, dot=dot, group=group)


# --------------------------------------------------------------------------
# the open group's pane
# --------------------------------------------------------------------------

def titled(t, title, *badges):
    b = ''.join(badges)
    return (f'<span style="display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px 8px">'
            f'<span>{title}</span>{b}</span>')


def lesson_row(t, wd, day, title, meta, c, draft=False, new=False, aside=None, last=False):
    badges = (kit.badge(t, 'Draft', 'warn') if draft else '') + (kit.badge(t, 'New', 'accent') if new else '')
    m = (f'<span style="display: block">{meta}</span>' if meta else '') + ML.counts(t, *c)
    tr = aside if aside is not None else kit.chevron(t)
    return kit.row(t, titled(t, title, badges), m, tr, leading=ML.date_tile(t, wd, day), href='#', min_h=84, last=last)


def added(t):
    return (f'<span style="display: flex; align-items: center; gap: 4px; padding: 0 6px; font-size: 14px; font-weight: 800; color: {t["done"]}; flex: none">'
            f'Added{icon("check", 18, t["done"], stroke=2.5)}</span>')


def add_btn(t, title):
    return kit.button(t, 'Add', 'secondary', size='sm', on=t['surface'], aria=f'Add {title}')


DRAFTS = [('TUE', '3', 'Cross-body variations', '1 video · 380 MB', (4, 1, 2))]
PUBLISHED = [('TUE', '27', 'Enchufla doble and the hook', '2 videos · 640 MB', (6, 1, 3)),
             ('TUE', '20', 'Shines: suzie q and the mambo', '1 video · 290 MB', (3, 0, 1)),
             ('TUE', '13', 'Dile que no, three ways', '1 video · 410 MB', (5, 1, 3)),
             ('TUE', '6', 'Basic timing on 1', None, (2, 0, 0))]
B_DRAFTS = [('THU', '5', 'Hammerlock entries', '1 video · 380 MB', (4, 1, 2))]
B_PUBLISHED = [('THU', '29', 'Cuddle turn and the wrap', '2 videos · 640 MB', (6, 1, 3)),
               ('THU', '22', 'Footwork: the side basic', '1 video · 290 MB', (3, 0, 1)),
               ('THU', '15', 'Sensual waves, step by step', '1 video · 410 MB', (5, 1, 3)),
               ('THU', '8', 'Basic timing', None, (2, 0, 0))]


def lessons(t):
    return (DRAFTS, PUBLISHED) if salsa(t) else (B_DRAFTS, B_PUBLISHED)


def lessons_block(t, can_edit=True, member=False):
    drafts, pub = lessons(t)
    rows = []
    allrows = ([(d, True) for d in drafts] if can_edit else []) + [(p, False) for p in pub]
    for i, ((wd, day, title, meta, c), draft) in enumerate(allrows):
        last = i == len(allrows) - 1
        if draft:
            aside = None
        elif member:
            aside = add_btn(t, title) if i in (0, 2) else added(t)
        else:
            aside = added(t) if i == 2 else add_btn(t, title) if i == 1 else None
        new = member and i in (0, 2)
        rows.append(lesson_row(t, wd, day, title, meta, c, draft=draft, new=new, aside=aside, last=last))
    new_lesson = kit.button(t, 'New lesson', 'tertiary', icon_name='plus', size='sm') if can_edit else None
    return F.label(t, 'Lessons', trailing=new_lesson) + kit.list_group(t, rows, label='Lessons')


def storage_row(t, text='Uses 1.2 GB of 2.7 GB'):
    return (f'<a href="#" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 52px; box-sizing: border-box; '
            f'padding: 12px 14px 12px 16px; border-radius: 16px; background: {t["surface"]}; text-decoration: none; flex: none">'
            f'<span style="font-size: 15px; font-weight: 600; color: {t["ink"]}">{text}</span>{kit.chevron(t)}</a>')


def play_btn(t, name):
    return (f'<button type="button" aria-label="Play a sample of {name}" style="width: 44px; height: 44px; border-radius: 22px; border: 0; background: {t["accent_soft"]}; '
            f'display: flex; align-items: center; justify-content: center; flex: none; cursor: pointer">{icon("play", 20, t["accent_text"], filled=True, bg=t["accent_soft"])}</button>')


def songs(t):
    if salsa(t):
        return [('Vivir mi vida', 'Marc Anthony · Salsa · 4:12', False, True),
                ('Quimbara', 'Celia Cruz · Salsa · 3:05', False, False),
                ('El cantante', 'Héctor Lavoe · Salsa · 5:20', True, False)]
    return [('Propuesta indecente', 'Romeo Santos · Bachata · 4:01', False, True),
            ('Obsesión', 'Aventura · Bachata · 4:13', False, False),
            ('Darte un beso', 'Prince Royce · Bachata · 3:31', True, False)]


def songs_block(t, can_edit=True, top=6):
    rows = []
    items = [s for s in songs(t) if can_edit or not s[2]]
    for i, (n, meta, draft, new) in enumerate(items):
        b = (kit.badge(t, 'Draft', 'warn') if draft else '') + (kit.badge(t, 'New', 'accent') if new and not can_edit else '')
        rows.append(kit.row(t, titled(t, n, b), meta, kit.chevron(t), leading=play_btn(t, n), href='#', last=i == len(items) - 1))
    return F.label(t, f'Class songs · {len(items)}', top=top) + kit.list_group(t, rows, label='Class songs')


def group_pane(t, role='owner', overlay_note=None):
    own, mem, ed = names(t)
    name, people, you = {'owner': (own, 14, 'you own it'), 'editor': (ed, 6, 'you edit it'), 'member': (mem, 22, 'you are a member')}[role]
    can_edit = role != 'member'
    head = F.pane_head(t, name, f'{people} people · {you}', actions=F.tonal(t, 'more', 'Group menu'))
    left = lessons_block(t, can_edit, member=role == 'member')
    right = (storage_row(t, 'Uses 1.2 GB of 2.7 GB' if role == 'owner' else 'Uses 640 MB of 1.2 GB') if can_edit else '') + songs_block(t, can_edit, top=6 if can_edit else 0)
    return F.pane(t, head, F.pane_cols(left, right, ratio=('7fr', '5fr')), label_=name)


def split(t, pane_html, lit=0, **kw):
    return F.split(t, group_list(t, lit=lit, **kw), pane_html, 'Your groups')


# --------------------------------------------------------------------------
# boards: the list and a group
# --------------------------------------------------------------------------

def b_none(t):
    body = F.page('<div style="height: 110px"></div>' + kit.empty_state(
        t, 'group', 'No groups yet', 'Make a group for your class, then share its code. Everyone in it sees the lessons you publish.',
        kit.button(t, 'New group', 'primary', icon_name='plus')), max_w=560)
    return band(t, body)


def b_nothing_open(t):
    pane = F.empty_pane(t, 'group', 'Pick a group', 'Its lessons, class songs and people open here.')
    return band(t, split(t, pane, lit=None), dot=True)


def b_owner(t):
    return band(t, split(t, group_pane(t, 'owner'), lit=0), dot=True)


def b_member(t):
    return band(t, split(t, group_pane(t, 'member'), lit=1), dot=True)


def b_editor(t):
    return band(t, split(t, group_pane(t, 'editor'), lit=2, member_new=False))


def b_working_in(t):
    g = F.in_group(t)
    own = names(t)[0]
    return band(g, F.split(g, group_list(g, lit=0, working=0), group_pane(g, 'owner'), 'Your groups'), group=own)


# --------------------------------------------------------------------------
# the ⋯ menu (a dialog)
# --------------------------------------------------------------------------

def menu_row(t, icon_name, label_, danger=False, last=False):
    c = t['danger'] if danger else t['ink']
    ic = t['danger'] if danger else t['accent_text']
    hair = '' if last else f'border-bottom: 1px solid {t["hairline"]};'
    return (f'<div style="padding-left: 16px"><button type="button" style="width: 100%; display: flex; align-items: center; gap: 12px; min-height: 56px; '
            f'padding: 8px 16px 8px 0; border: 0; {hair} background: none; text-align: left; cursor: pointer">{icon(icon_name, 22, ic)}'
            f'<span style="font-size: 16px; font-weight: 700; color: {c}">{label_}</span></button></div>')


def menu(t, name, rows):
    inner = (f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">'
             + ''.join(menu_row(t, i, l, d, last=k == len(rows) - 1) for k, (i, l, d) in enumerate(rows)) + '</div>')
    return F.dialog(t, name, inner, width=420)


def b_menu_owner(t):
    own = names(t)[0]
    ov = menu(t, own, [('group', 'People', False), ('trash', 'Recently deleted', False), ('link', 'Show code', False),
                       ('edit', 'Rename', False), ('trash', 'Delete group', True)])
    return band(t, split(t, group_pane(t, 'owner'), lit=0), overlay=ov)


def b_menu_editor(t):
    ed = names(t)[2]
    ov = menu(t, ed, [('group', 'People', False), ('trash', 'Recently deleted', False), ('link', 'Show code', False),
                      ('logout', 'Leave group', True)])
    return band(t, split(t, group_pane(t, 'editor'), lit=2, member_new=False), overlay=ov)


# --------------------------------------------------------------------------
# new group, rename, the limit
# --------------------------------------------------------------------------

def name_dialog(t, title, value, state, button_, error=None, placeholder=''):
    err = kit.banner(t, 'error', error) if error else ''
    field = kit.text_field(t, 'Name', value, placeholder=placeholder, state=state, bg=t['field'])
    return F.dialog(t, title, err + field, footer=kit.button(t, button_, 'primary', full=True, on=t['sheet_bg']), width=480)


def b_new_group(t):
    ov = name_dialog(t, 'New group', '', 'focused', 'Create group', placeholder='Salsa nadaljevalna' if salsa(t) else 'Bachata sensual 2')
    return band(t, split(t, group_pane(t, 'owner'), lit=0), overlay=ov)


def b_new_group_limit(t):
    ov = name_dialog(t, 'New group', 'Wednesday beginners', 'filled', 'Create group',
                     error='You can make 2 groups. Ask the admin for more.')
    return band(t, split(t, group_pane(t, 'owner'), lit=0), overlay=ov)


def b_rename(t):
    ov = name_dialog(t, 'Rename group', names(t)[0], 'focused', 'Save')
    return band(t, split(t, group_pane(t, 'owner'), lit=0), overlay=ov)


# --------------------------------------------------------------------------
# the code
# --------------------------------------------------------------------------

def qr(t, size=220, n=29, seed=7):
    """A drawn QR: three finder squares and seeded cells. Ink on white, as a real code needs."""
    rnd = random.Random(seed)
    cell = size / n
    rects = []

    def finder(x, y):
        for k, (s, fill) in enumerate(((7, '#111'), (5, '#fff'), (3, '#111'))):
            o = (7 - s) / 2
            rects.append(f'<rect x="{(x + o) * cell:.2f}" y="{(y + o) * cell:.2f}" width="{s * cell:.2f}" height="{s * cell:.2f}" fill="{fill}"></rect>')
    for y in range(n):
        for x in range(n):
            in_f = (x < 8 and y < 8) or (x >= n - 8 and y < 8) or (x < 8 and y >= n - 8)
            if not in_f and rnd.random() < 0.48:
                rects.append(f'<rect x="{x * cell:.2f}" y="{y * cell:.2f}" width="{cell + 0.3:.2f}" height="{cell + 0.3:.2f}" fill="#111"></rect>')
    finder(0, 0)
    finder(n - 7, 0)
    finder(0, n - 7)
    return (f'<div style="background: #fff; padding: 14px; border-radius: 16px; flex: none; box-shadow: inset 0 0 0 1px {t["hairline"]}">'
            f'<svg role="img" aria-label="QR code for joining {names(t)[0]}" width="{size}" height="{size}" viewBox="0 0 {size} {size}">{"".join(rects)}</svg></div>')


def b_code(t):
    link = 'https://salsa.example/g/SBT7CDRNPM'
    muted = lambda s: f'<p style="margin: 0; text-align: center; font-size: 13px; line-height: 1.4; color: {t["muted"]}">{s}</p>'  # noqa: E731
    inner = (f'<div style="display: flex; flex-direction: column; align-items: center; gap: 14px">{qr(t)}'
             f'<p style="margin: 0; width: 100%; font-size: 14px; color: {t["ink"]}; word-break: break-all; text-align: center">{link}</p>'
             + kit.button(t, 'Copy link', 'primary', icon_name='copy', full=True, on=t['sheet_bg'])
             + muted('Only people who already have an account can join with it.')
             + kit.button(t, 'Make a new code', 'secondary', full=True, on=t['sheet_bg'])
             + muted('The old link and QR stop working. People already in the group stay.') + '</div>')
    return band(t, split(t, group_pane(t, 'owner'), lit=0), overlay=F.dialog(t, 'Group code', inner, width=480))


# --------------------------------------------------------------------------
# people
# --------------------------------------------------------------------------

PEOPLE = [('Tilen Koren', 'owner'), ('Ana Kovač', 'editor'), ('Luka Novak', 'editor'), ('Maja Horvat', 'member'),
          ('Nina Zupan', 'member'), ('Jure Kos', 'member'), ('Eva Mlakar', 'member'), ('Marko Vidmar', 'member'),
          ('Sara Krajnc', 'member')]


def people_list(t, owner=True):
    rows = ''
    for i, (n, r) in enumerate(PEOPLE):
        hair = '' if i == len(PEOPLE) - 1 else f'border-bottom: 1px solid {t["hairline"]};'
        b = kit.badge(t, r.capitalize(), 'accent' if r == 'owner' else 'neutral')
        more = (kit.icon_button(t, 'more', f'Actions for {n}', 'bare', color=t['muted'], on=t['surface'])
                if owner and r != 'owner' else '<span style="width: 6px"></span>')
        rows += (f'<li style="list-style: none; padding-left: 16px"><div style="display: flex; align-items: center; gap: 12px; min-height: 56px; '
                 f'padding: 6px 6px 6px 0; box-sizing: border-box; {hair}"><span style="flex: 1; min-width: 0; {ts("title", t["ink"])}">{n}</span>{b}{more}</div></li>')
    return f'<ul aria-label="People" style="margin: 0; padding: 0; background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">{rows}</ul>'


def sub_pane(t, title, sub, body, label_=None):
    head = F.pane_head(t, title, sub, back=True)
    body = f'<div style="max-width: 720px; display: flex; flex-direction: column; gap: 8px">{body}</div>'
    return F.pane(t, head, F.pane_body(body, max_w=None), label_=label_ or title)


def people_pane(t, owner=True):
    own = names(t)[0]
    return sub_pane(t, 'People', f'{own} · 14 people', people_list(t, owner))


def b_people(t):
    return band(t, split(t, people_pane(t), lit=0))


def b_person(t):
    rows = [('edit', 'Make editor', False), ('key', 'Hand over the group', False), ('trash', 'Remove', True)]
    inner = (f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">'
             + ''.join(menu_row(t, i, l, d, last=k == 2) for k, (i, l, d) in enumerate(rows)) + '</div>')
    return band(t, split(t, people_pane(t), lit=0), overlay=F.dialog(t, 'Maja Horvat', inner, width=420))


def cancel(t):
    return kit.button(t, 'Cancel', 'tertiary', size='sm', on=t['raised'])


def b_hand_over(t):
    q = F.question(t, 'Hand over to Luka Novak?', 'They become the owner and you become an editor. Only they can take it back.',
                   [cancel(t), kit.button(t, 'Hand over', 'danger', size='sm', on=t['raised'])], 'key', 'danger')
    return band(t, split(t, people_pane(t), lit=0), overlay=q)


def b_remove(t):
    q = F.question(t, 'Remove Maja Horvat?', 'They leave the group and keep copies of what they had.',
                   [cancel(t), kit.button(t, 'Remove', 'danger', size='sm', on=t['raised'])], 'trash', 'danger')
    return band(t, split(t, people_pane(t), lit=0), overlay=q)


# --------------------------------------------------------------------------
# leaving, deleting
# --------------------------------------------------------------------------

def radio_dot(t, on):
    return kit._check_box(t, 'radio', on, 'default')


def leave_option(t, icon_name, label_, meta, on, danger=False, last=False):
    hair = '' if last else f'border-bottom: 1px solid {t["hairline"]};'
    ic = t['danger'] if danger else t['accent_text']
    m = f'<span style="font-size: 13px; line-height: 1.35; color: {t["muted"]}">{meta}</span>' if meta else ''
    return (f'<label style="display: block; padding-left: 16px; cursor: pointer"><div style="display: flex; align-items: center; gap: 12px; min-height: 64px; '
            f'padding: 9px 16px 9px 0; box-sizing: border-box; {hair}">{icon(icon_name, 22, ic)}'
            f'<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="{ts("title", t["ink"])}">{label_}</span>{m}</span>'
            f'<input type="radio" name="keep"{" checked" if on else ""} style="{kit.SR}">{radio_dot(t, on)}</div></label>')


def b_leave(t):
    mem = names(t)[1]
    fig = 'Enchufla · Doble and Setenta · Basic' if salsa(t) else 'Hammerlock · Basic and Cuddle turn · Wrap'
    rout = 'Tuesday combo' if salsa(t) else 'Thursday combo'
    opts = (leave_option(t, 'copy', 'Keep everything', '6 lessons, 14 figures, 2 routines, 3 songs · 1.4 GB counted to you', True)
            + leave_option(t, 'list', 'Choose what to keep', None, False)
            + leave_option(t, 'route', 'Keep only what my routines use', f'{fig}, which {rout} uses. Everything else goes', False, True, True))
    inner = (f'<fieldset style="margin: 0; padding: 0; border: 0; min-width: 0"><legend style="{kit.SR}">What to keep</legend>'
             f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden">{opts}</div></fieldset>'
             f'<p style="margin: 0; padding: 0 16px; font-size: 13px; line-height: 1.4; color: {t["muted"]}">What you keep becomes your copies. Rejoin later and they reconnect.</p>'
             + kit.banner(t, 'warning', 'That takes you over your 1 GB. You can still practise; new uploads wait until you’re under.'))
    ov = F.dialog(t, f'Leave {mem}?', inner, sub='After leaving you see nothing of the group. You keep copies of what you choose.',
                  footer=kit.button(t, 'Leave', 'danger', full=True, on=t['sheet_bg']))
    return band(t, split(t, group_pane(t, 'member'), lit=1), overlay=ov)


def check_row(t, name, meta, on, locked=False, last=False):
    hair = '' if last else f'border-bottom: 1px solid {t["hairline"]};'
    box = kit._check_box(t, 'checkbox', on, 'disabled' if locked else 'default')
    return (f'<label style="display: block; padding-left: 16px"><div style="display: flex; align-items: center; gap: 12px; min-height: 56px; '
            f'padding: 8px 16px 8px 0; box-sizing: border-box; {hair}"><input type="checkbox"{" checked" if on else ""}{" disabled" if locked else ""} style="{kit.SR}">{box}'
            f'<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="{ts("title", t["ink"])}">{name}</span>'
            f'<span style="font-size: 13px; color: {t["muted"]}">{meta}</span></span></div></label>')


def checks(t, rows):
    return (f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">'
            + ''.join(check_row(t, *r, last=i == len(rows) - 1) for i, r in enumerate(rows)) + '</div>')


def b_leave_choose(t):
    mem = names(t)[1]
    if salsa(t):
        les = [('Enchufla doble and the hook', '27 Oct · 640 MB', True), ('Shines: suzie q and the mambo', '20 Oct · 290 MB', False),
               ('Dile que no, three ways', '13 Oct · 410 MB', False)]
        rts = [('Tuesday combo', '6 slots · 1 recording', True)]
        fig = [('Enchufla · Doble', 'In Enchufla doble and the hook', True, True), ('Setenta · Basic', 'Used by your routine', True, True),
               ('Dile que no · Con vuelta', '2 recordings · 88 MB', False, False)]
    else:
        les = [('Cuddle turn and the wrap', '29 Oct · 640 MB', True), ('Footwork: the side basic', '22 Oct · 290 MB', False),
               ('Sensual waves, step by step', '15 Oct · 410 MB', False)]
        rts = [('Thursday combo', '6 slots · 1 recording', True)]
        fig = [('Cuddle turn · Wrap', 'In Cuddle turn and the wrap', True, True), ('Hammerlock · Basic', 'Used by your routine', True, True),
               ('Sensual wave · Body roll', '2 recordings · 88 MB', False, False)]
    inner = (F.label(t, 'Lessons · 3') + checks(t, [(n, m, on) for n, m, on in les])
             + F.label(t, 'Routines · 1', 4) + checks(t, [(n, m, on) for n, m, on in rts])
             + F.label(t, 'Figures · 3', 4) + checks(t, [(n, m, on, lk) for n, m, on, lk in fig]))
    ov = F.dialog(t, 'Choose what to keep', inner, back=True, footer=kit.button(t, 'Leave and keep 4', 'danger', full=True, on=t['sheet_bg']))
    return band(t, split(t, group_pane(t, 'member'), lit=1), overlay=ov)


def b_delete(t):
    own = names(t)[0]
    q = F.question(t, f'Delete {own}?', 'Everyone loses its lessons. You can restore it for 30 days.',
                   [cancel(t), kit.button(t, 'Delete group', 'danger', size='sm', on=t['raised'])], 'trash', 'danger')
    return band(t, split(t, group_pane(t, 'owner'), lit=0), overlay=q)


def b_deleted_group(t):
    name = 'Summer bootcamp' if salsa(t) else 'Summer sensual'
    card = (f'<div style="display: flex; align-items: center; gap: 12px; border-radius: 16px; background: {t["surface"]}; padding: 12px 12px 12px 16px; flex: none">'
            f'<span style="flex: 1; font-size: 15px; font-weight: 600; color: {t["ink"]}">Deleted</span>'
            f'{kit.button(t, "Restore", "secondary", size="sm", on=t["surface"])}</div>'
            f'<p style="margin: 0; padding: 0 16px; font-size: 13px; line-height: 1.4; color: {t["muted"]}">Its members keep what they have until 2 Dec, then get copies of everything.</p>')
    head = F.pane_head(t, name, '9 people · you own it')
    card = f'<div style="max-width: 720px; display: flex; flex-direction: column; gap: 8px">{card}</div>'
    pane = F.pane(t, head, F.pane_body(card, max_w=None), label_=name)
    return band(t, F.split(t, group_list(t, lit=3, deleted=True), pane, 'Your groups'))


# --------------------------------------------------------------------------
# the group's space, Recently deleted, History
# --------------------------------------------------------------------------

def meter(t, pct):
    return (f'<div role="meter" aria-label="Space used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="{pct}" '
            f'style="height: 8px; border-radius: 4px; background: {t["chip"]}; overflow: hidden; flex: none; margin: 0 16px">'
            f'<div style="width: {pct}%; height: 8px; border-radius: 4px; background: {t["accent"]}"></div></div>')


def storage_list(t):
    s = salsa(t)
    items = [('Lesson video', False, f'Lesson · {"Enchufla doble and the hook" if s else "Cuddle turn and the wrap"}', '412 MB', True),
             ('Lesson video', False, f'Lesson · {"Dile que no, three ways" if s else "Sensual waves, step by step"}', '298 MB', True),
             ('Lesson video', False, f'Lesson · {"Shines: suzie q and the mambo" if s else "Footwork: the side basic"}', '210 MB', True),
             ('Recording', False, 'Enchufla · Doble' if s else 'Cuddle turn · Wrap', '96 MB', True),
             ('Lesson video', True, f'Lesson · {"Pachanga warm-up" if s else "Bachata warm-up"}', '74 MB', True),
             ('Vivir mi vida' if s else 'Propuesta indecente', False, 'Song · shared with the class', '9.8 MB', False)]
    rows = ''
    for i, (title, archived, ctx, size, deletable) in enumerate(items):
        badge = kit.badge(t, 'archived') if archived else ''
        hair = '' if i == len(items) - 1 else f'border-bottom: 1px solid {t["hairline"]};'
        lab = (f'<span style="display: flex; align-items: center; gap: 8px"><span style="{ts("title", t["ink"])}">{title}</span>{badge}</span>'
               f'<span style="font-size: 13px; color: {t["muted"]}">{ctx} · {size}</span>')
        main = f'<a href="#" style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; text-decoration: none">{lab}</a>'
        tr = (kit.button(t, 'Delete', 'danger_text', size='sm', on=t['surface'], aria=f'Delete {title}, {ctx}') if deletable
              else f'<span style="padding-right: 8px; display: flex">{kit.chevron(t)}</span>')
        rows += (f'<li style="list-style: none; padding-left: 16px"><div style="display: flex; align-items: center; gap: 12px; min-height: 64px; '
                 f'padding: 8px 6px 8px 0; box-sizing: border-box; {hair}">{main}{tr}</div></li>')
    return f'<ul style="margin: 0; padding: 0; background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">{rows}</ul>'


def storage_pane(t, asked=False):
    own = names(t)[0]
    ask = (f'<div style="background: {t["surface"]}; border-radius: 16px; flex: none; min-height: 58px; display: flex; align-items: center; padding: 0 16px; '
           f'font-size: 15px; font-weight: 600; color: {t["muted"]}">Asked on 2 Nov · waiting</div>') if asked else (
        f'<button type="button" style="background: {t["surface"]}; border-radius: 16px; border: 0; flex: none; min-height: 58px; display: flex; align-items: center; '
        f'padding: 0 16px; {ts("title", t["ink"])}; text-align: left; cursor: pointer">Ask for more</button>')
    body = (meter(t, 44) + f'<div style="height: 6px"></div>' + ask + F.label(t, 'Biggest first', 14) + storage_list(t)
            + f'<p style="margin: 0; padding: 8px 16px 0; font-size: 13px; line-height: 1.4; color: {t["muted"]}">'
              'A deleted video or recording waits 30 days in Recently deleted and still uses space until then.</p>')
    return sub_pane(t, 'What uses space', f'{own} · Using 1.2 GB of 2.7 GB', body)


def b_storage(t):
    return band(t, split(t, storage_pane(t), lit=0))


def b_ask_more(t):
    inner = (f'<p style="margin: 0; font-size: 14px; line-height: 1.4; color: {t["muted"]}">The admin sees how much the group uses. A note is optional.</p>'
             + kit.textarea(t, 'Note', 'We are 14 now and record every class.', state='filled', rows=3, bg=t['field']))
    ov = F.dialog(t, 'Ask for more', inner, footer=kit.button(t, 'Ask for more', 'primary', full=True, on=t['sheet_bg']), width=480)
    return band(t, split(t, storage_pane(t), lit=0), overlay=ov)


def trash_rows(t):
    s = salsa(t)
    items = [('Video', 'Enchufla doble · side view.mp4' if s else 'Cuddle turn · side view.mp4', 'Ana · 12 min ago', 'deleted for good on 4 Dec', None),
             ('Section', 'Hook turn, slow' if s else 'Wrap, slow', 'Luka · 2 h ago', 'deleted for good on 4 Dec', 'Restore the video first'),
             ('Figure', 'Setenta · Con mano' if s else 'Hammerlock · Double', 'Ana · yesterday', None, None),
             ('Link', 'youtube.com/watch?v=Qx9…', 'Tilen · 3 days ago', 'deleted for good on 1 Dec', None),
             ('Lesson', 'Pachanga warm-up' if s else 'Bachata warm-up', 'Tilen · 6 days ago', None, None)]
    rows = ''
    for i, (kind, lab, by, purge, err) in enumerate(items):
        hair = '' if i == len(items) - 1 else f'border-bottom: 1px solid {t["hairline"]};'
        p = f'<p style="margin: 0; font-size: 13px; color: {t["muted"]}">{purge}</p>' if purge else ''
        e = (f'<p role="alert" style="margin: 4px 0 0; display: flex; gap: 6px; align-items: center; font-size: 13px; font-weight: 700; color: {t["danger"]}">'
             f'{icon("warning", 16, t["danger"])}{err}</p>') if err else ''
        rows += (f'<li style="list-style: none; padding-left: 16px"><div style="display: flex; align-items: center; gap: 12px; min-height: 56px; '
                 f'padding: 10px 14px 10px 0; box-sizing: border-box; {hair}"><div style="flex: 1; min-width: 0">'
                 f'<p style="margin: 0; font-size: 12px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: {t["muted"]}">{kind}</p>'
                 f'<p style="margin: 0; font-size: 15px; font-weight: 700; color: {t["ink"]}">{lab}</p>'
                 f'<p style="margin: 0; font-size: 13px; color: {t["muted"]}">{by}</p>{p}{e}</div>'
                 f'{kit.button(t, "Restore", "secondary", size="sm", on=t["surface"], aria=f"Restore {kind} {lab}")}</div></li>')
    return f'<ul aria-label="Deleted, newest first" style="margin: 0; padding: 0; background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">{rows}</ul>'


def b_trash(t):
    own = names(t)[0]
    return band(t, split(t, sub_pane(t, 'Recently deleted', own, trash_rows(t)), lit=0))


def b_trash_empty(t):
    own = names(t)[0]
    body = '<div style="height: 60px"></div>' + kit.empty_state(
        t, 'trash', 'Nothing deleted', 'What the group’s editors delete or archive waits here. Videos, sections, links and recordings stay 30 days.')
    return band(t, split(t, sub_pane(t, 'Recently deleted', own, body), lit=0))


def history_rows(t):
    s = salsa(t)
    fig = 'Enchufla doble' if s else 'Cuddle turn wrap'
    items = [('Ana · changed the notes', 'Was: Watch the hook on 5. Left hand stays low until 7.', '12 min ago', True, False),
             (f'Ana · moved \'{fig}\' 1.2 s', None, '15 min ago', False, False),
             ('Luka · added a section', None, '2 h ago', False, False),
             ('Luka · removed a section \'Hook turn, slow\'' if s else 'Luka · removed a section \'Wrap, slow\'', None, '2 h ago', False, True),
             ('Ana · changed the title', 'Was: Enchufla and the hook' if s else 'Was: Cuddle turn', 'yesterday', True, False),
             ('Tilen · published the lesson', None, '27 Oct', False, False),
             ('Tilen · made the lesson', None, '27 Oct', False, False)]
    rows = ''
    for i, (line, was, when, restore, deleted) in enumerate(items):
        hair = '' if i == len(items) - 1 else f'border-bottom: 1px solid {t["hairline"]};'
        w = f'<p style="margin: 0; font-size: 13px; color: {t["muted"]}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{was}</p>' if was else ''
        d = (f'<a href="#" style="font-size: 13px; font-weight: 800; color: {t["accent_text"]}; text-decoration: underline">In Recently deleted</a>') if deleted else ''
        r = kit.button(t, 'Restore', 'secondary', size='sm', on=t['surface']) if restore else ''
        rows += (f'<li style="list-style: none; padding-left: 16px"><div style="display: flex; align-items: center; gap: 12px; min-height: 56px; '
                 f'padding: 10px 14px 10px 0; box-sizing: border-box; {hair}"><div style="flex: 1; min-width: 0">'
                 f'<p style="margin: 0; font-size: 15px; font-weight: 700; color: {t["ink"]}">{line}</p>{w}'
                 f'<p style="margin: 0; font-size: 13px; color: {t["muted"]}">{when}</p>{d}</div>{r}</div></li>')
    return f'<ul aria-label="Changes, newest first" style="margin: 0; padding: 0; background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">{rows}</ul>'


def b_history(t):
    own = names(t)[0]
    title = lessons(t)[1][0][2]
    pane = sub_pane(t, 'History', f'{title} · {own}', history_rows(t))
    return band(t, split(t, pane, lit=0))


# --------------------------------------------------------------------------
# Add, a clash, deleted under you
# --------------------------------------------------------------------------

def add_row(t, icon_name, name, kind, on, last=False):
    hair = '' if last else f'border-bottom: 1px solid {t["hairline"]};'
    tile_ = (f'<span aria-hidden="true" style="width: 40px; height: 40px; border-radius: 12px; background: {t["accent_soft"]}; display: flex; '
             f'align-items: center; justify-content: center; flex: none">{icon(icon_name, 20, t["accent_text"])}</span>')
    return (f'<label style="display: block; padding-left: 16px; cursor: pointer"><div style="display: flex; align-items: center; gap: 12px; min-height: 60px; '
            f'padding: 8px 16px 8px 0; box-sizing: border-box; {hair}">{tile_}'
            f'<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px"><span style="{ts("title", t["ink"])}">{name}</span>'
            f'<span style="font-size: 13px; color: {t["muted"]}">{kind}</span></span>'
            f'<input type="checkbox"{" checked" if on else ""} style="{kit.SR}">{kit._check_box(t, "checkbox", on, "default")}</div></label>')


def add_group(t, rows):
    return (f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">'
            + ''.join(add_row(t, *r, last=i == len(rows) - 1) for i, r in enumerate(rows)) + '</div>')


def b_add(t):
    s = salsa(t)
    title = lessons(t)[1][0][2]
    today = [('lessons', title, 'Lesson review', True), ('route', 'Tuesday combo' if s else 'Thursday combo', 'Routine', True),
             ('metronome', 'Hook turn on 5, slow' if s else 'Wrap on 5, slow', 'Drill', True),
             ('metronome', 'Enchufla doble to the song' if s else 'Cuddle turn to the song', 'Drill', True)]
    figs = ([('people', 'Enchufla · Doble', 'Figure', False), ('people', 'Enchufla · Con gancho', 'Figure', False),
             ('people', 'Setenta · Basic', 'Figure', False)] if s else
            [('people', 'Cuddle turn · Wrap', 'Figure', False), ('people', 'Hammerlock · Basic', 'Figure', False),
             ('people', 'Sensual wave · Body roll', 'Figure', False)])
    inner = (F.label(t, 'On Today') + add_group(t, today) + F.label(t, 'Also practise figures', 6) + add_group(t, figs)
             + f'<p style="margin: 0; padding: 0 16px; font-size: 13px; line-height: 1.4; color: {t["muted"]}">'
               'Unticked figures still show in your Moves, under the group. Costs none of your space.</p>')
    ov = F.dialog(t, title, inner, sub='2 videos · 9 sections · 5 figures · 1 routine · 2 drills',
                  footer=kit.button(t, 'Add', 'primary', full=True, on=t['sheet_bg']))
    return band(t, split(t, group_pane(t, 'member'), lit=1), overlay=ov, dot=True)


def cap(t, text, for_=None):
    tag = 'label' if for_ else 'span'
    f = f' for="{for_}"' if for_ else ''
    return (f'<{tag}{f} style="display: block; margin-bottom: 4px; padding-left: 4px; font-size: 12px; font-weight: 800; letter-spacing: 0.04em; '
            f'text-transform: uppercase; color: {t["muted"]}">{text}</{tag}>')


def box(t, text):
    return (f'<div style="border-radius: 12px; background: {t["step"]}; padding: 12px 14px; font-size: 15px; line-height: 1.4; color: {t["ink"]}; '
            f'white-space: pre-line">{text}</div>')


def lesson_backdrop(t, ov):
    """What the clash opens over: a group lesson being edited (drawn as the group's pane, the scrim dims it)."""
    return band(t, split(t, group_pane(t, 'owner'), lit=0), overlay=ov)


def b_clash(t):
    theirs = 'Watch the hook on 5. Left hand stays low until 7.\nSlow version at 0:42, the full one at 2:10.'
    mine = 'Watch the hook on 5: the lead’s left hand stays low until 7.\nSlow version at 0:42.'
    inner = (f'<section style="display: flex; flex-direction: column; gap: 8px"><h3 style="margin: 0; font-size: 15px; font-weight: 800; color: {t["ink"]}">Notes</h3>'
             f'<div>{cap(t, "Theirs")}{box(t, theirs)}</div>'
             f'<div>{cap(t, "Yours", "clash-mine")}<textarea id="clash-mine" rows="4" style="width: 100%; box-sizing: border-box; border-radius: 14px; '
             f'border: 2px solid {t["focus"]}; box-shadow: 0 0 0 4px {t["focus_halo"]}; background: {t["field"]}; color: {t["ink"]}; padding: 12px 14px; '
             f'font: 500 15px/1.4 Manrope, sans-serif; resize: none">{mine}</textarea></div></section>'
             f'<p style="margin: 0; font-size: 14px; line-height: 1.4; color: {t["ink2"]}">Also changed: the title. Save mine keeps yours there too.</p>')
    foot = kit.button(t, 'Save mine', 'primary', full=True, on=t['sheet_bg']) + kit.button(t, 'Keep theirs', 'secondary', full=True, on=t['sheet_bg'])
    ov = F.dialog(t, 'Ana changed this · 5 min ago', inner, sub='Theirs is saved. Yours is not yet: change it, then pick one.', footer=foot)
    return lesson_backdrop(t, ov)


def b_gone(t):
    typed = 'Watch the hook on 5: the lead’s left hand stays low until 7.\nSlow version at 0:42.'
    inner = kit.textarea(t, 'Notes', typed, state='filled', rows=4, bg=t['field'])
    ov = F.dialog(t, 'Ana deleted this · 2 min ago', inner, sub='Nothing was saved. Copy what you typed before you close this.',
                  footer=kit.button(t, 'Close', 'primary', full=True, on=t['sheet_bg']))
    return lesson_backdrop(t, ov)


# --------------------------------------------------------------------------
# joining with the code (outside the app's frame)
# --------------------------------------------------------------------------

def card_page(t, title, sub, inner, foot=''):
    """As system.py's sign-in: the title on the band, a centred 480 px card."""
    s = f'<p style="margin: 0; {ts("subtitle", t["band_small"])}">{sub}</p>' if sub else ''
    card = (f'<div style="width: 480px; box-sizing: border-box; background: {t["ground"]}; border-radius: 28px; padding: 24px; '
            f'display: flex; flex-direction: column; gap: 12px; box-shadow: 0 24px 60px {t["band_shadow"]}">{inner}</div>')
    f = (f'<p style="margin: 0; text-align: center; font-size: 13px; color: {t["band_small"]}; max-width: 420px; line-height: 1.45">{foot}</p>' if foot else '')
    body = (f'<div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px">'
            f'<div style="width: 480px; display: flex; flex-direction: column; gap: 8px; padding-left: 8px; box-sizing: border-box">'
            f'<h1 style="margin: 0; {ts("display", CREAM)}">{title}</h1>{s}</div>{card}{f}</div>')
    return F.root(t, body)


def form_card(t, fields):
    return (f'<form style="background: {t["surface"]}; border-radius: 22px; padding: 20px 16px 16px; display: flex; flex-direction: column; gap: 16px; flex: none">'
            f'{fields}</form>')


def b_join(t):
    mem = names(t)[1]
    dance = 'Salsa' if salsa(t) else 'Bachata'
    return card_page(t, f'Join {mem}?', f'{dance} · 22 people', form_card(t, kit.button(t, 'Join', 'primary', size='lg', full=True, on=t['surface'])))


def b_join_no_account(t):
    f = t['field']
    fields = (kit.text_field(t, 'Email', '', placeholder='you@example.com', state='empty', input_type='email', bg=f)
              + kit.text_field(t, 'Password', '', state='empty', input_type='password', bg=f)
              + kit.banner(t, 'info', 'This code only adds people who already have an account. Ask Tilen for an invite.')
              + kit.button(t, 'Sign in', 'primary', size='lg', full=True, on=t['surface']))
    return card_page(t, 'Sign in', 'Welcome back. Sign in to practise.', form_card(t, fields), 'Registration is closed.')


def b_join_stale(t):
    inner = (f'<div style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 12px 8px 4px">'
             f'<span style="width: 72px; height: 72px; border-radius: 36px; background: {t["accent_soft"]}; display: flex; align-items: center; justify-content: center; margin-bottom: 6px">'
             f'{icon("link", 32, t["accent_text"])}</span>'
             f'<span style="{ts("caption", t["muted"])}; letter-spacing: 0.08em">ERROR 404</span>'
             f'<h2 style="margin: 0; {ts("headline", t["ink"])}">This code no longer works</h2>'
             f'<p style="margin: 0; font-size: 15px; line-height: 1.45; color: {t["muted"]}">Ask whoever sent it for the group’s new code.</p></div>'
             + kit.button(t, 'Go to Today', 'primary', icon_name='calendar', full=True))
    return card_page(t, 'Join a group', None, inner)


# --------------------------------------------------------------------------

LIST = '2A: your groups (360) beside the open group, as Lessons. '

BOARDS = [
    F.Board('nothing-open', 'Groups · nothing open', b_nothing_open,
            LIST + 'The tab lands here; the pane waits. "2 new" on a member group and the dot on the Groups tab are notifications (no number on the tab).'),
    F.Board('none', 'Groups · no groups yet', b_none,
            'No list column when there is nothing to list: the empty state centred on the sheet. The app offers New group only; joining is by the code’s link or QR.'),
    F.Board('owner', 'A group · as its owner', b_owner,
            LIST + 'My call: the pane is two columns at 892 — lessons left (drafts first, then published newest first; Add / Added on each), '
                   'the group’s space and Class songs right. People, the code and Recently deleted stay in ⋯, as on the phone.'),
    F.Board('editor', 'A group · as an editor', b_editor,
            'Same as the owner’s, without Rename and Delete in ⋯. Drafts and a draft class song show only to editors.'),
    F.Board('member', 'A group · as a member', b_member,
            'No drafts, no New lesson, no space row. "New" marks what was published since they last looked; opening clears it.'),
    F.Board('working-in', 'Groups in group mode', b_working_in,
            'Group mode (navy, Mine in place of Today): the Groups tab is still every group, the one worked in marked "Working in". Opening one does not switch.'),
    F.Board('menu-owner', 'The group menu · owner', b_menu_owner, '⋯ in the pane head opens the phone’s menu sheet as a small dialog.'),
    F.Board('menu-editor', 'The group menu · editor', b_menu_editor, 'An editor (or member: People and Leave group only) leaves; only the owner deletes.'),
    F.Board('new-group', 'New group', b_new_group, 'Name only. The name field is focused on open.'),
    F.Board('new-group-limit', 'New group · over the limit', b_new_group_limit, 'A person makes 2 groups unless the admin raises it.'),
    F.Board('rename', 'Rename group', b_rename, 'Owner only.'),
    F.Board('code', 'The group code', b_code,
            'QR and link; Make a new code for the owner only. Desktop says Copy link (the phone shares, and copies where it cannot share).'),
    F.Board('people', 'People', b_people,
            'People open in the pane with ‹ back to the group (they belong to it); the group stays lit in the list. ⋯ per person for the owner.'),
    F.Board('person', 'A person’s actions', b_person, 'Make editor (or Make member), Hand over, Remove.'),
    F.Board('hand-over', 'Hand over the group', b_hand_over, 'Asks once.'),
    F.Board('remove', 'Remove someone', b_remove, 'Removal keeps everything they had as their copies (clones and twins).'),
    F.Board('leave', 'Leave a group', b_leave,
            'Three ways to keep, from the clones spec. Drawn with the over-the-limit warning that shows when Keep everything would not fit.'),
    F.Board('leave-choose', 'Leave · choose what to keep', b_leave_choose,
            'The second level opens in the same place, with ‹. Locked ticks: what a ticked lesson or your routine needs.'),
    F.Board('delete', 'Delete a group', b_delete, 'Owner only. Restorable for 30 days.'),
    F.Board('deleted-group', 'A group being deleted', b_deleted_group,
            'The owner still sees it, marked Deleted, with Restore in the row and in the pane, until the purge.'),
    F.Board('storage', 'The group’s What uses space', b_storage,
            'In the pane with ‹ back to the group. Ask for more is the owner’s; editors see the list.'),
    F.Board('ask-more', 'Ask for more · the group', b_ask_more, 'As a person’s Ask for more.'),
    F.Board('trash', 'Recently deleted', b_trash,
            'Any editor restores. Trash kinds show the day they go for good; a refused Restore says why under its row.'),
    F.Board('trash-empty', 'Recently deleted · empty', b_trash_empty, ''),
    F.Board('history', 'History of a group lesson', b_history,
            'Its route sits under the group, so Groups stays lit and the pane’s ‹ goes back to the lesson. Text changes keep the old value with Restore (no question, as built).'),
    F.Board('add', 'Add a group lesson', b_add,
            'Ticks decide only what goes on Today; figures start unticked. Same dialog from the group page and from the lesson.'),
    F.Board('clash', 'Someone saved first', b_clash,
            'Theirs above, read-only; yours below, editable. It opens over whatever form saved (a group lesson’s Edit here; the page behind is a stand-in).'),
    F.Board('gone', 'Deleted while you edited', b_gone, 'Nothing saved; what was typed stays to copy.'),
    F.Board('join', 'Join with a code', b_join,
            '/g/<code> is outside the dance’s frame: the question on the band, Join in a centred card, as Sign in. Already in: it opens the group.'),
    F.Board('join-no-account', 'Join · signed out, no account', b_join_no_account,
            'Signed out, the code goes through Sign in with this note; no sign-up form.'),
    F.Board('join-stale', 'Join · an old code', b_join_stale,
            'My call: a code made new shows a card, not the bare 404. The app today shows its error page with "This code no longer works".'),
]
