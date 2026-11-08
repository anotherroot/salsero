/**
 * One task at a time, in the order they came: each starts once the one before
 * it has settled, whether it succeeded or not. Client-safe.
 */
export function serial(): <T>(task: () => Promise<T>) => Promise<T> {
	let last: Promise<unknown> = Promise.resolve();
	return (task) => {
		const run = last.then(task, task);
		last = run.catch(() => undefined);
		return run;
	};
}
