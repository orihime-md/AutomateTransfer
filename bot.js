   #!/usr/bin/env node
"use strict";

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  BENFEITECH · Authorized Security Test Harness               ║
 * ║  Only run against systems you own or are explicitly          ║
 * ║  authorized to test.                                         ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const fs       = require("fs");
const crypto   = require("crypto");
const readline = require("readline");

const axios     = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");
const { faker } = require("@faker-js/faker");
const chalk     = require("chalk");

// ══════════════════════════════════════════════════════════════════
//  PALETTE — no red, no blue
// ══════════════════════════════════════════════════════════════════
const C_ACCENT = chalk.magenta;
const C_HEAD   = chalk.whiteBright;
const C_OK     = chalk.green;
const C_WARN   = chalk.yellow;
const C_ERR    = chalk.magentaBright;
const C_INFO   = chalk.yellowBright;
const C_LABEL  = chalk.gray;
const C_VALUE  = chalk.white;
const C_HIGH   = chalk.greenBright;
const C_SUB    = chalk.gray;
const B        = chalk.bold;
const D        = chalk.dim;

// ══════════════════════════════════════════════════════════════════
//  UNICODE
// ══════════════════════════════════════════════════════════════════
const U_OK = "✔", U_NO = "✘", U_WARN = "⚠";
const U_ARROW = "→", U_DOT = "•";
const U_DIAMOND = "◆", U_TRI = "▸";
const U_TL = "╭", U_TR = "╮", U_BL = "╰", U_BR = "╯";
const U_H = "─", U_V = "│";
const U_SEP_L = "├", U_SEP_R = "┤";
const U_BAR = "▌";

//  "https://lagoslife.app my web game
// ══════════════════════════════════════════════════════════════════
//  CONFIG
// ══════════════════════════════════════════════════════════════════
const BASE_URL          = "https://lagoslife.app";
const REGISTER_ENDPOINT = `${BASE_URL}/api/auth/register`;
const ME_ENDPOINT       = `${BASE_URL}/api/auth/me`;
const SAVE_ENDPOINT     = `${BASE_URL}/api/save`;
const SEND_ENDPOINT     = `${BASE_URL}/api/send`;
const PLAYERS_ENDPOINT  = `${BASE_URL}/api/players`;

const DEMO_GIFT_AMOUNT    = 1050000;
const SAVE_TEMPLATE_FILE  = "save_template.json";
const SAVE_CURL_FILE      = "save_request.txt";
const SAVE_METHODS_TO_TRY = ["PUT", "POST", "PATCH"];

const W = 62;

const _ANSI_RE = /\x1b\[[0-9;]*m/g;
const _vlen = (s) => String(s).replace(_ANSI_RE, "").length;

// ══════════════════════════════════════════════════════════════════
//  PRIMITIVES
// ══════════════════════════════════════════════════════════════════
function emit(inner) {
  const pad = " ".repeat(Math.max(0, W - _vlen(inner)));
  console.log(`  ${C_ACCENT(U_V)}${inner}${pad}${C_ACCENT(U_V)}`);
}

function boxOpen(title = "", subtitle = "") {
  if (title) {
    const head = `${U_H} ${title} `;
    const fill = U_H.repeat(Math.max(0, W - head.length - 1));
    console.log(`  ${C_ACCENT(U_TL + head + fill + U_TR)}`);
  } else {
    console.log(`  ${C_ACCENT(U_TL + U_H.repeat(W + 1) + U_TR)}`);
  }
  if (subtitle) emit(`  ${C_SUB(subtitle)}`);
}

function boxClose() {
  console.log(`  ${C_ACCENT(U_BL + U_H.repeat(W + 1) + U_BR)}`);
}

function boxSep() {
  console.log(`  ${C_ACCENT(U_SEP_L + U_H.repeat(W + 1) + U_SEP_R)}`);
}

function wrapText(text, width) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= width) cur += " " + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function kv(label, value, labelCol = C_LABEL, valueCol = C_VALUE) {
  emit(`  ${labelCol(String(label).padEnd(16))}  ${valueCol(value)}`);
}
function kvOk(label, value = "") {
  emit(`  ${C_LABEL(String(label).padEnd(16))}  ${C_OK(U_OK)} ${C_VALUE(value)}`);
}
function kvNo(label, value = "") {
  emit(`  ${C_LABEL(String(label).padEnd(16))}  ${C_ERR(U_NO)} ${C_VALUE(value)}`);
}
function kvWarn(label, value = "") {
  emit(`  ${C_LABEL(String(label).padEnd(16))}  ${C_WARN(U_WARN)} ${C_VALUE(value)}`);
}
function wrapLine(text, col = C_VALUE) {
  for (const ln of wrapText(text, W - 4)) emit(`  ${col(ln)}`);
}

