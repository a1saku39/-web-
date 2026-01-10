/**
 * Google Apps Script Code
 * Copy and paste this into your Google Apps Script editor which is bound to your Spreadsheet.
 * Deploy as a Web App with access set to "Anyone".
 */

function doGet(e) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();

    // Remove header row if it exists
    var headers = data[0];
    var rows = data.slice(1);

    var result = rows.map(function (row) {
        return {
            timestamp: row[0],
            name: row[1],
            phone: row[2],
            type: row[3],
            lat: row[4],
            lng: row[5]
        };
    });

    // Filter out invalid rows (empty timestamps etc)
    result = result.filter(function (item) {
        return item.timestamp && item.name;
    });

    return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        data: result
    })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
    // Handle CORS for POST (though complex with fetch, this is standard pattern)
    // Incoming data is expected to be in the post body as a string.

    try {
        var params;
        if (e.postData && e.postData.contents) {
            params = JSON.parse(e.postData.contents);
        } else {
            // Fallback for form-encoded
            params = e.parameter;
        }

        var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

        // Prepare row data
        var timestamp = params.timestamp || new Date().toISOString();
        var name = params.name || '';
        var phone = params.phone || '';
        var type = params.type || 'unknown';
        var lat = params.lat || '';
        var lng = params.lng || '';

        sheet.appendRow([timestamp, name, phone, type, lat, lng]);

        return ContentService.createTextOutput(JSON.stringify({
            status: 'success',
            message: 'Data saved'
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
            status: 'error',
            message: error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

function setupSheet() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    // Clear and set headers
    sheet.clear();
    sheet.appendRow(['Timestamp', 'Name', 'Phone', 'Type', 'Latitude', 'Longitude']);
}
