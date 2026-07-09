const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const app = express();

app.use(express.json());

// Strict Production CORS Setup
const allowedOrigins = ['https://kgnonionbirista.com', 'http://localhost:3000'];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('CORS Policy: Access Denied!'));
        }
    }
}));

app.use(express.static(path.join(__dirname)));

// CRITICAL SECURITY: Environment Variable Verification
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
    console.error("❌ FATAL ERROR: process.env.ADMIN_PASSWORD is not set! Server shutting down.");
    process.exit(1); 
}

// Anti Brute-Force Framework Variables
const loginAttempts = {};
const LOCKOUT_TIME = 60 * 1000; 
const MAX_ATTEMPTS = 5;

// === HERE IS YOUR JSON DATABASE FILE PATHS ===
const ORDERS_FILE = path.join(__dirname, "orders.json");
const REVIEWS_FILE = path.join(__dirname, "reviews.json");
const INVENTORY_FILE = path.join(__dirname, "inventory.json");

// Short-term memory array to trigger the loud live alarm sound
let unreadOrdersForAdmin = [];

// === JSON HELPER FUNCTIONS (FULL STORAGE IMPLEMENTATION) ===
function readData(file, defaultData) {
    try {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) { 
        console.error("JSON Read Error:", e);
        return defaultData; 
    }
}

function writeData(file, data) {
    try { 
        fs.writeFileSync(file, JSON.stringify(data, null, 2)); 
    } catch (e) {
        console.error("JSON Write Error:", e);
    }
}

// Security: XSS Mitigation Sanitizer
function sanitizeInput(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

// Validation: Strict Indian Mobile Format Verification
function isValidIndianPhone(phone) {
    return /^[6-9]\d{9}$/.test(String(phone).trim());
}

// Security Middleware: Controlled Dashboard Authentication
function adminAuth(req, res, next) {
    const clientIp = req.ip;
    const userPass = req.headers['authorization'];

    if (loginAttempts[clientIp] && loginAttempts[clientIp].attempts >= MAX_ATTEMPTS) {
        const timePassed = Date.now() - loginAttempts[clientIp].lastAttempt;
        if (timePassed < LOCKOUT_TIME) {
            return res.status(429).json({ success: false, message: "Too many failed attempts. Try again after 1 minute." });
        } else { loginAttempts[clientIp].attempts = 0; }
    }

    if (userPass === ADMIN_PASSWORD) {
        if (loginAttempts[clientIp]) loginAttempts[clientIp].attempts = 0;
        next();
    } else {
        if (!loginAttempts[clientIp]) loginAttempts[clientIp] = { attempts: 0, lastAttempt: Date.now() };
        loginAttempts[clientIp].attempts += 1;
        loginAttempts[clientIp].lastAttempt = Date.now();
        res.status(401).json({ success: false, message: "Unauthorized Dashboard Attempt!" });
    }
}

// 1. Get Inventory Route (Reads inventory.json)
app.get("/api/inventory", (req, res) => {
    const defaultInv = [
        { id: "p1", name: "Standard Pack (250g)", price: 99, weight: 0.25, stock: 15 },
        { id: "p2", name: "Medium Pack (500g)", price: 199, weight: 0.50, stock: 20 },
        { id: "p3", name: "1 KG Mega Pack", price: 399, weight: 1.00, stock: 25 }
    ];
    res.json(readData(INVENTORY_FILE, defaultInv));
});

// 2. Place Order Route (Validates, Updates stock, and saves inside orders.json)
app.post("/api/orders", (req, res) => {
    const { name, phone, address, items } = req.body;
    
    if(!name || !phone || !address || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: "Data incomplete!" });
    }
    if (!isValidIndianPhone(phone)) {
        return res.status(400).json({ success: false, message: "Invalid Phone Number! 10 Digits required." });
    }

    let inv = readData(INVENTORY_FILE, []);
    const cartTotals = {};
    for (let item of items) { cartTotals[item.id] = (cartTotals[item.id] || 0) + (parseInt(item.qty) || 0); }

    let calculatedTotal = 0;
    let totalWeight = 0;

    for (let id in cartTotals) {
        const product = inv.find(p => p.id === id);
        if (!product) return res.status(400).json({ success: false, message: "Product missing!" });
        if (product.stock < cartTotals[id]) {
            return res.status(400).json({ success: false, message: `${product.name} stock is low! Max available: ${product.stock}` });
        }
        calculatedTotal += product.price * cartTotals[id];
        totalWeight += (product.weight || 0) * cartTotals[id];
    }

    let deliveryCharge = calculatedTotal >= 500 ? 0 : (totalWeight > 2 ? 60 : 40);
    const finalBillAmount = calculatedTotal + deliveryCharge;

    // Deduct stock levels inside inventory array and write to file
    for (let id in cartTotals) { inv.find(p => p.id === id).stock -= cartTotals[id]; }
    writeData(INVENTORY_FILE, inv);

    // Save final verified details inside orders.json file
    let orders = readData(ORDERS_FILE, []);
    let uniqueOrderId;
    let isDuplicate = true;
    while (isDuplicate) {
        uniqueOrderId = "KGN" + Math.floor(10000 + Math.random() * 90000);
        isDuplicate = orders.some(o => o.id === uniqueOrderId);
    }

    const newOrder = {
        id: uniqueOrderId,
        name: sanitizeInput(name),
        phone: String(phone).trim(),
        address: sanitizeInput(address),
        items: items,
        finalAmount: finalBillAmount,
        status: "Received",
        timestamp: new Date()
    };

    orders.unshift(newOrder);
    writeData(ORDERS_FILE, orders);

    // Push details to real-time memory loop array to flash sound alert on admin dashboard
    unreadOrdersForAdmin.push(newOrder);

    res.json({ success: true, order: newOrder });
});

