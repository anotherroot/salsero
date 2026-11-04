<script lang="ts">
	import { enhance } from '$app/forms';
	import { refreshWhenSettled } from '$lib/sheets/history.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { GROUP, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import {
		CANCEL,
		COMPARE_FAILED,
		NEXT,
		SEND,
		SEND_FAILED,
		SEND_SUB,
		SEND_TITLE,
		THEIRS,
		YOURS,
		bothNote,
		bothTitle,
		deleteRow,
		notSent,
		optionShow,
		sendButton,
		sendNote,
		sendTargetMeta
	} from '$lib/clones/view';
	import type { CloneKind, Picks, SendResult, SendTarget } from '$lib/types';

	/**
	 * Send your changes (board C3 p2): one box per member the person edits,
	 * ticked when something of the page's row would land there; one box per
	 * delete of yours a target still has, unticked. A ticked target with a
	 * field both changed asks first, on a second level stacked over this one
	 * (board C3 p3), a target at a time. Each target lands on its own: the
	 * ones refused say why here, the others stay sent. Fetched on each open,
	 * so each target's `seen` is what the sheet shows.
	 */
	let {
		open,
		onclose,
		kind,
		fromId,
		action = '?/send'
	}: {
		open: boolean;
		onclose: () => void;
		kind: CloneKind;
		/** The page's row: what gives. */
		fromId: number;
		action?: string;
	} = $props();

	const uid = $props.id();
	let targets = $state<SendTarget[] | null>(null);
	let failed = $state(false);
	/** Which targets are ticked, by id. */
	let ticked = $state<Record<number, boolean>>({});
	/** Which of your deletes are ticked, by key. */
	let deletes = $state<Record<string, boolean>>({});
	/** The second level's picks, per target: `'theirs'` is yours (what lands). */
	let both = $state<Record<number, Picks>>({});
	let asking = $state(false);
	let step = $state(0);
	let busy = $state(false);
	let refused = $state<string[]>([]);
	let sent = $state(false);

	const placeOf = (t: SendTarget) => (t.target.place.kind === 'team' ? t.target.place.name : YOURS);
	const sendsAny = (t: SendTarget) =>
		Object.values(t.comparison.picks).some((s) => s === 'theirs') || t.both.length > 0;

	function load() {
		const ask = new AbortController();
		targets = null;
		failed = false;
		const q = new URLSearchParams({ kind, from: String(fromId) });
		fetch(`/api/clones/send?${q}`, { signal: ask.signal })
			.then(async (res) => {
				if (!res.ok) throw new Error(String(res.status));
				const list = (await res.json()) as SendTarget[];
				targets = list;
				ticked = Object.fromEntries(list.map((t) => [t.target.id, sendsAny(t)]));
				deletes = {};
				both = {};
			})
			.catch(() => {
				if (!ask.signal.aborted) failed = true;
			});
		return ask;
	}

	$effect(() => {
		if (!open) return;
		refused = [];
		sent = false;
		asking = false;
		const ask = load();
		return () => ask.abort();
	});

	const chosen = $derived((targets ?? []).filter((t) => ticked[t.target.id]));
	/** Your deletes the chosen targets still have, once each (a piece's key is its family's). */
	const removals = $derived.by(() => {
		const out: [string, string][] = [];
		for (const t of chosen)
			for (const d of t.removals)
				if (!out.some(([k]) => k === d.key)) out.push([d.key, d.mine?.show ?? d.label]);
		return out;
	});
	const toAsk = $derived(chosen.filter((t) => t.both.length > 0));
	const current = $derived(toAsk[Math.min(step, Math.max(toAsk.length - 1, 0))]);
	const groups = $derived(chosen.filter((t) => t.target.place.kind === 'team').length);
	const note = $derived(sendNote(kind, groups));
	const label = $derived(
		sendButton(
			chosen.length,
			chosen[0] ? placeOf(chosen[0]) : '',
			chosen.every((t) => t.target.place.kind === 'team')
		)
	);
	const answered = (t: SendTarget) => t.both.every((d) => both[t.target.id]?.[d.key]);

	/** What each chosen target receives: the sheet's picks, your ticked deletes, the second level's answers. */
	const payload = $derived(
		JSON.stringify(
			chosen.map((t) => {
				const picks: Picks = { ...t.comparison.picks, ...both[t.target.id] };
				for (const d of t.removals) if (deletes[d.key]) picks[d.key] = 'theirs';
				return { id: t.target.id, picks, seen: t.comparison.seen };
			})
		)
	);

	function pick(t: SendTarget, key: string, side: 'mine' | 'theirs') {
		both = { ...both, [t.target.id]: { ...both[t.target.id], [key]: side } };
	}

	function onward() {
		if (toAsk.length === 0) return;
		step = 0;
		asking = true;
	}

	const OPTION =
		'flex min-h-14 cursor-pointer flex-col gap-0.5 rounded-xl border-2 border-transparent bg-step px-3 py-2.5 has-checked:border-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent';
	const CAPTION = 'text-[12px] font-bold tracking-wide text-muted uppercase';
	const BOX = 'size-[22px] flex-none';
</script>

