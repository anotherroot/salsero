"""Scenes for the screenshot rig: a page after some clicks.

A scene is a path (filled with the placeholders, as page lines are), an `act` run once the page has
loaded, the `masks` (Playwright locators hidden in the shot) and whether it is `desk` only (shot at
widths >= 1024, never part of a phone baseline).

Every `scripts/shots/ext_*.py` may define `SCENES: dict[str, Scene]` and
`placeholders(db, admin, dance) -> dict[str, object]`. `load_ext()` merges them; a name twice is an error.
`python3 -I` puts no script directory on sys.path, so the files are loaded by path.
"""
import importlib.util
import glob
import os
import sys
from typing import Callable, NamedTuple

HERE = os.path.dirname(os.path.abspath(__file__))


class Scene(NamedTuple):
    path: str
    act: Callable = lambda p: None
    masks: Callable = lambda p: []
    desk: bool = False


def load_ext():
    # ext files do `from scenes import Scene`: register this module under that name
    sys.modules.setdefault("scenes", sys.modules[__name__])
    scenes, placeholder_fns = {}, []
    for f in sorted(glob.glob(os.path.join(HERE, "ext_*.py"))):
        name = "shots_" + os.path.basename(f)[:-3]
        spec = importlib.util.spec_from_file_location(name, f)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        for k, s in getattr(mod, "SCENES", {}).items():
            if k in scenes:
                raise SystemExit(f"shots: scene {k} is defined twice (again in {os.path.basename(f)})")
            scenes[k] = s
        if hasattr(mod, "placeholders"):
            placeholder_fns.append(mod.placeholders)
    return scenes, placeholder_fns
