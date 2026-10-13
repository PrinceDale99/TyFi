// Pulls live TyFi analytics from PostHog with HogQL and prints them as JSON.
// Needs POSTHOG_PERSONAL_API_KEY (phx_..., scope query:read) and POSTHOG_PROJECT_ID,
// read from the environment or functions/.env.
// Usage: node functions/scripts/posthogReport.mjs [days=30]
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
const projectId = process.env.POSTHOG_PROJECT_ID;
// The ingestion host (us.i.posthog.com) does not serve the query API; the app host does.
const host = (process.env.POSTHOG_APP_HOST || process.env.POSTHOG_HOST || 'https://us.posthog.com')
  .replace('.i.posthog.com', '.posthog.com')
  .replace(/\/$/, '');
const days = Number(process.argv[2] ?? 30);

if (!apiKey || !projectId) {
  console.error('Missing POSTHOG_PERSONAL_API_KEY or POSTHOG_PROJECT_ID (env or functions/.env).');
  process.exit(1);
}

const FUNNEL = [
  'tyfi_landing_page_viewed',
  'wallet_connection_attempted',
  'wallet_connection_successful',
  'vault_deposit_initiated',
  'transaction_signed',
  'transaction_confirmed',
];

const since = `timestamp > now() - INTERVAL ${days} DAY`;
const QUERIES = {
  totals: `SELECT count() AS events, count(DISTINCT person_id) AS users, count(DISTINCT properties.$session_id) AS sessions FROM events WHERE ${since}`,
  daily_active_users: `SELECT toDate(timestamp) AS day, count(DISTINCT person_id) AS users, count() AS events FROM events WHERE ${since} GROUP BY day ORDER BY day`,
  events: `SELECT event, count() AS total, count(DISTINCT person_id) AS users FROM events WHERE ${since} GROUP BY event ORDER BY total DESC LIMIT 100`,
  funnel_reach: `SELECT event, count(DISTINCT person_id) AS users FROM events WHERE ${since} AND event IN (${FUNNEL.map((e) => `'${e}'`).join(', ')}) GROUP BY event`,
  wallet_types: `SELECT properties.wallet_type AS wallet_type, countIf(event = 'wallet_connection_attempted') AS attempted, countIf(event = 'wallet_connection_successful') AS successful, countIf(event = 'wallet_connection_failed') AS failed FROM events WHERE ${since} AND event LIKE 'wallet_connection_%' GROUP BY wallet_type ORDER BY attempted DESC`,
  wallet_failures: `SELECT properties.error_code AS error_code, properties.user_rejected AS user_rejected, count() AS total FROM events WHERE ${since} AND event = 'wallet_connection_failed' GROUP BY error_code, user_rejected ORDER BY total DESC LIMIT 20`,
  transactions_by_action: `SELECT properties.action AS action, countIf(event = 'transaction_signed') AS signed, countIf(event = 'transaction_confirmed') AS confirmed, countIf(event = 'transaction_failed') AS failed, sumIf(toFloat(properties.amount_xlm), event = 'transaction_confirmed') AS confirmed_xlm, countIf(event = 'transaction_confirmed' AND properties.sponsored_fee = 'true') AS sponsored FROM events WHERE ${since} AND event IN ('transaction_signed', 'transaction_confirmed', 'transaction_failed') GROUP BY action ORDER BY confirmed DESC`,
  transaction_failures: `SELECT properties.stage AS stage, properties.action AS action, count() AS total FROM events WHERE ${since} AND event = 'transaction_failed' GROUP BY stage, action ORDER BY total DESC LIMIT 30`,
  network_split: `SELECT properties.network AS network, count() AS events, count(DISTINCT person_id) AS users FROM events WHERE ${since} AND properties.network IS NOT NULL GROUP BY network`,
  top_pages: `SELECT properties.$pathname AS path, count() AS views, count(DISTINCT person_id) AS users FROM events WHERE ${since} AND event = '$pageview' GROUP BY path ORDER BY views DESC LIMIT 15`,
  countries: `SELECT properties.$geoip_country_name AS country, count(DISTINCT person_id) AS users FROM events WHERE ${since} GROUP BY country ORDER BY users DESC LIMIT 15`,
  exceptions: `SELECT properties.$exception_types AS type, count() AS total FROM events WHERE ${since} AND event = '$exception' GROUP BY type ORDER BY total DESC LIMIT 10`,
};

async function runQuery(name, query) {
  const response = await fetch(`${host}/api/projects/${projectId}/query/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query }, name: `tyfi_report_${name}` }),
  });
  if (!response.ok) {
    return { error: `${response.status} ${(await response.text()).slice(0, 300)}` };
  }
  const { columns, results } = await response.json();
  return results.map((row) => Object.fromEntries(columns.map((column, i) => [column, row[i]])));
}

const report = { generated_at: new Date().toISOString(), host, project_id: projectId, days };
for (const [name, query] of Object.entries(QUERIES)) {
  report[name] = await runQuery(name, query);
}
console.log(JSON.stringify(report, null, 2));
