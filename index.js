
const path = require('path');
const EventEmitter = require('events');

const execa = require('execa');

class Client {
	constructor(options) {
		this.__events = new EventEmitter();
		this.__requestId = 0;
		this.__resolvers = new Map();

		const {
			execa: {
				nodeArguments: execaNodeArguments = [],
				workerArguments: execaWorkerArguments = [],
				options: execaOptions = {},
			} = {},
			...tglibOptions
		} = options;

		this.__childProcess = execa('node', [
			...execaNodeArguments,
			path.join(__dirname, 'worker.js'),
			...execaWorkerArguments,
		], {
			serialization: 'advanced',
			stdio: [ 'inherit', 'inherit', 'inherit', 'ipc' ],
			...execaOptions,
		});
		this.__childProcess.on('message', this.__onWorkerMessage.bind(this));

		this.ready = new Promise((resolve, reject) => {
			this.__resolveReady = resolve;
			this.__rejectReady = reject;
		});

		this.__childProcess.send({
			type: '__init',
			payload: tglibOptions,
		});
	}

	__onWorkerMessage({ type, payload, error, meta }) {
		if (type === '__resolveReady') {
			this.__resolveReady();

			return;
		}

		if (type === '__rejectReady') {
			this.__rejectReady(error);

			return;
		}

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

		if (type === '__uncaughtException') {
			const listeners = this.__events.listeners('uncaughtException');

			if (listeners.length === 0) {
				console.warn(
					'An uncaught exception occured in tglib subprocess:', error,
					'\nWill rethrow it. Fix it, report it on GitHub, or `registerCallback` for `\'uncaughtException\'` to handle it gracefully.',
				);

				throw error;
			}

			this.__events.emit('uncaughtException', error);

			return;
		}

		if (type === '__unhandledRejection') {
			const listeners = this.__events.listeners('unhandledRejection');

			if (listeners.length === 0) {
				console.warn(
					'An unhandled rejection occured in tglib subprocess:', error,
					'\nWill rethrow it. Fix it, report it on GitHub, or `registerCallback` for `\'unhandledRejection\'` to handle it gracefully.',
				);

				throw error;
			}

			this.__events.emit('unhandledRejection', error);

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
