<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { gotoWhenSettled } from '$lib/sheets/history.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { GROUP, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import type { IconName } from '$lib/icons/icons';
	import {
		chooseButton,
		everythingMeta,
		leaveSub,
		leaveTitle,
		lockedMeta,
		overLimitLine,
		reconnectNote,
		usedMeta
	} from '$lib/teams/leave-view';
	import type { KeepItem, KeepPreview } from '$lib/types';

	/**
	 * Leave a group: keep everything, choose what to keep (a second level), or
	 * keep only what the person's routines use. The preview comes from the
	 * server when the sheet opens; a Choose selection's cost is asked of the
	 * server too (nested copies mean item bytes do not add up).
	 */
	let {
		open,
		onclose,
		team
	}: {
		open: boolean;
		onclose: () => void;
		team: { id: number; name: string };
	} = $props();

	type Mode = 'all' | 'choose' | 'used';
	let mode = $state<Mode>('all');
	let choosing = $state(false);
	let preview = $state<KeepPreview | null>(null);
	let loadFailed = $state(false);
	let busy = $state(false);
	let refused = $state<string | null>(null);
	/** `kind:id` of the rows the person ticked (locked rows are not in it). */
	let ticked = $state<string[]>([]);
	let chosenBytes = $state<number | null>(null);
	const id = $props.id();
	const radio = `leave-${id}`;

	const keyOf = (i: Pick<KeepItem, 'kind' | 'id'>) => `${i.kind}:${i.id}`;
	const url = () => resolve('/api/teams/[id]/keep', { id: String(team.id) });

	$effect(() => {
		if (!open || preview) return;
		loadFailed = false;
		fetch(url())
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
			.then((p: KeepPreview) => (preview = p))
			.catch(() => (loadFailed = true));
	});

	function close() {
		choosing = false;
		refused = null;
		onclose();
	}

	/* The Choose level: sections of rows. A drill comes with its lesson, so none is listed. */
	const lessons = $derived((preview?.lessons ?? []).filter((l) => l.choosable));
	const sections = $derived(
		preview
			? (
					[
						['Lessons', lessons],
						['Routines', preview.routines],
						['Figures', preview.figures],
						['Songs', preview.songs]
					] as [string, KeepItem[]][]
				).filter(([, rows]) => rows.length > 0)
			: []
	);
	const tickedLessons = $derived(
		new Set(lessons.filter((l) => ticked.includes(keyOf(l))).map((l) => l.id))
	);
	/** Locked rows: used by the person's own rows, or brought by a ticked lesson. */
	function locked(i: KeepItem): boolean {
		return i.used !== null || (i.inLesson !== null && tickedLessons.has(i.inLesson));
	}
	const isOn = (i: KeepItem) => locked(i) || ticked.includes(keyOf(i));
	const keptCount = $derived(sections.reduce((n, [, rows]) => n + rows.filter(isOn).length, 0));
	const chosen = $derived(
		(['lesson', 'routine', 'figure', 'song'] as const).flatMap((kind) =>
			sections
				.flatMap(([, rows]) => rows)
				.filter((i) => i.kind === kind && ticked.includes(keyOf(i)) && !locked(i))
		)
	);
	function toggle(i: KeepItem) {
		ticked = ticked.includes(keyOf(i))
			? ticked.filter((k) => k !== keyOf(i))
			: [...ticked, keyOf(i)];
	}

	/* A Choose selection's real cost, debounced as ticks change. */
	$effect(() => {
		if (!choosing) return;
		const q = ['mode=chosen', ...chosen.map((i) => `${i.kind}=${i.id}`)].join('&');
		const ctl = new AbortController();
		const timer = setTimeout(() => {
			fetch(`${url()}?${q}`, { signal: ctl.signal })
				.then((r) => (r.ok ? r.json() : null))
				.then((b: { bytes?: number } | null) => {
					if (b && typeof b.bytes === 'number') chosenBytes = b.bytes;
				})
				.catch(() => {});
		}, 250);
		return () => {
			clearTimeout(timer);
			ctl.abort();
		};
	});

	const over = (bytes: number) =>
		preview !== null &&
		preview.limitBytes !== null &&
		preview.nowBytes + bytes > preview.limitBytes;
	const warn = $derived(
		preview === null || preview.limitBytes === null
			? null
			: choosing
				? chosenBytes !== null && over(chosenBytes)
					? overLimitLine(preview.limitBytes)
					: null
				: mode === 'all' && over(preview.allBytes)
					? overLimitLine(preview.limitBytes)
					: mode === 'used' && over(preview.usedBytes)
						? overLimitLine(preview.limitBytes)
						: null
	);
	const routineUsed = $derived.by(() => {
		const names = new Set(
			(preview?.figures ?? [])
				.filter((f) => f.usedBy === 'routine' && f.used)
				.map((f) => f.used as string)
		);
		return names.size === 1 ? [...names][0] : null;
	});

	const options = $derived<
		{ value: Mode; icon: IconName; label: string; meta: string; danger?: boolean }[]
	>([
		{
			value: 'all',
			icon: 'copy',
			label: 'Keep everything',
			meta: preview ? everythingMeta(preview) : ''
		},
		{ value: 'choose', icon: 'list', label: 'Choose what to keep', meta: '' },
		{
			value: 'used',
			icon: 'route',
			label: 'Keep only what my routines use',
			meta: preview ? usedMeta(preview.usedNames, routineUsed) : '',
			danger: true
		}
	]);

	function submit({ cancel }: { cancel: () => void }) {
		// One leave per tap: a second tap while the first is out is dropped.
		if (busy) return cancel();
		busy = true;
		refused = null;
		return async ({
			result,
			update
		}: {
			result: import('@sveltejs/kit').ActionResult;
			update: () => Promise<void>;
		}) => {
			try {
				if (result.type === 'redirect') {
					const to = result.location;
					close();
					// The Groups list is the layout's: it reloads, so the group leaves it at once.
					await gotoWhenSettled(to, { invalidateAll: true });
				} else if (result.type === 'failure') {
					const d = result.data as { message?: unknown } | undefined;
					refused = typeof d?.message === 'string' ? d.message : 'Could not leave. Try again.';
				} else if (result.type === 'error') {
					refused = 'Could not leave. Try again.';
				} else {
					await update();
				}
			} finally {
				busy = false;
			}
		};
	}
