"""Desktop boards · Lessons: the list beside a lesson (2A), a lesson in two columns (3A), dialogs (4B)."""
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:  # not at the front: options.py must find gen/screens/today.py, not ours
    sys.path.append(HERE)
import frame as F  # noqa: E402
from frame import kit  # noqa: E402

SCREENS = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'screens')


def mobile(name):
    """Load a phone board module (gen/screens/<name>.py) under another name: ours share its name."""
    key = f'm_{name}'
    if key in sys.modules:
        return sys.modules[key]
    spec = importlib.util.spec_from_file_location(key, os.path.join(SCREENS, name + '.py'))
    mod = importlib.util.module_from_spec(spec)
    sys.modules[key] = mod
    spec.loader.exec_module(mod)
    return mod


ML = mobile('lessons')
MP = mobile('pickers')

SECTION = ('lessons', 'Lessons')
LONG = ML.LONG
DATE = 'Wednesday 28 October 2026'
RANGE = MP.RANGE


# --------------------------------------------------------------------------
# the list column
# --------------------------------------------------------------------------

G1, G2, G3 = 'Salsa Tuesdays', 'Rueda club', 'Salsa Thursdays'
GL = 'Week 6 · Setenta into Sombrero'      # a published group lesson (Salsa Tuesdays)
GL_DAY = '3 November 2026'
DRAFT = 'Week 7 · Vacilala'
OWN3 = 'Week 3 · Enchufla'                  # the person's own lesson that goes to a group


def counts(t, s, r, f):
    """All three counts, wrapping in the 360 column (a zero is muted, not hidden)."""
    return ML.counts(t, s, r, f).replace('display: flex; gap: 12px;', 'display: flex; flex-wrap: wrap; gap: 2px 10px;', 1)


def group_line(t, name):
    """LessonRow's group line: the people icon and the group's name, accent text (a lesson the person added)."""
    return (f'<span style="display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 700; color: {t["accent_text"]}">'
            f'{kit.icon("people", 16, t["accent_text"])}{name}</span>')


def row(t, wd, day, date_sr, title, meta, c, last=False, group=None, badges=''):
    m = ''
    if group:
        m += group_line(t, group)
    if meta:
        m += f'<span style="display: block">{meta}</span>'
    m += counts(t, *c)
    ttl = f'<span style="{kit.SR}">{date_sr}, </span>{title}'
    if badges:
        ttl = f'<span style="display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px 8px">{ttl}{badges}</span>'
    return kit.row(t, ttl, m, kit.chevron(t), leading=ML.date_tile(t, wd, day), href='#', min_h=84, last=last)


# (wd, day, sr date, title, meta, counts, group, badges)
NOV = [('TUE', '3', GL_DAY, GL, '1 video · 380 MB', (2, 1, 2), G1, None)]
OCT = [('WED', '28', '28 October 2026', LONG, '3 videos · 1.2 GB', (6, 1, 3), None, None),
       ('TUE', '27', '27 October 2026', OWN3, '2 videos · 420 MB', (3, 0, 3), None, None),
       ('SAT', '24', '24 October 2026', 'Workshop: son montuno basics', '2 videos · 820 MB', (2, 0, 2), None, None),
       ('THU', '22', '22 October 2026', 'Rueda calls · round two', '1 video · 290 MB', (4, 1, 3), G2, None),
       ('WED', '21', '21 October 2026', 'Setenta and the hook turn', '1 video · 410 MB', (0, 0, 1), None, None),
       ('WED', '14', '14 October 2026', 'Shines with Marta', 'Your copy · from Salsa Tuesdays', (1, 0, 0), None, 'copy')]
SEP = [('WED', '30', '30 September 2026', 'Cross-body lead timing', '2 videos · 960 MB', (4, 1, 2), None, None),
       ('SAT', '26', '26 September 2026', 'Turn pattern workshop', '1 video · 380 MB', (2, 0, 1), None, None)]


def _rows(t, items, open_):
    out = []
    for i, (wd, day, sr, title, meta, c, g, b) in enumerate(items):
        badges = kit.badge(t, 'Copy') if b == 'copy' else (kit.badge(t, 'Draft', 'warn') if b == 'draft' else '')
        h = row(t, wd, day, sr, title, meta, c, last=i == len(items) - 1, group=g, badges=badges)
        out.append(F.lit(t, h) if title == open_ else h)
    return out


def lesson_list(t, open_=LONG, nov=True):
    """Your lessons and the ones you added from a group (marked with it), by month. ``open_``: the lit row's title, or None.
    nov=False: before Add, the group's November lesson is not in your list."""
    out = ''
    months = (('November 2026', NOV),) if nov else ()
    for i, (name, items) in enumerate(months + (('October 2026', OCT), ('September 2026', SEP))):
        out += F.label(t, name, 10 if i else 0) + kit.list_group(t, _rows(t, items, open_), label=name)
    return out


