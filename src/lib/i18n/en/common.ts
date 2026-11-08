// The words every area shares.
export const common = {
	save: 'Save',
	cancel: 'Cancel',
	close: 'Close',
	back: 'Back',
	delete: 'Delete',
	undo: 'Undo',
	done: 'Done',
	edit: 'Edit',
	add: 'Add',
	remove: 'Remove',
	yes: 'Yes',
	no: 'No',
	retry: 'Try again',
	loading: 'Loading…',
	more: '⋯',
	search: 'Search',
	/** A request that never reached the server (no connection). */
	unreachable: 'Could not reach the server.',
	/** `x` with `digits` decimals: a dot. */
	decimal: (x: number, digits: number): string => x.toFixed(digits)
};
