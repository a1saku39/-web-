const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwRMlc_dUvUYZxLAqfiRLBmRkqax25R64SYHw2e8_V9Dj52_3371zVrpcY8wgSjQXs/exec";

let map;
let marker;
let currentLat, currentLng, gpsLat, gpsLng, gpsCircle, connectionLine;

document.addEventListener('DOMContentLoaded', () => {
    checkSettings();
    setInterval(checkReplies, 30000); // 30秒ごとに履歴を更新
});

function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('overlay').classList.toggle('show');
}

function closeMenu() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('show');
}

function showPage(pageId) {
    document.getElementById('trackerScreen').classList.add('hidden');
    document.getElementById('accountScreen').classList.add('hidden');
    document.getElementById(pageId).classList.remove('hidden');
    if (pageId === 'trackerScreen' && map) setTimeout(() => map.invalidateSize(), 100);
    closeMenu();
}

function checkSettings() {
    const name = localStorage.getItem('tracker_userName');
    const phone = localStorage.getItem('tracker_userPhone');
    if (name && phone) {
        document.getElementById('infoName').textContent = name;
        document.getElementById('infoPhone').textContent = phone;
        document.getElementById('setupScreen').classList.add('hidden');
        document.getElementById('trackerScreen').classList.remove('hidden');
        initMap();
        checkReplies();
    } else {
        document.getElementById('setupScreen').classList.remove('hidden');
        document.getElementById('trackerScreen').classList.add('hidden');
        document.getElementById('accountScreen').classList.add('hidden');
        document.querySelector('header').style.display = 'none';
    }
}

function saveSettings() {
    const name = document.getElementById('userName').value.trim();
    const phone = document.getElementById('userPhone').value.trim();
    if (!name || !phone) return alert('氏名と電話番号を入力してください');
    localStorage.setItem('tracker_userName', name);
    localStorage.setItem('tracker_userPhone', phone);
    sendDataToGAS({ type: 'register', name: name, phone: phone });
    document.querySelector('header').style.display = 'flex';
    checkSettings();
}

function resetSettings() {
    if (confirm('設定をリセットしますか？')) {
        localStorage.clear();
        location.reload();
    }
}

async function checkReplies() {
    const phone = localStorage.getItem('tracker_userPhone');
    if (!phone) return;
    try {
        const response = await fetch(`${GAS_API_URL}?phone=${encodeURIComponent(phone)}`);
        const json = await response.json();

        const historySection = document.getElementById('historySection');
        const listEl = document.getElementById('messageHistoryList');

        if (json.status === 'success' && json.history && json.history.length > 0) {
            historySection.classList.remove('hidden');
            listEl.innerHTML = '';

            json.history.forEach(item => {
                const timeStr = new Date(item.timestamp).toLocaleString('ja-JP', { hour: '2-digit', minute: '2-digit' });

                // 自分が送信したメッセージ
                if (item.message) {
                    const myMsg = document.createElement('div');
                    myMsg.style.cssText = "align-self: flex-end; background: #dcf8c6; padding: 8px 12px; border-radius: 12px 12px 0 12px; max-width: 85%; font-size: 0.9rem; box-shadow: 0 1px 2px rgba(0,0,0,0.1);";
                    myMsg.innerHTML = `<div style="font-size: 0.7rem; color: #777; margin-bottom: 2px;">送信済み - ${timeStr}</div><div>${escapeHtml(item.message)}</div>`;
                    listEl.appendChild(myMsg);
                }

                // センターからの返信
                if (item.reply) {
                    const replyMsg = document.createElement('div');
                    replyMsg.style.cssText = "align-self: flex-start; background: #e8f4fd; padding: 8px 12px; border-radius: 12px 12px 12px 0; max-width: 85%; font-size: 0.9rem; border-left: 4px solid #007bff; box-shadow: 0 1px 2px rgba(0,0,0,0.1);";
                    replyMsg.innerHTML = `<div style="font-size: 0.7rem; color: #007bff; font-weight: bold; margin-bottom: 2px;">センター - ${timeStr}</div><div>${escapeHtml(item.reply)}</div>`;
                    listEl.appendChild(replyMsg);
                }
            });
        }
    } catch (e) {
        console.error("Reply check error:", e);
    }
}

function initMap() {
    // 地図は非表示にしたので初期化のみ安全に行うか、あるいは何もしない
    refreshLocation();
}

function refreshLocation() {
    const status = document.getElementById('statusMessage');
    status.textContent = "現在地を取得中...";
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            gpsLat = position.coords.latitude; gpsLng = position.coords.longitude;
            updateMapLocation(gpsLat, gpsLng);
            status.textContent = "住所を取得しました";
            setTimeout(() => status.textContent = "", 3000);
        }, (error) => {
            status.textContent = "現在地の取得に失敗: " + error.message;
        }, { enableHighAccuracy: true });
    }
}

function updateMapLocation(lat, lng) {
    currentLat = lat; currentLng = lng;
    fetchAddress(lat, lng);
}

function fetchAddress(lat, lng) {
    const addressEl = document.getElementById('addressDisplay');
    if (addressEl) addressEl.textContent = "住所を取得中...";
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ja`)
        .then(res => res.json())
        .then(data => {
            let addr = "";
            if (data.address) {
                const a = data.address;
                const parts = [a.province || a.state, a.city || a.town || a.village, a.suburb || a.neighbourhood, a.road, a.house_number].filter(Boolean);
                addr = parts.join('');
            }
            if (!addr) addr = data.display_name.replace(/,?\s*日本\s*$/g, '').replace(/,?\s*Japan\s*$/gi, '');
            if (addressEl) addressEl.textContent = addr;
        });
}

function updateConnectionLine() {
    if (!gpsLat || !currentLat) return;
    if (connectionLine) connectionLine.setLatLngs([[gpsLat, gpsLng], [currentLat, currentLng]]);
    else connectionLine = L.polyline([[gpsLat, gpsLng], [currentLat, currentLng]], { color: '#4285F4', weight: 3, opacity: 0.6, dashArray: '5, 10' }).addTo(map);
}

function sendLocation() {
    const btn = document.getElementById('sendLocationBtn');
    const status = document.getElementById('statusMessage');
    btn.disabled = true;
    const data = {
        type: 'location',
        name: localStorage.getItem('tracker_userName'),
        phone: localStorage.getItem('tracker_userPhone'),
        lat: currentLat, lng: currentLng,
        message: document.getElementById('userMessage').value.trim(),
        timestamp: new Date().toISOString()
    };
    sendDataToGAS(data).then(success => {
        status.textContent = success ? "送信完了" : "送信失敗";
        if (success) {
            document.getElementById('userMessage').value = "";
            checkReplies(); // 送信直後に更新
        }
        btn.disabled = false;
    });
}

async function sendDataToGAS(data) {
    try {
        await fetch(GAS_API_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(data) });
        return true;
    } catch (e) { return false; }
}

function escapeHtml(text) {
    if (!text) return "";
    return text.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
