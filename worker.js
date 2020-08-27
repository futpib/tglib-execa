/* global self */

const {
	Client,
} = require('tglib');

const handler = {
	__init(options) {
		this._client = new Client(options);

		[
			'td:update',
			'td:error',
		].forEach(type => this._client.registerCallback(type, payload => {
			self.postMessage({
				type,
				payload,
			});
		}));

		this._requestId = 0;
		this._resolvers = new Map();

		this._client.registerCallback('td:getInput', payload => {
			const requestId = this._requestId;
			this._requestId++;

			self.postMessage({
				type: 'td:getInput',
				payload,
				meta: { requestId },
			});

			return new Promise((resolve, reject) => {
				this._resolvers.set(requestId, { resolve, reject });
			});
		});
	},

	__handleMethodCall(method, query, meta) {
		this._client[method](query).then(payload => {
			self.postMessage({
				type: '__response',
				payload,
				meta,
			});
		}, error => {
			self.postMessage({
				type: '__response',
				error,
				meta,
			});
		});
	},

	_send(query, meta) {
		return this.__handleMethodCall('_send', query, meta);
	},

	_execute(query, meta) {
		return this.__handleMethodCall('_execute', query, meta);
	},

	fetch(query, meta) {
		return this.__handleMethodCall('fetch', query, meta);
	},
};

self.onmessage = ({ data: { type, payload, meta } }) => {
	if (type === 'td:getInput') {
		const { requestId } = meta;
		const { resolve } = handler._resolvers.get(requestId);

		resolve(payload);

		handler._resolvers.delete(requestId);

		return;
	}

	handler[type](payload, meta);
};

process.on('uncaughtException', error => self.onerror(error));
process.on('unhandledRejection', error => self.onerror(error));
