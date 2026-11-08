<script lang="ts">
	import { t } from '$lib/i18n/catalog';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { CHIP, FIELD, TICK, iconButton } from '$lib/components/ui/styles';
	import { BRAND } from '$lib/songs/song-page';
	import type { PickEdit } from '$lib/songs/pick-list';
	import type { Dance } from '$lib/dances/dances';
	import type { PickItem } from '$lib/types';

	/**
	 * One song of the pick list (option A2): a tick box, its title and grey line,
	 * the pencil and ↗. Open, the row is the form: the title and artist become
	 * fields where their text was, the song's own style chips under them, and
	 * the song as the list named it.
	 */
	let {
		item,
		dance,
		spotify,
		ticked,
		open,
		edit,
		style,
		meta,
		origin,
		ontick,
		onopen,
		onclose,
		onedit
	}: {
		item: PickItem;
		dance: Dance;
		spotify: boolean;
		ticked: boolean;
		open: boolean;
		edit: PickEdit;
		/** Its style: its own, else Style for all. */
		style: string;
		meta: string;
		origin: string;
		ontick: (on: boolean) => void;
		onopen: () => void;
		onclose: () => void;
		onedit: (e: PickEdit) => void;
	} = $props();

	const w = $derived(t().songs.pick);
	const where = $derived(spotify ? BRAND.spotify : BRAND.youtube);
	/** The fields are named per row, so a label always finds its own. */
	const key = $derived(`pick-${item.i}`);
</script>

<li class="flex flex-col py-2.5 pr-2 pl-4">
	<div class="flex items-center gap-3">
		<input
			type="checkbox"
			class={TICK}
			checked={ticked}
			onchange={(e) => ontick(e.currentTarget.checked)}
			aria-label={edit.title || item.title}
		/>
		{#if open}
			<input
				class="{FIELD} h-11 min-w-0 flex-1 font-bold"
				aria-label={w.titleField}
				value={edit.title}
				oninput={(e) => onedit({ ...edit, title: e.currentTarget.value })}
				maxlength="200"
			/>
		{:else}
			<span class="flex min-w-0 flex-1 flex-col gap-0.5">
				<span class="truncate text-[16px] leading-[1.3] font-bold text-ink"
					>{edit.title || item.title}</span
				>
				<span class="truncate text-[13px] leading-[1.35] text-muted">{meta}</span>
			</span>
		{/if}
		{#if item.already}
			<Badge tone="done">{w.already}</Badge>
		{:else if open}
			<button
				type="button"
				class={iconButton('bare', 'accent-text')}
				onclick={onclose}
				aria-label={w.done}
			>
				<Icon name="check" size={22} stroke={2.6} />
			</button>
		{:else}
			<button
				type="button"
				class={iconButton('bare', 'accent-text')}
				onclick={onopen}
				aria-label={w.edit(edit.title || item.title)}
			>
				<Icon name="edit" size={20} />
			</button>
		{/if}
		{#if !open}
			<!-- eslint-disable svelte/no-navigation-without-resolve -- a link out to Spotify or YouTube -->
			<a
				href={item.url}
				target="_blank"
				rel="external noopener noreferrer"
				class={iconButton('bare', 'accent-text')}
				aria-label={w.open(where)}
			>
				<Icon name="external" size={20} />
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/if}
	</div>
	{#if open}
		<div class="flex flex-col gap-2 pt-1.5 pr-2 pl-9">
			<input
				class="{FIELD} h-10 text-[14px]"
				aria-label={w.artistField}
				value={edit.artist}
				oninput={(e) => onedit({ ...edit, artist: e.currentTarget.value })}
				maxlength="200"
			/>
			<fieldset class="flex flex-wrap gap-1.5">
				<legend class="sr-only">{w.styleOfSong}</legend>
				{#each dance.styles as s (s)}
					<label class={CHIP}>
						<input
							type="radio"
							name="{key}-style"
							value={s}
							checked={style === s}
							onchange={() => onedit({ ...edit, style: s })}
							class="sr-only"
						/>
						{dance.styleLabel[s]}
					</label>
				{/each}
			</fieldset>
			<p class="text-[13px] leading-[1.4] text-muted">{origin}</p>
		</div>
	{/if}
</li>
