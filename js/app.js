const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const state = {
  filters: { search: '', type: 'all', preset: 'thisMonth', start: '', end: '' },
  sort: { by: 'tanggal', dir: 'desc' },
  page: 1,
  pageSize: 10,
  total: 0,
  inventory: null,
  currentRows: [],
  editingId: null,
  deletingId: null,
  user: null,
  isGuest: false,
  authMode: 'login'
};

const $ = (id) => document.getElementById(id);

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toDateInputValue(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtDateTime(dateStr, timeStr) {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  const time = timeStr ? String(timeStr).slice(0, 5) : '';
  return `${parseInt(d, 10)} ${MONTHS_SHORT[parseInt(m, 10) - 1]}${y !== String(new Date().getFullYear()) ? ' ' + y : ''}${time ? ', ' + time : ''}`;
}

function toast(message, type = 'info') {
  const container = $('toastContainer');
  if (!container) return;
  const icons = { success: 'check_circle', error: 'error', info: 'info' };
  const colors = { success: 'text-primary', error: 'text-error', info: 'text-on-surface-variant' };
  const el = document.createElement('div');
  el.className = 'toast-enter bg-surface-container-lowest border border-outline-variant shadow-lg rounded px-4 py-3 flex items-center gap-2 max-w-xs';
  el.innerHTML = `
    <span class="material-symbols-outlined text-[18px] ${colors[type] || colors.info}">${icons[type] || icons.info}</span>
    <span class="font-body-md text-body-md text-on-surface">${escapeHtml(message)}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s ease, transform .3s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 320);
  }, 3200);
}

function setSidebar(open) {
  const sidebar = $('sidebar');
  const backdrop = $('sidebarBackdrop');
  if (!sidebar) return;
  sidebar.classList.toggle('-translate-x-full', !open);
  if (backdrop) backdrop.classList.toggle('hidden', !open);
}

function switchView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const view = $(`view-${name}`);
  if (view) view.classList.add('active');

  const titles = { dashboard: 'Dashboard Utama', riwayat: 'Riwayat Transaksi', pengaturan: 'Pengaturan' };
  $('headerTitle').textContent = titles[name] || '';

  document.querySelectorAll('[data-nav]').forEach((a) => {
    const isActive = a.dataset.view === name;
    a.classList.toggle('bg-secondary-container', isActive);
    a.classList.toggle('text-on-secondary-fixed-variant', isActive);
    a.classList.toggle('text-on-surface-variant', !isActive);
    a.classList.toggle('hover:bg-surface-container-high', !isActive);
    a.classList.toggle('hover:text-on-surface', !isActive);
    if (isActive) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  setSidebar(false);
  window.scrollTo({ top: 0 });
}

function getTypeRadios(formPrefix) {
  return document.querySelector(`input[name="${formPrefix}"]:checked`);
}

function chipType(type) {
  const masuk = type === 'masuk';
  return `<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full font-label-md text-label-md whitespace-nowrap ${masuk ? 'bg-primary text-on-primary' : 'bg-error-container text-on-error-container'}">
    <span class="material-symbols-outlined text-[14px]">${masuk ? 'arrow_downward' : 'arrow_upward'}</span>${masuk ? 'Masuk' : 'Keluar'}</span>`;
}

function qtyCell(type, qty) {
  const masuk = type === 'masuk';
  return `<span class="font-data-mono text-data-mono font-medium ${masuk ? 'text-primary' : 'text-error'}">${masuk ? '+' : '-'}${qty}</span>`;
}

function loadingRow(cols) {
  return `<tr><td colspan="${cols}" class="p-8 text-center"><div class="inline-flex items-center gap-2 text-on-surface-variant">
    <span class="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
    <span class="font-label-md text-label-md">Memuat data...</span></div></td></tr>`;
}

function emptyRow(cols, message) {
  return `<tr><td colspan="${cols}" class="p-10 text-center">
    <div class="flex flex-col items-center gap-2 text-on-surface-variant">
      <span class="material-symbols-outlined text-[36px]">inbox</span>
      <span class="font-body-md text-body-md">${escapeHtml(message)}</span>
    </div></td></tr>`;
}

function errorRow(err) {
  return `<tr><td colspan="6" class="p-10 text-center">
    <div class="flex flex-col items-center gap-2">
      <span class="material-symbols-outlined text-[36px] text-error">cloud_off</span>
      <span class="font-body-md text-body-md text-error">Gagal memuat data: ${escapeHtml(err.message || err)}</span>
      <button onclick="loadTransactions()" class="mt-1 font-label-md text-label-md px-4 py-2 rounded bg-primary text-on-primary hover:bg-primary/90 transition-colors">Coba Lagi</button>
    </div></td></tr>`;
}

async function loadDashboard() {
  const recentTbody = $('recentTbody');
  try {
    recentTbody.innerHTML = loadingRow(4);

    const [inv, stats, recent] = await Promise.all([
      DB.getInventory(),
      DB.getTodayStats(),
      DB.getRecentTransactions(5)
    ]);

    state.inventory = inv;
    $('kpiFilled').textContent = inv.stock_filled ?? 0;
    $('kpiEmptyDisplay').textContent = inv.stock_empty ?? 0;
    $('kpiEmptyInput').value = inv.stock_empty ?? 0;
    $('kpiInToday').textContent = stats.masuk;
    $('kpiOutToday').textContent = stats.keluar;

    fillInventoryForm(inv);

    if (!recent.length) {
      recentTbody.innerHTML = emptyRow(4, 'Belum ada transaksi. Catat pergerakan pertama Anda.');
      return;
    }

    recentTbody.innerHTML = recent.map((tx) => {
      const masuk = tx.type === 'masuk';
      return `<tr class="border-b border-outline-variant/10 last:border-b-0 hover:bg-surface-container-highest transition-colors">
        <td class="p-4 font-data-mono text-data-mono text-on-surface-variant whitespace-nowrap">${fmtDateTime(tx.date, tx.time)}</td>
        <td class="p-4">${chipType(tx.type)}</td>
        <td class="p-4 text-right">${qtyCell(tx.type, tx.gallon_qty)}</td>
        <td class="p-4 text-on-surface-variant truncate max-w-[150px]">${escapeHtml(tx.notes || '-')}</td>
      </tr>`;
    }).join('');
  } catch (err) {
    console.error(err);
    recentTbody.innerHTML = errorRow(err);
  }
}

let emptySaveTimer = null;

function setEmptyGallons(value) {
  if (guardGuest()) {
    $('kpiEmptyDisplay').textContent = state.inventory?.stock_empty ?? 0;
    $('kpiEmptyInput').value = state.inventory?.stock_empty ?? 0;
    return;
  }
  const val = Math.max(0, parseInt(value, 10) || 0);
  $('kpiEmptyDisplay').textContent = val;
  $('kpiEmptyInput').value = val;

  clearTimeout(emptySaveTimer);
  emptySaveTimer = setTimeout(async () => {
    try {
      const prev = parseInt(state.inventory?.stock_empty) || 0;
      if (val === prev) return;
      state.inventory = await DB.adjustStock('stock_empty', val - prev);
      toast('Stok galon kosong diperbarui.', 'success');
    } catch (err) {
      toast(`Gagal menyimpan stok: ${err.message}`, 'error');
      loadDashboard();
    }
  }, 400);
}

async function handleTxSubmit(e) {
  e.preventDefault();
  if (guardGuest()) return;
  const qty = parseInt($('txQty').value, 10);
  if (!qty || qty < 1) {
    toast('Jumlah galon minimal 1.', 'error');
    return;
  }

  const payload = {
    type: getTypeRadios('pergerakan').value,
    date: $('txDate').value,
    time: $('txTime').value,
    gallon_qty: qty,
    customer_name: $('txCustomer').value.trim(),
    notes: $('txNotes').value.trim()
  };

  const btn = $('txSubmitBtn');
  btn.disabled = true;
  btn.style.opacity = '0.6';

  try {
    await DB.createTransaction(payload);
    const label = payload.type === 'masuk' ? 'Masuk' : 'Keluar';
    toast(`${label}: ${qty} galon tersimpan.`, 'success');

    $('txQty').value = '';
    $('txCustomer').value = '';
    $('txNotes').value = '';
    const now = new Date();
    $('txDate').value = toDateInputValue(now);
    $('txTime').value = now.toTimeString().slice(0, 5);

    loadDashboard();
    loadTransactions();
  } catch (err) {
    toast(`Gagal menyimpan: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.style.opacity = '';
  }
}