def band_right(t, group=False):
    """Lessons' band: the round group button (you own or edit a group of this dance), then +."""
    return F.group_btn(t, group) + F.act(t, 'plus', 'New lesson')


def board(t, body, overlay=''):
    return F.frame(t, 'Lessons', 'Lessons', body, sub='Videos on disk: 3.4 GB', right=band_right(t), overlay=overlay)


# --------------------------------------------------------------------------
# the lesson pane
# --------------------------------------------------------------------------

def video(t, *a, **k):
    """The phone's lesson video card, its picture 16:9 at the right column's width."""
    return ML.video_card(t, *a, **k).replace('width: 358px; height: 201px', 'width: 100%; height: 256px')


def yt(t, *a, **k):
    return ML.yt_card(t, *a, **k)


def tert(t, label, icon_name=None):
    return kit.button(t, label, 'tertiary', icon_name=icon_name, size='sm', on=t['ground'])


def clone_row(t, move=True, same=True):
    """SourceTabs' row: Copy to… (your app or a group you edit), Move to… (your own lesson into a group), Same as…"""
    out = tert(t, 'Copy to…', 'copy')
    if move:
        out += tert(t, 'Move to…', 'move-to')
    if same:
        out += tert(t, 'Same as…', 'link')
    return f'<div style="display: flex; align-items: center; gap: 0; margin: -6px 0 0 -10px">{out}</div>'


def head(t, title=LONG, sub=DATE, editing=False, clones=True):
    if editing:
        return F.pane_head(t, title, 'Editing', actions=F.tonal(t, 'close', 'Stop editing'))
    return F.pane_head(t, title, sub, actions=F.tonal(t, 'edit', 'Edit lesson'), below=clone_row(t) if clones else '')


def linked(t):
    """The phone board's linked groups, with the app's opener words."""
    return (ML.linked(t).replace('Link a figure…', 'Link an existing figure…').replace('Link a routine…', 'Link an existing routine…')
            .replace('Link an exercise…', 'Link an existing exercise…'))


def positions_group(t):
    """Round 7: a lesson links positions too, by hand or through a section (the via badge)."""
    un = lambda n: kit.icon_button(t, 'unlink', f'Unlink {n}', 'bare', color=t['muted'], on=t['surface'])  # noqa: E731
    rows = [ML.split_row(t, f'Manos cruzadas {ML.via_badge(t)}', '1:12.0–1:31.0 · Son', un('Manos cruzadas')),
            ML.link_row_btn(t, 'Link a position…')]
    return kit.section_label(t, 'Positions · 1', 10, ML.new_btn(t, 'position')) + ML.group(t, rows)


def left_col(t):
    return (ML.notes_card(t, ML.notes(t))
            + F.label(t, 'Review', 6) + ML.review_group(t)
            + '<div style="height: 6px; flex: none"></div>' + linked(t) + positions_group(t))


def right_col(t, uploading=False):
    if uploading:
        return (F.label(t, 'Videos · 2') + video(t, '96 MB', '6:12', 2, source=True)
                + ML.upload_card(t, 'Uploading 2 of 3… 46%', 'Keep this page open — a reload starts over', 46)
                + F.label(t, 'Links · 2', 10) + yt(t, 'Setenta full breakdown', 'saving', tone=2)
                + yt(t, 'Enchufla doble — slow', 'link'))
    return (F.label(t, 'Videos · 2') + video(t, sections=ML.SEC1)
            + video(t, '410 MB', '6:20', 1, sections=[(None, '0:18.0–0:40.2', None), ('Outro', '5:40.0–6:01.0', None)])
            + F.label(t, 'Links · 1', 10) + yt(t, 'Enchufla doble — slow', 'link'))


def lesson_pane(t, uploading=False):
    return F.pane(t, head(t), F.pane_cols(left_col(t), right_col(t, uploading)), label_=LONG)


def lesson_split(t, uploading=False):
    return F.split(t, lesson_list(t), lesson_pane(t, uploading), 'Lessons')


# --------------------------------------------------------------------------
# boards
# --------------------------------------------------------------------------

def b_lessons(t):
    empty = F.empty_pane(t, 'lessons', 'Pick a lesson', 'Its notes, videos and what it teaches open here, beside the list.',
                         kit.button(t, 'New lesson', 'secondary', icon_name='plus'))
    return board(t, F.split(t, lesson_list(t, None), empty, 'Lessons'))


def b_lesson(t):
    return board(t, lesson_split(t))


