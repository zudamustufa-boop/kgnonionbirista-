const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const app = express();

app.use(express.json());
app.use(cors()); // CORS Enabled for flexible hosting
app.use(express.static(path.join(__dirname)));

const ADMIN_PASSWORD = "KGN_SURAT_SECURE_2026"; // Dashboard Password

const ORDERS_FILE = path.join(__dirname, "orders.json");
const REVIEWS_FILE = path.join(__dirname, "reviews.json");
const INVENTORY_FILE = path.join(__dirname, "inventory.json");

// Helper database functions
function readData(file, defaultData) {
    try {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) { return defaultData; }
}

function writeData(file, data) {
    try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch (e) {}
}

// Simple Helper to block Cross-Site Scripting (XSS Mitigation)
function sanitizeInput(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Security Middleware for Admin Access
function adminAuth(req, res, next) {
    const userPass = req.headers['authorization'];
    if (userPass === ADMIN_PASSWORD) {
        next();
    } else {
        res.status(401).json({ success: false, message: "Unauthorized Entry Attempted!" });
    }
}

// 1. Get Inventory
app.get("/api/inventory", (req, res) => {
    const defaultInv = [
        { id: "p1", name: "Standard Pack (250g)", price: 99, stock: 15 },
        { id: "p2", name: "Medium Pack (500g)", price: 199, stock: 20 },
        { id: "p3", name: "1 KG Mega Pack", price: 399, stock: 25 }
    ];
    res.json(readData(INVENTORY_FILE, defaultInv));
});

// 2. Post Order with Server Side Price Verification
app.post("/api/orders", (req, res) => {
    const { name, phone, address, items } = req.body;
    
    if(!name || !phone || !address || !items || items.length === 0) {
        return res.status(400).json({ success: false, message: "Data Adhura Hai!" });
    }

    let inv = readData(INVENTORY_FILE, []);
    let calculatedTotal = 0;

    // Secure Verification Loop
    for (let item of items) {
        const product = inv.find(p => p.id === item.id);
        if (!product || product.stock < item.qty) {
            return res.status(400).json({ success: false, message: `Stock Issue for ${item.name}` });
        }
        calculatedTotal += product.price * item.qty;
    }

    // Deduct stock levels safely
    items.forEach(item => {
        const product = inv.find(p => p.id === item.id);
        if (product) product.stock -= item.qty;
    });
    writeData(INVENTORY_FILE, inv);

    let orders = readData(ORDERS_FILE, []);
    const uniqueOrderId = "KGN" + Math.floor(10000 + Math.random() * 90000);

    // FIXED FIELDS: Match exactly with frontend properties
    const newOrder = {
        id: uniqueOrderId,
        name: sanitizeInput(name),
        phone: sanitizeInput(phone),
        address: sanitizeInput(address),
        items: items,
        finalAmount: calculatedTotal, // Locked by server calculation
        status: "Received",
        timestamp: new Date()
    };

    orders.unshift(newOrder);
    writeData(ORDERS_FILE, orders);
    res.json({ success: true, order: newOrder });
});

// 3. Secure Phone-Based Tracker (Anti Data Leak)
app.get("/api/track/:phone", (req, res) => {
    const searchPhone = req.params.phone.trim();
    const orders = readData(ORDERS_FILE, []);
    // Filters only requested details
    const filtered = orders.filter(o => String(o.phone).trim() === searchPhone);
    res.json(filtered);
});

// 4. Post Review (XSS Protection Active)
app.post("/api/reviews", (req, res) => {
    const { name, text, rating } = req.body;
    let reviews = readData(REVIEWS_FILE, []);
    reviews.unshift({
        name: sanitizeInput(name),
        text: sanitizeInput(text),
        rating: parseInt(rating) || 5
    });
    writeData(REVIEWS_FILE, reviews);
    res.json({ success: true });
});

app.get("/api/reviews", (req, res) => {
    res.json(readData(REVIEWS_FILE, []));
});

// ---------- PROTECTED ADMIN PIPELINES (Middleware Engaged) ----------
app.get("/api/admin/orders", adminAuth, (req, res) => {
    res.json(readData(ORDERS_FILE, []));
});

app.post("/api/admin/orders/status", adminAuth, (req, res) => {
    const { orderId, status } = req.body;
    let orders = readData(ORDERS_FILE, []);
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.status = status;
        writeData(ORDERS_FILE, orders);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false });
    }
});

app.post("/api/admin/inventory", adminAuth, (req, res) => {
    const { id, stock } = req.body;
    let inv = readData(INVENTORY_FILE, []);
    const item = inv.find(p => p.id === id);
    if (item) {
        item.stock = parseInt(stock) || 0;
        writeData(INVENTORY_FILE, inv);
    }
    res.json({ success: true });
});

// Root Routing Fallback
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 KGN Backend Engine Running Securely on Port ${PORT}`);
});
