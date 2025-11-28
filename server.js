const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const UserAgents = require('user-agents');
const https = require('https');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.set('trust proxy', 1);
app.use(express.json());

app.use(session({
    store: new FileStore({ path: path.join(__dirname, 'sessions') }),
    secret: 'jrmph2025-ultra-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: true, httpOnly: true, sameSite: 'none', maxAge: 30*24*60*60*1000 }
}));

const supabase = createClient(
    'https://eicbwqhajvkrnotiemjj.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpY2J3cWhhanZrcm5vdGllbWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMzc3NTAsImV4cCI6MjA3OTkxMzc1MH0.no58Sn8uFzgCJRYLRRBzxq6g3UGl6JWxjX1iEUcBje4'
);

const ADMIN_PASS = "Jrmphella060725";
const ACTIVE_USERS = new Map();
const SESSION_TIMEOUT = 30 * 60 * 1000;

// AUTO CLEANUP
setInterval(() => {
    const now = Date.now();
    for (const [id, user] of ACTIVE_USERS.entries()) {
        if (now - user.last_active > SESSION_TIMEOUT) {
            console.log(`Timeout: Removed ${user.key}`);
            ACTIVE_USERS.delete(id);
        }
    }
}, 2 * 60 * 1000);

// === EXACT BOOST ENGINE MO (100% COPY-PASTED & WORKING) ===
const BASE_URL = "https://boostgrams.com";
const API_URL = `${BASE_URL}/action/`;

const randomIP = () => Array(4).fill(0).map(() => Math.floor(Math.random() * 256)).join(".");
const randomUA = () => new UserAgents({ deviceCategory: "mobile", platform: /(Android|iPhone)/ }).toString();

let cookieJar = {};

const cookiesToHeader = () => Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join("; ");

const mergeCookies = (res) => {
    const cookies = res.headers["set-cookie"];
    if (!cookies) return;
    cookies.forEach((raw) => {
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
    Accept: isPage ? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" : "application/json, */*;q=0.1",
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
    return `${url}?ref=boost${rand}${time}&t=${time}`;
};

const cleanUrl = (url) => {
    try { const u = new URL(url); return `${u.origin}${u.pathname}`; } catch { return url; }
};

const resolveShortUrl = (shortUrl) => new Promise((resolve, reject) => {
    https.request(shortUrl, {
        method: "HEAD",
        headers: { "User-Agent": randomUA() }
    }, (res) => {
        const loc = res.headers.location;
        if (!loc) return reject();
        if (loc.includes("/video/")) resolve(loc);
        else resolveShortUrl(loc).then(resolve).catch(reject);
    }).on("error", reject).end();
});

const prepareUrl = async (input) => {
    if (input.includes("vt.tiktok.com") || input.includes("vm.tiktok.com")) {
        try { return cleanUrl(await resolveShortUrl(input)); } catch { return cleanUrl(input); }
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

        return !!(step2.data?.statu || step2.data?.success);
    } catch (err) {
        return false;
    }
};
// === END OF YOUR LEGENDARY BOOST ENGINE ===

// APIs
app.post('/api/login', async (req, res) => {
    const { key } = req.body;
    const { data } = await supabase.from('keys').select().eq('key', key).single();
    const valid = data && (data.expires === 'lifetime' || new Date(data.expires) > new Date());

    if (valid) {
        req.session.loggedIn = true;
        req.session.key = key;
        ACTIVE_USERS.set(req.sessionID, { key, current_url: "Not set", sent: 0, last_active: Date.now() });
        res.json({ success: true });
    } else res.json({ success: false });
});

app.post('/api/boost', async (req, res) => {
    if (!req.session.loggedIn) return res.json({ success: false });
    const user = ACTIVE_USERS.get(req.sessionID);
    if (!user) return res.json({ success: false });

    user.current_url = req.body.url;
    user.last_active = Date.now();

    const ok = await tiktokBoost(req.body.url);
    if (ok) user.sent += 100;

    res.json({ success: ok, total: user.sent });
});

app.get('/api/sessions', (req, res) => {
    const users = Array.from(ACTIVE_USERS.values()).map(u => ({
        key: u.key,
        url: u.current_url,
        sent: u.sent
    }));
    res.json({ count: ACTIVE_USERS.size, users });
});

app.post('/api/ping', (req, res) => {
    if (req.session.loggedIn) {
        const user = ACTIVE_USERS.get(req.sessionID);
        if (user) user.last_active = Date.now();
        res.json({ success: true });
    } else res.json({ success: false });
});

app.get('/', (req, res) => res.send("<h1>JRMPH BOOST 2025 — POWERED BY JHAMES MARTIN ENGINE</h1>"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LIVE → https://tiktokboostingviewslikes.onrender.com`));