function updateSortHeaders() {
  document.querySelectorAll('th[data-sort]').forEach((th) => {
    const col = th.dataset.sort;
    const icon = th.querySelector('.sort-icon');
    const isSorted = state.sort.by === col;
    th.classList.toggle('sorted', isSorted);
    if (icon) {
      if (!isSorted) icon.textContent = 'unfold_more';
      else icon.textContent = state.sort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward';
    }
  });
}

function pageList(cur, total) {
  const pages = new Set([1, total, cur - 1, cur, cur + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...pages].sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push('…');
    out.push(p);
    prev = p;
  }
  return out;
}

function renderPagination() {
  const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
  const startIdx = state.total === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
  const endIdx = Math.min(state.page * state.pageSize, state.total);

  $('pageInfo').textContent = `Menampilkan ${startIdx}\u2013${endIdx} dari ${state.total} data`;
  $('rowCountBadge').textContent = `${state.total} Data`;

  $('pgFirst').disabled = state.page <= 1;
  $('pgPrev').disabled = state.page <= 1;
  $('pgNext').disabled = state.page >= totalPages;
  $('pgLast').disabled = state.page >= totalPages;

  const wrap = $('pgNumbers');
  wrap.innerHTML = '';
  if (totalPages <= 1) return;

  pageList(state.page, totalPages).forEach((item) => {
    if (item === '…') {
      const span = document.createElement('span');
      span.className = 'w-6 text-center font-label-md text-label-md text-on-surface-variant select-none';
      span.textContent = '…';
      wrap.appendChild(span);
      return;
    }
    const btn = document.createElement('button');
    btn.textContent = item;
    btn.className = `pg-btn w-9 h-9 rounded font-data-mono text-data-mono flex items-center justify-center transition-colors ${
      item === state.page ? 'active' : 'text-on-surface hover:bg-surface-container-high'
    }`;
    btn.addEventListener('click', () => {
      if (item !== state.page) {
        state.page = item;
        loadTransactions();
      }
    });
    wrap.appendChild(btn);
  });
}

