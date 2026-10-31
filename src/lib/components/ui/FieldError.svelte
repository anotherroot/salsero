<script lang="ts">
	import Icon from './Icon.svelte';
	import { FIELD_ERROR } from './styles';

	/**
	 * A refusal about one field, shown under it. The field it describes sets
	 * `aria-invalid="true"` and `aria-describedby={id}`.
	 */
	let { id, message }: { id: string; message: string } = $props();
</script>

<p {id} class={FIELD_ERROR}><Icon name="warning" size={16} filled />{message}</p>
