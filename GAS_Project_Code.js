/**
 * Google Apps Script Code
 * Copy and paste this into your Google Apps Script editor which is bound to your Spreadsheet.
 * Deploy as a Web App with access set to "Anyone".
 */

function doGet(e) {
    try {
        var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
        var data = sheet.getDataRange().getValues();

        var headers = data[0];
        var rows = data.slice(1);

        var result = rows.map(function (row) {
            return {
                timestamp: row[0],
                name: row[1],
                phone: row[2],
                type: row[3],
                lat: row[4],
                lng: row[5],
                message: row[6] ? row[6] : ""
            };
        });

        result = result.filter(function (item) {
            return item.timestamp && item.name;
        });

        return ContentService.createTextOutput(JSON.stringify({
            status: 'success',
            data: result
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
            status: 'error',
            message: error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

function doPost(e) {
    try {
        var params;
        if (e.postData && e.postData.contents) {
            params = JSON.parse(e.postData.contents);
        } else {
            params = e.parameter;
        }

        var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

        var timestamp;
        if (params.timestamp) {
            var date = new Date(params.timestamp);
            timestamp = Utilities.formatDate(date, "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");
        } else {
            timestamp = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");
        }

        var name = params.name || '';
        var phone = params.phone || '';
        var type = params.type || 'unknown';
        var lat = params.lat || '';
        var lng = params.lng || '';
        var message = params.message || '';

        sheet.appendRow([timestamp, name, phone, type, lat, lng, message]);

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
    sheet.clear();
    sheet.appendRow(['Timestamp', 'Name', 'Phone', 'Type', 'Latitude', 'Longitude', 'Message']);
}
