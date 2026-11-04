"""Desktop boards · Music: the library beside a song (2A), the song pane in one column (640), dialogs (4B)."""
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
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


MM = mobile('music')
SECTION = ('music', 'Music')
SONG_W = 640

# A group's shared songs (the class playlist): title, artist, style, bpm, length
CLASS = {
    'salsa': ('Salsa Tuesdays', [
        ('Brujería', 'El Gran Combo', 'Salsa', 188, '4:52'),
        ('Cali pachanguero', 'Grupo Niche', 'Salsa', 200, '5:15'),
        ('La vida es un carnaval', 'Celia Cruz', 'Salsa', 196, '4:36'),
        ('Mi gente', 'Héctor Lavoe', 'Salsa', 186, '6:10'),
        ('Ran kan kan', 'Tito Puente', 'Salsa', 190, '2:57'),
        ('Sonido bestial', 'Richie Ray & Bobby Cruz', 'Salsa', 202, '6:25'),
    ], ('Que se sepa', 'Roberto Roena', 'Salsa', 194, '5:01')),
    'bachata': ('Bachata Thursdays', [
        ('Bachata rosa', 'Juan Luis Guerra', 'Traditional', 118, '4:10'),
        ('Corazón sin cara', 'Prince Royce', 'Sensual', 122, '3:39'),
        ('Cuando volverás', 'Aventura', 'Dominican', 132, '4:22'),
        ('El perdedor', 'Aventura', 'Dominican', 128, '4:10'),
        ('Llévame contigo', 'Romeo Santos', 'Sensual', 126, '4:31'),
        ('Te extraño', 'Xtreme', 'Dominican', 130, '4:02'),
    ], ('Ella y yo', 'Aventura', 'Dominican', 130, '4:30')),
}
USED_BY = [4, 0, 6, 2, 0, 3]


def possessive(name):
    return name + ('’' if name.endswith('s') else '’s')


def klass(t):
    """(group name, its shared songs, a draft) for this dance."""
    return CLASS[t['dance']]


# --------------------------------------------------------------------------
# the list column
# --------------------------------------------------------------------------

def badge_meta(t, text, tone, ic):
    return f'<span style="display: inline-flex; margin-top: 2px">{kit.badge(t, text, tone, icon_name=ic)}</span>'


def adding_group(t, lit=None):
    """Being added: the badge on the second line, so the title keeps the narrow column's width."""
    chev = f'<span style="display: flex; flex: none">{kit.chevron(t)}</span>'

    def r(title, text, tone, ic):
        h = MM.song_row(t, title, None, trailing=chev).replace(
            f'{title}</span></span>', f'{title}</span>{badge_meta(t, text, tone, ic)}</span>', 1)
        return F.lit(t, h) if title == lit else h
    failed = MM.song_row(t, 'Pedro Navaja', 'Failed: video unavailable', meta_tone='danger', last=True, trailing=chev)
    retry = (f'<div style="padding: 4px 8px 8px; border-top: 1px solid {t["hairline"]}; display: flex">'
             f'{kit.button(t, "Retry", "tertiary", icon_name="refresh", size="sm", on=t["surface"])}</div>')
    return MM.group(t, [MM.uploading_row(t, 'Vivir mi vida.mp3', 62, 6, 9.7),
                        r('La rebelión', 'Waiting to download', 'neutral', 'clock'),
                        r('Juliana', 'Finding the beat', 'accent', 'metronome'),
                        failed + retry])


def with_badge(t, title, text, tone):
    """A Draft / New badge after the title, as SongRow draws it."""
    return f'<span style="display: inline-flex; align-items: center; gap: 8px; min-width: 0">{title}{kit.badge(t, text, tone)}</span>'


def song_rows(t, items, sampling=None, lit=None, q=None, badges=None, metas=None):
    out = []
    badges, metas = badges or {}, metas or {}
    for i, x in enumerate(items):
        on = x[0] == sampling
        title = MM.hl(t, x[0], q) if q else x[0]
        if x[0] in badges:
            title = with_badge(t, title, *badges[x[0]])
        disc = t['surface'] if x[0] == lit else None  # a lit row is accent_soft: the disc would vanish into it
        h = MM.song_row(t, title, 'Sample from 1:07' if on else metas.get(x[0], MM.meta_of(x)), meta_tone='accent' if on else None,
                        sample=MM.sample_btn(t, x[0], on=on, disc_bg=disc), last=i == len(items) - 1)
        out.append(F.lit(t, h) if x[0] == lit else h)
    return MM.group(t, out)


