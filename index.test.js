
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

const TGLIB_MODULE_NAME = '@futpib/tglib';
const BINARY_PATH = '/usr/lib/libtdjson.so';

const delay = ms => new Promise(resolve => {
	setTimeout(resolve, ms);
});

const createGetInput = t => async ({ string }) => {
	await delay(100 * Math.random());

	if (string === 'tglib.input.AuthorizationType') {
		return 'bot';
	}

	if (string === 'tglib.input.AuthorizationValue') {
		return BOT_TOKEN;
	}

	t.fail(string);
};

test.afterEach.always(async t => {
	const { client } = t.context;

	if (client) {
		await client._destroy();
	}
});

test('Client init error', async t => {
	const client = new Client({
		apiHash: API_HASH,
		apiId: API_ID,

		tglibModuleName: TGLIB_MODULE_NAME,
		appDir: tempy.directory(),
		binaryPath: 'BROKEN BINARY PATH',
	});

	await t.throwsAsync(client.ready, {
		message: /BROKEN BINARY PATH/,
	});

	await t.throwsAsync(client.fetch({
		'@type': 'getMe',
	}), {
		message: 'Client is not created',
	});
});

test('Client uncaughtException', async t => {
	const client = new Client({
		apiHash: API_HASH,
		apiId: API_ID,

		tglibModuleName: TGLIB_MODULE_NAME,
		appDir: tempy.directory(),
		binaryPath: BINARY_PATH,
	});

	const uncaughtExceptionPromise = t.throwsAsync(new Promise((resolve, reject) => {
		client.registerCallback('uncaughtException', reject);
	}), {
		message: /Cannot destructure property/,
	});

	// Simulate unhandled error inside the worker process
	client.__childProcess.send({
		type: 'td:getInput',
	});

	await uncaughtExceptionPromise;
});

test.todo('Client unhandledRejection');

const apiCallsTestMacro = async (t, tglibModuleName) => {
	t.timeout(10000);

	process.chdir(tempy.directory());

	const client = new Client({
		apiHash: API_HASH,
		apiId: API_ID,

		tglibModuleName,
		appDir: tempy.directory(),
		binaryPath: BINARY_PATH,
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

	client.registerCallback('td:getInput', createGetInput(t));

	await client.ready;

	t.true(updateSpy.calledWithMatch(sinon.match({
		'@type': 'updateConnectionState',
		state: { '@type': 'connectionStateReady' },
	})));

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
};

apiCallsTestMacro.title = (providedTitle, tglibModuleName) => [ providedTitle, tglibModuleName ].join(' ');

test('Client api calls', apiCallsTestMacro, undefined);
test('Client api calls', apiCallsTestMacro, TGLIB_MODULE_NAME);
