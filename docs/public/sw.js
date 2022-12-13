/// <reference lib="webworker" />

const CACHE = 'cache-and-update-v4'
const cacheTypes = ['html', 'css', 'font', 'image']
// const _log = console.log
const _log = () => {}

self.addEventListener('fetch', (/** @type {ExtendableEvent} */ event) => {
  /** @type Request */
  const request = event.request
  const fetchPromise = fetch(request)
  const id = (Math.random() * 1e10) | 0
  const log = (...a) => _log(request.url, ...a, id)

  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(request))
      .then((matching) => {
        if (matching) {
          log('cache match')
          return matching
        }
        log('cache mismatch')
        return fetchPromise
      }),
  )

  if (request.method.toLowerCase() !== 'get') {
    log('not get')
    return
  }
  // extension
  if (!request.url.startsWith('http')) {
    log('not http')
    return
  }

  event.waitUntil(
    fetchPromise.then(async (response) => {
      const contentType = response.headers.get('content-type')

      if (
        !response.ok ||
        response.status !== 200 ||
        contentType?.includes('application/javascript')
      ) {
        log('not ok')
        return
      }

      response = response.clone()

      if (contentType.includes('text/html') && !request.url.endsWith('.js')) {
        await hotUpdate(log, event, request, response)
      }

      return caches.open(CACHE).then((cache) => {
        log('cache put')
        cache.put(request, response)
      })
    }),
  )
})

const hotUpdate = async (
  log,
  /** @type {ExtendableEvent} */ event,
  /** @type {Request} */ request,
  /** @type {Response} */ response,
) => {
  log('hotUpdate')

  const cacheText = await caches
    .open(CACHE)
    .then((cache) => cache.match(request))
    .then((cache) => cache?.text())

  if (!cacheText) {
    log('no cache')
    return
  }

  const responseText = await response.clone().text()

  if (cacheText === responseText) {
    log('text equals')
    return
  }
  log('text not equals')

  event.waitUntil(
    new Promise((resolve) => {
      setTimeout(() => {
        log('timeout')
        resolve()
      }, 5000)

      const msg = {
        type: 'hot-update',
        text: responseText,
        url: response.url,
      }
      const broadcast = new BroadcastChannel('sw')

      broadcast.postMessage(msg)
      broadcast.onmessage = (event) => {
        log('onmessage', event.data)

        if (event.data?.type === 'hot-update-received') {
          log('hot-update-received')
          resolve()
        }
        if (event.data?.type === 'client-ready') {
          log('client-ready')
          broadcast.postMessage(msg)
          resolve()
        }
      }
    }),
  )
}
