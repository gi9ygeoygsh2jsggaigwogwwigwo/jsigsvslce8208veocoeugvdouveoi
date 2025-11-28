// server.js — RENDER ONLY (HINDI MAKIKITA SA VERCEL)
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const fs = require('fs');
const axios = require('axios');
const UserAgents = require('user-agents');
const app = express();

app.use(express.json());
app.use(session({
    store: new FileStore({ path: './sessions' }),
    secret: 'jrmph-secret-2025',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30*24*60*60*1000 }
}));

const DB = 'keys.json';
if (!fs.existsSync(DB)) fs.writeFileSync(DB, '[]');
const ADMIN_PASS = "Jrmphella060725";

const ACTIVE_USERS = new Map(); // Live sessions

// BOOST FUNCTION (100% SERVER-SIDE)
async function tiktokBoost(url) {
    const ip = Array(4).fill(0).map(()=>Math.floor(Math.random()*255)).join('.');
    const ua = new UserAgents({ deviceCategory: "mobile" }).random().toString();
    try {
        const bypass = `\( {url}?ref=jrmph \){Date.now()}`;
        await axios.get("https://boostgrams.com", { headers: { "User-Agent": ua, "X-Forwarded-For": ip }, timeout: 15000 }).catch(()=>{});
        await axios.get("https://boostgrams.com/free-tiktok-views/", { headers: { "User-Agent": ua, "X-Forwarded-For": ip }, timeout: 15000 }).catch(()=>{});

        const step1 = await axios.post("https://boostgrams.com/action/", new URLSearchParams({
            ns_action: "freetool_start", "freetool[id]": "22",
            "freetool[process_item]": bypass, "freetool[quantity]": "100"
        }), { headers: { "User-Agent": ua, "X-Forwarded-For": ip }, timeout: 20000 });

        const token = step1.data?.freetool_process_token;
        if (!token) return false;

        await axios.post("https://boostgrams.com/action/", new URLSearchParams({
            ns_action: "freetool_start", "freetool[id]": "22",
            "freetool[token]": token, "freetool[process_item]": bypass, "freetool[quantity]": "100"
        }), { headers: { "User-Agent": ua, "X-Forwarded-For": ip }, timeout: 20000 });

        return true;
    } catch { return false; }
}

// LOGIN + SESSION
app.post('/api/login', (req, res) => {
    const keys = JSON.parse(fs.readFileSync(DB));
    const valid = keys.find(k => k.key === req.body.key && (k.expires === 'lifetime' || new Date(k.expires) > new Date()));
    if (valid) {
        req.session.loggedIn = true;
        req.session.key = req.body.key;
        req.session.expires = valid.expires;
        ACTIVE_USERS.set(req.sessionID, { key: req.body.key, url: "", sent: 0, lastSeen: Date.now() });
        return res.json({ success: true });
    }
    res.json({ success: false });
});

// BOOST API
app.post('/api/boost', async (req, res) => {
    if (!req.session.loggedIn) return res.json({ success: false });
    const user = ACTIVE_USERS.get(req.sessionID);
    if (!user) return res.json({ success: false });
    user.url = req.body.url;
    user.lastSeen = Date.now();
    const ok = await tiktokBoost(req.body.url);
    if (ok) user.sent += 100;
    res.json({ success: ok, total: user.sent });
});

// GET ACTIVE SESSIONS (ADMIN ONLY)
app.get('/api/sessions', (req, res) => {
    const list = Array.from(ACTIVE_USERS.entries()).map(([id, data]) => ({
        session: id.slice(0,10)+"...",
        key: data.key,
        url: data.url || "Not set",
        sent: data.sent,
        lastSeen: new Date(data.lastSeen
    }));
    res.json({ count: ACTIVE_USERS.size, users: list });
});

// ADMIN (TERMUX)
app.post('/api/admin', (req, res) => {
    if (req.body.pass !== ADMIN_PASS) return res.status(403).json({ error: "no" });
    let keys = JSON.parse(fs.readFileSync(DB));
    const { action, key, expires } = req.body;
    if (action === "add") keys.push({ key, expires: expires || "lifetime" });
    if (action === "delete") keys = keys.filter(k => k.key !== key);
    if (action === "list") return res.json({ keys });
    fs.writeFileSync(DB, JSON.stringify(keys, null, 2));
    res.json({ success: true });
});

// LOGOUT
app.post('/api/logout', (req, res) => {
    ACTIVE_USERS.delete(req.sessionID);
    req.session.destroy();
    res.json({ success: true });
});

app.listen(process.env.PORT || 3000);
