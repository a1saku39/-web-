// IMPORTANT: Replace this URL with your deployed Google Apps Script Web App URL
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwRMlc_dUvUYZxLAqfiRLBmRkqax25R64SYHw2e8_V9Dj52_3371zVrpcY8wgSjQXs/exec";

let map;
let markersSource = []; // To store Leaflet markers

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    fetchData();

    document.getElementById('refreshBtn').addEventListener('click', fetchData);
});

function initMap() {
    // Default center (Tokyo)
    map = L.map('map').setView([35.6895, 139.6917], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
}

function fetchData() {
    if (GAS_API_URL === "YOUR_SCRIPT_URL_HERE") {
        console.warn("GAS URL not set.");
        alert("GASのURLが設定されていません。コード内のGAS_API_URLを書き換えてください。");
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
            // alert("データの取得に失敗しました: " + error.message); 
            // Mock data for demo purposes if fetch fails (e.g. invalid URL)
            console.log("Using mock data for demonstration...");
            // renderData(mockData); 
        })
        .finally(() => {
            loading.style.display = 'none';
        });
}

function renderData(data) {
    const listEl = document.getElementById('logList');
    listEl.innerHTML = '';

    // Clear existing markers
    markersSource.forEach(m => map.removeLayer(m));
    markersSource = [];

    if (data.length === 0) {
        listEl.innerHTML = '<li style="padding: 20px; text-align: center; color: #999;">データなし</li>';
        return;
    }

    // Sort by timestamp descending
    data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const bounds = L.latLngBounds();

    data.forEach((item, index) => {
        // Skip if invalid lat/lng
        if (!item.lat || !item.lng) return;

        const date = new Date(item.timestamp);
        const timeStr = date.toLocaleString('ja-JP');

        // Add to list
        const li = document.createElement('li');
        li.className = 'log-item';
        li.innerHTML = `
            <div class="log-time">${timeStr}</div>
            <div class="log-name">${escapeHtml(item.name)}</div>
            <div class="log-phone">${escapeHtml(item.phone)}</div>
        `;
        li.onclick = () => {
            map.flyTo([item.lat, item.lng], 16);
            marker.openPopup();

            // Highlight list item
            document.querySelectorAll('.log-item').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
        };
        listEl.appendChild(li);

        // Add marker
        const marker = L.marker([item.lat, item.lng])
            .addTo(map)
            .bindPopup(`<b>${escapeHtml(item.name)}</b><br>${timeStr}`);

        markersSource.push(marker);
        bounds.extend([item.lat, item.lng]);

        // Highlight first item (latest) on map optionally?
        if (index === 0) {
            // marker.openPopup(); 
        }
    });

    if (markersSource.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Mock Data for testing layout
const mockData = [
    { timestamp: "2023-10-27T10:00:00.000Z", name: "山田 太郎", phone: "090-1111-2222", lat: 35.6895, lng: 139.6917 },
    { timestamp: "2023-10-27T10:05:00.000Z", name: "鈴木 花子", phone: "080-3333-4444", lat: 35.6586, lng: 139.7454 },
];