</script>

<Sheet title={leaveTitle(team.name)} sub={leaveSub} {open} onclose={close}>
	<div class="flex flex-col gap-3 pb-2">
		{#if refused}<Banner kind="error">{refused}</Banner>{/if}
		{#if loadFailed}
			<Banner kind="error">Could not load what you would keep. Close this and try again.</Banner>
		{:else if !preview}
			<div class="flex justify-center py-8"><Spinner /></div>
		{:else}
			<fieldset>
				<legend class="sr-only">What to keep</legend>
				<div class={GROUP}>
					{#each options as o (o.value)}
						<label class="flex min-h-[64px] cursor-pointer items-center gap-3 px-4 py-2">
							<span class="flex-none {o.danger ? 'text-danger' : 'text-accent-text'}"
								><Icon name={o.icon} size={22} /></span
							>
							<span class="flex min-w-0 flex-1 flex-col">
								<span class="text-[16px] font-bold text-ink">{o.label}</span>
								{#if o.meta}<span class="text-[13px] text-muted">{o.meta}</span>{/if}
							</span>
							<input
								type="radio"
								name={radio}
								value={o.value}
								checked={mode === o.value}
								class="size-[22px] flex-none cursor-pointer"
								style="accent-color: var(--color-accent)"
								onchange={() => (mode = o.value)}
							/>
						</label>
					{/each}
				</div>
			</fieldset>
			<p class="px-4 text-[13px] text-muted">{reconnectNote}</p>
			{#if warn}<Banner kind="warning">{warn}</Banner>{/if}
		{/if}
	</div>

	{#snippet footer()}
		{#if mode === 'choose'}
			<button
				type="button"
				class={button('primary', 'md', true)}
				disabled={!preview}
				onclick={() => (choosing = true)}>Choose what to keep</button
			>
		{:else}
			<form method="POST" action="?/leave" use:enhance={submit}>
				<input type="hidden" name="mode" value={mode} />
				<button
					type="submit"
					class={button('danger', 'md', true)}
					disabled={!preview}
					aria-busy={busy}
					aria-label={busy ? 'Leaving' : undefined}
				>
					{#if busy}<Spinner />{:else}Leave{/if}
				</button>
			</form>
		{/if}
	{/snippet}
</Sheet>

<Sheet title="Choose what to keep" open={open && choosing} back onclose={() => (choosing = false)}>
	{#if choosing && preview}
		<div class="flex flex-col gap-3 pb-2">
			{#if refused}<Banner kind="error">{refused}</Banner>{/if}
			{#each sections as [name, rows] (name)}
				<section class="flex flex-col gap-2">
					<h3 class={SECTION_LABEL}>{name} · {rows.length}</h3>
					<ul class={GROUP}>
						{#each rows as i (keyOf(i))}
							{@const lock = locked(i)}
							<li>
								<label
									class="flex min-h-14 items-center gap-3 px-4 py-2 {lock ? '' : 'cursor-pointer'}"
								>
									<input
										type="checkbox"
										checked={isOn(i)}
										disabled={lock}
										class="size-[22px] flex-none"
										style="accent-color: var(--color-accent)"
										onchange={() => toggle(i)}
									/>
									<span class="flex min-w-0 flex-1 flex-col">
										<span class="text-[16px] font-bold text-ink">{i.name}</span>
										<span class="text-[13px] text-muted"
											>{i.used !== null && i.usedBy ? lockedMeta(i.meta, i.usedBy) : i.meta}</span
										>
									</span>
								</label>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
			{#if warn}<Banner kind="warning">{warn}</Banner>{/if}
		</div>
	{/if}

	{#snippet footer()}
		<form method="POST" action="?/leave" use:enhance={submit}>
			<input type="hidden" name="mode" value="chosen" />
			{#each chosen as i (keyOf(i))}<input type="hidden" name={i.kind} value={i.id} />{/each}
			<button
				type="submit"
				class={button('danger', 'md', true)}
				aria-busy={busy}
				aria-label={busy ? 'Leaving' : undefined}
			>
				{#if busy}<Spinner />{:else}{chooseButton(keptCount)}{/if}
			</button>
		</form>
	{/snippet}
</Sheet>
