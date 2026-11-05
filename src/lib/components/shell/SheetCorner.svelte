<script lang="ts">
	/**
	 * The sheet's rounded corner on the desktop (desktop spec, "The sheet"): a
	 * 28 px band-coloured piece with a quarter circle cut out, laid over the
	 * corner where the sheet meets the band row, so the content scrolls under a
	 * round edge. Beside the side it is the top-left corner only; without the
	 * side (Practice, share) the sheet runs edge to edge and both top corners
	 * round. Over the content, under any dialog (those sit in the top layer).
	 */
	let { frame }: { frame: 'side' | 'bare' } = $props();

	const PIECE = 'pointer-events-none fixed top-[var(--band-row-h)] z-30 hidden h-7 w-7 desk:block';
	// The circle's centre is the piece's corner nearest the sheet; outside it is band.
	const cut = (at: string) =>
		`background: radial-gradient(circle at ${at}, transparent 27.5px, var(--color-band) 28px)`;
</script>

{#if frame === 'side'}
	<div aria-hidden="true" class="{PIECE} left-[var(--side-w)]" style={cut('100% 100%')}></div>
{:else}
	<div aria-hidden="true" class="{PIECE} left-0" style={cut('100% 100%')}></div>
	<div aria-hidden="true" class="{PIECE} right-0" style={cut('0% 100%')}></div>
{/if}
