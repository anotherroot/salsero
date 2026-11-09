/*
 * Online or not, as the browser says (offline phase 3): what greys an action
 * that needs a connection. Client-only: on the server it reads online.
 */
export const connection = $state<{ online: boolean }>({ online: true });

if (typeof window !== 'undefined') {
	connection.online = navigator.onLine;
	window.addEventListener('online', () => (connection.online = true));
	window.addEventListener('offline', () => (connection.online = false));
}