const outOk   = (m) => console.log(`  ${C_OK(U_OK)}  ${m}`);
const outNo   = (m) => console.log(`  ${C_ERR(U_NO)}  ${m}`);
const outWarn = (m) => console.log(`  ${C_WARN(U_WARN)}  ${m}`);
const outInfo = (m) => console.log(`  ${C_INFO(U_ARROW)}  ${m}`);

// ══════════════════════════════════════════════════════════════════
//  HEADERS
// ══════════════════════════════════════════════════════════════════
function browserHeaders() {
  return {
    "accept": "*/*",
    "accept-encoding": "gzip, deflate, br, zstd",
    "accept-language": "en-US,en;q=0.9",
    "cache-control": "no-cache",
    "content-type": "application/json",
    "origin": BASE_URL,
    "pragma": "no-cache",
    "priority": "u=1, i",
    "referer": `${BASE_URL}/`,
    "sec-ch-ua": '"Google Chrome";v="153", "Not_A Brand";v="8", "Chromium";v="153"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                  "AppleWebKit/537.36 (KHTML, like Gecko) " +
                  "Chrome/153.0.0.0 Safari/537.36",
  };
}

// ══════════════════════════════════════════════════════════════════
//  cURL PARSER
// ══════════════════════════════════════════════════════════════════
function parseCurl(text) {
  text = text.replace(/\\\r?\n/g, " ");

  let method = "POST";
  const mx = text.match(/-X\s+([A-Z]+)/);
  if (mx) method = mx[1].toUpperCase();
  else if (text.includes("--data") || /\s-d\s/.test(text)) method = "POST";

  let body = null;
  const patterns = [
    /--data-raw\s+'([^']*)'/,
    /--data-raw\s+"([^"]*)"/,
    /--data\s+'([^']*)'/,
    /-d\s+'([^']*)'/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) { body = m[1]; break; }
  }

  const headers = {};
  const hRe = /-H\s+'([^:]+):\s*([^']*)'/g;
  let hm;
  while ((hm = hRe.exec(text)) !== null) {
    headers[hm[1].trim()] = hm[2].trim();
  }

  return { method, headers, body };
}

function loadSaveRequest() {
  if (fs.existsSync(SAVE_CURL_FILE)) {
    const text = fs.readFileSync(SAVE_CURL_FILE, "utf-8");
    const { method, headers, body } = parseCurl(text);
    let bodyDict = null;
    if (body) {
      try { bodyDict = JSON.parse(body); }
      catch (e) { outWarn(`couldn't parse captured body: ${e.message}`); }
    }
    outInfo(`loaded /api/save from cURL ${C_SUB(`(method=${method})`)}`);
    return { method, headers, bodyDict, source: "curl" };
  }
  if (fs.existsSync(SAVE_TEMPLATE_FILE)) {
    const bodyDict = JSON.parse(fs.readFileSync(SAVE_TEMPLATE_FILE, "utf-8"));
    outInfo(`loaded /api/save from ${C_HEAD(SAVE_TEMPLATE_FILE)}`);
    return { method: null, headers: {}, bodyDict, source: "template" };
  }
  return { method: null, headers: {}, bodyDict: null, source: "fallback" };
}

// ══════════════════════════════════════════════════════════════════
//  PAYLOAD HELPERS
// ══════════════════════════════════════════════════════════════════
function personalize(body, userId, username) {
  if (!body) return null;
  const copy = JSON.parse(JSON.stringify(body));

  const walk = (n) => {
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n && typeof n === "object") {
      for (const k of Object.keys(n)) {
        const v = n[k];
        if (k === "owner" && typeof v === "string") n[k] = userId;
        else if (k === "name" && typeof v === "string" && v.length < 40) n[k] = username;
        else walk(v);
      }
    }
  };
  walk(copy);
  return copy;
}

