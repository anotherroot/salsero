"""Settings, My count (voice), sign-in, pairing, share target, the Unsaved dialog,
page loading and error pages — redrawn in the C4 look with the kit.

    python3 -I system.py   -> canvas/project/S-system.dc.html
"""
import sys

S = '/tmp/claude-1000/-home-tilen-Projects-salsaapp-wt-app-icons/cf18291b-f44a-483d-bf97-2da9a238a117/scratchpad'
sys.path.insert(0, S + '/gen/kit')
import kit  # noqa: E402

OUT = S + '/canvas/project/S-system.dc.html'
CREAM = kit.CREAM

# --------------------------------------------------------------------------
# local building blocks (built from kit tokens only)
# --------------------------------------------------------------------------


def lead_tile(t, name):
    """A 36px tonal rounded square holding an icon: the leading mark of a settings row."""
    return (f'<span style="width: 36px; height: 36px; border-radius: 10px; background: {t["accent_soft"]}; display: flex; '
            f'align-items: center; justify-content: center; flex: none">{kit.icon(name, 20, t["accent_text"])}</span>')


def time_pill(t, value, state='default', label='Reminder time'):
    """The reminder time as the approved number pill, but a real <input type="time">."""
    fid = kit.uid('time')
    bg = t['field']
    sh = f'box-shadow: {kit.ring(t)};' if state == 'focused' else ''
    ink = t['ink']
    dis = ''
    if state == 'disabled':
        bg, ink, dis = t['disabled_bg'], t['disabled_ink'], ' disabled'
    return (f'<label for="{fid}" style="{kit.SR}">{label}</label>'
            f'<input id="{fid}" type="text" inputmode="numeric" value="{value}"{dis} style="width: 96px; height: 44px; box-sizing: border-box; border-radius: 22px; border: 0; '
            f'background: {bg}; {sh} font: inherit; {kit.ts("number")}; color: {ink}; text-align: center; outline: none; padding: 0; flex: none; margin-right: 6px">')


def caption(t, text, top=0):
    return f'<p style="margin: {top}px 16px 0; font-size: 13px; line-height: 1.4; color: {t["muted"]}">{text}</p>'


def para(t, text, color=None):
    return f'<p style="margin: 0 4px; font-size: 15px; line-height: 1.5; color: {color or t["ink2"]}">{text}</p>'


def nav_bar(t):
    """NavProgress: a 3px bar running along the top while a navigation is in flight.
    Cream on the band (the accent would vanish on salsa's band)."""
    return (f'<div aria-hidden="true" style="position: absolute; left: 0; right: 0; top: 0; height: 3px; overflow: hidden; z-index: 5">'
            f'<div style="position: absolute; left: 22%; width: 40%; height: 3px; border-radius: 0 2px 2px 0; background: {CREAM}"></div></div>')


def bone(t, w, h, r=6, on_band=False, extra=''):
    bg = 'rgba(255,243,228,0.24)' if on_band else t['skeleton']
    return f'<span aria-hidden="true" style="display: block; width: {w}; height: {h}px; border-radius: {r}px; background: {bg}; flex: none; {extra}"></span>'


def scrolled(body, px):
    """The sheet's content scrolled up by ``px`` (clipped under the band's rounded edge)."""
    return (f'<div style="flex: 1; min-height: 0; overflow: hidden; margin: -20px -16px 0; padding: 20px 16px 0; border-radius: 28px 28px 0 0">'
            f'<div style="margin-top: -{px}px; display: flex; flex-direction: column; gap: 8px">{body}</div></div>')


def status_block(t, icon_name, title, body, actions='', tone='accent', code=None):
    """A centred full-page message (error pages): icon in a soft circle, Bricolage title, body, actions."""
    soft = {'accent': 'accent_soft', 'danger': 'danger_soft', 'warn': 'warn_soft', 'done': 'done_soft'}[tone]
    ink = {'accent': 'accent_text', 'danger': 'danger', 'warn': 'warn', 'done': 'done'}[tone]
    cd = (f'<span style="font-size: 12px; font-weight: 800; letter-spacing: 0.08em; color: {t["muted"]}">{code}</span>') if code else ''
    return (f'<div style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 40px 20px 0; flex: none">'
            f'<span style="width: 80px; height: 80px; border-radius: 40px; background: {t[soft]}; display: flex; align-items: center; justify-content: center; margin-bottom: 6px">'
            f'{kit.icon(icon_name, 36, t[ink])}</span>{cd}'
            f'<h3 style="margin: 0; {kit.ts("headline", t["ink"])}">{title}</h3>'
            f'<p style="margin: 0; max-width: 290px; font-size: 15px; line-height: 1.5; color: {t["muted"]}">{body}</p>'
            f'<div style="display: flex; flex-direction: column; gap: 8px; align-items: center; margin-top: 14px; width: 100%">{actions}</div></div>')


