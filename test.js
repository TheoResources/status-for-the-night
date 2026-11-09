import assert from "node:assert";
import { createServer, processStatusData } from "./server.js";

const mockFeed = {
  updatedAt: "2026-11-09T18:00:00Z",
  incidents: [
    { id: "5208", line: "bus 14", opened: "2026-10-10T23:30:00Z", closed: "2026-10-10T23:44:00Z", what: "stop names out of date", author: "night shift" },
    { id: "5209", line: "night bus N2", opened: "2026-10-11T23:20:00Z", closed: "2026-10-11T23:36:00Z", what: "gps gaps", author: "on-call" },
    { id: "5210", line: "tram 3", opened: "2026-10-12T00:45:00Z", closed: "2026-10-12T01:02:00Z", what: "platform display lag", author: "on-call" },
    { id: "5211", line: "bus 14", opened: "2026-10-12T01:50:00Z", closed: "2026-10-12T02:05:00Z", what: "feed timeout", author: "night shift" },
    { id: "5212", line: "tram 3", opened: "2026-10-12T02:40:00Z", closed: "2026-10-12T02:52:00Z", what: "board refresh stuck", author: "on-call" },
    { id: "5213", line: "night bus N2", opened: "2026-10-12T03:15:00Z", closed: "2026-10-12T03:29:00Z", what: "rota sync retries", author: "night shift" },
    { id: "5214", line: "sched-prod", opened: "2026-10-12T03:48:00Z", closed: "2026-10-12T04:04:00Z", what: "schedule rebuild", author: "—" }
  ]
};

// 1. Test data processing unit logic
console.log("Running unit tests on data processing...");
const processed = processStatusData(mockFeed);

// R-H4X & R-R6H: updatedAt matches feed and ends with Z
assert.strictEqual(processed.updatedAt, "2026-11-09T18:00:00Z");
assert.ok(processed.updatedAt.endsWith("Z"), "updatedAt must end in Z");

// R-H2L: Last night only (filtered 5208 and 5209)
assert.strictEqual(processed.incidents.length, 5, "Must keep last night only");
assert.strictEqual(processed.incidents.every(i => i.date === "10/12"), true, "All dates must be 10/12 (month first)");

// R-K9R: Newest incident at top
assert.strictEqual(processed.incidents[0].id, "5214", "Newest incident must be at top");
assert.strictEqual(processed.incidents[processed.incidents.length - 1].id, "5210", "Oldest incident must be at bottom");

// R-K5H: author names who ran it
assert.strictEqual(processed.incidents[0].author, "—");
assert.strictEqual(processed.incidents[1].author, "night shift");
assert.strictEqual(processed.incidents[2].author, "on-call");

// R-L9X: Each line has a row
const lineNames = processed.lines.map(l => l.line);
assert.ok(lineNames.includes("tram 3"), "Must include tram 3");
assert.ok(lineNames.includes("bus 14"), "Must include bus 14");
assert.ok(lineNames.includes("night bus N2"), "Must include night bus N2");
assert.ok(lineNames.includes("sched-prod"), "Must include sched-prod");

// R-K6X: tram 3 has shownOnBoards
const tram3 = processed.lines.find(l => l.line === "tram 3");
assert.strictEqual(tram3.shownOnBoards, true, "tram 3 must indicate boards notice");

console.log("Unit tests passed!");

// 2. Test server endpoints
console.log("Running integration tests on HTTP server...");
const server = createServer();
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

try {
  // Test /status.json
  const jsonRes = await fetch(`${baseUrl}/status.json`);
  assert.strictEqual(jsonRes.status, 200, "status.json must return 200");
  
  // R-M8Z: CORS Access-Control-Allow-Origin: *
  assert.strictEqual(jsonRes.headers.get("access-control-allow-origin"), "*", "CORS header must be *");
  
  // R-Z5H: Cache-Control max-age=30
  const cacheControl = jsonRes.headers.get("cache-control") || "";
  assert.ok(cacheControl.includes("max-age=30"), `Cache-Control must contain max-age=30, got: ${cacheControl}`);

  const jsonBody = await jsonRes.json();
  assert.ok(jsonBody.updatedAt && jsonBody.updatedAt.endsWith("Z"), "JSON updatedAt must end in Z");
  assert.ok(Array.isArray(jsonBody.incidents), "JSON incidents must be an array");
  assert.strictEqual(jsonBody.incidents[0].id, "5214", "Top incident in status.json must be 5214");

  // Test /
  const htmlRes = await fetch(`${baseUrl}/`);
  assert.strictEqual(htmlRes.status, 200, "HTML page must return 200");
  const htmlBody = await htmlRes.text();

  // R-H9M: Heading exact words
  assert.ok(htmlBody.includes("status for the night"), "Must contain 'status for the night'");

  // R-R8X: Teal accent color
  assert.ok(htmlBody.includes("#1F9E8F"), "Must contain teal #1F9E8F");

  // R-K6X: say 'shown on tram 3 boards'
  assert.ok(htmlBody.includes("shown on tram 3 boards"), "Must contain 'shown on tram 3 boards'");

  // R-Z4M: Footer: All times UTC
  assert.ok(htmlBody.includes("All times UTC"), "Must contain footer 'All times UTC'");

  // R-Z8K: Month first date format
  assert.ok(htmlBody.includes("10/12"), "Must contain date formatted 10/12");

  console.log("All integration tests passed successfully!");
} finally {
  server.close();
}