def class_section(t, lit=None, sampling=None):
    """A person's Music, below their own songs: a section per group with its shared songs, A–Z. Unopened ones say New."""
    name, songs, _ = klass(t)
    return (F.label(t, f'{name} · {len(songs)}', 6)
            + song_rows(t, songs, sampling, lit, badges={songs[1][0]: ('New', 'accent')}))


def library(t, sampling=None, lit=None, adding=True, adding_lit=None, groups=True, scrolled=0):
    s = MM.songs(t)
    recent = [s[0], s[2], s[4]]
    rest = sorted([x for x in s if x not in recent], key=lambda x: x[0])
    being = (F.label(t, 'Being added · 4', 6) + adding_group(t, adding_lit)) if adding else ''
    inner = (kit.search_field(t, 'Search songs') + MM.count_only_row(t) + being
             + F.label(t, 'Recent', 6) + song_rows(t, recent, sampling, lit)
             + F.label(t, f'All songs A–Z · {len(rest)}', 6) + song_rows(t, rest, sampling, lit)
             + (class_section(t, lit, sampling) if groups else ''))
    if scrolled:  # the list column scrolled down by `scrolled` px
        inner = f'<div style="display: flex; flex-direction: column; gap: 10px; margin-top: -{scrolled}px">{inner}</div>'
    return inner


def board(t, body, overlay='', dot=False, editor=True):
    """editor: the person owns or edits a group, so the round group button sits beside +."""
    gb = F.group_btn(t) if editor else ''
    return F.frame(t, 'Music', 'Music', body, right=gb + F.act(t, 'plus', 'Add a song'), overlay=overlay, dot=dot)


# --------------------------------------------------------------------------
# the song pane
# --------------------------------------------------------------------------

def song_head(t, s):
    return F.pane_head(t, s[0], f'{s[1]} · {s[2]} · {s[3]} BPM', actions=F.tonal(t, 'edit', 'Song details'))


def yours(t):
    return f'From 1:55 <span style="margin-left: 6px; vertical-align: 1px">{kit.badge(t, "Yours", "accent")}</span>'


def song_body(t, s):
    ones = kit.list_group(t, [
        dict(title=f'<span style="font-variant-numeric: tabular-nums">{a}</span>', meta=m,
             trailing=kit.button(t, 'Remove', 'danger_text', size='sm', on=t['surface']), min_h=56)
        for a, m in (('0:07', 'First 1'), ('2:41', 'After the break'), ('4:58', 'Coro'))], label='Your 1s')
    inner = (kit.button(t, 'Practice with this song', 'secondary', icon_name='play', full=True)
             + MM.live_player(t, 1, total=s[4])
             + kit.button(t, 'Tap on the 1', 'primary', size='lg', full=True)
             + MM.note(t, 'If the count slips after a break, tap the 1 again there.')
             + F.label(t, 'Sample', 12)
             + MM.group(t, [MM.song_row(t, yours(t), 'Set by you', kind='div', sample=MM.sample_btn(t, s[0]), last=True)])
             + F.label(t, 'Count speed', 12)
             + kit.segmented(t, ['×½', '×1', '×2'], 1, on_band=False, label='Count speed')
             + MM.note(t, 'If the count runs at half or double your steps, switch it. This clears your taps.', 'left')
             + F.label(t, 'Your 1s · 3', 12, trailing=kit.button(t, 'Clear all', 'tertiary', size='sm'))
             + ones)
    return F.pane_body(inner, max_w=SONG_W, gap=10)


def song_pane(t, s=None):
    s = s or MM.songs(t)[0]
    return F.pane(t, song_head(t, s), song_body(t, s), label_=s[0])


def song_split(t, s=None, sampling=None):
    s = s or MM.songs(t)[0]
    return F.split(t, library(t, sampling, lit=s[0]), song_pane(t, s), 'Songs')


