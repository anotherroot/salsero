/** What the group screens say. PURE and client-safe. */
import { plural } from '$lib/format';
import type { Role } from '$lib/types';

export function roleLabel(role: Role): string {
	return role === 'owner' ? 'Owner' : role === 'editor' ? 'Editor' : 'Member';
}

export function peopleLine(n: number): string {
	return plural(n, 'person', 'people');
}

export function joinQuestion(name: string): string {
	return `Join ${name}?`;
}

export function noAccountLine(adminFirst: string): string {
	return `This code only adds people who already have an account. Ask ${adminFirst} for an invite.`;
}

export function deletingLine(name: string, day: string): string {
	return `${name} is being deleted on ${day} · Make my own copy`;
}
