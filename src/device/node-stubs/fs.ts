// node:fs and node:fs/promises on the device. There are no files: reads find
// nothing (ENOENT), writes throw. The media store is phase 4's.
import { thrower, warnOnce } from './warn';

const enoent = (n: string) => thrower(`fs.${n}`, 'ENOENT');
const reject = (n: string) => async (): Promise<never> => enoent(n)();

export const existsSync = () => (warnOnce('fs.existsSync'), false);
export const readdirSync = () => (warnOnce('fs.readdirSync'), []);
// `openDb` makes the database's folder; OPFS has none to make. Expected, so quiet.
export const mkdirSync = () => undefined;
export const readFileSync = enoent('readFileSync');
export const writeFileSync = enoent('writeFileSync');
export const statSync = enoent('statSync');
export const lstatSync = enoent('lstatSync');
export const unlinkSync = enoent('unlinkSync');
export const linkSync = enoent('linkSync');
export const renameSync = enoent('renameSync');
export const rmSync = enoent('rmSync');
export const openSync = enoent('openSync');
export const closeSync = enoent('closeSync');
export const statfsSync = enoent('statfsSync');
export const createReadStream = enoent('createReadStream');
export const createWriteStream = enoent('createWriteStream');
export const constants = { F_OK: 0, R_OK: 4, W_OK: 2, X_OK: 1 };

export const readFile = reject('promises.readFile');
export const writeFile = reject('promises.writeFile');
export const stat = reject('promises.stat');
export const lstat = reject('promises.lstat');
export const unlink = reject('promises.unlink');
export const link = reject('promises.link');
export const rename = reject('promises.rename');
export const rm = reject('promises.rm');
export const open = reject('promises.open');
export const statfs = reject('promises.statfs');
export const appendFile = reject('promises.appendFile');
export const truncate = reject('promises.truncate');
export const copyFile = reject('promises.copyFile');
export const access = reject('promises.access');
export const readdir = async () => (warnOnce('fs.promises.readdir'), []);
export const mkdir = async () => undefined;
export const promises = {
	readFile,
	writeFile,
	stat,
	lstat,
	unlink,
	link,
	rename,
	rm,
	open,
	statfs,
	appendFile,
	truncate,
	copyFile,
	access,
	readdir,
	mkdir
};
export default {
	existsSync,
	readdirSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
	statSync,
	lstatSync,
	unlinkSync,
	linkSync,
	renameSync,
	rmSync,
	openSync,
	closeSync,
	statfsSync,
	createReadStream,
	createWriteStream,
	constants,
	promises
};
