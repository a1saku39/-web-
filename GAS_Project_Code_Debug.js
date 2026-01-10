/**
 * Google Apps Script Code (デバッグ版)
 * 問題を診断するためのログ機能付き
 */

function doGet(e) {
    try {
        var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
        var data = sheet.getDataRange().getValues();

        Logger.log("doGet called. Rows: " + data.length);

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
                lng: row[5],
                message: row[6] ? row[6] : ""
            };
        });

        // Filter out invalid rows (empty timestamps etc)
        result = result.filter(function (item) {
            return item.timestamp && item.name;
        });

        Logger.log("Returning " + result.length + " records");

        return ContentService.createTextOutput(JSON.stringify({
            status: 'success',
            data: result,
            debug: {
                totalRows: data.length,
                filteredRows: result.length,
                timestamp: new Date().toISOString()
            }
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        Logger.log("doGet error: " + error.toString());
        return ContentService.createTextOutput(JSON.stringify({
            status: 'error',
            message: error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

function doPost(e) {
    try {
        Logger.log("doPost called");

        var params;
        // Check if body content exists and parse it
        if (e.postData && e.postData.contents) {
            Logger.log("Parsing postData.contents: " + e.postData.contents);
            params = JSON.parse(e.postData.contents);
        } else {
            Logger.log("Using e.parameter");
            params = e.parameter;
        }

        Logger.log("Params: " + JSON.stringify(params));

        var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

        // Prepare row data
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

        Logger.log("Appending row: " + [timestamp, name, phone, type, lat, lng, message].join(", "));

        // Append to spreadsheet (Column A to G)
        sheet.appendRow([timestamp, name, phone, type, lat, lng, message]);

        Logger.log("Row appended successfully");

        return ContentService.createTextOutput(JSON.stringify({
            status: 'success',
            message: 'Data saved',
            debug: {
                timestamp: timestamp,
                receivedAt: new Date().toISOString()
            }
        })).setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        Logger.log("doPost error: " + error.toString());
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
    Logger.log("Sheet setup complete");
}

// テスト用関数：スプレッドシートに手動でデータを追加
function testAddData() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var timestamp = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");
    sheet.appendRow([timestamp, "テストユーザー", "090-0000-0000", "location", 35.6895, 139.6917, "テストメッセージ"]);
    Logger.log("Test data added");
}