def b_uploading(t):
    return board(t, lesson_split(t, uploading=True))


EDIT_NOTES = ML.EDIT_NOTES


def b_edit(t):
    form = (kit.text_field(t, 'Day of the class', '28 October 2026', state='filled', lead_icon='calendar')
            + kit.text_field(t, 'Title', LONG, state='filled')
            + kit.textarea(t, 'Notes', EDIT_NOTES, state='focused', rows=8, helper='Links in notes open when tapped.')
            + f'<div style="display: flex; justify-content: center; padding-top: 8px">{kit.button(t, "Archive lesson", "danger_text", size="sm")}</div>')
    body = F.pane_body(f'<div style="display: flex; flex-direction: column; gap: 14px">{form}</div>', max_w=640)
    foot = F.pinned(t, kit.button(t, 'Save', 'primary', full=True), max_w=640)
    pane = F.pane(t, head(t, editing=True), body, foot, label_='Edit lesson')
    return board(t, F.split(t, lesson_list(t), pane, 'Lessons'))


def b_new(t):
    dlg = F.dialog(t, 'New lesson', ML.new_lesson_fields(t), footer=kit.button(t, 'Create lesson', 'primary', full=True, on=t['sheet_bg']))
    return board(t, lesson_split(t), dlg)


LINK_H = 480


def b_link(t):
    inner = (F.label(t, 'Linked')
             + kit.list_group(t, [MP.linked_item(t, 'Enchufla · Doble'), MP.linked_item(t, 'Count drill · 3-2 clave', drill=True),
                                  MP.linked_item(t, 'Enchufla · Vieja', archived=True, last=True)], label='Linked')
             + '<div style="height: 4px"></div>'
             + kit.button(t, 'Link a figure, drill or position…', 'secondary', icon_name='search', full=True, on=t['sheet_bg'])
             + f'<p style="margin: 4px 4px 0; font-size: 13px; line-height: 1.45; color: {t["muted"]}">'
               'What a section links to shows on this lesson too. × unlinks it from this section.</p>')
    dlg = F.dialog(t, f'Link {RANGE}', inner, sub='Doble entry · 13 s', height=LINK_H)
    return board(t, lesson_split(t), dlg)


def b_stacked(t):
    fields = (kit.select_field(t, 'Move', 'Enchufla', 'Choose a move…', 'filled')
              + kit.text_field(t, 'Figure name', 'Dob', placeholder='e.g. Basic, Doble, From cross', state='focused')
              + MP.stack(MP.field_label(t, 'Danced'), kit.segmented(t, ['With partner', 'Solo'], 0, on_band=False, label='Danced')))
    dlg = F.dialog(t, 'New figure', f'<div style="display: flex; flex-direction: column; gap: 14px">{fields}</div>',
                   sub=f'Linked to {RANGE} and to {LONG}', footer=kit.button(t, 'Create and link', 'primary', full=True, on=t['sheet_bg']),
                   back=True, height=LINK_H)
    return board(t, lesson_split(t), dlg)


def b_refused(t):
    right = (F.label(t, 'Videos · 2')
             + video(t, sections=ML.SEC1, refused='Linked to Enchufla · Doble, Footwork drill — unlink it first.')
             + video(t, '410 MB', '6:20', 1, sections=[(None, '0:18.0–0:40.2', None)]))
    pane = F.pane(t, head(t), F.pane_cols(left_col(t), right), label_=LONG)
    return board(t, F.split(t, lesson_list(t), pane, 'Lessons'))


# --------------------------------------------------------------------------
# New figure from a lesson (the + New on Figures): New move | New figure in a move
# --------------------------------------------------------------------------

def b_new_figure(t):
    inner = (kit.segmented(t, ['New move', 'New figure in a move'], 0, on_band=False, label='Make')
             + kit.text_field(t, 'Move name', 'Setenta', placeholder='e.g. Dile que no, Enchufla', state='filled')
             + kit.text_field(t, 'Figure name', 'Basic', placeholder='e.g. Basic, Doble, From cross', state='focused')
             + MP.stack(MP.field_label(t, 'Danced'), kit.chips(t, ['With partner', 'Solo'], 0, label='Danced', scroll=False))
             + MP.stack(MP.field_label(t, 'Style'), kit.chips(t, ['Salsa', 'Son', 'Other'], 0, label='Style', scroll=False))
             + kit.textarea(t, 'Notes', placeholder='Count, hand holds, what the teacher said…', rows=2, optional=True))
    dlg = F.dialog(t, 'New figure', f'<div style="display: flex; flex-direction: column; gap: 14px">{inner}</div>',
                   sub=f'Linked to {LONG}', footer=kit.button(t, 'Add figure', 'primary', full=True, on=t['sheet_bg']), height=700)
    return board(t, lesson_split(t), dlg)


