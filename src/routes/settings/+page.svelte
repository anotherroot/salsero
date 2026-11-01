<script lang="ts">
	import { act } from '$lib/act';
	import { refusalMessage, undoToast, type ToastState } from '$lib/act-toast';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import { focusAfterRemoval } from '$lib/focus';
	import Toast from '$lib/components/ui/Toast.svelte';
	import { GROUP, ROW, SECTION_LABEL, button, swap } from '$lib/components/ui/styles';
	import ChoiceSheet from '$lib/components/system/ChoiceSheet.svelte';
	import LeadTile from '$lib/components/system/LeadTile.svelte';
	import { clockLabel } from '$lib/clock';
	import { DANCES } from '$lib/dances/dances';
	import { DEFAULT_REMINDER, reminderToSave } from '$lib/settings/view';
	import { VIDEO_SHORT_SIDES } from '$lib/video-sizes';
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

	let sheet = $state<'style' | 'size' | null>(null);

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
		await focusAfterRemoval(keys, `device-${id}`, 'devices-fallback');
	}

	const savedSize = $derived(String(data.device.shortSide));
</script>

<svelte:head><title>Settings · {dance.label}</title></svelte:head>

<Screen title="Settings">
	{#snippet left()}
		<BandButton icon="back" label="Back to Today" href={`/${data.dance}`} />
	{/snippet}

	<span class={SECTION_LABEL}>Practice</span>
	<div class={GROUP}>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a flat shared route -->
		<a href="/voice" class={swap(ROW, 'min-h-14', 'min-h-16')}>
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
			<span class="text-[15px] font-semibold text-muted">{dance.styleLabel[data.defaultStyle]}</span
			>
			<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
		</button>
	</div>

	<span class="{SECTION_LABEL} mt-[14px]">Android app</span>
	<div class={GROUP}>
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

	<span class="{SECTION_LABEL} mt-[14px]">Account</span>
	<div class={GROUP}>
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
	bottom="calc(1rem + env(safe-area-inset-bottom))"
/>
