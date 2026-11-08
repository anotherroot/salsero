import type { AppAgent } from '$lib/app-update/agent';
import type { Level } from '$lib/levels/levels';
import type { DanceSlug } from '$lib/dances/dances';
import type { Locale } from '$lib/i18n/locale';

/** The signed-in user, as carried on `locals` and echoed to the client. */
interface SessionUser {
	id: string;
	email: string;
	/** Null until the person has been to /welcome (accounts made before names). */
	firstName: string | null;
	lastName: string | null;
	/** IANA zone deciding when "today" rolls over. See `src/lib/day/day.ts`. */
	timezone: string;
	/** The admin invites people and sees their storage. */
	isAdmin: boolean;
	/** How much app the person sees (`$lib/levels/levels.ts`); null until the first run asks. */
	level: Level | null;
	/** The dance this account belongs to: the wall every route compares against (`wallOf`). */
	dance: DanceSlug;
	/** The language the app speaks to this person (`$lib/i18n/locale.ts`); null is English. */
	locale: Locale | null;
}

declare global {
	namespace App {
		interface Locals {
			user: SessionUser | null;
			/** The Android app asking, from its user agent or `x-app-version`; null for a browser. */
			appAgent: AppAgent | null;
			/** The language this request is drawn in (`requestLocale`), chosen by the hook. */
			locale: Locale;
		}
		interface PageData {
			user?: SessionUser | null;
		}
		/**
		 * Shallow-routing state. `videoPlayer`: how many screens the full-screen
		 * player has open (`src/lib/video/player-history.ts`). `sheets`: how many
		 * sheets are open (`src/lib/sheets/stack.ts`). Each pushes with the
		 * entry's other values spread in, so neither reads the other's entries
		 * as a Back.
		 */
		interface PageState {
			videoPlayer?: number;
			sheets?: number;
		}
	}
}

export {};
