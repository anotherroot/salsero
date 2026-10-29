/**
 * The full-screen player's icons: one SVG path each, drawn by `Icon.svelte`
 * on a 24×24 grid with a round 2 px stroke.
 */
export const icons = {
	close: 'M6 6l12 12M18 6L6 18',
	mirror: 'M12 3v18M8 7l-5 5 5 5zM16 7l5 5-5 5z',
	play: 'M8 5l11 7-11 7z',
	pause: 'M8 5v14M16 5v14',
	flag: 'M6 21V4h11l-2 4 2 4H6',
	bracket: 'M9 4H5v16h4M15 4h4v16h-4',
	loop: 'M17 2l3 3-3 3M4 11V9a4 4 0 014-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 01-4 4H4',
	pencil: 'M4 20h4L19 9l-4-4L4 16z',
	trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
	link: 'M10 14a4 4 0 006 0l3-3a4 4 0 00-6-6l-1 1M14 10a4 4 0 00-6 0l-3 3a4 4 0 006 6l1-1',
	check: 'M5 12l5 5 9-11',
	chevronLeft: 'M15 6l-6 6 6 6',
	chevronRight: 'M9 6l6 6-6 6',
	chevronUp: 'M6 15l6-6 6 6',
	chevronDown: 'M6 9l6 6 6-6',
	list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
	startEdge: 'M6 5v14M18 6l-9 6 9 6z',
	endEdge: 'M18 5v14M6 6l9 6-9 6z'
} as const;
