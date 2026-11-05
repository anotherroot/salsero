import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * On desktop every Sheet is a centred dialog (desktop spec, "Popups are
 * dialogs"). CSS is not run by vitest, so these read the source for the values
 * the brief fixes; the look itself is checked against the boards.
 */
const read = (f: string) => readFileSync(f, 'utf8');
const sheet = read('src/lib/components/ui/Sheet.svelte');
const layer = read('src/lib/components/ui/PlayerLayer.svelte');

describe('Sheet on desktop', () => {
	const desk = sheet.slice(sheet.indexOf('@media (width >= 1024px)'));

	it('is 560 wide, 480 when small, at most 780 and 64 off the window', () => {
		expect(desk).toContain('width: 560px;');
		expect(desk).toContain('dialog.small {\n\t\t\twidth: 480px;');
		expect(desk).toContain('max-height: min(780px, 100dvh - 64px);');
		expect(desk).toContain('box-shadow: 0 24px 70px rgb(0 0 0 / 0.32);');
	});

	it('has no grabber, 28 px side padding and takes size="small"', () => {
		expect(desk).toMatch(/\.grabber \{\s*display: none;/);
		expect(sheet.match(/desk:px-7/g)?.length).toBeGreaterThanOrEqual(2);
		expect(sheet).toContain("size?: 'small'");
		expect(sheet).toContain("class:small={size === 'small'}");
	});

	it('draws one scrim and one shadow for stacked levels', () => {
		expect(desk).toContain('dialog:global([data-stacked])::backdrop');
		expect(desk).toContain('dialog:global([data-under])');
	});
});

describe('PlayerLayer on desktop', () => {
	it('gets the dialog geometry in the media palette', () => {
		const panel = layer.split('\n').find((l) => l.includes('sheet-panel'))!;
		expect(layer).toContain("'desk:w-[560px]'");
		expect(panel).toContain('desk:max-h-[min(780px,calc(100%-64px))]');
		expect(layer).toContain('desk:hidden');
		expect(layer).toContain('0 24px 70px rgb(0 0 0 / 0.32)');
	});
});
