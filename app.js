/* =========================================================
   app.js - دفتر حساب مجموعه مارازون (نسخه شخصی)
   ========================================================= */

import {
    formatDisplayNumber,
    moneyToPersianWords,
    toEnglishDigits,
    parseInputNumber
} from "./utils.js";

const DB = () => window.marazonDB || window.boutiaDB;

const PRODUCT_OPTIONS = {
    buy: ["پارچه", "لوازم طراحی و دوخت", "متفرقه"],
    sell: ["پیراهن بلند", "دکلته", "شلوار"]
};

const PARTY_ROLE_MAP = {
    buy: "supplier",
    sell: "customer",
    receive: "customer",
    payment: "supplier"
};

let currentGrandTotal = 0;

function generateSimpleId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function escapeHTML(value) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/[&<>"']/g, (m) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[m]));
}

function normalizeText(value) {
    if (!value) return "";
    return String(value)
        .trim()
        .replace(/\s+/g, " ")
        .replace(/ي/g, "ی")
        .replace(/ك/g, "ک");
}

function getTransactionTypeLabel(type) {
    const labels = {
        buy: "خرید",
        sell: "فروش",
        receive: "دریافت وجه",
        payment: "پرداخت وجه",
        salary: "حقوق",
        expense: "هزینه"
    };

    return labels[type] || "نامشخص";
}

function getItemLabelText(type) {
    if (type === "sell") return "جنس فروخته شده";
    if (type === "expense") return "عنوان هزینه";
    return "جنس خریداری شده";
}

function getDefaultPartyName(type) {
    if (type === "buy") return "تامین کننده محترم";
    if (type === "sell") return "مشتری محترم";
    if (type === "receive") return "مشتری محترم";
    if (type === "payment") return "تامین کننده محترم";
    return "";
}

function updateItemTypeLabels(type) {
    const labelText = getItemLabelText(type);

    document.querySelectorAll(".item-type-label").forEach((label) => {
        label.textContent = labelText;
    });

    document.querySelectorAll(".product-category").forEach((input) => {
        input.placeholder = labelText;
    });
}

function populateDatalist(listId, items) {
    const datalist = document.getElementById(listId);
    if (!datalist) return;

    datalist.innerHTML = items
        .filter(Boolean)
        .map((item) => `<option value="${escapeHTML(item)}"></option>`)
        .join("");
}

async function updateProductsDatalist(type) {
    const staticItems = PRODUCT_OPTIONS[type] || PRODUCT_OPTIONS.buy;
    let savedItems = [];
    const db = DB();

    if (db && db.getProductSuggestions) {
        try {
            savedItems = await db.getProductSuggestions(type);
        } catch (error) {
            console.error("خطا در خواندن اقلام پیشنهادی:", error);
        }
    }

    const items = [...new Set([...(savedItems || []), ...staticItems])];
    populateDatalist("productsList", items);

    document.querySelectorAll(".product-category").forEach((input) => {
        input.setAttribute("list", "productsList");
        input.value = "";
    });
}

async function updatePartyDatalist(type) {
    const partyList = document.getElementById("partyList");
    const db = DB();
    if (!partyList || !db) return;

    if (type === "expense") {
        partyList.innerHTML = "";
        return;
    }

    const role = PARTY_ROLE_MAP[type];
    if (!role) {
        partyList.innerHTML = "";
        return;
    }

    try {
        const parties = await db.getPartiesByRole(role);

        const names = [...new Set(
            parties
                .map((party) => normalizeText(party.full_name || party.normalized_name || ""))
                .filter(Boolean)
        )];

        populateDatalist("partyList", names);
    } catch (error) {
        console.error("خطا در خواندن لیست اشخاص:", error);
        partyList.innerHTML = "";
    }
}

function buildItemsSummary(items, type) {
    if (!Array.isArray(items) || items.length === 0) {
        return "";
    }

    return items.map((item) => {
        const category = escapeHTML(item.category || "بدون نام");
        const qty = item.qty ? formatDisplayNumber(String(item.qty)) : "۰";
        const price = item.price ? formatDisplayNumber(String(item.price)) : "۰";

        if (type === "buy") {
            return `
                <div class="transaction-item-line">
                    <span class="transaction-item-name">${category}</span>
                    <span class="transaction-item-detail">${price} تومان</span>
                </div>
            `;
        }

        return `
            <div class="transaction-item-line">
                <span class="transaction-item-name">${category}</span>
                <span class="transaction-item-detail">${qty} × ${price} تومان</span>
            </div>
        `;
    }).join("");
}

