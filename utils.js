/* ================================
   Number Utilities - Pistachio App
   Safe UI Formatting Layer
   ================================ */

/* تبدیل ارقام انگلیسی به فارسی */
export function toPersianDigits(value) {
    if (value === null || value === undefined) return "۰";
    return String(value).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
}

/* تبدیل ارقام فارسی/عربی به انگلیسی - اصلاح شده جهت دقت بالاتر */
export function toEnglishDigits(value) {
    if (value === null || value === undefined) return "";
    
    const valStr = String(value);
    // نقشه تبدیل ارقام فارسی و عربی به انگلیسی
    const map = {
        '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
        '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
    };
    
    return valStr.replace(/[۰-۹٠-٩]/g, (match) => map[match]);
}

/* فرمت هزارگان با کامای انگلیسی + تبدیل به فارسی */
export function formatDisplayNumber(value) {
    if (value === null || value === undefined || value === "") return "۰";

    const cleaned = toEnglishDigits(value)
        .replace(/[٬,]/g, "")
        .replace(/٫/g, ".")
        .replace(/[^\d.]/g, "");

    if (cleaned === "") return "۰";

    const number = Number(cleaned);

    if (Number.isNaN(number)) return toPersianDigits(value);

    const formatted = number.toLocaleString("en-US");

    return toPersianDigits(formatted);
}

/* گرفتن مقدار خام عددی از input بدون دستکاری منطق */
export function parseInputNumber(value) {
    if (value === null || value === undefined || value === "") return 0;

    const cleaned = toEnglishDigits(String(value))
        .replace(/[٬,]/g, "")
        .replace(/٫/g, ".")
        .replace(/[^\d.]/g, "");

    const number = Number(cleaned);

    return Number.isNaN(number) ? 0 : number;
}


/* اعمال فارسی‌سازی روی همه خروجی‌های عددی صفحه */
export function applyPersianFormatting() {
    const targets = document.querySelectorAll(
        "#buyToday, #sellToday, #balance, #amount, " +
        "#totalBuyRange, #totalSellRange, #finalBalanceRange, #financialBalanceRange"
    );

    targets.forEach(el => {
        if (el.tagName === "INPUT") {
            if (!el.dataset.rawValue) {
                el.dataset.rawValue = el.value;
            }
            el.value = formatDisplayNumber(el.dataset.rawValue);
        } else {
            el.textContent = formatDisplayNumber(el.textContent);
        }
    });
}
/* ================================
   New Addition: Number to Persian Words
   Offline & Reliable Implementation
   ================================ */

export function numberToPersianWords(value) {
    if (!value && value !== 0) return "";
    
    // استفاده از تابع موجود خودت برای تمیزکاری ورودی
    let num = Number(toEnglishDigits(String(value)).replace(/,/g, ""));
    if (isNaN(num)) return "";
    
    const ones = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
    const teens = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
    const tens = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
    const hundreds = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
    const scales = ["", "هزار", "میلیون", "میلیارد", "تریلیون"];

    function threeDigits(n) {
        let str = "";
        const h = Math.floor(n / 100);
        const rem = n % 100;
        const t = Math.floor(rem / 10);
        const o = rem % 10;

        if (h > 0) str += hundreds[h] + " و ";
        if (rem >= 10 && rem < 20) str += teens[rem - 10] + " و ";
        else {
            if (t > 1) str += tens[t] + " و ";
            if (o > 0) str += ones[o] + " و ";
        }
        return str.replace(/ و $/, "");
    }

    const isNegative = num < 0;
    num = Math.abs(num);

    const [intPartStr, decimalPartStr] = num.toString().split(".");
    let words = "";
    
    // پردازش بخش صحیح
    let intPart = parseInt(intPartStr);
    if (intPart === 0) words = "صفر";
    else {
        let parts = [];
        let i = 0;
        while (intPart > 0) {
            let chunk = intPart % 1000;
            if (chunk > 0) parts.unshift(threeDigits(chunk) + (scales[i] ? " " + scales[i] : ""));
            intPart = Math.floor(intPart / 1000);
            i++;
        }
        words = parts.join(" و ");
    }

    // پردازش بخش اعشاری
    if (decimalPartStr) {
        const d = decimalPartStr.substring(0, 2);
        if (d === "5") words += " و نیم";
        else {
            const dVal = parseInt(d);
            words += " و " + threeDigits(dVal) + (d.length === 1 ? " دهم" : " صدم");
        }
    }

    return isNegative ? "منفی " + words : words;
}

export function weightToPersianWords(weight) {
    const w = numberToPersianWords(weight);
    return w ? `${w} کیلو` : "";
}

export function moneyToPersianWords(amount) {
    const m = numberToPersianWords(Math.round(amount));
    return m || "";
}

