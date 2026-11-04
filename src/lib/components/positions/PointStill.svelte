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
		class: extra = ''
	}: {
		src: string;
		/** The point's moment. */
		ms: number;
		/** What a screen reader hears; omitted, the still is decoration beside its caption. */
		label?: string;
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
	class="pointer-events-none block h-[180px] w-full bg-chip object-cover {extra}"
></video>
