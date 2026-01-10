const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwRMlc_dUvUYZxLAqfiRLBmRkqax25R64SYHw2e8_V9Dj52_3371zVrpcY8wgSjQXs/exec";

let map;
let marker;
let currentLat;
let currentLng;
let gpsLat;
let gpsLng;
let gpsCircle;
let connectionLine;

document.addEventListener('DOMContentLoaded', () => {
    checkSettings();
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

    if (pageId === 'trackerScreen' && map) {
        setTimeout(() => map.invalidateSize(), 100);
    }

    closeMenu();
}

function checkSettings() {
    const name = localStorage.getItem('tracker_userName');
    const phone = localStorage.getItem('tracker_userPhone');

    if (name && phone) {
        const nameEl = document.getElementById('infoName');
        const phoneEl = document.getElementById('infoPhone');
        if (nameEl) nameEl.textContent = name;
        if (phoneEl) phoneEl.textContent = phone;

        document.getElementById('setupScreen').classList.add('hidden');
        document.getElementById('trackerScreen').classList.remove('hidden');
        initMap();
    } else {
        document.getElementById('setupScreen').classList.remove('hidden');
        document.getElementById('trackerScreen').classList.add('hidden');
        document.getElementById('accountScreen').classList.add('hidden');

        const header = document.querySelector('header');
        if (header) header.style.display = 'none';
    }
}

function saveSettings() {
    const nameInput = document.getElementById('userName');
    const phoneInput = document.getElementById('userPhone');
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();

    if (!name || !phone) {
        alert('氏名と電話番号を入力してください');
        return;
    }

    localStorage.setItem('tracker_userName', name);
    localStorage.setItem('tracker_userPhone', phone);

    sendDataToGAS({
        type: 'register',
        name: name,
        phone: phone,
        timestamp: new Date().toISOString()
    });

    const header = document.querySelector('header');
    if (header) header.style.display = 'flex';

    checkSettings();
}

function resetSettings() {
    if (confirm('設定をリセットしますか？')) {
        localStorage.removeItem('tracker_userName');
        localStorage.removeItem('tracker_userPhone');
        location.reload();
    }
}

function initMap() {
    if (map) return;

    map = L.map('map').setView([35.6895, 139.6917], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    map.on('click', function (e) {
        updateMapLocation(e.latlng.lat, e.latlng.lng);
    });

    refreshLocation();
}

function refreshLocation() {
    const status = document.getElementById('statusMessage');
    if (!status) return;

    status.textContent = "現在地を取得中...";
    status.className = "";

    if (!map) {
        status.textContent = "マップが初期化されていません";
        status.className = "error";
        return;
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                gpsLat = position.coords.latitude;
                gpsLng = position.coords.longitude;

                if (gpsCircle) map.removeLayer(gpsCircle);
                gpsCircle = L.circleMarker([gpsLat, gpsLng], {
                    radius: 6,
                    fillColor: "#4285F4",
                    color: "#ffffff",
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 1
                }).addTo(map).bindPopup("GPS取得位置");

                updateMapLocation(gpsLat, gpsLng);

                status.textContent = "現在地を更新しました";
                setTimeout(() => status.textContent = "", 3000);
            },
            (error) => {
                console.error("Geolocation error:", error);
                status.textContent = "現在地の取得に失敗: " + error.message;
                status.className = "error";
            },
            { enableHighAccuracy: true }
        );
    } else {
        alert("お使いのブラウザは位置情報をサポートしていません。");
        status.textContent = "位置情報がサポートされていません";
        status.className = "error";
    }
}

function updateMapLocation(lat, lng) {
    currentLat = lat;
    currentLng = lng;
    const latLng = [lat, lng];
    map.setView(latLng, 16);

    if (marker) {
        marker.setLatLng(latLng);
        marker.setPopupContent('住所を取得中...').openPopup();
    } else {
        marker = L.marker(latLng, { draggable: true }).addTo(map)
            .bindPopup('住所を取得中...')
            .openPopup();

        marker.on('dragend', function (event) {
            const position = marker.getLatLng();
            currentLat = position.lat;
            currentLng = position.lng;
            updateMapLocation(currentLat, currentLng);
        });
    }
    updateConnectionLine();

    fetchAddress(lat, lng);
}

