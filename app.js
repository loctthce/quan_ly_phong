/**
 * app.js — Quản Lý Phòng Học
 * Vanilla JS, sử dụng Supabase qua supabase-client.js
 */

const App = (() => {

  // ── State ────────────────────────────────────────────────────────────────
  let state = {
    page: 'schedule',
    rooms: [], teachers: [], timeslots: [], schedules: [],
    loading: false,
  };

  const DAYS = [
    { key: 2, label: 'Thứ 2' },
    { key: 3, label: 'Thứ 3' },
    { key: 4, label: 'Thứ 4' },
    { key: 5, label: 'Thứ 5' },
    { key: 6, label: 'Thứ 6' },
    { key: 7, label: 'Thứ 7' },
    { key: 8, label: 'Chủ nhật' },
  ];

  // ── Init ─────────────────────────────────────────────────────────────────
  function init() {
    const cfg = SupabaseClient.loadConfig();
    if (cfg.url && cfg.key) {
      try {
        SupabaseClient.init(cfg.url, cfg.key);
        setStatusConnected();
        document.getElementById('config-backdrop').classList.add('hidden');
        loadAllData().then(() => navigate('schedule'));
      } catch (err) {
        console.error('Lỗi khởi tạo Supabase:', err);
        showConfigModal();
      }
    } else {
      // Chưa có config ở đâu cả → hiện modal nhập tay
      showConfigModal();
    }
  }

  function showConfigModal() {
    const bd = document.getElementById('config-backdrop');
    bd.classList.remove('hidden');
    const cfg = SupabaseClient.loadConfig();
    document.getElementById('cfg-url').value = cfg.url || '';
    document.getElementById('cfg-key').value = cfg.key || '';
  }

  async function saveConfig() {
    const url = document.getElementById('cfg-url').value.trim();
    const key = document.getElementById('cfg-key').value.trim();
    if (!url || !key) { showToast('Vui lòng nhập đủ URL và Key!', 'error'); return; }
    try {
      SupabaseClient.saveConfig(url, key);
      SupabaseClient.init(url, key);
      // Test connection
      await SupabaseClient.getRooms();
      setStatusConnected();
      document.getElementById('config-backdrop').classList.add('hidden');
      showToast('Kết nối Supabase thành công! 🎉', 'success');
      await loadAllData();
      navigate('schedule');
    } catch (err) {
      showToast('Lỗi kết nối: ' + err.message, 'error');
      SupabaseClient.clearConfig();
      setStatusError();
    }
  }

  function setStatusConnected() {
    document.getElementById('status-dot').className  = 'status-dot connected';
    document.getElementById('status-text').textContent = 'Đã kết nối';
  }
  function setStatusError() {
    document.getElementById('status-dot').className  = 'status-dot error';
    document.getElementById('status-text').textContent = 'Lỗi kết nối';
  }

  // ── Load all data ─────────────────────────────────────────────────────────
  async function loadAllData() {
    if (!SupabaseClient.isReady()) return;
    try {
      const [rooms, teachers, timeslots, schedules] = await Promise.all([
        SupabaseClient.getRooms(),
        SupabaseClient.getTeachers(),
        SupabaseClient.getTimeslots(),
        SupabaseClient.getSchedules(),
      ]);
      state.rooms     = rooms     || [];
      state.teachers  = teachers  || [];
      state.timeslots = timeslots || [];
      state.schedules = schedules || [];
    } catch (err) {
      showToast('Lỗi tải dữ liệu: ' + err.message, 'error');
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  function navigate(page) {
    state.page = page;
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
    // Render page
    const titles = {
      schedule:    '📅 Thời Khóa Biểu',
      rooms:       '🚪 Quản Lý Phòng',
      teachers:    '👨‍🏫 Giáo Viên',
      timeslots:   '🕐 Giờ Học',
      assignments: '✏️ Phân Công Lịch',
    };
    document.getElementById('page-title').textContent = titles[page] || page;
    renderPage(page);
    closeSidebar();
  }

  function renderPage(page) {
    const content   = document.getElementById('content');
    const topbarAct = document.getElementById('topbar-actions');
    topbarAct.innerHTML = '';

    if (!SupabaseClient.isReady()) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚙️</div>
          <h3>Chưa kết nối Supabase</h3>
          <p>Nhấn vào trạng thái kết nối ở cuối sidebar để cấu hình.</p>
          <br><button class="btn btn-primary" onclick="App.showConfigModal()">Cấu hình ngay</button>
        </div>`;
      return;
    }

    switch (page) {
      case 'schedule':    renderSchedule(content, topbarAct); break;
      case 'rooms':       renderRoomsPage(content, topbarAct); break;
      case 'teachers':    renderTeachersPage(content, topbarAct); break;
      case 'timeslots':   renderTimeslotsPage(content, topbarAct); break;
      case 'assignments': renderAssignmentsPage(content, topbarAct); break;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE: THỜI KHÓA BIỂU
  // ═══════════════════════════════════════════════════════════════════════
  function renderSchedule(content, actions) {
    actions.innerHTML = `
      <button class="btn btn-secondary btn-sm" onclick="App.refreshAll()">🔄 Làm mới</button>
      <button class="btn btn-copy-day btn-sm" onclick="App.openCopyDayModal()">📋 Sao chép ngày</button>
      <button class="btn btn-primary btn-sm" onclick="App.navigate('assignments')">+ Thêm lịch</button>
    `;

    if (state.rooms.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🚪</div>
          <h3>Chưa có phòng học nào</h3>
          <p>Vào <strong>Quản Lý Phòng</strong> để thêm phòng trước.</p>
        </div>`;
      return;
    }

    // Build lookup maps
    const scheduleMap = buildScheduleMap();

    // Header các thứ — thêm nút copy nhỏ
    const thDays = DAYS.map(d => `
      <th>
        <div class="tkb-th-inner">
          <span>${d.label}</span>
          <button class="btn-copy-col" onclick="App.openCopyDayModal(${d.key})" title="Sao chép ${d.label} sang ngày khác">⧉</button>
        </div>
      </th>`).join('');

    const rows = state.rooms.map(room => {
      const cells = DAYS.map(d => {
        const slots = (scheduleMap[room.id] && scheduleMap[room.id][d.key]) || [];
        slots.sort((a, b) => (a.timeslots.start_time > b.timeslots.start_time ? 1 : -1));
        const slotsHtml = slots.length
          ? slots.map(s => renderClassSlot(s)).join('')
          : `<div class="tkb-empty">—</div>`;
        return `
          <td class="tkb-day-cell">
            ${slotsHtml}
            <button class="btn-add-slot" onclick="App.openAddSlot(${room.id}, ${d.key})" title="Thêm lịch">
              + Thêm
            </button>
          </td>`;
      }).join('');

      return `
        <tr>
          <td class="tkb-room-cell">
            <span class="room-name-text">${escHtml(room.name)}</span>
            ${room.description ? `<span class="room-sub">${escHtml(room.description)}</span>` : ''}
          </td>
          ${cells}
        </tr>`;
    }).join('');

    content.innerHTML = `
      <div class="tkb-wrap">
        <table class="tkb-table">
          <thead>
            <tr>
              <th>Phòng học</th>
              ${thDays}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function buildScheduleMap() {
    // map[room_id][day_of_week] = [schedule, ...]
    const map = {};
    state.schedules.forEach(s => {
      const rid = s.rooms.id;
      const day = s.day_of_week;
      if (!map[rid]) map[rid] = {};
      if (!map[rid][day]) map[rid][day] = [];
      map[rid][day].push(s);
    });
    return map;
  }

  function getSlotClass(startTime) {
    if (!startTime) return 'slot-default';
    const h = parseInt(startTime.split(':')[0], 10);
    if (h < 12)  return 'slot-morning';
    if (h < 18)  return 'slot-afternoon';
    return 'slot-evening';
  }

  function renderClassSlot(s) {
    const slotClass = getSlotClass(s.timeslots.start_time);
    const color     = s.teachers.color || '#4f46e5';
    const timeLabel = `${s.timeslots.start_time.slice(0,5)} – ${s.timeslots.end_time.slice(0,5)}`;
    return `
      <div class="class-slot ${slotClass}" style="border-left-color:${color};">
        <div class="slot-teacher" style="color:${color};">${escHtml(s.teachers.name)}</div>
        <div class="slot-time">${timeLabel}</div>
        ${s.note ? `<div class="slot-time" style="font-style:italic;">${escHtml(s.note)}</div>` : ''}
        <div class="slot-actions">
          <button class="slot-btn del" onclick="App.deleteSlot(${s.id})" title="Xóa">✕</button>
        </div>
      </div>`;
  }

  // Mở modal thêm lịch nhanh từ TKB
  function openAddSlot(roomId, dayOfWeek) {
    const room = state.rooms.find(r => r.id === roomId);
    const dayLabel = DAYS.find(d => d.key === dayOfWeek)?.label || '';
    openModal(`➕ Thêm lịch — ${room?.name} / ${dayLabel}`, buildAssignForm(roomId, dayOfWeek));
  }

  async function deleteSlot(id) {
    if (!confirm('Xóa lịch này?')) return;
    try {
      await SupabaseClient.deleteSchedule(id);
      state.schedules = state.schedules.filter(s => s.id !== id);
      renderPage('schedule');
      showToast('Đã xóa lịch!', 'success');
    } catch (err) {
      showToast('Lỗi: ' + err.message, 'error');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TÍNH NĂNG: SAO CHÉP LỊCH THEO NGÀY
  // ═══════════════════════════════════════════════════════════════════════
  /**
   * Mở modal sao chép ngày.
   * @param {number|null} preFromDay - Nếu bấm nút ⧉ trên cột thì pre-fill ngày nguồn
   */
  function openCopyDayModal(preFromDay = null) {
    const scheduleMap = buildScheduleMap();

    // Tạo option chọn phòng
    const roomOpts = `
      <option value="all">Tất cả các phòng</option>
      ${state.rooms.map(r => `<option value="${r.id}">${escHtml(r.name)}</option>`).join('')}
    `;

    // Tạo option chọn ngày (dùng chung cho nguồn & đích)
    const dayOpts = (selected) => DAYS.map(d =>
      `<option value="${d.key}" ${d.key === selected ? 'selected' : ''}>${d.label}</option>`
    ).join('');

    const fromDay = preFromDay || 2;
    // Đích mặc định: ngày kế tiếp khác ngày nguồn
    const toDay = DAYS.find(d => d.key !== fromDay)?.key || 3;

    openModal('📋 Sao chép lịch học theo ngày', `
      <p class="copy-day-desc">
        Sao chép toàn bộ lịch học từ một ngày sang ngày khác. 
        Các lịch đã tồn tại ở ngày đích (cùng phòng + giờ) sẽ được <strong>bỏ qua</strong>.
      </p>

      <div class="form-group">
        <label class="form-label">Phạm vi áp dụng</label>
        <select id="cp-room" class="input" onchange="App.updateCopyPreview()">${roomOpts}</select>
      </div>

      <div class="copy-day-arrow-row">
        <div class="form-group" style="flex:1">
          <label class="form-label">Ngày nguồn (sao chép từ)</label>
          <select id="cp-from" class="input" onchange="App.updateCopyPreview()">
            ${dayOpts(fromDay)}
          </select>
        </div>
        <div class="copy-arrow">→</div>
        <div class="form-group" style="flex:1">
          <label class="form-label">Ngày đích (sao chép sang)</label>
          <select id="cp-to" class="input" onchange="App.updateCopyPreview()">
            ${dayOpts(toDay)}
          </select>
        </div>
      </div>

      <!-- Preview -->
      <div id="copy-preview-box" class="copy-preview-box">
        <div class="copy-preview-loading">Đang tính toán...</div>
      </div>

      <div class="form-actions">
        <button class="btn btn-secondary" onclick="App.closeModal()">Hủy</button>
        <button class="btn btn-primary" id="btn-do-copy" onclick="App.executeCopyDay()">
          📋 Thực hiện sao chép
        </button>
      </div>
    `);

    // Render preview ngay sau khi modal mở
    setTimeout(() => updateCopyPreview(), 50);
  }

  /**
   * Cập nhật preview — hiển thị những lịch sẽ được copy / bị skip
   */
  function updateCopyPreview() {
    const roomVal = document.getElementById('cp-room')?.value;
    const fromDay = parseInt(document.getElementById('cp-from')?.value);
    const toDay   = parseInt(document.getElementById('cp-to')?.value);
    const box     = document.getElementById('copy-preview-box');
    const btnCopy = document.getElementById('btn-do-copy');
    if (!box) return;

    if (fromDay === toDay) {
      box.innerHTML = `<div class="copy-preview-warn">⚠️ Ngày nguồn và ngày đích không được giống nhau!</div>`;
      if (btnCopy) btnCopy.disabled = true;
      return;
    }

    // Lấy danh sách phòng cần xét
    const rooms = roomVal === 'all'
      ? state.rooms
      : state.rooms.filter(r => r.id === parseInt(roomVal));

    const fromDayLabel = DAYS.find(d => d.key === fromDay)?.label || '';
    const toDayLabel   = DAYS.find(d => d.key === toDay)?.label   || '';

    const toCopy = [];   // sẽ copy
    const toSkip = [];   // đã có → skip

    rooms.forEach(room => {
      const srcSlots = state.schedules.filter(
        s => s.rooms.id === room.id && s.day_of_week === fromDay
      );
      srcSlots.forEach(s => {
        const dup = state.schedules.find(
          x => x.rooms.id === room.id &&
               x.day_of_week === toDay &&
               x.timeslots.id === s.timeslots.id
        );
        if (dup) toSkip.push({ room: room.name, s });
        else     toCopy.push({ room: room.name, s });
      });
    });

    if (toCopy.length === 0 && toSkip.length === 0) {
      box.innerHTML = `
        <div class="copy-preview-empty">
          📭 Không có lịch nào ở <strong>${fromDayLabel}</strong> để sao chép.
        </div>`;
      if (btnCopy) btnCopy.disabled = true;
      return;
    }

    if (btnCopy) btnCopy.disabled = toCopy.length === 0;

    const copyRows = toCopy.map(({ room, s }) => `
      <div class="cp-row cp-will-copy">
        <span class="cp-room">${escHtml(room)}</span>
        <span class="cp-teacher" style="color:${s.teachers.color}">${escHtml(s.teachers.name)}</span>
        <span class="cp-time">${s.timeslots.start_time.slice(0,5)}–${s.timeslots.end_time.slice(0,5)}</span>
        <span class="cp-badge cp-badge-copy">✓ Sẽ copy</span>
      </div>`).join('');

    const skipRows = toSkip.map(({ room, s }) => `
      <div class="cp-row cp-will-skip">
        <span class="cp-room">${escHtml(room)}</span>
        <span class="cp-teacher">${escHtml(s.teachers.name)}</span>
        <span class="cp-time">${s.timeslots.start_time.slice(0,5)}–${s.timeslots.end_time.slice(0,5)}</span>
        <span class="cp-badge cp-badge-skip">↷ Đã có</span>
      </div>`).join('');

    box.innerHTML = `
      <div class="copy-preview-header">
        Sao chép <strong>${fromDayLabel}</strong> → <strong>${toDayLabel}</strong>
        &nbsp;·&nbsp; <span class="cp-count-copy">${toCopy.length} lịch sẽ thêm</span>
        ${toSkip.length > 0 ? `&nbsp;·&nbsp; <span class="cp-count-skip">${toSkip.length} bỏ qua (đã có)</span>` : ''}
      </div>
      <div class="cp-rows">
        ${copyRows}
        ${skipRows}
      </div>`;
  }

  /**
   * Thực hiện sao chép — insert các bản ghi mới vào Supabase
   */
  async function executeCopyDay() {
    const roomVal = document.getElementById('cp-room')?.value;
    const fromDay = parseInt(document.getElementById('cp-from')?.value);
    const toDay   = parseInt(document.getElementById('cp-to')?.value);
    if (!fromDay || !toDay || fromDay === toDay) return;

    const rooms = roomVal === 'all'
      ? state.rooms
      : state.rooms.filter(r => r.id === parseInt(roomVal));

    // Tìm các lịch cần copy (chưa tồn tại ở ngày đích)
    const toInsert = [];
    rooms.forEach(room => {
      const srcSlots = state.schedules.filter(
        s => s.rooms.id === room.id && s.day_of_week === fromDay
      );
      srcSlots.forEach(s => {
        const dup = state.schedules.find(
          x => x.rooms.id === room.id &&
               x.day_of_week === toDay &&
               x.timeslots.id === s.timeslots.id
        );
        if (!dup) toInsert.push({
          room_id:     room.id,
          teacher_id:  s.teachers.id,
          timeslot_id: s.timeslots.id,
          day_of_week: toDay,
          note:        s.note || '',
        });
      });
    });

    if (toInsert.length === 0) {
      showToast('Không có lịch nào cần sao chép!', 'warning');
      return;
    }

    // Disable nút tránh double-click
    const btn = document.getElementById('btn-do-copy');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang xử lý...'; }

    try {
      // Supabase hỗ trợ insert nhiều bản ghi cùng lúc
      const { error } = await SupabaseClient.getClient()
        .from('schedules')
        .insert(toInsert);
      if (error) throw error;

      // Reload schedules để có dữ liệu join đầy đủ
      const full = await SupabaseClient.getSchedules();
      state.schedules = full;

      closeModal();
      renderPage('schedule');
      const toDayLabel = DAYS.find(d => d.key === toDay)?.label || '';
      showToast(`Đã sao chép ${toInsert.length} lịch sang ${toDayLabel}! ✅`, 'success');
    } catch (err) {
      showToast('Lỗi sao chép: ' + err.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = '📋 Thực hiện sao chép'; }
    }
  }
  function renderRoomsPage(content, actions) {
    actions.innerHTML = `
      <button class="btn btn-primary btn-sm" onclick="App.openAddRoom()">+ Thêm phòng</button>`;

    if (state.rooms.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🚪</div>
          <h3>Chưa có phòng học nào</h3>
          <p>Nhấn <strong>+ Thêm phòng</strong> để bắt đầu.</p>
        </div>`;
      return;
    }

    const rows = state.rooms.map(r => `
      <tr>
        <td>${escHtml(r.name)}</td>
        <td>${escHtml(r.description || '—')}</td>
        <td style="text-align:center;">${r.sort_order}</td>
        <td>
          <div class="actions">
            <button class="btn btn-ghost btn-icon" onclick="App.openEditRoom(${r.id})" title="Sửa">✏️</button>
            <button class="btn btn-ghost btn-icon" onclick="App.deleteRoom(${r.id})" title="Xóa" style="color:var(--danger)">🗑️</button>
          </div>
        </td>
      </tr>`).join('');

    content.innerHTML = `
      <div class="card">
        <div class="section-header">
          <span class="section-title">Danh sách phòng học (${state.rooms.length})</span>
        </div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>Tên phòng</th><th>Mô tả</th><th style="text-align:center;">Thứ tự</th><th>Thao tác</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  function openAddRoom() {
    openModal('➕ Thêm phòng học', `
      <div class="form-group"><label class="form-label">Tên phòng *</label>
        <input id="f-room-name" class="input" placeholder="VD: Phòng A1, Phòng Toán..." /></div>
      <div class="form-group"><label class="form-label">Mô tả</label>
        <input id="f-room-desc" class="input" placeholder="Ghi chú thêm (tùy chọn)" /></div>
      <div class="form-group"><label class="form-label">Thứ tự hiển thị</label>
        <input id="f-room-order" class="input" type="number" value="99" min="1" /></div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="App.closeModal()">Hủy</button>
        <button class="btn btn-primary" onclick="App.submitAddRoom()">Lưu phòng</button>
      </div>`);
  }

  async function submitAddRoom() {
    const name  = document.getElementById('f-room-name').value.trim();
    const desc  = document.getElementById('f-room-desc').value.trim();
    const order = parseInt(document.getElementById('f-room-order').value) || 99;
    if (!name) { showToast('Vui lòng nhập tên phòng!', 'error'); return; }
    try {
      const room = await SupabaseClient.addRoom(name, desc, order);
      state.rooms.push(room);
      state.rooms.sort((a, b) => a.sort_order - b.sort_order);
      closeModal();
      renderPage('rooms');
      showToast(`Đã thêm "${name}"!`, 'success');
    } catch (err) { showToast('Lỗi: ' + err.message, 'error'); }
  }

  function openEditRoom(id) {
    const r = state.rooms.find(r => r.id === id);
    if (!r) return;
    openModal('✏️ Sửa phòng học', `
      <div class="form-group"><label class="form-label">Tên phòng *</label>
        <input id="f-room-name" class="input" value="${escHtml(r.name)}" /></div>
      <div class="form-group"><label class="form-label">Mô tả</label>
        <input id="f-room-desc" class="input" value="${escHtml(r.description || '')}" /></div>
      <div class="form-group"><label class="form-label">Thứ tự hiển thị</label>
        <input id="f-room-order" class="input" type="number" value="${r.sort_order}" min="1" /></div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="App.closeModal()">Hủy</button>
        <button class="btn btn-primary" onclick="App.submitEditRoom(${id})">Cập nhật</button>
      </div>`);
  }

  async function submitEditRoom(id) {
    const name  = document.getElementById('f-room-name').value.trim();
    const desc  = document.getElementById('f-room-desc').value.trim();
    const order = parseInt(document.getElementById('f-room-order').value) || 99;
    if (!name) { showToast('Vui lòng nhập tên phòng!', 'error'); return; }
    try {
      const updated = await SupabaseClient.updateRoom(id, { name, description: desc, sort_order: order });
      const idx = state.rooms.findIndex(r => r.id === id);
      if (idx !== -1) state.rooms[idx] = updated;
      state.rooms.sort((a, b) => a.sort_order - b.sort_order);
      closeModal();
      renderPage('rooms');
      showToast('Đã cập nhật phòng!', 'success');
    } catch (err) { showToast('Lỗi: ' + err.message, 'error'); }
  }

  async function deleteRoom(id) {
    const r = state.rooms.find(r => r.id === id);
    if (!confirm(`Xóa phòng "${r?.name}"? Toàn bộ lịch của phòng này cũng bị xóa!`)) return;
    try {
      await SupabaseClient.deleteRoom(id);
      state.rooms     = state.rooms.filter(r => r.id !== id);
      state.schedules = state.schedules.filter(s => s.rooms.id !== id);
      renderPage('rooms');
      showToast('Đã xóa phòng!', 'success');
    } catch (err) { showToast('Lỗi: ' + err.message, 'error'); }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE: GIÁO VIÊN
  // ═══════════════════════════════════════════════════════════════════════
  const TEACHER_COLORS = [
    '#4f46e5','#0891b2','#16a34a','#d97706','#dc2626',
    '#7c3aed','#0284c7','#15803d','#b45309','#b91c1c',
  ];

  function renderTeachersPage(content, actions) {
    actions.innerHTML = `
      <button class="btn btn-primary btn-sm" onclick="App.openAddTeacher()">+ Thêm giáo viên</button>`;

    if (state.teachers.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👨‍🏫</div>
          <h3>Chưa có giáo viên nào</h3>
          <p>Nhấn <strong>+ Thêm giáo viên</strong> để bắt đầu.</p>
        </div>`;
      return;
    }

    const rows = state.teachers.map(t => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:0.5rem;">
            <span class="color-dot" style="background:${t.color || '#4f46e5'};"></span>
            <strong>${escHtml(t.name)}</strong>
          </div>
        </td>
        <td>${escHtml(t.phone || '—')}</td>
        <td>${escHtml(t.email || '—')}</td>
        <td>
          <div class="actions">
            <button class="btn btn-ghost btn-icon" onclick="App.openEditTeacher(${t.id})">✏️</button>
            <button class="btn btn-ghost btn-icon" onclick="App.deleteTeacher(${t.id})" style="color:var(--danger)">🗑️</button>
          </div>
        </td>
      </tr>`).join('');

    content.innerHTML = `
      <div class="card">
        <div class="section-header">
          <span class="section-title">Danh sách giáo viên (${state.teachers.length})</span>
        </div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>Tên giáo viên</th><th>Điện thoại</th><th>Email</th><th>Thao tác</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  function teacherColorPicker(selectedColor) {
    return TEACHER_COLORS.map(c => `
      <span onclick="document.getElementById('f-teacher-color').value='${c}';document.querySelectorAll('.color-pick').forEach(el=>el.classList.remove('picked'));this.classList.add('picked');"
        class="color-pick${selectedColor === c ? ' picked' : ''}"
        style="display:inline-block;width:22px;height:22px;border-radius:50%;background:${c};cursor:pointer;margin:2px;border:2px solid ${selectedColor===c?'#fff':'transparent'};box-shadow:${selectedColor===c?'0 0 0 2px '+c:'none'};">
      </span>`).join('');
  }

  function openAddTeacher() {
    const defColor = TEACHER_COLORS[0];
    openModal('➕ Thêm giáo viên', `
      <div class="form-group"><label class="form-label">Tên giáo viên *</label>
        <input id="f-teacher-name" class="input" placeholder="Nguyễn Văn A" /></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Số điện thoại</label>
          <input id="f-teacher-phone" class="input" placeholder="0912..." /></div>
        <div class="form-group"><label class="form-label">Email</label>
          <input id="f-teacher-email" class="input" placeholder="gv@email.com" /></div>
      </div>
      <div class="form-group"><label class="form-label">Màu hiển thị</label>
        <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
          ${teacherColorPicker(defColor)}
        </div>
        <input type="hidden" id="f-teacher-color" value="${defColor}" />
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="App.closeModal()">Hủy</button>
        <button class="btn btn-primary" onclick="App.submitAddTeacher()">Lưu</button>
      </div>`);
  }

  async function submitAddTeacher() {
    const name  = document.getElementById('f-teacher-name').value.trim();
    const phone = document.getElementById('f-teacher-phone').value.trim();
    const email = document.getElementById('f-teacher-email').value.trim();
    const color = document.getElementById('f-teacher-color').value || TEACHER_COLORS[0];
    if (!name) { showToast('Vui lòng nhập tên giáo viên!', 'error'); return; }
    try {
      const t = await SupabaseClient.addTeacher(name, phone, email, color);
      state.teachers.push(t);
      state.teachers.sort((a, b) => a.name.localeCompare(b.name));
      closeModal();
      renderPage('teachers');
      showToast(`Đã thêm GV "${name}"!`, 'success');
    } catch (err) { showToast('Lỗi: ' + err.message, 'error'); }
  }

  function openEditTeacher(id) {
    const t = state.teachers.find(t => t.id === id);
    if (!t) return;
    openModal('✏️ Sửa giáo viên', `
      <div class="form-group"><label class="form-label">Tên giáo viên *</label>
        <input id="f-teacher-name" class="input" value="${escHtml(t.name)}" /></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Số điện thoại</label>
          <input id="f-teacher-phone" class="input" value="${escHtml(t.phone||'')}" /></div>
        <div class="form-group"><label class="form-label">Email</label>
          <input id="f-teacher-email" class="input" value="${escHtml(t.email||'')}" /></div>
      </div>
      <div class="form-group"><label class="form-label">Màu hiển thị</label>
        <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
          ${teacherColorPicker(t.color || TEACHER_COLORS[0])}
        </div>
        <input type="hidden" id="f-teacher-color" value="${t.color || TEACHER_COLORS[0]}" />
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="App.closeModal()">Hủy</button>
        <button class="btn btn-primary" onclick="App.submitEditTeacher(${id})">Cập nhật</button>
      </div>`);
  }

  async function submitEditTeacher(id) {
    const name  = document.getElementById('f-teacher-name').value.trim();
    const phone = document.getElementById('f-teacher-phone').value.trim();
    const email = document.getElementById('f-teacher-email').value.trim();
    const color = document.getElementById('f-teacher-color').value;
    if (!name) { showToast('Vui lòng nhập tên!', 'error'); return; }
    try {
      const updated = await SupabaseClient.updateTeacher(id, { name, phone, email, color });
      const idx = state.teachers.findIndex(t => t.id === id);
      if (idx !== -1) state.teachers[idx] = updated;
      // Cập nhật schedules cache
      state.schedules.forEach(s => { if (s.teachers.id === id) Object.assign(s.teachers, updated); });
      closeModal();
      renderPage('teachers');
      showToast('Đã cập nhật!', 'success');
    } catch (err) { showToast('Lỗi: ' + err.message, 'error'); }
  }

  async function deleteTeacher(id) {
    const t = state.teachers.find(t => t.id === id);
    if (!confirm(`Xóa giáo viên "${t?.name}"?`)) return;
    try {
      await SupabaseClient.deleteTeacher(id);
      state.teachers  = state.teachers.filter(t => t.id !== id);
      state.schedules = state.schedules.filter(s => s.teachers.id !== id);
      renderPage('teachers');
      showToast('Đã xóa!', 'success');
    } catch (err) { showToast('Lỗi: ' + err.message, 'error'); }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE: GIỜ HỌC (TIMESLOTS)
  // ═══════════════════════════════════════════════════════════════════════
  function renderTimeslotsPage(content, actions) {
    actions.innerHTML = `
      <button class="btn btn-primary btn-sm" onclick="App.openAddTimeslot()">+ Thêm giờ học</button>`;

    if (state.timeslots.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🕐</div>
          <h3>Chưa có giờ học nào</h3>
          <p>Nhấn <strong>+ Thêm giờ học</strong> để thiết lập các ca học.</p>
        </div>`;
      return;
    }

    const rows = state.timeslots.map(ts => {
      const slotClass = getSlotClass(ts.start_time);
      const slotLabel = slotClass === 'slot-morning' ? '🌅 Sáng' : slotClass === 'slot-afternoon' ? '☀️ Chiều' : '🌙 Tối';
      return `
        <tr>
          <td><strong>${escHtml(ts.name)}</strong></td>
          <td>${ts.start_time.slice(0,5)}</td>
          <td>${ts.end_time.slice(0,5)}</td>
          <td><span class="badge badge-gray">${slotLabel}</span></td>
          <td style="text-align:center;">${ts.sort_order}</td>
          <td>
            <div class="actions">
              <button class="btn btn-ghost btn-icon" onclick="App.openEditTimeslot(${ts.id})">✏️</button>
              <button class="btn btn-ghost btn-icon" onclick="App.deleteTimeslot(${ts.id})" style="color:var(--danger)">🗑️</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    content.innerHTML = `
      <div class="card">
        <div class="section-header">
          <span class="section-title">Danh sách giờ học (${state.timeslots.length})</span>
        </div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>Tên ca</th><th>Giờ bắt đầu</th><th>Giờ kết thúc</th><th>Buổi</th><th style="text-align:center;">Thứ tự</th><th>Thao tác</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  function openAddTimeslot() {
    openModal('➕ Thêm giờ học', `
      <div class="form-group"><label class="form-label">Tên ca học *</label>
        <input id="f-ts-name" class="input" placeholder="VD: Ca sáng 1, Ca chiều..." /></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Giờ bắt đầu *</label>
          <input id="f-ts-start" class="input" type="time" value="08:00" /></div>
        <div class="form-group"><label class="form-label">Giờ kết thúc *</label>
          <input id="f-ts-end" class="input" type="time" value="10:00" /></div>
      </div>
      <div class="form-group"><label class="form-label">Thứ tự hiển thị</label>
        <input id="f-ts-order" class="input" type="number" value="99" min="1" /></div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="App.closeModal()">Hủy</button>
        <button class="btn btn-primary" onclick="App.submitAddTimeslot()">Lưu</button>
      </div>`);
  }

  async function submitAddTimeslot() {
    const name  = document.getElementById('f-ts-name').value.trim();
    const start = document.getElementById('f-ts-start').value;
    const end   = document.getElementById('f-ts-end').value;
    const order = parseInt(document.getElementById('f-ts-order').value) || 99;
    if (!name || !start || !end) { showToast('Vui lòng điền đủ thông tin!', 'error'); return; }
    if (start >= end) { showToast('Giờ kết thúc phải sau giờ bắt đầu!', 'error'); return; }
    try {
      const ts = await SupabaseClient.addTimeslot(name, start, end, order);
      state.timeslots.push(ts);
      state.timeslots.sort((a, b) => a.start_time.localeCompare(b.start_time));
      closeModal();
      renderPage('timeslots');
      showToast(`Đã thêm ca "${name}"!`, 'success');
    } catch (err) { showToast('Lỗi: ' + err.message, 'error'); }
  }

  function openEditTimeslot(id) {
    const ts = state.timeslots.find(t => t.id === id);
    if (!ts) return;
    openModal('✏️ Sửa giờ học', `
      <div class="form-group"><label class="form-label">Tên ca học *</label>
        <input id="f-ts-name" class="input" value="${escHtml(ts.name)}" /></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Giờ bắt đầu *</label>
          <input id="f-ts-start" class="input" type="time" value="${ts.start_time.slice(0,5)}" /></div>
        <div class="form-group"><label class="form-label">Giờ kết thúc *</label>
          <input id="f-ts-end" class="input" type="time" value="${ts.end_time.slice(0,5)}" /></div>
      </div>
      <div class="form-group"><label class="form-label">Thứ tự hiển thị</label>
        <input id="f-ts-order" class="input" type="number" value="${ts.sort_order}" min="1" /></div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="App.closeModal()">Hủy</button>
        <button class="btn btn-primary" onclick="App.submitEditTimeslot(${id})">Cập nhật</button>
      </div>`);
  }

  async function submitEditTimeslot(id) {
    const name  = document.getElementById('f-ts-name').value.trim();
    const start = document.getElementById('f-ts-start').value;
    const end   = document.getElementById('f-ts-end').value;
    const order = parseInt(document.getElementById('f-ts-order').value) || 99;
    if (!name || !start || !end) { showToast('Vui lòng điền đủ thông tin!', 'error'); return; }
    if (start >= end) { showToast('Giờ kết thúc phải sau giờ bắt đầu!', 'error'); return; }
    try {
      const updated = await SupabaseClient.updateTimeslot(id, { name, start_time: start, end_time: end, sort_order: order });
      const idx = state.timeslots.findIndex(t => t.id === id);
      if (idx !== -1) state.timeslots[idx] = updated;
      closeModal();
      renderPage('timeslots');
      showToast('Đã cập nhật!', 'success');
    } catch (err) { showToast('Lỗi: ' + err.message, 'error'); }
  }

  async function deleteTimeslot(id) {
    const ts = state.timeslots.find(t => t.id === id);
    if (!confirm(`Xóa ca học "${ts?.name}"?`)) return;
    try {
      await SupabaseClient.deleteTimeslot(id);
      state.timeslots = state.timeslots.filter(t => t.id !== id);
      renderPage('timeslots');
      showToast('Đã xóa!', 'success');
    } catch (err) { showToast('Lỗi: ' + err.message, 'error'); }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE: PHÂN CÔNG LỊCH (ASSIGNMENTS)
  // ═══════════════════════════════════════════════════════════════════════
  function renderAssignmentsPage(content, actions) {
    actions.innerHTML = `
      <button class="btn btn-primary btn-sm" onclick="App.openAddAssignment()">+ Thêm lịch</button>`;

    const recentSchedules = [...state.schedules].slice(-50).reverse();

    if (recentSchedules.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">✏️</div>
          <h3>Chưa có lịch học nào</h3>
          <p>Nhấn <strong>+ Thêm lịch</strong> để phân công lịch cho phòng học.</p>
        </div>`;
      return;
    }

    const rows = recentSchedules.map(s => {
      const day = DAYS.find(d => d.key === s.day_of_week)?.label || s.day_of_week;
      return `
        <tr>
          <td>${escHtml(s.rooms.name)}</td>
          <td>${day}</td>
          <td>
            <span class="color-dot" style="background:${s.teachers.color || '#4f46e5'};"></span>
            ${escHtml(s.teachers.name)}
          </td>
          <td>${s.timeslots.start_time.slice(0,5)} – ${s.timeslots.end_time.slice(0,5)}</td>
          <td>${escHtml(s.timeslots.name)}</td>
          <td>${escHtml(s.note || '—')}</td>
          <td>
            <button class="btn btn-ghost btn-icon" onclick="App.deleteSlot(${s.id})" style="color:var(--danger)" title="Xóa">🗑️</button>
          </td>
        </tr>`;
    }).join('');

    content.innerHTML = `
      <div class="card">
        <div class="section-header">
          <span class="section-title">Danh sách lịch học (${state.schedules.length})</span>
        </div>
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>Phòng</th><th>Thứ</th><th>Giáo viên</th><th>Giờ</th><th>Ca học</th><th>Ghi chú</th><th>Xóa</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  function buildAssignForm(preRoomId = null, preDayKey = null) {
    const roomOpts = state.rooms.map(r =>
      `<option value="${r.id}" ${r.id === preRoomId ? 'selected' : ''}>${escHtml(r.name)}</option>`).join('');
    const teacherOpts = state.teachers.map(t =>
      `<option value="${t.id}">${escHtml(t.name)}</option>`).join('');
    const tsOpts = state.timeslots.map(ts =>
      `<option value="${ts.id}">${escHtml(ts.name)} (${ts.start_time.slice(0,5)}–${ts.end_time.slice(0,5)})</option>`).join('');
    const dayOpts = DAYS.map(d =>
      `<option value="${d.key}" ${d.key === preDayKey ? 'selected' : ''}>${d.label}</option>`).join('');

    if (!state.rooms.length || !state.teachers.length || !state.timeslots.length) {
      return `<p style="color:var(--danger);font-size:0.9rem;">⚠️ Cần có đủ <strong>Phòng</strong>, <strong>Giáo viên</strong> và <strong>Giờ học</strong> trước khi phân công lịch.</p>`;
    }

    return `
      <div class="form-row">
        <div class="form-group"><label class="form-label">Phòng học *</label>
          <select id="f-as-room" class="input">${roomOpts}</select></div>
        <div class="form-group"><label class="form-label">Thứ *</label>
          <select id="f-as-day" class="input">${dayOpts}</select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Giáo viên *</label>
          <select id="f-as-teacher" class="input">${teacherOpts}</select></div>
        <div class="form-group"><label class="form-label">Ca học *</label>
          <select id="f-as-ts" class="input">${tsOpts}</select></div>
      </div>
      <div class="form-group"><label class="form-label">Ghi chú</label>
        <input id="f-as-note" class="input" placeholder="Tên lớp, môn học... (tùy chọn)" /></div>
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="App.closeModal()">Hủy</button>
        <button class="btn btn-primary" onclick="App.submitAddAssignment()">Lưu lịch</button>
      </div>`;
  }

  function openAddAssignment() {
    openModal('➕ Phân công lịch học', buildAssignForm());
  }

  async function submitAddAssignment() {
    const roomId     = parseInt(document.getElementById('f-as-room')?.value);
    const dayOfWeek  = parseInt(document.getElementById('f-as-day')?.value);
    const teacherId  = parseInt(document.getElementById('f-as-teacher')?.value);
    const timeslotId = parseInt(document.getElementById('f-as-ts')?.value);
    const note       = document.getElementById('f-as-note')?.value.trim() || '';

    if (!roomId || !dayOfWeek || !teacherId || !timeslotId) {
      showToast('Vui lòng chọn đủ thông tin!', 'error'); return;
    }

    // Kiểm tra trùng lịch
    const dup = state.schedules.find(s =>
      s.rooms.id === roomId &&
      s.day_of_week === dayOfWeek &&
      s.timeslots.id === timeslotId
    );
    if (dup) {
      showToast('Phòng này đã có lịch vào giờ đó trong ngày đó!', 'error'); return;
    }

    try {
      const saved = await SupabaseClient.addSchedule(roomId, teacherId, timeslotId, dayOfWeek, note);
      // Fetch full record with joins
      const full = await SupabaseClient.getSchedules();
      state.schedules = full;
      closeModal();
      renderPage(state.page);
      showToast('Đã thêm lịch học!', 'success');
    } catch (err) { showToast('Lỗi: ' + err.message, 'error'); }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════
  async function refreshAll() {
    showToast('Đang tải lại dữ liệu...', '');
    await loadAllData();
    renderPage(state.page);
    showToast('Đã cập nhật!', 'success');
  }

  function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('overlay').classList.remove('hidden');
  }

  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.add('hidden');
  }

  function openModal(title, bodyHtml) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-backdrop').classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('modal-backdrop').classList.add('hidden');
  }

  function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast ${type}`;
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.className = 'toast hidden'; }, 3000);
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // ── Bootstrap ────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    init();
    // Config status click → mở lại config modal
    document.getElementById('config-status').addEventListener('click', showConfigModal);
  });

  return {
    navigate, refreshAll,
    openSidebar, closeSidebar,
    openModal, closeModal,
    showConfigModal, saveConfig,
    // Rooms
    openAddRoom, submitAddRoom, openEditRoom, submitEditRoom, deleteRoom,
    // Teachers
    openAddTeacher, submitAddTeacher, openEditTeacher, submitEditTeacher, deleteTeacher,
    // Timeslots
    openAddTimeslot, submitAddTimeslot, openEditTimeslot, submitEditTimeslot, deleteTimeslot,
    // Schedule
    openAddSlot, deleteSlot,
    openAddAssignment, submitAddAssignment,
    // Sao chép ngày
    openCopyDayModal, updateCopyPreview, executeCopyDay,
  };
})();
