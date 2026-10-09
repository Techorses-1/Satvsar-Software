// utils/invoiceNumber.js
const { getSharedConnection } = require("../config/sharedDb");

// ============================================================
// INVOICE NUMBER ALLOCATOR (E-com → uses POS DB registry)
//
// Flow:
//   1. Find max `num` for current year in registry (in POS DB)
//   2. next = max + 1
//   3. Try insert into registry (unique _id prevents duplicates)
//   4. If duplicate → retry
//   5. Return "INV{YEAR}{padded4}"
// ============================================================

const PREFIX = "INV";
const PAD = 4;
const MAX_RETRIES = 5;

// Get the ActiveInvoiceNumber model from the SHARED connection
const getActiveInvoiceNumberModel = () => {
    const conn = getSharedConnection();

    // Reuse existing model if registered on this connection
    return (
        conn.models.ActiveInvoiceNumber ||
        conn.model(
            "ActiveInvoiceNumber",
            require("../modals/ActiveInvoiceNumber").schema
        )
    );
};

/**
 * Allocate the next invoice number.
 * @param {string} project - "pos" or "ecom" (for audit)
 * @returns {Promise<string>} e.g. "INV20260005"
 */
const getNextInvoiceNumber = async (project = "ecom") => {
    const Model = getActiveInvoiceNumberModel();
    const year = new Date().getFullYear();

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const highest = await Model.findOne({ year }, { num: 1 })
            .sort({ num: -1 })
            .lean();

        const maxNum = highest?.num || 0;
        const nextNum = maxNum + 1;
        const padded = String(nextNum).padStart(PAD, "0");
        const invNo = `${PREFIX}${year}${padded}`;

        try {
            await Model.create({
                _id: invNo,
                year,
                num: nextNum,
                project,
                createdAt: new Date(),
            });

            console.log(`🔢 [${project}] Allocated invoice number: ${invNo}`);
            return invNo;
        } catch (err) {
            if (err.code === 11000) {
                console.warn(
                    `⚠️  Invoice number ${invNo} taken, retrying (attempt ${attempt + 1
                    })`
                );
                continue;
            }
            throw err;
        }
    }

    throw new Error(
        "Failed to allocate invoice number after multiple retries. Please try again."
    );
};

/**
 * Release an invoice number on cancel.
 * @param {string} invNo - e.g. "INV20260005"
 */
const releaseInvoiceNumber = async (invNo) => {
    if (!invNo) return;
    try {
        const Model = getActiveInvoiceNumberModel();
        const result = await Model.deleteOne({ _id: invNo });
        if (result.deletedCount > 0) {
            console.log(`♻️  Released invoice number: ${invNo}`);
        }
    } catch (err) {
        console.error(
            `❌ Failed to release invoice number ${invNo}:`,
            err.message
        );
    }
};

module.exports = {
    getNextInvoiceNumber,
    releaseInvoiceNumber,
};