def back(t, to):
    return kit.band_button(t, 'back', f'Back to {to}')


def pushed(t, title, to, body, subtitle=None, extra=None, footer='', overlay='', pad=None, tall=True, top=None):
    header = kit.band_header(t, title, subtitle, left=back(t, to) if to else None, extra=extra, tall=tall)
    inner = (top or '') + header + kit.sheet(t, body, pad or '20px 16px 0') + footer + overlay
    return kit.phone(t, inner)


# --------------------------------------------------------------------------
# Settings
# --------------------------------------------------------------------------

STYLE = {'salsa': 'Salsa', 'bachata': 'Sensual'}
STYLES = {'salsa': ['Salsa', 'Son', 'Other'], 'bachata': ['Dominican', 'Sensual', 'Traditional']}
APP = {'salsa': 'Salsa app', 'bachata': 'Bachata app'}


def settings_body(t, time_state='default', reminder_on=True):
    d = t['dance']
    practice = kit.section_label(t, 'Practice') + kit.list_group(t, [
        kit.row(t, 'My count', '9 of 21 tempos in your own voice', kit.chevron(t), leading=lead_tile(t, 'mic'), href='#'),
        kit.picker_row(t, 'New figures start on', STYLE[d], last=True),
    ])
    app = kit.section_label(t, 'Android app', 14) + kit.list_group(t, [
        kit.row(t, 'Daily reminder', 'What is due, as a notification', kit.switch(t, reminder_on, label='Daily reminder'), leading=lead_tile(t, 'bell')),
        kit.row(t, 'Time', None, time_pill(t, '19:30', time_state if reminder_on else 'disabled'),
                state='default' if reminder_on else 'disabled', min_h=60),
        kit.picker_row(t, 'Compress videos to', '480p', last=True),
    ]) + caption(t, 'Read by the phone app when it opens.', 2)
    phones = kit.section_label(t, 'Paired phones', 14) + kit.list_group(t, [
        dict(title=APP[d], meta='Paired 28 Oct 2026 · last used today', leading=lead_tile(t, 'phone'),
             trailing=kit.button(t, 'Remove', 'danger_text', size='sm', on=t['surface'], aria=f'Remove {APP[d]}')),
    ])
    account = kit.section_label(t, 'Account', 14) + kit.list_group(t, [
        dict(title='me@example.com', meta='Signed in', leading=lead_tile(t, 'solo'),
             trailing=kit.button(t, 'Sign out', 'tertiary', icon_name='logout', size='sm', on=t['surface'])),
    ])
    return practice + app + phones + account


def settings(t):
    return pushed(t, 'Settings', 'Today', settings_body(t))


def settings_focused(t):
    body = scrolled(settings_body(t, 'focused'), 0)
    toast = kit.toast(t, 'Saved', icon_name='check', tone='done', bottom=34)
    return pushed(t, 'Settings', 'Today', body, overlay=toast)


def settings_sheet(t):
    d = t['dance']
    inner = (f'<p style="margin: 0 4px; font-size: 15px; color: {t["ink2"]}">The style a new figure starts on. You can change it on the figure.</p>'
             + kit.radio_group(t, 'Style', STYLES[d], 0))
    sheet = kit.bottom_sheet(t, 'New figures start on', inner)
    return pushed(t, 'Settings', 'Today', settings_body(t), overlay=sheet)


# --------------------------------------------------------------------------
# My count (voice)
# --------------------------------------------------------------------------

PATTERNS = ['1 2 3 · 5 6 7', '2 3 4 · 6 7 8', '1–8']
LADDER = [(120, 'done'), (130, 'done'), (140, 'done'), (152, 'none'), (164, 'half'), (177, 'none'), (191, 'none')]


