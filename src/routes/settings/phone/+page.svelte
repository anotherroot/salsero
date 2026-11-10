<script lang="ts">
	/**
	 * Settings → On this phone (offline phase 4b, look 1B): what the phone
	 * holds, a switch per space to keep its lesson videos, Only on Wi-Fi (or
	 * why the app can't tell), and Clear kept videos. Everything comes from the
	 * device worker (`kept`); nothing here asks the server.
	 */
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import LowSpaceCard from '$lib/components/settings/LowSpaceCard.svelte';
	import { CLIP, GROUP, ROW, SECTION_LABEL } from '$lib/components/ui/styles';
	import { byteSize } from '$lib/format';
	import { t } from '$lib/i18n/catalog';
	import { changeKeep, kept } from '$lib/offline/kept.svelte';
	import { spaceLine } from '$lib/offline/kept-view';

	const w = $derived(t().settings.onPhone);
	const status = $derived(kept.status);
	/** The person's own videos kept only here (offline phase 4c). */
	const originals = $derived(status?.bytes.originals ?? 0);
	const used = $derived(status ? status.bytes.songs + status.bytes.videos + originals : 0);
	const whole = $derived(status ? used + (status.free ?? 0) : 0);
	const share = (n: number) => (whole > 0 ? `${(n / whole) * 100}%` : '0%');
	const nothingKept = $derived(
		!status ||
			(status.bytes.videos === 0 &&
				status.settings.spaces.length === 0 &&
				status.settings.videos.length === 0)
	);

	let toast = $state<{ id: number; message: string; icon: 'check'; tone: 'done' } | null>(null);
	let seq = 0;
	async function clearAll() {
		await changeKeep({ clear: true });
		toast = { id: ++seq, message: w.cleared, icon: 'check', tone: 'done' };
	}
</script>

<Screen
	title={w.label}
	subtitle={status ? w.sub(byteSize(status.bytes.songs), byteSize(status.bytes.videos)) : undefined}
>
	{#snippet left()}
		<BandButton icon="back" label={t().shell.backTo(t().shell.settings)} href="/settings" />
	{/snippet}

	<div class="flex flex-col px-4 pb-10" data-phone-page>
		{#if !status}
			<p class="px-1 text-[15px] text-muted">{w.notReady}</p>
		{:else}
			{#if status.low}
				<div class="mb-[22px]"><LowSpaceCard {status} /></div>
			{/if}

			<div class="rounded-2xl bg-surface p-4">
				<div class="text-[16px] font-bold text-ink">
					{w.used(byteSize(used), status.free === null ? null : byteSize(status.free))}
				</div>
				<div class="{CLIP} mt-2.5 flex h-3.5 gap-0.5 rounded-full" aria-hidden="true">
					<span class="bg-accent/40" style:width={share(status.bytes.songs)}></span>
					<span class="bg-accent" style:width={share(status.bytes.videos)}></span>
					{#if originals > 0}<span class="bg-ink-2" style:width={share(originals)}></span>{/if}
					<span class="flex-1 bg-track"></span>
				</div>
				<div class="mt-2.5 flex flex-col gap-1 text-[13px] font-semibold text-muted">
					<span class="flex items-center gap-1.5"
						><i class="size-2.5 rounded-[3px] bg-accent/40"></i>{w.legendSongs(
							byteSize(status.bytes.songs)
						)}</span
					>
					<span class="flex items-center gap-1.5"
						><i class="size-2.5 rounded-[3px] bg-accent"></i>{w.legendVideos(
							byteSize(status.bytes.videos)
						)}</span
					>
					{#if originals > 0}
						<span class="flex items-center gap-1.5" data-originals
							><i class="size-2.5 rounded-[3px] bg-ink-2"></i>{w.legendOriginals(
								byteSize(originals)
							)}</span
						>
					{/if}
				</div>
			</div>

			<h2 class="{SECTION_LABEL} mt-[22px] mb-2">{w.spacesLabel}</h2>
			<div class={GROUP}>
				{#each status.spaces as row (row.id)}
					{@const line = spaceLine(row, status)}
					{@const name = row.name ?? w.myLessons}
					<div class="{ROW} pr-3.5" data-space={row.id}>
						<span class="flex min-w-0 flex-1 flex-col">
							<span class="flex items-center gap-1.5 text-[16px] font-bold text-ink">
								{#if row.name !== null}<span class="flex text-accent-text"
										><Icon name="people" size={16} /></span
									>{/if}
								<span class="truncate">{name}</span>
							</span>
							<span class="text-[13px] text-muted">
								{#if line.mark}<span
										class="font-bold {line.mark.tone === 'done' ? 'text-done' : 'text-warn'}"
										>{line.mark.text}</span
									>{/if}{line.mark ? ` · ${line.text}` : line.text}
							</span>
							{#if line.bar !== null}
								<span class="{CLIP} mt-1.5 block h-1 rounded-full bg-track"
									><span class="block h-full bg-accent" style:width="{line.bar * 100}%"
									></span></span
								>
							{/if}
						</span>
						<Switch
							label={name}
							checked={row.on}
							onchange={(on) => void changeKeep({ space: row.id, on })}
						/>
					</div>
				{/each}
			</div>

			{#if status.canTellWifi}
				<div class="{GROUP} mt-3">
					<div class="{ROW} pr-3.5">
						<span class="flex min-w-0 flex-1 flex-col">
							<span class="text-[16px] font-bold text-ink">{w.wifiOnly}</span>
							<span class="text-[13px] text-muted">{w.wifiOnlySub}</span>
						</span>
						<Switch
							label={w.wifiOnly}
							checked={status.settings.wifiOnly}
							onchange={(on) => void changeKeep({ wifiOnly: on })}
						/>
					</div>
				</div>
			{:else}
				<p class="mt-3 flex items-start gap-2.5 px-4 text-[13px] font-medium text-muted">
					<span class="mt-px flex flex-none text-warn"><Icon name="wifi-off" size={18} /></span>
					<span>{w.cantTell}</span>
				</p>
			{/if}

			<p class="mt-2.5 px-4 text-[13px] font-medium text-muted">{w.spaceNote}</p>

			<div class="{GROUP} mt-3">
				<button
					type="button"
					class="{ROW} w-full cursor-pointer text-left disabled:cursor-default"
					disabled={nothingKept}
					onclick={() => void clearAll()}
				>
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="text-[16px] font-bold {nothingKept ? 'text-disabled-ink' : 'text-danger'}"
							>{w.clear}</span
						>
						<span class="text-[13px] text-muted">{w.clearSub}</span>
					</span>
				</button>
			</div>
		{/if}
	</div>
</Screen>

<Toast {toast} ondismiss={() => (toast = null)} />
