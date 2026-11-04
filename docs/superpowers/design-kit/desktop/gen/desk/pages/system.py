"""Sign in, Join, Pair, share, errors, Offline, loading and the Unsaved question on desktop."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _pss as P  # noqa: E402
from _pss import F, kit, ts, icon, CREAM  # noqa: E402

MS = P.mobile('system')

SECTION = ('system', 'Sign in, errors and loading')


# --------------------------------------------------------------------------
# outside the app: a centred card on the band colour
# --------------------------------------------------------------------------

def card_page(t, title, sub, inner, foot='', progress=False):
    """No frame: the title on the band, the phone's form in a centred 480 px card (ground, radius 28)."""
    s = f'<p style="margin: 0; {ts("subtitle", t["band_small"])}">{sub}</p>' if sub else ''
    card = (f'<div style="width: 480px; box-sizing: border-box; background: {t["ground"]}; border-radius: 28px; padding: 24px; '
            f'display: flex; flex-direction: column; gap: 12px; box-shadow: 0 24px 60px {t["band_shadow"]}">{inner}</div>')
    f = (f'<p style="margin: 0; text-align: center; font-size: 13px; color: {t["band_small"]}; max-width: 420px; line-height: 1.45">{foot}</p>' if foot else '')
    body = (f'<div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px">'
            f'<div style="width: 480px; display: flex; flex-direction: column; gap: 8px; padding-left: 8px; box-sizing: border-box">'
            f'<h1 style="margin: 0; {ts("display", CREAM)}">{title}</h1>{s}</div>{card}{f}</div>')
    return F.root(t, body + (P.nav_bar(t) if progress else ''))


def form_card(t, fields):
    return (f'<form style="background: {t["surface"]}; border-radius: 22px; padding: 20px 16px 16px; display: flex; flex-direction: column; gap: 16px; flex: none">'
            f'{fields}</form>')


def sign_in(t):
    f = t['field']
    fields = (kit.text_field(t, 'Email', 'me@example.com', state='filled', input_type='email', bg=f)
              + kit.text_field(t, 'Password', 'correct horse', state='focused', input_type='password', bg=f)
              + kit.button(t, 'Sign in', 'primary', size='lg', full=True, on=t['surface']))
    return card_page(t, 'Sign in', 'Welcome back. Sign in to practise.', form_card(t, fields), 'Registration is closed.')


def name_fields(t, first='', last='', first_state='empty', last_state='empty'):
    f = t['field']
    return (kit.text_field(t, 'First name', first, state=first_state, bg=f)
            + kit.text_field(t, 'Last name', last, state=last_state, bg=f))


def join(t):
    f = t['field']
    fields = (name_fields(t, 'Lea', 'Novak', 'filled', 'filled')
              + kit.text_field(t, 'Email', 'lea@example.com', state='filled', input_type='email', bg=f)
              + kit.text_field(t, 'Password', '', state='empty', input_type='password', bg=f)
              + kit.button(t, 'Create account', 'primary', size='lg', full=True, on=t['surface']))
    return card_page(t, 'Join', 'You were invited', form_card(t, fields),
                     'At least 12 characters, mixing three of lower, upper, digit and symbol.')


def welcome(t):
    fields = (name_fields(t, 'Ana', '', 'filled', 'focused')
              + kit.button(t, 'Continue', 'primary', size='lg', full=True, on=t['surface']))
    return card_page(t, 'Welcome', 'What should we call you?', form_card(t, fields),
                     'Friends in a group see this instead of your email.')


