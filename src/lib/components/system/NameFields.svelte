<script lang="ts">
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import { FIELD, FIELD_INVALID, LABEL } from '$lib/components/ui/styles';
	import { NAME_MAX } from '$lib/names';
	import { t } from '$lib/i18n/catalog';

	/** First and last name, for Join, /welcome and Settings. `field` marks the one a refusal is about. */
	let {
		firstName = '',
		lastName = '',
		field,
		message,
		idPrefix = 'name'
	}: {
		firstName?: string;
		lastName?: string;
		field?: 'firstName' | 'lastName';
		message?: string;
		idPrefix?: string;
	} = $props();
</script>

<label class="block">
	<span class={LABEL}>{t().entry.name.first}</span>
	<input
		name="firstName"
		autocomplete="given-name"
		required
		maxlength={NAME_MAX}
		value={firstName}
		class={field === 'firstName' ? FIELD_INVALID : FIELD}
		aria-invalid={field === 'firstName' ? 'true' : undefined}
		aria-describedby={field === 'firstName' ? `${idPrefix}-error` : undefined}
	/>
	{#if field === 'firstName' && message}<FieldError id="{idPrefix}-error" {message} />{/if}
</label>

<label class="block">
	<span class={LABEL}>{t().entry.name.last}</span>
	<input
		name="lastName"
		autocomplete="family-name"
		required
		maxlength={NAME_MAX}
		value={lastName}
		class={field === 'lastName' ? FIELD_INVALID : FIELD}
		aria-invalid={field === 'lastName' ? 'true' : undefined}
		aria-describedby={field === 'lastName' ? `${idPrefix}-error` : undefined}
	/>
	{#if field === 'lastName' && message}<FieldError id="{idPrefix}-error" {message} />{/if}
</label>
