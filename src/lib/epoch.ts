/**
 * The page epoch's number, a leaf (offline phase 3): the service worker and the
 * device bundle read it without the catalogs `page-epoch.ts` imports. Raise it
 * here (`$lib/page-epoch` re-exports it): in the commit that makes the
 * server refuse what an older page would still send.
 */
export const PAGE_EPOCH = 12;
