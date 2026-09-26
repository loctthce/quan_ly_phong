/**
 * supabase-client.js
 * Khởi tạo Supabase client và cung cấp các hàm CRUD cho toàn ứng dụng.
 *
 * Cấu trúc bảng (xem README.md để biết SQL tạo bảng):
 *  - rooms        : id, name, description, sort_order, created_at
 *  - teachers     : id, name, phone, email, color, created_at
 *  - timeslots    : id, name, start_time, end_time, sort_order, created_at
 *  - schedules    : id, room_id, teacher_id, timeslot_id, day_of_week (2-8), note, created_at
 */

const SupabaseClient = (() => {
  let _client = null;

  // ── Khởi tạo ────────────────────────────────────────────────────────────
  function init(url, key) {
    _client = window.supabase.createClient(url, key);
    return _client;
  }

  function getClient() { return _client; }
  function isReady()   { return !!_client; }

  // ── Config ──────────────────────────────────────────────────────────────
  /**
   * Thứ tự ưu tiên khi lấy config:
   *  1. SUPABASE_CONFIG trong config.js (biến mặc định)
   *  2. localStorage (do người dùng nhập thủ công trước đó)
   */
  function loadConfig() {
    // Ưu tiên config.js nếu đã điền đúng
    if (typeof SUPABASE_CONFIG !== 'undefined' &&
        SUPABASE_CONFIG.url && !SUPABASE_CONFIG.url.includes('your-project-id') &&
        SUPABASE_CONFIG.key && !SUPABASE_CONFIG.key.includes('your-anon-public-key')) {
      return { url: SUPABASE_CONFIG.url, key: SUPABASE_CONFIG.key };
    }
    // Fallback: lấy từ localStorage (nhập thủ công qua modal)
    return {
      url: localStorage.getItem('sb_url') || '',
      key: localStorage.getItem('sb_key') || '',
    };
  }

  function saveConfig(url, key) {
    localStorage.setItem('sb_url', url);
    localStorage.setItem('sb_key', key);
  }

  function clearConfig() {
    localStorage.removeItem('sb_url');
    localStorage.removeItem('sb_key');
    _client = null;
  }

  // ── Generic helpers ──────────────────────────────────────────────────────
  async function fetchAll(table, orderBy = 'sort_order', ascending = true) {
    const { data, error } = await _client
      .from(table)
      .select('*')
      .order(orderBy, { ascending });
    if (error) throw error;
    return data;
  }

  async function insert(table, payload) {
    const { data, error } = await _client
      .from(table)
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function update(table, id, payload) {
    const { data, error } = await _client
      .from(table)
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function remove(table, id) {
    const { error } = await _client
      .from(table)
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  // ── ROOMS ────────────────────────────────────────────────────────────────
  async function getRooms() {
    return fetchAll('rooms', 'sort_order');
  }

  async function addRoom(name, description = '', sort_order = 99) {
    return insert('rooms', { name, description, sort_order });
  }

  async function updateRoom(id, payload) {
    return update('rooms', id, payload);
  }

  async function deleteRoom(id) {
    return remove('rooms', id);
  }

  // ── TEACHERS ─────────────────────────────────────────────────────────────
  async function getTeachers() {
    return fetchAll('teachers', 'name');
  }

  async function addTeacher(name, phone = '', email = '', color = '#4f46e5') {
    return insert('teachers', { name, phone, email, color });
  }

  async function updateTeacher(id, payload) {
    return update('teachers', id, payload);
  }

  async function deleteTeacher(id) {
    return remove('teachers', id);
  }

  // ── TIMESLOTS ─────────────────────────────────────────────────────────────
  async function getTimeslots() {
    return fetchAll('timeslots', 'start_time');
  }

  async function addTimeslot(name, start_time, end_time, sort_order = 99) {
    return insert('timeslots', { name, start_time, end_time, sort_order });
  }

  async function updateTimeslot(id, payload) {
    return update('timeslots', id, payload);
  }

  async function deleteTimeslot(id) {
    return remove('timeslots', id);
  }

  // ── SCHEDULES ─────────────────────────────────────────────────────────────
  /**
   * Lấy toàn bộ lịch, join thêm rooms, teachers, timeslots
   */
  async function getSchedules() {
    const { data, error } = await _client
      .from('schedules')
      .select(`
        id, day_of_week, note,
        rooms   ( id, name, sort_order ),
        teachers( id, name, color ),
        timeslots( id, name, start_time, end_time, sort_order )
      `)
      .order('day_of_week', { ascending: true });
    if (error) throw error;
    return data;
  }

  async function addSchedule(room_id, teacher_id, timeslot_id, day_of_week, note = '') {
    return insert('schedules', { room_id, teacher_id, timeslot_id, day_of_week, note });
  }

  async function updateSchedule(id, payload) {
    return update('schedules', id, payload);
  }

  async function deleteSchedule(id) {
    return remove('schedules', id);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    init, getClient, isReady,
    saveConfig, loadConfig, clearConfig,
    getRooms, addRoom, updateRoom, deleteRoom,
    getTeachers, addTeacher, updateTeacher, deleteTeacher,
    getTimeslots, addTimeslot, updateTimeslot, deleteTimeslot,
    getSchedules, addSchedule, updateSchedule, deleteSchedule,
  };
})();
