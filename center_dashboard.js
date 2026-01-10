const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwRMlc_dUvUYZxLAqfiRLBmRkqax25R64SYHw2e8_V9Dj52_3371zVrpcY8wgSjQXs/exec";

let map;
let markersSource = [];

document.addEventListener('DOMContentLoaded', () => {
    document.title = "スマホweb受付ダッシュボード";
    initMap();
    fetchData();
    fetchReceptionData();

    document.getElementById('refreshBtn').addEventListener('click', () => {
        fetchData();
        fetchReceptionData();
    });
});

function toggleMenu() {
    document.getElementById('menuSidebar').classList.toggle('open');
    document.getElementById('overlay').classList.toggle('show');
}

function closeMenu() {
    document.getElementById('menuSidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('show');
}

function toggleHistory() {
    const sidebar = document.getElementById('historySidebar');
    const isHidden = sidebar.classList.contains('hidden');

    if (isHidden) {
        sidebar.classList.remove('hidden');
    } else {
        sidebar.classList.add('hidden');
    }

    setTimeout(() => {
        if (map) map.invalidateSize();
    }, 300);

    closeMenu();
}

function toggleReception() {
    const panel = document.getElementById('receptionPanel');
    const isHidden = panel.classList.contains('hidden');

    if (isHidden) {
        panel.classList.remove('hidden');
        fetchReceptionData();
    } else {
        panel.classList.add('hidden');
    }

    setTimeout(() => {
        if (map) map.invalidateSize();
    }, 300);

    closeMenu();
}

function fetchReceptionData() {
    if (!GAS_API_URL || GAS_API_URL.includes("YOUR_SCRIPT_URL")) {
        return;
    }

    fetch(GAS_API_URL)
        .then(response => response.json())
        .then(json => {
            if (json.status === 'success' && Array.isArray(json.data)) {
                renderReceptionData(json.data);
            }
        })
        .catch(error => {
            console.error("Reception fetch error:", error);
        });
}

function renderReceptionData(data) {
    const listEl = document.getElementById('receptionList');
    listEl.innerHTML = '';

    if (data.length === 0) {
        listEl.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">受付待ち項目はありません</p>';
        return;
    }

    data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    data.forEach((item, index) => {
        const date = new Date(item.timestamp);
        const timeStr = date.toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

        const card = document.createElement('div');
        card.className = 'reception-card';
        card.innerHTML = `
            <h4>${escapeHtml(item.name)}<span class="status-badge">受付待ち</span></h4>
            <div class="reception-info">
                <div>
                    <span class="info-label">受信日時:</span>
                    <span class="info-value">${timeStr}</span>
                </div>
                <div>
                    <span class="info-label">電話番号:</span>
                    <span class="info-value">${escapeHtml(item.phone)}</span>
                </div>
                ${item.message ? `
                <div>
                    <span class="info-label">メッセージ:</span>
                    <span class="info-value">${escapeHtml(item.message)}</span>
                </div>
                ` : ''}
            </div>
            <button class="btn-accept" onclick="acceptReception('${escapeHtml(item.name)}', ${item.lat}, ${item.lng})">
                受付する
            </button>
        `;

        listEl.appendChild(card);
    });
}

function acceptReception(name, lat, lng) {
    if (confirm(`${name} さんの位置情報を受付しますか？`)) {
        if (lat && lng) {
            // Remove all existing markers
            markersSource.forEach(m => {
                if (map.hasLayer(m)) {
                    map.removeLayer(m);
                }
            });

            // Create and add marker for accepted location
            const marker = L.marker([lat, lng])
                .addTo(map)
                .bindPopup(`<b>${name}</b><br>受付済み`)
                .openPopup();

            // Add to markers array
            markersSource.push(marker);

            // Fly to location
            map.flyTo([lat, lng], 16);
        }
        alert('受付しました');
        fetchReceptionData();
    }
}

function initMap() {
    map = L.map('map').setView([35.6895, 139.6917], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
}

function fetchData() {
    if (!GAS_API_URL || GAS_API_URL.includes("YOUR_SCRIPT_URL")) {
        console.warn("GAS URL not set.");
        alert("GASのURLが設定されていません。コードを確認してください。");
        return;
    }

    const loading = document.getElementById('loading');
    loading.style.display = 'flex';

    fetch(GAS_API_URL)
        .then(response => {
            if (!response.ok) throw new Error("Network response was not ok");
            return response.json();
        })
        .then(json => {
            if (json.status === 'success' && Array.isArray(json.data)) {
                renderData(json.data);
            } else {
                console.error("Invalid data format:", json);
                alert("データの取得に失敗しました (形式エラー)");
            }
        })
        .catch(error => {
            console.error("Fetch error:", error);
        })
        .finally(() => {
            loading.style.display = 'none';
        });
}

function renderData(data) {
    const listEl = document.getElementById('logList');
    listEl.innerHTML = '';

    markersSource.forEach(m => {
        if (map.hasLayer(m)) {
            map.removeLayer(m);
        }
    });
    markersSource = [];

    if (data.length === 0) {
        listEl.innerHTML = '<li style="padding: 20px; text-align: center; color: #999;">データなし</li>';
        return;
    }

    data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    data.forEach((item, index) => {
        if (!item.lat || !item.lng) return;

        const date = new Date(item.timestamp);
        const timeStr = date.toLocaleString('ja-JP');
        const messageText = item.message ? `<div class="log-message" style="font-size:0.85rem; color:#555; margin-top:4px; background:#f0f0f0; padding:4px; border-radius:4px;">${escapeHtml(item.message)}</div>` : "";

        const popupContent = `<b>${escapeHtml(item.name)}</b><br>${timeStr}${item.message ? '<hr>' + escapeHtml(item.message) : ''}`;
        const marker = L.marker([item.lat, item.lng])
            .bindPopup(popupContent);

        const li = document.createElement('li');
        li.className = 'log-item';
        li.innerHTML = `
            <div class="log-time">${timeStr}</div>
            <div class="log-name">${escapeHtml(item.name)}</div>
            <div class="log-phone">${escapeHtml(item.phone)}</div>
            ${messageText}
        `;

        li.onclick = () => {
            markersSource.forEach(m => {
                if (map.hasLayer(m)) {
                    map.removeLayer(m);
                }
            });

            if (!map.hasLayer(marker)) {
                marker.addTo(map);
            }

            map.flyTo([item.lat, item.lng], 16);
            marker.openPopup();

            document.querySelectorAll('.log-item').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
        };

        listEl.appendChild(li);
        markersSource.push(marker);
    });
}

function escapeHtml(text) {
    if (!text) return "";
    return text.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
