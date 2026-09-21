(() => {
    'use strict';

    if (!('serviceWorker' in navigator)) {
        console.warn('مرورگر از Service Worker پشتیبانی نمی‌کند.');
        return;
    }

    let refreshing = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) {
            return;
        }

        refreshing = true;
        window.location.reload();
    });

    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('./sw.js', {
                scope: './'
            });

            console.log(
                'Service Worker فعال شد:',
                registration.scope
            );

            /*
             * بررسی نسخه جدید Service Worker
             */
            registration.update().catch(error => {
                console.warn('بررسی نسخه جدید انجام نشد:', error);
            });

        } catch (error) {
            console.warn(
                'آماده‌سازی آفلاین انجام نشد:',
                error
            );
        }
    });
})();
