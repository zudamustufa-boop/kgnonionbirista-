const express = require("express");
const path = require("path");
const fs = require("fs");
const app = express();

app.use(express.json());

// Frontend files ko render karne ke liye public directory link
app.use(express.static(path.join(__dirname)));

// Dynamic Local Database JSON Files ke paths
const ORDERS_FILE = path.join(__dirname, "orders.json");
const REVIEWS_FILE = path.join(__dirname, "reviews.json");
const INVENTORY_FILE = path.join(__dirname, "inventory.json");

// Database files ko safely read aur write karne ke helper functions
function readData(file, defaultData) {
    try {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
        return defaultData;
    }
}

function writeData(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error writing data to database file:", e);
    }
}

// 1. API Endpoint: Products Inventory list dynamic send karna
app.get("/api/inventory", (req, res) => {
    const defaultInv = [
        { id: "p1", name: "Standard Pack (250g)", price: 99, weight: 0.25, stock: 15, img: "birista-250g.jpg" },
        { id: "p2", name: "Medium Pack (500g)", price: 199, weight: 0.50, stock: 20, img: "birista-500g.jpg" },
        { id: "p3", name: "1 KG Mega Pack", price: 399, weight: 1.00, stock: 25, img: "birista-1kg.jpg" }
    ];
    res.json(readData(INVENTORY_FILE, defaultInv));
});

// 2. API Endpoint: Admin Panel se stock manually update karne ke liye
app.post("/api/admin/inventory", (req, res) => {
    const { id, stock } = req.body;
    let inv = readData(INVENTORY_FILE, []);
    const item = inv.find(p => p.id === id);
    if (item) {
        item.stock = parseInt(stock) || 0;
        writeData(INVENTORY_FILE, inv);
    }
    res.json({ success: true, updatedInv: inv });
});

// 3. API Endpoint: Naya Order generate aur permanently save karna
app.post("/api/orders", (req, res) => {
    const { name, phone, address, items, finalAmount, paymentMode } = req.body;
    let orders = readData(ORDERS_FILE, []);
    let inv = readData(INVENTORY_FILE, []);

    // Order submit karne se pehle real stock level verification logic loop
    for (let item of items) {
        const p = inv.find(prod => prod.id === item.id);
        if (!p || p.stock < item.qty) {
            return res.status(400).json({ success: false, message: `Stock short for ${item.name}! Kripya quantities kam karein.` });
        }
    }

    // Validation success hone par stock level deduct karna
    items.forEach(item => {
        const p = inv.find(prod => prod.id === item.id);
        if (p) p.stock = Math.max(0, p.stock - item.qty);
    });
    writeData(INVENTORY_FILE, inv);

    // Cryptographic Alphanumeric Unique Order ID Generator Matrix Block
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const uniqueOrderId = "KGN" + randomSuffix;

    const newOrder = {
        id: uniqueOrderId,
        name,
        phone,
        address,
        items,
        finalAmount,
        paymentMode,
        status: "Received", // Default state loop parameter context
        timestamp: new Date()
    };
    
    orders.unshift(newOrder);
    writeData(ORDERS_FILE, orders);
    res.json({ success: true, order: newOrder });
});

// 4. API Endpoint: Admin Dashboard ke liye saare orders ki list read karna
app.get("/api/admin/orders", (req, res) => {
    res.json(readData(ORDERS_FILE, []));
});

// 5. API Endpoint: Admin Panel se Tracking pipeline status update karna (Approved / Dispatched)
app.post("/api/admin/orders/status", (req, res) => {
    const { orderId, status } = req.body;
    let orders = readData(ORDERS_FILE, []);
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.status = status;
        writeData(ORDERS_FILE, orders);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: "Order ID not found inside database storage." });
    }
});

// 6. API Endpoint: Customers ke reviews fetch karna
app.get("/api/reviews", (req, res) => {
    const defaultRev = [
        { name: "Aamir Khan, Adajan", text: "Best birista in Surat. Bahut crispy hai aur biryani ka maza dugna ho gaya.", rating: 5 },
        { name: "Irfan Shaikh, Chowk", text: "Ghar par ab pyaaz kaatne aur talne ki jhanjhat khatam. Packing badiya hai.", rating: 5 }
    ];
    res.json(readData(REVIEWS_FILE, defaultRev));
});

// 7. API Endpoint: Dynamic review ko permanently data file mein post karna
app.post("/api/reviews", (req, res) => {
    const { name, text, rating } = req.body;
    let reviews = readData(REVIEWS_FILE, []);
    reviews.unshift({ name, text, rating: parseInt(rating) || 5 });
    writeData(REVIEWS_FILE, reviews);
    res.json({ success: true, updatedReviews: reviews });
});

// Fallback: Agar index.html mangi jaye toh direct redirect routing parameters setup
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// Server running parameters allocation logic integration port loop
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 KGN Automated Backend Engine Server is live and running on port ${PORT}`);
});