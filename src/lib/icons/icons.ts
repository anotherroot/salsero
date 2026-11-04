// Ported from docs/superpowers/design-kit/kit.py. Inner SVG markup on a 24 x 24 viewBox;
// colour is always currentColor. Knocked-out details in the filled variants use
// var(--icon-knockout), the colour behind the icon.

const CANONICAL = {
	calendar:
		'<rect x="3.5" y="5" width="17" height="15.5" rx="3"></rect><path d="M3.5 10h17M8 3v4M16 3v4"></path>',
	footprints:
		'<ellipse cx="7.5" cy="7.5" rx="3" ry="4"></ellipse><ellipse cx="7.8" cy="15.4" rx="2" ry="1.7"></ellipse><ellipse cx="16.5" cy="11" rx="3" ry="4"></ellipse><ellipse cx="16.2" cy="18.9" rx="2" ry="1.7"></ellipse>',
	lessons:
		'<rect x="3" y="5" width="18" height="14" rx="3.5"></rect><path d="M10 9.5v5l4.5-2.5z"></path>',
	music:
		'<path d="M9 18V6l11-2v12"></path><circle cx="6.5" cy="18" r="2.5"></circle><circle cx="17.5" cy="16" r="2.5"></circle>',
	sliders:
		'<path d="M4 7h9M17 7h3M4 17h3M11 17h9"></path><circle cx="15" cy="7" r="2"></circle><circle cx="9" cy="17" r="2"></circle>',
	plus: '<path d="M12 5v14M5 12h14"></path>',
	'add-above':
		'<path d="M12 3v8M8 7h8"></path><rect x="4" y="14.5" width="16" height="6" rx="2"></rect>',
	'add-below':
		'<rect x="4" y="3.5" width="16" height="6" rx="2"></rect><path d="M12 13v8M8 17h8"></path>',
	copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"></rect><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"></path>',
	'arrow-up': '<path d="M12 19V5M6.5 10.5L12 5l5.5 5.5"></path>',
	'arrow-down': '<path d="M12 5v14M6.5 13.5L12 19l5.5-5.5"></path>',
	minus: '<path d="M5 12h14"></path>',
	back: '<path d="M15 5l-7 7 7 7"></path>',
	'chevron-right': '<path d="M9 6l6 6-6 6"></path>',
	'chevron-left': '<path d="M15 6l-6 6 6 6"></path>',
	'chevron-down': '<path d="M6 9l6 6 6-6"></path>',
	'chevron-up': '<path d="M6 15l6-6 6 6"></path>',
	close: '<path d="M6 6l12 12M18 6L6 18"></path>',
	check: '<path d="M5 12.5l4.5 4.5L19 7.5"></path>',
	search: '<circle cx="11" cy="11" r="6.5"></circle><path d="M16 16l4 4"></path>',
	play: '<path d="M8 5.5v13l11-6.5z"></path>',
	pause:
		'<rect x="6.5" y="5" width="3.5" height="14" rx="1.2"></rect><rect x="14" y="5" width="3.5" height="14" rx="1.2"></rect>',
	stop: '<rect x="6" y="6" width="12" height="12" rx="2.5"></rect>',
	'skip-back': '<path d="M18 6.5L10 12l8 5.5z"></path><path d="M6 6v12"></path>',
	'skip-forward': '<path d="M6 6.5L14 12l-8 5.5z"></path><path d="M18 6v12"></path>',
	trash:
		'<path d="M4 7h16M10 11v6M14 11v6"></path><path d="M6 7l1 12.2A2 2 0 0 0 9 21h6a2 2 0 0 0 2-1.8L18 7"></path><path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"></path>',
	edit: '<path d="M4 20h4L19 9l-4-4L4 16z"></path><path d="M13.5 6.5l4 4"></path>',
	more: '<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3"></path>',
	'more-vertical': '<path d="M12 5h.01M12 12h.01M12 19h.01" stroke-width="3"></path>',
	link: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"></path><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"></path>',
	unlink:
		'<path d="M15.5 12.5l3-3a4 4 0 0 0-5.66-5.66l-2 2"></path><path d="M8.5 11.5l-3 3a4 4 0 0 0 5.66 5.66l2-2"></path><path d="M8 3v2.5M3 8h2.5M16 21v-2.5M21 16h-2.5"></path>',
	video:
		'<rect x="3" y="6" width="12.5" height="12" rx="3"></rect><path d="M15.5 10.5l5.5-3.2v9.4l-5.5-3.2"></path>',
	mic: '<rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"></path>',
	volume:
		'<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"></path><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5"></path>',
	'volume-off':
		'<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"></path><path d="M16 10l4 4M20 10l-4 4"></path>',
	upload:
		'<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"></path><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"></path>',
	download:
		'<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"></path><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"></path>',
	share:
		'<circle cx="18" cy="5.5" r="2.5"></circle><circle cx="6" cy="12" r="2.5"></circle><circle cx="18" cy="18.5" r="2.5"></circle><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1"></path>',
	star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"></path>',
	clock: '<circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5V12l3 2"></path>',
	repeat:
		'<path d="M17 2.5l3 3-3 3"></path><path d="M4 11V9.5a4 4 0 0 1 4-4h12"></path><path d="M7 21.5l-3-3 3-3"></path><path d="M20 13v1.5a4 4 0 0 1-4 4H4"></path>',
	mirror:
		'<path d="M12 3v18"></path><path d="M9 7L3.5 17H9z"></path><path d="M15 7l5.5 10H15z"></path>',
	scissors:
		'<circle cx="6" cy="7" r="2.5"></circle><circle cx="6" cy="17" r="2.5"></circle><path d="M8.2 8.4L20 17M8.2 15.6L20 7"></path>',
	bookmark: '<path d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1z"></path>',
	drag: '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" stroke-width="3"></path>',
	filter: '<path d="M4 5h16l-6 7.5V19l-4 2v-8.5z"></path>',
	sort: '<path d="M7 4v16M3.5 16.5L7 20l3.5-3.5"></path><path d="M17 20V4M13.5 7.5L17 4l3.5 3.5"></path>',
	warning:
		'<path d="M10.3 4.6a2 2 0 0 1 3.4 0l7.5 13a2 2 0 0 1-1.7 3H4.5a2 2 0 0 1-1.7-3z"></path><path d="M12 10v4M12 17h.01"></path>',
	info: '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path>',
	'check-circle':
		'<circle cx="12" cy="12" r="9"></circle><path d="M8 12.5l2.8 2.8L16.5 9.5"></path>',
	eye: '<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"></path><circle cx="12" cy="12" r="3"></circle>',
	'eye-off':
		'<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"></path><path d="M4 4l16 16"></path><circle cx="12" cy="12" r="3"></circle>',
	heart:
		'<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.2 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"></path>',
	people:
		'<circle cx="8.5" cy="8" r="3"></circle><circle cx="16.5" cy="9" r="2.5"></circle><path d="M3 19.5a5.5 5.5 0 0 1 11 0"></path><path d="M15 14.6a4.5 4.5 0 0 1 6 4.9"></path>',
	group:
		'<circle cx="12" cy="7.5" r="3"></circle><circle cx="5.5" cy="10" r="2.2"></circle><circle cx="18.5" cy="10" r="2.2"></circle><path d="M6.5 20a5.5 5.5 0 0 1 11 0"></path><path d="M2.5 17.5a3.2 3.2 0 0 1 3.2-3.2M21.5 17.5a3.2 3.2 0 0 0-3.2-3.2"></path>',
	solo: '<circle cx="12" cy="7.5" r="3.5"></circle><path d="M5 20.5a7 7 0 0 1 14 0"></path>',
	metronome:
		'<path d="M9.2 3.5h5.6L19 20.5H5z"></path><path d="M12 16L16.5 7"></path><path d="M7 16h10"></path>',
	list: '<path d="M9 6h11M9 12h11M9 18h11"></path><path d="M4 6h1M4 12h1M4 18h1"></path>',
	grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"></rect><rect x="13.5" y="3.5" width="7" height="7" rx="2"></rect><rect x="3.5" y="13.5" width="7" height="7" rx="2"></rect><rect x="13.5" y="13.5" width="7" height="7" rx="2"></rect>',
	graph:
		'<circle cx="5" cy="6" r="2"></circle><circle cx="19" cy="6" r="2"></circle><circle cx="12" cy="18" r="2.5"></circle><path d="M7 6h10M6.1 7.8l4.6 8.1M17.9 7.8l-4.6 8.1"></path>',
	route:
		'<circle cx="6" cy="19" r="2.2"></circle><circle cx="18" cy="5" r="2.2"></circle><path d="M8.2 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.8"></path>',
	undo: '<path d="M9 14L4 9l5-5"></path><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"></path>',
	redo: '<path d="M15 14l5-5-5-5"></path><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"></path>',
	external:
		'<path d="M14 4h6v6M20 4l-9 9"></path><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"></path>',
	youtube:
		'<rect x="2.5" y="5.5" width="19" height="13" rx="4"></rect><path d="M10 9.3v5.4l4.6-2.7z" fill="currentColor"></path>',
	refresh:
		'<path d="M20 11a8 8 0 0 0-14.6-4.5M4 3.5v3.5h3.5"></path><path d="M4 13a8 8 0 0 0 14.6 4.5M20 20.5V17h-3.5"></path>',
	logout:
		'<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"></path><path d="M15 16.5L19.5 12 15 7.5M19.5 12H9"></path>',
	phone:
		'<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"></rect><path d="M11 18.5h2"></path>',
	bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2.5h-15z"></path><path d="M10 21a2 2 0 0 0 4 0"></path>',
	note: '<path d="M6.5 3.5h8L19 8v11.5a1 1 0 0 1-1 1H6.5a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z"></path><path d="M14 3.5V8h5"></path><path d="M9 12.5h6M9 16h4"></path>',
	speed: '<path d="M4.5 17.5a8 8 0 1 1 15 0"></path><path d="M12 14l3.5-4.5"></path>',
	expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"></path>',
	image:
		'<rect x="3.5" y="4.5" width="17" height="15" rx="3"></rect><circle cx="9" cy="10" r="1.8"></circle><path d="M20.5 16l-5-5-9 8.5"></path>',
	sun: '<circle cx="12" cy="12" r="4"></circle><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"></path>',
	moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"></path>',
	key: '<circle cx="8" cy="15" r="4"></circle><path d="M11 12l8.5-8.5M16.5 6.5l2.5 2.5M14 9l2 2"></path>',
	flag: '<path d="M5 21V4"></path><path d="M5 4h12l-2.5 4 2.5 4H5"></path>',
	circle: '<circle cx="12" cy="12" r="9"></circle>',
	'move-to': '<path d="M4 12h11M11 6.5l5.5 5.5-5.5 5.5"></path><path d="M20 5v14"></path>'
} as const;

