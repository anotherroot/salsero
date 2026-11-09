<script lang="ts">
	import { page } from '$app/state';
	import { act } from '$lib/act';
	import { offlineRefusal, refusalMessage, undoToast, type ToastState } from '$lib/act-toast';
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
	import { styleLabelsOf } from '$lib/moves/figures';
	import { LOCALES, LOCALE_NAME, type Locale } from '$lib/i18n/locale';
	import { DEFAULT_REMINDER, reminderToSave } from '$lib/settings/view';
	import { barFraction, usageLine } from '$lib/storage-view';
	import NameFields from '$lib/components/system/NameFields.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import UpdateButton from '$lib/components/system/UpdateButton.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { connection } from '$lib/offline/connection.svelte';
	import { needsConnection } from '$lib/offline/needs-connection-action';
	import { forgetCopy, unsyncedBeforeSignOut } from '$lib/offline/device.svelte';
	import { signOutQuestion } from '$lib/sync/view';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import { VIDEO_SHORT_SIDES } from '$lib/video-sizes';
	import { THEME_CHOICES, showChoice, themeLabel, type ThemeChoice } from '$lib/theme/scheme';
	import {
		PAGE_MOTIONS,
		pageMotion,
		setPageMotion,
		type PageMotion
	} from '$lib/trial/page-motion.svelte';
	import LevelCards from '$lib/components/levels/LevelCards.svelte';
	import { fewSettings, levelShown, levelWords, youPath, type Level } from '$lib/levels/levels';
	import type { ActionResult } from '@sveltejs/kit';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const dance = $derived(DANCES[data.dance]);
	const styleLabels = $derived(styleLabelsOf(dance.styleLabel));
	const styleOptions = $derived(dance.styles.map((s) => ({ value: s, label: styleLabels[s] })));
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

	let sheet = $state<
		'level' | 'style' | 'size' | 'theme' | 'motion' | 'language' | 'ask' | 'name' | null
	>(null);
	// TRIAL: page animations (`$lib/trial/page-motion`).
	const motionOptions = $derived(
		PAGE_MOTIONS.map((m) => ({ value: m, label: t().settings.appearance.motions[m] }))
	);
	let naming = $state(false);
	let nameError = $state<{ field?: 'firstName' | 'lastName'; message: string } | null>(null);
	let asking = $state(false);
	let askError = $state('');

	const w = $derived(t().settings);
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

	/**
	 * Sign out (offline phase 3): what waits goes up first; if anything still has
	 * not synced, it asks before the device forgets it. The copy and its changes
	 * go with the session, never later.
	 */
	let signOutForm = $state<HTMLFormElement | undefined>();
	let losing = $state(0);
	async function signOut(e: SubmitEvent) {
		e.preventDefault();
		const n = await unsyncedBeforeSignOut();
		if (n > 0) {
			losing = n;
			return;
		}
		await forgetCopy();
		signOutForm?.submit();
	}
	async function signOutAnyway() {
		losing = 0;
		await forgetCopy();
		signOutForm?.submit();
	}

	function failed(result: ActionResult) {
		const message = refusalMessage(result, t().settings.couldNotSave);
		if (message === null) return false;
		if (!offlineRefusal(result)) toast = { id: ++seq, message };
		return true;
	}

	/** Post one setting; "Saved" on success, the server's message on a refusal. */
	async function save(name: string, fields: Record<string, string | number>) {
		const result = await act(name, fields);
		if (failed(result)) {
			if (result.type === 'failure' && result.status === 0) reseed();
			return;
		}
		toast = { id: ++seq, message: t().settings.saved, icon: 'check', tone: 'done' };
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
		toast = { id: ++seq, message: t().settings.saved, icon: 'check', tone: 'done' };
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
			t().settings.devices.removed(label),
			() => (toast = null),
			async () => failed(await act('restoreDevice', { id }))
		);
		// Compress videos to is the fallback; at Follow my class it is not drawn, so Name is.
		await focusAfterRemoval(keys, `device-${id}`, ['devices-fallback', 'name-row']);
	}

	async function disconnect(id: number, host: string) {
		const keys = data.apps.map((a) => `app-${a.id}`);
		const result = await act('disconnectApp', { id });
		if (failed(result)) return;
		toast = undoToast(
			++seq,
			t().settings.connector.apps.disconnected(host),
			() => (toast = null),
			async () => failed(await act('reconnectApp', { id }))
		);
		await focusAfterRemoval(keys, `app-${id}`, ['apps-fallback', 'name-row']);
	}

	/** Where an AI app adds this app as a connector. */
	const connectorUrl = $derived(new URL('/mcp', page.url.origin).href);

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

