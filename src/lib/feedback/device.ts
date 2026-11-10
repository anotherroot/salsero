/**
 * PURE, client-safe: a browser's user agent read as the system and the browser
 * a person uses ("Android 14 · Chrome 131"), for the admin's feedback list. The
 * raw user agent is kept beside it; this is only the short line. Names of
 * systems and browsers are proper nouns: never translated.
 */

/** The system: "Android 14", "iOS 17.1", "Windows", "Mac", "Linux", "ChromeOS"; null when unknown. */
function systemOf(ua: string): string | null {
	const android = ua.match(/Android (\d+(?:\.\d+)?)/);
	if (android) return `Android ${android[1]}`;
	if (/Android/.test(ua)) return 'Android';
	const ios = ua.match(/(?:iPhone|CPU) OS (\d+)(?:_(\d+))?/);
	if (ios) return `iOS ${ios[1]}${ios[2] ? `.${ios[2]}` : ''}`;
	if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
	if (/CrOS/.test(ua)) return 'ChromeOS';
	if (/Windows/.test(ua)) return 'Windows';
	if (/Macintosh|Mac OS X/.test(ua)) return 'Mac';
	if (/Linux/.test(ua)) return 'Linux';
	return null;
}

const major = (ua: string, re: RegExp): string | null => ua.match(re)?.[1] ?? null;

/** The browser and its major version: "Chrome 131", "WebView 131", "Safari 17"; null when unknown. */
function browserOf(ua: string): string | null {
	const tests: [string, RegExp][] = [
		['Edge', /Edg(?:A|iOS)?\/(\d+)/],
		['Opera', /OPR\/(\d+)/],
		['Samsung Internet', /SamsungBrowser\/(\d+)/],
		['Firefox', /(?:Firefox|FxiOS)\/(\d+)/]
	];
	for (const [name, re] of tests) {
		const v = major(ua, re);
		if (v) return `${name} ${v}`;
	}
	const chrome = major(ua, /(?:Chrome|CriOS)\/(\d+)/);
	// An Android WebView (the Android app) says "; wv)" beside its Chrome version.
	if (chrome) return /; wv\)/.test(ua) ? `WebView ${chrome}` : `Chrome ${chrome}`;
	const safari = major(ua, /Version\/(\d+)(?:\.\d+)*.*Safari/);
	if (safari) return `Safari ${safari}`;
	return null;
}

/** "Android 14 · Chrome 131"; what is unknown is left out; null when nothing is known. */
export function deviceLine(ua: string | null): string | null {
	if (!ua) return null;
	const parts = [systemOf(ua), browserOf(ua)].filter((p): p is string => p !== null);
	return parts.length ? parts.join(' · ') : null;
}
