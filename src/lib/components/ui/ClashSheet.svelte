<script lang="ts">
	import { clashTitle, goneTitle } from '$lib/clash/clash';
	import type { ClashAsk } from '$lib/unsaved/guard.svelte';
	import Sheet from './Sheet.svelte';
	import PlayerLayer from './PlayerLayer.svelte';
	import { button, FIELD, LABEL, TEXTAREA } from './styles';

	/*
	 * A save refused because someone else saved the same thing first (option B
	 * of the mockups): their version above, read-only; yours below in an
	 * editable box, started with what you typed. Save mine sends yours over
	 * theirs; Keep theirs drops yours. On something deleted since, what you
	 * typed stays here to copy.
	 *
	 * Mounted once in the root layout for guarded forms (`clashPrompt`), and
	 * by the full-screen player inside itself (`layer`), where a top-layer
	 * sheet would fight the player's own history.
	 */
	interface Props {
		ask: ClashAsk | null;
		onclose: () => void;
		/** Inside the full-screen player: an overlay, not a top-layer sheet. */
		layer?: boolean;
	}

	let { ask, onclose, layer = false }: Props = $props();

	const uid = $props.id();
	/** The Yours boxes, by field: started from the ask each time one opens. */
	let mine = $state<Record<string, string>>({});
	let shownFor: ClashAsk | null = null;
	$effect.pre(() => {
		if (ask === shownFor) return;
		shownFor = ask;
		mine = Object.fromEntries((ask?.view.fields ?? []).map((f) => [f.key, f.mine]));
	});

	const title = $derived(
		!ask ? '' : ask.kind === 'gone' ? goneTitle(ask, Date.now()) : clashTitle(ask, Date.now())
	);
	const sub = $derived(
		ask?.kind === 'gone'
			? 'Nothing was saved. Copy what you typed before you close this.'
			: 'Theirs is saved. Yours is not yet: change it, then pick one.'
	);

	const primary = button('primary', 'md', true);
	const secondary = button('secondary', 'md', true);
	const BOX =
		'rounded-xl bg-step px-3.5 py-3 text-[15px] leading-snug whitespace-pre-line text-ink';
	const CAPTION = 'mb-1 block pl-1 text-[12px] font-bold tracking-wide text-muted uppercase';
</script>

{#snippet body()}
	{#if ask?.kind === 'gone'}
		<div class="flex flex-col gap-3.5">
			{#each ask.typed as t, i (i)}
				<div>
					<label class={LABEL} for="{uid}-typed-{i}">{t.label}</label>
					<textarea
						id="{uid}-typed-{i}"
						readonly
						rows={Math.min(8, t.text.split('\n').length + 1)}
						class={TEXTAREA}
						onfocus={(e) => e.currentTarget.select()}>{t.text}</textarea
					>
				</div>
			{:else}
				<p class="text-[15px] text-ink-2">Nothing was typed.</p>
			{/each}
		</div>
	{:else if ask}
		<div class="flex flex-col gap-5">
			{#each ask.view.fields as f (f.key)}
				<section class="flex flex-col gap-2" aria-labelledby="{uid}-{f.key}">
					<h3 id="{uid}-{f.key}" class="text-[15px] font-extrabold text-ink">{f.label}</h3>
					<div>
						<span class={CAPTION}>Theirs</span>
						<div class={BOX}>{f.theirs || '(empty)'}</div>
					</div>
					{#if f.kind === 'time'}
						<div>
							<span class={CAPTION}>Yours</span>
							<div class={BOX}>{f.mine || '(empty)'}</div>
						</div>
					{:else}
						<div>
							<label class={CAPTION} for="{uid}-mine-{f.key}">Yours</label>
							{#if f.kind === 'multiline'}
								<textarea id="{uid}-mine-{f.key}" rows="5" class={TEXTAREA} bind:value={mine[f.key]}
								></textarea>
							{:else}
								<input
									id="{uid}-mine-{f.key}"
									type={f.kind === 'date' ? 'date' : 'text'}
									class={FIELD}
									bind:value={mine[f.key]}
								/>
							{/if}
						</div>
					{/if}
				</section>
			{/each}
			{#if ask.view.others.length > 0}
				<p class="text-[14px] leading-snug text-ink-2">
					Also changed: {ask.view.others.join(', ')}. Save mine keeps yours there too.
				</p>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet actions()}
	{#if ask?.kind === 'gone'}
		<button type="button" class={primary} onclick={onclose}>Close</button>
	{:else if ask}
		<button type="button" class={primary} onclick={() => ask.mine({ ...mine })}>Save mine</button>
		<button type="button" class={secondary} onclick={() => ask.theirs()}>Keep theirs</button>
	{/if}
{/snippet}

{#if layer}
	{#if ask}
		<PlayerLayer {title} {sub} tall z="z-50" footer={actions} {onclose}>
			{@render body()}
		</PlayerLayer>
	{/if}
{:else}
	<Sheet {title} {sub} open={ask !== null} {onclose} footer={actions}>
		{@render body()}
	</Sheet>
{/if}
