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
	'src/lib/components/teams/LeaveSheet.svelte',
	'src/lib/components/songs/SongRow.svelte',
	'src/routes/[dance]/groups/[id]/+page.svelte',
	'src/routes/[dance]/groups/[id]/people/+page.svelte',
	'src/routes/g/[code]/+page.svelte',
	'src/routes/join/+page.svelte',
	'src/routes/login/+page.svelte',
	'src/routes/welcome/+page.svelte',
	'src/routes/welcome/start/+page.svelte',
	// Today: the list, its bar card, Coming up, a past day, New exercise (Task 7).
	'src/lib/components/today/ComingUpList.svelte',
	'src/lib/components/today/ExerciseRow.svelte',
	'src/lib/components/today/NewExerciseSheet.svelte',
	'src/lib/components/today/NextRow.svelte',
	'src/lib/components/today/NothingLeft.svelte',
	'src/lib/components/today/PastDay.svelte',
	'src/lib/components/today/TodayBar.svelte',
	'src/lib/components/today/TodayList.svelte',
	'src/lib/components/today/TodayPaneSkeleton.svelte',
	'src/lib/components/ui/TypeTile.svelte',
	'src/routes/[dance]/(today)/+layout.svelte',
	'src/routes/[dance]/(today)/+page.svelte',
	'src/routes/[dance]/(today)/coming-up/+page.svelte',
	// The exercise page and the log popup, its practice panel and chips (Task 8).
	'src/lib/components/exercises/Face.svelte',
	'src/lib/components/exercises/FaceRating.svelte',
	'src/lib/components/exercises/LastTime.svelte',
	'src/lib/components/exercises/LogShell.svelte',
	'src/lib/components/exercises/SetList.svelte',
	'src/lib/components/exercises/kinds/drill/Content.svelte',
	'src/lib/components/exercises/kinds/drill/Log.svelte',
	'src/lib/components/exercises/kinds/figure/Content.svelte',
	'src/lib/components/exercises/kinds/figure/Log.svelte',
	'src/lib/components/exercises/kinds/lesson/Content.svelte',
	'src/lib/components/exercises/kinds/lesson/Log.svelte',
	'src/lib/components/exercises/kinds/routine/Content.svelte',
	'src/lib/components/exercises/kinds/routine/Log.svelte',
	'src/lib/components/player/ClaveChips.svelte',
	'src/lib/components/player/CountChips.svelte',
	'src/lib/components/player/PracticePanel.svelte',
	'src/lib/components/player/SongPicker.svelte',
	'src/lib/components/player/SongProgress.svelte',
	'src/lib/components/player/SourcePicker.svelte',
	'src/lib/components/player/SpeedChips.svelte',
	'src/lib/components/songs/LiveCount.svelte',
	'src/lib/components/songs/SampleButton.svelte',
	'src/lib/components/songs/SongPickSheet.svelte',
	'src/lib/components/ui/ChunkedUploadButton.svelte',
	'src/lib/components/ui/Stepper.svelte',
	'src/lib/components/ui/UploadButton.svelte',
	'src/routes/[dance]/(today)/exercises/[id]/+page.svelte',
	// The simple lesson page, the Lessons list and comments (Task 9).
	'src/lib/components/comments/CommentItem.svelte',
	'src/lib/components/comments/CommentsCard.svelte',
	'src/lib/components/comments/CommentsSheet.svelte',
	'src/lib/components/comments/Composer.svelte',
	'src/lib/components/lessons/LessonList.svelte',
	'src/lib/components/lessons/LessonRow.svelte',
	'src/lib/components/lessons/SimpleLesson.svelte',
	'src/routes/[dance]/lessons/+layout.svelte',
	'src/routes/[dance]/lessons/+page.svelte',
	// The video player and the inline video (Task 10).
	'src/lib/components/ui/SectionCard.svelte',
	'src/lib/components/ui/SectionPlayer.svelte',
	'src/lib/components/ui/VideoFrame.svelte',
	'src/lib/components/ui/VideoPlayer.svelte',
	'src/lib/components/video/PlayerSheet.svelte',
	'src/lib/components/video/SectionRow.svelte',
	'src/lib/components/video/SectionView.svelte',
	'src/lib/components/video/SpotEditor.svelte',
	'src/lib/components/video/SpotList.svelte',
	'src/lib/components/video/Timeline.svelte',
	'src/lib/components/video/Toast.svelte',
	'src/lib/components/video/TopBar.svelte',
	'src/lib/components/video/Transport.svelte',
	'src/lib/components/video/TrimStrip.svelte',
	'src/lib/components/video/VideoGestures.svelte',
	// Settings and My count (Task 11).
	'src/routes/settings/+page.svelte',
	// Merged from master: the You tab (its page at Follow my class, and its settings rows).
	'src/lib/components/settings/YouSettings.svelte',
	'src/routes/[dance]/you/+page.svelte',
	'src/routes/voice/+page.svelte',
	// What was left on the Follow my class path (Task 12): Music on a class drill, the
	// Practice player a class routine or song opens, and pairing the phone.
	'src/lib/components/player/Running.svelte',
	'src/lib/components/player/SaveSetSheet.svelte',
	'src/lib/components/player/Setup.svelte',
	'src/lib/components/player/StageCount.svelte',
	'src/lib/components/songs/MusicSection.svelte',
	'src/routes/[dance]/player/+page.svelte',
	'src/routes/device/pair/+page.svelte',
	// Part 2. The Moves lists, a move's page and Coverage (Task 2).
	'src/lib/components/moves/FiguresList.svelte',
	'src/lib/components/moves/NavTile.svelte',
	'src/lib/components/moves/RoutinesList.svelte',
	'src/lib/components/moves/SyncCard.svelte',
	'src/routes/[dance]/(moves)/+layout.svelte',
	'src/routes/[dance]/(moves)/coverage/+page.svelte',
	'src/routes/[dance]/(moves)/figures/+page.svelte',
	'src/routes/[dance]/(moves)/moves/[id]/+page.svelte',
	'src/routes/[dance]/(moves)/routines/+page.svelte',
	// The figure page (Task 3; PositionTags is the positions task's).
	'src/lib/components/figures/AddRecordingSheet.svelte',
	'src/lib/components/figures/FigureFields.svelte',
	'src/lib/components/figures/FigureTabs.svelte',
	'src/lib/components/figures/FigureTiming.svelte',
	'src/lib/components/figures/LinkRow.svelte',
	'src/lib/components/figures/MoveSheet.svelte',
	'src/lib/components/figures/RecordingRow.svelte',
	'src/lib/components/figures/RelationsCard.svelte',
	'src/lib/components/figures/RemoveWarning.svelte',
	'src/lib/components/figures/SectionRow.svelte',
	'src/lib/components/figures/TopVideo.svelte',
	'src/lib/components/figures/VariationBar.svelte',
	'src/routes/[dance]/(moves)/figures/[id]/+page.svelte',
	// Routines and the routine editor (part 2, Task 4).
	'src/lib/components/routines/Seam.svelte',
	'src/lib/components/routines/SelectionBar.svelte',
	'src/lib/components/routines/SlotCard.svelte',
	'src/lib/components/routines/SlotList.svelte',
	'src/lib/components/routines/SlotPicker.svelte',
	'src/lib/components/routines/Swipeable.svelte',
	'src/routes/[dance]/(moves)/routines/[id]/+page.svelte',
	// Positions: the list, No position, the sheet, the hold, Templates, a position's page
	// and a figure's tags (part 2, Task 5).
	'src/lib/components/figures/PositionTags.svelte',
	'src/lib/components/moves/PositionsList.svelte',
	'src/lib/components/positions/PositionFields.svelte',
	'src/lib/components/positions/PositionForm.svelte',
	'src/lib/components/positions/PositionRelations.svelte',
	'src/lib/components/positions/PositionRow.svelte',
	'src/lib/components/positions/PositionSheet.svelte',
	'src/lib/components/positions/TemplatesSheet.svelte',
	'src/routes/[dance]/(moves)/positions/+page.svelte',
	'src/routes/[dance]/(moves)/positions/[id]/+page.svelte',
	'src/routes/[dance]/(moves)/positions/none/+page.svelte',
	// How positions work, the map, and a position's links (part 2, Task 6).
	'src/lib/components/positions/HowBody.svelte',
	'src/lib/components/positions/HowSheet.svelte',
	'src/lib/components/positions/MapPane.svelte',
	'src/lib/components/positions/PointRow.svelte',
	'src/lib/components/positions/PointStill.svelte',
	'src/lib/components/positions/PositionLinkPicker.svelte',
	'src/lib/components/positions/PositionMap.svelte',
	'src/routes/[dance]/(moves)/positions/map/+page.svelte'
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

	it('skips a comment inside an expression, an apostrophe in it included', () => {
		expect(
			englishIn(
				"<form use:guarded={{\n\t// the layout's list stays\n\tlabel: t().a /* it's */\n}}>Save it</form>"
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
