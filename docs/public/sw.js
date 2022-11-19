const CACHE = 'cache-and-update-v1'

self.addEventListener('install', (event) => {
  // TODO parse `/sitemap-0.xml`
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(['/'])))
})

self.addEventListener('fetch', function (event) {
  const { request } = event
  const fetchPromise = fetch(request)

  event.respondWith(
    cache
      .match(request)
      .then((matching) => matching || Promise.reject('no-match'))
      .catch(() => fetchPromise),
  )

  event.waitUntil(
    fetchPromise.then(
      (response) =>
        response.status === 200 &&
        caches
          // TODO does `open` need here?
          .open(CACHE)
          .then((cache) => cache.put(request, response.clone())),
    ),
  )
})
