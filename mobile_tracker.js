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
    document.getElementById('favoritesScreen').classList.add('hidden');
    document.getElementById('sendHistoryScreen').classList.add('hidden');
    document.getElementById(pageId).classList.remove('hidden');
    if (pageId === 'trackerScreen' && map) setTimeout(() => map.invalidateSize(), 100);
    if (pageId === 'favoritesScreen') renderFavorites();
    if (pageId === 'sendHistoryScreen') checkReplies();
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
        const fullListEl = document.getElementById('fullHistoryList');

        if (json.status === 'success' && json.history && json.history.length > 0) {
            historySection.classList.remove('hidden');
            listEl.innerHTML = '';
            fullListEl.innerHTML = '';

            // 最近の5件に絞る
            const recentHistory = json.history.slice(0, 5);

            recentHistory.forEach(item => {
                // 日付パースの安全策（スラッシュ区切りをハイフンに置換するなど）
                let dateObj;
                try {
                    const safeTime = item.timestamp ? item.timestamp.replace(/\//g, '-') : null;
                    dateObj = safeTime ? new Date(safeTime) : new Date();
                } catch (e) {
                    dateObj = new Date();
                }
                const timeStr = dateObj.toLocaleString('ja-JP', { hour: '2-digit', minute: '2-digit' });

                // 自分が送信したメッセージ
                if (item.message) {
                    const myMsg = document.createElement('div');
                    myMsg.style.cssText = "align-self: flex-end; background: #dcf8c6; padding: 8px 12px; border-radius: 12px 12px 0 12px; max-width: 85%; font-size: 0.9rem; box-shadow: 0 1px 2px rgba(0,0,0,0.1); margin-bottom: 5px;";
                    myMsg.innerHTML = `<div style="font-size: 0.7rem; color: #777; margin-bottom: 2px;">送信済み - ${timeStr}</div><div>${escapeHtml(item.message)}</div>`;
                    listEl.appendChild(myMsg);
                }

                // センターからの返信
                if (item.reply) {
                    const replyMsg = document.createElement('div');
                    replyMsg.style.cssText = "align-self: flex-start; background: #e8f4fd; padding: 8px 12px; border-radius: 12px 12px 12px 0; max-width: 85%; font-size: 0.9rem; border-left: 4px solid #007bff; box-shadow: 0 1px 2px rgba(0,0,0,0.1); margin-top: 5px; margin-bottom: 5px;";
                    replyMsg.innerHTML = `<div style="font-size: 0.7rem; color: #007bff; font-weight: bold; margin-bottom: 2px;">センター - ${timeStr}</div><div>${escapeHtml(item.reply)}</div>`;
                    listEl.appendChild(replyMsg.cloneNode(true));
                    fullListEl.appendChild(replyMsg);
                } else if (item.message) {
                    // 返信がない場合の自分側のメッセージもfullListに追加
                    const myMsg = document.createElement('div');
                    myMsg.style.cssText = "align-self: flex-end; background: #dcf8c6; padding: 8px 12px; border-radius: 12px 12px 0 12px; max-width: 85%; font-size: 0.9rem; box-shadow: 0 1px 2px rgba(0,0,0,0.1); margin-bottom: 5px;";
                    myMsg.innerHTML = `<div style="font-size: 0.7rem; color: #777; margin-bottom: 2px;">送信済み - ${timeStr}</div><div>${escapeHtml(item.message)}</div>`;
                    listEl.appendChild(myMsg.cloneNode(true));
                    fullListEl.appendChild(myMsg);
                }
            });
            // 最新のメッセージが見えるようにスクロールさせる場合はここに追加
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
            if (marker) marker.setPopupContent(addr).openPopup();
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

// --- お気に入り機能 ---
function renderFavorites() {
    const listEl = document.getElementById('favoritesList');
    const favs = JSON.parse(localStorage.getItem('tracker_favorites') || '[]');
    listEl.innerHTML = '';

    if (favs.length === 0) {
        listEl.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">登録された場所はありません</p>';
        return;
    }

    favs.forEach((fav, index) => {
        const item = document.createElement('div');
        item.className = 'fav-item';
        item.innerHTML = `
            <div class="fav-info" onclick="applyFavorite(${fav.lat}, ${fav.lng}, '${escapeHtml(fav.name)}')">
                <div class="fav-name">${escapeHtml(fav.name)}</div>
                <div class="fav-addr">${escapeHtml(fav.address)}</div>
            </div>
            <div style="display:flex; flex-direction:column; gap:5px;">
                <button class="btn" style="padding:4px 8px; font-size:11px; background:#6c757d; color:white;" onclick="focusOnMapFav(${fav.lat}, ${fav.lng}, '${escapeHtml(fav.name)}')">地図</button>
                <button class="btn-delete" onclick="deleteFavorite(${index})">削除</button>
            </div>
        `;
        listEl.appendChild(item);
    });
}

function focusOnMapFav(lat, lng, name) {
    updateMapLocation(lat, lng);
    showPage('trackerScreen');
}

function addFavorite() {
    if (!currentLat || !currentLng) return alert('場所が指定されていません');
    const address = document.getElementById('addressDisplay').textContent;
    const name = prompt('この場所に名前をつけて保存しますか？\n(例: 自宅、会社など)', '');
    if (!name) return;

    const favs = JSON.parse(localStorage.getItem('tracker_favorites') || '[]');
    favs.push({ name, address, lat: currentLat, lng: currentLng });
    localStorage.setItem('tracker_favorites', JSON.stringify(favs));
    alert('お気に入りに保存しました');
}

function applyFavorite(lat, lng, name) {
    updateMapLocation(lat, lng);
    showPage('trackerScreen');
    document.getElementById('statusMessage').textContent = `お気に入り: ${name} を選択しました`;
    setTimeout(() => document.getElementById('statusMessage').textContent = "", 3000);
}

function deleteFavorite(index) {
    if (!confirm('このお気に入りを削除しますか？')) return;
    const favs = JSON.parse(localStorage.getItem('tracker_favorites') || '[]');
    favs.splice(index, 1);
    localStorage.setItem('tracker_favorites', JSON.stringify(favs));
    renderFavorites();
}

function escapeHtml(text) {
    if (!text) return "";
    return text.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