# --------------------------------------------------------------------------
# boards
# --------------------------------------------------------------------------

def b_music(t):
    s = MM.songs(t)
    empty = F.empty_pane(t, 'music', 'Pick a song', 'Its count, the 1s you tapped and its sample open here, beside the list.',
                         kit.button(t, 'Practice with the count only', 'secondary', icon_name='metronome'))
    return board(t, F.split(t, library(t, sampling=s[2][0]), empty, 'Songs'))


def b_song(t):
    return board(t, song_split(t))


def b_adding(t):
    head = F.pane_head(t, 'La rebelión', 'Joe Arroyo · Salsa' if t['dance'] == 'salsa' else 'Joe Arroyo · Dominican',
                       actions=F.tonal(t, 'edit', 'Song details'))
    body = F.pane_body(MM.steps(t, [('done', 'Added', 'From YouTube'),
                                    ('now', 'Download', 'Waiting for the home fetcher'),
                                    ('todo', 'Find the beat', 'Beat analysis on the laptop')])
                       + MM.note(t, 'It runs on the laptop about once a minute while it is on. This page updates by itself.'),
                       max_w=SONG_W, gap=10)
    pane = F.pane(t, head, body, label_='La rebelión')
    return board(t, F.split(t, library(t, adding_lit='La rebelión'), pane, 'Songs'))


def b_search(t):
    q = 'pe' if t['dance'] == 'salsa' else 'pro'
    hits = sorted([x for x in MM.songs(t) if q in x[0].lower()], key=lambda x: x[0])
    open_ = hits[0]
    rows = [MM.song_row(t, MM.hl(t, x[0], q), MM.meta_of(x), sample=MM.sample_btn(t, x[0], disc_bg=t['surface'] if x is hits[0] else None),
                        last=False) for x in hits]
    rows = [F.lit(t, h) if x is open_ else h for h, x in zip(rows, hits)]
    if t['dance'] == 'salsa':
        rows.append(MM.song_row(t, MM.hl(t, 'Pedro Navaja', q), 'Failed: video unavailable', meta_tone='danger', last=True,
                                trailing=f'<span style="display: flex; flex: none">{kit.chevron(t)}</span>'))
    else:
        rows[-1] = rows[-1].replace(f'border-bottom: 1px solid {t["hairline"]};', '', 1)
    lst = (kit.search_field(t, 'Search songs', q, 'focused')
           + F.label(t, f'{len(rows)} matches · title or artist', 6) + MM.group(t, rows)
           + MM.note(t, 'Accents and case aside: “valio” finds Valió la pena.' if t['dance'] == 'salsa'
                     else 'Accents and case aside: “obsesion” finds Obsesión.'))
    return board(t, F.split(t, lst, song_pane(t, open_), 'Songs'))


def add_inner(t):
    return (kit.text_field(t, 'YouTube link', 'https://youtu.be/7hdQ', 'https://www.youtube.com/watch?v=…', 'focused',
                           lead_icon='youtube', input_type='url', inputmode='url', bg=t['surface'])
            + kit.text_field(t, 'Title', '', 'Song title', 'empty', optional=True, bg=t['surface'])
            + f'<div style="display: flex; flex-direction: column; gap: 2px; flex: none">{MM.field_label(t, "Style")}'
            + kit.chips(t, MM.styles(t), 0, label='Style', scroll=False) + '</div>'
            + kit.button(t, 'Add song', 'primary', full=True, on=t['sheet_bg'])
            + MM.or_rule(t)
            + kit.button(t, 'Upload an audio file', 'secondary', icon_name='upload', full=True, on=t['sheet_bg'])
            + MM.note(t, 'Up to 95 MB. It gets the style above.'))


def b_add(t):
    return board(t, song_split(t), F.dialog(t, 'Add a song', add_inner(t)))


