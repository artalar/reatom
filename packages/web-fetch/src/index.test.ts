import {createCtx} from '@reatom/core'
import {test} from 'uvu'
import * as assert from 'uvu/assert'

import {createReatomFetch} from '.'

test(`base API`, async () => {
	let issuedPath!: string
	let issuedInit!: RequestInit

	const pseudofetch = (path: string, init: RequestInit) => {
		issuedPath = path
		issuedInit = init

		return new Promise<never>(() => {})
	}

	const reatomFetch = createReatomFetch({
		basePath: '/api',
		fetch: pseudofetch,
	})

	const ctx = createCtx()

	const getUser = reatomFetch('/user', {
		auth: 'SomeAuthStuff',
	})

	getUser(ctx)

	assert.is(issuedPath, '/api/user')
	assert.is(issuedInit.method, 'get')
	assert.instance(issuedInit.headers, Headers)
	assert.is((issuedInit.headers as Headers).get('auth'), 'SomeAuthStuff')

	const postUser = reatomFetch.post('/user', {
		transformRequest: body => ({transformed: body}),
	})

	postUser(ctx, {id: 111})

	assert.is(issuedPath, '/api/user')
	assert.is(issuedInit.method, 'post')
	assert.equal(JSON.parse(issuedInit.body as string), {transformed: {id: 111}})
})

test.run()
