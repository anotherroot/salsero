// node:path on the device: the POSIX functions the server code calls.
function norm(p: string): string {
	const abs = p.startsWith('/');
	const out: string[] = [];
	for (const part of p.split('/')) {
		if (!part || part === '.') continue;
		if (part === '..') out.pop();
		else out.push(part);
	}
	return (abs ? '/' : '') + out.join('/') || (abs ? '/' : '.');
}

export const sep = '/';
export const join = (...ps: string[]) => norm(ps.filter(Boolean).join('/'));
/** Relative paths resolve against `/`: the device has no working directory. */
export const resolve = (...ps: string[]) => {
	let r = '';
	for (const p of ps) r = p.startsWith('/') ? p : `${r}/${p}`;
	return norm(r.startsWith('/') ? r : `/${r}`);
};
export const dirname = (p: string) => {
	const i = p.replace(/\/+$/, '').lastIndexOf('/');
	return i < 0 ? '.' : i === 0 ? '/' : p.slice(0, i);
};
export const basename = (p: string, ext?: string) => {
	const b = p.replace(/\/+$/, '').split('/').pop() ?? '';
	return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b;
};
export const extname = (p: string) => {
	const b = basename(p);
	const i = b.lastIndexOf('.');
	return i <= 0 ? '' : b.slice(i);
};
export const posix = { sep, join, resolve, dirname, basename, extname };
export default posix;
