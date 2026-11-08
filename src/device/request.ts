/**
 * A `Request` whose headers are the copy's own: its cookies and user agent,
 * never a session. `Request` forbids setting `cookie`, so the headers come in
 * beside the constructor and the getter returns them.
 */
export class DeviceRequest extends Request {
	readonly #headers: Headers;

	constructor(url: string | URL, init: RequestInit, headers: Headers) {
		super(url, { ...init, headers: undefined });
		this.#headers = headers;
	}

	override get headers(): Headers {
		return this.#headers;
	}
}
