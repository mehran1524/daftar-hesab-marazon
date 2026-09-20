/**
 * Marazon Accounting Database Module
 * Developed for: Mehran
 * Structure: IndexedDB (Offline-first)
 * Version: 5 (اتصال سازگار و حفظ داده‌های نسخه‌های قبلی)
 *
 * ⚠️ مسئولیت این ماژول: فقط CRUD و عملیات IndexedDB.
 *    تمام محاسبات مالی به finance.js منتقل شده است.
 */

const DB_NAME = "MarazonDB";
const DB_VERSION = 5;
const DB_STORES = {
    parties: ["type", "full_name", "normalized_name", "mobile", "card_number", "iban", "roles"],
    transactions: ["type", "created_by", "date", "party_id"],
    transaction_items: ["transaction_id"],
    product_suggestions: ["type", "name"]
};

function databaseError(error) {
    const messages = {
        SecurityError: "مرورگر اجازه ذخیره اطلاعات را نمی‌دهد. برنامه را از آدرس localhost یا HTTPS باز کنید و مجوز ذخیره‌سازی سایت را بررسی کنید.",
        InvalidStateError: "اتصال پایگاه داده بسته شده است؛ صفحه را دوباره بارگذاری کنید.",
        QuotaExceededError: "فضای ذخیره‌سازی دستگاه کافی نیست.",
        UnknownError: "مرورگر نتوانست پایگاه داده را باز کند. صفحه‌های دیگر برنامه را ببندید و دوباره تلاش کنید."
    };
    return new Error(messages[error?.name] || `خطا در پایگاه داده: ${error?.message || error?.name || 'خطای نامشخص'}`);
}

function ensureSchema(db, transaction) {
    // Only add missing stores/indexes; never remove historical data or stores.
    for (const [name, indexes] of Object.entries(DB_STORES)) {
        const store = db.objectStoreNames.contains(name)
            ? transaction.objectStore(name) : db.createObjectStore(name, { keyPath: "id" });
        for (const index of indexes) {
            if (!store.indexNames.contains(index)) {
                store.createIndex(index, index, { unique: false, multiEntry: index === "roles" });
            }
        }
    }
}

function schemaNeedsUpgrade(db) {
    for (const [name, indexes] of Object.entries(DB_STORES)) {
        if (!db.objectStoreNames.contains(name)) return true;
        const store = db.transaction(name).objectStore(name);
        if (store.keyPath !== "id") throw new Error(`ساختار جدول ${name} با برنامه سازگار نیست؛ اطلاعات موجود تغییر داده نشد.`);
        if (indexes.some(index => !store.indexNames.contains(index))) return true;
    }
    return false;
}

function openDatabase(version) {
    return new Promise((resolve, reject) => {
        let request;
        let cancelled = false;
        try {
            if (!window.indexedDB) throw new Error("مرورگر از ذخیره‌سازی IndexedDB پشتیبانی نمی‌کند.");
            request = version === undefined ? indexedDB.open(DB_NAME) : indexedDB.open(DB_NAME, version);
        } catch (error) { reject(error); return; }
        request.onblocked = () => {
            cancelled = true;
            reject(new Error("یک صفحه قدیمی برنامه مانع اتصال است. صفحه‌ها و پنجره‌های دیگر این برنامه را ببندید و دوباره تلاش کنید. اطلاعات پاک نمی‌شوند."));
        };
        request.onupgradeneeded = () => {
            if (cancelled) { request.transaction.abort(); return; }
            ensureSchema(request.result, request.transaction);
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            if (cancelled) { request.result.close(); return; }
            resolve(request.result);
        };
    });
}

