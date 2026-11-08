<script lang="ts">
	import { actAt } from '$lib/act';
	import { refusalMessage, type ToastState } from '$lib/act-toast';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Stepper from '$lib/components/ui/Stepper.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import ChoiceSheet from '$lib/components/system/ChoiceSheet.svelte';
	import LeadTile from '$lib/components/system/LeadTile.svelte';
	import LevelCards from '$lib/components/levels/LevelCards.svelte';
	import { GROUP, ROW, ROW_TALL, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import { clockLabel } from '$lib/clock';
	import { DEFAULT_REMINDER, reminderToSave } from '$lib/settings/view';
	import { THEME_CHOICES, showChoice, themeLabel, type ThemeChoice } from '$lib/theme/scheme';
	import { fewSettings, levelShown, levelWords, type Level } from '$lib/levels/levels';
	import { myCountHref } from '$lib/voice/back';
	import { t } from '$lib/i18n/catalog';
	import type { ActionResult } from '@sveltejs/kit';
	import type { YouSettingsData } from '$lib/types';

	/**
	 * The You page's settings: the rows changed most (How much app?, Exercises a
	 * day, My count, Theme, the daily reminder), then All settings. Each row
	 * behaves as its twin on Settings and posts to Settings' own actions
	 * (`actAt('/settings', …)`), so there is one place that saves. At Follow my
	 * class My count is left out, as Settings leaves it out. `from`: the You page's
	 * path, so My count's Back comes back here.
	 */
	let {
		settings,
		theme,
		from,
		heading = true
	}: {
		settings: YouSettingsData;
		theme: ThemeChoice;
		from: string;
		/** The "Settings" label over the rows; left out where it is the page's only part. */
		heading?: boolean;
	} = $props();

	const level = $derived(levelShown(settings.level));
	const few = $derived(fewSettings(level));

	let sheet = $state<'level' | 'theme' | null>(null);
	let toast = $state<ToastState | null>(null);
	let seq = 0;

	const w = $derived(t().settings);
	const themeOptions = $derived(THEME_CHOICES.map((c) => ({ value: c, label: themeLabel(c) })));

	/** The reminder as saved: the switch and the time. */
	const seed = () => ({
		on: settings.reminderMinute !== null,
		time: clockLabel(settings.reminderMinute) || DEFAULT_REMINDER
	});
	// Seeded from the saved settings (so the first paint is right), and again whenever they reload.
	let on = $state(seed().on);
	let time = $state(seed().time);
	$effect(reseed);
	function reseed() {
		const s = seed();
		on = s.on;
		time = s.time;
	}

	let daily = $state(settings.dailyCount);

	function failed(result: ActionResult) {
		const message = refusalMessage(result, t().settings.couldNotSave);
		if (message === null) return false;
		toast = { id: ++seq, message };
		return true;
	}

	/** Post one setting to Settings; "Saved" on success, the server's message on a refusal. */
	async function save(name: string, fields: Record<string, string | number>): Promise<boolean> {
		const result = await actAt('/settings', name, fields);
		if (failed(result)) return false;
		toast = { id: ++seq, message: t().settings.saved, icon: 'check', tone: 'done' };
		return true;
	}

	async function saveDaily(count: number) {
		const before = settings.dailyCount;
		if (!(await save('dailyCount', { count }))) daily = before;
	}

	/** Shown at once; put back if the server refuses it. */
	async function saveTheme(choice: ThemeChoice) {
		const before = theme;
		showChoice(choice);
		if (!(await save('theme', { theme: choice }))) showChoice(before);
	}

	async function saveReminder() {
		const reminder = reminderToSave(on, time);
		if (reminder === null) {
			time = seed().time;
			return;
		}
		if (!(await save('reminder', { reminder }))) reseed();
	}

	/** A tap on the level already chosen only closes the sheet. */
	function pickLevel(l: Level) {
		sheet = null;
		if (l !== settings.level) void save('level', { level: l });
	}

	const CHOICE_ROW =
		'flex min-h-[58px] w-full cursor-pointer items-center gap-3 py-2 pr-3.5 pl-4 text-left';
</script>

<section class="contents" aria-label={heading ? undefined : t().shell.settings}>
	{#if heading}<h2 class="{SECTION_LABEL} mt-[14px]">{t().shell.settings}</h2>{/if}
	<div class={GROUP}>
		<button type="button" class={CHOICE_ROW} onclick={() => (sheet = 'level')}>
			<span class="min-w-0 flex-1 text-[16px] font-bold text-ink"
				>{t().entry.firstRun.level.title}</span
			>
			<span class="truncate text-[15px] font-semibold text-muted">{levelWords(level).title}</span>
			<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
		</button>
		<div class="min-h-[58px] py-2 pr-3.5 pl-4">
			<Stepper
				bind:value={daily}
				min={1}
				max={30}
				label={w.practice.perDay}
				minusLabel={w.practice.fewer}
				plusLabel={w.practice.more}
				onchange={(count) => void saveDaily(count)}
			/>
		</div>
		{#if !few}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a flat shared route -->
			<a href={myCountHref(from)} class={ROW_TALL}>
				<LeadTile icon="mic" />
				<span class="flex min-w-0 flex-1 flex-col">
					<span class="text-[16px] font-bold text-ink">{t().shell.lists.myCount}</span>
					<span class="text-[13px] text-muted">{settings.ownVoice}</span>
				</span>
				<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
			</a>
		{/if}
		<button type="button" class={CHOICE_ROW} onclick={() => (sheet = 'theme')}>
			<span class="min-w-0 flex-1 text-[16px] font-bold text-ink">{w.appearance.theme}</span>
			<span class="text-[15px] font-semibold text-muted">{themeLabel(theme)}</span>
			<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
		</button>
		<div class="{ROW} pr-1.5">
			<LeadTile icon="bell" />
			<span class="flex min-w-0 flex-1 flex-col">
				<span class="text-[16px] font-bold text-ink">{w.android.reminder}</span>
				<span class="text-[13px] text-muted">{w.you.inApp}</span>
			</span>
			<Switch
				label={w.android.reminder}
				checked={on}
				onchange={(c) => {
					on = c;
					void saveReminder();
				}}
			/>
		</div>
		{#if on}
			<div class="{ROW} min-h-[60px] pr-3.5">
				<span class="min-w-0 flex-1 text-[16px] font-bold text-ink">{w.android.time}</span>
				<input
					type="time"
					aria-label={w.android.reminderTime}
					bind:value={time}
					onchange={() => void saveReminder()}
					class="h-11 w-28 min-w-24 flex-none rounded-full bg-field px-3 text-center font-sans text-[18px] font-extrabold text-ink tabular-nums"
				/>
			</div>
		{/if}
	</div>
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a flat shared route -->
	<a href="/settings" class="{button('secondary', 'md', true)} mt-1">
		<Icon name="settings" size={20} />
		{w.you.allSettings}
	</a>
</section>

<Sheet
	title={t().entry.firstRun.level.title}
	open={sheet === 'level'}
	onclose={() => (sheet = null)}
>
	<div class="pb-2">
		<LevelCards value={settings.level} onpick={pickLevel} />
	</div>
</Sheet>

<ChoiceSheet
	open={sheet === 'theme'}
	title={w.appearance.theme}
	intro={w.appearance.themeIntro}
	legend={w.appearance.theme}
	options={themeOptions}
	value={theme}
	onpick={(choice) => {
		sheet = null;
		void saveTheme(choice as ThemeChoice);
	}}
	onclose={() => (sheet = null)}
/>

<Toast
	toast={toast && {
		id: toast.id,
		message: toast.message,
		action: toast.action,
		icon: toast.icon,
		tone: toast.tone
	}}
	onaction={() => toast?.undo?.()}
	ondismiss={() => (toast = null)}
/>
