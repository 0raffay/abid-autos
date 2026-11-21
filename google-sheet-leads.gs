/**
 * Optional: save every website lead to a Google Sheet (free, no server needed).
 *
 * Setup (about 2 minutes):
 *  1. Create a new Google Sheet, e.g. "Abid Autos Leads".
 *  2. Extensions > Apps Script. Delete the sample code and paste this whole file.
 *  3. Deploy > New deployment > type "Web app".
 *       Execute as: Me    Who has access: Anyone
 *  4. Copy the Web app URL (ends in /exec).
 *  5. Paste it into LEAD_ENDPOINT at the top of assets/js/main.js.
 *
 * Each booking / quote request then appears as a new row, with the source
 * (facebook, google-ads, direct…) so you can see which marketing brings customers.
 */
var HEADERS = ['Submitted', 'Form', 'Name', 'Phone', 'Service', 'Car', 'Preferred date', 'Issue', 'Source', 'Page'];

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);

  var d = {};
  try { d = JSON.parse(e.postData.contents); } catch (err) { /* ignore bad payloads */ }

  sheet.appendRow([
    d.submitted_at ? new Date(d.submitted_at) : new Date(),
    clean(d.form),
    clean(d.name),
    clean(d.phone),
    clean(d.service),
    clean(d.vehicle),
    clean(d.date),
    clean(d.message),
    clean(d.source),
    clean(d.page)
  ]);

  return ContentService.createTextOutput('ok');
}

// Keep text as plain text: stop anything starting with = + - @ being run as a spreadsheet formula.
function clean(v) {
  v = String(v == null ? '' : v).slice(0, 1000);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}
