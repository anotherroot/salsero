/*
 * A page waiting on the home worker (a song downloading or getting its beats, a
 * pasted list being read) looks again every 10 s. Device first: when the device
 * draws the page, a re-read would show the copy from before the worker's
 * result, so the page asks for a pull, which re-reads it once something changed
 * (`refreshWhenIdle`). Without a device it reloads from the network as before.
 */
export function pollStep(deviceReady: boolean): 'pull' | 'reload' {
	return deviceReady ? 'pull' : 'reload';
}
