"""The three approved screens (C4 · Final picks) redrawn with the kit.

Copy this pattern: one function per screen, ``screen(t) -> html``, colours only from ``t``.
    python3 examples.py OUT.dc.html   -> an artboard of the three, light and dark.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402


def today(t, overlay=''):
    header = kit.band_header(t, 'Today', 'Friday, 30 October', right=kit.band_button(t, 'settings', 'Settings'), hero=True)
    hero = kit.hero_card(t, 'Start session', '3 due · about 20 min')
    due = kit.section_label(t, 'Due · 3') + kit.list_group(t, [
        dict(title='Dile que no · Basic', meta='Partner · every 3 days · new', trailing=kit.log_button(t, 'Dile que no · Basic')),
        dict(title='Enchufla · Doble', meta='4 days overdue', meta_tone='status', trailing=kit.log_button(t, 'Enchufla · Doble')),
        dict(title='Count drill · 3-2 clave', meta='Solo · daily', trailing=kit.log_button(t, 'Count drill · 3-2 clave')),
    ])
    done = kit.section_label(t, 'Done today', 14) + kit.list_group(t, [
        dict(title='Sombrero · Basic', meta='2 sets · 9:40', title_tone='muted', trailing=f'<span style="margin-right: 10px; display: flex">{kit.done_check(t)}</span>'),
    ])
    return kit.page(t, header, due + done, tab='Today', hero=hero, overlay=overlay)


FIGS = [('Body wave', '3 variations · in 2 routines', False), ('Hammerlock', '2 variations · in 1 routine', False),
        ('Cuddle turn', '1 variation', True), ('Shadow position', '4 variations · in 3 routines', False),
        ('Media luna', '1 variation · in 1 routine', False), ('Hip roll', '2 variations', True)]


def moves(t, overlay=''):
    header = kit.band_header(t, 'Moves', right=kit.band_button(t, 'plus', 'New figure'),
                             extra=kit.segmented(t, ['Figures', 'Routines'], 0, on_band=True, label='Moves'))
    rows = []
    for name, meta, orphan in FIGS:
        m = meta + (f' · <span style="color: {t["status"]}; font-weight: 700">not in a routine</span>' if orphan else '')
        rows.append(dict(title=name, meta=m, trailing=kit.chevron(t), href='#'))
    body = ('<div style="height: 2px; flex: none"></div>' + kit.search_field(t, 'Search figures')
            + kit.chips(t, ['All', 'Dominican', 'Sensual', 'Traditional'], 0, label='Style')
            + kit.section_label(t, '6 figures', 2) + kit.list_group(t, rows))
    return kit.page(t, header, body, tab='Moves', overlay=overlay)


def practice(t, overlay='', tempo_state='focused'):
    header = kit.band_header(t, 'Practice', 'Count only', left=kit.band_button(t, 'back', 'Back to Today'))
    group = kit.list_group(t, [
        kit.stepper_row(t, 128, 'Tempo', 'BPM', tempo_state),
        kit.picker_row(t, 'Voice count', '1 2 3 · 5 6 7'),
        kit.picker_row(t, 'Voice', 'Built-in', last=True),
    ])
    body = group + kit.section_label(t, 'Volume', 14) + kit.slider(t, 80, 'Volume')
    play = kit.bottom_action(t, kit.button(t, 'Play', 'primary', icon_name='play', size='lg', full=True))
    return kit.page(t, header, body, pad='22px 16px 0', footer=play, overlay=overlay)


if __name__ == '__main__':
    html, w, h = kit.artboard('Kit check · approved screens', 'Today, Moves and Practice redrawn with kit.py.', [
        ('Today', 'Salsa', today, 'salsa'), ('Moves', 'Bachata', moves, 'bachata'), ('Practice', 'Bachata, tempo focused', practice, 'bachata')])
    kit.write(sys.argv[1], html)
    print(w, h)