def b_details(t):
    s = MM.songs(t)[0]
    inner = (kit.text_field(t, 'Title', s[0], 'Title', 'focused', bg=t['surface'])
             + kit.text_field(t, 'Artist', s[1], 'Artist', 'filled', bg=t['surface'])
             + f'<div style="display: flex; flex-direction: column; gap: 2px; flex: none">{MM.field_label(t, "Style")}'
             + kit.chips(t, MM.styles(t), 0, label='Style', scroll=False) + '</div>'
             + kit.button(t, 'Save', 'primary', full=True, on=t['sheet_bg'])
             + MM.note(t, 'From https://www.youtube.com/watch?v=hT9bF1d1w3c')
             + f'<div style="border-top: 1px solid {t["hairline"]}; padding-top: 6px; display: flex">'
             + kit.button(t, 'Archive song', 'danger_text', icon_name='trash', size='sm', on=t['sheet_bg']) + '</div>')
    return board(t, song_split(t), F.dialog(t, 'Song details', inner))


def b_archive(t):
    s = MM.songs(t)[0]
    q = F.question(t, 'Archive this song?', f'{s[0]} leaves Music and the song popup. Sets you logged with it stay.',
                   [kit.button(t, 'Cancel', 'tertiary', size='sm', on=t['raised']),
                    kit.button(t, 'Archive', 'danger', size='sm', on=t['raised'])], icon_name='trash', tone='danger')
    return board(t, song_split(t), q)


# --------------------------------------------------------------------------
# class songs: a member's Music, a read-only song, Make it mine, your copy
# --------------------------------------------------------------------------

def reader_body(t, s, group):
    """A class song for someone who only reads it: no taps, no count speed, no sample start."""
    inner = (kit.banner(t, 'info', f'{possessive(group)} song. The count is the teacher’s.')
             + kit.button(t, 'Practice with this song', 'secondary', icon_name='play', full=True)
             + MM.live_player(t, 5, pos=18, cur='0:52', total=s[4], anchors=(3, 34, 61), playing=False)
             + F.label(t, 'Sample', 12)
             + MM.group(t, [MM.song_row(t, f'From 1:30 <span style="margin-left: 6px; vertical-align: 1px">{kit.badge(t, "Automatic")}</span>',
                                        'A third of the way in, on a 1', kind='div', sample=MM.sample_btn(t, s[0]), last=True)]))
    return F.pane_body(inner, max_w=SONG_W, gap=10)


def reader_pane(t):
    name, songs, _ = klass(t)
    s = songs[0]
    head = F.pane_head(t, s[0], f'{s[1]} · {s[2]} · {s[3]} BPM', actions=F.tonal(t, 'edit', 'Edit song'))
    return F.pane(t, head, reader_body(t, s, name), label_=s[0])


def b_class_song(t):
    name, songs, _ = klass(t)
    lst = library(t, lit=songs[0][0], adding=False, scrolled=560)
    return board(t, F.split(t, lst, reader_pane(t), 'Songs'), dot=True, editor=False)


def b_make_mine(t):
    name, songs, _ = klass(t)
    s = songs[0]
    box = (f'<div style="background: {t["surface"]}; border-radius: 16px; padding: 16px 0; display: flex; flex-direction: column; gap: 10px; flex: none">'
           f'{kit.section_label(t, "YOU GET")}'
           f'<p style="margin: 0 16px; font-size: 15px; line-height: 1.4; color: {t["ink"]}">Its title, artist and count, to change as you like.</p>'
           f'<p style="margin: 0 16px; font-size: 14px; font-weight: 600; color: {t["muted"]}">Uses 9.8 MB of your space</p></div>')
    note = (f'<p style="margin: 0; display: flex; gap: 12px; align-items: flex-start; border-radius: 16px; background: {t["step"]}; padding: 14px; '
            f'font-size: 14px; line-height: 1.4; color: {t["ink2"]}">{kit.icon("refresh", 20, t["muted"])}'
            f'<span>Your practice of it switches to your copy.</span></p>')
    foot = (f'<div style="display: grid; grid-template-columns: 1fr 2fr; gap: 8px">{kit.button(t, "Cancel", "tertiary", full=True, on=t["sheet_bg"])}'
            f'{kit.button(t, "Make it mine", "primary", icon_name="edit", full=True, on=t["sheet_bg"])}</div>')
    dlg = F.dialog(t, f'Make {s[0]} yours?', box + note, sub='Editing makes your own copy. The class’s stays as it is.', footer=foot)
    lst = library(t, lit=s[0], adding=False, scrolled=560)
    return board(t, F.split(t, lst, reader_pane(t), 'Songs'), overlay=dlg, editor=False)