function defaultOnboarding(userId, username) {
  return {
    fresh: true,
    owner: userId,
    replace: 0,
    game: {
      version: 1,
      phase: "play",
      owner: userId,
      home: "abjGwarinpa",
      origin: "lapo",
      location: "home",
      money: 1090000,
      sim: { name: username },
      skills: {
        cooking: 1, charisma: 1, fitness: 1, coding: 1,
        music: 1, hustle: 2, dance: 1, comedy: 1,
      },
      needs: { hunger: 80, energy: 85, hygiene: 75, bladder: 70, fun: 70, social: 60 },
      stats: {
        earnedToday: 0, earnedTotal: 0, socials: 0,
        dayStarted: 1014, actionsDone: {}, visited: [],
      },
      tutorialStep: 0,
      tour: "done",
      wishes: [],
      objects: [{ uid: "o1", type: "vono", x: 0, y: 0 }],
      pantry: { rice: 2, gino: 2, maggi: 6, oil: 4 },
      weather: "sunny",
      time: 1461280.5,
      music: true,
      sound: true,
      speed: 1,
    },
  };
}

// ══════════════════════════════════════════════════════════════════
//  SESSION (cookies via tough-cookie + axios)
// ══════════════════════════════════════════════════════════════════
function newSession() {
  const jar = new CookieJar();
  const client = wrapper(
    axios.create({
      jar,
      validateStatus: () => true,   // don't throw on 4xx/5xx
      timeout: 15000,
    })
  );
  return { jar, client };
}

function getCookieDict(jar, url) {
  try {
    const cookies = jar.getCookiesSync(url);
    const dict = {};
    for (const c of cookies) dict[c.key] = c.value;
    return dict;
  } catch {
    return {};
  }
}

// ══════════════════════════════════════════════════════════════════
//  HTTP CALLS
// ══════════════════════════════════════════════════════════════════
async function register(client, data) {
  try {
    const r = await client.post(REGISTER_ENDPOINT, data, {
      headers: browserHeaders(),
    });
    if (r.status === 200 || r.status === 201) {
      if (r.data && typeof r.data === "object") return { ok: true, data: r.data };
      return { ok: false, err: "invalid JSON" };
    }
    return { ok: false, err: `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, err: e.message };
  }
}

async function fetchMe(client) {
  for (const m of ["POST", "GET"]) {
    try {
      const cfg = { method: m, url: ME_ENDPOINT, headers: browserHeaders() };
      if (m === "POST") cfg.data = {};
      const r = await client.request(cfg);
      if (r.status === 200 && r.data && typeof r.data === "object") return r.data;
    } catch { /* try next method */ }
  }
  return null;
}

async function searchPlayers(client, query) {
  try {
    const r = await client.get(PLAYERS_ENDPOINT, {
      params: { q: query },
      headers: browserHeaders(),
    });
    if (r.status === 200) {
      const players = r.data && r.data.players;
      if (Array.isArray(players)) return { ok: true, players };
      return { ok: false, err: "invalid JSON" };
    }
    return { ok: false, err: `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, err: e.message };
  }
}

async function doSave(client, userId, username, cap) {
  const { method: capMethod, headers: capHeaders, bodyDict: capBody, source } = cap;

  let payload, methods;
  if (capBody) {
    payload = personalize(capBody, userId, username);
    methods = capMethod ? [capMethod] : SAVE_METHODS_TO_TRY.slice();
  } else {
    payload = defaultOnboarding(userId, username);
    methods = SAVE_METHODS_TO_TRY.slice();
  }

  // strip hop-by-hop / session-controlled headers from the captured cURL
  const extra = {};
  for (const [k, v] of Object.entries(capHeaders || {})) {
    const lk = k.toLowerCase();
    if (["content-length", "cookie", "host", "accept-encoding"].includes(lk)) continue;
    extra[k] = v;
  }

  let last = null;
  for (const m of methods) {
    try {
      const r = await client.request({
        method: m,
        url: SAVE_ENDPOINT,
        data: payload,
        headers: { ...browserHeaders(), ...extra },
      });
      if ([200, 201, 204].includes(r.status)) {
        const data = r.data && typeof r.data === "object" ? r.data : { ok: true };
        return { ok: true, data, method: m, source };
      }
      last = {
        method: m,
        status: r.status,
        body: (typeof r.data === "string" ? r.data : JSON.stringify(r.data || "")).slice(0, 300),
      };
    } catch (e) {
      last = { method: m, status: "err", body: e.message.slice(0, 120) };
    }
  }
  return { ok: false, meta: last, source };
}

