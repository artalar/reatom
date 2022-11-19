const CACHE = 'cache-and-update-v1'

self.addEventListener('install', (event) => {
  // TODO parse `/sitemap-0.xml`
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['/'])))
})

self.addEventListener('fetch', function (event) {
  /** @type Request */
  const request = event.request
  const fetchPromise = fetch(request)

  event.respondWith(
    caches
      .match(request)
      .then((matching) => matching || Promise.reject('no-match'))
      .catch(() => fetchPromise),
  )

  if (request.method.toLowerCase() === 'get') {
    event.waitUntil(
      fetchPromise.then((response) => {
        if (response.status !== 200) return
        response = response.clone()
        caches.open(CACHE).then((cache) => cache.put(request, response))
      }),
    )
  }
})
