// The header must keep working even when storage or application startup fails.
(() => {
    const clock = document.getElementById('liveClock');
    const date = document.getElementById('todayDate');
    if (!clock || !date) return;
    clock.dir = 'ltr';
    date.dir = 'rtl';
    const timeFormatter = new Intl.DateTimeFormat('fa-IR', {
        timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    });
    const dateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        timeZone: 'Asia/Tehran', calendar: 'persian', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const update = () => {
        const now = new Date();
        clock.textContent = timeFormatter.format(now);
        const parts = Object.fromEntries(dateFormatter.formatToParts(now).map(part => [part.type, part.value]));
        date.textContent = `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}`;
    };
    update();
    setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
})();
