require('dotenv').config();
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const UserAgents = require('user-agents');
const https = require('https');
const cors = require('cors');

const app = express();

// FIXED CORS PARA SA VERCEL + ANY FRONTEND
app.use(cors({
    origin: true,                  // Allows Vercel, Netlify, etc.
    credentials: true,             // Important: allows cookies/session
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.set('trust proxy', 1); // CRUCIAL PARA SA RENDER + VERCEL

app.use(express.json());
app.use(session({
    store: new FileStore({ path: './sessions' }),
    secret: 'jrmph2025-secret-ultra',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true,              // HTTPS only (Render auto-HTTPS)
        httpOnly: true,
        sameSite: 'none',          // Required for cross-site (Vercel → Render)
        maxAge: 30 * 24 * 60 * 60 * 1000
    }
}));

// SUPABASE (gamit ang working anon key mo)
const supabase = createClient(
    'https://eicbwqhajvkrnotiemjj.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpY2J3cWhhanZrcm5vdGllbWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMzc3NTAsImV4cCI6MjA3OTkxMzc1MH0.no58Sn8uFzgCJRYLRRBzxq6g3UGl6JWxjX1iEUcBje4'
);

const ADMIN_PASS = "Jrmphella060725";
const ACTIVE_USERS = new Map();

// ==================== JRMPH 2025 BOOST ENGINE (WORKING) ====================

const BASE_URL = "https://boostgrams.com";
const API_URL = `${BASE_URL}/action/`;

const randomIP = () => Array(4).fill(0).map(() => Math.floor(Math.random() * 256)).join(".");
const randomUA = () => new UserAgents({ deviceCategory: "mobile" }).toString();

let cookieJar = {};

const cookiesToHeader = () => Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join("; ");
const mergeCookies = (res) => {
    const cookies = res.headers["set-cookie"];
    if (!cookies) return;
    cookies.forEach(raw => {
        const [pair] = raw.split(";");
        const [key, val] = pair.split("=");
        if (key) cookieJar[key.trim()] = val || "";
    });
};

const getHeaders = (isPage, ip, ua) => ({
    "User-Agent": ua,
    "Accept-Language": "en-US,en;q=0.9",
    "X-Forwarded-For": ip,
    "X-Real-IP": ip,
    Cookie: cookiesToHeader(),
    Accept: isPage ? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" : "*/*",
    ...(isPage ? {} : {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest"
    })
});

const buildBody = (url, token = "") => {
    const p = new URLSearchParams();
    p.append("ns_action", "freetool_start");
    p.append("freetool[id]", "22");
    p.append("freetool[token]", token);
    p.append("freetool[process_item]", url);
    p.append("freetool[quantity]", "100");
    return p.toString();
};

const initSession = async (ip, ua) => {
    cookieJar = {};
    await axios.get(BASE_URL, { headers: getHeaders(true, ip, ua), timeout: 15000 }).catch(() => {});
    await axios.get(`${BASE_URL}/free-tiktok-views/`, { headers: getHeaders(true, ip, ua), timeout: 15000 }).catch(() => {});
};

const generateBypassUrl = (url) => {
    const rand = Math.random().toString(36).substring(2);
    const time = Date.now();
    return `${url}?ref=jrmph${rand}${time}&t=${time}`;
};

const cleanUrl = (url) => {
    try { const u = new URL(url); return `${u.origin}${u.pathname}`; }
    catch { return url; }
};

const resolveShortUrl = (shortUrl) => new Promise((resolve, reject) => {
    https.request(shortUrl, { method: "HEAD", headers: { "User-Agent": randomUA() } }, (res) => {
        const loc = res.headers.location;
        if (!loc) return reject();
        if (loc.includes("/video/")) resolve(loc);
        else resolveShortUrl(loc).then(resolve).catch(reject);
    }).on("error", reject).end();
});

const prepareUrl = async (input) => {
    if (input.includes("vt.tiktok.com") || input.includes("vm.tiktok.com")) {
        try { return cleanUrl(await resolveShortUrl(input)); }
        catch { return cleanUrl(input); }
    }
    return cleanUrl(input);
};

const tiktokBoost = async (rawUrl) => {
    const url = await prepareUrl(rawUrl);
    const ip = randomIP();
    const ua = randomUA();

    try {
        const bypassUrl = generateBypassUrl(url);
        await initSession(ip, ua);

        const step1 = await axios.post(API_URL, buildBody(bypassUrl), {
            headers: getHeaders(false, ip, ua),
            validateStatus: () => true,
            timeout: 20000
        });

        mergeCookies(step1);
        const token = step1.data?.freetool_process_token;
        if (!token) return false;

        const step2 = await axios.post(API_URL, buildBody(bypassUrl, token), {
            headers: getHeaders(false, ip, ua),
            validateStatus: () => true,
            timeout: 20000
        });

        return !!(step2.data?.statu || step2.data?.success || step2.data?.status);
    } catch {
        return false;
    }
};

// ============================= APIs =============================

app.post('/api/login', async (req, res) => {
    const { key } = req.body;
    const { data } = await supabase.from('keys').select().eq('key', key);
    const valid = data?.length > 0 && (data[0].expires === 'lifetime' || new Date(data[0].expires) > new Date());

    if (valid) {
        req.session.loggedIn = true;
        req.session.key = key;
        ACTIVE_USERS.set(req.sessionID, { key, url: "", sent: 0 });
        res.json({ success: true });
    } else {
        res.json({ success: false });
    }
});

app.post('/api/boost', async (req, res) => {
    if (!req.session.loggedIn) return res.json({ success: false });
    const user = ACTIVE_USERS.get(req.sessionID);
    if (!user) return res.json({ success: false });

    const ok = await tiktokBoost(req.body.url);
    if (ok) user.sent += 100;

    res.json({ success: ok, total: user.sent });
});

app.get('/api/sessions', (req, res) => {
    const list = Array.from(ACTIVE_USERS.entries()).map(([id, d]) => ({
        session: id.slice(0, 10) + "...",
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
        res.json({ success: true });
    }
    if (action === "delete") {
        await supabase.from('keys').delete().eq('key', key);
        res.json({ success: true });
    }
    if (action === "list") {
        const { data } = await supabase.from('keys').select();
        res.json({ keys: data || [] });
    }
});

app.post('/api/logout', (req, res) => {
    ACTIVE_USERS.delete(req.sessionID);
    req.session.destroy();
    res.json({ success: true });
});

// ROOT PARA MAKITA MO PAG BINISITA MO ANG DOMAIN
app.get('/', (req, res) => {
    res.send("<h1>JRMPH BOOST 2025 BACKEND — LIVE & UNTOUCHABLE</h1><p>Made by Jrmph</p>");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("JRMPH BOOST BACKEND RUNNING ON:");
    console.log(`https://tiktokboostingviewslikes.onrender.com`);
});
