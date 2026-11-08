import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { englishIn } from './no-english';

// Components whose words all come from the catalog: a bare English string in
// one of them is a word left untranslated. Every task that translates a
// component adds it here.
const TRANSLATED: string[] = [
	// The shell (Task 5).
	'src/lib/components/shell/BackButton.svelte',
	'src/lib/components/shell/BandHeader.svelte',
	'src/lib/components/shell/BottomNav.svelte',
	'src/lib/components/shell/CardFrame.svelte',
	'src/lib/components/shell/GroupModeButton.svelte',
	'src/lib/components/shell/ListPane.svelte',
	'src/lib/components/shell/NavProgress.svelte',
	'src/lib/components/shell/PageSkeleton.svelte',
	'src/lib/components/shell/Pane.svelte',
	'src/lib/components/shell/PaneHeading.svelte',
	'src/lib/components/shell/ReloadBar.svelte',
	'src/lib/components/shell/SheetCorner.svelte',
	'src/lib/components/shell/Side.svelte',
	// The system screens (Task 5; NameFields is with the way in, below).
	'src/lib/components/system/AppUpdateBar.svelte',
	'src/lib/components/system/ChoiceSheet.svelte',
	'src/lib/components/system/ErrorScreen.svelte',
	'src/lib/components/system/LeadTile.svelte',
	'src/lib/components/system/StatusBlock.svelte',
	'src/lib/components/system/UpdateButton.svelte',
	'src/lib/components/system/UpdateNeeded.svelte',
	// The shared ui pieces with built-in words, and those with none (Task 5).
	'src/lib/components/ui/AppUploadLink.svelte',
	'src/lib/components/ui/Badge.svelte',
	'src/lib/components/ui/BandButton.svelte',
	'src/lib/components/ui/Banner.svelte',
	'src/lib/components/ui/BottomBar.svelte',
	'src/lib/components/ui/ClashSheet.svelte',
	'src/lib/components/ui/Dialog.svelte',
	'src/lib/components/ui/EmptyState.svelte',
	'src/lib/components/ui/MenuSheet.svelte',
	'src/lib/components/ui/PlayerLayer.svelte',
	'src/lib/components/ui/Screen.svelte',
	'src/lib/components/ui/SearchField.svelte',
	'src/lib/components/ui/Segmented.svelte',
	'src/lib/components/ui/Sheet.svelte',
	'src/lib/components/ui/Toast.svelte',
	'src/lib/components/ui/UnsavedDialog.svelte',
	'src/lib/components/ui/UploadCard.svelte',
	'src/routes/+error.svelte',
	'src/routes/app/+page.svelte',
	// The way in: login, Join, welcome, the first run, a class code (Task 6).
	'src/lib/components/levels/LevelCards.svelte',
	'src/lib/components/system/NameFields.svelte',
	'src/lib/components/teams/ClassCodeField.svelte',
	'src/lib/components/teams/ClassList.svelte',
	'src/lib/components/teams/MyClass.svelte',
	'src/routes/g/[code]/+page.svelte',
	'src/routes/join/+page.svelte',
	'src/routes/login/+page.svelte',
	'src/routes/welcome/+page.svelte',
	'src/routes/welcome/start/+page.svelte'
];

describe('englishIn', () => {
	it("finds an attribute's English, not an expression's", () => {
		expect(englishIn('<button aria-label="Close">{t().common.close}</button>')).toEqual(['Close']);
	});

	it('passes expressions and symbols', () => {
		expect(englishIn('<p>{x}</p><span>·</span>')).toEqual([]);
	});

	it('skips scripts, and text without a word', () => {
		expect(englishIn('<script>const a = "Hi there"</script><b>3 × 2</b>')).toEqual([]);
	});

	it("finds a component's static props", () => {
		expect(englishIn('<Sheet title="Invite someone">')).toEqual(['Invite someone']);
	});

	it('finds text nodes and skips styles, comments and nested braces', () => {
		expect(
			englishIn(
				'<style>.a { color: red }</style><!-- a note --><p>{f({ a: "No way" })} Save it</p>'
			)
		).toEqual(['Save it']);
	});

	it('passes an attribute that is an expression, and one it does not read', () => {
		expect(englishIn('<input placeholder={t().common.search} class="w-full px-2" />')).toEqual([]);
	});
});

describe('translated components', () => {
	it('have no bare English', () => {
		// One test, not it.each: an empty list is an empty suite, which vitest refuses.
		const found = Object.fromEntries(
			TRANSLATED.map((path) => [path, englishIn(readFileSync(path, 'utf8'))] as const).filter(
				([, words]) => words.length > 0
			)
		);
		expect(found).toEqual({});
	});
});