<svelte:head><title>{t().shell.settings} · {dance.label}</title></svelte:head>

<!-- A row that opens a sheet: its label, what is chosen, a chevron. -->
{#snippet opener(
	label: string,
	value: string,
	onclick: () => void,
	focus?: string,
	network = false
)}
	<button
		type="button"
		data-focus={focus}
		use:needsConnection={network ? connection.online : undefined}
		class="flex min-h-[58px] w-full cursor-pointer items-center gap-3 py-2 pr-3.5 pl-4 text-left"
		{onclick}
	>
		<span class="min-w-0 flex-1 text-[16px] font-bold text-ink">{label}</span>
		{#if value}<span class="truncate text-[15px] font-semibold text-muted">{value}</span>{/if}
		<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
	</button>
{/snippet}

<Screen title={t().shell.settings}>
	{#snippet left()}
		<span class="contents desk:hidden" data-desk-hidden>
			<BandButton
				icon="back"
				label={t().shell.backTo(t().shell.tabs.you)}
				href={youPath(level, data.dance)}
			/>
		</span>
	{/snippet}

	<div class={GROUP}>
		{@render opener(
			w.language,
			LOCALE_NAME[data.locale],
			() => (sheet = 'language'),
			undefined,
			true
		)}
	</div>

	<div class={GROUP}>
		{@render opener(
			t().entry.firstRun.level.title,
			levelWords(level).title,
			() => (sheet = 'level')
		)}
	</div>

	{#if !few}
		<span class="{SECTION_LABEL} mt-[14px]">{w.storage.label}</span>
		<div class={GROUP}>
			<div class="flex flex-col gap-2 px-4 py-3">
				<span class="text-[16px] font-bold text-ink">
					{usageLine(data.storage.usedBytes, data.storage.limitBytes)}
				</span>
				{#if data.storage.limitBytes !== null}
					<div
						class="{CLIP} h-2 rounded-full bg-chip"
						role="meter"
						aria-label={w.storage.spaceUsed}
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
			<a href="/settings/storage" class={ROW_TALL} use:needsConnection={connection.online}>
				<LeadTile icon="sliders" />
				<span class="flex min-w-0 flex-1 flex-col">
					<span class="text-[16px] font-bold text-ink">{w.storage.whatUses}</span>
					<span class="text-[13px] text-muted">{w.storage.whatUsesSub}</span>
				</span>
				<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
			</a>
			{#if data.storage.limitBytes !== null}
				{#if data.asked}
					<div class="{ROW_TALL} text-[15px] font-semibold text-muted">{data.asked}</div>
				{:else}
					{@render opener(w.storage.askForMore, '', () => (sheet = 'ask'))}
				{/if}
			{/if}
		</div>
	{/if}

	<span class="{SECTION_LABEL} mt-[14px]">{w.practice.label}</span>
	<div class={GROUP}>
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
			<a href="/voice" class={ROW_TALL}>
				<LeadTile icon="mic" />
				<span class="flex min-w-0 flex-1 flex-col">
					<span class="text-[16px] font-bold text-ink">{t().shell.lists.myCount}</span>
					<span class="text-[13px] text-muted">{data.ownVoice}</span>
				</span>
				<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
			</a>
			{@render opener(
				w.practice.newFigures,
				styleLabels[data.defaultStyle],
				() => (sheet = 'style')
			)}
		{/if}
	</div>
	<p class="px-4 pt-0.5 text-[13px] text-muted">
		{w.practice.perDayNote(daily)}
	</p>

	<span class="{SECTION_LABEL} mt-[14px]">{w.appearance.label}</span>
	<div class={GROUP}>
		{@render opener(
			w.appearance.theme,
			themeLabel(data.theme),
			() => (sheet = 'theme'),
			undefined,
			true
		)}
		{@render opener(
			w.appearance.motion,
			w.appearance.motions[pageMotion.current],
			() => (sheet = 'motion')
		)}
	</div>
	<p class="px-4 pt-0.5 text-[13px] text-muted">{w.appearance.note}</p>

	{#if !data.app && !few}
		<div class="{GROUP} mt-[14px]">
			<a href="/app" class={ROW_TALL}>
				<LeadTile icon="phone" />
				<span class="flex min-w-0 flex-1 flex-col">
					<span class="text-[16px] font-bold text-ink">{t().shell.getApp.title}</span>
					<span class="text-[13px] text-muted">{w.getAppSub}</span>
				</span>
				<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
			</a>
		</div>
	{/if}

	<span class="{SECTION_LABEL} mt-[14px]">{w.android.label}</span>
	<div class={GROUP}>
		{#if data.appUpdate && !few}
			<div class="{ROW} min-h-16 pr-3.5">
				<!-- The installed number, always: the app tells the server only that (its user
				     agent), and the admin page counts the same way ("Salsa app 2"). -->
				<span class="min-w-0 flex-1 text-[16px] font-bold text-ink"
					>{w.android.version(data.appUpdate.installed)}</span
				>
				{#if data.appUpdate.state !== 'none'}<UpdateButton update={data.appUpdate} />{/if}
			</div>
		{/if}
		<div class="{ROW} pr-1.5">
			<LeadTile icon="bell" />
			<span class="flex min-w-0 flex-1 flex-col">
				<span class="text-[16px] font-bold text-ink">{w.android.reminder}</span>
				<span class="text-[13px] text-muted">{w.android.reminderSub}</span>
			</span>
			<Switch
				label={w.android.reminder}
				checked={on}
				onchange={(c) => {
					on = c;
					saveReminder();
				}}
			/>
		</div>
		<div class="{ROW} min-h-[60px] pr-3.5">
			<span class="min-w-0 flex-1 text-[16px] font-bold {on ? 'text-ink' : 'text-disabled-ink'}"
				>{w.android.time}</span
			>
			<input
				type="time"
				aria-label={w.android.reminderTime}
				bind:value={time}
				disabled={!on}
				onchange={saveReminder}
				class="field-sizing-content h-11 min-w-28 flex-none rounded-full bg-field px-3.5 text-center font-sans text-[18px] font-extrabold text-ink tabular-nums disabled:bg-disabled-bg disabled:text-disabled-ink"
			/>
		</div>
		{#if !few}
			{@render opener(
				w.android.compress,
				`${savedSize}p`,
				() => (sheet = 'size'),
				'devices-fallback'
			)}
		{/if}
	</div>
	<p class="px-4 pt-0.5 text-[13px] text-muted">{w.android.note}</p>

	{#if data.devices.length}
		<span class="{SECTION_LABEL} mt-[14px]">{w.devices.label}</span>
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
						aria-label={w.devices.removeLabel(d.label)}
						onclick={() => remove(d.id, d.label)}>{t().common.remove}</button
					>
				</li>
			{/each}
		</ul>
	{/if}

	{#if data.apps.length || !few}
		<span class="{SECTION_LABEL} mt-[14px]">{w.connector.apps.label}</span>
	{/if}
	{#if data.apps.length}
		<ul class={GROUP}>
			{#each data.apps as a (a.id)}
				<li class="{ROW} min-h-16 pr-1.5">
					<LeadTile icon="link" />
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="truncate text-[16px] font-bold text-ink">{a.host}</span>
						{#if a.name}<span class="truncate text-[13px] text-muted"
								>{w.connector.calls(a.name)}</span
							>{/if}
						<span class="text-[13px] text-muted">{a.meta}</span>
					</span>
					<button
						data-focus="app-{a.id}"
						type="button"
						class={button('danger-text', 'sm')}
						aria-label={w.connector.apps.disconnectLabel(a.host)}
						onclick={() => disconnect(a.id, a.host)}>{w.connector.apps.disconnect}</button
					>
				</li>
			{/each}
		</ul>
	{:else if !few}
		<div class="{GROUP} px-4 py-3" data-focus="apps-fallback" tabindex="-1">
			<p class="text-ink2 text-[14px]">{w.connector.apps.empty}</p>
			<p class="mt-1 font-bold break-all text-ink select-all">{connectorUrl}</p>
		</div>
	{/if}

	{#if data.isAdmin}
		<span class="{SECTION_LABEL} mt-[14px]">{w.admin.label}</span>
		<div class={GROUP}>
			<a href="/admin" class={ROW_TALL}>
				<LeadTile icon="people" />
				<span class="flex min-w-0 flex-1 flex-col">
					<span class="text-[16px] font-bold text-ink">{w.admin.label}</span>
					<span class="text-[13px] text-muted">{w.admin.sub}</span>
				</span>
				<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
			</a>
		</div>
	{/if}

	<span class="{SECTION_LABEL} mt-[14px]">{w.account.label}</span>
	<div class={GROUP}>
		{@render opener(
			w.account.name,
			fullName({ ...data.name, email: data.user?.email ?? '' }),
			() => {
				nameError = null;
				sheet = 'name';
			},
			'name-row'
		)}
		<div class="{ROW} min-h-16 pr-1.5">
			<LeadTile icon="solo" />
			<span class="flex min-w-0 flex-1 flex-col">
				<span class="truncate text-[16px] font-bold text-ink">{data.user?.email}</span>
				<span class="text-[13px] text-muted">{w.account.signedIn}</span>
			</span>
			<!--
				A POST, not a link: /logout has always been a POST so that a prefetch or
				a crawled link cannot sign you out from under you.
			-->
			<form
				method="POST"
				action="/logout"
				bind:this={signOutForm}
				onsubmit={signOut}
				use:needsConnection={connection.online}
			>
				<button class={button('tertiary', 'sm')}
					><Icon name="logout" size={18} />{w.account.signOut}</button
				>
			</form>
		</div>
	</div>
</Screen>

<Sheet
	title={t().entry.firstRun.level.title}
	open={sheet === 'level'}
	onclose={() => (sheet = null)}
>
	<div class="pb-2">
		<LevelCards value={data.level} onpick={pickLevel} />
	</div>
</Sheet>

<ChoiceSheet
	open={sheet === 'style'}
	title={w.practice.newFigures}
	intro={w.practice.styleIntro}
	legend={w.practice.style}
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
	title={w.language}
	legend={w.language}
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
	title={w.appearance.theme}
	intro={w.appearance.themeIntro}
	legend={w.appearance.theme}
	options={themeOptions}
	value={data.theme}
	onpick={(theme) => {
		sheet = null;
		void saveTheme(theme as ThemeChoice);
	}}
	onclose={() => (sheet = null)}
/>
<ChoiceSheet
	open={sheet === 'motion'}
	title={w.appearance.motion}
	intro={w.appearance.motionIntro}
	legend={w.appearance.motion}
	options={motionOptions}
	value={pageMotion.current}
	onpick={(m) => {
		sheet = null;
		setPageMotion(m as PageMotion);
	}}
	onclose={() => (sheet = null)}
/>
<ChoiceSheet
	open={sheet === 'size'}
	title={w.android.compress}
	legend={w.android.size}
	options={sizeOptions}
	value={savedSize}
	onpick={(shortSide) => {
		sheet = null;
		void save('videoSize', { shortSide });
	}}
	onclose={() => (sheet = null)}
/>

<Dialog
	open={losing > 0}
	tone="danger"
	icon="logout"
	title={signOutQuestion(losing).title}
	body={signOutQuestion(losing).body}
	onclose={() => (losing = 0)}
>
	{#snippet actions()}
		<button type="button" class={button('danger', 'md', true)} onclick={signOutAnyway}
			>{signOutQuestion(losing).confirm}</button
		>
		<button type="button" class={button('secondary', 'md', true)} onclick={() => (losing = 0)}
			>{t().common.cancel}</button
		>
	{/snippet}
</Dialog>

<Sheet title={w.storage.askForMore} open={sheet === 'ask'} onclose={() => (sheet = null)}>
	<form
		id="ask-more"
		method="POST"
		action="?/ask"
		class="flex flex-col gap-3.5"
		use:guarded={{
			label: t().settings.storage.askForMore,
			submit: ({ cancel }) => {
				if (asking) return cancel();
				askError = '';
				asking = true;
				return async ({ result, update }) => {
					askError =
						result.type === 'failure'
							? String(result.data?.message ?? t().settings.storage.couldNotAsk)
							: '';
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
		<p class="text-[14px] text-muted">{w.storage.askIntro}</p>
		<label class="block">
			<span class={LABEL}>{w.storage.note}</span>
			<textarea name="note" rows="3" maxlength="500" class={TEXTAREA}></textarea>
		</label>
	</form>
	{#snippet footer()}
		<button type="submit" form="ask-more" class={button('primary', 'md', true)} aria-busy={asking}>
			{w.storage.askForMore}
		</button>
	{/snippet}
</Sheet>

<Sheet title={w.account.name} open={sheet === 'name'} onclose={() => (sheet = null)}>
	<form
		id="edit-name"
		method="POST"
		action="?/name"
		class="flex flex-col gap-3.5"
		use:guarded={{
			label: t().entry.welcome.form,
			submit: ({ cancel }) => {
				if (naming) return cancel();
				nameError = null;
				naming = true;
				return async ({ result, update }) => {
					if (result.type === 'failure') {
						nameError = {
							field: result.data?.field as 'firstName' | 'lastName' | undefined,
							message: String(result.data?.message ?? t().settings.couldNotSave)
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
			{t().common.save}
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
