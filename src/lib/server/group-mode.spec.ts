import { describe, expect, it } from 'vitest';
import { openDb } from './db';
import { users } from './db/schema';
import { createTeam, deleteTeam, joinTeam } from './teams';
import { setRole } from './membership';
import { groupChoices } from './group-mode';

function setup() {
	const db = openDb(':memory:');
	for (const id of ['u1', 'u2', 'u3'])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName: id })
			.run();
	createTeam(db, 'u1', 'salsa', 'Tuesdays', 1); // 1
	joinTeam(db, 'u2', 1, 2);
	joinTeam(db, 'u3', 1, 2);
	setRole(db, 1, 'u2', 'editor');
	return db;
}
describe('groupChoices', () => {
	it('lists owner and editor groups of the dance, live only', () => {
		const db = setup();
		createTeam(db, 'u1', 'bachata', 'Bach', 1); // 2
		createTeam(db, 'u1', 'salsa', 'Gone', 1); // 3
		deleteTeam(db, 3, 'u1', 5);
		createTeam(db, 'u3', 'salsa', 'Aaa', 1); // 4
		expect(groupChoices(db, 'u1', 'salsa')).toEqual([
			{ teamId: 1, name: 'Tuesdays', role: 'owner', people: 3 }
		]);
		expect(groupChoices(db, 'u2', 'salsa').map((c) => c.role)).toEqual(['editor']);
		expect(groupChoices(db, 'u3', 'salsa').map((c) => c.name)).toEqual(['Aaa']);
	});
});
