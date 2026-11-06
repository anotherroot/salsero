/**
 * The toast Drop my copy leaves for the page it lands on (board C5 p3: "Back
 * on Salsa Tuesdays’. Your copy is archived."). The drop's sheet sets it, tagged
 * with the version's page (`href`) and the page it leaves (`from`), before it
 * navigates. A page's `Versions` shows it only on `href`, once; anywhere else
 * but `from` (a landing that failed and a later page) it is dropped unshown.
 * Lost on a full reload, which is fine for a toast.
 */
type Pending = { text: string; href: string; from: string };

let pending = $state<Pending | null>(null);

const pathOf = (href: string) => new URL(href, 'http://x').pathname;

export const dropped = {
	get pending() {
		return pending;
	},
	set(text: string, href: string, from: string) {
		pending = { text, href: pathOf(href), from: pathOf(from) };
	},
	clear() {
		pending = null;
	},
	/**
	 * On the page at `path`: the message when it is the version's page (gone
	 * after this), null otherwise; it waits on the page it was set from, and is
	 * dropped anywhere else.
	 */
	take(path: string): string | null {
		const p = pending;
		if (!p) return null;
		if (path === p.from && path !== p.href) return null;
		pending = null;
		return path === p.href ? p.text : null;
	}
};
