/* ================================================
   ShiftFlow — backend server
   Zero dependencies — just Node's built-in http/fs.
   Run with:  node server.js
   Then open: http://localhost:3000

   Serves the frontend files and a small REST API,
   persisting everything to data.json on disk so it
   survives restarts.
   ================================================ */
const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, "data.json");

const STATIC_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

/* ---------- storage helpers ---------- */
var DEFAULT_STATE = {
  orgType: null, team: [], duties: {}, churchAssignments: {}, swaps: [],
  attendance: [], chat: { general: [], schedule: [], announcements: [] }, announcements: []
};
function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (err) {
    // Missing or corrupt data.json — don't crash the server, start fresh.
    console.warn("data.json missing or invalid, starting from an empty state:", err.message);
    writeData(DEFAULT_STATE);
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}
function writeData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to write data.json:", err.message);
  }
}

/* ---------- request body helper ---------- */
function readBody(req) {
  return new Promise((resolve) => {
    var chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}
function sendJson(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

/* ---------- static file serving ---------- */
function serveStatic(req, res, pathname) {
  var filePath = pathname === "/" ? "/index.html" : pathname;
  var fullPath = path.join(ROOT, filePath);
  if (!fullPath.startsWith(ROOT)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.readFile(fullPath, (err, content) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    var ext = path.extname(fullPath);
    res.writeHead(200, { "Content-Type": STATIC_TYPES[ext] || "application/octet-stream" });
    res.end(content);
  });
}

/* ---------- API routing ---------- */
async function handleApi(req, res, pathname) {
  var parts = pathname.split("/").filter(Boolean); // ["api", "workers", "3"]
  var resource = parts[1];
  var data = readData();

  if (resource === "state" && req.method === "GET") {
    return sendJson(res, 200, data);
  }

  if (resource === "org" && req.method === "POST") {
    var orgBody = await readBody(req);
    data.orgType = orgBody.orgType;
    writeData(data);
    return sendJson(res, 200, { orgType: data.orgType });
  }

  if (resource === "workers" && parts.length === 2 && req.method === "POST") {
    var wBody = await readBody(req);
    var nextId = data.team.reduce((max, w) => Math.max(max, w.id), 0) + 1;
    var worker = {
      id: nextId,
      name: String(wBody.name || "").slice(0, 80),
      role: String(wBody.role || "").slice(0, 60),
      on: wBody.status === "on",
      email: String(wBody.email || "").slice(0, 120),
      pin: String(wBody.pin || "").slice(0, 8)
    };
    data.team.unshift(worker);
    writeData(data);
    return sendJson(res, 200, worker);
  }

  if (resource === "workers" && parts[3] === "pin" && req.method === "POST") {
    var pinBody = await readBody(req);
    var pinWorkerId = Number(parts[2]);
    var pinWorker = data.team.find((w) => w.id === pinWorkerId);
    if (!pinWorker) return sendJson(res, 404, { error: "not found" });
    pinWorker.pin = String(pinBody.pin || "").slice(0, 8);
    writeData(data);
    return sendJson(res, 200, pinWorker);
  }

  if (resource === "workers" && req.method === "DELETE") {
    var delId = Number(parts[2]);
    data.team = data.team.filter((w) => w.id !== delId);
    delete data.duties[delId];
    writeData(data);
    return sendJson(res, 200, { removed: delId });
  }

  if (resource === "duties" && req.method === "POST") {
    var dBody = await readBody(req);
    if (!data.duties[dBody.workerId]) data.duties[dBody.workerId] = {};
    data.duties[dBody.workerId][dBody.day] = dBody.duty;
    writeData(data);
    return sendJson(res, 200, dBody);
  }

  if (resource === "church-assignments" && req.method === "POST") {
    var caBody = await readBody(req);
    if (!data.churchAssignments) data.churchAssignments = {};
    if (!data.churchAssignments[caBody.duty]) data.churchAssignments[caBody.duty] = {};
    data.churchAssignments[caBody.duty][caBody.service] = caBody.workerId;
    writeData(data);
    return sendJson(res, 200, caBody);
  }

  if (resource === "announcements" && req.method === "POST") {
    var anBody = await readBody(req);
    if (!Array.isArray(data.announcements)) data.announcements = [];
    data.announcements.unshift(anBody);
    writeData(data);
    return sendJson(res, 200, anBody);
  }

  if (resource === "swaps" && parts.length === 2 && req.method === "POST") {
    var newSwapBody = await readBody(req);
    var nextSwapId = data.swaps.reduce((max, s) => Math.max(max, s.id || 0), 0) + 1;
    var newSwap = {
      id: nextSwapId,
      from: String(newSwapBody.from || "").slice(0, 80),
      fromShift: String(newSwapBody.fromShift || "").slice(0, 120),
      to: String(newSwapBody.to || "").slice(0, 80),
      toShift: String(newSwapBody.toShift || "").slice(0, 120),
      status: "pending"
    };
    data.swaps.unshift(newSwap);
    writeData(data);
    return sendJson(res, 200, newSwap);
  }

  if (resource === "swaps" && parts.length === 3 && req.method === "POST") {
    var sBody = await readBody(req);
    var swapId = Number(parts[2]);
    var swap = data.swaps.find((s) => s.id === swapId);
    if (!swap) return sendJson(res, 404, { error: "not found" });
    swap.status = sBody.status;
    writeData(data);
    return sendJson(res, 200, swap);
  }

  if (resource === "attendance" && req.method === "POST") {
    var aBody = await readBody(req);
    data.attendance.unshift(aBody);
    writeData(data);
    return sendJson(res, 200, aBody);
  }

  if (resource === "chat" && req.method === "POST") {
    var channel = parts[2];
    var cBody = await readBody(req);
    if (!data.chat[channel]) data.chat[channel] = [];
    data.chat[channel].push(cBody);
    writeData(data);
    return sendJson(res, 200, cBody);
  }

  sendJson(res, 404, { error: "unknown endpoint" });
}

/* ---------- server ---------- */
// CORS: allows the frontend to be hosted separately from this backend
// (e.g. static files on GitHub Pages, API here on a Node host) without
// every fetch() silently failing. Since this is a small internal tool
// with its own PIN-based worker gate rather than real auth, allowing any
// origin is a reasonable tradeoff for "it just works" — tighten this to
// a specific origin if that ever matters for your deployment.
function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const server = http.createServer((req, res) => {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  var parsed = url.parse(req.url);
  var pathname = decodeURIComponent(parsed.pathname);

  if (pathname.startsWith("/api/")) {
    handleApi(req, res, pathname).catch((err) => {
      sendJson(res, 500, { error: String(err) });
    });
  } else if (req.method === "GET") {
    serveStatic(req, res, pathname);
  } else {
    res.writeHead(405);
    res.end("Method not allowed");
  }
});

server.listen(PORT, () => {
  console.log("ShiftFlow backend running at http://localhost:" + PORT);
});