// 3. Secure Polling Real-Time Alerts Route
app.get("/api/admin/alerts", adminAuth, (req, res) => {
    res.json({ newOrders: unreadOrdersForAdmin });
});

// 4. Silence Siren Alert Route
app.post("/api/admin/alerts/clear", adminAuth, (req, res) => {
    unreadOrdersForAdmin = [];
    res.json({ success: true });
});

// 5. Secure Phone + OrderID Tracker Routing (Protects Client Leak Protection)
app.post("/api/track", (req, res) => {
    const { orderId, phone } = req.body;
    const orders = readData(ORDERS_FILE, []);
    const match = orders.find(o => o.id.trim() === String(orderId).trim() && String(o.phone).trim() === String(phone).trim());
    if(match) res.json({ success: true, order: match });
    else res.status(404).json({ success: false, message: "Order credentials don't match our records!" });
});

// 6. Moderated Reviews System (Writes to reviews.json)
app.post("/api/reviews", (req, res) => {
    const { name, text, rating } = req.body;
    let numRating = Math.max(1, Math.min(5, parseInt(rating) || 5));
    let reviews = readData(REVIEWS_FILE, []);
    reviews.unshift({ 
        id: "REV" + Math.floor(10000 + Math.random() * 90000), 
        name: sanitizeInput(name), 
        text: sanitizeInput(text), 
        rating: numRating, 
        status: "pending" 
    });
    writeData(REVIEWS_FILE, reviews);
    res.json({ success: true });
});

// Get Only Approved Reviews
app.get("/api/reviews", (req, res) => {
    res.json(readData(REVIEWS_FILE, []).filter(r => r.status === "approved"));
});

// === PROTECTED ADMIN WORKSPACE ROUTES (Interacts with JSON layers) ===
app.get("/api/admin/orders", adminAuth, (req, res) => { res.json(readData(ORDERS_FILE, [])); });

app.post("/api/admin/orders/status", adminAuth, (req, res) => {
    const { orderId, status } = req.body;
    let orders = readData(ORDERS_FILE, []);
    const order = orders.find(o => o.id === orderId);
    if (order) { order.status = status; writeData(ORDERS_FILE, orders); res.json({ success: true }); }
    else { res.status(404).json({ success: false }); }
});

app.get("/api/admin/reviews", adminAuth, (req, res) => { res.json(readData(REVIEWS_FILE, [])); });

app.post("/api/admin/reviews/action", adminAuth, (req, res) => {
    const { reviewId, action } = req.body;
    let reviews = readData(REVIEWS_FILE, []);
    if (action === "approve") { const r = reviews.find(rev => rev.id === reviewId); if (r) r.status = "approved"; }
    else if (action === "delete") { reviews = reviews.filter(rev => rev.id !== reviewId); }
    writeData(REVIEWS_FILE, reviews);
    res.json({ success: true });
});

app.post("/api/admin/inventory", adminAuth, (req, res) => {
    const { id, stock } = req.body;
    let inv = readData(INVENTORY_FILE, []);
    const item = inv.find(p => p.id === id);
    if (item) { item.stock = Math.max(0, parseInt(stock) || 0); writeData(INVENTORY_FILE, inv); }
    res.json({ success: true });
});

app.get("/", (req, res) => { res.sendFile(path.join(__dirname, "index.html")); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`🚀 Secure KGN Server active on port ${PORT}`); });
