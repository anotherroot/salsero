/**
 * What the full-screen player's screens show, decided without a DOM: which
 * top-bar parts appear per layout and level, a link entry's words, the delete
 * sheet's copy, the toast's icon and place, whether the buffering spinner
 * shows, and the editor's and list's second lines. PURE and client-safe.
 */
import type { IconName } from '$lib/icons/icons';
import type { Spot } from '$lib/types';
import type { VideoRate } from '$lib/video-prefs';
import type { PlayerLayout } from './layout';
import { linkSummary, lengthText, preciseTime, spotLabel, spotTime } from './spots';

export type PlayerMode = 'portrait' | 'overlay' | 'panel' | 'desktop';
export type LevelKind = 'full' | 'section' | 'edit';

/** The player's mode: landscape is a panel beside the video while the editor or the list is open. */
export function playerMode(layout: PlayerLayout, level: LevelKind, listOpen: boolean): PlayerMode {
	if (layout === 'portrait') return 'portrait';
	if (layout === 'desktop') return 'desktop';
	return level === 'edit' || listOpen ? 'panel' : 'overlay';
}

export type TopBarParts = {
	glass: boolean;
	back: boolean;
	title: boolean;
	sub: 'subtitle' | 'looping';
	edit: 'accent' | 'glass' | null;
	sections: boolean;
	/** The repeat button: only the simple player draws it. */
	repeat: boolean;
};

/** A phone (portrait or overlay) puts ‹ Full video and Edit in a section view's top bar. */
export function topBar(
	mode: PlayerMode,
	level: LevelKind,
	opts: { simple?: boolean } = {}
): TopBarParts {
	const plain: TopBarParts = {
		glass: false,
		back: false,
		title: true,
		sub: 'subtitle',
		edit: null,
		sections: false,
		repeat: false
	};
	// The simple player: close, title, repeat, mirror, speed. No edit, no Sections, no section view.
	if (opts.simple) return { ...plain, glass: mode === 'overlay', repeat: true };
	if (mode === 'portrait') {
		return level === 'section' ? { ...plain, back: true, title: false, edit: 'accent' } : plain;
	}
	if (mode === 'overlay') {
		return level === 'section'
			? {
					glass: true,
					back: true,
					title: true,
					sub: 'looping',
					edit: 'glass',
					sections: false,
					repeat: false
				}
			: { ...plain, glass: true, sections: level === 'full' };
	}
	return plain;
}

export type PortraitBody = 'list' | 'editor' | 'slim' | 'section' | 'full';

/**
 * What the portrait player draws under the video. The simple player is the slim bar
 * and nothing else: no list, no editor, no section view, no Show / Hide.
 */
export function portraitBody(
	level: LevelKind,
	o: { listOpen: boolean; hidden: boolean; simple?: boolean }
): PortraitBody {
	if (o.simple) return 'slim';
	if (o.listOpen) return 'list';
	if (level === 'edit') return 'editor';
	if (o.hidden) return 'slim';
	return level === 'section' ? 'section' : 'full';
}

/** The corner badge: speed and mirror, as the player has always worded them. */
export function cornerBadge(rate: VideoRate, mirror: boolean): string {
	return [rate !== 1 ? `${rate}×` : null, mirror ? 'Mirrored' : null].filter(Boolean).join(' · ');
}

export type LinkEntry =
	| { kind: 'none' }
	| { kind: 'show'; text: string }
	| { kind: 'open'; text: string; label: string; invite: boolean };

/**
 * The link entry on a section's badge or in its editor: opens the Link popup
 * when it may link. A point (`point`) links positions only (ruling 10).
 */
export function linkEntry(
	linkedTo: string[],
	linking: boolean,
	where: 'badge' | 'editor',
	point = false
): LinkEntry {
	const linked = linkedTo.length > 0;
	if (!linking) {
		if (!linked) return { kind: 'none' };
		return {
			kind: 'show',
			text: where === 'badge' ? linkSummary(linkedTo) : `Linked to ${linkedTo.join(', ')}`
		};
	}
	if (!linked) {
		const what = point ? 'Link to a position' : 'Link to a figure, drill or position';
		return where === 'badge'
			? {
					kind: 'open',
					text: 'Link',
					label: point ? 'Link this point' : 'Link this section',
					invite: true
				}
			: { kind: 'open', text: what, label: what, invite: true };
	}
	return {
		kind: 'open',
		text: where === 'badge' ? linkSummary(linkedTo) : `Linked to ${linkSummary(linkedTo)}`,
		label: `Links: ${linkedTo.join(', ')}`,
		invite: false
	};
}

/** Under the name: the times when the name is a label, else just the length (the name is the times). */
export function editorSub(spot: Spot): string {
	return spot.endMs === null
		? `Point at ${preciseTime(spot.startMs)}`
		: spot.label
			? `${spotLabel({ ...spot, label: null })} · ${lengthText(spot.endMs - spot.startMs)}`
			: lengthText(spot.endMs - spot.startMs);
}

/** The list's second line: the time again only when the first line is a name. */
export function listMeta(spot: Spot): string {
	const kind = spot.endMs === null ? 'point' : lengthText(spot.endMs - spot.startMs);
	return spot.label ? `${spotLabel({ ...spot, label: null })} · ${kind}` : kind;
}

/** A spot's times, always: a section `0:12.4–0:16.0 · 3.6 s`, a point `Point at 1:38.50`. */
export function spotLine(spot: Spot): string {
	return spot.endMs === null
		? `Point at ${preciseTime(spot.startMs)}`
		: `${spotTime(spot.startMs)}–${spotTime(spot.endMs)} · ${lengthText(spot.endMs - spot.startMs)}`;
}

/** The delete sheet's words. A linked section is refused: `blocked` says to what. */
export function deleteCopy(spot: Spot): {
	title: string;
	sub: string;
	body: string | null;
	blocked: { title: string; body: string } | null;
} {
	const title = `Delete “${spotLabel(spot)}”?`;
	const sub = spotLine(spot);
	if (spot.linkedTo.length > 0) {
		return {
			title,
			sub,
			body: null,
			blocked: {
				title: `Linked to ${spot.linkedTo.join(', ')}`,
				body: 'Unlink it there first; until then this section stays.'
			}
		};
	}
	return {
		title,
		sub,
		body: `The ${spot.endMs === null ? 'point' : 'section'} goes from this video. You can undo it for a few seconds.`,
		blocked: null
	};
}

export type ToastTone = 'saved' | 'deleted' | 'failed' | 'note';

export const TOAST_ICON: Record<ToastTone, IconName | null> = {
	saved: 'check-circle',
	deleted: 'trash',
	failed: 'warning',
	note: null
};

/**
 * Over the video where a bottom toast would be covered (the portrait editor's panel) and
 * where a refusal belongs to the picture (a portrait 'failed' toast, at any level).
 */
export function toastPlace(
	mode: PlayerMode,
	level: LevelKind,
	tone?: ToastTone
): 'video' | 'bottom' {
	if (mode !== 'portrait') return 'bottom';
	return level === 'edit' || tone === 'failed' ? 'video' : 'bottom';
}

export type MediaEvent =
	'waiting' | 'playing' | 'canplay' | 'seeked' | 'pause' | 'error' | 'emptied';

/** The buffering spinner shows from `waiting` until anything else the video says. */
export function buffering(_now: boolean, event: MediaEvent): boolean {
	return event === 'waiting';
}
