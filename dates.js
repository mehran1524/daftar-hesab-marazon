const persianFormatter = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tehran'
});
const yearDates = new Map();

export function toEnglishDigits(value) {
    return String(value ?? '').replace(/[۰-۹]/g, c => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c))
        .replace(/[٠-٩]/g, c => '٠١٢٣٤٥٦٧٨٩'.indexOf(c));
}
export function formatNumber(value) {
    return Number(value || 0).toLocaleString('fa-IR', { maximumFractionDigits: 3 });
}
export function money(value) { return `${formatNumber(value)} تومان`; }
export function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function normalizeText(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ').replace(/ي/g, 'ی').replace(/ك/g, 'ک');
}
export function parseNumber(value, label = 'مبلغ', { zero = true, integer = true } = {}) {
    const raw = toEnglishDigits(value).replace(/[,٬]/g, '').replace(/٫/g, '.').trim();
    if (!/^\d+(\.\d+)?$/.test(raw)) throw new Error(`${label} را به صورت عدد مثبت وارد کنید.`);
    const number = Number(raw);
    if (!Number.isFinite(number) || number > Number.MAX_SAFE_INTEGER || (!zero && number === 0) || (integer && !Number.isSafeInteger(number))) {
        throw new Error(`${label} معتبر نیست؛ مبلغ باید به تومان و بدون اعشار باشد.`);
    }
    return number;
}
export function today(date = new Date()) {
    const parts = Object.fromEntries(persianFormatter.formatToParts(date).map(p => [p.type, p.value]));
    return `${parts.year}/${parts.month}/${parts.day}`;
}
// Use the browser's Persian calendar, including leap years, without online libraries.
export function parseShamsi(value) {
    const match = toEnglishDigits(value).trim().match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if (!match) throw new Error('تاریخ شمسی را مانند ۱۴۰۵/۰۶/۲۸ وارد کنید.');
    const year = Number(match[1]);
    if (year < 1200 || year > 1599) throw new Error('سال شمسی باید بین ۱۲۰۰ و ۱۵۹۹ باشد.');
    const canonical = `${year}/${match[2].padStart(2, '0')}/${match[3].padStart(2, '0')}`;
    if (!yearDates.has(year)) {
        const dates = new Map();
        const start = Date.UTC(year + 621, 2, 18, 12);
        for (let i = 0; i < 370; i++) {
            const instant = start + i * 86400000;
            const key = today(new Date(instant));
            if (key.startsWith(`${year}/`)) dates.set(key, new Date(instant).toISOString().slice(0, 10));
        }
        yearDates.set(year, dates);
    }
    const iso = yearDates.get(year).get(canonical);
    if (!iso) throw new Error('روز یا ماه تاریخ شمسی معتبر نیست.');
    return { canonical, iso };
}
export function transactionDate(transaction) {
    try { return parseShamsi(transaction.date).canonical; }
    catch {
        if (transaction.date_iso && /^\d{4}-\d{2}-\d{2}$/.test(transaction.date_iso)) {
            return today(new Date(`${transaction.date_iso}T12:00:00Z`));
        }
        if (transaction.timestamp && Number.isFinite(Number(transaction.timestamp))) return today(new Date(Number(transaction.timestamp)));
        return '';
    }
}
