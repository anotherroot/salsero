<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import { CLIP } from '$lib/components/ui/styles';
	import {
		keepFailed,
		KEEP_OPTIONS,
		keepReadOnly,
		keepSub,
		keepTitle
	} from '$lib/clones/step-view';
	import type { KeepView, SyncSettings } from '$lib/types';

	/**
	 * Keep in step (spec 2026-11-07, 4A + 4b A): a level of its own over the
	 * Versions list, Back returning to it. This copy's switch, "Your edits go
	 * to the clubs, theirs come here", and its four options indented beneath.
	 * Each tap saves at once (the page's `keep` action, all five switches
	 * posted); a refusal puts the switch back and says so. A copy the person
	 * cannot edit draws them disabled. The page refreshes when the level
	 * closes (a form was sent from it), so the Versions line follows.
	 */
	let {
		open,
		onclose,
		keep,
		title,
		action = '?/keep'
	}: {
		open: boolean;
		onclose: () => void;
		keep: KeepView;
		/** The item's name, under the title. */
		title: string;
		action?: string;
	} = $props();

	// svelte-ignore state_referenced_locally
	let s = $state<SyncSettings>({ ...keep.settings });
	let busy = $state(false);
	let refused = $state<string | null>(null);
	let form: HTMLFormElement | undefined = $state();
	/** What the last save left: a refusal goes back to it (set again on each open). */
	// svelte-ignore state_referenced_locally
	let saved: SyncSettings = { ...keep.settings };

	$effect(() => {
		if (!open) return;
		s = { ...keep.settings };
		saved = { ...keep.settings };
		refused = null;
	});

	async function set(key: keyof SyncSettings, on: boolean) {
		s = { ...s, [key]: on };
		await tick();
		form?.requestSubmit();
	}

	const bit = (on: boolean) => (on ? '1' : '0');
	const locked = $derived(!keep.editable || busy);
</script>

<Sheet title={keepTitle()} sub={title} size="small" back {open} {onclose}>
	<div class="flex flex-col gap-3">
		{#if refused}<Banner kind="error">{refused}</Banner>{/if}
		<form
			bind:this={form}
			method="POST"
			{action}
			class="{CLIP} rounded-2xl bg-surface"
			use:enhance={({ cancel }) => {
				if (!keep.editable) return cancel();
				busy = true;
				refused = null;
				return async ({ result }) => {
					try {
						if (result.type === 'success') saved = { ...s };
						else {
							s = { ...saved };
							const data =
								result.type === 'failure' ? (result.data as { message?: unknown }) : null;
							refused = typeof data?.message === 'string' ? data.message : keepFailed();
						}
					} finally {
						busy = false;
					}
				};
			}}
		>
			{#each ['on', 'names', 'small', 'sections', 'media'] as const as k (k)}
				<input type="hidden" name={k} value={bit(s[k])} />
			{/each}
			<div class="flex min-h-16 items-center gap-3 py-2 pr-2 pl-4">
				<span
					class="flex size-10 flex-none items-center justify-center rounded-xl bg-accent-soft text-accent-text"
					aria-hidden="true"><Icon name="refresh" size={22} /></span
				>
				<span class="flex min-w-0 flex-1 flex-col gap-0.5">
					<span class="text-[16px] leading-tight font-bold text-ink">{keepTitle()}</span>
					<span class="text-[13px] leading-snug text-muted">{keepSub()}</span>
				</span>
				<Switch
					checked={s.on}
					label={keepTitle()}
					disabled={locked}
					onchange={(on) => set('on', on)}
				/>
			</div>
			<ul class="flex flex-col pb-1 pl-[68px] {s.on ? '' : 'opacity-50'}">
				{#each KEEP_OPTIONS as o (o.key)}
					<li class="flex min-h-14 items-center gap-3 border-t border-hairline py-1.5 pr-2">
						<span class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="text-[15px] leading-tight font-bold text-ink">{o.label}</span>
							{#if o.meta}<span class="text-[13px] leading-snug text-muted">{o.meta}</span>{/if}
						</span>
						<Switch
							checked={s[o.key]}
							label={o.label}
							disabled={locked || !s.on}
							onchange={(on) => set(o.key, on)}
						/>
					</li>
				{/each}
			</ul>
		</form>
		{#if !keep.editable}
			<p class="px-1 text-[13px] leading-snug text-muted">{keepReadOnly()}</p>
		{/if}
	</div>
</Sheet>