{#snippet sendForm(text: string)}
	<form
		method="POST"
		{action}
		class="contents"
		use:enhance={({ cancel }) => {
			// One send per tap: a second tap while the first is out is dropped.
			if (busy || chosen.length === 0) return cancel();
			busy = true;
			refused = [];
			return async ({ result }) => {
				try {
					// Whatever came back, some target may have landed: closing refreshes the page.
					sent = true;
					if (result.type === 'success') {
						const results = (result.data as { results?: SendResult[] } | undefined)?.results ?? [];
						const out = results.filter((r) => !r.result.ok);
						if (out.length === 0) {
							asking = false;
							onclose();
							await refreshWhenSettled();
							return;
						}
						refused = out.map((r) => {
							const t = targets?.find((x) => x.target.id === r.id);
							const why = r.result.ok ? '' : r.result.message;
							return t ? notSent(placeOf(t), why) : why;
						});
						asking = false;
						load();
					} else {
						refused = [SEND_FAILED];
						asking = false;
						load();
					}
				} finally {
					busy = false;
				}
			};
		}}
	>
		<input type="hidden" name="targets" value={payload} />
		<button
			type="submit"
			class={button('primary', 'md', true)}
			disabled={chosen.length === 0 || !toAsk.every(answered)}
			aria-busy={busy}
		>
			{#if busy}<Spinner />{:else}<Icon name="upload" size={20} />{text}{/if}
		</button>
	</form>
{/snippet}

<Sheet
	title={SEND_TITLE}
	sub={SEND_SUB}
	{open}
	onclose={async () => {
		onclose();
		if (sent) await refreshWhenSettled();
	}}
	tall
>
	<div class="flex flex-col gap-3">
		{#each refused as r (r)}<Banner kind="error">{r}</Banner>{/each}
		{#if failed}
			<Banner kind="error">{COMPARE_FAILED}</Banner>
		{:else if !targets}
			<div class="grid place-items-center py-10 text-muted"><Spinner /></div>
		{:else}
			<ul class={GROUP} aria-label={SEND_TITLE}>
				{#each targets as t (t.target.id)}
					<li>
						<label class="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2">
							<input
								type="checkbox"
								class={BOX}
								style="accent-color: var(--color-accent)"
								checked={ticked[t.target.id] ?? false}
								onchange={(e) => (ticked = { ...ticked, [t.target.id]: e.currentTarget.checked })}
							/>
							<span class="flex min-w-0 flex-1 flex-col">
								<span class="text-[16px] font-bold text-ink">{placeOf(t)}</span>
								<span class="text-[13px] text-muted"
									>{sendTargetMeta(
										t.comparison.diffs,
										t.bytes,
										t.target.place.kind === 'team'
									)}</span
								>
							</span>
						</label>
					</li>
				{/each}
			</ul>
			{#if removals.length > 0}
				<ul class={GROUP}>
					{#each removals as [key, name] (key)}
						{@const row = deleteRow(name)}
						<li>
							<label class="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2">
								<input
									type="checkbox"
									class={BOX}
									style="accent-color: var(--color-accent)"
									checked={deletes[key] ?? false}
									onchange={(e) => (deletes = { ...deletes, [key]: e.currentTarget.checked })}
								/>
								<span class="flex min-w-0 flex-1 flex-col">
									<span class="text-[16px] font-bold text-ink">{row.text}</span>
									<span class="text-[13px] text-muted">{row.meta}</span>
								</span>
							</label>
						</li>
					{/each}
				</ul>
			{/if}
			{#if note}<p class={SECTION_LABEL}>{note}</p>{/if}
		{/if}
	</div>

	{#snippet footer()}
		<div class="grid grid-cols-[1fr_2fr] gap-2">
			<button type="button" class={button('tertiary', 'md', true)} onclick={onclose}
				>{CANCEL}</button
			>
			{#if toAsk.length > 0}
				<button
					type="button"
					class={button('primary', 'md', true)}
					aria-haspopup="dialog"
					onclick={onward}><Icon name="upload" size={20} />{label}</button
				>
			{:else}
				{@render sendForm(label)}
			{/if}
		</div>
	{/snippet}
</Sheet>

{#if current}
	<Sheet
		title={bothTitle(
			placeOf(current),
			current.both.map((d) => d.label)
		)}
		open={open && asking}
		onclose={() => (asking = false)}
		back
	>
		<div class="flex flex-col gap-3">
			{#each current.both as d, i (d.key)}
				<section
					class="flex flex-col gap-2.5 rounded-2xl bg-surface p-4"
					aria-labelledby="{uid}-{i}"
				>
					<h3 id="{uid}-{i}" class="text-[15px] font-extrabold text-ink">{d.label}</h3>
					<div class="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="{uid}-{i}">
						<!-- Yours is what you send (the giver: `theirs` from the target's side). -->
						{#each [{ side: 'theirs' as const, caption: YOURS, field: d.theirs, absent: 'mine' as const }, { side: 'mine' as const, caption: THEIRS, field: d.mine, absent: 'theirs' as const }] as o (o.side)}
							<label class={OPTION}>
								<input
									type="radio"
									class="sr-only"
									name="{uid}-both-{current.target.id}-{i}"
									checked={both[current.target.id]?.[d.key] === o.side}
									onchange={() => pick(current, d.key, o.side)}
								/>
								<span class={CAPTION}>{o.caption}</span>
								<span
									class="text-[15px] leading-snug break-words whitespace-pre-line {o.field
										? 'text-ink'
										: 'text-muted'}">{optionShow(o.field, o.absent)}</span
								>
							</label>
						{/each}
					</div>
				</section>
			{/each}
			<p class={SECTION_LABEL}>{bothNote(placeOf(current))}</p>
		</div>

		{#snippet footer()}
			{#if step < toAsk.length - 1}
				<button
					type="button"
					class={button('primary', 'md', true)}
					disabled={!answered(current)}
					onclick={() => (step += 1)}>{NEXT}<Icon name="chevron-right" size={20} /></button
				>
			{:else}
				{@render sendForm(SEND)}
			{/if}
		{/snippet}
	</Sheet>
{/if}