def qr(t, n=25, cell=7, seed=7):
    """A drawn QR code (finder squares and a fixed pseudo-random fill); it stands for the page's URL."""
    import random
    rnd = random.Random(seed)
    ink = '#111114'
    rects = []

    def finder(x, y):
        rects.append(f'<rect x="{x * cell}" y="{y * cell}" width="{7 * cell}" height="{7 * cell}" fill="{ink}"/>'
                     f'<rect x="{(x + 1) * cell}" y="{(y + 1) * cell}" width="{5 * cell}" height="{5 * cell}" fill="#ffffff"/>'
                     f'<rect x="{(x + 2) * cell}" y="{(y + 2) * cell}" width="{3 * cell}" height="{3 * cell}" fill="{ink}"/>')
    for yy in range(n):
        for xx in range(n):
            if (xx < 8 and yy < 8) or (xx > n - 9 and yy < 8) or (xx < 8 and yy > n - 9):
                continue
            if rnd.random() < 0.48:
                rects.append(f'<rect x="{xx * cell}" y="{yy * cell}" width="{cell}" height="{cell}" fill="{ink}"/>')
    finder(0, 0); finder(n - 7, 0); finder(0, n - 7)
    w = n * cell
    return (f'<svg role="img" aria-label="QR code for this page" width="{w + 24}" height="{w + 24}" viewBox="-12 -12 {w + 24} {w + 24}" '
            f'style="background: #ffffff; border-radius: 12px; flex: none">{"".join(rects)}</svg>')


def get_app(t):
    inner = (P.para(t, 'Practise from your phone’s home screen.')
             + f'<div style="background: {t["surface"]}; border-radius: 16px; padding: 20px 16px; display: flex; flex-direction: column; align-items: center; gap: 14px; flex: none">'
             + f'<p style="margin: 0; {ts("title", t["ink"])}">Open this page on your phone.</p>{qr(t)}</div>'
             + f'<div style="display: flex; justify-content: center">{kit.button(t, "Skip, use it in the browser", "tertiary")}</div>')
    return card_page(t, 'Get the app', None, inner)


def pair(t):
    inner = (MS.status_block(t, 'phone', 'Pair this phone', MS.PAIR_BODY).replace('padding: 40px 20px 0', 'padding: 12px 20px 4px')
             + kit.button(t, 'Pair this phone', 'primary', icon_name='link', size='lg', full=True))
    return card_page(t, 'Pair the app', None, inner)


# --------------------------------------------------------------------------
# inside the app
# --------------------------------------------------------------------------

def share(t):
    rows = []
    for i, (title, day) in enumerate(MS.LESSONS):
        if i == 0:
            rows.append(dict(title=title, meta=day, leading=MS.lead_tile(t, 'lessons'), state='pressed', href='#', trailing=kit.spinner(t, 22)))
        else:
            rows.append(dict(title=title, meta=day, leading=MS.lead_tile(t, 'lessons'), href='#', trailing=kit.chevron(t)))
    draft = f'<span style="display: inline-flex; align-items: center; gap: 8px">Week 6 · Setenta variations{kit.badge(t, "Draft", "warn")}</span>'
    grows = [dict(title=draft, meta='3 Nov 2026', leading=MS.lead_tile(t, 'lessons'), href='#', trailing=kit.chevron(t)),
             dict(title='Week 5 · Enchufla doble', meta='27 Oct 2026', leading=MS.lead_tile(t, 'lessons'), href='#', trailing=kit.chevron(t))]
    body = (kit.section_label(t, 'Recent lessons') + kit.list_group(t, rows, label='Lessons')
            + kit.section_label(t, 'Salsa Tuesdays', 8) + kit.list_group(t, grows, label='Salsa Tuesdays'))
    return F.frame(t, None, 'Add to a lesson', F.page(body, max_w=560), sub='Compressed and uploaded in the background', side=False)


def not_found(t):
    body = MS.status_block(t, 'search', 'Nothing here', 'This page does not exist, or what it showed was deleted.',
                           f'<div style="width: 280px">{kit.button(t, "Go to Today", "primary", icon_name="calendar", full=True)}</div>', code='ERROR 404')
    return F.frame(t, 'Moves', 'Not found', F.page(f'<div style="height: 90px"></div>' + body, max_w=560), back=F.back_btn(t, 'Moves'))


