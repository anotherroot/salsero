"""Settings on desktop: the side with Settings lit, one column at 720. What uses space, My count and
the admin page the same way, each with ‹ to Settings."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _pss as P  # noqa: E402
from _pss import F, kit, ts, icon  # noqa: E402

MS = P.mobile('system')

SECTION = ('settings', 'Settings')

APP = {'salsa': 'Salsa app', 'bachata': 'Bachata app'}


def lead(t, name):
    return MS.lead_tile(t, name)


def meter(t, pct):
    return (f'<div role="meter" aria-label="Space used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="{pct}" '
            f'style="height: 8px; border-radius: 4px; background: {t["chip"]}; overflow: hidden; flex: none">'
            f'<div style="width: {pct}%; height: 8px; border-radius: 4px; background: {t["accent"]}"></div></div>')


def frame(t, title, body, sub=None, back=True, center='', overlay='', footer='', max_w=720):
    return P.settings_frame(t, title, F.page(body, max_w=max_w, footer=footer), sub=sub,
                   back=F.back_btn(t, 'Settings') if back else None, center=center, overlay=overlay)


# --------------------------------------------------------------------------
# Settings
# --------------------------------------------------------------------------

def settings_body(t):
    d = t['dance']
    usage = (f'<div style="display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-bottom: 1px solid {t["hairline"]}">'
             f'<span style="{ts("title", t["ink"])}">Using 820 MB of 1.0 GB</span>{meter(t, 80)}</div>')
    storage = kit.section_label(t, 'Storage') + (
        f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">{usage}'
        + kit.row(t, 'What uses space', 'Biggest first, with Delete', kit.chevron(t), leading=lead(t, 'sliders'), href='#')
        + kit.row(t, 'Ask for more', None, kit.chevron(t), href='#', last=True, min_h=58) + '</div>')
    practice = kit.section_label(t, 'Practice', 14) + kit.list_group(t, [
        kit.row(t, 'My count', '9 of 21 tempos in your own voice', kit.chevron(t), leading=lead(t, 'mic'), href='#'),
        kit.picker_row(t, 'New figures start on', MS.STYLE[d], last=True),
    ])
    look = kit.section_label(t, 'Appearance', 14) + kit.list_group(t, [kit.picker_row(t, 'Theme', 'System', last=True)]) \
        + MS.caption(t, 'For this browser or phone only.', 2)
    get_app = '<div style="height: 6px; flex: none"></div>' + kit.list_group(t, [
        kit.row(t, 'Get the app', 'For your phone’s home screen', kit.chevron(t), leading=lead(t, 'phone'), href='#', last=True)])
    app = kit.section_label(t, 'Android app', 14) + kit.list_group(t, [
        kit.row(t, 'Daily reminder', 'What is due, as a notification', kit.switch(t, True, label='Daily reminder'), leading=lead(t, 'bell')),
        kit.row(t, 'Time', None, MS.time_pill(t, '19:30'), min_h=60),
        kit.picker_row(t, 'Compress videos to', '480p', last=True),
    ]) + MS.caption(t, 'Read by the phone app when it opens.', 2)
    phones = kit.section_label(t, 'Paired phones', 14) + kit.list_group(t, [
        dict(title=APP[d], meta='Paired 28 Oct 2026 · last used today', leading=lead(t, 'phone'),
             trailing=kit.button(t, 'Remove', 'danger_text', size='sm', on=t['surface'], aria=f'Remove {APP[d]}')),
    ])
    admin = kit.section_label(t, 'Admin', 14) + kit.list_group(t, [
        kit.row(t, 'Admin', 'Invite someone', kit.chevron(t), leading=lead(t, 'people'), href='#', last=True)])
    account = kit.section_label(t, 'Account', 14) + kit.list_group(t, [
        kit.picker_row(t, 'Name', 'Ana Kranjc'),
        dict(title='ana@example.com', meta='Signed in', leading=lead(t, 'solo'),
             trailing=kit.button(t, 'Sign out', 'tertiary', icon_name='logout', size='sm', on=t['surface'])),
    ])
    return storage + practice + look + get_app + app + phones + admin + account


def settings(t, overlay=''):
    return frame(t, 'Settings', settings_body(t), back=False, overlay=overlay)


def name_dialog(t):
    f = t['surface']
    inner = (P.para(t, 'Friends in a group see this instead of your email.')
             + kit.text_field(t, 'First name', 'Ana', state='focused', bg=f)
             + kit.text_field(t, 'Last name', 'Kranjc', state='filled', bg=f))
    foot = kit.button(t, 'Save', 'primary', full=True, on=t['sheet_bg'])
    return settings(t, F.dialog(t, 'Name', inner, footer=foot))


def new_figures_style(t):
    d = t['dance']
    inner = (P.para(t, 'The style a new figure starts on. You can change it on the figure.')
             + kit.radio_group(t, 'Style', ['Salsa', 'Son', 'Timba', 'Other'] if d == 'salsa' else MS.STYLES[d], 0))
    return settings(t, F.dialog(t, 'New figures start on', inner))


# --------------------------------------------------------------------------
# My count
# --------------------------------------------------------------------------

def my_count(t):
    intro = P.para(t, 'Record yourself counting and the player uses your voice. A tempo with nothing recorded uses the built-in count.')
    done = sum(1 for _, s in MS.LADDER if s == 'done')
    takes = kit.section_label(t, 'Recorded takes', 14) + kit.list_group(t, [
        dict(title=f'{b} BPM · counts {c}', meta=f'1 2 3 · 5 6 7 · phrase {p}',
             trailing=kit.icon_button(t, 'trash', f'Delete {b} BPM phrase {p}', 'bare', color=t['danger'], on=t['surface']))
        for b, c, p in [(120, '1 2 3', 'A'), (120, '5 6 7', 'B'), (130, '1 2 3', 'A')]])
    body = intro + kit.section_label(t, f'Tempos · {done} of 7 recorded', 6) + MS.tempo_rows(t, MS.LADDER) + takes
    return frame(t, 'My count', body, center=F.seg(t, MS.PATTERNS, 0, 'Count pattern', width=480))


def my_count_recording(t):
    live = (f'<span style="display: inline-flex; align-items: center; gap: 8px; height: 30px; padding: 0 12px; border-radius: 15px; background: {t["danger_soft"]}; '
            f'color: {t["danger"]}; font-size: 13px; font-weight: 800"><span style="width: 8px; height: 8px; border-radius: 4px; background: {t["danger"]}"></span>Recording</span>')
    hero = (f'<div style="background: {t["surface"]}; border-radius: 22px; padding: 40px 32px 40px; display: flex; flex-direction: column; align-items: center; gap: 24px; flex: none">'
            f'{live}'
            f'<p role="status" style="margin: 0; text-align: center"><span style="display: block; {ts("number_l", t["ink"])}; font-size: 56px">Bar 2 of 4</span>'
            f'<span style="display: block; margin-top: 10px; font-size: 18px; font-weight: 600; color: {t["muted"]}">Say <strong style="color: {t["ink"]}">5</strong> now</span></p>'
            f'{MS.count_dots(t).replace("width: 34px; height: 34px; border-radius: 17px", "width: 44px; height: 44px; border-radius: 22px").replace("gap: 9px", "gap: 14px")}'
            f'<div style="width: 100%; max-width: 480px">{MS.bar_segments(t)}</div></div>')
    hint = MS.caption(t, 'Stop keeps the whole bars you counted. Redo throws them away and starts the count-in again.', 6)
    foot = F.pinned(t, f'<div style="flex: 1; display: flex">{kit.button(t, "Redo", "secondary", icon_name="refresh", size="lg", full=True)}</div>'
                       f'<div style="flex: 1; display: flex">{kit.button(t, "Stop", "primary", icon_name="stop", size="lg", full=True)}</div>')
    return frame(t, 'Recording', '<div style="height: 48px"></div>' + hero + hint, sub='1 2 3 · 5 6 7 at 152 BPM', footer=foot)


# --------------------------------------------------------------------------
# What uses space
# --------------------------------------------------------------------------

def storage_items(t):
    salsa = t['dance'] == 'salsa'
    return [
        ('Lesson video', False, 'Lesson · Cubana class', '312 MB', True),
        ('Lesson video', False, 'Lesson · Turn pattern workshop', '188 MB', True),
        ('Recording', False, 'Enchufla · Doble' if salsa else 'Hammerlock · Basic', '96 MB', True),
        ('Lesson video', True, 'Lesson · Bootcamp day 2', '74 MB', True),
        ('Recording', False, 'Setenta · Basic' if salsa else 'Cuddle turn · Basic', '41 MB', True),
        ('Vivir mi vida' if salsa else 'Propuesta indecente', False, 'Song · Marc Anthony' if salsa else 'Song · Romeo Santos', '9.8 MB', True),
        ('Quimbara' if salsa else 'Obsesión', False, 'Song · Celia Cruz' if salsa else 'Song · Aventura', '7.6 MB', True),
        ('Your count voice', False, '18 takes', '2.1 MB', False),
    ]


def storage(t):
    rows = ''
    items = storage_items(t)
    for i, (title, archived, ctx, size, deletable) in enumerate(items):
        badge = kit.badge(t, 'archived') if archived else ''
        hair = '' if i == len(items) - 1 else f'border-bottom: 1px solid {t["hairline"]};'
        label = (f'<span style="display: flex; align-items: center; gap: 8px"><span style="{ts("title", t["ink"])}">{title}</span>{badge}</span>'
                 f'<span style="font-size: 13px; color: {t["muted"]}">{ctx} · {size}</span>')
        main = (f'<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px">{label}</div>' if archived else
                f'<a href="#" style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; text-decoration: none">{label}</a>')
        tr = (kit.button(t, 'Delete', 'danger_text', size='sm', on=t['surface'], aria=f'Delete {title}, {ctx}') if deletable
              else f'<span style="padding-right: 8px; display: flex">{kit.chevron(t)}</span>')
        rows += (f'<li style="list-style: none; padding-left: 16px"><div style="display: flex; align-items: center; gap: 12px; min-height: 64px; '
                 f'padding: 8px 6px 8px 0; box-sizing: border-box; {hair}">{main}{tr}</div></li>')
    lst = f'<ul style="margin: 0; padding: 0; background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">{rows}</ul>'
    body = (f'<div style="padding: 4px 16px 0">{meter(t, 80)}</div>' + kit.section_label(t, 'Biggest first', 14) + lst
            + MS.caption(t, 'Deleting is how you free space. Archived things keep their files until you delete them here.', 4))
    return frame(t, 'What uses space', body, sub='Using 820 MB of 1.0 GB')


# --------------------------------------------------------------------------
# Admin
# --------------------------------------------------------------------------

def limit_fields(t):
    presets = ''.join(kit.button(t, f'{g} GB', 'secondary', size='sm', on=t['surface']) for g in (2, 5, 10))
    return (f'<div style="display: flex; gap: 8px; flex-wrap: wrap">{presets}</div>'
            + kit.text_field(t, 'Or a number of GB', '', '', 'empty', bg=t['field']))


def request_card(t, title, uses, note):
    return (f'<div style="background: {t["surface"]}; border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 14px; flex: none">'
            f'<div style="display: flex; flex-direction: column; gap: 2px"><span style="{ts("title", t["ink"])}">{title}</span>'
            f'<span style="font-size: 13px; color: {t["muted"]}">{uses}</span>'
            f'<p style="margin: 4px 0 0; font-size: 14px; line-height: 1.45; color: {t["ink2"]}">{note}</p></div>'
            + limit_fields(t)
            + kit.button(t, 'Give more', 'primary', full=True, on=t['surface'])
            + kit.button(t, 'Decline', 'tertiary', full=True, on=t['surface']) + '</div>')


def lines(t, title, *metas):
    m = ''.join(f'<span style="font-size: 13px; line-height: 1.35; color: {t["muted"]}">{x}</span>' for x in metas)
    return (f'<a href="#" style="display: flex; align-items: center; gap: 12px; padding: 10px 14px 10px 16px; text-decoration: none; min-height: 64px; box-sizing: border-box">'
            f'<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px"><span style="{ts("title", t["ink"])}">{title}</span>{m}</span>'
            f'{kit.chevron(t)}</a>')


def card_list(t, rows):
    inner = ''.join(r if i == len(rows) - 1 else r + f'<div style="height: 1px; background: {t["hairline"]}; margin-left: 16px"></div>' for i, r in enumerate(rows))
    return f'<div style="background: {t["surface"]}; border-radius: 16px; overflow: hidden; flex: none">{inner}</div>'


GROUPS = [('Salsa Tuesdays', 'salsa · Ana Kranjc · 15 people · 2.8 GB of 3.0 GB'),
          ('Bachata Thursdays', 'bachata · Luka Novak · 8 people · 610 MB of 1.6 GB'),
          ('Rueda club', 'salsa · Maja Horvat · 4 people · 120 MB of 800 MB · deleted')]
PEOPLE = [('me@example.com', 'Joined 30 Sep 2026 · 820 MB, no limit', '1 group made · limit 2', 'Salsa app 5 · today', 'Bachata app 5 · yesterday'),
          ('ana@example.com', 'Joined 2 Nov 2026 · 1.0 GB of 1.0 GB', '2 groups made · limit 2', 'Salsa app 5 · today', 'Bachata: no app'),
          ('luka@example.com', 'Joined 2 Nov 2026 · 140 MB of 1.0 GB', '1 group made · limit 2', 'Salsa: no app', 'Bachata app 4 · 1 Nov'),
          ('maja@example.com', 'Joined 3 Nov 2026 · 0 B of 1.0 GB', '1 group made · limit 3', 'Salsa: no app', 'Bachata: no app')]


def admin_body(t):
    top = (f'<p style="margin: 0 0 6px; padding: 0 4px; font-size: 13px; color: {t["muted"]}">Limits add up to 14 GB · 22 GB free</p>')
    left = (kit.section_label(t, 'Waiting · 2')
            + request_card(t, 'ana@example.com', 'Uses 1.0 GB of 1.0 GB', 'Uploading this term’s class videos, about 20 more.')
            + request_card(t, 'Salsa Tuesdays · ana@example.com', 'Uses 2.8 GB of 3.0 GB', 'The class records every week; we’re nearly full.')
            + kit.section_label(t, 'Invite someone', 14)
            + kit.list_group(t, [kit.row(t, 'Invite someone', 'One link, works once, for 24 hours', None, leading=lead(t, 'plus'), href='#', last=True, min_h=64)]))
    right = (kit.section_label(t, 'Groups')
             + card_list(t, [lines(t, n, m) for n, m in GROUPS])
             + kit.section_label(t, 'People', 14)
             + card_list(t, [lines(t, *p) for p in PEOPLE]))
    return top, left, right


def admin(t, overlay=''):
    top, left, right = admin_body(t)
    body = F.two_col_page(left, right, top=top)
    return P.settings_frame(t, 'Admin', body, back=F.back_btn(t, 'Settings'), overlay=overlay)


def admin_person(t):
    f = t['field']
    inner = (P.para(t, 'Joined 2 Nov 2026 · 1.0 GB of 1.0 GB', t['muted'], 14)
             + limit_fields(t)
             + kit.button(t, 'No limit', 'secondary', full=True, on=t['sheet_bg'])
             + f'<div style="height: 1px; background: {t["hairline"]}; margin: 4px 0; flex: none"></div>'
             + P.para(t, '2 groups made · limit 2', t['muted'], 14)
             + kit.text_field(t, 'Groups they may make', '3', state='focused', input_type='number', bg=f)
             + kit.button(t, 'Set group limit', 'primary', full=True, on=t['sheet_bg'])
             + kit.button(t, 'Use the default', 'secondary', full=True, on=t['sheet_bg']))
    return admin(t, F.dialog(t, 'ana@example.com', inner))


BOARDS = [
    F.Board('settings', 'Settings', settings,
            'Settings lives in the side (lit here), so the band has no ‹ and Today’s band loses its sliders icon. One column at 720. Rows save on change. '
            'New: Get the app (in a browser only) and Name under Account. The app’s Version row shows only inside the Android app, so never on a PC.'),
    F.Board('name', 'Settings · Name', name_dialog,
            'New under Account: first and last name, the ones Join and Welcome ask for. Friends in a group see it instead of the email.'),
    F.Board('new-figures-style', 'Settings · New figures start on', new_figures_style,
            'A picker sheet becomes a dialog (4B), as tall as its content.'),
    F.Board('my-count', 'My count', my_count,
            'The count pattern is the band’s toggle, centred over the sheet. ‹ goes back to Settings (or Practice, where it was opened from).'),
    F.Board('my-count-recording', 'My count · recording a take', my_count_recording,
            'The bar and the count to say get bigger on desktop (my call: the PC sits further from you than a phone). Redo and Stop pinned at the bottom of the sheet.'),
    F.Board('storage', 'What uses space', storage,
            'Pushed from Settings; usage in the subtitle and the bar. Archived items are not links; the count voice opens My count.'),
    F.Board('admin', 'Admin', admin,
            'Two columns now that it has grown (my call; the phone is one): what waits for you on the left — a person’s and a group’s '
            'request for more, then Invite; Groups and People on the right, each person with the groups they made and their app versions. '
            'The line above both sums every limit beside the free disk.'),
    F.Board('admin-person', 'Admin · a person’s limits', admin_person,
            'A person row opens one dialog with both limits: storage (2, 5, 10 GB, a number, No limit), then how many groups they may make. '
            'A group row opens the same storage half.'),
]