function actionButtons(id) {
  if (isGuestMode()) {
    return `<div class="inline-flex items-center justify-end pr-2" title="Mode tamu - hanya lihat">
      <span class="material-symbols-outlined text-[16px] text-on-surface-variant/40">lock</span>
    </div>`;
  }
  return `<div class="inline-flex items-center gap-1 justify-end">
    <button onclick="openEditModal('${id}')" title="Edit" class="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors">
      <span class="material-symbols-outlined text-[16px]">edit</span></button>
    <button onclick="openDeleteModal('${id}')" title="Hapus" class="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-error-container hover:text-on-error-container transition-colors">
      <span class="material-symbols-outlined text-[16px]">delete</span></button>
  </div>`;
}

async function loadTransactions() {
  const tbody = $('txTbody');
  tbody.innerHTML = loadingRow(6);

  try {
    const result = await DB.fetchTransactions({
      page: state.page,
      pageSize: state.pageSize,
      sortBy: state.sort.by,
      sortDir: state.sort.dir,
      filters: state.filters
    });

    state.currentRows = result.data;
    state.total = result.total;

    if (!result.data.length) {
      tbody.innerHTML = emptyRow(6, 'Tidak ada transaksi yang cocok dengan filter.');
      renderPagination();
      return;
    }

    tbody.innerHTML = result.data.map((tx) => `
      <tr class="border-b border-outline-variant/10 last:border-b-0 hover:bg-surface-container-highest transition-colors">
        <td class="p-4 font-data-mono text-data-mono text-on-surface-variant whitespace-nowrap">${fmtDateTime(tx.date, tx.time)}</td>
        <td class="p-4">${chipType(tx.type)}</td>
        <td class="p-4 text-right">${qtyCell(tx.type, tx.gallon_qty)}</td>
        <td class="p-4 text-on-surface">${escapeHtml(tx.customer_name || '-')}</td>
        <td class="p-4 text-on-surface-variant truncate max-w-[200px]">${escapeHtml(tx.notes || '-')}</td>
        <td class="p-4 text-right">${actionButtons(tx.id)}</td>
      </tr>`).join('');

    renderPagination();
  } catch (err) {
    console.error(err);
    tbody.innerHTML = errorRow(err);
    state.total = 0;
    renderPagination();
  }
}