async function sendGift(client, targetId) {
  try {
    const r = await client.post(
      SEND_ENDPOINT,
      { to: targetId, amount: DEMO_GIFT_AMOUNT },
      { headers: browserHeaders() }
    );
    const bodyText =
      typeof r.data === "string" ? r.data : JSON.stringify(r.data);

    if (r.status === 200 || r.status === 201) {
      if (r.data && typeof r.data === "object") return { gift: r.data, body: bodyText };
      return { gift: { raw: bodyText.slice(0, 200) }, body: bodyText };
    }

    let msg = null;
    if (r.data && typeof r.data === "object") {
      msg = r.data.error || r.data.message || r.data.detail;
    }
    const err = `HTTP ${r.status}` + (msg ? ` — ${msg}` : "");
    return { err, body: bodyText };
  } catch (e) {
    return { err: e.message, body: null };
  }
}

// ══════════════════════════════════════════════════════════════════
//  ACCOUNT GENERATION
// ══════════════════════════════════════════════════════════════════
function genPassword(length = 14) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789" +
    "!@#$%^&*()_+-=[]{}";
  let out = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

function genAccount() {
  const dob = faker.date.birthdate({ min: 18, max: 45, mode: "age" });
  const dobStr = dob.toISOString().slice(0, 10); // YYYY-MM-DD
  const userBase =
    (faker.internet.username ? faker.internet.username() : faker.internet.userName());
  return {
    username: userBase + Math.floor(Math.random() * 9900 + 100),
    password: genPassword(14),
    name: faker.person.fullName(),
    adult: true,
    born: dobStr,
  };
}

// ══════════════════════════════════════════════════════════════════
//  PLAYER DISPLAY / PICKER
// ══════════════════════════════════════════════════════════════════
function renderPlayers(players, query) {
  boxOpen(
    "Matching Players",
    `query: ${C_HEAD(query)}   ${C_SUB("·")}   ${C_SUB(`${players.length} result(s)`)}`
  );
  boxSep();
  players.forEach((p, i) => {
    const uname = p.username || "?";
    const name  = p.name || "";
    const loc   = p.location || "";
    const online = !!p.online;

    const dot = online ? `${C_OK(U_DOT)}` : `${C_SUB(U_DOT)}`;
    const idx = `${C_ACCENT(String(i + 1).padStart(2))}`;
    const head = `${C_HEAD("@" + uname)}`;
    const meta = `${C_LABEL(name)}  ${C_SUB("·")}  ${C_SUB(loc)}  ${dot}`;

    const pad = Math.max(
      1,
      W - 4 - _vlen(idx) - 1 - uname.length - 1 - _vlen(meta)
    );
    emit(`  ${idx}  ${head}${" ".repeat(pad)}${meta}`);
  });
  boxClose();
}

async function pickTarget(players, query, rl) {
  for (const p of players) {
    if ((p.username || "").toLowerCase() === query.toLowerCase()) {
      return { chosen: p, exact: true };
    }
  }
  if (!players.length) return { chosen: null, exact: false };

  renderPlayers(players, query);
  while (true) {
    const raw = (await question(rl,
      `  ${C_ACCENT(U_TRI)} ${C_INFO("select #")} ${C_SUB("(q to abort)")}  `
    )).trim();

    if (raw.toLowerCase() === "" || raw.toLowerCase() === "q" || raw.toLowerCase() === "quit") {
      return { chosen: null, exact: false };
    }
    const i = parseInt(raw, 10);
    if (!Number.isNaN(i) && i >= 1 && i <= players.length) {
      return { chosen: players[i - 1], exact: false };
    }
    outWarn("invalid selection");
  }
}

// ══════════════════════════════════════════════════════════════════
//  BANNER + PREFLIGHT
// ══════════════════════════════════════════════════════════════════
function banner() {
  console.log();
  console.log(`  ${C_ACCENT("═".repeat(W + 3))}`);
  console.log(
    `  ${C_ACCENT(U_BAR)}  ${C_HEAD(B("BENFEITECH"))}  ` +
    `${C_SUB("·")}  ${C_INFO("Authorized Security Test Harness")}`
  );
  console.log(`  ${C_ACCENT("═".repeat(W + 3))}`);
  console.log(
    `  ${C_WARN(U_WARN)} ${D("For testing your own application only.")}`
  );
  console.log();
}

