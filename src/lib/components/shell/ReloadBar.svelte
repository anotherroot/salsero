<script lang="ts">
	import { t } from '$lib/i18n/catalog';
	import { reloadTitle, staleLine, staleTitle } from '$lib/nav/fresh';
	import { reloadOrAsk } from '$lib/unsaved/guard.svelte';
	/*
	 * A new version is out and the page has not reloaded by itself (something
	 * was open, unsaved or running). The app's toast look (`ui/Toast.svelte`) at
	 * the toast's place: above the tab bar (`--pin-bottom`), or above the bottom
	 * edge where none shows. Its second line (`why`, `reloadWhy` in
	 * `$lib/nav/fresh.ts`) says what kept the page. Reload still asks about
	 * anything unsaved, an upload in flight included.
	 *
	 * `stale`: the server has refused this page (`$lib/page-epoch.ts`), so
	 * nothing more it sends will save; the words say so.
	 *
	 * On the desktop it sits over Practice's run column too (`Running`, z-31, above
	 * the frame's sheet corners), as it sits over the run on the phone.
	 */
	let { stale = false, why = '' }: { stale?: boolean; why?: string } = $props();

	/** Above the tab bar or the safe area, and above the offline strip when it shows. */
	const BOTTOM =
		'calc(1rem + var(--pin-bottom, 0px) + var(--pin-safe, var(--safe-bottom)) + var(--strip-h, 0px))';
</script>

<div
	role="status"
	class="fixed inset-x-0 z-30 mx-auto max-w-[560px] px-4 desk:left-(--pane-left) desk:z-[32]"
	style:bottom={BOTTOM}
>
	<div
		class="flex min-h-[52px] items-center gap-3 rounded-2xl bg-inverse-bg py-1.5 pr-1 pl-4 text-inverse-ink shadow-[0_10px_30px_rgb(0_0_0/0.28)]"
	>
		<span class="flex min-w-0 flex-1 flex-col">
			<span class="text-[15px] leading-[1.35] font-bold"
				>{stale ? staleTitle() : reloadTitle()}</span
			>
			{#if stale || why}
				<span class="text-[13px] leading-[1.35] font-semibold opacity-75"
					>{stale ? staleLine() : why}</span
				>
			{/if}
		</span>
		<button
			type="button"
			class="h-11 flex-none cursor-pointer px-3 text-[15px] font-extrabold text-inverse-accent"
			onclick={reloadOrAsk}>{t().shell.reload.reload}</button
		>
	</div>
</div>
