const CACHE_NAME = 'marazon-classic-personal-v7';

const APP_SHELL = [
    './',
    './index.html',
    './parties.html',
    './report.html',

    './style.css',

    './app.js',
    './db.js',
    './finance.js',
    './utils.js',
    './dates.js',
    './report.js',
    './clock.js',

    './pwa.js',
    './manifest.json',

    './icon.svg',
    './marazon-192.png',
    './marazon-512.png'
];

/* نصب Service Worker و ذخیره فایل‌های اصلی برنامه */
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async cache => {
                for (const asset of APP_SHELL) {
                    try {
                        await cache.add(asset);
                    } catch (error) {
                        console.warn('فایل در کش ذخیره نشد:', asset, error);
                    }
                }
            })
            .then(() => self.skipWaiting())
    );
});

/* فعال‌سازی نسخه جدید و حذف کش‌های قدیمی */
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(cacheName => cacheName !== CACHE_NAME)
                        .map(cacheName => caches.delete(cacheName))
                );
            })
            .then(() => self.clients.claim())
    );
});

/* مدیریت درخواست‌ها در حالت آنلاین و آفلاین */
self.addEventListener('fetch', event => {
    const request = event.request;

    if (request.method !== 'GET') {
        return;
    }

    const requestUrl = new URL(request.url);

    /* فقط فایل‌های همان دامنه */
    if (requestUrl.origin !== self.location.origin) {
        return;
    }

    /*
     * درخواست صفحات HTML:
     * ابتدا نسخه کش‌شده را بررسی می‌کند.
     * اگر صفحه در کش نبود، index.html را نمایش می‌دهد.
     */
    if (request.mode === 'navigate') {
        event.respondWith(
            caches.match(request, { ignoreSearch: true })
                .then(cachedPage => {
                    if (cachedPage) {
                        return cachedPage;
                    }

                    return caches.match('./index.html')
                        .then(indexPage => {
                            if (indexPage) {
                                return indexPage;
                            }

                            return new Response(
                                `
                                <!DOCTYPE html>
                                <html lang="fa" dir="rtl">
                                <head>
                                    <meta charset="UTF-8">
                                    <meta name="viewport" content="width=device-width, initial-scale=1">
                                    <title>دفتر حساب مارازون</title>
                                </head>
                                <body>
                                    <h2>برنامه در حالت آفلاین در دسترس نیست</h2>
                                    <p>ل </html>
                               بار در حالت آنلاین برنامه را باز کنید.</p>
                                </body>
                                </html>
                                `,
                                {
                                    headers: {
                                        'Content-Type': 'text/html; charset=UTF-8'
                                    }
                                }
                            );
                        });
                })
                .catch(() => {
                    return caches.match('./index.html');
                })
        );

        return;
    }

    /*
     * فایل‌های CSS، JavaScript، تصاویر و manifest:
     * ابتدا از کش خوانده می‌شوند.
     * در صورت نبودن فایل در کش، از اینترنت دریافت و ذخیره می‌شود.
     */
    event.respondWith(
        caches.match(request, { ignoreSearch: true })
            .then(cachedFile => {
                if (cachedFile) {
                    return cachedFile;
                }

                return fetch(request)
                    .then(networkResponse => {
                        if (
                            networkResponse &&
                            networkResponse.ok &&
                            networkResponse.type === 'basic'
                        ) {
                            const responseClone = networkResponse.clone();

                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(request, responseClone);
                                });
                        }

                        return networkResponse;
                    })
                    .catch(() => {
                        return new Response('فایل در حالت آفلاین پیدا نشد.', {
                            status: 503,
                            headers: {
                                'Content-Type': 'text/plain; charset=UTF-8'
                            }
                        });
                    });
            })
    );
});
