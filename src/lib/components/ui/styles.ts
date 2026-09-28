/**
 * Class strings repeated across forms. Components used to each declare these
 * as local constants; the new popups use them from several files, and copies
 * drift.
 */
export const FIELD =
	'w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent';
export const LABEL = 'mb-1 block text-[12px] font-medium text-ink-2';
/** A radio styled as a chip: wrap the input (`sr-only`) and its text in a <label> with this. */
export const CHIP =
	'flex h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border text-[14px] has-checked:border-accent has-checked:bg-accent has-checked:text-accent-ink border-rule bg-raised text-ink-2 has-focus-visible:outline-2 has-focus-visible:outline-accent';
