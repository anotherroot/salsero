/** The signed-in user, as carried on `locals` and echoed to the client. */
interface SessionUser {
	id: string;
	email: string;
	/** IANA zone deciding when "today" rolls over. See `src/lib/day/day.ts`. */
	timezone: string;
}

declare global {
	namespace App {
		interface Locals {
			user: SessionUser | null;
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
