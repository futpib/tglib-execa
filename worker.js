
const { serializeError } = require('serialize-error');

const handler = {
	__init({ tglibModuleName = 'tglib', ...options }) {
		const { Client } = require(tglibModuleName);

		this._client = new Client(options);

		this._client.ready.then(
			() => process.send({
				type: '__resolveReady',
			}),
			error => process.send({
				type: '__rejectReady',
				error: serializeError(error),
			}),
		);

		[
			'td:update',
			'td:error',
		].forEach(type => this._client.registerCallback(type, payload => {
			process.send({
				type,
				payload,
			});
		}));

		this._requestId = 0;
		this._resolvers = new Map();

		this._client.registerCallback('td:getInput', payload => {
			const requestId = this._requestId;
			this._requestId++;

			process.send({
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
			process.send({
				type: '__response',
				payload,
				meta,
			});
		}, error => {
			process.send({
				type: '__response',
				error: serializeError(error),
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

process.on('message', ({ type, payload, meta }) => {
	if (type === 'td:getInput') {
		const { requestId } = meta;
		const { resolve } = handler._resolvers.get(requestId);

		resolve(payload);

		handler._resolvers.delete(requestId);

		return;
	}

	handler[type](payload, meta);
});

process.on('uncaughtException', error => {
	process.send({
		type: '__uncaughtException',
		error: serializeError(error),
	});
	process.disconnect();
});

process.on('unhandledRejection', error => {
	process.send({
		type: '__unhandledRejection',
		error: serializeError(error),
	});
	process.disconnect();
});
