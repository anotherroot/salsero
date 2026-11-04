/**
 * The toast Drop my copy leaves for the page it lands on (board C5 p3: "Back
 * on Salsa Tuesdays’. Your copy is archived."). The drop's sheet sets it once
 * the version's page has opened; that page's `SourceTabs` shows it and takes
 * it, so it shows once. Lost on a full reload, which is fine for a toast.
 */
let message = $state<string | null>(null);

export const dropped = {
	get message() {
		return message;
	},
	set(text: string) {
		message = text;
	},
	/** The message, once: it is gone after this. */
	take(): string | null {
		const m = message;
		message = null;
		return m;
	}
};