function resetItemRowsToInitial() {
    const itemsContainer = document.getElementById("itemsContainer");
    if (!itemsContainer) return;

    const firstRow = itemsContainer.querySelector(".item-row");
    if (!firstRow) return;

    const baseRow = firstRow.cloneNode(true);

    baseRow.querySelectorAll("input").forEach((input) => {
        input.value = "";
    });

    baseRow.querySelectorAll(".row-amount-words").forEach((element) => {
        element.textContent = "";
    });

    baseRow.querySelectorAll(".row-total-words").forEach((element) => {
        element.textContent = "";
    });

    const type = document.getElementById("type")?.value || "buy";
    const productCategoryInput = baseRow.querySelector(".product-category");
    const itemTypeLabel = baseRow.querySelector(".item-type-label");

    if (productCategoryInput) {
        productCategoryInput.placeholder = getItemLabelText(type);
        productCategoryInput.setAttribute("list", "productsList");
    }

    if (itemTypeLabel) {
        itemTypeLabel.textContent = getItemLabelText(type);
    }

    itemsContainer.innerHTML = "";
    itemsContainer.appendChild(baseRow);

    const qtyInput = baseRow.querySelector(".row-qty");
    const amountInput = baseRow.querySelector(".row-amount");
    const totalInput = baseRow.querySelector(".row-total");

    if (qtyInput) {
        qtyInput.value = "";
        qtyInput.oninput = () => window.handleQtyInput(qtyInput);
    }

    if (amountInput) {
        amountInput.value = "";
        amountInput.oninput = () => window.handleRowAmount(amountInput);
    }

    if (totalInput) {
        totalInput.value = "";
    }

    updateProductsDatalist(type);
}

// نمایش آخرین تراکنش‌ها
async function loadTransactions() {
    const listContainer = document.getElementById("transactionsList");
    const db = DB();

    if (!listContainer || !db) {
        return;
    }

    try {
        const transactions = await db.getAll("transactions");

        transactions.sort((a, b) => {
            return Number(b.timestamp || 0) - Number(a.timestamp || 0);
        });

        if (transactions.length === 0) {
            listContainer.innerHTML = `
                <div class="transactions-empty">
                    هنوز تراکنشی ثبت نشده است.
                </div>
            `;
            return;
        }

        listContainer.innerHTML = transactions.slice(0, 10).map((tx) => {
            const isIncome = tx.type === "sell" || tx.type === "receive";
            const typeLabel = getTransactionTypeLabel(tx.type);
            const totalAmount = Number(tx.total_amount || 0);
            const paidAmount = Number(tx.paid_amount || 0);
            const paymentLabel = isIncome ? "دریافتی:" : "پرداختی:";
            const paymentSign = isIncome ? "+" : "-";
            const paymentClass = isIncome
                ? "transaction-amount-positive"
                : "transaction-amount-negative";

            const itemsSummary = buildItemsSummary(tx.items, tx.type);
            const partyName = escapeHTML(tx.party_name || "بدون نام");
            const description = escapeHTML(tx.description || "");

            const txTime = tx.timestamp
                ? new Date(tx.timestamp).toLocaleTimeString("fa-IR", {
                    hour: "2-digit",
                    minute: "2-digit"
                })
                : "۰۰:۰۰";

            return `
                <article class="transaction-card ${
                    isIncome ? "transaction-card-positive" : "transaction-card-negative"
                }">
                    <div class="transaction-main-row">
                        <div class="transaction-info">
                            <div class="transaction-title-row">
                                <strong class="transaction-party">${partyName}</strong>
                                <span class="transaction-type">${typeLabel}</span>
                            </div>

                            <div class="transaction-meta">
                                <span>📅 ${tx.date}</span>
                                |
                                <span>🕒 ${txTime}</span>
                            </div>

                            <div class="transaction-items">${itemsSummary}</div>

                            ${description ? `<div class="transaction-description">📝 ${description}</div>` : ""}

                            <div class="transaction-paid-row">
                                <div class="transaction-paid">
                                    ${paymentLabel}
                                    <span class="${paymentClass}">
                                        ${paymentSign}${formatDisplayNumber(String(paidAmount))} تومان
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    class="transaction-delete-btn"
                                    onclick="deleteTransaction('${tx.id}')"
                                >
                                    حذف
                                </button>
                            </div>
                        </div>

                        <div class="transaction-amount-box">
                            <span class="transaction-amount">
                                ${formatDisplayNumber(String(totalAmount))}
                            </span>
                            <span class="transaction-currency">تومان</span>
                        </div>
                    </div>
                </article>
            `;
        }).join("");
    } catch (err) {
        console.error("خطا در بارگذاری تراکنش‌ها:", err);
        listContainer.innerHTML = `
            <div class="transactions-error">
                خطا در بارگذاری تراکنش‌ها.
            </div>
        `;
    }
}

