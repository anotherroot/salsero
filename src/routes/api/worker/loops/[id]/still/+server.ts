import { putLoopFile } from '../../put';
import type { RequestHandler } from './$types';

/** The loop's still: its first frame, for Reduce motion and Data Saver. */
export const PUT: RequestHandler = ({ params, request }) =>
	putLoopFile(params.id, request, 'still');
