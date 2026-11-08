<script lang="ts">
	import { act } from '$lib/act';
	import { refusalMessage, undoToast, type ToastState } from '$lib/act-toast';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import Stepper from '$lib/components/ui/Stepper.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import { focusAfterRemoval } from '$lib/focus';
	import Toast from '$lib/components/ui/Toast.svelte';
	import {
		CLIP,
		GROUP,
		LABEL,
		ROW,
		ROW_TALL,
		SECTION_LABEL,
		TEXTAREA,
		button
	} from '$lib/components/ui/styles';
	import ChoiceSheet from '$lib/components/system/ChoiceSheet.svelte';
	import LeadTile from '$lib/components/system/LeadTile.svelte';
	import { fullName } from '$lib/names';
	import { clockLabel } from '$lib/clock';
	import { DANCES } from '$lib/dances/dances';
	import { t } from '$lib/i18n/catalog';
	import { LOCALES, LOCALE_NAME, type Locale } from '$lib/i18n/locale';
	import { DEFAULT_REMINDER, reminderToSave } from '$lib/settings/view';
	import { barFraction, usageLine } from '$lib/storage-view';
	import NameFields from '$lib/components/system/NameFields.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import UpdateButton from '$lib/components/system/UpdateButton.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import { VIDEO_SHORT_SIDES } from '$lib/video-sizes';
	import { THEME_CHOICES, showChoice, themeLabel, type ThemeChoice } from '$lib/theme/scheme';
	import LevelCards from '$lib/components/levels/LevelCards.svelte';
	import { fewSettings, levelShown, levelWords, type Level } from '$lib/levels/levels';
	import type { ActionResult } from '@sveltejs/kit';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const dance = $derived(DANCES[data.dance]);
	const styleOptions = $derived(
		dance.styles.map((s) => ({ value: s, label: dance.styleLabel[s] }))
	);
	const sizeOptions = VIDEO_SHORT_SIDES.map((s) => ({ value: String(s), label: `${s}p` }));

	/** The reminder as saved: the switch and the time. */
	const seed = () => ({
		on: data.device.reminderMinute !== null,
		time: clockLabel(data.device.reminderMinute) || DEFAULT_REMINDER
	});
	// Seeded from the saved settings (so the first paint is right), and again whenever they reload.
	let on = $state(seed().on);
	let time = $state(seed().time);
	$effect(reseed);

	let sheet = $state<'level' | 'style' | 'size' | 'theme' | 'language' | 'ask' | 'name' | null>(
		null
	);
	let naming = $state(false);
	let nameError = $state<{ field?: 'firstName' | 'lastName'; message: string } | null>(null);
	let asking = $state(false);
	let askError = $state('');

	const themeOptions = $derived(THEME_CHOICES.map((c) => ({ value: c, label: themeLabel(c) })));
	const languageOptions = LOCALES.map((l) => ({ value: l, label: LOCALE_NAME[l] }));

	/** A full load, so the whole page, tab bar included, redraws in the new language. */
	async function saveLanguage(l: Locale) {
		if (l === data.locale) return;
		const result = await act('language', { locale: l });
		if (failed(result)) return;
		location.reload();
	}

	/** Shown at once; put back if the server refuses it. */
	async function saveTheme(theme: ThemeChoice) {
		const before = data.theme;
		showChoice(theme);
		const result = await act('theme', { theme });
		if (failed(result)) showChoice(before);
	}

	let toast = $state<ToastState | null>(null);
	let seq = 0;

	function failed(result: ActionResult) {
		const message = refusalMessage(result, 'Could not save.');
		if (message === null) return false;
		toast = { id: ++seq, message };
		return true;
	}

	/** Post one setting; "Saved" on success, the server's message on a refusal. */
	async function save(name: string, fields: Record<string, string | number>) {
		const result = await act(name, fields);
		if (failed(result)) {
			if (result.type === 'failure' && result.status === 0) reseed();
			return;
		}
		toast = { id: ++seq, message: 'Saved', icon: 'check', tone: 'done' };
	}

	let daily = $state(data.dailyCount);

	/** Saves on change; a refusal puts the stored number back. */
	async function saveDaily(count: number) {
		const before = data.dailyCount;
		const result = await act('dailyCount', { count });
		if (failed(result)) {
			daily = before;
			return;
		}
		toast = { id: ++seq, message: 'Saved', icon: 'check', tone: 'done' };
	}

	function reseed() {
		const s = seed();
		on = s.on;
		time = s.time;
	}

	function saveReminder() {
		const reminder = reminderToSave(on, time);
		if (reminder === null) {
			time = seed().time;
			return;
		}
		void save('reminder', { reminder });
	}

	async function remove(id: number, label: string) {
		const keys = data.devices.map((d) => `device-${d.id}`);
		const result = await act('removeDevice', { id });
		if (failed(result)) return;
		toast = undoToast(
			++seq,
			`${label} removed`,
			() => (toast = null),
			async () => failed(await act('restoreDevice', { id }))
		);
		// Compress videos to is the fallback; at Follow my class it is not drawn, so Name is.
		await focusAfterRemoval(keys, `device-${id}`, ['devices-fallback', 'name-row']);
	}

	const savedSize = $derived(String(data.device.shortSide));

	// How much app. At Follow my class Settings draws only what the levels spec lists.
	const level = $derived(levelShown(data.level));
	const few = $derived(fewSettings(level));

	/** A tap on the level already chosen only closes the sheet. */
	function pickLevel(l: Level) {
		sheet = null;
		if (l !== data.level) void save('level', { level: l });
	}
