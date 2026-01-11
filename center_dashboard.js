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
    sidebar.classList.toggle('hidden');
    if (map) map.invalidateSize();
    closeMenu();
}

function toggleReception() {
    const panel = document.getElementById('receptionPanel');
    const isHidden = panel.classList.contains('hidden');
    panel.classList.toggle('hidden');
    if (isHidden) fetchReceptionData();
    if (map) map.invalidateSize();
    closeMenu();
}

function fetchReceptionData() {
    if (!GAS_API_URL || GAS_API_URL.includes("YOUR_SCRIPT_URL")) return;
    fetch(GAS_API_URL)
        .then(response => response.json())
        .then(json => {
            if (json.status === 'success' && Array.isArray(json.data)) {
                renderReceptionData(json.data);
            }
        });
}

function renderReceptionData(data) {
    const waitingListEl = document.getElementById('receptionWaitingList');
    const acceptedListEl = document.getElementById('receptionAcceptedList');

    waitingListEl.innerHTML = '';
    acceptedListEl.innerHTML = '';

    const waitingData = data.filter(item => item.status !== '受付済み');
    const acceptedData = data.filter(item => item.status === '受付済み');

    // 共通のカード生成関数
    const createCard = (item) => {
        const timeStr = new Date(item.timestamp).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        const isAccepted = item.status === '受付済み';

        const card = document.createElement('div');
        card.className = 'reception-card';
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:10px;">
                <h4 style="margin:0;">${escapeHtml(item.name)}</h4>
                <span class="status-badge ${isAccepted ? 'status-accepted' : 'status-pending'}">${item.status}</span>
            </div>
            <div class="reception-info">
                <div><span class="info-label">受信日時:</span><span class="info-value">${timeStr}</span></div>
                <div><span class="info-label">電話番号:</span><span class="info-value">${escapeHtml(item.phone)}</span></div>
                ${item.message ? `<div><span class="info-label">メッセージ:</span><span class="info-value">${escapeHtml(item.message)}</span></div>` : ''}
                ${item.reply ? `<div style="margin-top:8px; display:block;"><span class="info-label">返信済み:</span><div class="info-value" style="background:#e8f4fd; padding:12px; border-radius:4px; font-size:0.85rem; border-left: 3px solid #007bff;">${escapeHtml(item.reply)}</div></div>` : ''}
                ${item.lat && item.lng ? `<div style="margin-top:5px;"><button class="btn" style="padding:4px 8px; font-size:0.75rem; background:#6c757d; color:white;" onclick="focusOnMap(${item.lat}, ${item.lng}, '${escapeHtml(item.name)}', '${escapeHtml(item.reply)}')">📍 地図で見る</button></div>` : ''}
            </div>
            
            ${!isAccepted ? `
                <button class="btn-accept" onclick="acceptReception('${escapeHtml(item.name)}', ${item.lat}, ${item.lng}, ${item.rowId})">受付する</button>
            ` : `
                <div class="reply-section" style="margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px;">
                    <textarea id="replyText_${item.rowId}" placeholder="スマホへ送信するメッセージを入力..." style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px; box-sizing:border-box; font-size:0.85rem; height:60px;"></textarea>
                    <button class="btn" style="background:#007bff; color:white; width:100%; margin-top:5px; padding:8px; font-size:0.85rem; font-weight:bold;" onclick="sendReply(${item.rowId}, '${escapeHtml(item.name)}')">メッセージを送信</button>
                </div>
            `}
        `;
        return card;
    };

    // 並び替え（最新順）
    waitingData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    acceptedData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // 受付待ちを描画
    if (waitingData.length === 0) {
        waitingListEl.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">未対応の項目はありません</p>';
    } else {
        waitingData.forEach(item => waitingListEl.appendChild(createCard(item)));
    }

    // 対応済みを描画
    if (acceptedData.length === 0) {
        acceptedListEl.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">対応済みの項目はありません</p>';
    } else {
        acceptedData.forEach(item => acceptedListEl.appendChild(createCard(item)));
    }
}

// 地図を特定の場所に移動させるヘルパー関数
function focusOnMap(lat, lng, name, reply) {
    if (!lat || !lng) return;
    markersSource.forEach(m => { if (map.hasLayer(m)) map.removeLayer(m); });
    const marker = L.marker([lat, lng]).addTo(map).bindPopup(`<b>${name}</b><br>${reply ? '返信済: ' + reply : '受付済'}`).openPopup();
    markersSource.push(marker);
    map.flyTo([lat, lng], 16);
}

async function acceptReception(name, lat, lng, rowId) {
    if (confirm(`${name} さんの位置情報を受付しますか？`)) {
        await fetch(GAS_API_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ action: 'updateStatus', rowId: rowId })
        });
        if (lat && lng) {
            markersSource.forEach(m => { if (map.hasLayer(m)) map.removeLayer(m); });
            const marker = L.marker([lat, lng]).addTo(map).bindPopup(`<b>${name}</b><br>受付済み`).openPopup();
            markersSource.push(marker);
            map.flyTo([lat, lng], 16);
        }
        alert('受付しました');
        fetchReceptionData();
        fetchData();
    }
}

async function sendReply(rowId, name) {
    const textArea = document.getElementById(`replyText_${rowId}`);
    const reply = textArea.value.trim();
    if (!reply) return alert('返信内容を入力してください');

    if (confirm(`${name} さんへ返信を送信しますか？`)) {
        try {
            await fetch(GAS_API_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify({ action: 'sendReply', rowId: rowId, reply: reply })
            });
            alert('返信を送信しました');
            textArea.value = '';
            fetchReceptionData();
            fetchData();
        } catch (e) {
            alert('送信に失敗しました');
        }
    }
}

function initMap() {
    map = L.map('map').setView([35.6895, 139.6917], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
}

function fetchData() {
    if (!GAS_API_URL || GAS_API_URL.includes("YOUR_SCRIPT_URL")) return;
    const loading = document.getElementById('loading');
    loading.style.display = 'flex';
    fetch(GAS_API_URL)
        .then(response => response.json())
        .then(json => {
            if (json.status === 'success' && Array.isArray(json.data)) renderData(json.data);
        })
        .finally(() => loading.style.display = 'none');
}

function renderData(data) {
    const listEl = document.getElementById('logList');
    listEl.innerHTML = '';
    if (data.length === 0) {
        listEl.innerHTML = '<li style="padding: 20px; text-align: center; color: #999;">データなし</li>';
        return;
    }
    data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    data.forEach((item) => {
        if (!item.lat || !item.lng) return;
        const timeStr = new Date(item.timestamp).toLocaleString('ja-JP');
        const messageText = item.message ? `<div style="font-size:0.8rem; color:#666; background:#f0f0f0; padding:4px; margin-top:4px;">${escapeHtml(item.message)}</div>` : "";
        const replyText = item.reply ? `<div style="font-size:0.8rem; color:#0e5a9c; background:#e8f4fd; padding:4px; margin-top:4px; border-left: 2px solid #007bff;">[返答]: ${escapeHtml(item.reply)}</div>` : "";

        const li = document.createElement('li');
        li.className = 'log-item';
        li.innerHTML = `
            <div class="log-time">${timeStr} <span style="float:right; font-size:0.75rem; color:${item.status === '受付済み' ? '#28a745' : '#856404'}">${item.status}</span></div>
            <div class="log-name">${escapeHtml(item.name)}</div>
            ${messageText}
            ${replyText}
        `;
        li.onclick = () => {
            markersSource.forEach(m => { if (map.hasLayer(m)) map.removeLayer(m); });
            const marker = L.marker([item.lat, item.lng]).addTo(map).bindPopup(`<b>${escapeHtml(item.name)}</b><br>${item.reply ? '返信済: ' + escapeHtml(item.reply) : '受付済'}`).openPopup();
            markersSource.push(marker);
            map.flyTo([item.lat, item.lng], 16);
        };
        listEl.appendChild(li);
    });
}

function escapeHtml(text) {
    if (!text) return "";
    return text.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