# --------------------------------------------------------------------------
# a group's lesson (groups spec: draft and publish, a member's view, Add; clones: Make it mine, Copy to…, Move to…)
# --------------------------------------------------------------------------

GL_NOTES = ('Setenta: keep the frame, she turns on 5.\nSombrero from the hammerlock, not from open. '
            'Ana’s tip: lead the sombrero with the left hand above her head, never in front of her face.')
GL_SECS = [('Setenta', '1:12.0–1:30.4', 'Setenta · Basic'), ('Sombrero', '2:05.0–2:31.0', 'Sombrero · Basic'),
           (None, '3:40.0–3:58.2', None)]


def strip(t, text, buttons, tone='accent', lead=''):
    """What the phone puts in the band's extra strip (Draft · Publish, Not in your lessons yet · Add),
    on desktop a soft bar under the pane's header."""
    bg, ink = (t['warn_soft'], t['ink2']) if tone == 'warn' else (t['accent_soft'], t['accent_text'])
    return (f'<div style="display: flex; align-items: center; gap: 12px; min-height: 52px; box-sizing: border-box; padding: 6px 8px 6px 16px; '
            f'border-radius: 16px; background: {bg}">{lead}<span style="flex: 1; min-width: 0; font-size: 15px; font-weight: 700; color: {ink}">{text}</span>'
            f'<span style="display: flex; gap: 4px; flex: none">{buttons}</span></div>')


def add_strip(t):
    return strip(t, 'Not in your lessons yet', kit.button(t, 'Add', 'primary', size='sm', aria='Add Week 6 to your lessons'))


def new_strip(t):
    return strip(t, '1 new drill', kit.button(t, 'Not now', 'tertiary', size='sm', on=t['accent_soft']) + kit.button(t, 'Add', 'primary', size='sm'))


def draft_strip(t):
    return strip(t, 'Only the group’s editors see it', kit.button(t, 'Publish', 'primary', size='sm'), tone='warn',
                 lead=kit.badge(t, 'Draft', 'warn', solid=True))


def edited(t, who='Ana', ago='10 min ago'):
    return f'<p style="margin: 0 4px; font-size: 13px; font-weight: 600; color: {t["muted"]}">Edited by {who} · {ago}</p>'


def g_linked(t, edit=False, log=True):
    """The lesson's Figures, Routines, Exercises. Read-only for a member (no New, no Link…, no unlink)."""
    def un(n):
        return kit.icon_button(t, 'unlink', f'Unlink {n}', 'bare', color=t['muted'], on=t['surface']) if edit else ''
    lg = (lambda n: kit.log_button(t, n)) if log else (lambda n: '')
    figs = [ML.split_row(t, f'Setenta · Basic {ML.via_badge(t)}', '1:12.0–1:30.4', un('Setenta · Basic')),
            ML.split_row(t, f'Sombrero · Basic {ML.via_badge(t)}', '2:05.0–2:31.0', un('Sombrero · Basic'), last=not edit)]
    rts = [ML.split_row(t, 'Setenta into Sombrero', '4 slots · loops', un('Setenta into Sombrero'), last=not edit)]
    exs = [ML.split_row(t, 'Cross-body footwork', 'Drill · every 2 days', lg('Cross-body footwork') + un('Cross-body footwork'), last=not edit)]
    if edit:
        figs.append(ML.link_row_btn(t, 'Link an existing figure…'))
        rts.append(ML.link_row_btn(t, 'Link an existing routine…'))
        exs.append(ML.link_row_btn(t, 'Link an existing exercise…'))
    nb = (lambda w: ML.new_btn(t, w)) if edit else (lambda w: None)
    return (kit.section_label(t, 'Figures · 2', 0, nb('figure')) + ML.group(t, figs)
            + kit.section_label(t, 'Routines · 1', 10, nb('routine')) + ML.group(t, rts)
            + kit.section_label(t, 'Exercises · 1', 10, nb('exercise')) + ML.group(t, exs))


def g_video(t, edit=False):
    """The group lesson's video. A member reads it: no delete, no section link buttons."""
    v = video(t, '380 MB', '9:14', 2, sections=GL_SECS)
    if not edit:
        v = v.replace(kit.icon_button(t, 'trash', 'Delete video', 'bare', color=t['danger'], on=t['surface']), '')
        for lab, rng, links in GL_SECS:
            title = lab or rng
            for c in (t['ink2'], t['accent']):
                v = v.replace(kit.icon_button(t, 'link', f'Link {title}', 'bare', color=c, on=t['surface']), '')
    return v