window.openEditModal = function (id) {
  if (guardGuest()) return;
  const tx = state.currentRows.find((t) => t.id === id);
  if (!tx) return;
  state.editingId = id;

  const radio = document.querySelector(`input[name="edPergerakan"][value="${tx.type}"]`);
  if (radio) radio.checked = true;
  $('edDate').value = tx.date;
  $('edTime').value = String(tx.time).slice(0, 5);
  $('edQty').value = tx.gallon_qty;
  $('edCustomer').value = tx.customer_name || '';
  $('edNotes').value = tx.notes || '';

  $('editModal').showModal();
};

window.openDeleteModal = function (id) {
  if (guardGuest()) return;
  const tx = state.currentRows.find((t) => t.id === id);
  if (!tx) return;
  state.deletingId = id;

  $('deleteDetails').innerHTML = `
    <div class="font-medium">${qtyCell(tx.type, tx.gallon_qty)} Galon</div>
    <div class="text-on-surface-variant mt-1">${fmtDateTime(tx.date, tx.time)}</div>
    ${tx.customer_name ? `<div class="text-on-surface-variant">${escapeHtml(tx.customer_name)}</div>` : ''}`;

  $('deleteModal').showModal();
};

async function handleEditSubmit(e) {
  e.preventDefault();
  if (guardGuest() || !state.editingId) return;

  const qty = parseInt($('edQty').value, 10);
  if (!qty || qty < 1) {
    toast('Jumlah galon minimal 1.', 'error');
    return;
  }

  const payload = {
    type: getTypeRadios('edPergerakan').value,
    date: $('edDate').value,
    time: $('edTime').value,
    gallon_qty: qty,
    customer_name: $('edCustomer').value.trim(),
    notes: $('edNotes').value.trim()
  };

  try {
    await DB.updateTransaction(state.editingId, payload);
    $('editModal').close();
    toast('Transaksi berhasil diperbarui.', 'success');
    loadTransactions();
    loadDashboard();
  } catch (err) {
    toast(`Gagal memperbarui: ${err.message}`, 'error');
  }
}

async function handleConfirmDelete() {
  if (guardGuest() || !state.deletingId) return;
  try {
    await DB.deleteTransaction(state.deletingId);
    $('deleteModal').close();
    toast('Transaksi dihapus.', 'success');
    loadTransactions();
    loadDashboard();
  } catch (err) {
    toast(`Gagal menghapus: ${err.message}`, 'error');
  } finally {
    state.deletingId = null;
  }
}

function resetFilters() {
  state.filters = { search: '', type: 'all', preset: 'thisMonth', start: '', end: '' };
  state.page = 1;

  $('fltSearch').value = '';
  $('fltType').value = 'all';
  $('fltPreset').value = 'thisMonth';
  $('fltStart').value = '';
  $('fltEnd').value = '';
  toggleCustomRange();

  loadTransactions();
}

function toggleCustomRange() {
  const isCustom = $('fltPreset').value === 'custom';
  $('fltStart').classList.toggle('hidden', !isCustom);
  $('fltEnd').classList.toggle('hidden', !isCustom);
}

function fillInventoryForm(inv) {
  if (!inv) return;
  $('invFilled').value = inv.stock_filled ?? 0;
  $('invEmpty').value = inv.stock_empty ?? 0;
  $('invBorrowed').value = inv.stock_borrowed ?? 0;
  $('invBroken').value = inv.stock_broken ?? 0;
}

