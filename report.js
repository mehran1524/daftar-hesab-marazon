import { parseShamsi, transactionDate, escapeHTML } from './dates.js';

const $ = id => document.getElementById(id);
const number = value => Number(value || 0).toLocaleString('fa-IR');
const money = value => `${number(value)} تومان`;

const labels = {
  buy: 'خرید',
  sell: 'فروش',
  receive: 'دریافت',
  payment: 'پرداخت',
  salary: 'حقوق',
  expense: 'هزینه',
  debt: 'بدهی',
  credit: 'طلب'
};

// ---- DB bridge (Marazon first, fallback Boutia) ----
function _getDB() {
  const activeDB = window.marazonDB || window.boutiaDB;

  // اگر یکی از اینها وجود داشت، برای سازگاری عقب‌گرد هر دو را ست کن
  if (activeDB) {
    window.marazonDB = activeDB;
    window.boutiaDB = activeDB;
  }

  return activeDB;
}

async function _ensureDBReady(db) {
  if (!db) throw new Error('دیتابیس در دسترس نیست.');

  // بعضی db.js ها init دارند، بعضی ندارند
  if (typeof db.init === 'function') {
    // اگر db.js شما پراپرتی db/conn دارد و آماده است، دوباره init نزن
    const seemsReady = !!(db.db || db._db || db.conn || db._conn);
    if (!seemsReady) await db.init();
    else {
      // حتی اگر ready تشخیص دادیم، init اگر idempotent باشد مشکلی ندارد
      // ولی برای احتیاط دوباره صدا نمی‌زنیم
    }
  }
}

async function _getAllSafe(db, storeName) {
  if (!db || typeof db.getAll !== 'function') return [];
  const rows = await db.getAll(storeName);
  return Array.isArray(rows) ? rows : [];
}

function populateDateOptions(transactions, reset = false) {
  const dates = [...new Set(transactions.map(transactionDate).filter(Boolean))].sort();

  for (const [id, values] of [['fromDate', dates], ['toDate', [...dates].reverse()]]) {
    const select = $(id);
    const previous = select.value;

    select.replaceChildren();

    for (const value of values) {
      const label = value.replace(/\d/g, digit => '۰۱۲۳۴۵۶۷۸۹'[digit]);
      select.add(new Option(label, value));
    }

    if (!dates.length) select.add(new Option('تاریخی ثبت نشده است', ''));

    select.disabled = !dates.length;
    select.value = !reset && dates.includes(previous) ? previous : (values[0] || '');
  }
}

function displayPeriodBalance(value) {
  const element = $('netProfit');
  element.className = `value ${value < 0 ? 'text-red' : value > 0 ? 'text-green' : 'text-neutral'}`;

  // Isolate sign and digits so RTL text does not move the sign after the amount.
  const sign = value < 0 ? '−' : value > 0 ? '+' : '';
  element.innerHTML = `<bdi dir="ltr">${sign}${number(Math.abs(value))}</bdi> تومان`;
}

async function generateReport({ resetDates = false } = {}) {
  try {
    const db = _getDB();
    await _ensureDBReady(db);

    const allTransactions = await _getAllSafe(db, 'transactions');

    populateDateOptions(allTransactions, resetDates);

    const from = $('fromDate').value.trim()
      ? parseShamsi($('fromDate').value).canonical
      : '';
    const to = $('toDate').value.trim()
      ? parseShamsi($('toDate').value).canonical
      : '';

    if (from && to && from > to) throw new Error('تاریخ شروع نباید بعد از تاریخ پایان باشد.');

    const type = $('typeFilter').value;

    const transactions = allTransactions
      .filter(t => {
        const date = transactionDate(t);
        return (!from || date >= from) &&
          (!to || (date && date <= to)) &&
          (type === 'all' || t.type === type);
      })
      .sort((a, b) =>
        transactionDate(b).localeCompare(transactionDate(a)) ||
        Number(b.timestamp || 0) - Number(a.timestamp || 0)
      );

    let income = 0, expenses = 0, sold = 0;

    for (const t of transactions) {
      const amount = Number(t.total_amount) || 0;
      const paid = Number(t.paid_amount) || 0;

      if (t.type === 'sell') {
        income += paid;
        sold += (t.items || []).reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
      }

      if (t.type === 'receive') income += amount;

      if (t.type === 'buy') expenses += paid;

      if (['payment', 'expense', 'salary'].includes(t.type)) expenses += amount;
    }

    $('totalIncome').textContent = money(income);
    $('totalExpenses').textContent = money(expenses);
    displayPeriodBalance(income - expenses);
    $('totalTransactions').textContent = number(transactions.length);
    $('totalItemsSold').textContent = `${number(sold)} عدد`;
    $('reportRangeLabel').textContent = from && to ? `بازه گزارش: ${from} تا ${to}` : 'بازه گزارش: تاریخی ثبت نشده است';
    $('reportGeneratedAt').textContent = `زمان تولید گزارش: ${new Date().toLocaleTimeString('fa-IR')}`;

    $('reportTableBody').innerHTML = transactions.length
      ? transactions.map((t, i) => {
        const items = (t.items || [])
          .map(item => `${item.category || ''}${item.qty ? ` (${number(item.qty)} عدد)` : ''}`)
          .join('، ');

        const remaining = ['buy', 'sell'].includes(t.type)
          ? (Number(t.total_amount) || 0) - (Number(t.paid_amount) || 0)
          : 0;

        const badgeType = Object.hasOwn(labels, t.type) ? t.type : 'expense';

        return `<tr>
          <td>${number(i + 1)}</td>
          <td>${escapeHTML(transactionDate(t) || '-')}</td>
          <td>${t.timestamp ? new Date(t.timestamp).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
          <td><span class="badge badge-${escapeHTML(badgeType)}">${escapeHTML(labels[t.type] || t.type)}</span></td>
          <td>${escapeHTML(t.party_name || '-')}</td>
          <td title="${escapeHTML(items)}">${escapeHTML(items.length > 30 ? items.slice(0, 30) + '…' : items)}</td>
          <td>${money(t.total_amount)}</td>
          <td>${money(t.paid_amount)}</td>
          <td>${money(remaining)}</td>
          <td class="description-cell">${escapeHTML(t.description || '-')}</td>
        </tr>`;
      }).join('')
      : '<tr><td colspan="10" class="empty-state">هیچ تراکنشی در بازه انتخاب‌شده یافت نشد.</td></tr>';

  } catch (error) {
    $('reportTableBody').innerHTML = `<tr><td colspan="10" class="empty-state">${escapeHTML(error?.message || String(error))}</td></tr>`;
    for (const id of ['totalIncome', 'totalExpenses', 'netProfit', 'totalTransactions', 'totalItemsSold']) {
      $(id).textContent = '—';
    }
    $('reportRangeLabel').textContent = 'گزارش تولید نشد';
    $('netProfit').className = 'value text-neutral';
  }
}

$('generateReportBtn').addEventListener('click', () => generateReport());
$('refreshReportBtn').addEventListener('click', () => generateReport());
$('fromDate').addEventListener('change', () => generateReport());
$('toDate').addEventListener('change', () => generateReport());
$('typeFilter').addEventListener('change', () => generateReport());
$('printReportBtn').addEventListener('click', () => window.print());
$('resetFiltersBtn').addEventListener('click', () => {
  $('typeFilter').value = 'all';
  generateReport({ resetDates: true });
});

generateReport({ resetDates: true });