def tempo_rows(t, ladder):
    rows = []
    for bpm, st in ladder:
        meta, tone = {'done': ('Recorded', 'done'), 'half': ('Half recorded · counts 1 2 3', 'status'),
                      'none': ('Not recorded', None)}[st]
        if st == 'none':
            tr = kit.button(t, 'Record', 'secondary', icon_name='mic', size='sm', on=t['surface'], aria=f'Record {bpm} BPM')
        else:
            tr = kit.button(t, 'Redo', 'tertiary', size='sm', on=t['surface'], aria=f'Redo {bpm} BPM')
        rows.append(dict(title=f'<span style="font-variant-numeric: tabular-nums">{bpm} BPM</span>', meta=meta, meta_tone=tone, trailing=tr))
    return kit.list_group(t, rows, label='Tempos')


def voice_header_extra(t):
    return kit.segmented(t, PATTERNS, 0, on_band=True, label='Count pattern')


def voice_grid(t, top_html=None, ladder=LADDER, overlay='', scroll=0):
    intro = top_html if top_html is not None else para(
        t, 'Record yourself counting and the player uses your voice. A tempo with nothing recorded uses the built-in count.')
    done = sum(1 for _, s in ladder if s == 'done')
    takes = kit.section_label(t, 'Recorded takes', 14) + kit.list_group(t, [
        dict(title=f'{b} BPM · counts {c}', meta=f'1 2 3 · 5 6 7 · phrase {p}',
             trailing=kit.icon_button(t, 'trash', f'Delete {b} BPM phrase {p}', 'bare', color=t['danger'], on=t['surface']))
        for b, c, p in [(120, '1 2 3', 'A'), (120, '5 6 7', 'B'), (130, '1 2 3', 'A')]])
    body = intro + kit.section_label(t, f'Tempos · {done} of 7 recorded', 6) + tempo_rows(t, ladder) + takes
    if scroll:
        body = scrolled(body, scroll)
    return pushed(t, 'My count', 'Settings', body, extra=voice_header_extra(t), overlay=overlay)


def voice(t):
    return voice_grid(t)


def voice_refused(t):
    b = kit.banner(t, 'error', 'The microphone was refused', 'Allow it for this app in the phone’s settings, then try again.')
    return voice_grid(t, b)


def voice_saved(t):
    ladder = [(b, 'done' if b == 152 else s) for b, s in LADDER]
    toast = kit.toast(t, 'Kept both halves for 152 BPM', icon_name='check', tone='done', bottom=34)
    return voice_grid(t, ladder=ladder, overlay=toast, scroll=178)


def step_row(t, n, text):
    return (f'<div style="display: flex; gap: 14px; align-items: flex-start; padding: 12px 16px 12px 14px">'
            f'<span style="width: 28px; height: 28px; border-radius: 14px; background: {t["accent_soft"]}; color: {t["accent_text"]}; font-size: 14px; font-weight: 800; '
            f'display: flex; align-items: center; justify-content: center; flex: none">{n}</span>'
            f'<span style="font-size: 15px; line-height: 1.45; color: {t["ink"]}; padding-top: 3px">{text}</span></div>')


def voice_arming(t):
    warn = kit.banner(t, 'warning', 'Put headphones on first', 'Through a speaker the click gets recorded along with your voice.')
    steps = kit.card(t, step_row(t, 1, 'One bar of clicks to find the tempo.')
                     + step_row(t, 2, 'Count <strong>1 2 3 · 5 6 7</strong> out loud for 4 bars.')
                     + step_row(t, 3, 'Count evenly and leave beats 4 and 8 silent.'), pad='4px 0')
    body = warn + kit.section_label(t, 'How it goes', 14) + steps
    start = kit.bottom_action(t, kit.button(t, 'Start', 'primary', icon_name='mic', size='lg', full=True))
    return pushed(t, '152 BPM', 'My count', body, subtitle='Count 1 2 3 · 5 6 7', footer=start)


def count_dots(t, current=5, silent=(4, 8), said_until=None):
    out = ''
    for n in range(1, 9):
        if n == current:
            st = f'background: {t["accent"]}; color: {t["on_accent"]}; box-shadow: 0 0 0 6px {t["focus_halo"]}'
        elif n in silent:
            st = f'background: transparent; color: {t["muted"]}; box-shadow: inset 0 0 0 2px {t["hairline"]}'
        elif n < current:
            st = f'background: {t["accent_soft"]}; color: {t["accent_text"]}'
        else:
            st = f'background: {t["surface"]}; color: {t["ink"]}; box-shadow: inset 0 0 0 1px {t["field_line"]}'
        out += (f'<span style="width: 34px; height: 34px; border-radius: 17px; display: flex; align-items: center; justify-content: center; '
                f'font-size: 15px; font-weight: 800; font-variant-numeric: tabular-nums; {st}">{n}</span>')
    return f'<div aria-hidden="true" style="display: flex; justify-content: center; gap: 9px">{out}</div>'


