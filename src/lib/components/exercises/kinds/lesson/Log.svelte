<script lang="ts">
	import LogShell, { type LogProps } from '../../LogShell.svelte';
	import Content from './Content.svelte';

	let props: LogProps = $props();
</script>

<!-- A review is watching and remembering, not dancing along: no practice panel. -->
<LogShell {...props} run={null} playing={false}>
	{#snippet body(payload)}
		<Content dance={props.dance} content={payload.content} />
	{/snippet}
</LogShell>
