const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwRMlc_dUvUYZxLAqfiRLBmRkqax25R64SYHw2e8_V9Dj52_3371zVrpcY8wgSjQXs/exec";

let map;
let marker;
let currentLat, currentLng, gpsLat, gpsLng, gpsCircle, connectionLine;

document.addEventListener('DOMContentLoaded', () => {
    checkSettings();
    // 30秒ごとに返信をチェック
    setInterval(checkReplies, 30000);
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
        checkReplies(); // 起動時に返信確認
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
        const replyBox = document.getElementById('replyBox');
        const replyMsg = document.getElementById('replyMessage');

        if (json.status === 'success' && json.reply) {
            replyMsg.textContent = json.reply;
            replyBox.classList.remove('hidden');
        } else {
            replyBox.classList.add('hidden');
        }
    } catch (e) {
        console.error("Reply check error:", e);
    }
}

function initMap() {
    if (map) return;
    map = L.map('map').setView([35.6895, 139.6917], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    map.on('click', (e) => updateMapLocation(e.latlng.lat, e.latlng.lng));
    refreshLocation();
}

function refreshLocation() {
    const status = document.getElementById('statusMessage');
    status.textContent = "現在地を取得中...";
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            gpsLat = position.coords.latitude; gpsLng = position.coords.longitude;
            if (gpsCircle) map.removeLayer(gpsCircle);
            gpsCircle = L.circleMarker([gpsLat, gpsLng], { radius: 6, fillColor: "#4285F4", color: "#fff", weight: 2, fillOpacity: 1 }).addTo(map);
            updateMapLocation(gpsLat, gpsLng);
            status.textContent = "現在地を更新しました";
            setTimeout(() => status.textContent = "", 3000);
        }, (error) => {
            status.textContent = "現在地の取得に失敗: " + error.message;
        }, { enableHighAccuracy: true });
    }
}

function updateMapLocation(lat, lng) {
    currentLat = lat; currentLng = lng;
    const latLng = [lat, lng];
    map.setView(latLng, 16);
    if (marker) {
        marker.setLatLng(latLng);
    } else {
        marker = L.marker(latLng, { draggable: true }).addTo(map).bindPopup('住所を取得中...').openPopup();
        marker.on('dragend', (e) => {
            const pos = marker.getLatLng();
            updateMapLocation(pos.lat, pos.lng);
        });
    }
    updateConnectionLine();
    fetchAddress(lat, lng);
}

function fetchAddress(lat, lng) {
    const addressEl = document.getElementById('addressDisplay');
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then(res => res.json())
        .then(data => {
            let addr = data.display_name.replace(/,?\s*日本\s*$/g, '').replace(/,?\s*Japan\s*$/gi, '');
            if (marker) marker.setPopupContent(addr).openPopup();
            addressEl.textContent = addr;
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
        status.textContent = success ? "送信完了 (" + new Date().toLocaleTimeString() + ")" : "送信失敗";
        if (success) document.getElementById('userMessage').value = "";
        btn.disabled = false;
    });
}

async function sendDataToGAS(data) {
    try {
        await fetch(GAS_API_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(data) });
        return true;
    } catch (e) { return false; }
}
