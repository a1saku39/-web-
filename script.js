document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const START_HOUR = 7.5;
    const END_HOUR = 20.5;
    const HOURS_COUNT = END_HOUR - START_HOUR;
    const PIXELS_PER_HOUR = 100;
    const SNAP_MINUTES = 15;
    const PIXELS_PER_SNAP = PIXELS_PER_HOUR * (SNAP_MINUTES / 60);
    const EVENT_HEIGHT = 38; // Matches CSS

    // --- State Management ---
    const initialCustomers = [
        { id: 'c1', name: '山田 太郎', kana: 'ヤマダ タロウ', phone: '090-1111-1111', careLevel: '要介護1', wheelchair: false, address: '山田様自宅', defaultDestination: '市民病院', note: '玄関まで介助', excludeDrivers: '' },
        { id: 'c2', name: '田中 次郎', kana: 'タナカ ジロウ', phone: '090-2222-2222', careLevel: '要介護2', wheelchair: true, address: '田中様自宅', defaultDestination: 'リハビリセンター', note: '', excludeDrivers: '佐藤' }
    ];

    const initialDrivers = [
        { id: 'd1', name: '佐藤' },
        { id: 'd2', name: '鈴木' },
        { id: 'd3', name: '川上' },
        { id: 'd4', name: '高橋' }
    ];

    let customers = loadData('customers') || initialCustomers;
    let drivers = loadData('drivers') || initialDrivers;
    let vehicles = loadData('vehicles') || [];
    let bookings = loadData('bookings') || [];

    ensureVehicleStructure();

    function loadData(key) {
        const stored = localStorage.getItem('transport_sys_' + key);
        return stored ? JSON.parse(stored) : null;
    }

    function saveData() {
        localStorage.setItem('transport_sys_vehicles', JSON.stringify(vehicles));
        localStorage.setItem('transport_sys_customers', JSON.stringify(customers));
        localStorage.setItem('transport_sys_drivers', JSON.stringify(drivers));
        localStorage.setItem('transport_sys_bookings', JSON.stringify(bookings));
    }

    function ensureVehicleStructure() {
        let updated = false;
        drivers.forEach(d => {
            for (let i = 0; i < 4; i++) {
                let v = vehicles.find(veh => veh.driverId === d.id && veh.slot === i);
                if (!v) {
                    v = {
                        id: `v_${d.id}_${i}_` + Date.now(),
                        name: '',
                        driverId: d.id,
                        driver: d.name,
                        slot: i
                    };
                    vehicles.push(v);
                    updated = true;
                }
            }
        });
        if (updated) saveData();
    }

    // --- DOM Elements ---
    const timelineHeader = document.getElementById('timelineHeader');
    const schedulerGrid = document.getElementById('schedulerGrid');

    // Date Navigation
    const dateInput = document.getElementById('dateInput');
    const prevDayBtn = document.getElementById('prevDayBtn');
    const nextDayBtn = document.getElementById('nextDayBtn');

    // Booking Modal
    const bookingModal = document.getElementById('bookingModal');
    const bookingForm = document.getElementById('bookingForm');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const deleteBtn = document.getElementById('deleteBookingBtn');
    const createBtn = document.querySelector('.btn.primary');
    const customerSelect = document.getElementById('customerSelect');

    // Master Modal (Driver/Vehicle)
    const masterModal = document.getElementById('masterModal');
    const openMasterBtn = document.getElementById('openMasterBtn');
    const closeMasterBtn = document.getElementById('closeMasterBtn');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    const driverList = document.getElementById('driverList');
    const addDriverBtn = document.getElementById('addDriverBtn');
    const newDriverName = document.getElementById('newDriverName');

    const vehicleList = document.getElementById('vehicleList');
    const addVehicleBtn = document.getElementById('addVehicleBtn');
    const newVehicleName = document.getElementById('newVehicleName');

    // Customer Modal
    const customerModal = document.getElementById('customerModal');
    const openCustomerBtn = document.getElementById('openCustomerBtn');
    const closeCustomerBtn = document.getElementById('closeCustomerBtn');
    const customerList = document.getElementById('customerList');
    const addCustomerBtn = document.getElementById('addCustomerBtn');
    const manageCustomerSearch = document.getElementById('manageCustomerSearch');

    // --- Initialization ---
    initDateController();
    initTimelineHeader();
    initBookingModal();
    renderGrid();
    renderBookings();
    initMasterModal();
    initCustomerModal();

    // --- Date Controller ---
    function initDateController() {
        const today = new Date();
        setDate(today);

        prevDayBtn.addEventListener('click', () => changeDate(-1));
        nextDayBtn.addEventListener('click', () => changeDate(1));
        dateInput.addEventListener('change', (e) => {
            // Future: reload bookings for selected date
        });
    }

    function setDate(date) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        dateInput.value = `${yyyy}-${mm}-${dd}`;
    }

    function changeDate(days) {
        const current = new Date(dateInput.value);
        current.setDate(current.getDate() + days);
        setDate(current);
        // Future: reload bookings here
    }

    // --- Scheduler Layout & Rendering ---

    function initTimelineHeader() {
        timelineHeader.innerHTML = `
            <div class="corner-cell">
                <div class="corner-header" style="width:80px; border-right:1px solid #ccc;">氏名</div>
                <div class="corner-header" style="flex:1;">車番</div>
            </div>
        `;
        for (let t = START_HOUR; t < END_HOUR; t += 0.5) {
            const label = document.createElement('div');
            label.className = 'time-label';
            label.textContent = formatTime(t);
            label.style.minWidth = `${PIXELS_PER_HOUR / 2}px`;
            timelineHeader.appendChild(label);
        }
    }

    function renderGrid() {
        schedulerGrid.innerHTML = '';

        drivers.forEach(driver => {
            const driverGroup = document.createElement('div');
            driverGroup.className = 'driver-group';

            const driverInfo = document.createElement('div');
            driverInfo.className = 'driver-info-cell';
            driverInfo.textContent = driver.name;
            driverInfo.title = 'クリックしてドライバー名を変更';
            driverInfo.style.cursor = 'pointer';
            driverInfo.addEventListener('click', (e) => {
                e.stopPropagation();
                openDriverNameEdit(driver, driverInfo);
            });
            driverGroup.appendChild(driverInfo);

            const slotsContainer = document.createElement('div');
            slotsContainer.className = 'driver-slots-container';

            for (let slot = 0; slot < 4; slot++) {
                let vehicle = vehicles.find(v => v.driverId === driver.id && v.slot === slot);
                if (!vehicle) {
                    vehicle = { id: `v_${driver.id}_${slot}_temp`, name: '', driverId: driver.id, slot: slot };
                }

                const slotRow = document.createElement('div');
                slotRow.className = 'slot-row';
                slotRow.dataset.vehicleId = vehicle.id;

                const vehicleCell = document.createElement('div');
                vehicleCell.className = 'vehicle-cell';
                vehicleCell.textContent = vehicle.name || '';
                vehicleCell.title = '車番を編集';
                vehicleCell.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openVehicleEdit(vehicle, vehicleCell);
                });

                const track = document.createElement('div');
                track.className = 'timeline-track';
                track.id = `track-${vehicle.id}`;
                track.style.width = `${HOURS_COUNT * PIXELS_PER_HOUR}px`;

                slotRow.appendChild(vehicleCell);
                slotRow.appendChild(track);
                slotsContainer.appendChild(slotRow);
            }

            driverGroup.appendChild(slotsContainer);
            schedulerGrid.appendChild(driverGroup);
        });
    }

    function openDriverNameEdit(driver, element) {
        if (element.querySelector('select')) return;

        const currentName = driver.name;
        const select = document.createElement('select');
        select.style.width = '100%';

        // Use all available driver names from the master list
        // This allows "switching" the name of the driver in this row to match another existing one?
        // Or simply picking from a list of valid names? 
        // Typically, editing the name here means updating the master record.
        // But if the user wants to "Select from list", maybe they want to normalize names.
        // Let's list all current driver names + option to edit?
        // Actually, if we just want to RENAME the driver from a list of suggestions?
        // Or maybe they want to assign a different driver to this "row" (which is ID based)?
        // If we change the name here, it updates the driver object with that ID.

        // Let's assume we list all unique names currently in 'drivers'.
        // This acts like a standardizer.
        const knownNames = drivers.map(d => d.name);

        knownNames.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            if (name === currentName) opt.selected = true;
            select.appendChild(opt);
        });

        // Also allow adding a new name? No, request was "Select from list".
        // But if we only allow selecting existing names, we can't Add new ones or Fix typos easily unless they are in the list.
        // However, user said "Select from list", implying the list should be the source of truth.
        // Let's stick to the Select implementation.

        element.innerHTML = '';
        element.appendChild(select);
        select.focus();

        const save = () => {
            const newName = select.value;
            if (newName && newName !== currentName) {
                if (confirm(`ドライバー名を「${currentName}」から「${newName}」に変更しますか？\n(同じ名前のドライバーが既に存在する場合、重複することになります)`)) {
                    driver.name = newName;
                    // Update associated vehicles' driver name cache
                    vehicles.filter(v => v.driverId === driver.id).forEach(v => v.driver = newName);
                    saveData();
                    renderGrid();
                    renderMasterLists(); // Refresh master list UI if open
                } else {
                    element.textContent = currentName; // Revert
                }
            } else {
                element.textContent = currentName; // Revert/No change
            }
        };

        select.addEventListener('blur', save);
        select.addEventListener('change', () => {
            save();
            select.blur();
        });
        select.addEventListener('click', e => e.stopPropagation());
    }

    function openVehicleEdit(vehicle, element) {
        if (element.querySelector('select')) return; // Check for select instead of input

        const currentName = vehicle.name;

        // Use a select dropdown instead of text input
        const select = document.createElement('select');
        select.style.width = '100%';

        // Collect all available vehicle names from the master list (filtering out duplicates/empties)
        // We look at all 'vehicles' that have a name assigned.
        const knownNames = Array.from(new Set(vehicles.map(v => v.name).filter(n => n)));

        // Option 1: "(なし)" (Clear)
        const emptyOpt = document.createElement('option');
        emptyOpt.value = "";
        emptyOpt.textContent = "(なし)";
        select.appendChild(emptyOpt);

        // Add options from known vehicle names
        knownNames.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            // Pre-select if matches
            if (name === currentName) opt.selected = true;
            select.appendChild(opt);
        });

        // If the current name is custom/not in list (though ideally it should be), add it?
        // For strict master selection, we might not want ad-hoc values, but let's stick to the list.
        // If currentName is not in knownNames and not empty, maybe show it as an option or lose it?
        // Let's assume we only want to pick from the list. If it was a custom value, add it as a selected option.
        if (currentName && !knownNames.includes(currentName)) {
            const opt = document.createElement('option');
            opt.value = currentName;
            opt.textContent = currentName;
            opt.selected = true;
            select.appendChild(opt);
        }

        element.innerHTML = '';
        element.appendChild(select);
        select.focus();

        const save = () => {
            const newName = select.value;
            vehicle.name = newName;
            element.textContent = newName || ''; // If empty, show nothing (or could show placeholder?)
            saveData();
        };

        // Save on change or blur
        select.addEventListener('blur', save);
        select.addEventListener('change', () => {
            save();
            select.blur(); // Blur to close/finish editing
        });
        select.addEventListener('click', (e) => e.stopPropagation());
    }

    // --- Bookings ---
    function renderBookings() {
        console.log('renderBookings() called');
        console.log('Total bookings:', bookings.length);
        console.log('Bookings data:', bookings);

        document.querySelectorAll('.event-block').forEach(el => el.remove());

        bookings.forEach(booking => {
            console.log('Processing booking:', booking);
            const track = document.getElementById(`track-${booking.vehicleId}`);
            console.log(`Looking for track: track-${booking.vehicleId}`, track);

            if (track) {
                const el = createEventElement(booking);
                track.appendChild(el);
                console.log('Event element added to track');
            } else {
                console.warn(`Track not found for vehicle ID: ${booking.vehicleId}`);
            }
        });

        console.log('renderBookings() completed');
    }

    function createEventElement(booking) {
        const el = document.createElement('div');
        el.className = 'event-block';
        el.id = booking.id;
        el.dataset.bookingId = booking.id;

        const [startH, startM] = booking.start.split(':').map(Number);
        const [endH, endM] = booking.end.split(':').map(Number);
        const startOffset = (startH + startM / 60) - START_HOUR;
        const duration = (endH + endM / 60) - (startH + startM / 60);

        el.style.left = `${startOffset * PIXELS_PER_HOUR}px`;
        el.style.width = `${duration * PIXELS_PER_HOUR}px`;
        // Top is handled by CSS (centered)

        renderEventContent(el, booking);
        setupInteraction(el);

        el.addEventListener('click', (e) => {
            if (el.classList.contains('dragging') || e.target.classList.contains('resize-handle')) return;
            openBookingModal(booking);
        });

        return el;
    }

    function renderEventContent(el, booking) {
        while (el.firstChild) { el.removeChild(el.firstChild); }

        let tooltip = `利用: ${booking.passenger}\n時間: ${booking.start}-${booking.end}\n迎: ${booking.pickupLocation || ''}\n送: ${booking.destination || ''}\nメモ: ${booking.note || ''}`;
        el.title = tooltip;

        const container = document.createElement('div');
        container.className = 'event-content';

        const line1 = document.createElement('div');
        line1.className = 'event-line line-time';
        let tText = `${booking.start} ${booking.passenger}`;
        if (booking.wheelchair) tText = "♿ " + tText;
        line1.textContent = tText;
        container.appendChild(line1);

        if (booking.destination) {
            const line2 = document.createElement('div');
            line2.className = 'event-line line-destination';
            line2.textContent = booking.destination;
            container.appendChild(line2);
        } else if (booking.pickupLocation) {
            const line2 = document.createElement('div');
            line2.className = 'event-line line-address';
            line2.textContent = booking.pickupLocation;
            container.appendChild(line2);
        }

        el.appendChild(container);

        ['left', 'right'].forEach(pos => {
            const h = document.createElement('div');
            h.className = `resize-handle ${pos}`;
            el.appendChild(h);
        });
    }

    function timeToDecimal(timeStr) {
        const [h, m] = timeStr.split(':').map(Number);
        return h + m / 60;
    }

    // --- Drag & Drop ---
    function setupInteraction(element) { element.addEventListener('mousedown', handleMouseDown); }

    function handleMouseDown(e) {
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation();

        const el = e.currentTarget.closest('.event-block');
        if (!el) return;

        const isResizeLeft = e.target.classList.contains('left');
        const isResizeRight = e.target.classList.contains('right');
        const isMove = !isResizeLeft && !isResizeRight;

        const bookingId = el.dataset.bookingId;
        const booking = bookings.find(b => b.id === bookingId);
        const startX = e.clientX;
        const initialLeft = parseFloat(el.style.left) || 0;
        const initialWidth = parseFloat(el.style.width) || 0;
        let currentTrack = el.parentElement;
        let isDragging = false;

        el.style.transition = 'none';

        const onMouseMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            if (!isDragging && Math.abs(deltaX) > 3) {
                isDragging = true;
                el.classList.add('dragging');
                document.body.style.cursor = isMove ? 'grabbing' : 'col-resize';
            }
            if (!isDragging) return;

            if (isMove) {
                const nl = Math.round((initialLeft + deltaX) / PIXELS_PER_SNAP) * PIXELS_PER_SNAP;
                el.style.left = `${nl}px`;

                const tracks = document.querySelectorAll('.timeline-track');
                for (const tr of tracks) {
                    const rect = tr.getBoundingClientRect();
                    if (moveEvent.clientY >= rect.top && moveEvent.clientY <= rect.bottom) {
                        if (tr !== currentTrack) {
                            tr.appendChild(el);
                            currentTrack = tr;
                        }
                        break;
                    }
                }
            } else if (isResizeRight) {
                const nw = Math.max(PIXELS_PER_SNAP, Math.round((initialWidth + deltaX) / PIXELS_PER_SNAP) * PIXELS_PER_SNAP);
                el.style.width = `${nw}px`;
            } else if (isResizeLeft) {
                const nl = Math.min(initialLeft + initialWidth - PIXELS_PER_SNAP, Math.round((initialLeft + deltaX) / PIXELS_PER_SNAP) * PIXELS_PER_SNAP);
                const nw = (initialLeft + initialWidth) - nl;
                el.style.left = `${nl}px`;
                el.style.width = `${nw}px`;
            }
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            el.style.transition = '';

            if (isDragging) {
                el.classList.remove('dragging');
                const fl = parseFloat(el.style.left);
                const fw = parseFloat(el.style.width);
                booking.start = formatTime(START_HOUR + (fl / PIXELS_PER_HOUR));
                booking.end = formatTime(START_HOUR + (fl / PIXELS_PER_HOUR) + (fw / PIXELS_PER_HOUR));
                if (currentTrack) booking.vehicleId = currentTrack.id.replace('track-', '');
                saveData();
                renderBookings();
            }
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    function formatTime(decimalHours) {
        let hours = Math.floor(decimalHours);
        let minutes = Math.round((decimalHours - hours) * 60);
        if (minutes >= 60) { hours++; minutes = 0; }
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    // --- Modal Logic ---
    function initBookingModal() {
        const searchInput = document.getElementById('customerSearchInput');
        const resultsContainer = document.getElementById('customerSearchResults');

        // Customer search functionality
        if (searchInput && resultsContainer) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.trim();
                if (query.length > 0) {
                    searchCustomers(query, resultsContainer);
                } else {
                    resultsContainer.style.display = 'none';
                    resultsContainer.innerHTML = '';
                }
            });

            // Hide results when clicking outside
            document.addEventListener('click', (e) => {
                if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
                    resultsContainer.style.display = 'none';
                }
            });
        }

        if (createBtn) createBtn.addEventListener('click', () => openBookingModal(null));
        closeModalBtn.addEventListener('click', closeBookingModal);
        bookingModal.addEventListener('click', (e) => { if (e.target === bookingModal) closeBookingModal(); });
        bookingForm.addEventListener('submit', handleBookingSubmit);
        deleteBtn.addEventListener('click', handleBookingDelete);
    }

    function searchCustomers(query, resultsContainer) {
        const lowerQuery = query.toLowerCase();
        const filtered = customers.filter(c =>
            (c.name && c.name.toLowerCase().includes(lowerQuery)) ||
            (c.kana && c.kana.toLowerCase().includes(lowerQuery)) ||
            (c.phone && c.phone.includes(query))
        );

        resultsContainer.innerHTML = '';

        if (filtered.length === 0) {
            resultsContainer.innerHTML = '<div style="padding:8px 12px;color:#666;font-size:0.8rem;">見つかりませんでした</div>';
            resultsContainer.style.display = 'block';
            return;
        }

        filtered.forEach(c => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.innerHTML = `
                <div class="name">${c.name || ''}</div>
                <div class="meta">${c.kana || ''} / ${c.phone || ''} / ${c.careLevel || ''}</div>
            `;
            item.addEventListener('click', () => {
                selectCustomer(c);
                resultsContainer.style.display = 'none';
                document.getElementById('customerSearchInput').value = c.name || '';
            });
            resultsContainer.appendChild(item);
        });

        resultsContainer.style.display = 'block';
    }

    function selectCustomer(customer) {
        document.getElementById('editPassenger').value = customer.name;
        document.getElementById('editCareLevel').value = customer.careLevel || '';
        document.getElementById('editWheelchair').checked = customer.wheelchair || false;
        document.getElementById('editPickupLocation').value = customer.address || '';
        document.getElementById('editDestination').value = customer.defaultDestination || '';
        document.getElementById('editNote').value = customer.note || '';
    }

    function openBookingModal(booking) {
        const searchInput = document.getElementById('customerSearchInput');
        const resultsContainer = document.getElementById('customerSearchResults');

        if (searchInput) searchInput.value = '';
        if (resultsContainer) {
            resultsContainer.style.display = 'none';
            resultsContainer.innerHTML = '';
        }

        populateVehicleSelect();

        if (booking) {
            document.getElementById('editBookingId').value = booking.id;
            document.getElementById('editVehicle').value = booking.vehicleId;
            document.getElementById('editPassenger').value = booking.passenger;
            document.getElementById('editStart').value = booking.start;
            document.getElementById('editEnd').value = booking.end;
            document.getElementById('editCareLevel').value = booking.careLevel || '';
            document.getElementById('editWheelchair').checked = booking.wheelchair || false;
            document.getElementById('editPickupLocation').value = booking.pickupLocation || '';
            document.getElementById('editDestination').value = booking.destination || '';
            document.getElementById('editNote').value = booking.note || '';

            document.querySelector('#bookingModal .modal-header h3').textContent = '予約詳細';
            deleteBtn.style.display = 'block';
        } else {
            document.getElementById('bookingForm').reset();
            document.getElementById('editBookingId').value = '';

            // Default to first vehicle
            populateVehicleSelect();
            if (vehicles.length > 0) document.getElementById('editVehicle').value = vehicles[0].id;

            document.getElementById('editStart').value = '09:00';
            document.getElementById('editEnd').value = '10:00';
            document.querySelector('#bookingModal .modal-header h3').textContent = '新規予約作成';
            deleteBtn.style.display = 'none';
        }
        bookingModal.classList.remove('hidden');
    }

    function populateVehicleSelect() {
        const select = document.getElementById('editVehicle');
        if (!select) return;
        select.innerHTML = '';

        const sortedVehicles = [...vehicles].sort((a, b) => {
            if (a.driverId < b.driverId) return -1;
            if (a.driverId > b.driverId) return 1;
            return a.slot - b.slot;
        });

        sortedVehicles.forEach(v => {
            const driverName = v.driver || '担当なし';
            // Use [VehicleName] or [SlotNumber]
            const vehicleLabel = v.name || `枠${v.slot + 1}`;
            const option = document.createElement('option');
            option.value = v.id;
            // Format: DriverName 【VehicleName】
            option.textContent = `${driverName} 【${vehicleLabel}】`;
            select.appendChild(option);
        });
    }

    function closeBookingModal() { bookingModal.classList.add('hidden'); }

    function handleBookingSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('editBookingId').value;
        const booking = id ? bookings.find(b => b.id === id) : null;
        const selectedVehicleId = document.getElementById('editVehicle').value;

        const data = {
            id: id || ('b' + Date.now()),
            vehicleId: selectedVehicleId || (booking ? booking.vehicleId : (vehicles.length > 0 ? vehicles[0].id : 'v1')),
            passenger: document.getElementById('editPassenger').value,
            start: document.getElementById('editStart').value,
            end: document.getElementById('editEnd').value,
            careLevel: document.getElementById('editCareLevel').value,
            wheelchair: document.getElementById('editWheelchair').checked,
            pickupLocation: document.getElementById('editPickupLocation').value,
            destination: document.getElementById('editDestination').value,
            note: document.getElementById('editNote').value
        };

        console.log('予約データ:', data);
        console.log('選択された車両ID:', selectedVehicleId);
        console.log('既存の予約:', booking);

        if (booking) Object.assign(booking, data);
        else bookings.push(data);

        console.log('保存後の予約リスト:', bookings);

        saveData();
        renderBookings();
        closeBookingModal();
    }

    function handleBookingDelete() {
        const id = document.getElementById('editBookingId').value;
        if (id && confirm('本当に削除しますか？')) {
            bookings = bookings.filter(b => b.id !== id);
            saveData();
            renderBookings();
            closeBookingModal();
        }
    }

    // --- Master Modal (Driver / Vehicle) ---
    function initMasterModal() {
        openMasterBtn.addEventListener('click', () => { renderMasterLists(); masterModal.classList.remove('hidden'); });
        closeMasterBtn.addEventListener('click', () => masterModal.classList.add('hidden'));
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(btn.dataset.tab).classList.add('active');
            });
        });

        addDriverBtn.addEventListener('click', () => {
            const name = newDriverName.value.trim();
            if (name) {
                const newDriver = { id: 'd' + Date.now(), name };
                drivers.push(newDriver);
                newDriverName.value = '';
                ensureVehicleStructure();
                saveData();
                renderMasterLists();
                renderGrid();
            }
        });
        // Note: Customer logic moved to initCustomerModal
    }

    function renderMasterLists() {
        driverList.innerHTML = '';
        drivers.forEach(d => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.alignItems = 'center';
            li.innerHTML = `
                <span class="edit-target" style="flex:1; cursor:pointer;" title="クリックで編集">${d.name}</span>
                <button class="icon-btn del-btn">🗑️</button>
            `;

            // Edit
            li.querySelector('.edit-target').addEventListener('click', function () {
                const currentText = d.name;
                const input = document.createElement('input');
                input.type = 'text';
                input.value = currentText;
                input.style.width = '100%';

                const save = () => {
                    const val = input.value.trim();
                    if (val && val !== currentText) {
                        d.name = val;
                        // Update linked vehicles
                        vehicles.filter(v => v.driverId === d.id).forEach(v => v.driver = val);
                        saveData();
                        renderMasterLists();
                        renderGrid();
                    } else {
                        renderMasterLists(); // Cancel
                    }
                };

                input.addEventListener('blur', save);
                input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
                this.replaceWith(input);
                input.focus();
            });

            // Delete
            li.querySelector('.del-btn').onclick = () => {
                if (confirm('削除しますか？')) {
                    drivers = drivers.filter(dr => dr.id !== d.id);
                    vehicles = vehicles.filter(v => v.driverId !== d.id);
                    saveData();
                    renderMasterLists();
                    renderGrid();
                }
            };
            driverList.appendChild(li);
        });

        vehicleList.innerHTML = '';
        vehicles.forEach(v => {
            if (v.name) {
                const li = document.createElement('li');
                li.style.display = 'flex';
                li.style.alignItems = 'center';
                li.innerHTML = `<span style="margin-right:8px; color:#666; font-size:0.9em;">${v.driver}</span> <span class="edit-target" style="flex:1; cursor:pointer; font-weight:bold;" title="クリックして編集">${v.name}</span> <button class="icon-btn del-btn">🗑️</button>`;

                // Edit
                li.querySelector('.edit-target').addEventListener('click', function () {
                    const currentText = v.name;
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.value = currentText;
                    input.style.width = '100%';
                    const save = () => {
                        const val = input.value.trim();
                        if (val !== currentText) {
                            v.name = val;
                            saveData();
                            renderMasterLists();
                            renderGrid();
                        } else {
                            renderMasterLists();
                        }
                    };
                    input.addEventListener('blur', save);
                    input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
                    this.replaceWith(input);
                    input.focus();
                });

                // Delete (Clear name)
                li.querySelector('.del-btn').onclick = () => {
                    if (confirm('車番をクリアしますか？')) { v.name = ''; saveData(); renderMasterLists(); renderGrid(); }
                };
                vehicleList.appendChild(li);
            }
        });
    }

    // --- Customer Modal ---
    // --- Customer Modal ---
    function initCustomerModal() {
        openCustomerBtn.addEventListener('click', () => {
            // Clear list on open, wait for search
            customerList.innerHTML = '<li style="color:#666; text-align:center;">検索してください</li>';
            manageCustomerSearch.value = '';
            customerModal.classList.remove('hidden');
        });
        closeCustomerBtn.addEventListener('click', () => customerModal.classList.add('hidden'));

        addCustomerBtn.addEventListener('click', () => {
            const name = document.getElementById('newCustomerName').value.trim();
            if (!name) return alert('氏名は必須です');
            const newCustomer = {
                id: 'c' + Date.now(),
                name: name,
                kana: document.getElementById('newCustomerKana').value.trim(),
                phone: document.getElementById('newCustomerPhone').value.trim(),
                careLevel: document.getElementById('newCustomerCare').value,
                address: document.getElementById('newCustomerAddress').value.trim(),
                wheelchair: document.getElementById('newCustomerWheelchair').checked,
                defaultDestination: document.getElementById('newCustomerDestination').value.trim(),
                excludeDrivers: document.getElementById('newCustomerExcludeDriver').value.trim(),
                note: document.getElementById('newCustomerNote').value.trim()
            };
            customers.push(newCustomer);

            // Clear form
            document.getElementById('newCustomerName').value = '';
            document.getElementById('newCustomerKana').value = '';
            document.getElementById('newCustomerPhone').value = '';
            document.getElementById('newCustomerAddress').value = '';
            document.getElementById('newCustomerDestination').value = '';
            document.getElementById('newCustomerExcludeDriver').value = '';
            document.getElementById('newCustomerNote').value = '';
            document.getElementById('newCustomerWheelchair').checked = false;

            saveData();
            // Show added customer in list? or just alert.
            // Let's show search results for the added name so the user sees it.
            renderCustomerList(name);
            alert('登録しました');
        });

        if (manageCustomerSearch) {
            manageCustomerSearch.addEventListener('input', (e) => {
                const val = e.target.value.trim();
                if (val) renderCustomerList(val);
                else customerList.innerHTML = '<li style="color:#666; text-align:center;">検索してください</li>';
            });
        }
    }

    function renderCustomerList(query = '') {
        customerList.innerHTML = '';
        // If query is empty, show nothing (OR could show "please search")
        // But the caller handles the empty message usually.
        if (!query) return;

        const filtered = customers.filter(c =>
            (c.name && c.name.includes(query)) ||
            (c.kana && c.kana.includes(query))
        );

        if (filtered.length === 0) {
            customerList.innerHTML = '<li style="color:#666; text-align:center;">見つかりませんでした</li>';
            return;
        }

        filtered.forEach(c => {
            const li = document.createElement('li');
            li.innerHTML = `<div><div style="font-weight:600">${c.name}</div><div style="font-size:0.8rem; color:#666">${c.address || ''}</div></div><button class="icon-btn">🗑️</button>`;
            li.querySelector('button').onclick = () => { if (confirm('削除?')) { customers = customers.filter(cus => cus.id !== c.id); saveData(); renderCustomerList(query); populateCustomerSelect(); } };
            customerList.appendChild(li);
        });
    }

});
