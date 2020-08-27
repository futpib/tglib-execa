
const test = require('ava');
const sinon = require('sinon');

const invariant = require('invariant');

const pRetry = require('p-retry');
const tempy = require('tempy');

const { Client } = require('.');

const {
	API_HASH,
	API_ID,
	BOT_TOKEN,
} = process.env;

invariant(API_HASH, 'API_HASH is required');
invariant(API_ID, 'API_ID is required');
invariant(BOT_TOKEN, 'BOT_TOKEN is required');

const delay = ms => new Promise(resolve => {
	setTimeout(resolve, ms);
});

test.afterEach.always(async t => {
	const { client } = t.context;

	if (client) {
		await client._destroy();
	}
});

test('Client', async t => {
	t.timeout(10000);

	const client = new Client({
		apiHash: API_HASH,
		apiId: API_ID,

		appDir: tempy.directory(),
		binaryPath: '/usr/lib/libtdjson.so',
	});

	Object.assign(t.context, {
		client,
	});

	const updateSpy = sinon.spy();

	const updateHappened = pattern => pRetry(() => {
		if (!updateSpy.calledWithMatch(sinon.match(pattern))) {
			throw new Error('No update matches pattern');
		}
	});

	client.registerCallback('td:update', updateSpy);

	client.registerCallback('td:error', error => {
		t.fail(error);
	});

	client.registerCallback('td:getInput', async ({ string }) => {
		await delay(100 * Math.random());

		if (string === 'tglib.input.AuthorizationType') {
			return 'bot';
		}

		if (string === 'tglib.input.AuthorizationValue') {
			return BOT_TOKEN;
		}

		t.fail(string);
	});

	await updateHappened({
		'@type': 'updateConnectionState',
		state: { '@type': 'connectionStateReady' },
	});

	t.true(updateSpy.calledWithMatch(sinon.match({
		'@type': 'updateOption',
	})));

	t.is(await client._send({
		'@type': 'getMe',
	}), null);

	await updateHappened({
		'@type': 'user',
		type: {
			'@type': 'userTypeBot',
		},
	});

	t.like(await client._execute({
		'@type': 'getMe',
	}), {
		'@type': 'error',
		message: 'Function can\'t be executed synchronously',
	});

	t.deepEqual(await client._execute({
		'@type': 'getJsonString',
		json_value: { '@type': 'jsonValueNumber', value: 1 },
	}), {
		'@type': 'text',
		text: '1.000000',
	});

	t.like(await client.fetch({
		'@type': 'getMe',
	}), {
		'@type': 'user',
		type: {
			'@type': 'userTypeBot',
		},
	});
});
