import {test} from 'uvu'
import * as assert from 'uvu/assert'
import {mockFn} from '@reatom/testing'
import {typedFetch} from './index'

const respond = (json: unknown) =>
  new Response(JSON.stringify(json), {
    headers: {'Content-Type': 'application/json'},
  })

const transportFn = (url: string, init: RequestInit) => {
  return respond({})
}

const transport = mockFn(transportFn)

const baseFetch = typedFetch({
  origin: 'https://acme.com/',
  transport,
})

test('basic usage', async () => {
  const fetchNull = baseFetch.createFetch({
    body: null,
    transport: (url, init) => respond(JSON.parse(init.body as any)),
  })
  assert.is(await fetchNull(), null)
})

test('nested configuration', async () => {
  const fetchA = baseFetch.createFetch({
    transport: () => respond('a'),
  })
  const fetchB = fetchA.createFetch({
    transport: () => respond('b'),
  })

  assert.is(await fetchA(), 'a')
  assert.is(await fetchB(), 'b')
})

test('merge urls', async () => {
  const fetchApi = baseFetch.createFetch({
    url: '/api',
    body: null,
  })

  const fetchUsers = fetchApi.createFetch('/users')

  const getUser = fetchUsers.createFetch((id: number) => `/${id}`)
  await getUser(999)
  assert.is(transport.lastInput(0), 'https://acme.com/api/users/999')

  const getAllUsers = fetchUsers.createFetch('/all')
  await getAllUsers()
  assert.is(transport.lastInput(0), 'https://acme.com/api/users/all')
})

test('multiple params', async () => {
  const fetchUser = baseFetch.createFetch((id: number) => ({
    url: `/users/${id}`,
  }))

  const getUser = fetchUser.get({})

  await getUser(333)
  assert.is(transport.lastInput(0), 'https://acme.com/users/333')

  const postUser = fetchUser.post((username: string) => ({
    body: {username},
  }))
  await postUser(333, 'krulod'), {username: 'krulod'}
  assert.is(transport.lastInput(0), 'https://acme.com/users/333')
  assert.equal(
    (transport.lastInput(1) as RequestInit).body, //
    {username: 'krulod'},
  )
})

test.run()