function preflight(source) {
  if (source === "fallback") {
    boxOpen(
      "⚠  NO CAPTURED /api/save PAYLOAD FOUND",
      "the fallback payload typically returns 200 on /save"
    );
    boxSep();
    wrapLine(
      "Your server accepts the fallback but does NOT actually qualify " +
      "the account — so /api/send will return 400.",
      C_WARN
    );
    boxSep();
    kv("fix", "capture a real /api/save request", C_LABEL, C_HEAD);
    kv("where", "DevTools → Network → filter: save");
    kv("how", "right-click → Copy as cURL");
    kv("save as", "save_request.txt", C_LABEL, C_HIGH);
    boxClose();
    console.log();
  }
}

// ══════════════════════════════════════════════════════════════════
//  INPUT
// ══════════════════════════════════════════════════════════════════
function question(rl, prompt) {
  return new Promise((resolve) => rl.question(prompt, (a) => resolve(a)));
}

async function ask(rl, prompt, def = null) {
  const suffix = def ? `  ${C_SUB(`(${def})`)}` : "";
  const raw = await question(
    rl,
    `  ${C_ACCENT(U_TRI)} ${C_INFO(prompt)}${suffix}  `
  );
  const v = raw.trim();
  return v || def || "";
}

/// ==============================================================
// ACCOUNT REPORT
// ==============================================================
function renderAccount(
  idx, total, data, userId, meBefore, meAfter,
  saveOk, saveMethod, saveErr,
  gift, giftErr
) {
  boxOpen(
    `Account ${idx} of ${total}`,
    `${C_SUB("register → me → save → me → send")}`
  );
  boxSep();
  kv("username", data.username, C_LABEL, C_HEAD);
  kv("password", data.password);
  kv("name",     data.name);
  kv("born",     data.born);
  kv("user id", userId || "—", C_LABEL, userId ? C_OK : C_ERR);

  if (meAfter && meAfter.user) {
    const u = meAfter.user;
    for (const flag of ["qualified", "verified", "giftPark", "gift_park",
                        "tour", "onboarded", "active"]) {
      if (flag in u) kv(`user.${flag}`, String(u[flag]));
    }
  }
  boxSep();

  kvOk("register", userId ? "ok" : "");
  if (meBefore) kvOk("me (before)", "session valid");
  else          kvWarn("me (before)", "no response");

  if (saveOk) kvOk("save", `200 ${C_SUB(`(${saveMethod})`)}`);
  else        kvNo("save", saveErr || "");

  if (meAfter !== null)     kvOk("me (after)", "refreshed");
  else if (saveOk)          kvWarn("me (after)", "no response");

  if (gift) {
    kvOk("send", "gift delivered");
    boxSep();
    kv("gift id", gift.id || "—", C_LABEL, C_HIGH);
    kv("amount", (gift.amount ??
DEMO_GIFT_AMOUNT).toLocaleString(), C_LABEL, C_OK);
    kv("fee", String(gift.fee ?? "—"), C_LABEL, C_LABEL);
  } else {
    kvNo("send", giftErr || "");
  }
  boxClose();
}

function renderSummary(results, target, source) {
  boxOpen(
    "Summary",
    `target ${C_HEAD("@" + (target.username || "?"))} ` +
    `${C_SUB(`(${target.id || "?"})`)}`
  );
  boxSep();

  const total  = results.length;
  const regN   = results.filter((r) => r.user_id).length;
  const savedN = results.filter((r) =>
r.save_response).length;
  const sentN  = results.filter((r) => r.gift_response).length;

  kv("save source", source, C_LABEL,
    ["curl", "template"].includes(source) ? C_OK : C_WARN);
  kv("accounts created",   `${regN} / ${total}`,
    C_LABEL, regN === total ? C_OK : C_WARN);
  kv("accounts qualified", `${savedN} / ${total}`,
    C_LABEL, savedN === total ? C_OK : C_WARN);
  kv("gifts sent",         `${sentN} / ${total}`,
    C_LABEL, sentN ? C_OK : C_ERR);

  const amt = results.reduce((acc, r) => {
    const g = r.gift_response;
    return acc + (g && typeof g === "object" ? (g.amount ||
0) : 0);
  }, 0);
  if (amt) {
    boxSep();
    kv("demo value moved", amt.toLocaleString(), C_LABEL,
C_HIGH);
  }

  if (sentN === 0) {
    const lastErr = [...results].reverse()
      .find((r) => r.gift_error_body)?.gift_error_body;
    if (lastErr) {
      boxSep();
      wrapLine("last /send error body:", C_ERR);
      for (const ln of wrapText(lastErr, W - 4)) emit(`  ${C_ERR(ln)}`);
    }
  }
  boxClose();
}