def g_left(t, top='', review=False, edit=False):
    out = top + ML.notes_card(t, GL_NOTES)
    if review:
        out += F.label(t, 'Review', 6) + ML.review_group(t)
    return out + '<div style="height: 6px; flex: none"></div>' + g_linked(t, edit, log=review)


def g_right(t, edit=False):
    out = F.label(t, 'Videos · 1') + g_video(t, edit)
    if edit:
        out += ML.upload_idle(t) if hasattr(ML, 'upload_idle') else ''
    return out + F.label(t, 'Links · 1', 10) + yt(t, 'Setenta — slow, from the front', 'link')


def g_head(t, back=False, actions=None, below='', title=GL, sub=f'{GL_DAY} · {G1}'):
    acts = actions if actions is not None else F.tonal(t, 'edit', 'Edit lesson')
    return F.pane_head(t, title, sub, back=back, actions=acts, below=below + clone_row(t, move=False, same=False))


def b_group_new(t):
    """A member opens a published group lesson from the group page: not in their Lessons yet."""
    pane = F.pane(t, g_head(t, back=True, below=add_strip(t)), F.pane_cols(g_left(t), g_right(t)), label_=GL)
    return board(t, F.split(t, lesson_list(t, None, nov=False), pane, 'Lessons'))


def b_group_added(t):
    acts = F.tonal(t, 'more', 'Lesson menu') + F.tonal(t, 'edit', 'Edit lesson')
    pane = F.pane(t, g_head(t, actions=acts, below=new_strip(t)), F.pane_cols(g_left(t, review=True), g_right(t)), label_=GL)
    return board(t, F.split(t, lesson_list(t, GL), pane, 'Lessons'))


def menu_row(t, icon_name, text, danger=False, last=False):
    c = t['danger'] if danger else t['ink']
    ic = t['danger'] if danger else t['accent_text']
    hair = '' if last else f'border-bottom: 1px solid {t["hairline"]};'
    return (f'<div style="padding-left: 16px"><button type="button" style="width: 100%; min-height: 56px; border: 0; {hair} background: none; padding: 0 16px 0 0; '
            f'display: flex; align-items: center; gap: 12px; cursor: pointer; text-align: left">{kit.icon(icon_name, 22, ic)}'
            f'<span style="font-size: 16px; font-weight: 700; color: {c}">{text}</span></button></div>')


def added_pane(t):
    acts = F.tonal(t, 'more', 'Lesson menu') + F.tonal(t, 'edit', 'Edit lesson')
    return F.pane(t, g_head(t, actions=acts), F.pane_cols(g_left(t, review=True), g_right(t)), label_=GL)


def b_group_menu(t):
    inner = f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">{menu_row(t, "trash", "Remove from my lessons", True, True)}</div>'
    dlg = F.dialog(t, GL, inner, width=480)
    return board(t, F.split(t, lesson_list(t, GL), added_pane(t), 'Lessons'), dlg)


def b_make_mine(t):
    sec = lambda h, b: (f'<div style="display: flex; flex-direction: column; gap: 4px"><span style="{kit.ts("label", t["muted"])}">{h}</span>'  # noqa: E731
                        f'<p style="margin: 0; font-size: 15px; line-height: 1.45; color: {t["ink"]}">{b}</p></div>')
    inner = (kit.card(t, sec('YOU GET', 'Its title, notes, links, videos and sections, to change as you like. The videos count against your space.')
                      + f'<p style="margin: 0; font-size: 14px; font-weight: 700; color: {t["ink2"]}">Uses 380 MB of your space</p>', gap=12)
             + f'<p style="margin: 0; display: flex; gap: 10px; align-items: flex-start; font-size: 14px; line-height: 1.45; color: {t["ink2"]}">'
               f'{kit.icon("refresh", 20, t["accent_text"])}<span>Your routine Setenta loop and your practice of it switch to your copy.</span></p>')
    foot = (f'<div style="display: flex; gap: 10px; justify-content: flex-end">{kit.button(t, "Cancel", "tertiary", on=t["sheet_bg"])}'
            f'{kit.button(t, "Make it mine", "primary", on=t["sheet_bg"])}</div>')
    dlg = F.dialog(t, f'Make {GL} yours?', inner, sub='Editing makes your own copy. The class’s stays as it is.', footer=foot)
    return board(t, F.split(t, lesson_list(t, GL), added_pane(t), 'Lessons'), dlg)


