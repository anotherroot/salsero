"""The toast's look in dark (the toast-colour board): the You tab's real "Saved" toast, with an Undo
toast cloned above it, in each option. Options are token overrides put in for dark only; light is
left as it is. See README "Scenes"."""
from scenes import Scene

# Dark-only overrides of the toast's tokens, set on the toast's own region so the dance's
# tokens (accent, band) resolve from where the toast sits.
OPTIONS = {
    "a": None,  # as it is: the inverse (cream) toast
    "b": """
        [role=status] { --color-inverse-bg: var(--color-track); --color-inverse-ink: var(--color-ink);
          --color-inverse-done: var(--color-done); --color-inverse-accent: var(--color-accent-text); }
        [role=status] .bg-inverse-bg { box-shadow: 0 0 0 1px rgb(255 255 255 / 0.07), 0 12px 32px rgb(0 0 0 / 0.6) !important; }
    """,
    "c": """
        [role=status] { --color-inverse-bg: var(--color-band); --color-inverse-ink: var(--color-band-ink);
          --color-inverse-done: var(--color-done); --color-inverse-accent: var(--color-band-small); }
        [role=status] .bg-inverse-bg { box-shadow: 0 12px 32px rgb(0 0 0 / 0.6) !important; }
    """,
}


def _toast(css):
    def act(page):
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(300)
        page.get_by_role("button", name="More").first.click()
        page.wait_for_selector("[role=status] >> text=Saved")
        page.evaluate(
            """css => {
                if (css && document.documentElement.dataset.theme === 'dark') {
                    const s = document.createElement('style'); s.textContent = css; document.head.append(s);
                }
                const card = [...document.querySelectorAll('[role=status] .bg-inverse-bg')]
                    .find(e => e.textContent.includes('Saved'));
                const undo = card.cloneNode(true);
                undo.querySelector('span.flex-none')?.remove();
                undo.querySelector('span.flex-1').textContent = 'Slot 4 deleted';
                undo.classList.replace('pr-4', 'pr-1');
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'h-11 flex-none cursor-pointer px-3 text-[15px] font-extrabold text-inverse-accent';
                b.textContent = 'Undo';
                undo.append(b);
                undo.style.marginBottom = '10px';
                card.parentElement.before(undo);
            }""",
            css,
        )
        page.wait_for_timeout(300)

    return act


SCENES = {f"toast-{k}": Scene("/{dance}/groups", _toast(css)) for k, css in OPTIONS.items()}


def _swiped(dx):
    """Drag the Saved toast sideways with the mouse: it must be gone (a failure otherwise)."""

    def act(page):
        page.get_by_role("button", name="More").first.click()
        toast = page.locator("[role=status] .bg-inverse-bg", has_text="Saved")
        toast.wait_for()
        box = toast.bounding_box()
        x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
        page.mouse.move(x, y)
        page.mouse.down()
        for i in range(1, 11):
            page.mouse.move(x + dx * i / 10, y, steps=2)
            page.wait_for_timeout(30)
        page.mouse.up()
        page.wait_for_timeout(500)
        if toast.count():
            raise RuntimeError("the toast is still there after a swipe")

    return act


def _short(page):
    """A short slow drag brings the toast back: it must still be there."""
    page.get_by_role("button", name="More").first.click()
    toast = page.locator("[role=status] .bg-inverse-bg", has_text="Saved")
    toast.wait_for()
    box = toast.bounding_box()
    x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + 40, y, steps=10)
    page.wait_for_timeout(300)
    page.mouse.up()
    page.wait_for_timeout(500)
    if not toast.count():
        raise RuntimeError("a short drag took the toast away")
    after = toast.bounding_box()
    if abs(after["x"] - box["x"]) > 1:
        raise RuntimeError(f"the toast did not come back home: {box['x']} -> {after['x']}")


SCENES["toast-swiped-right"] = Scene("/{dance}/groups", _swiped(250))
SCENES["toast-swiped-left"] = Scene("/{dance}/groups", _swiped(-250))
SCENES["toast-short-drag"] = Scene("/{dance}/groups", _short)
