/**
 * finance.js - ماژول محاسبات مالی مجموعه مارازون
 * Developed for: Mehran
 * نسخه شخصی، بدون تفکیک ثبت‌کننده
 *
 * ⚠️ مسئولیت این ماژول: منطق مالی و محاسبات با اتصال امن به MarazonDB / BoutiaDB
 *
 * قرارداد علامت (نگاه از سمت ما):
 * net / balance > 0 → ما بدهکاریم (طرف بستانکار ماست) → سبز
 * net / balance < 0 → طرف بدهکار ماست → قرمز
 * net / balance = 0 → تسویه شده → خاکستری
 *
 */

const financeCalc = {
    // دسترسی پویا و امن به نمونه دیتابیس مارازون (با پشتیبانی از بوتیا به عنوان فال‌بک)
    _getDB() {
        const db = window.marazonDB || window.boutiaDB;
        if (!db) {
            console.error("❌ دیتابیس مارازون یا بوتیا در window یافت نشد.");
        }
        return db;
    },

    // محاسبه وضعیت مالی یک طرف حساب از روی تراکنش‌ها
    calcPartyBalance(partyId, transactions = []) {
        let receivable = 0; // طلب ما از طرف (بدهی طرف به ما) — مشتری
        let payable = 0; // بدهی ما به طرف (طلب طرف از ما) — تأمین‌کننده
        let salaryPaid = 0; // مجموع حقوق پرداخت‌شده به کارمند
        let salaryRemaining = 0; // مانده حقوق پرداخت‌نشده
        let totalSales = 0; // جمع کل فروش به این مشتری
        let totalPurchases = 0; // جمع کل خرید از این تأمین‌کننده
        let transactionCount = 0;

        (transactions || []).forEach((t) => {
            if (t.party_id !== partyId) return;

            const total = parseFloat(t.total_amount) || 0;
            const paid = parseFloat(t.paid_amount) || 0;
            const remaining = total - paid;

            transactionCount++;

            if (t.type === "sell") {
                receivable += remaining; // مشتری به ما بدهکار است
                totalSales += total;
            } else if (t.type === "buy") {
                payable += remaining; // ما به تأمین‌کننده بدهکاریم
                totalPurchases += total;
            } else if (t.type === "receive") {
                receivable -= total; // دریافت وجه → طلب ما از طرف کم می‌شود
            } else if (t.type === "payment") {
                payable -= total; // پرداخت وجه → بدهی ما به طرف کم می‌شود
            } else if (t.type === "salary") {
                salaryPaid += paid; // فقط حقوق پرداخت‌شده
                salaryRemaining += remaining;
            }
        });

        const net = payable - receivable;

        return {
            receivable: receivable,
            payable: payable,
            net: net,
            balance: net,
            salaryPaid: salaryPaid,
            salaryRemaining: salaryRemaining,
            totalSales: totalSales,
            totalPurchases: totalPurchases,
            transactionCount: transactionCount
        };
    },

    // دریافت مانده یک شخص خاص
    async getPartyBalance(partyId) {
        const db = this._getDB();
        if (!db) return this.calcPartyBalance(partyId, []);

        if (typeof db.init === "function" && !db.db) {
            await db.init();
        }

        const transactions = (await db.getAll("transactions")) || [];
        return this.calcPartyBalance(partyId, transactions);
    },

    // دریافت تمام اشخاص به همراه مانده حساب
    async getPartiesWithBalances() {
        const db = this._getDB();
        if (!db) return [];

        if (typeof db.init === "function" && !db.db) {
            await db.init();
        }

        const parties = (await db.getAll("parties")) || [];
        const transactions = (await db.getAll("transactions")) || [];

        return parties.map((party) => ({
            ...party,
            balance: this.calcPartyBalance(party.id, transactions)
        }));
    },

    // تابع کمکی برای UI
    formatCurrency(amount) {
        const formatter = new Intl.NumberFormat("fa-IR");
        return formatter.format(Math.round(amount || 0)) + " تومان";
    }
};

// اکسپورت سراسری برای استفاده در سایر صفحات
window.financeCalc = financeCalc;
