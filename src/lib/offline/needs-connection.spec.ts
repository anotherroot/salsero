import { parse } from 'devalue';
import { describe, expect, it } from 'vitest';
import { NEEDS_CONNECTION, offlineRead, offlineWrite } from './needs-connection';

describe('needs-connection', () => {
	it('an offline action is a failure SvelteKit reads, with no words of its own', () => {
		// The root layout says it, in the person's language; a form's own message would be English.
		const r = offlineWrite(true, 'Needs a connection');
		expect(r.status).toBe(503);
		expect(r.headers).toEqual([['content-type', 'application/json']]);
		const body = JSON.parse(r.body);
		expect(body.type).toBe('failure');
		expect(body.status).toBe(503);
		expect(parse(body.data)).toEqual({ offline: true });
	});
	it('an offline API write is a 503 with a message', () => {
		const r = offlineWrite(false, 'Needs a connection');
		expect(r.status).toBe(503);
		expect(r.headers).toEqual([['content-type', 'application/json']]);
		expect(JSON.parse(r.body)).toEqual({ message: 'Needs a connection' });
	});
	it('an offline read is the needs-connection message', () => {
		expect(NEEDS_CONNECTION).toBe('needs-connection');
		const r = offlineRead();
		expect(r.status).toBe(503);
		expect(JSON.parse(r.body)).toEqual({ message: 'needs-connection' });
	});
});
