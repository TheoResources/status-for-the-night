# status-for-the-night

Public overnight status page and JSON API for service `sched-prod` (owner: `rune`).

Built for MEGA Challenge **S03E01** (`status for the night`).

## Requirements Implemented

- **`R-H9M`**: Heading reads exact words `status for the night`.
- **`R-M8Z`**: `/status.json` responds with `Access-Control-Allow-Origin: *`.
- **`R-H4X`**: Every status JSON carries `updatedAt` in UTC ending in `Z`.
- **`R-Z5H`**: `/status.json` sends `Cache-Control: public, max-age=30`.
- **`R-K9R`**: Newest incidents displayed at the top.
- **`R-K5H`**: Each incident names who ran it (`author` / runner).
- **`R-H2L`**: Last night only; older incidents (e.g. from previous shifts) are filtered out.
- **`R-Z8K`**: Dates formatted month-first: `10/12` (`MM/DD`), times in 24-hour form `HH:MM`.
- **`R-L9X`**: Lines status overview table giving every line its own row (`tram 3`, `bus 14`, `night bus N2`, `sched-prod`).
- **`R-K6X`**: Status page indicates `"shown on tram 3 boards"`.
- **`R-Z4M`**: Footer states `"All times UTC"`.
- **`R-R8X`**: Accent color styled in teal `#1F9E8F`.
- **`R-R6H`**: Live data read on demand from the upstream ops feed (`https://hq.mega.dev/challenges/status-for-the-night/api/incidents/7a5169564388`).

## Endpoints

- `GET /` — Responsive public HTML status page.
- `GET /status.json` — Machine-readable status JSON matching the ops feed schema with CORS and caching headers.

## Running Locally

```bash
# Start server
npm start

# Run test suite
npm test
```
