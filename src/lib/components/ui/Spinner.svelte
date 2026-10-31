<script lang="ts">
	let { size = 20, label }: { size?: number; label?: string } = $props();
</script>

<!-- An arc on a faint track in the current text colour. -->
<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	style="flex: none"
	class="animate-spin motion-reduce:animate-none"
	aria-hidden={label ? undefined : 'true'}
	role={label ? 'status' : undefined}
	aria-label={label}
>
	<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.25" stroke-width="2.5" />
	<path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
</svg>