def offline(t):
    body = MS.status_block(t, 'refresh', 'You’re offline',
                           'This page needs the server. Check the connection and try again; nothing you saved is lost.',
                           f'<div style="width: 280px">{kit.button(t, "Try again", "primary", icon_name="refresh", full=True)}</div>', tone='warn')
    return F.frame(t, None, 'Offline', F.page(f'<div style="height: 90px"></div>' + body, max_w=560), back=F.back_btn(t, 'Lessons'), side=False)


def loading(t):
    b = P.bone
    lst = (f'<span role="status" style="{kit.SR}">Loading…</span>'
           + b(t, '100%', 44, 22)
           + f'<div style="display: flex; gap: 8px">{b(t, "50%", 64, 16)}{b(t, "50%", 64, 16)}</div>'
           + f'<div style="display: flex; gap: 8px; flex-wrap: wrap">{"".join(b(t, f"{w}px", 34, 17) for w in (52, 102, 64, 52, 104, 60))}</div>'
           + b(t, '80px', 11, extra='margin: 8px 4px 0') + kit.skeleton_rows(t, 7))
    card = (f'<div aria-hidden="true" style="background: {t["surface"]}; border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 12px; flex: none">'
            f'{b(t, "40%", 14)}{b(t, "85%", 12)}{b(t, "70%", 12)}{b(t, "55%", 12)}</div>')
    head = (f'<div aria-hidden="true" style="padding: 26px 40px 4px; display: flex; flex-direction: column; gap: 14px; flex: none">'
            f'{b(t, "220px", 30, 8)}<div style="display: flex; gap: 8px">{b(t, "70px", 36, 18)}{b(t, "80px", 36, 18)}{b(t, "110px", 36, 18)}</div></div>')
    left = card + kit.skeleton_rows(t, 2) + card
    right = (b(t, '90px', 11, extra='margin: 4px 4px 0')
             + f'<div aria-hidden="true" style="aspect-ratio: 16 / 9; border-radius: 16px; background: {t["skeleton"]}; flex: none"></div>'
             + kit.skeleton_rows(t, 2))
    pane = F.pane(t, head, F.pane_cols(left, right))
    return F.frame(t, 'Moves', 'Moves', F.split(t, lst, pane, 'Figures'), center=F.seg(t, ['Figures', 'Routines', 'Positions'], 0, 'Moves', width=420),
                   right=F.group_btn(t) + F.act(t, 'plus', 'New move'), overlay=P.nav_bar(t))


def reload_bar(t, stale=False):
    """New version · Reload, pinned to the foot of the sheet; stale: the server refused this page (the page epoch)."""
    text = ('<span style="flex: 1; min-width: 0; font-size: 15px; line-height: 1.35; font-weight: 800; color: %s">%s</span>'
            % (t['ink'], 'This page is out of date. Reload to continue.' if stale else 'New version'))
    return F.pinned(t, f'<span style="display: flex; flex: none">{icon("info", 20, t["accent_text"], filled=True, bg=t["ground"])}</span>{text}'
                       + kit.button(t, 'Reload', 'secondary', size='sm'), max_w=560)


def bars_body(t):
    return (P.para(t, 'Pick the best bar for each half. Listen before you keep it: a rushed or muttered one is worse than the built-in voice.')
            + kit.section_label(t, 'First half', 6) + MS.half_card(t, '1 2 3', 0)
            + kit.section_label(t, 'Second half', 6) + MS.half_card(t, '5 6 7', 2))


def new_version(t):
    PS = P.area('settings')
    body = F.page(PS.settings_body(t), footer=reload_bar(t))
    return P.settings_frame(t, 'Settings', body)


