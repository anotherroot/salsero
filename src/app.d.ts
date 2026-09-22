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
	}
}

export {};