window.loadTransactions = loadTransactions;

window.deleteTransaction = async function(txId) {
    if (!txId) return;

    const confirmed = confirm("آیا از حذف این تراکنش مطمئن هستید؟");
    if (!confirmed) return;

    try {
        const db = DB();
        if (typeof db.delete === "function") {
            await db.delete("transactions", txId);
        } else if (typeof db.remove === "function") {
            await db.remove("transactions", txId);
        } else {
            throw new Error("متد حذف در دیتابیس تعریف نشده است.");
        }

        await loadTransactions();
    } catch (error) {
        console.error("خطا در حذف تراکنش:", error);
        alert("حذف تراکنش انجام نشد.");
    }
};

window.onTransactionTypeChange = async function() {
    const type = document.getElementById("type").value;
    const partyLabel = document.getElementById("partyLabel");
    const partyInput = document.getElementById("partySelect");
    const calcSection = document.getElementById("calcSection");
    const paidAmountLabel = document.getElementById("paidAmountLabel");

    if (paidAmountLabel) {
        if (type === "sell" || type === "receive") {
            paidAmountLabel.textContent = "مبلغ دریافتی (تومان)";
        } else {
            paidAmountLabel.textContent = "مبلغ پرداختی (تومان)";
        }
    }

    if (type === "expense" || type === "receive" || type === "payment") {
        calcSection?.classList.add("hidden");
    } else {
        calcSection?.classList.remove("hidden");
    }

    if (type === "buy") {
        partyLabel.textContent = "نام تأمین‌کننده";
        partyInput.setAttribute("list", "partyList");
        partyInput.value = "";
        partyInput.placeholder = "تامین کننده محترم";
    } else if (type === "sell") {
        partyLabel.textContent = "نام مشتری";
        partyInput.setAttribute("list", "partyList");
        partyInput.value = "";
        partyInput.placeholder = "مشتری محترم";
    } else if (type === "receive") {
        partyLabel.textContent = "دریافت وجه از";
        partyInput.setAttribute("list", "partyList");
        partyInput.value = "";
        partyInput.placeholder = "نام مشتری / طرف حساب";
    } else if (type === "payment") {
        partyLabel.textContent = "پرداخت وجه به";
        partyInput.setAttribute("list", "partyList");
        partyInput.value = "";
        partyInput.placeholder = "نام تأمین‌کننده / طرف حساب";
    } else if (type === "expense") {
        partyLabel.textContent = "نوع هزینه";
        partyInput.setAttribute("list", "expensesList");
        partyInput.value = "";
        partyInput.placeholder = "نوع هزینه";
    }

    const rowLayouts = document.querySelectorAll("#rowLayout");
    rowLayouts.forEach((layout) => {
        if (type === "sell") {
            layout.classList.replace("two-columns", "four-columns");
        } else {
            layout.classList.replace("four-columns", "two-columns");
        }
    });

    updateItemTypeLabels(type);
    resetItemRowsToInitial();
    await updateProductsDatalist(type);
    await updatePartyDatalist(type);
    updateGrandTotal();
};