async function handleInvSubmit(e) {
  e.preventDefault();
  if (guardGuest()) return;
  try {
    const updated = await DB.updateInventory({
      stock_filled: parseInt($('invFilled').value, 10),
      stock_empty: parseInt($('invEmpty').value, 10),
      stock_borrowed: parseInt($('invBorrowed').value, 10),
      stock_broken: parseInt($('invBroken').value, 10)
    });
    state.inventory = updated;
    toast('Stok fisik galon diperbarui.', 'success');
    loadDashboard();
  } catch (err) {
    toast(`Gagal menyimpan stok: ${err.message}`, 'error');
  }
}

async function initConnectionStatus() {
  const dot = $('dbStatusDot');
  const statusText = $('dbStatusText');
  const infoBadge = $('dbInfoStatus');
  const url = window.ENV?.NEXT_PUBLIC_SUPABASE_URL;

  if (url) $('dbUrlText').textContent = new URL(url).host;

  const res = await DB.testConnection();
  if (res.success) {
    dot.className = 'w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse';
    statusText.textContent = 'Terhubung';
    infoBadge.className = 'font-label-md text-label-md px-3 py-1 rounded bg-emerald-500/10 text-emerald-600';
    infoBadge.textContent = 'Terhubung';
  } else {
    dot.className = 'w-2 h-2 rounded-full bg-error shrink-0';
    statusText.textContent = 'Koneksi gagal';
    infoBadge.className = 'font-label-md text-label-md px-3 py-1 rounded bg-error-container text-on-error-container';
    infoBadge.textContent = 'Terputus';
  }
}

function initClock() {
  const clock = $('liveClock');
  const fmtTime = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const fmtDate = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  const tick = () => {
    const now = new Date();
    clock.textContent = `${fmtDate.format(now)} \u00b7 ${fmtTime.format(now)}`;
  };
  tick();
  setInterval(tick, 1000);
}

function showAuthOverlay() {
  const overlay = $('authOverlay');
  overlay.classList.remove('hidden');
  overlay.classList.add('flex');
}

function hideAuthOverlay() {
  const overlay = $('authOverlay');
  overlay.classList.add('hidden');
  overlay.classList.remove('flex');
}

function setAuthMode(mode) {
  state.authMode = mode;
  const isRegister = mode === 'register';

  $('authNameGroup').classList.toggle('hidden', !isRegister);
  $('authNameInput').required = isRegister;

  const activeClasses = ['bg-primary', 'text-on-primary'];
  const inactiveClasses = ['text-on-surface-variant', 'hover:text-on-surface'];
  [['tabLogin', !isRegister], ['tabRegister', isRegister]].forEach(([id, isActive]) => {
    const btn = $(id);
    btn.classList.remove(...activeClasses, ...inactiveClasses);
    btn.classList.add(...(isActive ? activeClasses : inactiveClasses));
  });

  $('btnAuthIcon').textContent = isRegister ? 'person_add' : 'login';
  $('btnAuthText').textContent = isRegister ? 'Daftar Akun Baru' : 'Masuk ke Dashboard';
  $('btnAuthSubmit').disabled = false;
  hideAuthAlert();
}

function showAuthAlert(message, type = 'error') {
  const el = $('authAlert');
  el.className = `mb-4 px-4 py-3 rounded font-body-md text-body-md flex items-start gap-2 ${
    type === 'error'
      ? 'bg-error-container text-on-error-container'
      : 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/30'
  }`;
  el.innerHTML = `<span class="material-symbols-outlined text-[18px] shrink-0">${type === 'error' ? 'error' : 'check_circle'}</span><span>${escapeHtml(message)}</span>`;
}

function hideAuthAlert() {
  const el = $('authAlert');
  el.className = 'hidden';
  el.innerHTML = '';
}

function applyUserProfile(user) {
  if (!user) return;
  const name = (user.fullName || user.loginId || 'Admin User').trim();
  $('userNameText').textContent = name;
  $('userEmailText').textContent = user.isGuest ? 'Mode Tamu' : (user.loginId ? `ID: ${user.loginId}` : '-');
  const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'AD';
  $('userAvatar').textContent = initials;
}

