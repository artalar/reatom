const CACHE = 'cache-and-update-v2'

self.addEventListener('install', (event) => {
  // TODO parse `/sitemap-0.xml`
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['/'])))
})

self.addEventListener('fetch', (event) => {
  /** @type Request */
  const request = event.request
  const fetchPromise = fetch(request)

  event.respondWith(
    caches
      .match(request)
      .then((matching) => matching || Promise.reject('no-match'))
      .catch(() => fetchPromise),
  )

  if (request.method.toLowerCase() === 'get' && !request.url.endsWith('js')) {
    event.waitUntil(
      fetchPromise.then(async (response) => {
        if (
          response.status !== 200 ||
          response.headers
            .get('content-type')
            ?.includes('application/javascript')
        ) {
          return
        }
        response = response.clone()

        let staleUpdate = Promise.resolve()
        if (response.headers.get('content-type')?.includes('text/html')) {
          staleUpdate = caches
            .match(request)
            .then((matching) => matching || null)
            .then((cache) => cache?.text())
            .then(
              (cacheText) =>
                cacheText &&
                response
                  .clone()
                  .text()
                  .then((responseText) => {
                    if (cacheText === responseText) return

                    // const broadcast = new BroadcastChannel('sw')
                    // broadcast.postMessage({
                    //   type: 'new-content',
                    //   text: responseText,
                    //   url: request.url,
                    // })
                  }),
            )
            .catch(() => null)
        }

        return staleUpdate.then(() =>
          caches.open(CACHE).then((cache) => cache.put(request, response)),
        )
      }),
    )
  }
})