/** Role names that render a canonical icon (the kit's ALIASES). */
export const ALIASES = {
	today: 'calendar',
	moves: 'footprints',
	figures: 'footprints',
	'play-rect': 'lessons',
	'note-music': 'music',
	settings: 'sliders',
	chevron: 'chevron-right',
	pencil: 'edit',
	spot: 'bookmark',
	loop: 'repeat',
	trim: 'scissors',
	partner: 'people',
	positions: 'graph',
	routine: 'route',
	reminder: 'bell',
	device: 'phone',
	speaker: 'volume',
	mute: 'volume-off',
	notes: 'note',
	rate: 'speed',
	fullscreen: 'expand',
	delete: 'trash',
	add: 'plus',
	x: 'close',
	done: 'check-circle'
} as const;

export type CanonicalIconName = keyof typeof CANONICAL;
export type IconName = CanonicalIconName | keyof typeof ALIASES;

function withAliases<T>(
	table: Partial<Record<CanonicalIconName, T>>
): Partial<Record<IconName, T>> {
	const all: Partial<Record<IconName, T>> = { ...table };
	for (const [alias, canon] of Object.entries(ALIASES)) {
		const v = table[canon as CanonicalIconName];
		if (v !== undefined) all[alias as IconName] = v;
	}
	return all;
}

