// How an invite code is kept: only its hash. A leaf on purpose: the hook reads an
// invite's language through it without loading invites.ts (qrcode, password).
import { createHash } from 'node:crypto';

/** An invite code as the row keeps it. */
export function hashInviteCode(code: string): string {
	return createHash('sha256').update(code).digest('hex');
}
