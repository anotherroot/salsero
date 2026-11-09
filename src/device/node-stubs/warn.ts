// The device's Node stubs say so, once each, when the server code reaches one
// that cannot work in a browser worker: what the walk should look at.
const seen = new Set<string>();

export function warnOnce(name: string): void {
	if (seen.has(name)) return;
	seen.add(name);
	console.warn(`[device] ${name} is not on the device`);
}

/** A stub that throws, as Node does for a file that is not there when `code` is 'ENOENT'. */
export function thrower(name: string, code?: string) {
	return (): never => {
		warnOnce(name);
		throw Object.assign(new Error(`device: ${name}`), code ? { code } : {});
	};
}
