<script lang="ts">
	/**
	 * A point's still: the video's frame at the point's moment, which the
	 * browser draws from the file's metadata (`#t=`), muted and inline. Not a
	 * player: nothing plays until the caller swaps it for one. `src` is the
	 * video's own URL (`/lesson-videos/<file>` or `/recordings/<file>`, as
	 * `SectionVideo.src` carries it); the media servers answer Range requests.
	 */
	let {
		src,
		ms,
		label,
		class: size = 'h-[180px] w-full'
	}: {
		src: string;
		/** The point's moment. */
		ms: number;
		/** What a screen reader hears; omitted, the still is decoration beside its caption. */
		label?: string;
		/** Its size: 180 px tall across by default; a caller's class replaces it, never adds to it. */
		class?: string;
	} = $props();

	const at = $derived(`${src}#t=${(ms / 1000).toFixed(3)}`);
</script>

<video
	src={at}
	preload="metadata"
	muted
	playsinline
	tabindex="-1"
	aria-hidden={label ? undefined : 'true'}
	aria-label={label}
	class="pointer-events-none block bg-chip object-cover {size}"
></video>
