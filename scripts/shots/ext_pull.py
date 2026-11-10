"""Device first: pull down to refresh (look C), held at "Let go to sync" on Today, Moves
and a figure. Synthetic touches on the page: the rig's browser has no touchscreen.
See README "Scenes"."""

from scenes import Scene

PULL = """async (dy) => {
  const el = document.querySelector('main') ?? document.body;
  const at = (y) => [new Touch({ identifier: 1, target: el, clientX: 195, clientY: y })];
  const fire = (type, y) =>
    el.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : at(y),
      changedTouches: at(y), bubbles: true, cancelable: true }));
  fire('touchstart', 300);
  for (let y = 300; y <= 300 + dy; y += 20) fire('touchmove', y);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}"""


def _hold(page):
    page.wait_for_load_state("networkidle")
    page.evaluate(PULL, 220)


SCENES = {
    "pull-today": Scene("/{dance}", _hold),
    "pull-moves": Scene("/{dance}/figures", _hold),
    "pull-figure": Scene("/{dance}/figures/{figure}", _hold),
}