// ==============================================================
// MAIN
// ==============================================================
async function main() {
  banner();

  const cap = loadSaveRequest();
  preflight(cap.source);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log();
    const targetQuery = await ask(rl, "target username to gift");
    if (!targetQuery) { outNo("no username provided"); return; }

    let count;
    try {
      count = parseInt(await ask(rl, "number of accounts to create", "1"), 10);
      if (!Number.isFinite(count) || count <= 0) throw new Error();
    } catch {
      outNo("invalid account count");
      return;
    }

    const results = [];
    let target = null;

    for (let i = 1; i <= count; i++) {
      console.log();
      const data = genAccount();

      console.log(
        ` ${C_ACCENT(U_DIAMOND)} ${C_HEAD(`Account ${i} of ${count}`)} ` +
        `${C_SUB("· registering")}`
      );

      const { jar, client } = newSession();

      const reg = await register(client, data);
      if (!reg.ok) {
        outNo(`register failed — ${reg.err}`);
        results.push({
          username: data.username,
          password: data.password,
          user_id: null,
          cookies: {},
          save_response: null,
          gift_response: null,
          gift_error_body: null,
          note: "register failed",
        });
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      const userId = (reg.data.user && reg.data.user.id) || reg.data.id;
      outOk(`registered ${C_SUB(`id=${userId}`)}`);

      // ── first account → find target ──
      if (target === null) {
        outInfo(`searching players for ${C_HEAD(targetQuery)} ...`);
        const sp = await searchPlayers(client, targetQuery);
        if (!sp.ok) { outNo(`search failed — ${sp.err}`); return; }
        if (!sp.players.length) { outWarn("no players matched — aborting"); return; }

        const pick = await pickTarget(sp.players, targetQuery, rl);
        if (!pick.chosen) { outNo("no target selected — aborting"); return; }
        target = pick.chosen;

        const tag = pick.exact ? "exact match" : "selected";
        outOk(
          `${tag}: ${C_HEAD("@" + target.username)} ` +
          `${C_SUB(`(${target.id})`)}`
        );
      }

      const meBefore = await fetchMe(client);

      const sv = await doSave(client, userId, data.username, cap);
      let saveMethod = "", saveErr = null;
      if (!sv.ok) {
        if (sv.meta) {
          saveMethod = sv.meta.method || "";
          saveErr = `${sv.meta.status} ${sv.meta.body || ""}`;
        } else {
          saveErr = "unknown error";
        }
      } else {
        saveMethod = sv.method;
      }

      const meAfter = sv.ok ? await fetchMe(client) : null;

      let gift = null, giftErr = null, giftBody = null;
      if (sv.ok) {
        await new Promise((r) => setTimeout(r, 1200));
        const s = await sendGift(client, target.id);
        gift = s.gift || null;
        giftErr = s.err || null;
        giftBody = s.body || null;
      } else {
        giftErr = "skipped — not qualified";
      }

      renderAccount(
        i, count, data, userId, meBefore, meAfter,
        sv.ok, saveMethod, saveErr,
        gift, giftErr
      );

      results.push({
        username: data.username,
        password: data.password,
        user_id: userId,
        cookies: getCookieDict(jar, BASE_URL),
        me_before: meBefore,
        me_after: meAfter,
        save_response: sv.ok,
        save_method: saveMethod,
        save_source: cap.source,
        gift_response: gift,
        gift_error: giftErr,
        gift_error_body: giftBody,
      });

      await new Promise((r) => setTimeout(r, 1000));
    }

    console.log();
    renderSummary(results, target || { username: "—", id: "—" }, cap.source);

    const outFile = "automation_test_results.json";
    fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
    console.log();
    outInfo(`full results saved to ${C_HEAD(outFile)}`);
    console.log();
  } finally {
    rl.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});