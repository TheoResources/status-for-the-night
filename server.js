import http from "node:http";

const PORT = process.env.PORT || 3000;
const OPS_FEED_URL = process.env.OPS_FEED_URL || "https://hq.mega.dev/challenges/status-for-the-night/api/incidents/7a5169564388";

export async function fetchOpsFeed() {
  const res = await fetch(OPS_FEED_URL, {
    headers: { "Accept": "application/json" }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ops feed: ${res.status} ${res.statusText}`);
  }
  return await res.json();
}

export function processStatusData(feed) {
  // R-H4X & R-R6H: updatedAt in UTC ending in Z, read live from ops feed
  let updatedAt = feed.updatedAt || new Date().toISOString();
  if (!updatedAt.endsWith("Z")) {
    updatedAt = new Date(updatedAt).toISOString();
  }

  const allIncidents = [...(feed.incidents || [])];
  if (allIncidents.length === 0) {
    return { updatedAt, incidents: [], lines: [] };
  }

  // Sort chronologically
  allIncidents.sort((a, b) => new Date(a.opened).getTime() - new Date(b.opened).getTime());

  // R-H2L: Last night only. Nothing older stays on the page.
  // Overnight shifts span across midnight (e.g. 23:00 to 06:00).
  // Any gap between incidents > 10 hours marks an earlier shift/night.
  const lastNightIncidents = [];
  if (allIncidents.length > 0) {
    for (let i = allIncidents.length - 1; i >= 0; i--) {
      if (i === allIncidents.length - 1) {
        lastNightIncidents.unshift(allIncidents[i]);
      } else {
        const currentOpened = new Date(allIncidents[i].opened).getTime();
        const nextOpened = new Date(allIncidents[i + 1].opened).getTime();
        if (nextOpened - currentOpened > 10 * 3600 * 1000) {
          // Incident belongs to an older shift/night
          break;
        }
        lastNightIncidents.unshift(allIncidents[i]);
      }
    }
  }

  // R-K9R: Newest incident at the top
  lastNightIncidents.sort((a, b) => new Date(b.opened).getTime() - new Date(a.opened).getTime());

  // Format rows: R-Z8K (Month first: MM/DD), HH:MM (24-hour), R-K5H (author)
  const incidents = lastNightIncidents.map(inc => {
    const openedDate = new Date(inc.opened);
    const closedDate = inc.closed ? new Date(inc.closed) : null;

    const month = String(openedDate.getUTCMonth() + 1).padStart(2, "0");
    const day = String(openedDate.getUTCDate()).padStart(2, "0");
    const dateFormatted = `${month}/${day}`;

    const openedHH = String(openedDate.getUTCHours()).padStart(2, "0");
    const openedMM = String(openedDate.getUTCMinutes()).padStart(2, "0");
    const openedFormatted = `${openedHH}:${openedMM}`;

    let closedFormatted = "—";
    if (closedDate) {
      const closedHH = String(closedDate.getUTCHours()).padStart(2, "0");
      const closedMM = String(closedDate.getUTCMinutes()).padStart(2, "0");
      closedFormatted = `${closedHH}:${closedMM}`;
    }

    return {
      id: String(inc.id),
      line: inc.line,
      opened: inc.opened,
      closed: inc.closed || null,
      what: inc.what,
      author: inc.author && inc.author !== "—" ? inc.author : "—",
      date: dateFormatted,
      openedTime: openedFormatted,
      closedTime: closedFormatted
    };
  });

  // R-L9X: Every line gets its own row on the page, tram 3 included.
  const standardLines = ["tram 3", "bus 14", "night bus N2", "sched-prod"];
  const seenLines = new Set(standardLines);
  for (const inc of incidents) {
    if (inc.line) seenLines.add(inc.line);
  }

  const lines = Array.from(seenLines).map(lineName => {
    const forLine = incidents.filter(i => i.line === lineName);
    const latestForLine = forLine[0];
    const isDelayed = forLine.some(i => !i.closed);
    return {
      line: lineName,
      status: isDelayed ? "delayed" : "running",
      lastIncident: latestForLine ? latestForLine.what : "none",
      shownOnBoards: lineName === "tram 3" // R-K6X
    };
  });

  return { updatedAt, incidents, lines };
}

export function renderHtml({ updatedAt, incidents, lines }) {
  const linesRows = lines.map(l => `
    <tr>
      <td class="line-name">
        <strong>${escapeHtml(l.line)}</strong>
        ${l.shownOnBoards ? '<span class="pill pill-boards">shown on tram 3 boards</span>' : ''}
      </td>
      <td>
        <span class="status-indicator status-${escapeHtml(l.status)}">
          <span class="dot"></span> ${escapeHtml(l.status)}
        </span>
      </td>
      <td class="last-incident">${escapeHtml(l.lastIncident)}</td>
    </tr>
  `).join("");

  const incidentRows = incidents.map(inc => `
    <tr>
      <td class="date-col">${escapeHtml(inc.date)}</td>
      <td class="time-col">${escapeHtml(inc.openedTime)}</td>
      <td class="time-col">${escapeHtml(inc.closedTime)}</td>
      <td class="line-col">${escapeHtml(inc.line)}</td>
      <td class="what-col">${escapeHtml(inc.what)}</td>
      <td class="who-col">${escapeHtml(inc.author)}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>status for the night · sched-prod</title>
  <style>
    :root {
      --teal: #1F9E8F;
      --teal-light: #e6f6f4;
      --teal-dark: #167a6e;
      --bg: #f8fafc;
      --surface: #ffffff;
      --text: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --border-dark: #cbd5e1;
      --green: #10b981;
      --green-bg: #d1fae5;
      --amber: #f59e0b;
      --amber-bg: #fef3c7;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 0 0 40px 0;
    }

    header {
      background-color: var(--teal);
      color: #ffffff;
      padding: 24px 20px;
      margin-bottom: 32px;
      border-bottom: 3px solid var(--teal-dark);
      box-shadow: 0 2px 4px rgba(0,0,0,0.06);
    }

    .container {
      max-width: 960px;
      margin: 0 auto;
      padding: 0 20px;
    }

    .header-content {
      max-width: 960px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .service-tag {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      opacity: 0.85;
      font-weight: 600;
    }

    h1 {
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #ffffff;
      margin: 0;
    }

    .subheading {
      font-size: 1.1rem;
      color: var(--text);
      margin-bottom: 24px;
      font-weight: 500;
    }

    .banner-notice {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--teal-light);
      border: 1px solid var(--teal);
      color: var(--teal-dark);
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 0.9rem;
      font-weight: 600;
      margin-bottom: 24px;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 20px 24px;
      margin-bottom: 28px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }

    .card-title {
      font-size: 1rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.95rem;
    }

    th {
      padding: 10px 14px;
      background: #f1f5f9;
      color: var(--text-muted);
      font-weight: 600;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border-bottom: 2px solid var(--border-dark);
    }

    td {
      padding: 12px 14px;
      border-bottom: 1px solid var(--border);
      vertical-align: middle;
    }

    tr:last-child td {
      border-bottom: none;
    }

    .line-name {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .pill {
      font-size: 0.75rem;
      padding: 2px 8px;
      border-radius: 9999px;
      font-weight: 600;
      white-space: nowrap;
    }

    .pill-boards {
      background: var(--teal-light);
      color: var(--teal-dark);
      border: 1px solid var(--teal);
    }

    .status-indicator {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 12px;
    }

    .status-running {
      background: var(--green-bg);
      color: #065f46;
    }

    .status-running .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: var(--green);
    }

    .status-delayed {
      background: var(--amber-bg);
      color: #92400e;
    }

    .status-delayed .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: var(--amber);
    }

    .date-col, .time-col {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.9rem;
    }

    .json-link {
      display: inline-block;
      margin-top: 10px;
      font-size: 0.85rem;
      color: var(--teal);
      text-decoration: none;
      font-weight: 600;
    }

    .json-link:hover {
      text-decoration: underline;
    }

    footer {
      margin-top: 32px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
      text-align: center;
      color: var(--text-muted);
      font-size: 0.85rem;
    }

    .meta-bar {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: 6px;
    }
  </style>
</head>
<body>
  <header>
    <div class="header-content">
      <div class="service-tag">service: sched-prod · owner: rune</div>
      <h1>status for the night</h1>
    </div>
  </header>

  <main class="container">
    <p class="subheading">Some services had problems overnight.</p>

    <div class="banner-notice">
      <span>shown on tram 3 boards</span>
    </div>

    <!-- Lines Status Overview (R-L9X) -->
    <section class="card">
      <div class="card-title">
        <span>Lines Overview</span>
      </div>
      <table class="lines-table">
        <thead>
          <tr>
            <th>line</th>
            <th>now</th>
            <th>last incident</th>
          </tr>
        </thead>
        <tbody>
          ${linesRows}
        </tbody>
      </table>
    </section>

    <!-- Incident Details (R-K9R, R-Z8K, R-K5H, R-H2L) -->
    <section class="card">
      <div class="card-title">
        <span>Overnight Incidents</span>
        <a class="json-link" href="/status.json" target="_blank">raw status.json</a>
      </div>
      <table class="incidents-table">
        <thead>
          <tr>
            <th>date</th>
            <th>opened</th>
            <th>closed</th>
            <th>line</th>
            <th>what</th>
            <th>who</th>
          </tr>
        </thead>
        <tbody>
          ${incidentRows}
        </tbody>
      </table>
      <div class="meta-bar">
        Data read live from ops feed · Feed timestamp: ${escapeHtml(updatedAt)}
      </div>
    </section>

    <!-- Footer (R-Z4M) -->
    <footer>
      <p>All times UTC</p>
    </footer>
  </main>
</body>
</html>`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "*"
      });
      res.end();
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { "Content-Type": "text/plain" });
      res.end("Method Not Allowed");
      return;
    }

    try {
      if (url.pathname === "/status.json") {
        const feed = await fetchOpsFeed();
        const data = processStatusData(feed);

        // Required headers
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*", // R-M8Z
          "Cache-Control": "public, max-age=30" // R-Z5H
        });

        // Spec: status.json fields: updatedAt (when the data was read) and incidents (the rows)
        const payload = JSON.stringify({
          updatedAt: data.updatedAt,
          incidents: data.incidents
        }, null, 2);

        res.end(payload);
        return;
      }

      if (url.pathname === "/" || url.pathname === "/index.html") {
        const feed = await fetchOpsFeed();
        const data = processStatusData(feed);
        const html = renderHtml(data);

        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=30"
        });
        res.end(html);
        return;
      }

      // 404 for other routes
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    } catch (err) {
      console.error("Request error:", err);
      res.writeHead(500, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      });
      res.end(JSON.stringify({ error: err.message || "Internal Server Error" }));
    }
  });
}

// Start server if executed directly
if (process.argv[1] && process.argv[1].endsWith("server.js")) {
  const server = createServer();
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Status page server listening on http://0.0.0.0:${PORT}`);
  });
}