function isGuestMode() {
  return !!state.isGuest;
}

function guardGuest() {
  if (!isGuestMode()) return false;
  toast('Mode tamu hanya dapat melihat data. Masuk dengan ID & PIN untuk mengubah.', 'info');
  return true;
}

function applyReadOnlyUi() {
  const guest = isGuestMode();
  const selectors = [
    '#txForm input',
    '#txForm textarea',
    '#txForm button[type="submit"]',
    '#kpiEmptyInput',
    'button[data-step]',
    '#invForm input',
    '#invForm button[type="submit"]'
  ];
  document.querySelectorAll(selectors.join(',')).forEach((el) => { el.disabled = guest; });
}

async function enterApp(user) {
  state.user = user || null;
  state.isGuest = !!user?.isGuest;
  DB.currentUser = user || null;
  applyUserProfile(user);
  applyReadOnlyUi();
  hideAuthOverlay();
  if (user && !user.isGuest && DB.client) DB.saveSession(user);
  await loadDashboard();
  await loadTransactions();
  initConnectionStatus();
}

function resetPinVisibility() {
  $('authPinInput').type = 'password';
  $('pwdToggleIcon').textContent = 'visibility';
}

function lockApp() {
  state.user = null;
  state.isGuest = false;
  state.inventory = null;
  state.currentRows = [];
  state.total = 0;
  DB.signOut();
  applyUserProfile({ fullName: 'Admin User', isGuest: true });
  applyReadOnlyUi();
  showAuthOverlay();
  setAuthMode('login');
  $('authForm').reset();
  resetPinVisibility();
  hideAuthAlert();
  
  if ($('txTbody')) $('txTbody').innerHTML = '';
  if ($('recentTbody')) $('recentTbody').innerHTML = '';
  if ($('kpiFilled')) $('kpiFilled').textContent = '0';
  if ($('kpiEmptyDisplay')) $('kpiEmptyDisplay').textContent = '0';
  if ($('kpiEmptyInput')) $('kpiEmptyInput').value = '0';
  if ($('kpiInToday')) $('kpiInToday').textContent = '0';
  if ($('kpiOutToday')) $('kpiOutToday').textContent = '0';
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  hideAuthAlert();

  if (!DB.client) {
    showAuthAlert('Database belum terhubung. Periksa konfigurasi env.js.');
    return;
  }

  const loginId = $('authIdInput').value.trim();
  const pin = $('authPinInput').value;

  const invalid = DB.validateCredentials(loginId, pin);
  if (invalid) {
    showAuthAlert(invalid);
    return;
  }

  const btn = $('btnAuthSubmit');
  btn.disabled = true;

  try {
    let result;
    if (state.authMode === 'register') {
      const fullName = $('authNameInput').value.trim();
      result = await DB.signUp(loginId, pin, fullName);
    } else {
      result = await DB.signIn(loginId, pin);
    }

    if (!result.success) {
      showAuthAlert(result.message);
      return;
    }

    toast(state.authMode === 'register' ? `Akun "${result.user.loginId}" berhasil didaftarkan!` : `Selamat datang kembali, ${result.user.fullName}!`, 'success');
    enterApp(result.user);
  } catch (err) {
    console.error(err);
    showAuthAlert(err.message || 'Terjadi kesalahan. Coba lagi.');
  } finally {
    btn.disabled = false;
  }
}

function handleGuestLogin() {
  state.isGuest = true;
  const guestUser = { id: null, email: '', fullName: 'Admin User', isGuest: true };
  enterApp(guestUser);
  toast('Masuk dalam mode tamu.', 'info');
}

async function handleLogout() {
  if (!confirm('Yakin ingin keluar dari akun?')) return;
  if (!state.isGuest && DB.client) await DB.signOut();
  state.isGuest = false;
  state.user = null;
  lockApp();
  toast('Anda telah keluar.', 'info');
}