def bar_segments(t, done=1, current=2, total=4):
    out = ''
    for i in range(1, total + 1):
        if i <= done:
            c = t['accent']
            inner = ''
        elif i == current:
            c = t['hairline']
            inner = f'<span style="display: block; width: 50%; height: 6px; border-radius: 3px; background: {t["accent"]}"></span>'
        else:
            c, inner = t['hairline'], ''
        out += f'<span style="flex: 1; height: 6px; border-radius: 3px; background: {c}; overflow: hidden">{inner}</span>'
    return (f'<div role="progressbar" aria-label="Bars counted" aria-valuemin="0" aria-valuemax="{total}" aria-valuenow="{done}" '
            f'style="display: flex; gap: 6px; width: 100%">{out}</div>')


def voice_recording(t):
    live = (f'<span style="display: inline-flex; align-items: center; gap: 8px; height: 30px; padding: 0 12px; border-radius: 15px; background: {t["danger_soft"]}; '
            f'color: {t["danger"]}; font-size: 13px; font-weight: 800"><span style="width: 8px; height: 8px; border-radius: 4px; background: {t["danger"]}"></span>Recording</span>')
    hero = (f'<div style="background: {t["surface"]}; border-radius: 22px; padding: 22px 18px 24px; display: flex; flex-direction: column; align-items: center; gap: 18px; flex: none">'
            f'{live}'
            f'<p role="status" style="margin: 0; text-align: center"><span style="display: block; {kit.ts("number_l", t["ink"])}">Bar 2 of 4</span>'
            f'<span style="display: block; margin-top: 6px; font-size: 15px; font-weight: 600; color: {t["muted"]}">Say <strong style="color: {t["ink"]}">5</strong> now</span></p>'
            f'{count_dots(t)}{bar_segments(t)}</div>')
    hint = caption(t, 'Stop keeps the whole bars you counted. Redo throws them away and starts the count-in again.', 6)
    btns = kit.bottom_action(t, f'<div style="display: flex; gap: 10px">'
                                f'<div style="flex: 1; display: flex">{kit.button(t, "Redo", "secondary", icon_name="refresh", size="lg", full=True)}</div>'
                                f'<div style="flex: 1; display: flex">{kit.button(t, "Stop", "primary", icon_name="stop", size="lg", full=True)}</div></div>')
    return pushed(t, 'Recording', 'My count', hero + hint, subtitle='1 2 3 · 5 6 7 at 152 BPM', footer=btns)


def half_card(t, counts, sel, empty=False):
    if empty:
        inner = f'<span style="font-size: 14px; color: {t["muted"]}">Nothing usable in this half.</span>'
    else:
        ch = ''.join(kit.chip(t, f'Bar {i + 1}', i == sel, role='radio') for i in range(4))
        inner = (f'<div role="radiogroup" aria-label="Bar for counts {counts}" style="display: flex; gap: 6px; flex-wrap: wrap">{ch}</div>'
                 f'<div>{kit.button(t, f"Listen to bar {sel + 1}", "secondary", icon_name="play", size="sm", on=t["surface"])}</div>')
    return kit.card(t, f'<span style="{kit.ts("title", t["ink"])}">Counts {counts}</span>{inner}', gap=10)


def voice_choosing_body(t):
    return (para(t, 'Pick the best bar for each half. Listen before you keep it: a rushed or muttered one is worse than the built-in voice.')
            + kit.section_label(t, 'First half', 6) + half_card(t, '1 2 3', 0)
            + kit.section_label(t, 'Second half', 6) + half_card(t, '5 6 7', 2))


def voice_choosing(t, overlay='', keep_state='default'):
    foot = kit.bottom_action(t, f'<div style="display: flex; flex-direction: column; gap: 8px">'
                                f'{kit.button(t, "Saving…" if keep_state == "loading" else "Keep these", "primary", keep_state, icon_name="check", size="lg", full=True)}'
                                f'{kit.button(t, "Record again", "tertiary", icon_name="refresh", full=True)}</div>')
    return pushed(t, 'Pick the bars', 'My count', voice_choosing_body(t), subtitle='1 2 3 · 5 6 7 at 152 BPM', footer=foot, overlay=overlay)


