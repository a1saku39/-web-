/**
 * Google Apps Script Code
 */

function doGet(e) {
    try {
        var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
        var data = sheet.getDataRange().getValues();

        var headers = data[0];
        var rows = data.slice(1);

        var result = rows.map(function (row, index) {
            return {
                rowId: index + 2,
                timestamp: row[0],
                name: row[1],
                phone: row[2],
                type: row[3],
                lat: row[4],
                lng: row[5],
                message: row[6] ? row[6] : "",
                status: row[7] ? row[7] : "受付待ち",
                reply: row[8] ? row[8] : ""
            };
        });

        // スマホ側：その電話番号に関連する全ての返信付きデータを返す
        if (e.parameter.phone) {
            var history = result.filter(function (item) {
                return item.phone === e.parameter.phone && (item.message || item.reply);
            }).reverse().slice(0, 10); // 最新10件

            return ContentService.createTextOutput(JSON.stringify({
                status: 'success',
                history: history
            })).setMimeType(ContentService.MimeType.JSON);
        }

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

// ... doPost, setupSheet は変更なし ...
function doPost(e) {
    try {
        var params;
        if (e.postData && e.postData.contents) {
            params = JSON.parse(e.postData.contents);
        } else {
            params = e.parameter;
        }

        var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

        if (params.action === 'updateStatus' || params.action === 'sendReply') {
            var rowId = params.rowId;
            if (params.action === 'updateStatus') {
                var newStatus = params.status || '受付済み';
                sheet.getRange(rowId, 8).setValue(newStatus);
            }
            if (params.reply) {
                sheet.getRange(rowId, 9).setValue(params.reply);
                sheet.getRange(rowId, 8).setValue('返信済み');
            }
            return ContentService.createTextOutput(JSON.stringify({
                status: 'success',
                message: 'Updated successfully'
            })).setMimeType(ContentService.MimeType.JSON);
        }

        var timestamp = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");
        var name = params.name || '';
        var phone = params.phone || '';
        var type = params.type || 'unknown';
        var lat = params.lat || '';
        var lng = params.lng || '';
        var message = params.message || '';
        var status = '未承認';

        sheet.appendRow([timestamp, name, phone, type, lat, lng, message, status, ""]);

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
    sheet.appendRow(['Timestamp', 'Name', 'Phone', 'Type', 'Latitude', 'Longitude', 'Message', 'Status', 'Reply']);
}
