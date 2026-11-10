<script lang="ts">
	/**
	 * Short of space on the phone (offline phase 4b): the warning, then what to
	 * take off the phone, largest first, each one tap away. The On this phone
	 * page shows it whole; the one-time sheet only its list (`warning` off).
	 * Nothing goes without the tap: the app never removes anything itself.
	 */
	import Icon from '$lib/components/ui/Icon.svelte';
	import { GROUP, ROW, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import { byteSize } from '$lib/format';
	import { t } from '$lib/i18n/catalog';
	import { changeKeep } from '$lib/offline/kept.svelte';
	import { suggestions } from '$lib/offline/kept-view';
	import type { KeepStatus } from '$lib/offline/protocol';

	let { status, warning = true }: { status: KeepStatus; warning?: boolean } = $props();
	const w = $derived(t().settings.onPhone);
	const rows = $derived(suggestions(status));
</script>

{#if warning}
	<div class="rounded-2xl bg-warn-soft px-4 py-3.5" role="status">
		<div class="flex items-center gap-2 text-[16px] font-extrabold text-warn">
			<Icon name="warning" size={18} />{w.low.title}
		</div>
		{#if status.free !== null}
			<p class="mt-1.5 text-[13.5px] font-medium text-ink-2">{w.low.body(byteSize(status.free))}</p>
		{/if}
	</div>
{/if}
{#if rows.length}
	{#if warning}<h2 class="{SECTION_LABEL} mt-[14px] mb-2">{w.low.suggestions}</h2>{/if}
	<div class={GROUP}>
		{#each rows as s (s.kind === 'space' ? s.id : s.key)}
			<div class="{ROW} pr-3">
				<span class="flex min-w-0 flex-1 flex-col">
					<span class="flex items-center gap-1.5 text-[16px] font-bold text-ink">
						{#if s.kind === 'space' && s.name !== null}<span class="flex text-accent-text"
								><Icon name="people" size={16} /></span
							>{/if}
						<span class="truncate">{s.kind === 'space' ? (s.name ?? w.myLessons) : s.title}</span>
					</span>
					<span class="text-[13px] text-muted">
						{#if s.kind === 'space'}{w.low.spaceSub(s.videos, byteSize(s.bytes))}
						{:else if s.index !== null}{w.low.videoSub(s.index, byteSize(s.bytes))}
						{:else}{w.low.recordingSub(byteSize(s.bytes))}{/if}
					</span>
				</span>
				<button
					type="button"
					class={button('secondary', 'sm')}
					onclick={() =>
						void changeKeep(
							s.kind === 'space' ? { space: s.id, on: false } : { video: s.key, on: false }
						)}>{s.kind === 'space' ? w.low.turnOff : w.low.remove}</button
				>
			</div>
		{/each}
	</div>
{/if}