def voice_choose(t):
    return voice_choosing(t)


# --------------------------------------------------------------------------
# Unsaved changes
# --------------------------------------------------------------------------


def stacked(btns):
    return f'<div style="display: flex; flex-direction: column; gap: 8px; width: 100%">{"".join(btns)}</div>'


def unsaved_ask(t):
    r = t['raised']
    d = kit.dialog(t, 'Unsaved changes', 'Your recorded count is not saved yet.', [stacked([
        kit.button(t, 'Save', 'primary', full=True, on=r),
        kit.button(t, 'Stay', 'secondary', full=True, on=r),
        kit.button(t, 'Leave without saving', 'danger_text', full=True, on=r)])], icon_name='edit', tone='accent')
    return voice_choosing(t, overlay=d)


def unsaved_saved(t):
    r = t['raised']
    d = kit.dialog(t, 'Saved', 'Your recorded count.', [stacked([
        kit.button(t, 'Leave', 'primary', full=True, on=r),
        kit.button(t, 'Stay', 'secondary', full=True, on=r)])], icon_name='check', tone='done')
    return voice_choosing(t, overlay=d)


def unsaved_failed(t):
    r = t['raised']
    msg = (f'</p><div role="alert" style="background: {t["danger_soft"]}; border-radius: 12px; padding: 10px 12px; display: flex; gap: 8px; align-items: flex-start; '
           f'font-size: 14px; font-weight: 700; color: {t["danger"]}">{kit.icon("warning", 18, t["danger"], style="margin-top: 1px")}'
           f'<span>Could not save the takes. The server did not answer.</span></div><p style="display: none">')
    d = kit.dialog(t, 'Not saved', 'Your recorded count.' + msg, [stacked([
        kit.button(t, 'Stay and fix it', 'primary', full=True, on=r),
        kit.button(t, 'Leave without saving', 'danger_text', full=True, on=r)])], icon_name='warning', tone='danger')
    return voice_choosing(t, overlay=d)


# --------------------------------------------------------------------------
# Sign in
# --------------------------------------------------------------------------


def login(t, email_state='empty', pw_state='empty', error=None, busy=False, progress=False):
    f = t['field']
    email = kit.text_field(t, 'Email', 'me@example.com', state='disabled' if busy else email_state, input_type='email', bg=f)
    pw = kit.text_field(t, 'Password', 'correct horse', state='disabled' if busy else pw_state, input_type='password', bg=f)
    err = kit.banner(t, 'error', error) if error else ''
    btn = kit.button(t, 'Signing in…' if busy else 'Sign in', 'primary', 'loading' if busy else 'default', size='lg', full=True, on=t['surface'])
    form = (f'<form style="background: {t["surface"]}; border-radius: 22px; padding: 20px 16px 16px; display: flex; flex-direction: column; gap: 16px; flex: none">'
            f'{email}{pw}{err}{btn}</form>')
    foot = f'<p style="margin: 6px 0 0; text-align: center; font-size: 13px; color: {t["muted"]}">Registration is closed.</p>'
    header = kit.band_header(t, 'Sign in', 'Welcome back. Sign in to practise.')
    inner = header + kit.sheet(t, form + foot) + (nav_bar(t) if progress else '')
    return kit.phone(t, inner)


def login_empty(t):
    return login(t)


def login_focused(t):
    return login(t, 'filled', 'focused')


def login_wrong(t):
    return login(t, 'filled', 'empty', error='Incorrect email or password.')


def login_busy(t):
    return login(t, 'filled', 'filled', busy=True, progress=True)


# --------------------------------------------------------------------------
# Pairing
# --------------------------------------------------------------------------

PAIR_BODY = 'Lets the app upload videos in the background and remind you what is due. You can remove it again in Settings.'


def pair_ready(t):
    body = status_block(t, 'phone', 'Pair this phone', PAIR_BODY)
    foot = kit.bottom_action(t, kit.button(t, 'Pair this phone', 'primary', icon_name='link', size='lg', full=True))
    return pushed(t, 'Pair the app', None, body, footer=foot)


def pair_done(t):
    body = status_block(t, 'check', 'Paired', 'Opening the app now. If it does not open by itself, tap the button.', tone='done')
    foot = kit.bottom_action(t, kit.button(t, 'Open the app', 'primary', icon_name='external', size='lg', full=True))
    return pushed(t, 'Pair the app', None, body, footer=foot)