const CANONICAL_FILLED: Partial<Record<CanonicalIconName, string>> = {
	calendar:
		'<rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="currentColor"></rect><path d="M3.5 10h17" stroke="var(--icon-knockout, Canvas)" stroke-width="2"></path><path d="M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>',
	footprints:
		'<g fill="currentColor"><ellipse cx="7.5" cy="7.5" rx="3.3" ry="4.3"></ellipse><ellipse cx="7.8" cy="15.6" rx="2.2" ry="1.9"></ellipse><ellipse cx="16.5" cy="11" rx="3.3" ry="4.3"></ellipse><ellipse cx="16.2" cy="19.1" rx="2.2" ry="1.9"></ellipse></g>',
	lessons:
		'<rect x="2.5" y="4.5" width="19" height="15" rx="4" fill="currentColor"></rect><path d="M10 9v6l5-3z" fill="var(--icon-knockout, Canvas)"></path>',
	music:
		'<path d="M9 18V7" stroke="currentColor" stroke-width="2.4"></path><path d="M20 16V5" stroke="currentColor" stroke-width="2.4"></path><path d="M7.8 5.2l13.4-2.4v4.2L7.8 9.4z" fill="currentColor"></path><circle cx="6.5" cy="18" r="3" fill="currentColor"></circle><circle cx="17.5" cy="16" r="3" fill="currentColor"></circle>',
	group:
		'<circle cx="12" cy="7.5" r="3.6" fill="currentColor"></circle><path d="M5.5 20a6.5 6.5 0 0 1 13 0z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path><circle cx="5.5" cy="10" r="2.6" fill="currentColor"></circle><circle cx="18.5" cy="10" r="2.6" fill="currentColor"></circle>',
	play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor"></path>',
	pause:
		'<rect x="6" y="5" width="4.5" height="14" rx="1.5" fill="currentColor"></rect><rect x="13.5" y="5" width="4.5" height="14" rx="1.5" fill="currentColor"></rect>',
	stop: '<rect x="5.5" y="5.5" width="13" height="13" rx="3" fill="currentColor"></rect>',
	star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path>',
	heart:
		'<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.2 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path>',
	bookmark:
		'<path d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path>',
	bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2.5h-15z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path><path d="M10 21a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>',
	'check-circle':
		'<circle cx="12" cy="12" r="10" fill="currentColor"></circle><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="var(--icon-knockout, Canvas)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>',
	info: '<circle cx="12" cy="12" r="10" fill="currentColor"></circle><path d="M12 11v5.5M12 7.5h.01" fill="none" stroke="var(--icon-knockout, Canvas)" stroke-width="2.2" stroke-linecap="round"></path>',
	warning:
		'<path d="M10.3 4.6a2 2 0 0 1 3.4 0l7.5 13a2 2 0 0 1-1.7 3H4.5a2 2 0 0 1-1.7-3z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"></path><path d="M12 9.5v4.5M12 17h.01" fill="none" stroke="var(--icon-knockout, Canvas)" stroke-width="2.2" stroke-linecap="round"></path>',
	circle: '<circle cx="12" cy="12" r="10" fill="currentColor"></circle>'
};

export const ICONS = withAliases(CANONICAL) as Record<IconName, string>;
export const FILLED: Partial<Record<IconName, string>> = withAliases(CANONICAL_FILLED);
