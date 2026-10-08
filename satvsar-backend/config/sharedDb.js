// config/sharedDb.js
const mongoose = require("mongoose");

// ============================================================
// SHARED DB CONNECTION (E-com → POS DB)
// The invoice number registry lives in the POS DB.
// E-com needs a SECOND connection just for the registry.
// Kept separate from the main E-com connection so it doesn't interfere.
// ============================================================

const SHARED_DB_URI =
    "mongodb://admin:Admin%402025@93.127.167.226:27017/pos?authSource=admin&authMechanism=SCRAM-SHA-256";

let sharedConnection = null;

const connectSharedDB = async () => {
    if (sharedConnection) return sharedConnection;

    try {
        sharedConnection = mongoose.createConnection(SHARED_DB_URI, {
            serverSelectionTimeoutMS: 10000,
        });

        // Wait for the connection to be ready
        await sharedConnection.asPromise();

        console.log("✅ Shared DB (pos) connected successfully");
        return sharedConnection;
    } catch (err) {
        console.error("❌ Shared DB (pos) connection failed:", err.message);
        throw err;
    }
};

const getSharedConnection = () => {
    if (!sharedConnection) {
        throw new Error(
            "Shared DB not connected yet. Call connectSharedDB() on server startup."
        );
    }
    return sharedConnection;
};

module.exports = { connectSharedDB, getSharedConnection };