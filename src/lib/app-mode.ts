/**
 * The Android app (a TWA) and the pages it opens. Client-safe.
 *
 * Each launcher opens its dance with `?app=android`; the server keeps that as
 * a cookie, so server-rendered pages know they are inside the app and can hand
 * the native side work through `salsa://` links instead of file inputs. See
 * docs/superpowers/specs/2026-10-14-android-app-design.md.
 */
export const APP_COOKIE = 'salsa_app';
export const APP_PARAM = 'app';
export const APP_VALUE = 'android';
export const APP_SCHEME = 'salsa';
