/**
 * Date and time fields draw no picker button of their own (layout.css hides the
 * browser's: an unstyled ▾ on Android, a clock or calendar on the desktop). A tap
 * on the phone opens the picker by itself; a mouse click on the desktop only
 * puts the caret in a segment, so this opens the picker there. Client-safe.
 */

const PICKED = new Set(['date', 'time']);

/** The field a click should open the picker of, or null. Only a mouse click: a tap opens it already. */
export function pickerField(
	target: EventTarget | null,
	pointerType: string
): HTMLInputElement | null {
	if (pointerType !== 'mouse') return null;
	if (typeof HTMLInputElement === 'undefined' || !(target instanceof HTMLInputElement)) return null;
	if (!PICKED.has(target.type) || target.disabled || target.readOnly) return null;
	return target;
}

/** Open a date or time field's picker on a mouse click, page-wide. Returns the cleanup. */
export function openPickersOnClick(doc: Document = document): () => void {
	const onclick = (e: MouseEvent) => {
		const field = pickerField(e.target, (e as PointerEvent).pointerType ?? '');
		try {
			field?.showPicker();
		} catch {
			// Not allowed here (a cross-origin frame) or not supported: the field still takes typing.
		}
	};
	doc.addEventListener('click', onclick);
	return () => doc.removeEventListener('click', onclick);
}
