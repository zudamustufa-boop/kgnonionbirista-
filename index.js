         
const express = require('express');
const { createClient } = require('@supabase/supabase-client');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Render ke Environment Variables se Supabase connect karna
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTML file ko server par chalane ke liye
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 1. Delivery Charge permanent database se nikalne ke liye API
app.get('/api/delivery-charge', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'delivery_charge')
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        const charge = data ? parseFloat(data.value) : 0;
        res.json({ delivery_charge: charge });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin Panel se delivery charge badalne ke liye API
app.post('/api/admin/set-delivery', async (req, res) => {
    const { password, charge } = req.body;
    if (password !== "kgn123") return res.status(403).json({ error: "Wrong Password" });

    try {
        const { error } = await supabase
            .from('settings')
            .upsert({ key: 'delivery_charge', value: String(charge) });

        if (error) throw error;
        res.json({ success: true, message: "Delivery charge updated permanent!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Order ko permanent database mein save karne aur approve karne ki APIs
app.post('/api/orders', async (req, res) => {
    const { customer_name, phone, address, items, total_amount, delivery_charge } = req.body;
    try {
        const { data, error } = await supabase
            .from('orders')
            .insert([{ customer_name, phone, address, items, total_amount, delivery_charge, status: 'Pending' }])
            .select();

        if (error) throw error;
        res.json({ success: true, order: data[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/orders', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .order('id', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/approve-order', async (req, res) => {
    const { password, orderId } = req.body;
    if (password !== "kgn123") return res.status(403).json({ error: "Wrong Password" });

    try {
        const { error } = await supabase
            .from('orders')
            .update({ status: 'Approved' })
            .eq('id', orderId);

        if (error) throw error;
        res.json({ success: true, message: "Order approved permanent!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`KGN Onion Birista server running on port ${PORT}`);
});