def b_group_deleting(t):
    ban = kit.banner(t, 'warning', 'Salsa Thursdays is being deleted on 2 Dec', action='Make it mine')
    title, sub = 'Week 2 · Basics', f'29 October 2026 · {G3}'
    acts = F.tonal(t, 'more', 'Lesson menu') + F.tonal(t, 'edit', 'Edit lesson')
    pane = F.pane(t, F.pane_head(t, title, sub, actions=acts), F.pane_cols(ban + ML.notes_card(t, 'Basic step on 1 and 5. Keep the frame, small steps.')
                                                                        + F.label(t, 'Review', 6) + ML.review_group(t), g_right(t)), label_=title)
    items = [('THU', '29', '29 October 2026', title, '1 video · 380 MB', (3, 0, 2), G3, None)] + list(OCT)
    lst = (F.label(t, 'November 2026') + kit.list_group(t, _rows(t, NOV, None), label='November 2026')
           + F.label(t, 'October 2026', 10) + kit.list_group(t, _rows(t, items, title), label='October 2026'))
    return board(t, F.split(t, lst, pane, 'Lessons'))


# Copy to… and Move to… on your own lesson (clones board C4)

def own3_pane(t):
    acts = F.tonal(t, 'edit', 'Edit lesson')
    left = ML.notes_card(t, 'Enchufla doble: left hand low on 3.') + F.label(t, 'Review', 6) + ML.review_group(t) + '<div style="height: 6px"></div>' + linked(t)
    right = F.label(t, 'Videos · 2') + video(t, '312 MB', '8:02', 1, sections=ML.SEC1) + video(t, '108 MB', '3:10', 3, sec_note=False)
    return F.pane(t, F.pane_head(t, OWN3, '27 October 2026 · Yours · in 1 group', actions=acts, below=clone_row(t)), F.pane_cols(left, right), label_=OWN3)


def radio_row(t, title, meta, checked, last=False):
    hair = '' if last else f'border-bottom: 1px solid {t["hairline"]};'
    dot = (f'<span aria-hidden="true" style="width: 22px; height: 22px; border-radius: 50%; box-sizing: border-box; flex: none; '
           f'border: 2px solid {t["accent"] if checked else t["field_line"]}; display: flex; align-items: center; justify-content: center">'
           + (f'<span style="width: 11px; height: 11px; border-radius: 50%; background: {t["accent"]}"></span>' if checked else '') + '</span>')
    return (f'<div style="padding-left: 16px"><label style="display: flex; align-items: center; gap: 12px; min-height: 64px; padding-right: 16px; {hair} cursor: pointer">'
            f'<span style="flex: 1; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 16px; font-weight: 700; color: {t["ink"]}">{title}</span>'
            f'<span style="font-size: 13px; color: {t["muted"]}">{meta}</span></span>{dot}</label></div>')


def caption_card(t, cap, body):
    return kit.card(t, f'<span style="{kit.ts("caption", t["muted"])}; letter-spacing: 0.04em">{cap}</span>'
                       f'<p style="margin: 0; font-size: 15px; line-height: 1.45; color: {t["ink"]}">{body}</p>', gap=6)


def b_copy_to(t):
    targets = ML.group(t, [radio_row(t, G1, 'Owner · 412 MB of 1 GB used', True), radio_row(t, G2, 'Editor · 80 MB of 1 GB used', False, last=True)])
    inner = (targets
             + caption_card(t, 'WHAT GOES', '3 figures · 2 videos (420 MB, charged to the group) · notes')
             + caption_card(t, 'ALREADY THERE', 'Enchufla · Doble: Salsa Tuesdays has your copy from 3 Oct. It’s reused, not doubled.'))
    dlg = F.dialog(t, f'Copy {OWN3} to…', inner, sub='The group gets a draft. You keep yours.',
                   footer=kit.button(t, 'Copy as a draft', 'primary', full=True, on=t['sheet_bg']))
    return board(t, F.split(t, lesson_list(t, OWN3), own3_pane(t), 'Lessons'), dlg)


def b_move_to(t):
    def item(label, why, sel, last=False):
        hair = '' if last else f'border-bottom: 1px solid {t["hairline"]};'
        return (f'<div style="padding: 12px 16px; {hair} display: flex; flex-direction: column; gap: 10px">'
                f'<div style="display: flex; flex-direction: column; gap: 2px"><span style="font-size: 16px; font-weight: 700; color: {t["ink"]}">{label}</span>'
                f'<span style="font-size: 13px; color: {t["muted"]}">{why}</span></div>'
                f'{kit.segmented(t, ["Keep mine as well", "Use the group’s"], sel, on_band=False, label=label)}</div>')
    lst = (f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">'
           + item('Enchufla · Doble', 'Used by 2 other lessons', 0) + item('Setenta · Basic', 'Only this lesson', 1)
           + item('Dile que no · Basic', 'Used by Week 4 loop · You practise it', 0, last=True) + '</div>')
    note = lambda ic, txt: (f'<p style="margin: 0; display: flex; gap: 10px; align-items: flex-start; font-size: 14px; line-height: 1.45; color: {t["ink2"]}">'  # noqa: E731
                            f'{kit.icon(ic, 20, t["muted"])}<span>{txt}</span></p>')
    inner = (lst + note('undo', '“Use the group’s”: your copy is dropped, and your other lessons and routines use the group’s.')
             + note('info', 'Your practice of what you drop stays with your archived copy.'))
    dlg = F.dialog(t, f'Move {OWN3} to {G1}', inner, sub='The lesson lives in the group and leaves your lessons. What it brings:',
                   footer=kit.button(t, 'Move as a draft', 'primary', full=True, on=t['sheet_bg']), height=720)
    return board(t, F.split(t, lesson_list(t, OWN3), own3_pane(t), 'Lessons'), dlg)


