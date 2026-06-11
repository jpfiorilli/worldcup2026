/**
 * WC 2026 Scores Proxy — Google Apps Script
 * ──────────────────────────────────────────
 * Proxies football-data.org API calls to bypass browser CORS restrictions.
 *
 * SETUP (2 minutes):
 * 1. Go to script.google.com → New project
 * 2. Paste this code, save (Ctrl+S)
 * 3. Deploy → New deployment → Web App
 *    Execute as: Me
 *    Access: Anyone
 * 4. Copy the URL → paste into the scores app config
 */

const FD_KEY = '98a4e20e82db481882a8bbe75057beaf';
const WC_TOKEN = 'wc2026scores'; // simple shared secret

function doGet(e) {
  const callback = e.parameter.callback;
  const token    = e.parameter.token;
  const date     = e.parameter.date;

  function out(data) {
    const json = JSON.stringify(data);
    return ContentService.createTextOutput(
      callback ? `${callback}(${json})` : json
    ).setMimeType(callback
      ? ContentService.MimeType.JAVASCRIPT
      : ContentService.MimeType.JSON);
  }

  if (token !== WC_TOKEN) return out({error: 'Unauthorised'});

  try {
    const today = date || Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');

    // Fetch today's matches (includes live, finished, scheduled)
    const url = `https://api.football-data.org/v4/competitions/WC/matches?dateFrom=${today}&dateTo=${today}`;
    const resp = UrlFetchApp.fetch(url, {
      headers: { 'X-Auth-Token': FD_KEY },
      muteHttpExceptions: true
    });

    const data = JSON.parse(resp.getContentText());
    return out({ matches: data.matches || [], date: today });

  } catch(err) {
    return out({ matches: [], error: err.message });
  }
}
