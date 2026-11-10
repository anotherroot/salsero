/*
 * Whether a new own video stays on this phone (offline phase 4c): on a phone
 * with somewhere to keep it, yes; on a computer, or in an Android app too old
 * to keep gallery originals, it uploads at once as before. PURE.
 */
export type PhoneEnv = {
	/** In the Android app (`data.app`). */
	app: boolean;
	/** The app keeps gallery originals (`window.SalsaVideos`, offline phase 4c). */
	appVideos: boolean;
	/** A touch screen (`(pointer: coarse)`). */
	coarse: boolean;
	/** The device's media store is here (`kept.status` not null). */
	store: boolean;
};

export function phoneFirst(env: PhoneEnv): boolean {
	if (env.app) return env.appVideos;
	return env.coarse && env.store;
}

/** An iPhone or an iPad (one that calls itself a Mac has a touch screen): its stored files may be deleted. */
export function isIphone(ua: string, maxTouchPoints: number): boolean {
	if (/iPhone|iPad|iPod/.test(ua)) return true;
	return /Macintosh/.test(ua) && maxTouchPoints > 1;
}