# group mode: Lessons lists the group's (follow-ups spec, part 2)

GM_DRAFTS = [('THU', '5', '5 November 2026', DRAFT, '1 video · 210 MB', (1, 1, 2), None, 'draft')]
GM_NOV = [('TUE', '3', GL_DAY, GL, '1 video · 380 MB', (2, 1, 2), None, None)]
GM_OCT = [('TUE', '27', '27 October 2026', 'Week 5 · Enchufla doble', '2 videos · 640 MB', (5, 1, 4), None, None),
          ('TUE', '20', '20 October 2026', 'Week 4 · Rueda calls', '1 video · 300 MB', (3, 1, 3), None, None),
          ('TUE', '13', '13 October 2026', 'Week 3 · Enchufla', '2 videos · 420 MB', (3, 0, 3), None, None)]


def gm_list(t, open_=None):
    return (F.label(t, 'Drafts') + kit.list_group(t, _rows(t, GM_DRAFTS, open_), label='Drafts')
            + F.label(t, 'November 2026', 10) + kit.list_group(t, _rows(t, GM_NOV, open_), label='November 2026')
            + F.label(t, 'October 2026', 10) + kit.list_group(t, _rows(t, GM_OCT, open_), label='October 2026'))


def gm_board(t, body, overlay=''):
    return F.frame(t, 'Lessons', 'Lessons', body, sub='Group videos: 1.6 GB of 3 GB', right=band_right(t, True), overlay=overlay, group=G1)


def b_gm_lessons(t):
    g = F.in_group(t)
    empty = F.empty_pane(g, 'lessons', 'Pick a lesson', '+ makes a draft lesson in Salsa Tuesdays. Members see it once you publish it.',
                         kit.button(g, 'New lesson', 'secondary', icon_name='plus'))
    return gm_board(g, F.split(g, gm_list(g), empty, 'Lessons'))


def b_gm_draft(t):
    g = F.in_group(t)
    acts = F.tonal(g, 'more', 'Lesson menu') + F.tonal(g, 'edit', 'Edit lesson')
    head_ = F.pane_head(g, DRAFT, f'5 November 2026 · {G1}', actions=acts, below=draft_strip(g))
    left = edited(g, 'Luka', '2 h ago') + ML.notes_card(g, 'Vacilala from cross-body: her right hand, turn on 5.') + '<div style="height: 6px"></div>' + g_linked(g, edit=True, log=False)
    right = F.label(g, 'Videos · 1') + video(g, '210 MB', '4:48', 1, sections=[('Vacilala', '0:40.0–1:02.6', None)]) + F.label(g, 'Links', 10) + kit.button(g, 'Add link', 'secondary', icon_name='plus', full=True)
    pane = F.pane(g, head_, F.pane_cols(left, right), label_=DRAFT)
    return gm_board(g, F.split(g, gm_list(g, DRAFT), pane, 'Lessons'))


def b_gm_history_menu(t):
    g = F.in_group(t)
    acts = F.tonal(g, 'more', 'Lesson menu') + F.tonal(g, 'edit', 'Edit lesson')
    head_ = F.pane_head(g, GL, f'{GL_DAY} · {G1}', actions=acts)
    pane = F.pane(g, head_, F.pane_cols(edited(g) + g_left(g, edit=True).replace(ML.notes_card(g, GL_NOTES), ML.notes_card(g, GL_NOTES), 1), g_right(g, edit=True)), label_=GL)
    inner = f'<div style="background: {g["surface"]}; border-radius: 16px; overflow: hidden; flex: none">{menu_row(g, "clock", "History", last=True)}</div>'
    dlg = F.dialog(g, GL, inner, width=480)
    return gm_board(g, F.split(g, gm_list(g, GL), pane, 'Lessons'), dlg)