def out_of_date(t):
    body = F.page(bars_body(t), footer=reload_bar(t, stale=True))
    return P.settings_frame(t, 'Pick the bars', body, sub='1 2 3 · 5 6 7 at 152 BPM', back=F.back_btn(t, 'My count'))


def unsaved(t):
    body = (P.para(t, 'Pick the best bar for each half. Listen before you keep it: a rushed or muttered one is worse than the built-in voice.')
            + kit.section_label(t, 'First half', 6) + MS.half_card(t, '1 2 3', 0)
            + kit.section_label(t, 'Second half', 6) + MS.half_card(t, '5 6 7', 2))
    foot = F.pinned(t, f'<div style="flex: 1; display: flex">{kit.button(t, "Record again", "secondary", icon_name="refresh", size="lg", full=True)}</div>'
                       f'<div style="flex: 1; display: flex">{kit.button(t, "Keep these", "primary", icon_name="check", size="lg", full=True)}</div>')
    r = t['raised']
    q = F.question(t, 'Unsaved changes', 'Your recorded count is not saved yet.', [MS.stacked([
        kit.button(t, 'Save', 'primary', full=True, on=r),
        kit.button(t, 'Stay', 'secondary', full=True, on=r),
        kit.button(t, 'Leave without saving', 'danger_text', full=True, on=r)])], icon_name='edit', tone='accent')
    return P.settings_frame(t, 'Pick the bars', F.page(body, footer=foot), sub='1 2 3 · 5 6 7 at 152 BPM',
                   back=F.back_btn(t, 'My count'), overlay=q)


BOARDS = [
    F.Board('sign-in', 'Sign in', sign_in,
            'No frame: nothing to navigate to yet. The title on the band, the phone’s form in a centred 480 px card. My call.'),
    F.Board('join', 'Join (from an invite)', join, 'The same card as Sign in. Now asks for first and last name too.'),
    F.Board('welcome', 'Welcome · your name, asked once', welcome,
            'Someone without a name is asked once, before anything else, the next time they open the app. The same card as Sign in.'),
    F.Board('get-the-app', 'Get the app, on a computer', get_app,
            'After Join, and from Settings. On a PC it only says to open the page on the phone, with a QR of its URL; '
            'the phone gets Download (Android) or Add to Home Screen (iPhone). No side: it sits between Join and the app, like Sign in (my call).'),
    F.Board('pair', 'Pair this phone', pair, 'Opened by the Android app; the same card if it ever shows on a PC.'),
    F.Board('share', 'Add to a lesson (share target)', share,
            'No side, as on the phone. One column at 560. It is the Android share target and not expected on a PC. '
            'Below your own lessons, the group lessons you edit, under the group; a draft says so.'),
    F.Board('not-found', '404 inside the app', not_found,
            'Keeps the frame and the side; the error centred at 560. The side lights the tab of the page that was asked for (Moves here; my call).'),
    F.Board('offline', 'Offline', offline,
            'The Offline layer covers the whole window, side included; ‹ dismisses it and goes back to the page under it.'),
    F.Board('loading', 'Loading a list and its item', loading,
            'The frame is drawn at once; both panes get skeletons shaped like the page; the cream progress bar runs along the top edge.'),
    F.Board('new-version', 'A new version is out', new_version,
            'The site was deployed while the page stayed open. The next click on another page reloads by itself; '
            'until then a slim bar sits at the foot of the sheet (above the phone’s tab bar there). Reload still asks about anything unsaved.'),
    F.Board('out-of-date', 'This page is out of date', out_of_date,
            'A breaking deploy: the server refuses what this page sends. With nothing unsaved it just reloads; with unsaved work '
            '(the picked bars here) the bar says so and waits for Reload. Update needed and Update available are Android-app only, so not drawn here.'),
    F.Board('unsaved', 'Unsaved changes', unsaved,
            'Clicking a side item (or ‹, Esc on a dialog) with unsaved work asks first, as on the phone. The kit’s small question dialog, centred over the whole window.'),
]