</script>

<svelte:head><title>Settings · {dance.label}</title></svelte:head>

<Screen title="Settings">
	{#snippet left()}
		<span class="contents desk:hidden" data-desk-hidden>
			<BandButton icon="back" label="Back to Today" href={`/${data.dance}`} />
		</span>
	{/snippet}

	<div class={GROUP}>
		<button
			type="button"
			class="flex min-h-[58px] w-full cursor-pointer items-center gap-3 py-2 pr-3.5 pl-4 text-left"
			onclick={() => (sheet = 'language')}
		>
			<span class="min-w-0 flex-1 text-[16px] font-bold text-ink">{t().settings.language}</span>
			<span class="text-[15px] font-semibold text-muted">{LOCALE_NAME[data.locale]}</span>
			<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
		</button>
	</div>

	<div class={GROUP}>
		<button
			type="button"
			class="flex min-h-[58px] w-full cursor-pointer items-center gap-3 py-2 pr-3.5 pl-4 text-left"
			onclick={() => (sheet = 'level')}
		>
			<span class="min-w-0 flex-1 text-[16px] font-bold text-ink">How much app?</span>
			<span class="truncate text-[15px] font-semibold text-muted">{levelWords(level).title}</span>
			<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
		</button>
	</div>

	{#if !few}
		<span class="{SECTION_LABEL} mt-[14px]">Storage</span>
		<div class={GROUP}>
			<div class="flex flex-col gap-2 px-4 py-3">
				<span class="text-[16px] font-bold text-ink">
					{usageLine(data.storage.usedBytes, data.storage.limitBytes)}
				</span>
				{#if data.storage.limitBytes !== null}
					<div
						class="{CLIP} h-2 rounded-full bg-chip"
						role="meter"
						aria-label="Space used"
						aria-valuemin={0}
						aria-valuemax={data.storage.limitBytes}
						aria-valuenow={Math.min(data.storage.usedBytes, data.storage.limitBytes)}
					>
						<div
							class="h-full rounded-full bg-accent"
							style:width="{barFraction(data.storage.usedBytes, data.storage.limitBytes) * 100}%"
						></div>
					</div>
				{/if}
			</div>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a flat shared route -->
			<a href="/settings/storage" class={ROW_TALL}>
				<LeadTile icon="sliders" />
				<span class="flex min-w-0 flex-1 flex-col">
					<span class="text-[16px] font-bold text-ink">What uses space</span>
					<span class="text-[13px] text-muted">Biggest first, with Delete</span>
				</span>
				<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
			</a>
			{#if data.storage.limitBytes !== null}
				{#if data.asked}
					<div class="{ROW_TALL} text-[15px] font-semibold text-muted">{data.asked}</div>
				{:else}
					<button
						type="button"
						class="flex min-h-[58px] w-full cursor-pointer items-center gap-3 py-2 pr-3.5 pl-4 text-left"
						onclick={() => (sheet = 'ask')}
					>
						<span class="min-w-0 flex-1 text-[16px] font-bold text-ink">Ask for more</span>
						<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
					</button>
				{/if}
			{/if}
		</div>
	{/if}

	<span class="{SECTION_LABEL} mt-[14px]">Practice</span>
	<div class={GROUP}>
		<div class="min-h-[58px] py-2 pr-3.5 pl-4">
			<Stepper
				bind:value={daily}
				min={1}
				max={30}
				label="Exercises a day"
				minusLabel="Fewer"
				plusLabel="More"
				onchange={(count) => void saveDaily(count)}
			/>
		</div>
		{#if !few}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a flat shared route -->
			<a href="/voice" class={ROW_TALL}>
				<LeadTile icon="mic" />
				<span class="flex min-w-0 flex-1 flex-col">
					<span class="text-[16px] font-bold text-ink">My count</span>
					<span class="text-[13px] text-muted">{data.ownVoice}</span>
				</span>
				<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
			</a>
			<button
				type="button"
				class="flex min-h-[58px] w-full cursor-pointer items-center gap-3 py-2 pr-3.5 pl-4 text-left"
				onclick={() => (sheet = 'style')}
			>
				<span class="min-w-0 flex-1 text-[16px] font-bold text-ink">New figures start on</span>
				<span class="text-[15px] font-semibold text-muted"
					>{dance.styleLabel[data.defaultStyle]}</span
				>
				<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
			</button>
		{/if}
	</div>
	<p class="px-4 pt-0.5 text-[13px] text-muted">
		Today shows this many. When they're done, Next {daily} brings more.
	</p>

	<span class="{SECTION_LABEL} mt-[14px]">Appearance</span>
	<div class={GROUP}>
		<button
			type="button"
			class="flex min-h-[58px] w-full cursor-pointer items-center gap-3 py-2 pr-3.5 pl-4 text-left"
			onclick={() => (sheet = 'theme')}
		>
			<span class="min-w-0 flex-1 text-[16px] font-bold text-ink">Theme</span>
			<span class="text-[15px] font-semibold text-muted">{themeLabel(data.theme)}</span>
			<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
		</button>
	</div>
	<p class="px-4 pt-0.5 text-[13px] text-muted">For this browser or phone only.</p>

	{#if !data.app && !few}
		<div class="{GROUP} mt-[14px]">
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a flat shared route -->
			<a href="/app" class={ROW_TALL}>
				<LeadTile icon="phone" />
				<span class="flex min-w-0 flex-1 flex-col">
					<span class="text-[16px] font-bold text-ink">Get the app</span>
					<span class="text-[13px] text-muted">For your phone's home screen</span>
				</span>
				<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
			</a>
		</div>
	{/if}

	<span class="{SECTION_LABEL} mt-[14px]">Android app</span>
	<div class={GROUP}>
		{#if data.appUpdate && !few}
			<div class="{ROW} min-h-16 pr-3.5">
				<!-- The installed number, always: the app tells the server only that (its user
				     agent), and the admin page counts the same way ("Salsa app 2"). -->
				<span class="min-w-0 flex-1 text-[16px] font-bold text-ink"
					>Version {data.appUpdate.installed}</span
				>
				{#if data.appUpdate.state !== 'none'}<UpdateButton update={data.appUpdate} />{/if}
			</div>
		{/if}
		<div class="{ROW} pr-1.5">
			<LeadTile icon="bell" />
			<span class="flex min-w-0 flex-1 flex-col">
				<span class="text-[16px] font-bold text-ink">Daily reminder</span>
				<span class="text-[13px] text-muted">What is due, as a notification</span>
			</span>
			<Switch
				label="Daily reminder"
				checked={on}
				onchange={(c) => {
					on = c;
					saveReminder();
				}}
			/>
		</div>
		<div class="{ROW} min-h-[60px] pr-3.5">
			<span class="min-w-0 flex-1 text-[16px] font-bold {on ? 'text-ink' : 'text-disabled-ink'}"
				>Time</span
			>
			<input
				type="time"
				aria-label="Reminder time"
				bind:value={time}
				disabled={!on}
				onchange={saveReminder}
				class="h-11 w-28 min-w-24 flex-none rounded-full bg-field px-3 text-center font-sans text-[18px] font-extrabold text-ink tabular-nums disabled:bg-disabled-bg disabled:text-disabled-ink"
			/>
		</div>
		{#if !few}
			<button
				type="button"
				data-focus="devices-fallback"
				class="flex min-h-[58px] w-full cursor-pointer items-center gap-3 py-2 pr-3.5 pl-4 text-left"
				onclick={() => (sheet = 'size')}
			>
				<span class="min-w-0 flex-1 text-[16px] font-bold text-ink">Compress videos to</span>
				<span class="text-[15px] font-semibold text-muted">{savedSize}p</span>
				<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
			</button>
		{/if}
	</div>
	<p class="px-4 pt-0.5 text-[13px] text-muted">Read by the phone app when it opens.</p>

	{#if data.devices.length}
		<span class="{SECTION_LABEL} mt-[14px]">Paired phones</span>
		<ul class={GROUP}>
			{#each data.devices as d (d.id)}
				<li class="{ROW} min-h-16 pr-1.5">
					<LeadTile icon="phone" />
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="truncate text-[16px] font-bold text-ink">{d.label}</span>
						<span class="text-[13px] text-muted">{d.meta}</span>
					</span>
					<button
						data-focus="device-{d.id}"
						type="button"
						class={button('danger-text', 'sm')}
						aria-label="Remove {d.label}"
						onclick={() => remove(d.id, d.label)}>Remove</button
					>
				</li>
			{/each}
		</ul>
	{/if}

	{#if data.isAdmin}
		<span class="{SECTION_LABEL} mt-[14px]">Admin</span>
		<div class={GROUP}>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a flat shared route -->
			<a href="/admin" class={ROW_TALL}>
				<LeadTile icon="people" />
				<span class="flex min-w-0 flex-1 flex-col">
					<span class="text-[16px] font-bold text-ink">Admin</span>
					<span class="text-[13px] text-muted">Invite someone</span>
				</span>
				<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
			</a>
		</div>
	{/if}

	<span class="{SECTION_LABEL} mt-[14px]">Account</span>
	<div class={GROUP}>
		<button
			type="button"
			data-focus="name-row"
			class="flex min-h-[58px] w-full cursor-pointer items-center gap-3 py-2 pr-3.5 pl-4 text-left"
			onclick={() => {
				nameError = null;
				sheet = 'name';
			}}
		>
			<span class="min-w-0 flex-1 text-[16px] font-bold text-ink">Name</span>
			<span class="truncate text-[15px] font-semibold text-muted">
				{fullName({ ...data.name, email: data.user?.email ?? '' })}
			</span>
			<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
		</button>
		<div class="{ROW} min-h-16 pr-1.5">
			<LeadTile icon="solo" />
			<span class="flex min-w-0 flex-1 flex-col">
				<span class="truncate text-[16px] font-bold text-ink">{data.user?.email}</span>
				<span class="text-[13px] text-muted">Signed in</span>
			</span>
			<!--
				A POST, not a link: /logout has always been a POST so that a prefetch or
				a crawled link cannot sign you out from under you.
			-->
			<form method="POST" action="/logout">
				<button class={button('tertiary', 'sm')}><Icon name="logout" size={18} />Sign out</button>
			</form>
		</div>
	</div>
</Screen>

<Sheet title="How much app?" open={sheet === 'level'} onclose={() => (sheet = null)}>
	<div class="pb-2">
		<LevelCards value={data.level} onpick={pickLevel} />
	</div>
</Sheet>

<ChoiceSheet
	open={sheet === 'style'}
	title="New figures start on"
	intro="The style a new figure starts on. You can change it on the figure."
	legend="Style"
	options={styleOptions}
	value={data.defaultStyle}
	onpick={(style) => {
		sheet = null;
		void save('style', { dance: data.dance, style });
	}}
	onclose={() => (sheet = null)}
/>
<ChoiceSheet
	open={sheet === 'language'}
	title={t().settings.language}
	legend={t().settings.language}
	options={languageOptions}
	value={data.locale}
	onpick={(l) => {
		sheet = null;
		void saveLanguage(l as Locale);
	}}
	onclose={() => (sheet = null)}
/>
<ChoiceSheet
	open={sheet === 'theme'}
	title="Theme"
	intro="System follows the phone's or computer's own light or dark setting."
	legend="Theme"
	options={themeOptions}
	value={data.theme}
	onpick={(theme) => {
		sheet = null;
		void saveTheme(theme as ThemeChoice);
	}}
	onclose={() => (sheet = null)}
/>
<ChoiceSheet
	open={sheet === 'size'}
	title="Compress videos to"
	legend="Size"
	options={sizeOptions}
	value={savedSize}
	onpick={(shortSide) => {
		sheet = null;
		void save('videoSize', { shortSide });
	}}
	onclose={() => (sheet = null)}
/>

<Sheet title="Ask for more" open={sheet === 'ask'} onclose={() => (sheet = null)}>
	<form
		id="ask-more"
		method="POST"
		action="?/ask"
		class="flex flex-col gap-3.5"
		use:guarded={{
			label: 'Ask for more',
			submit: ({ cancel }) => {
				if (asking) return cancel();
				askError = '';
				asking = true;
				return async ({ result, update }) => {
					askError =
						result.type === 'failure' ? String(result.data?.message ?? 'Could not ask.') : '';
					try {
						await update();
						if (result.type === 'success') sheet = null;
					} finally {
						asking = false;
					}
				};
			}
		}}
	>
		{#if askError}<Banner kind="error" title={askError} />{/if}
		<p class="text-[14px] text-muted">The admin sees how much you use. A note is optional.</p>
		<label class="block">
			<span class={LABEL}>Note</span>
			<textarea name="note" rows="3" maxlength="500" class={TEXTAREA}></textarea>
		</label>
	</form>
	{#snippet footer()}
		<button type="submit" form="ask-more" class={button('primary', 'md', true)} aria-busy={asking}>
			Ask for more
		</button>
	{/snippet}
</Sheet>

<Sheet title="Name" open={sheet === 'name'} onclose={() => (sheet = null)}>
	<form
		id="edit-name"
		method="POST"
		action="?/name"
		class="flex flex-col gap-3.5"
		use:guarded={{
			label: 'Your name',
			submit: ({ cancel }) => {
				if (naming) return cancel();
				nameError = null;
				naming = true;
				return async ({ result, update }) => {
					if (result.type === 'failure') {
						nameError = {
							field: result.data?.field as 'firstName' | 'lastName' | undefined,
							message: String(result.data?.message ?? 'Could not save.')
						};
					}
					try {
						await update({ reset: false });
						if (result.type === 'success') sheet = null;
					} finally {
						naming = false;
					}
				};
			}
		}}
	>
		<NameFields
			idPrefix="settings-name"
			firstName={data.name.firstName}
			lastName={data.name.lastName}
			field={nameError?.field}
			message={nameError?.message}
		/>
	</form>
	{#snippet footer()}
		<button type="submit" form="edit-name" class={button('primary', 'md', true)} aria-busy={naming}>
			Save
		</button>
	{/snippet}
</Sheet>

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
	bottom="calc(1rem + var(--safe-bottom))"
/>