const dbContext = {
    db: null,
    opening: null,

    init() {
        if (this.db) return Promise.resolve(this.db);
        if (this.opening) return this.opening;
        this.opening = (async () => {
            let connection;
            try {
                try { connection = await openDatabase(DB_VERSION); }
                catch (error) {
                    // Another release may have used a higher version on this origin.
                    if (error?.name !== "VersionError") throw error;
                    connection = await openDatabase();
                }
                if (schemaNeedsUpgrade(connection)) {
                    const version = connection.version + 1;
                    connection.close();
                    connection = await openDatabase(version);
                }
                this.db = connection;
                const disconnected = () => {
                    connection.close();
                    if (this.db === connection) this.db = null;
                };
                connection.onversionchange = disconnected;
                connection.onclose = disconnected;
                return connection;
            } catch (error) {
                connection?.close();
                throw databaseError(error);
            }
        })().finally(() => { this.opening = null; });
        return this.opening;
    },

    // تولید شناسه منحصر به فرد
    generateUUID() {
        return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    },

    // نرمال سازی متن برای جلوگیری از ثبت نام های تکراری با فاصله یا شکل های مختلف
    normalizeText(value) {
        return String(value || "")
            .trim()
            .replace(/\s+/g, " ")
            .replace(/ي/g, "ی")
            .replace(/ك/g, "ک");
    },

    // تابع عمومی برای ذخیره داده
    async save(storeName, data) {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!data.id) data.id = this.generateUUID();

            const now = new Date().toISOString();
            if (!data.created_at) data.created_at = now;
            data.updated_at = now;

            const transaction = this.db.transaction([storeName], "readwrite");
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            transaction.oncomplete = () => resolve(data);
            transaction.onabort = () => reject(databaseError(transaction.error || request.error));
        });
    },

    // تابع حذف داده (برای حذف اشخاص)
    async delete(storeName, id) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], "readwrite");
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);

            transaction.oncomplete = () => resolve(true);
            transaction.onabort = () => reject(databaseError(transaction.error || request.error));
        });
    },

    // تابع دریافت تمام داده های یک جدول
    async getAll(storeName) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], "readonly");
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // دریافت اشخاص بر اساس نقش
    async getPartiesByRole(role) {
        const parties = await this.getAll("parties");
        return parties.filter(party => Array.isArray(party.roles) && party.roles.includes(role));
    },

    // جستجو یا ایجاد شخص بر اساس نام و نقش (برای ثبت تراکنش در فرم)
    async findOrCreateParty({ full_name, role, mobile = "", address = "", card_number = "", iban = "" }) {
        const normalizedName = this.normalizeText(full_name);
        if (!normalizedName) return null;

        const parties = await this.getAll("parties");
        const existingParty = parties.find(party =>
            this.normalizeText(party.normalized_name || party.full_name) === normalizedName
        );

        if (existingParty) {
            const roles = Array.isArray(existingParty.roles) ? existingParty.roles.slice() : [];
            if (role && !roles.includes(role)) {
                roles.push(role);
            }

            existingParty.full_name = existingParty.full_name || normalizedName;
            existingParty.normalized_name = normalizedName;
            existingParty.roles = roles;
            existingParty.type = roles[0] || existingParty.type || "party";
            if (mobile) existingParty.mobile = mobile;
            if (address) existingParty.address = address;
            if (card_number) existingParty.card_number = card_number;
            if (iban) existingParty.iban = iban;

            return this.save("parties", existingParty);
        }

        const partyData = {
            id: this.generateUUID(),
            full_name: normalizedName,
            normalized_name: normalizedName,
            roles: role ? [role] : [],
            type: role || "party",
            mobile,
            address,
            card_number,
            iban
        };

        return this.save("parties", partyData);
    },

    // ذخیره یا ویرایش کامل شخص (برای صفحه مدیریت اشخاص)
    async saveParty(data) {
        const full_name = this.normalizeText(data.full_name);
        if (!full_name) return null;

        const roles = Array.isArray(data.roles)
            ? data.roles.filter(Boolean)
            : (data.roles ? [data.roles] : []);

        // برای ویرایش، شناسه و تاریخ ایجاد قبلی حفظ شود
        let existing = null;
        if (data.id) {
            const parties = await this.getAll("parties");
            existing = parties.find(p => p.id === data.id) || null;
        }

        const partyData = {
            id: data.id || this.generateUUID(),
            full_name,
            normalized_name: full_name,
            roles,
            type: roles[0] || data.type || "party",
            mobile: this.normalizeText(data.mobile),
            address: data.address || "",
            card_number: this.normalizeText(data.card_number),
            iban: this.normalizeText(data.iban)
        };

        if (existing?.created_at) {
            partyData.created_at = existing.created_at;
        }

        return this.save("parties", partyData);
    },

    // حذف شخص
    async deleteParty(partyId) {
        return this.delete("parties", partyId);
    },

    // پر کردن party_id تراکنش های قدیمی (backfill)
    async backfillTransactionPartyIds() {
        const parties = await this.getAll("parties");
        const transactions = await this.getAll("transactions");

        let updated = 0;

        for (const t of transactions) {
            if (t.party_id) continue; // قبلاً متصل شده

            const normalizedName = this.normalizeText(t.party_normalized_name || t.party_name);
            if (!normalizedName) continue;

            const party = parties.find(p =>
                this.normalizeText(p.normalized_name || p.full_name) === normalizedName
            );

            if (party) {
                t.party_id = party.id;
                await this.save("transactions", t);
                updated++;
            }
        }

        return updated;
    },

    // افزودن قلم پیشنهادی به لیست باکس
    async addProductSuggestion(name, type) {
        const normalizedName = this.normalizeText(name);
        if (!normalizedName || !type) return null;

        const all = await this.getAll("product_suggestions");
        const exists = all.some(
            (p) => p.type === type && this.normalizeText(p.name) === normalizedName
        );

        if (exists) return null;

        return this.save("product_suggestions", {
            id: this.generateUUID(),
            name: normalizedName,
            type
        });
    },

    // دریافت اقلام پیشنهادی بر اساس نوع تراکنش
    async getProductSuggestions(type) {
        const all = await this.getAll("product_suggestions");
        return all
            .filter((p) => p.type === type)
            .map((p) => p.name)
            .filter(Boolean);
    }
};

// اکسپورت برای استفاده در app.js و صفحات دیگر (هم نام جدید و هم سازگاری با قبل)
window.marazonDB = dbContext;
window.marazonDB = dbContext;
