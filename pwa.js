if ('serviceWorker' in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        location.reload();
    });
    navigator.serviceWorker.register('./sw.js').catch(error => console.warn('آماده‌سازی آفلاین انجام نشد:', error));
}
