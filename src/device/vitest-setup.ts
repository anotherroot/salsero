// load the WASM module once before any `new Database()`.
import { initDeviceSqlite } from './sqlite-shim';

await initDeviceSqlite();