def b_song_yours(t):
    """After Make it mine: your copy, a tab per version, and what you can do with a copy."""
    name, songs, _ = klass(t)
    s = songs[0]
    head = F.pane_head(t, s[0], f'{s[1]} · {s[2]} · {s[3]} BPM', actions=F.tonal(t, 'edit', 'Song details'),
                       below=f'<div style="max-width: {SONG_W}px; width: 100%; margin: 0 auto">'
                             + kit.segmented(t, ['Yours', name], 0, on_band=False, label='Versions') + '</div>')
    acts = (f'<div style="display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 0 8px">'
            + kit.button(t, 'Copy to…', 'tertiary', icon_name='copy', size='sm')
            + kit.button(t, 'Detach', 'tertiary', icon_name='unlink', size='sm')
            + kit.button(t, 'Drop my copy', 'danger_text', icon_name='undo', size='sm') + '</div>')
    changed = (f'<div style="display: flex; align-items: center; gap: 10px; border-radius: 16px; background: {t["accent_soft"]}; padding: 8px 8px 8px 16px; '
               f'color: {t["accent_text"]}; font-size: 14px; line-height: 1.35; flex: none">{kit.icon("refresh", 18, t["accent_text"])}'
               f'<span style="flex: 1">{name} changed it since you took it: count</span>{kit.button(t, "Compare", "tertiary", size="sm", on=t["accent_soft"])}</div>')
    body = F.pane_body(changed + acts + song_body(t, s).split('gap: 10px">', 1)[1].rsplit('</div></div>', 1)[0], max_w=SONG_W, gap=10)
    pane = F.pane(t, head, body, label_=s[0])
    rows = MM.songs(t)
    mine = sorted(rows + [s], key=lambda x: x[0])
    lst = (kit.search_field(t, 'Search songs') + MM.count_only_row(t)
           + F.label(t, 'Recent', 6) + song_rows(t, [s, rows[0], rows[2]], lit=s[0])
           + F.label(t, f'All songs A–Z · {len(mine)}', 6) + song_rows(t, mine[:6], lit=s[0]))
    return board(t, F.split(t, lst, pane, 'Songs'))


# --------------------------------------------------------------------------
# group mode: the class playlist, as its teacher sees it
# --------------------------------------------------------------------------

def group_library(t, lit=None):
    name, songs, draft = klass(t)
    metas = {x[0]: f'{x[2]} · {x[3]} BPM · {x[4]}' + (f' · used by {u}' if u else '') for x, u in zip(songs, USED_BY)}
    return (kit.search_field(t, 'Search songs') + MM.count_only_row(t)
            + F.label(t, 'Drafts · 1', 6) + song_rows(t, [draft], lit=lit, badges={draft[0]: ('Draft', 'warn')})
            + F.label(t, f'Shared with the class · {len(songs)}', 6) + song_rows(t, songs, lit=lit, metas=metas))


def group_board(t, body, overlay=''):
    name = klass(t)[0]
    return F.frame(t, 'Music', 'Music', body, right=F.group_btn(t, True) + F.act(t, 'plus', 'Add a song'), overlay=overlay, group=name)


def b_group_music(t):
    t = F.in_group(t)
    name, songs, draft = klass(t)
    head = F.pane_head(t, draft[0], f'{draft[1]} · {draft[2]} · {draft[3]} BPM',
                       actions=F.tonal(t, 'more', 'Song menu') + F.tonal(t, 'edit', 'Song details'))
    share = F.pinned(t, f'<div style="flex: 1; display: flex; flex-direction: column; gap: 8px">'
                        f'<p style="margin: 0; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; color: {t["muted"]}">'
                        f'{kit.badge(t, "Draft", "warn")}Only the group’s editors see it</p>'
                        + kit.button(t, 'Share with the class', 'primary', icon_name='people', full=True) + '</div>', max_w=SONG_W)
    body = song_body(t, draft).replace(kit.button(t, 'Practice with this song', 'secondary', icon_name='play', full=True), '', 1)
    pane = F.pane(t, head, body, share, label_=draft[0])
    return group_board(t, F.split(t, group_library(t, lit=draft[0]), pane, 'Songs'))


