/**
 * "Copied to Salsa Tuesdays as a draft." with Open: set by Copy to…, which
 * opens from the band's ⋯ (`ItemMenu`), and drawn by the page's `Versions`,
 * so the toast lives in the page, not in the band.
 */
type Copied = { id: number; message: string; href?: string };

let toast = $state<Copied | null>(null);
let seq = 0;

export const copied = {
	get toast() {
		return toast;
	},
	show(message: string, href?: string) {
		toast = { id: ++seq, message, href };
	},
	clear() {
		toast = null;
	}
};