window.calculateRowTotal = function(element) {
    const row = element.closest(".item-row");
    if (!row) return;

    const type = document.getElementById("type").value;

    if (type === "sell") {
        const qtyInput = row.querySelector(".row-qty");
        const qtyRaw = toEnglishDigits(qtyInput.value).replace(/[^\d.]/g, "");

        if (qtyRaw) {
            const parts = qtyRaw.split(".");
            const integerPart = formatDisplayNumber(parts[0] || "0");
            qtyInput.value = parts.length > 1
                ? `${integerPart}.${parts.slice(1).join("")}`
                : integerPart;
        } else {
            qtyInput.value = "";
        }

        const qty = parseFloat(toEnglishDigits(qtyInput.value)) || 0;
        const price = parseInputNumber(row.querySelector(".row-amount").value) || 0;
        const total = qty * price;
        const totalInput = row.querySelector(".row-total");

        if (totalInput) {
            totalInput.value = total > 0 ? formatDisplayNumber(String(total)) : "";
        }
    }

    updateGrandTotal();
};

window.addNewRow = function() {
    const itemsContainer = document.getElementById("itemsContainer");
    const firstRow = itemsContainer?.querySelector(".item-row");

    if (!itemsContainer || !firstRow) {
        return;
    }

    const newRow = firstRow.cloneNode(true);

    newRow.querySelectorAll("input").forEach((input) => {
        input.value = "";
    });

    newRow.querySelectorAll(".row-amount-words").forEach((element) => {
        element.textContent = "";
    });

    newRow.querySelectorAll(".row-total-words").forEach((element) => {
        element.textContent = "";
    });

    const type = document.getElementById("type").value;
    const qtyInput = newRow.querySelector(".row-qty");
    const amountInput = newRow.querySelector(".row-amount");
    const totalInput = newRow.querySelector(".row-total");
    const productCategoryInput = newRow.querySelector(".product-category");
    const itemTypeLabel = newRow.querySelector(".item-type-label");

    if (qtyInput) {
        qtyInput.oninput = () => window.handleQtyInput(qtyInput);
    }

    if (amountInput) {
        amountInput.oninput = () => window.handleRowAmount(amountInput);
    }

    if (totalInput) {
        totalInput.value = "";
    }

    if (productCategoryInput) {
        productCategoryInput.placeholder = getItemLabelText(type);
        productCategoryInput.setAttribute("list", "productsList");
    }

    if (itemTypeLabel) {
        itemTypeLabel.textContent = getItemLabelText(type);
    }

    itemsContainer.appendChild(newRow);
    updateGrandTotal();
};

window.handleRowAmount = function(input) {
    const rawValue = toEnglishDigits(input.value).replace(/[^\d]/g, "");

    input.value = rawValue ? formatDisplayNumber(rawValue) : "";

    const row = input.closest(".item-row");
    const wordsBox = row?.querySelector(".row-amount-words");

    if (wordsBox) {
        wordsBox.textContent = rawValue
            ? `${moneyToPersianWords(Number(rawValue))} تومان`
            : "";
    }

    window.calculateRowTotal(input);
};

window.handleQtyInput = function(input) {
    const rawValue = toEnglishDigits(input.value).replace(/[^\d.]/g, "");

    if (!rawValue) {
        input.value = "";
        window.calculateRowTotal(input);
        return;
    }

    const parts = rawValue.split(".");
    const integerPart = formatDisplayNumber(parts[0] || "0");

    input.value = parts.length > 1
        ? `${integerPart}.${parts.slice(1).join("")}`
        : integerPart;

    window.calculateRowTotal(input);
};

function updateGrandTotal() {
    const type = document.getElementById("type").value;
    let total = 0;

    if (type === "expense" || type === "receive" || type === "payment") {
        total = parseInputNumber(document.getElementById("paidAmount").value);
    } else if (type === "sell") {
        document.querySelectorAll(".row-total").forEach((input) => {
            total += parseInputNumber(input.value);
        });
    } else {
        document.querySelectorAll(".row-amount").forEach((input) => {
            total += parseInputNumber(input.value);
        });
    }

    currentGrandTotal = total;

    document.getElementById("grandTotalLabel").textContent =
        `${formatDisplayNumber(String(total))} تومان`;

    document.getElementById("grandTotalWords").textContent =
        `${moneyToPersianWords(total)} تومان`;
}

async function savePartyByTransactionType(type, partyName) {
    const role = PARTY_ROLE_MAP[type];
    const normalizedName = normalizeText(partyName);
    const db = DB();

    if (!role || !normalizedName || !db?.findOrCreateParty) {
        return null;
    }

    return await db.findOrCreateParty({
        full_name: normalizedName,
        role: role
    });
}