BOARDS = [
    F.Board('lessons', 'Lessons · the list, nothing open', b_lessons,
            'Your lessons and the ones you added from a group, one list by month; an added one carries its group under the title '
            '(“Salsa Tuesdays”, accent), a copy you made of a group’s lesson carries the Copy badge. The round group button sits beside + '
            '(you own or edit a group of this dance).'),
    F.Board('lesson', 'A lesson open beside the list', b_lesson,
            'Left: notes, the review exercise (+ logs it), Figures, Routines, Exercises. Right: the videos with their sections, then Links. '
            'Copy to…, Move to… and Same as… (the phone’s row at the top of the page) sit under the title in the pane header.'),
    F.Board('lesson-uploading', 'A lesson · a batch upload and a YouTube save', b_uploading,
            'Upload and save progress sit where the phone shows them, in the right column under the videos.'),
    F.Board('lesson-edit', 'A lesson · editing in the pane', b_edit,
            'The pane becomes the form (one column, 640), × in its header stops editing, Save pinned to the pane’s bottom. The list stays usable.'),
    F.Board('new-lesson', 'New lesson · a dialog', b_new,
            'The phone’s bottom sheet as a centred 560 dialog over the whole window.'),
    F.Board('new-figure', 'New figure from a lesson · New move | New figure in a move', b_new_figure,
            'From + New on the lesson’s Figures. The switch picks a new move (Move name + Figure name) or a figure in an existing move '
            '(a Move picker + Figure name). Renamed: the old “New figure | Variation of a figure”.'),
    F.Board('link-popup', 'The Link popup · first level', b_link,
            'Opened from a section’s link icon. My call: both levels are drawn 480 tall, so a stacked level covers this one exactly.'),
    F.Board('link-stacked', 'The Link popup · a stacked level (New figure)', b_stacked,
            'Opens in the same place and size as the level below, with Back on the left and no ×; one scrim. Move picker, then Figure name.'),
    F.Board('delete-refused', 'Deleting a linked video · refused', b_refused,
            'The refusal is a banner on the video’s own card, naming what to unlink. (The plain delete asks with the kit’s small question dialog.)'),
    F.Board('group-lesson-new', 'A group’s lesson · a member, not added yet', b_group_new,
            'Opened from the group page, so the pane has ‹ (back to Salsa Tuesdays) and nothing in the list is lit: before Add it is not in your Lessons. '
            'The phone’s band strip “Not in your lessons yet · Add” is a soft bar under the pane header. Read-only: no New, no Link…, no delete. '
            'Edit makes it yours (Make it mine). Add opens the Add dialog (drawn with Groups).'),
    F.Board('group-lesson-added', 'A group’s lesson · added, with something new', b_group_added,
            'Now in your list with its group. “1 new drill · Not now · Add” for what came in since you added it; your review exercise and log + show. '
            '⋯ holds Remove from my lessons.'),
    F.Board('group-lesson-menu', 'A group’s lesson · its menu', b_group_menu,
            'The phone’s menu sheet as a small dialog (480): Remove from my lessons asks next (the kit’s danger question). Editors also get History here.'),
    F.Board('make-mine', 'A group’s lesson · Edit makes it yours', b_make_mine,
            'A reader’s Edit asks once: what you get, the space it uses, and what of yours switches to the copy. Cancel / Make it mine.'),
    F.Board('group-deleting', 'A lesson whose group is being deleted', b_group_deleting,
            'A warning banner at the top of the pane until the purge: “Salsa Thursdays is being deleted on 2 Dec · Make it mine”.'),
    F.Board('copy-to', 'Your lesson · Copy to… a group', b_copy_to,
            'The places you can copy into (your groups you own or edit, with their space), What goes and What’s already there. The group gets a draft.'),
    F.Board('move-to', 'Your lesson · Move to… a group', b_move_to,
            'Each figure and routine it brings: keep yours as well, or use the group’s from now on. Moves as a draft; the lesson leaves your list.'),
    F.Board('group-mode-lessons', 'Group mode · Lessons, nothing open', b_gm_lessons, 
            'Navy, the striped edge and “Salsa Tuesdays · group” above the title; Mine in place of Today in the side. '
            'Drafts first, then published by month. + makes a draft in the group. The band’s subtitle is the group’s storage (my call).'),
    F.Board('group-mode-draft', 'Group mode · a draft open, as an editor', b_gm_draft,
            'Draft bar with Publish under the header; “Edited by Luka · 2 h ago” above the notes; full editing (New, Link an existing…, unlink). '
            'No review row: drafts never reach anyone’s Today.'),
    F.Board('group-mode-history', 'Group mode · a published lesson’s menu (History)', b_gm_history_menu,
            'Editors reach the lesson’s History from ⋯ (it opens the group’s History page, drawn with Groups).'),
]