function bindAuthEvents() {
  $('tabLogin').addEventListener('click', () => setAuthMode('login'));
  $('tabRegister').addEventListener('click', () => setAuthMode('register'));
  $('authForm').addEventListener('submit', handleAuthSubmit);
  $('btnGuestLogin').addEventListener('click', handleGuestLogin);
  $('btnLogout').addEventListener('click', handleLogout);

  $('btnTogglePassword').addEventListener('click', () => {
    const input = $('authPinInput');
    const icon = $('pwdToggleIcon');
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    icon.textContent = isHidden ? 'visibility_off' : 'visibility';
  });

  $('authPinInput').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8);
  });
}

async function initAuth() {
  bindAuthEvents();

  if (!DB.client) {
    lockApp();
    return;
  }

  const user = await DB.getSessionUser();
  if (user) {
    await enterApp(user);
  } else {
    lockApp();
  }
}

function bindEvents() {
  $('btnSidebarToggle').addEventListener('click', () => setSidebar(true));
  $('btnCloseSidebar').addEventListener('click', () => setSidebar(false));
  $('sidebarBackdrop').addEventListener('click', () => setSidebar(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setSidebar(false);
  });

  document.querySelectorAll('[data-nav]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      switchView(a.dataset.view);
    });
  });

  document.querySelectorAll('[data-goto]').forEach((el) => {
    el.addEventListener('click', () => switchView(el.dataset.goto));
  });

  document.querySelectorAll('#kpiEmptyInput')
    .forEach((input) => input.addEventListener('change', (e) => setEmptyGallons(e.target.value)));
  document.querySelectorAll('[data-step]')
    .forEach((btn) => btn.addEventListener('click', () => setEmptyGallons(parseInt($('kpiEmptyInput').value, 10) + parseInt(btn.dataset.step, 10))));

  $('txForm').addEventListener('submit', handleTxSubmit);
  $('editForm').addEventListener('submit', handleEditSubmit);
  $('btnConfirmDelete').addEventListener('click', handleConfirmDelete);
  $('invForm').addEventListener('submit', handleInvSubmit);

  let searchTimer = null;
  $('fltSearch').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.filters.search = e.target.value;
      state.page = 1;
      loadTransactions();
    }, 300);
  });

  $('fltType').addEventListener('change', (e) => {
    state.filters.type = e.target.value;
    state.page = 1;
    loadTransactions();
  });

  $('fltPreset').addEventListener('change', (e) => {
    state.filters.preset = e.target.value;
    state.page = 1;
    toggleCustomRange();
    loadTransactions();
  });

  $('fltStart').addEventListener('change', (e) => {
    state.filters.start = e.target.value;
    state.page = 1;
    loadTransactions();
  });

  $('fltEnd').addEventListener('change', (e) => {
    state.filters.end = e.target.value;
    state.page = 1;
    loadTransactions();
  });

  $('btnResetFilter').addEventListener('click', resetFilters);

  document.querySelectorAll('th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (state.sort.by === col) {
        state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sort.by = col;
        state.sort.dir = col === 'tanggal' ? 'desc' : 'asc';
      }
      state.page = 1;
      updateSortHeaders();
      loadTransactions();
    });
  });

  $('pageSize').addEventListener('change', (e) => {
    state.pageSize = parseInt(e.target.value, 10);
    state.page = 1;
    loadTransactions();
  });

  $('pgFirst').addEventListener('click', () => { state.page = 1; loadTransactions(); });
  $('pgPrev').addEventListener('click', () => { if (state.page > 1) { state.page--; loadTransactions(); } });
  $('pgNext').addEventListener('click', () => {
    const totalPages = Math.ceil(state.total / state.pageSize);
    if (state.page < totalPages) { state.page++; loadTransactions(); }
  });
  $('pgLast').addEventListener('click', () => {
    state.page = Math.max(1, Math.ceil(state.total / state.pageSize));
    loadTransactions();
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  DB.init();

  const now = new Date();
  $('txDate').value = toDateInputValue(now);
  $('txTime').value = now.toTimeString().slice(0, 5);

  $('fltPreset').value = state.filters.preset;

  bindEvents();
  initClock();
  updateSortHeaders();

  await initAuth();
});