async function saveProductSuggestions(items, type) {
    if (!Array.isArray(items) || items.length === 0) return;
    const db = DB();
    if (!db?.addProductSuggestion) return;

    for (const item of items) {
        if (item.category) {
            try {
                await db.addProductSuggestion(item.category, type);
            } catch (error) {
                console.error("خطا در ذخیره قلم پیشنهادی:", error);
            }
        }
    }
}

// ذخیره تراکنش شخصی
async function handleFormSubmit(e) {
    e.preventDefault();

    const type = document.getElementById("type").value;
    if (!["buy", "sell", "receive", "payment", "expense"].includes(type)) {
        alert("نوع تراکنش معتبر نیست.");
        return;
    }

    let partyName = normalizeText(document.getElementById("partySelect").value);

    if (!partyName) {
        partyName = getDefaultPartyName(type);
    }

    if (!partyName) {
        alert("نام طرف حساب الزامی است.");
        return;
    }

    const items = [];

    if (type === "buy" || type === "sell") {
        document.querySelectorAll(".item-row").forEach((row) => {
            const category = normalizeText(row.querySelector(".product-category").value);
            const price = parseInputNumber(row.querySelector(".row-amount").value);

            if (category || price > 0) {
                items.push({
                    id: generateSimpleId(),
                    category,
                    qty: type === "sell"
                        ? parseFloat(toEnglishDigits(row.querySelector(".row-qty").value)) || 0
                        : 0,
                    price
                });
            }
        });
    }

    const transactionData = {
        id: generateSimpleId(),
        type,
        party_name: partyName,
        party_id: null,
        items,
        total_amount: currentGrandTotal,
        paid_amount: parseInputNumber(document.getElementById("paidAmount").value),
        description: normalizeText(document.getElementById("description").value),
        date: new Date().toLocaleDateString("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran" }),
        timestamp: Date.now()
    };

    try {
        const db = DB();
        const party = await savePartyByTransactionType(type, partyName);
        transactionData.party_id = party?.id || null;

        await db.save("transactions", transactionData);

        if (type === "buy" || type === "sell") {
            await saveProductSuggestions(items, type);
        }

        e.target.reset();

        resetItemRowsToInitial();
        await window.onTransactionTypeChange();
        await updatePartyDatalist(type);
        await loadTransactions();
    } catch (err) {
        console.error("خطا در ذخیره‌سازی:", err);
        alert("خطا در ذخیره‌سازی!");
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    document
        .getElementById("transactionForm")
        .addEventListener("submit", handleFormSubmit);

    document
        .getElementById("paidAmount")
        .addEventListener("input", (e) => {
            const val = toEnglishDigits(e.target.value).replace(/[^\d]/g, "");

            e.target.value = val ? formatDisplayNumber(val) : "";

            const wordsEl = document.getElementById("paidAmountWords");
            if (wordsEl) {
                if (wordsEl.tagName === "TEXTAREA" || wordsEl.tagName === "INPUT") {
                    wordsEl.value = val
                        ? `${moneyToPersianWords(Number(val))} تومان`
                        : "";
                } else {
                    wordsEl.textContent = val
                        ? `${moneyToPersianWords(Number(val))} تومان`
                        : "";
                }
            }

            updateGrandTotal();
        });

    document.querySelectorAll(".row-qty").forEach((input) => {
        input.addEventListener("input", () => {
            window.handleQtyInput(input);
        });
    });

    const form = document.getElementById("transactionForm");
    const submit = form.querySelector('[type="submit"]');
    const status = document.getElementById("databaseStatus");
    const retry = document.getElementById("retryDatabase");

    async function connectDatabase() {
        submit.disabled = true;
        retry.disabled = true;

        try {
            const db = DB();
            if (!db) {
                throw new Error("ماژول دیتابیس بارگذاری نشده است.");
            }
            await db.init();
            await db.backfillTransactionPartyIds();
            await window.onTransactionTypeChange();
            await loadTransactions();
            status.hidden = true;
            submit.disabled = false;
        } catch (error) {
            console.error("خطا در اتصال به دیتابیس:", error);
            status.hidden = false;
            document.getElementById("databaseError").textContent =
                error.message || "اتصال به دیتابیس انجام نشد.";
        } finally {
            retry.disabled = false;
        }
    }

    retry.addEventListener("click", connectDatabase);
    await connectDatabase();
});
