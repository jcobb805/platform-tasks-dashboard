// ═══════════════════════════════════════════════════════════════════════════
// Platform Energy — Tasks & Deadlines Backend
// Google Apps Script — Deploy as Web App ("Anyone" access)
// ═══════════════════════════════════════════════════════════════════════════

const SHEET_NAME = 'TaskStatus';

// Valid team members (rejects unknown names)
const VALID_USERS = ['Angelica','Josh','Kinzie','Kristen','Lauren','Marcus','Michele','Team'];

// Valid status values
const VALID_STATUSES = ['pending','wip','done'];

// ─── GET: Return all task statuses ──────────────────────────────────────
function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) return jsonResponse([]);

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return jsonResponse([]);

    const headers = data[0];
    const rows = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });

    return jsonResponse(rows);
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// ─── POST: Update a task status ─────────────────────────────────────────
function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);
    const payload = JSON.parse(e.postData.contents);
    const { taskId, periodKey, status, updatedBy } = payload;

    // Validate
    if (!taskId || !periodKey || !status) {
      return jsonResponse({ error: 'Missing required fields' });
    }
    if (!VALID_STATUSES.includes(status)) {
      return jsonResponse({ error: 'Invalid status: ' + status });
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) return jsonResponse({ error: 'Sheet not found. Run setup() first.' });

    const data = sheet.getDataRange().getValues();
    const now = new Date().toISOString();
    let found = false;

    // Look for existing row with same task_id + period_key
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(taskId) && String(data[i][1]) === String(periodKey)) {
        sheet.getRange(i + 1, 3).setValue(status);
        sheet.getRange(i + 1, 4).setValue(updatedBy || '');
        sheet.getRange(i + 1, 5).setValue(now);
        found = true;
        break;
      }
    }

    // Insert new row if not found
    if (!found) {
      sheet.appendRow([String(taskId), String(periodKey), status, updatedBy || '', now]);
    }

    return jsonResponse({ success: true, taskId, status });
  } catch (err) {
    return jsonResponse({ error: err.message });
  } finally {
    lock.releaseLock();
  }
}

// ─── Helper: JSON response ──────────────────────────────────────────────
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── Run once: Create the TaskStatus sheet with headers ─────────────────
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  // Set headers
  sheet.getRange('A1:E1').setValues([['task_id', 'period_key', 'status', 'updated_by', 'updated_at']]);
  sheet.getRange('1:1').setFontWeight('bold');
  sheet.setFrozenRows(1);

  // Auto-size columns
  sheet.autoResizeColumns(1, 5);

  Logger.log('Setup complete. Sheet "TaskStatus" is ready.');
}