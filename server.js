require('dotenv').config();
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const UserAgents = require('user-agents');
const cors = require('cors'); // ← ITO ANG KULANG MO!

const app = express();

// FIX #1: CORS — PARA MAKACONNECT ANG VERCEL
app.use(cors({
    origin: "*", // or specific domain mo
    credentials: true
}));

app.use(express.json());
app.use(session({
    store: new FileStore({ path: './sessions' }),
    secret: 'jrmph2025-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30*24*60*60*1000, httpOnly: true, sameSite: 'lax' }
}));

// SUPABASE (YOUR PROJECT)
const supabase = createClient(
    'https://eicbwqhajvkrnotiemjj.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpY2J3cWhhanZrcm5vdGllbWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMzc3NTAsImV4cCI6MjA3OTkxMzc1MH0.no58Sn8uFzgCJRYLRRBzxq6g3UGl6JWxjX1iEUcBje4'
);

const ADMIN_PASS = "Jrmphella060725";
const ACTIVE_USERS = new Map();

// FIXED BOOST FUNCTION — NO MORE TEMPLATE BUG!
async function tiktokBoost(url) {
    const ip = Array(4).fill(0).map(() => Math.floor(Math.random() * 255)).join('.');
    const ua = new UserAgents({ deviceCategory: "mobile" }).random().toString();
    try {
        const bypass = url + '?ref=jrmph' + Date.now(); // ← FIXED NA!
        await axios.get("https://boostgrams.com", { headers: { "User-Agent": ua, "X-Forwarded-For": ip }, timeout: 15000 }).catch(() => {});
        await axios.get("https://boostgrams.com/free-tiktok-views/", { headers: { "User-Agent": ua, "X-Forwarded-For": ip }, timeout: 15000 }).catch(() => {});

        const step1 = await axios.post("https://boostgrams.com/action/", new URLSearchParams({
            ns_action: "freetool_start",
            "freetool[id]": "22",
            "freetool[process_item]": bypass,
            "freetool[quantity]": "100"
        }), {
            headers: { "User-Agent": ua, "X-Forwarded-For": ip },
            timeout: 20000
        });

        const token = step1.data?.freetool_process_token;
        if (!token) return false;

        await axios.post("https://boostgrams.com/action/", new URLSearchParams({
            ns_action: "freetool_start",
            "freetool[id]": "22",
            "freetool[token]": token,
            "freetool[process_item]": bypass,
            "freetool[quantity]": "100"
        }), {
            headers: { "User-Agent": ua, "X-Forwarded-For": ip },
            timeout: 20000
        });

        return true;
    } catch (e) {
        console.log("Boost error:", e.message);
        return false;
    }
}

// APIs (SAME — WORKING NA)
app.post('/api/login', async (req, res) => {
    const { key } = req.body;
    const { data } = await supabase.from('keys').select().eq('key', key);
    const valid = data?.length > 0 && (data[0].expires === 'lifetime' || new Date(data[0].expires) > new Date());
    if (valid) {
        req.session.loggedIn = true;
        req.session.key = key;
        ACTIVE_USERS.set(req.sessionID, { key, url: "", sent: 0 });
        res.json({ success: true });
    } else res.json({ success: false });
});

app.post('/api/boost', async (req, res) => {
    if (!req.session.loggedIn) return res.json({ success: false });
    const user = ACTIVE_USERS.get(req.sessionID);
    if (!user) return res.json({ success: false });
    user.url = req.body.url;
    const ok = await tiktokBoost(req.body.url);
    if (ok) user.sent += 100;
    res.json({ success: ok, total: user.sent });
});

app.get('/api/sessions', (req, res) => {
    const list = Array.from(ACTIVE_USERS.entries()).map(([id, d]) => ({
        session: id.slice(0,10)+"...",
        key: d.key,
        url: d.url || "Not set",
        sent: d.sent
    }));
    res.json({ count: ACTIVE_USERS.size, users: list });
});

app.post('/api/admin', async (req, res) => {
    if (req.body.pass !== ADMIN_PASS) return res.status(403).json({ error: "no" });
    const { action, key, expires } = req.body;

    if (action === "add") {
        const { data } = await supabase.from('keys').select().eq('key', key);
        if (data?.length > 0) return res.json({ error: "exists" });
        await supabase.from('keys').insert({ key, expires: expires || "lifetime" });
    }
    if (action === "delete") await supabase.from('keys').delete().eq('key', key);
    if (action === "list") {
        const { data } = await supabase.from('keys').select();
        return res.json({ keys: data || [] });
    }
    res.json({ success: true });
});

app.post('/api/logout', (req, res) => {
    ACTIVE_USERS.delete(req.sessionID);
    req.session.destroy();
    res.json({ success: true });
});

app.listen(process.env.PORT || 3000, () => console.log("JRMPH BOOST BACKEND LIVE"));