def b_stop_sharing(t):
    t = F.in_group(t)
    name, songs, draft = klass(t)
    s = songs[0]
    head = F.pane_head(t, s[0], f'{s[1]} · {s[3]} BPM · shared 2 Oct',
                       actions=F.tonal(t, 'more', 'Song menu') + F.tonal(t, 'edit', 'Song details'))
    pane = F.pane(t, head, song_body(t, s), label_=s[0])
    q = F.question(t, f'Stop sharing {s[0]}?',
                   'Members no longer see it, and it is a draft again. Used in 4 people’s practice. '
                   'They’ll switch to count only until you share it again.',
                   [kit.button(t, 'Cancel', 'tertiary', size='sm', on=t['raised']),
                    kit.button(t, 'Stop sharing', 'primary', size='sm', on=t['raised'])], icon_name='eye-off')
    return group_board(t, F.split(t, group_library(t, lit=s[0]), pane, 'Songs'), overlay=q)


BOARDS = [
    F.Board('music', 'Music · the library, nothing open', b_music,
            'Search, Count only, Being added (badges on the second line so titles keep the 360 column), Recent, A–Z; one sample playing '
            'with its ring. The pane waits with “Pick a song”. My call: its button opens Practice with the count only.'),
    F.Board('song', 'A song open beside the library', b_song,
            'One column, 640 wide, in the phone’s order: Practice with this song, the count and transport card (your 1s as ticks), '
            'Tap on the 1, the sample, count speed, Your 1s. Song details is the pencil in the pane header.'),
    F.Board('song-adding', 'A song being added', b_adding,
            'Its three steps in the pane; the row stays lit in Being added. The page updates by itself.'),
    F.Board('music-search', 'Search typed, a match open', b_search,
            'Matches are marked in the titles; opening one keeps the search beside it (the list column is not re-rendered).'),
    F.Board('add-song', 'Add a song · a dialog', b_add,
            'The phone’s sheet as a 560 dialog: a YouTube link, or upload an audio file.'),
    F.Board('song-details', 'Song details · a dialog', b_details,
            'From the pane header’s pencil. Archive song at its foot asks first.'),
    F.Board('song-archive', 'Archive a song · the question', b_archive,
            'The kit’s small question dialog, unchanged, centred over the whole window.'),
    F.Board('class-song', 'A class song open (a member)', b_class_song,
            'Below your own songs, a section per group with every song it shares (“Salsa Tuesdays · 6”); an unopened one says New, '
            'and the Groups dot shows. The list is drawn scrolled down to it. The pane is read-only: the teacher’s count, no taps, no count speed. '
            'The pencil is Edit song, which offers Make it mine. No group button: this person only reads groups.'),
    F.Board('make-it-mine', 'Edit on a class song · Make it mine', b_make_mine,
            'The app’s Make it mine sheet as a 560 dialog: what you get, the space it uses, what of yours switches to the copy. '
            'Built in place of the phone canvas’s “Want your own count? Make my own copy” card.'),
    F.Board('song-yours', 'Your copy of a class song', b_song_yours,
            'A tab per version under the pane title (Yours | the group’s), the “changed since you took it · Compare” line, '
            'then Copy to…, Detach and Drop my copy (their dialogs are on the Moves boards). Then your own count, as any song of yours.'),
    F.Board('group-music', 'Group mode · Music, a draft song open', b_group_music,
            'Navy group mode: Drafts, then Shared with the class (with “used by 4”). The draft is a full song page for the teacher: taps, sample, count speed. '
            'Share with the class is pinned at the foot of the pane, not the window. No Practice button on a draft (it is in no one’s practice yet).'),
    F.Board('stop-sharing', 'Group mode · Stop sharing a song', b_stop_sharing,
            'From the pane’s ⋯ (History, Stop sharing, Delete). It warns, it does not refuse, when members practise to it.'),
]