function fetchAddress(lat, lng) {
    const addressEl = document.getElementById('addressDisplay');
    if (addressEl) addressEl.textContent = "住所を取得中...";

    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then(response => response.json())
        .then(data => {
            let address;
            if (data.address) {
                const addr = data.address;
                const parts = [
                    addr.state || addr.province,
                    addr.city || addr.town || addr.village,
                    addr.suburb || addr.neighbourhood,
                    addr.road,
                    addr.house_number
                ].filter(Boolean);

                address = parts.join('') || data.display_name;
            } else {
                address = data.display_name;
            }

            address = address.replace(/,?\s*日本\s*$/g, '').replace(/,?\s*Japan\s*$/gi, '');

            if (marker) {
                marker.setPopupContent(address).openPopup();
            }
            if (addressEl) {
                addressEl.textContent = address;
            }
        })
        .catch(err => {
            console.error("Address fetch error:", err);
            if (addressEl) addressEl.textContent = "住所不明";
            if (marker) marker.setPopupContent("現在地 (住所取得失敗)").openPopup();
        });
}

function updateConnectionLine() {
    if (!gpsLat || !gpsLng || !currentLat || !currentLng) return;

    const gpsLatLng = [gpsLat, gpsLng];
    const targetLatLng = [currentLat, currentLng];

    if (connectionLine) {
        connectionLine.setLatLngs([gpsLatLng, targetLatLng]);
    } else {
        connectionLine = L.polyline([gpsLatLng, targetLatLng], {
            color: '#4285F4',
            weight: 3,
            opacity: 0.6,
            dashArray: '5, 10'
        }).addTo(map);
    }
}

function sendLocation() {
    const btn = document.getElementById('sendLocationBtn');
    const status = document.getElementById('statusMessage');
    const messageInput = document.getElementById('userMessage');

    btn.disabled = true;
    status.textContent = "送信準備中...";
    status.className = "";

    if (typeof currentLat === 'undefined' || typeof currentLng === 'undefined') {
        if (!navigator.geolocation) {
            status.textContent = "位置情報が設定されていません";
            status.className = "error";
            btn.disabled = false;
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                updateMapLocation(position.coords.latitude, position.coords.longitude);
                sendLocation();
            },
            (error) => {
                status.textContent = "位置情報を特定できません。地図をタップして場所を指定してください。";
                status.className = "error";
                btn.disabled = false;
            }
        );
        return;
    }

    const name = localStorage.getItem('tracker_userName');
    const phone = localStorage.getItem('tracker_userPhone');
    const message = messageInput ? messageInput.value.trim() : "";

    const data = {
        type: 'location',
        name: name,
        phone: phone,
        lat: currentLat,
        lng: currentLng,
        message: message,
        timestamp: new Date().toISOString()
    };

    status.textContent = "送信中...";

    sendDataToGAS(data)
        .then(success => {
            if (success) {
                status.textContent = "送信完了 (" + new Date().toLocaleTimeString() + ")";
                status.className = "success";
                if (messageInput) messageInput.value = "";
            } else {
                status.textContent = "送信に失敗しました。通信環境を確認してください。";
                status.className = "error";
            }
        })
        .finally(() => {
            btn.disabled = false;
        });
}

async function sendDataToGAS(data) {
    if (!GAS_API_URL || GAS_API_URL.includes("YOUR_SCRIPT_URL")) {
        alert("GASのURLが設定されていません。コードを確認してください。");
        return false;
    }

    try {
        await fetch(GAS_API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: JSON.stringify(data)
        });
        return true;
    } catch (e) {
        console.error("Send error:", e);
        return false;
    }
}
