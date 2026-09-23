/**
 * Captures microphone frames and hands them to the main thread.
 *
 * It exists so the recording and the click share ONE clock. `currentFrame` is
 * the context's own sample counter, so posting it with the first block ties
 * every captured sample to the same timeline the click was scheduled on — and
 * the slicer can then do arithmetic instead of onset detection. `MediaRecorder`
 * reports no such origin, which is why it is not used here.
 *
 * Served from `static/` rather than bundled: `addModule()` takes a URL.
 */
class RecorderProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.started = false;
	}

	process(inputs) {
		const channel = inputs[0] && inputs[0][0];
		// An input can be absent for a render quantum while the stream settles.
		// Returning true keeps the node alive rather than ending the capture.
		if (!channel) return true;

		if (!this.started) {
			this.started = true;
			this.port.postMessage({ type: 'start', frame: currentFrame });
		}
		// `channel` is recycled between render quanta, so it must be COPIED —
		// posting it directly would hand over a view that is overwritten 2.7 ms
		// later, and the capture would come back as the last block repeated.
		this.port.postMessage({ type: 'block', data: channel.slice() });
		return true;
	}
}

registerProcessor('recorder', RecorderProcessor);
