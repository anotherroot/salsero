import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		rules: {
			/*
			 * A raw `new Map()` is not reactive: $state's proxy covers plain objects
			 * and arrays only, so `.set()` mutates it while every derived value goes
			 * on reading the old render. It looks exactly like dead buttons and fails
			 * no test. `SvelteMap` from svelte/reactivity is the fix.
			 *
			 * MEASURED BLIND SPOT: this rule catches `let x = new Map()` but NOT
			 * `$state(new Map())` — it reads the $state wrapper as making the value
			 * reactive, which is the one case where that is false. That second form
			 * is what shipped a broken muscle picker, so the rule narrows the gap
			 * rather than closing it. Verified both ways before writing this down.
			 */
			'svelte/prefer-svelte-reactivity': 'error'
		}
	}
);
