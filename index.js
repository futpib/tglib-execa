
const path = require('path');
const EventEmitter = require('events');

const execa = require('execa');

class Client {
	constructor(options) {
		this.__events = new EventEmitter();
		this.__requestId = 0;
		this.__resolvers = new Map();

		this.__childProcess = execa('node', [ path.join(__dirname, 'worker.js') ], {
			stdio: [ 'inherit', 'inherit', 'inherit', 'ipc' ],
		});
		this.__childProcess.on('message', this.__onWorkerMessage.bind(this));
		this.__childProcess.send({
			type: '__init',
			payload: options,
		});
	}

	__onWorkerMessage({ type, payload, error, meta }) {
		if (type === '__response') {
			const { requestId } = meta;
			const { resolve, reject } = this.__resolvers.get(requestId);

			if (error) {
				reject(error);
			} else {
				resolve(payload);
			}

			this.__resolvers.delete(requestId);

			return;
		}

		this.__events.listeners(type).forEach(listener => {
			const result = listener(payload);

			if (result && result.then) {
				result.then(payload => {
					this.__childProcess.send({
						type,
						payload,
						meta,
					});
				});
			}
		});
	}

	__onWorkerError(error) {
		throw error;
	}

	__nextRequestId() {
		return this.__requestId++;
	}

	__requestPromise(requestId) {
		return new Promise((resolve, reject) => {
			this.__resolvers.set(requestId, { resolve, reject });
		});
	}

	__request(type, payload) {
		const requestId = this.__nextRequestId();

		this.__childProcess.send({
			type,
			payload,
			meta: { requestId },
		});

		return this.__requestPromise(requestId);
	}

	_destroy() {
		return this.__childProcess.cancel();
	}

	_send(payload) {
		return this.__request('_send', payload);
	}

	_execute(payload) {
		return this.__request('_execute', payload);
	}

	fetch(payload) {
		return this.__request('fetch', payload);
	}

	registerCallback(event, handler) {
		this.__events.on(event, handler);
	}
}

module.exports = {
	Client,
};
