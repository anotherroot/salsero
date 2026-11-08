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
	// The Android app is Kotlin; its build output carries generated JS reports.
	{ ignores: ['android/**'] },
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
			/*
			 * No `projectService`: typed linting of .svelte files cost 203 s and
			 * 2.7 GB on 211 components against 50 s and 0.7 GB without
			 * (eslint-plugin-svelte#1084), and no rule we run needs types but the
			 * one turned off below.
			 */
			parserOptions: {
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		rules: {
			/*
			 * Off: it needs types (without them it misfires on built hrefs), and the
			 * app sets no `paths.base`, so `resolve()` around a path guards nothing.
			 */
			'svelte/no-navigation-without-resolve': 'off'
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