# --------------------------------------------------------------------------
# Share target
# --------------------------------------------------------------------------

LESSONS = [('Wednesday class', '28 Oct 2026'), ('Cuban styling workshop', '25 Oct 2026'), ('Private with Ana', '21 Oct 2026'),
           ('Wednesday class', '14 Oct 2026'), ('Bootcamp · day 2', '11 Oct 2026'), ('Wednesday class', '7 Oct 2026'),
           ('Sunday social prep', '5 Oct 2026')]


def share(t):
    rows = []
    for i, (title, day) in enumerate(LESSONS):
        if i == 0:
            rows.append(dict(title=title, meta=day, leading=lead_tile(t, 'lessons'), state='pressed', href='#',
                             trailing=kit.spinner(t, 22)))
        else:
            rows.append(dict(title=title, meta=day, leading=lead_tile(t, 'lessons'), href='#', trailing=kit.chevron(t)))
    body = kit.section_label(t, 'Recent lessons') + kit.list_group(t, rows, label='Lessons')
    return pushed(t, 'Add to a lesson', None, body, subtitle='Compressed and uploaded in the background')


def share_empty(t):
    body = kit.empty_state(t, 'lessons', 'No lessons yet', 'Make one in Lessons first, then share the video again.')
    return pushed(t, 'Add to a lesson', None, body, subtitle='Compressed and uploaded in the background')


# --------------------------------------------------------------------------
# Loading
# --------------------------------------------------------------------------


def loading_list(t):
    header = kit.band_header(t, 'Moves')
    body = (f'<span role="status" style="{kit.SR}">Loading…</span>'
            + bone(t, '140px', 12, extra='margin: 4px 16px 4px') + kit.skeleton_rows(t, 7))
    inner = header + kit.sheet(t, body) + kit.tab_bar(t, 'Moves') + nav_bar(t)
    return kit.phone(t, inner)


def loading_today(t):
    header = (f'<header aria-hidden="true" style="background: {t["band"]}; padding: 34px 20px 92px; display: flex; flex-direction: column; gap: 12px; flex: none">'
              f'{bone(t, "150px", 38, 10, True)}{bone(t, "120px", 12, 6, True)}</header>')
    hero = (f'<div aria-hidden="true" style="margin: -42px 0 10px; min-height: 84px; border-radius: 22px; background: {t["surface"]}; box-shadow: {t["shadow"]}; '
            f'display: flex; align-items: center; gap: 14px; padding: 14px 14px 14px 20px; flex: none">'
            f'<div style="flex: 1; display: flex; flex-direction: column; gap: 10px">{bone(t, "60%", 18, 8)}{bone(t, "40%", 11)}</div>'
            f'<span style="width: 54px; height: 54px; border-radius: 27px; background: {t["skeleton"]}"></span></div>')
    body = (hero + f'<span role="status" style="{kit.SR}">Loading…</span>' + bone(t, '70px', 11, extra='margin: 0 16px')
            + kit.skeleton_rows(t, 3) + bone(t, '90px', 11, extra='margin: 14px 16px 0') + kit.skeleton_rows(t, 1))
    inner = header + kit.sheet(t, body, '0 16px') + kit.tab_bar(t, 'Today') + nav_bar(t)
    return kit.phone(t, inner)


def loading_detail(t):
    header = (f'<header style="background: {t["band"]}; padding: 30px 20px 52px; display: flex; flex-direction: column; gap: 6px; flex: none">'
              f'<div style="display: flex; align-items: center; gap: 4px; margin-left: -10px">{back(t, "Moves")}{bone(t, "190px", 34, 10, True)}</div>'
              f'<div style="padding-left: 38px">{bone(t, "110px", 12, 6, True)}</div></header>')
    body = (f'<span role="status" style="{kit.SR}">Loading…</span>'
            + f'<div aria-hidden="true" style="aspect-ratio: 16 / 9; border-radius: 22px; background: {t["skeleton"]}; flex: none"></div>'
            + bone(t, '75%', 14, extra='margin: 8px 4px 0') + bone(t, '50%', 14, extra='margin: 2px 4px 6px')
            + kit.skeleton_rows(t, 3))
    return kit.phone(t, header + kit.sheet(t, body) + nav_bar(t))


