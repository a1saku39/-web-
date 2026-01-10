// IMPORTANT: Replace this URL with your deployed Google Apps Script Web App URL
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwRMlc_dUvUYZxLAqfiRLBmRkqax25R64SYHw2e8_V9Dj52_3371zVrpcY8wgSjQXs/exec"; 

let map;
let marker;
let watchId;

document.addEventListener('DOMContentLoaded', () => {
    checkSettings();
});

function checkSettings() {
    const name = localStorage.getItem('tracker_userName');
    const phone = localStorage.getItem('tracker_userPhone');

    if (name && phone) {
        document.getElementById('displayUserName').textContent = name;
        document.getElementById('setupScreen').classList.add('hidden');
        document.getElementById('trackerScreen').classList.remove('hidden');
        initMap();
    } else {
        document.getElementById('setupScreen').classList.remove('hidden');
        document.getElementById('trackerScreen').classList.add('hidden');
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

    // Register to Spreadsheet
    sendDataToGAS({
        type: 'register',
        name: name,
        phone: phone,
        timestamp: new Date().toISOString()
    });

    checkSettings();
}

function resetSettings() {
    if(confirm('設定をリセットしますか？')) {
        localStorage.removeItem('tracker_userName');
        localStorage.removeItem('tracker_userPhone');
        location.reload();
    }
}

function initMap() {
    if (map) return;

    // Default view (Tokyo) before GPS
    map = L.map('map').setView([35.6895, 139.6917], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Start locating
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                updateMapLocation(lat, lng);
            },
            (error) => {
                console.error("Geolocation error:", error);
                document.getElementById('statusMessage').textContent = "位置情報の取得に失敗しました: " + error.message;
            }
        );
    } else {
        alert("お使いのブラウザは位置情報をサポートしていません。");
    }
}

function updateMapLocation(lat, lng) {
    const latLng = [lat, lng];
    map.setView(latLng, 16);

    if (marker) {
        marker.setLatLng(latLng);
    } else {
        marker = L.marker(latLng).addTo(map)
            .bindPopup('現在地')
            .openPopup();
    }
}

function sendLocation() {
    const btn = document.getElementById('sendLocationBtn');
    const status = document.getElementById('statusMessage');
    
    // Disable button to prevent double send
    btn.disabled = true;
    status.textContent = "位置情報を取得中...";
    status.className = "";

    if (!navigator.geolocation) {
        status.textContent = "位置情報がサポートされていません";
        status.className = "error";
        btn.disabled = false;
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            // Update map just in case
            updateMapLocation(lat, lng);

            const name = localStorage.getItem('tracker_userName');
            const phone = localStorage.getItem('tracker_userPhone');

            const data = {
                type: 'location',
                name: name,
                phone: phone,
                lat: lat,
                lng: lng,
                timestamp: new Date().toISOString()
            };

            status.textContent = "送信中...";
            
            sendDataToGAS(data)
                .then(success => {
                    if (success) {
                        status.textContent = "送信完了 (" + new Date().toLocaleTimeString() + ")";
                        status.className = "success";
                    } else {
                        status.textContent = "送信に失敗しました (Network Error)";
                        status.className = "error";
                    }
                })
                .finally(() => {
                    btn.disabled = false;
                });
        },
        (error) => {
            status.textContent = "位置情報の取得に失敗: " + error.message;
            status.className = "error";
            btn.disabled = false;
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

async function sendDataToGAS(data) {
    if (GAS_API_URL === "YOUR_SCRIPT_URL_HERE") {
        console.warn("GAS URL not set. Data would be:", data);
        alert("GASのURLが設定されていません。コード内のGAS_API_URLを書き換えてください。");
        return false;
    }

    try {
        // Use no-cors mode to avoid CORS errors with simple GAS deployments
        // Note: response will be opaque, so we can't check .ok or .json()
        await fetch(GAS_API_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: JSON.stringify(data)
        });
        
        // Since we use no-cors, we assume success if no network error occurred
        return true;
    } catch (e) {
        console.error("Send error:", e);
        return false;
    }
}
