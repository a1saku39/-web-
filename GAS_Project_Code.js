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
                reply: row[8] ? row[8] : "" // 9列目を返信内容として取得
            };
        });

        // スマホ側からの特定の電話番号に対する最新の返信取得用クエリへの対応
        if (e.parameter.phone) {
            var latestReply = "";
            for (var i = result.length - 1; i >= 0; i--) {
                if (result[i].phone === e.parameter.phone && result[i].reply) {
                    latestReply = result[i].reply;
                    break;
                }
            }
            return ContentService.createTextOutput(JSON.stringify({
                status: 'success',
                reply: latestReply
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

function doPost(e) {
    try {
        var params;
        if (e.postData && e.postData.contents) {
            params = JSON.parse(e.postData.contents);
        } else {
            params = e.parameter;
        }

        var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

        // ステータス更新または返信の送信
        if (params.action === 'updateStatus' || params.action === 'sendReply') {
            var rowId = params.rowId;
            if (params.action === 'updateStatus') {
                sheet.getRange(rowId, 8).setValue('受付済み');
            }
            if (params.reply) {
                sheet.getRange(rowId, 9).setValue(params.reply); // 9列目に返信を保存
            }
            return ContentService.createTextOutput(JSON.stringify({
                status: 'success',
                message: 'Updated successfully'
            })).setMimeType(ContentService.MimeType.JSON);
        }

        // 新規登録
        var timestamp = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");
        var name = params.name || '';
        var phone = params.phone || '';
        var type = params.type || 'unknown';
        var lat = params.lat || '';
        var lng = params.lng || '';
        var message = params.message || '';
        var status = '受付待ち';

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
