require('dotenv').config();
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const UserAgents = require('user-agents');
const https = require('https');
const cors = require('cors');
const path = require('path'); // Added for sessions dir

const app = express();

// FIXED CORS + TRUST PROXY
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.set('trust proxy', 1);

// JSON + SESSION (with path fix for Render)
app.use(express.json());
const sessionsPath = path.join(__dirname, 'sessions');
app.use(session({
    store: new FileStore({ path: sessionsPath }),
    secret: 'jrmph2025-secret-ultra',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'none',
        maxAge: 30 * 24 * 60 * 60 * 1000
    }
}));

console.log('Sessions path:', sessionsPath); // Debug log

// SUPABASE
const supabaseUrl = 'https://eicbwqhajvkrnotiemjj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpY2J3cWhhanZrcm5vdGllbWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMzc3NTAsImV4cCI6MjA3OTkxMzc1MH0.no58Sn8uFzgCJRYLRRBzxq6g3UGl6JWxjX1iEUcBje4';
const supabase = createClient(supabaseUrl, supabaseKey);
console.log('Supabase connected'); // Debug

const ADMIN_PASS = "Jrmphella060725";
const ACTIVE_USERS = new Map();

// BOOST ENGINE (unchanged, working)
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

// APIs with ERROR HANDLING
app.post('/api/login', async (req, res) => {
    try {
        console.log('Login attempt:', req.body.key); // Debug
        const { key } = req.body;
        if (!key) return res.json({ success: false });
        
        const { data, error } = await supabase.from('keys').select('*').eq('key', key);
        if (error) {
            console.error('Supabase error:', error);
            return res.json({ success: false });
        }
        
        const valid = data?.length > 0 && (data[0].expires === 'lifetime' || new Date(data[0].expires) > new Date());
        console.log('Key valid:', valid); // Debug
        
        if (valid) {
            req.session.loggedIn = true;
            req.session.key = key;
            ACTIVE_USERS.set(req.sessionID, { key, url: "", sent: 0 });
            return res.json({ success: true });
        } else {
            return res.json({ success: false });
        }
    } catch (err) {
        console.error('Login error:', err);
        res.json({ success: false });
    }
});

app.post('/api/boost', async (req, res) => {
    try {
        if (!req.session.loggedIn) return res.json({ success: false });
        const user = ACTIVE_USERS.get(req.sessionID);
        if (!user) return res.json({ success: false });

        const ok = await tiktokBoost(req.body.url);
        if (ok) user.sent += 100;

        res.json({ success: ok, total: user.sent });
    } catch (err) {
        console.error('Boost error:', err);
        res.json({ success: false });
    }
});

app.get('/api/sessions', (req, res) => {
    try {
        const list = Array.from(ACTIVE_USERS.entries()).map(([id, d]) => ({
            session: id.slice(0, 10) + "...",
            key: d.key,
            url: d.url || "Not set",
            sent: d.sent
        }));
        res.json({ count: ACTIVE_USERS.size, users: list });
    } catch (err) {
        res.json({ count: 0, users: [] });
    }
});

app.post('/api/admin', async (req, res) => {
    try {
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
    } catch (err) {
        console.error('Admin error:', err);
        res.json({ success: false });
    }
});

app.post('/api/logout', (req, res) => {
    ACTIVE_USERS.delete(req.sessionID);
    req.session.destroy((err) => {
        if (err) console.error('Logout error:', err);
    });
    res.json({ success: true });
});

// ROOT PAGE (for testing)
app.get('/', (req, res) => {
    res.send(`
        <h1>JRMPH BOOST 2025 BACKEND — LIVE!</h1>
        <p>API endpoints ready. Test login: POST /api/login with {"key": "yourkey"}</p>
        <p>Made by Jrmph • Nov 29, 2025</p>
        <script>console.log('Backend alive!');</script>
    `);
});

// 404 HANDLER (prevent default errors)
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// ERROR HANDLER
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`JRMPH BOOST LIVE ON PORT ${PORT}`);
    console.log(`Domain: https://tiktokboostingviewslikes.onrender.com`);
});
