/**
 * finance.js - ماژول محاسبات مالی مجموعه بوتیا
 * Developed for: Mehran
 * نسخه شخصی، بدون تفکیک ثبت‌کننده
 *
 * ⚠️ مسئولیت این ماژول: فقط منطق مالی و محاسبات.
 *    دسترسی به داده‌ها فقط از طریق window.boutiaDB انجام می‌شود.
 *
 * قرارداد علامت (نگاه از سمت ما):
 *   net / balance > 0  → ما بدهکاریم (طرف بستانکار ماست)  → سبز
 *   net / balance < 0  → طرف بدهکار ماست                  → قرمز
 *   net / balance = 0  → تسویه شده                         → خاکستری
 *
 */

const financeCalc = {
    // محاسبه وضعیت مالی یک طرف حساب از روی تراکنش‌ها
    calcPartyBalance(partyId, transactions) {
        let receivable = 0;      // طلب ما از طرف (بدهی طرف به ما) — مشتری
        let payable = 0;         // بدهی ما به طرف (طلب طرف از ما) — تأمین‌کننده
        let salaryPaid = 0;      // مجموع حقوق پرداخت‌شده به کارمند
        let salaryRemaining = 0; // مانده حقوق پرداخت‌نشده (توسعه آینده)
        let totalSales = 0;      // جمع کل فروش به این مشتری
        let totalPurchases = 0;  // جمع کل خرید از این تأمین‌کننده
        let transactionCount = 0;

        transactions.forEach((t) => {
            if (t.party_id !== partyId) return;

            const total = parseFloat(t.total_amount) || 0;
            const paid = parseFloat(t.paid_amount) || 0;
            const remaining = total - paid;

            transactionCount++;

            if (t.type === "sell") {
                receivable += remaining;   // مشتری به ما بدهکار است
                totalSales += total;
            } else if (t.type === "buy") {
                payable += remaining;      // ما به تأمین‌کننده بدهکاریم
                totalPurchases += total;
            } else if (t.type === "receive") {
                receivable -= total;       // دریافت وجه → طلب ما از طرف کم می‌شود
            } else if (t.type === "payment") {
                payable -= total;          // پرداخت وجه → بدهی ما به طرف کم می‌شود
            } else if (t.type === "salary") {
                salaryPaid += paid;        // فقط حقوق پرداخت‌شده
                salaryRemaining += remaining;
            }
            // نوع "expense" طرف حساب ندارد و در مانده اشخاص لحاظ نمی‌شود
        });

        const net = payable - receivable;

        return {
            receivable: receivable,
            payable: payable,
            net: net,                 // ✅ مقدار مرجع (هماهنگ با قرارداد قدیمی db.js)
            balance: net,             // alias برای سازگاری عقب‌گرد
            salaryPaid: salaryPaid,
            salaryRemaining: salaryRemaining,
            totalSales: totalSales,
            totalPurchases: totalPurchases,
            transactionCount: transactionCount
        };
    },

    // دریافت مانده یک شخص خاص
    async getPartyBalance(partyId) {
        const transactions = await window.boutiaDB.getAll("transactions");
        return this.calcPartyBalance(partyId, transactions);
    },

    // دریافت تمام اشخاص به همراه مانده حساب (فقط یک بار خواندن تراکنش‌ها)
    async getPartiesWithBalances() {
        const parties = await window.boutiaDB.getAll("parties");
        const transactions = await window.boutiaDB.getAll("transactions");

        return parties.map((party) => ({
            ...party,
            balance: this.calcPartyBalance(party.id, transactions)
        }));
    },

    // ✅ جدید: تابع کمکی برای UI
    formatCurrency(amount) {
        const formatter = new Intl.NumberFormat('fa-IR');
        return formatter.format(Math.round(amount)) + ' تومان';
    }
};

// اکسپورت سراسری برای استفاده در pages دیگر
window.financeCalc = financeCalc;