# --------------------------------------------------------------------------
# Errors
# --------------------------------------------------------------------------


def err_404(t):
    body = status_block(t, 'search', 'Nothing here', 'This page does not exist, or what it showed was deleted.',
                        kit.button(t, 'Go to Today', 'primary', icon_name='calendar', full=True), code='ERROR 404')
    return pushed(t, 'Not found', 'Today', body)


def err_offline(t):
    body = status_block(t, 'refresh', 'You’re offline', 'This page needs the server. Check the connection and try again; nothing you saved is lost.',
                        kit.button(t, 'Try again', 'primary', icon_name='refresh', full=True), tone='warn')
    return pushed(t, 'Offline', 'Lessons', body)


def err_500(t):
    body = status_block(t, 'warning', 'Something went wrong', 'The server could not open this page. Try again in a moment.',
                        kit.button(t, 'Try again', 'primary', icon_name='refresh', full=True)
                        + kit.button(t, 'Go to Today', 'tertiary', full=True), tone='danger', code='ERROR 500')
    return pushed(t, 'Error', 'Music', body)


# --------------------------------------------------------------------------

SCREENS = [
    ('Settings', 'Pushed from Today’s sliders icon. Rows save on change; no Save buttons', settings, 'salsa'),
    ('Settings · time focused', 'Bachata: its own styles and app. “Saved” toast after a change', settings_focused, 'bachata'),
    ('Settings · style picker', 'New figures start on: this dance’s styles only', settings_sheet, 'salsa'),
    ('My count', 'Pattern on the band; seven tempos; Record / Redo per tempo', voice, 'salsa'),
    ('My count · mic refused', 'Also “Nothing usable was captured. Check the microphone permission.”', voice_refused, 'salsa'),
    ('My count · get ready', 'Headphones first, then Start (the mic is asked for here)', voice_arming, 'salsa'),
    ('My count · recording', 'Count-in, then 4 bars; the count to say is lit, 4 and 8 stay silent', voice_recording, 'salsa'),
    ('My count · pick the bars', 'A bar per half, Listen, Keep these / Record again', voice_choose, 'salsa'),
    ('My count · kept', 'Back on the list, scrolled to the takes (Delete per take)', voice_saved, 'salsa'),
    ('Unsaved changes', 'The one dialog, for a page or a sheet: Save · Stay · Leave without saving', unsaved_ask, 'salsa'),
    ('Unsaved · saved', 'Save sent the form and waited: Leave or Stay', unsaved_saved, 'salsa'),
    ('Unsaved · not saved', 'The server’s message; Stay and fix it', unsaved_failed, 'salsa'),
    ('Sign in', 'Outside the app shell: no tabs. Empty', login_empty, 'salsa'),
    ('Sign in · typing', 'Email filled, password focused', login_focused, 'salsa'),
    ('Sign in · wrong password', 'Same words for an unknown account; also “Too many attempts…”', login_wrong, 'salsa'),
    ('Sign in · signing in', 'Bachata. Fields locked, button busy, progress bar on top', login_busy, 'bachata'),
    ('Pair the app', 'Opened by the app when it holds no token. One tap', pair_ready, 'salsa'),
    ('Pair the app · paired', 'Jumps into the app; the button is the fallback', pair_done, 'salsa'),
    ('Add to a lesson', 'Share target: this dance’s 30 most recent lessons; a tap hands over to the app', share, 'salsa'),
    ('Add to a lesson · none', 'Bachata, no lessons yet', share_empty, 'bachata'),
    ('Loading · Today', 'Progress bar at once, skeleton after 100 ms; tabs stay in view', loading_today, 'salsa'),
    ('Loading · a list', 'The skeleton carries the page’s real title', loading_list, 'bachata'),
    ('Loading · a detail page', 'A pushed screen: back arrow, no tabs', loading_detail, 'salsa'),
    ('Not found', '404, and “Nothing was shared” on a stale share link', err_404, 'salsa'),
    ('Offline', 'A navigation that could not reach the server', err_offline, 'salsa'),
    ('Server error', '500: Try again, or go to Today', err_500, 'salsa'),
]

if __name__ == '__main__':
    html, w, h = kit.artboard('System · settings, voice, sign-in and system screens',
                              'Settings, My count, sign in, pairing, the share target, the Unsaved dialog, loading and error pages, light and dark.',
                              SCREENS, doc_title='S · System')
    kit.write(OUT, html)
    print(w, h)
