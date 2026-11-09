// node:os, node:stream, node:stream/promises, node:util and node:url on the
// device. Streams only serve files, which the device has none of yet.
import { thrower } from './warn';

export const tmpdir = () => '/tmp';
export const hostname = () => 'device';
export const Readable = {
	toWeb: thrower('stream.Readable.toWeb'),
	fromWeb: thrower('stream.Readable.fromWeb')
};
export const Writable = {
	toWeb: thrower('stream.Writable.toWeb'),
	fromWeb: thrower('stream.Writable.fromWeb')
};
export class Transform {
	constructor() {
		thrower('stream.Transform')();
	}
}
export const pipeline = thrower('stream.pipeline');
/** For a callback-style function: settles with what its callback gets. */
export const promisify =
	(fn: (...a: unknown[]) => unknown) =>
	(...a: unknown[]) =>
		new Promise((resolve, reject) =>
			fn(...a, (err: unknown, value: unknown) => (err ? reject(err) : resolve(value)))
		);
export const fileURLToPath = (u: string | URL) => new URL(String(u)).pathname;
export const pathToFileURL = (p: string) => new URL(`file://${p}`);
export default {
	tmpdir,
	hostname,
	Readable,
	Writable,
	Transform,
	pipeline,
	promisify,
	fileURLToPath,
	pathToFileURL
};
