/**
 * ==============================================================================
 * AQUAFLOW - MAIN APPLICATION CONTROLLER (STOCK MANAGEMENT)
 * ==============================================================================
 * Mengatur alur data, interaksi UI, filter, visualisasi grafik, ekspor,
 * serta sinkronisasi mutasi dan stok fisik galon.
 */

// Kategori Mutasi Stok Bawaan
const CATEGORIES = {
  keluar: [
    'Isi Ulang Galon',
    'Galon Baru + Isi',
    'Galon Dipinjamkan',
    'Galon Rusak / Pecah',
    'Pengiriman Pelanggan',
    'Keluar Lainnya'
  ],
  masuk: [
    'Pengadaan Galon Baru',
    'Pengembalian Galon Pinjam',
    'Pasokan Galon Isi Pabrik',
    'Masuk Lainnya'
  ]
};

// Global App State
const AppState = {
  allTransactions: [],
  filteredTransactions: [],
  inventory: {},
  filterCriteria: {
    timeMode: 'quick',      // 'quick', 'date', 'day', 'month', 'year'
    quickPreset: 'thisMonth', // 'today', 'yesterday', 'last7days', 'thisMonth', 'lastMonth', 'thisYear', 'all'
    startDate: '',
    endDate: '',
    selectedDay: 'all',     // 'Senin', 'Selasa', etc.
    selectedMonth: new Date().getMonth() + 1,
    selectedYear: new Date().getFullYear(),
    type: 'all',            // 'all', 'keluar', 'masuk'
    category: 'all',
    search: ''
  },
  pagination: {
    page: 1,
    pageSize: 10
  },
  editingTxId: null,
  deleteTxId: null
};

// DOM Content Loaded Handler
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initTimeTicker();
  initEventListeners();
  await loadData();
  lucide.createIcons();
});

// ----------------------------------------------------------------------------
// TEMA & WAKTU (THEME & CLOCK)
// ----------------------------------------------------------------------------
function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(STORAGE_KEYS.THEME, next);
  updateThemeIcon(next);

  // Refresh Charts with new theme colors
  const trendData = FilterManager.aggregateByDate(AppState.filteredTransactions);
  const categoryData = FilterManager.aggregateByCategory(AppState.filteredTransactions, AppState.filterCriteria.type);
  window.chartManager.refreshCharts(trendData, categoryData);
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('themeIcon');
  if (!icon) return;
  if (theme === 'dark') {
    icon.setAttribute('data-lucide', 'sun');
  } else {
    icon.setAttribute('data-lucide', 'moon');
  }
  lucide.createIcons();
}

function initTimeTicker() {
  const dateText = document.getElementById('currentDateText');
  function updateTime() {
    const now = new Date();
    const dayName = getIndonesianDayName(now);
    const dateFormatted = FilterManager.formatDateIndo(now.toISOString().split('T')[0]);
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');
    if (dateText) {
      dateText.textContent = `${dayName}, ${dateFormatted} - ${hours}:${mins}:${secs} WIB`;
    }
  }
  updateTime();
  setInterval(updateTime, 1000);
}

// ----------------------------------------------------------------------------
// EVENT LISTENERS INITIALIZATION
// ----------------------------------------------------------------------------
function initEventListeners() {
  // Theme Toggle
  document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);

  // Database Indicator Pill & Config
  document.getElementById('dbStatusPill')?.addEventListener('click', openDatabaseModal);
  document.getElementById('btnOpenDbConfig')?.addEventListener('click', openDatabaseModal);
  document.getElementById('btnOpenHelp')?.addEventListener('click', () => openModal('helpModal'));

  // Quick Action Cashier Buttons
  document.querySelectorAll('[data-quick-action]').forEach(btn => {
    btn.addEventListener('click', handleQuickAction);
  });
  document.getElementById('btnOpenAddTxModal')?.addEventListener('click', () => openTransactionModal());
  document.getElementById('btnOpenAddTxEmpty')?.addEventListener('click', () => openTransactionModal());

  // Filter Mode Tabs (Quick, Date, Day, Month, Year)
  document.querySelectorAll('.filter-tab-btn[data-mode]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-tab-btn[data-mode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.mode;
      AppState.filterCriteria.timeMode = mode;
      updateFilterControlsVisibility(mode);
      applyFiltersAndRender();
    });
  });

  // Type Filter Tabs (Table Section)
  document.querySelectorAll('.type-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.filterCriteria.type = btn.dataset.type;
      populateCategoryFilterOptions();
      applyFiltersAndRender();
    });
  });

  // Filter Controls Change Handlers
  document.getElementById('filterQuickPreset')?.addEventListener('change', (e) => {
    AppState.filterCriteria.quickPreset = e.target.value;
    applyFiltersAndRender();
  });

  document.getElementById('filterStartDate')?.addEventListener('change', (e) => {
    AppState.filterCriteria.startDate = e.target.value;
    applyFiltersAndRender();
  });

  document.getElementById('filterEndDate')?.addEventListener('change', (e) => {
    AppState.filterCriteria.endDate = e.target.value;
    applyFiltersAndRender();
  });

  document.getElementById('filterMonthSelect')?.addEventListener('change', (e) => {
    AppState.filterCriteria.selectedMonth = parseInt(e.target.value);
    applyFiltersAndRender();
  });

  document.getElementById('filterYearSelect')?.addEventListener('change', (e) => {
    AppState.filterCriteria.selectedYear = parseInt(e.target.value);
    applyFiltersAndRender();
  });

  document.getElementById('filterCategorySelect')?.addEventListener('change', (e) => {
    AppState.filterCriteria.category = e.target.value;
    applyFiltersAndRender();
  });

  // Search Input Debounce
  let searchTimeout;
  document.getElementById('filterSearchInput')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      AppState.filterCriteria.search = e.target.value;
      AppState.pagination.page = 1;
      applyFiltersAndRender();
    }, 250);
  });

  // Reset Filter Button
  document.getElementById('btnResetFilter')?.addEventListener('click', resetFilters);

  // Day of Week Pills
  document.querySelectorAll('.day-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.day-pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.filterCriteria.selectedDay = btn.dataset.day;
      applyFiltersAndRender();
    });
  });

  // Inventory Stock Edit Button
  document.getElementById('btnEditInventory')?.addEventListener('click', openInventoryModal);
  document.getElementById('inventoryForm')?.addEventListener('submit', handleSaveInventory);

  // Transaction Form & Type Radios
  document.querySelectorAll('input[name="txType"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      populateCategoryOptionsForForm(e.target.value);
    });
  });
  document.getElementById('transactionForm')?.addEventListener('submit', handleSaveTransaction);

  // Delete Confirmation
  document.getElementById('btnConfirmDelete')?.addEventListener('click', handleConfirmDelete);

  // Database Config Modal Actions
  document.getElementById('dbConfigForm')?.addEventListener('submit', handleSaveDbConfig);
  document.getElementById('btnTestDbConnection')?.addEventListener('click', handleTestDbConnection);
  document.getElementById('btnSyncCloud')?.addEventListener('click', handleSyncToCloud);
  document.getElementById('btnUseLocalDb')?.addEventListener('click', handleUseLocalDb);
  document.getElementById('btnBackupJson')?.addEventListener('click', () => {
    ExportManager.backupJSON(AppState.allTransactions, AppState.inventory);
  });
  document.getElementById('fileRestoreInput')?.addEventListener('change', handleRestoreJson);

  // Export Buttons
  document.getElementById('btnExportExcel')?.addEventListener('click', () => {
    ExportManager.exportToExcel(AppState.filteredTransactions, getActiveFilterDescription());
  });
  document.getElementById('btnExportCSV')?.addEventListener('click', () => {
    ExportManager.exportToCSV(AppState.filteredTransactions);
  });
  document.getElementById('btnPrintReport')?.addEventListener('click', () => {
    document.getElementById('printPeriodDesc').textContent = 'Periode: ' + getActiveFilterDescription();
    ExportManager.printReport(getActiveFilterDescription());
  });

  // Pagination Buttons
  document.getElementById('btnPrevPage')?.addEventListener('click', () => {
    if (AppState.pagination.page > 1) {
      AppState.pagination.page -= 1;
      renderTable();
    }
  });

  document.getElementById('btnNextPage')?.addEventListener('click', () => {
    const totalPages = Math.ceil(AppState.filteredTransactions.length / AppState.pagination.pageSize) || 1;
    if (AppState.pagination.page < totalPages) {
      AppState.pagination.page += 1;
      renderTable();
    }
  });

  // Close modal when clicking outside dialog
  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal.id);
      }
    });
  });
}

// ----------------------------------------------------------------------------
// DATA LOADING & REFRESH
// ----------------------------------------------------------------------------
async function loadData() {
  updateDbStatusIndicator();

  // Load Inventory
  AppState.inventory = await window.dbManager.getInventory();
  renderInventoryUI();

  // Load Transactions
  AppState.allTransactions = await window.dbManager.getAllTransactions();

  // Populate Categories
  populateCategoryFilterOptions();

  // Apply Current Filter & Render Dashboard
  applyFiltersAndRender();
}

function updateDbStatusIndicator() {
  const isCloud = window.dbManager.isSupabaseConnected();
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('dbStatusText');

  if (dot && text) {
    if (isCloud) {
      dot.className = 'status-dot online';
      text.textContent = 'Supabase Cloud';
    } else {
      dot.className = 'status-dot offline';
      text.textContent = 'Local Storage';
    }
  }
}

// ----------------------------------------------------------------------------
// FILTERING & UI RENDERING
// ----------------------------------------------------------------------------
function updateFilterControlsVisibility(mode) {
  const quickWrap = document.getElementById('quickPresetWrap');
  const dateRangeWrap = document.getElementById('dateRangeWrap');
  const monthYearWrap = document.getElementById('monthYearWrap');
  const monthSelectGroup = document.getElementById('monthSelectGroup');
  const dayFilterWrap = document.getElementById('dayFilterWrap');

  // Hide all first
  if (quickWrap) quickWrap.style.display = 'none';
  if (dateRangeWrap) dateRangeWrap.style.display = 'none';
  if (monthYearWrap) monthYearWrap.style.display = 'none';
  if (dayFilterWrap) dayFilterWrap.style.display = 'none';

  if (mode === 'quick') {
    if (quickWrap) quickWrap.style.display = 'block';
  } else if (mode === 'date') {
    if (dateRangeWrap) dateRangeWrap.style.display = 'grid';
  } else if (mode === 'day') {
    if (dayFilterWrap) dayFilterWrap.style.display = 'flex';
  } else if (mode === 'month') {
    if (monthYearWrap) monthYearWrap.style.display = 'grid';
    if (monthSelectGroup) monthSelectGroup.style.display = 'block';
  } else if (mode === 'year') {
    if (monthYearWrap) monthYearWrap.style.display = 'grid';
    if (monthSelectGroup) monthSelectGroup.style.display = 'none';
  }
}

function populateCategoryFilterOptions() {
  const select = document.getElementById('filterCategorySelect');
  if (!select) return;

  const currentVal = AppState.filterCriteria.category;
  select.innerHTML = '<option value="all">Semua Kategori</option>';

  let categoriesToInclude = [];
  if (AppState.filterCriteria.type === 'keluar') {
    categoriesToInclude = CATEGORIES.keluar;
  } else if (AppState.filterCriteria.type === 'masuk') {
    categoriesToInclude = CATEGORIES.masuk;
  } else {
    categoriesToInclude = [...CATEGORIES.keluar, ...CATEGORIES.masuk];
  }

  // Deduplicate
  const uniqueCats = Array.from(new Set(categoriesToInclude));
  uniqueCats.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    if (cat === currentVal) opt.selected = true;
    select.appendChild(opt);
  });
}

function getActiveFilterDescription() {
  const c = AppState.filterCriteria;
  if (c.timeMode === 'quick') {
    const map = {
      today: 'Hari Ini',
      yesterday: 'Kemarin',
      last7days: '7 Hari Terakhir',
      thisMonth: 'Bulan Ini',
      lastMonth: 'Bulan Lalu',
      thisYear: 'Tahun Ini',
      all: 'Semua Waktu'
    };
    return map[c.quickPreset] || 'Bulan Ini';
  } else if (c.timeMode === 'date') {
    if (c.startDate && c.endDate) {
      return `${FilterManager.formatDateShort(c.startDate)} s/d ${FilterManager.formatDateShort(c.endDate)}`;
    } else if (c.startDate) {
      return FilterManager.formatDateIndo(c.startDate);
    }
    return 'Rentang Tanggal';
  } else if (c.timeMode === 'day') {
    return c.selectedDay === 'all' ? 'Semua Hari' : `Hari ${c.selectedDay}`;
  } else if (c.timeMode === 'month') {
    return `${FilterManager.getMonthName(c.selectedMonth)} ${c.selectedYear}`;
  } else if (c.timeMode === 'year') {
    return `Tahun ${c.selectedYear}`;
  }
  return 'Semua Data';
}

function applyFiltersAndRender() {
  // 1. Filter Transactions
  AppState.filteredTransactions = FilterManager.filterTransactions(
    AppState.allTransactions,
    AppState.filterCriteria
  );

  // 2. Update Active Filter Badge
  const badge = document.getElementById('activeFilterDescriptionBadge');
  if (badge) {
    badge.textContent = `Periode: ${getActiveFilterDescription()}`;
  }

  // 3. Render KPI Summary Cards
  renderKPICards();

  // 4. Render Charts
  renderCharts();

  // 5. Render Table & Pagination
  renderTable();
}

function resetFilters() {
  AppState.filterCriteria = {
    timeMode: 'quick',
    quickPreset: 'thisMonth',
    startDate: '',
    endDate: '',
    selectedDay: 'all',
    selectedMonth: new Date().getMonth() + 1,
    selectedYear: new Date().getFullYear(),
    type: 'all',
    category: 'all',
    search: ''
  };

  // Reset UI elements
  document.querySelectorAll('.filter-tab-btn[data-mode]').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === 'quick');
  });
  document.querySelectorAll('.type-filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === 'all');
  });
  document.querySelectorAll('.day-pill-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.day === 'all');
  });

  const quickSelect = document.getElementById('filterQuickPreset');
  if (quickSelect) quickSelect.value = 'thisMonth';

  const searchInput = document.getElementById('filterSearchInput');
  if (searchInput) searchInput.value = '';

  updateFilterControlsVisibility('quick');
  populateCategoryFilterOptions();
  AppState.pagination.page = 1;
  applyFiltersAndRender();
  showToast('Filter telah direset ke pengaturan awal.', 'info');
}

// ----------------------------------------------------------------------------
// KPI CARDS & INVENTORY RENDERING
// ----------------------------------------------------------------------------
function renderKPICards() {
  const summary = FilterManager.calculateSummary(AppState.filteredTransactions);
  const inv = AppState.inventory || {};

  const kpiFilled = document.getElementById('kpiStockFilled');
  const kpiOut = document.getElementById('kpiTotalGallonsOut');
  const kpiIn = document.getElementById('kpiTotalGallonsIn');
  const kpiBorrowed = document.getElementById('kpiStockBorrowed');
  const kpiTxCount = document.getElementById('kpiTxCount');
  const kpiEmptySummary = document.getElementById('kpiStockEmptySummary');

  if (kpiFilled) kpiFilled.textContent = `${inv.stock_filled || 0} Galon`;
  if (kpiOut) kpiOut.textContent = `${summary.totalGallonsOut} Galon`;
  if (kpiIn) kpiIn.textContent = `${summary.totalGallonsIn} Galon`;
  if (kpiBorrowed) kpiBorrowed.textContent = `${inv.stock_borrowed || 0} Galon`;
  if (kpiTxCount) kpiTxCount.textContent = `${summary.totalTransactions} catatan mutasi`;
  if (kpiEmptySummary) kpiEmptySummary.textContent = `${inv.stock_empty || 0} Kosong`;
}

function renderInventoryUI() {
  const inv = AppState.inventory || {};
  const filledEl = document.getElementById('stockFilledDisplay');
  const emptyEl = document.getElementById('stockEmptyDisplay');
  const borrowedEl = document.getElementById('stockBorrowedDisplay');
  const brokenEl = document.getElementById('stockBrokenDisplay');

  if (filledEl) filledEl.textContent = `${inv.stock_filled || 0} Galon`;
  if (emptyEl) emptyEl.textContent = `${inv.stock_empty || 0} Galon`;
  if (borrowedEl) borrowedEl.textContent = `${inv.stock_borrowed || 0} Galon`;
  if (brokenEl) brokenEl.textContent = `${inv.stock_broken || 0} Galon`;

  // Also update KPI cards
  const kpiFilled = document.getElementById('kpiStockFilled');
  const kpiBorrowed = document.getElementById('kpiStockBorrowed');
  const kpiEmptySummary = document.getElementById('kpiStockEmptySummary');

  if (kpiFilled) kpiFilled.textContent = `${inv.stock_filled || 0} Galon`;
  if (kpiBorrowed) kpiBorrowed.textContent = `${inv.stock_borrowed || 0} Galon`;
  if (kpiEmptySummary) kpiEmptySummary.textContent = `${inv.stock_empty || 0} Kosong`;
}

function renderCharts() {
  const trendData = FilterManager.aggregateByDate(AppState.filteredTransactions);
  const categoryData = FilterManager.aggregateByCategory(
    AppState.filteredTransactions,
    AppState.filterCriteria.type === 'all' ? 'all' : AppState.filterCriteria.type
  );

  window.chartManager.refreshCharts(trendData, categoryData);
}

// ----------------------------------------------------------------------------
// DATA TABLE & PAGINATION
// ----------------------------------------------------------------------------
function renderTable() {
  const tbody = document.getElementById('transactionsTableBody');
  const emptyState = document.getElementById('tableEmptyState');
  const countBadge = document.getElementById('tableCountBadge');
  const paginationInfo = document.getElementById('paginationInfo');
  const btnPrev = document.getElementById('btnPrevPage');
  const btnNext = document.getElementById('btnNextPage');

  const total = AppState.filteredTransactions.length;
  if (countBadge) countBadge.textContent = `${total} Data`;

  if (total === 0) {
    if (tbody) tbody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    if (paginationInfo) paginationInfo.textContent = 'Menampilkan 0 dari 0 data';
    if (btnPrev) btnPrev.disabled = true;
    if (btnNext) btnNext.disabled = true;
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  // Pagination calculation
  const { page, pageSize } = AppState.pagination;
  const totalPages = Math.ceil(total / pageSize);
  const validPage = Math.min(page, totalPages);
  AppState.pagination.page = validPage;

  const startIndex = (validPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);
  const pageItems = AppState.filteredTransactions.slice(startIndex, endIndex);

  if (tbody) {
    tbody.innerHTML = pageItems.map(t => {
      const isOut = t.type === 'keluar';
      const badgeClass = isOut ? 'badge-out' : 'badge-in';
      const typeLabel = isOut ? 'Galon Keluar (-)' : 'Galon Masuk (+)';
      const typeIcon = isOut ? 'arrow-up-right' : 'arrow-down-left';

      return `
        <tr>
          <td>
            <div style="font-weight: 600;">${FilterManager.formatDateShort(t.date)}</div>
            <div style="font-size: 0.76rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.35rem; margin-top: 0.15rem;">
              <span class="day-badge">${t.day_name || '-'}</span>
              <span>${t.time || ''}</span>
            </div>
          </td>
          <td>
            <span class="badge ${badgeClass}">
              <i data-lucide="${typeIcon}" style="width: 12px; height: 12px;"></i>
              ${typeLabel}
            </span>
          </td>
          <td>
            <div style="font-weight: 600;">${t.category}</div>
          </td>
          <td style="text-align: center;">
            <span class="qty-highlight">${t.gallon_qty || 0} Galon</span>
          </td>
          <td>
            <div style="font-weight: 500;">${t.customer_name || '-'}</div>
          </td>
          <td>
            <div style="font-size: 0.84rem; color: var(--text-muted); max-width: 250px; white-space: normal;">
              ${t.notes || '-'}
            </div>
          </td>
          <td style="text-align: center;">
            <div style="display: inline-flex; align-items: center; gap: 0.35rem;">
              <button class="btn-action edit" title="Edit Mutasi" onclick="openTransactionModal('${t.id}')">
                <i data-lucide="edit-2" style="width: 13px; height: 13px;"></i>
              </button>
              <button class="btn-action delete" title="Hapus Mutasi" onclick="openDeleteModal('${t.id}')">
                <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Update Pagination Controls
  if (paginationInfo) {
    paginationInfo.textContent = `Menampilkan ${startIndex + 1}-${endIndex} dari ${total} data (Halaman ${validPage} dari ${totalPages})`;
  }
  if (btnPrev) btnPrev.disabled = validPage <= 1;
  if (btnNext) btnNext.disabled = validPage >= totalPages;

  lucide.createIcons();
}

// ----------------------------------------------------------------------------
// QUICK ACTION CASHIER HANDLER
// ----------------------------------------------------------------------------
async function handleQuickAction(e) {
  const btn = e.currentTarget;
  const action = btn.dataset.quickAction;
  const todayStr = new Date().toISOString().split('T')[0];
  const timeStr = new Date().toTimeString().split(' ')[0].substring(0, 5);

  let newTx = {
    date: todayStr,
    time: timeStr,
    type: 'keluar',
    customer_name: 'Pelanggan Depot Langsung'
  };

  if (action === 'refill-1') {
    newTx.category = 'Isi Ulang Galon';
    newTx.gallon_qty = 1;
    newTx.notes = 'Penjualan cepat 1 galon isi ulang (tukar)';
  } else if (action === 'refill-5') {
    newTx.category = 'Isi Ulang Galon';
    newTx.gallon_qty = 5;
    newTx.notes = 'Penjualan cepat 5 galon isi ulang (tukar)';
  } else if (action === 'refill-10') {
    newTx.category = 'Isi Ulang Galon';
    newTx.gallon_qty = 10;
    newTx.notes = 'Penjualan cepat 10 galon isi ulang (tukar)';
  } else if (action === 'new-1') {
    newTx.category = 'Galon Baru + Isi';
    newTx.gallon_qty = 1;
    newTx.notes = 'Penjualan cepat 1 galon baru + bodi';
  }

  const res = await window.dbManager.createTransaction(newTx);
  if (res.success) {
    showToast(`Mutasi keluar: ${newTx.gallon_qty} ${newTx.category} berhasil dicatat!`, 'success');
    await loadData();
  } else {
    showToast('Gagal mencatat mutasi.', 'error');
  }
}

// ----------------------------------------------------------------------------
// MODAL TRANSACTION (ADD & EDIT)
// ----------------------------------------------------------------------------
function openTransactionModal(editId = null) {
  AppState.editingTxId = editId;
  const modalTitle = document.getElementById('txModalTitle');
  const dateInput = document.getElementById('txDate');
  const timeInput = document.getElementById('txTime');
  const qtyInput = document.getElementById('txQty');
  const customerInput = document.getElementById('txCustomer');
  const notesInput = document.getElementById('txNotes');

  if (editId) {
    modalTitle.innerHTML = '<i data-lucide="edit-2"></i> Edit Catatan Mutasi Galon';
    const tx = AppState.allTransactions.find(t => t.id === editId);
    if (tx) {
      if (tx.type === 'keluar') {
        document.getElementById('typeOut').checked = true;
      } else {
        document.getElementById('typeIn').checked = true;
      }

      populateCategoryOptionsForForm(tx.type, tx.category);
      dateInput.value = tx.date;
      timeInput.value = tx.time || '';
      qtyInput.value = tx.gallon_qty || 1;
      customerInput.value = tx.customer_name || '';
      notesInput.value = tx.notes || '';
    }
  } else {
    modalTitle.innerHTML = '<i data-lucide="plus-circle"></i> Catat Mutasi Galon';
    document.getElementById('typeOut').checked = true;
    populateCategoryOptionsForForm('keluar');

    dateInput.value = new Date().toISOString().split('T')[0];
    timeInput.value = new Date().toTimeString().split(' ')[0].substring(0, 5);
    qtyInput.value = 1;
    customerInput.value = '';
    notesInput.value = '';
  }

  lucide.createIcons();
  openModal('transactionModal');
}

function populateCategoryOptionsForForm(type, selectedValue = null) {
  const catSelect = document.getElementById('txCategory');
  if (!catSelect) return;

  const categories = CATEGORIES[type] || CATEGORIES.keluar;
  catSelect.innerHTML = categories.map(cat => {
    const isSel = cat === selectedValue ? 'selected' : '';
    return `<option value="${cat}" ${isSel}>${cat}</option>`;
  }).join('');
}

async function handleSaveTransaction(e) {
  e.preventDefault();

  const type = document.querySelector('input[name="txType"]:checked').value;
  const date = document.getElementById('txDate').value;
  const time = document.getElementById('txTime').value;
  const category = document.getElementById('txCategory').value;
  const qty = parseInt(document.getElementById('txQty').value) || 1;
  const customer = document.getElementById('txCustomer').value.trim();
  const notes = document.getElementById('txNotes').value.trim();

  if (qty <= 0) {
    showToast('Jumlah galon harus lebih dari 0.', 'warning');
    return;
  }

  const txData = {
    date,
    time: time || '00:00',
    type,
    category,
    gallon_qty: qty,
    customer_name: customer,
    notes
  };

  if (AppState.editingTxId) {
    const res = await window.dbManager.updateTransaction(AppState.editingTxId, txData);
    if (res.success) {
      showToast('Catatan mutasi berhasil diperbarui!', 'success');
    } else {
      showToast('Gagal memperbarui catatan mutasi.', 'error');
    }
  } else {
    const res = await window.dbManager.createTransaction(txData);
    if (res.success) {
      showToast('Catatan mutasi stok berhasil disimpan!', 'success');
    } else {
      showToast('Gagal menyimpan catatan mutasi.', 'error');
    }
  }

  closeModal('transactionModal');
  await loadData();
}

// ----------------------------------------------------------------------------
// MODAL DELETE TRANSACTION
// ----------------------------------------------------------------------------
function openDeleteModal(id) {
  AppState.deleteTxId = id;
  const tx = AppState.allTransactions.find(t => t.id === id);
  const details = document.getElementById('deleteTxDetails');

  if (tx && details) {
    details.innerHTML = `
      <div style="font-weight: 700; color: var(--text-main);">${tx.category} - ${tx.gallon_qty} Galon</div>
      <div style="color: var(--text-muted); margin-top: 0.25rem;">
        Tanggal: ${FilterManager.formatDateIndo(tx.date)} ${tx.time ? `(${tx.time})` : ''} | Tipe: ${tx.type === 'keluar' ? 'Galon Keluar (-)' : 'Galon Masuk (+)'}
      </div>
      ${tx.customer_name ? `<div style="color: var(--text-muted);">Pelanggan: ${tx.customer_name}</div>` : ''}
    `;
  }

  openModal('deleteModal');
}

async function handleConfirmDelete() {
  if (!AppState.deleteTxId) return;

  const res = await window.dbManager.deleteTransaction(AppState.deleteTxId);
  if (res.success) {
    showToast('Catatan mutasi berhasil dihapus!', 'success');
  } else {
    showToast('Gagal menghapus data.', 'error');
  }

  closeModal('deleteModal');
  AppState.deleteTxId = null;
  await loadData();
}

// ----------------------------------------------------------------------------
// MODAL INVENTORY & STOCK MANAGEMENT
// ----------------------------------------------------------------------------
function openInventoryModal() {
  const inv = AppState.inventory || {};
  document.getElementById('invStockFilled').value = inv.stock_filled || 0;
  document.getElementById('invStockEmpty').value = inv.stock_empty || 0;
  document.getElementById('invStockBorrowed').value = inv.stock_borrowed || 0;
  document.getElementById('invStockBroken').value = inv.stock_broken || 0;

  openModal('inventoryModal');
}

async function handleSaveInventory(e) {
  e.preventDefault();

  const newInv = {
    stock_filled: parseInt(document.getElementById('invStockFilled').value) || 0,
    stock_empty: parseInt(document.getElementById('invStockEmpty').value) || 0,
    stock_borrowed: parseInt(document.getElementById('invStockBorrowed').value) || 0,
    stock_broken: parseInt(document.getElementById('invStockBroken').value) || 0
  };

  await window.dbManager.updateInventory(newInv);
  AppState.inventory = newInv;
  renderInventoryUI();
  closeModal('inventoryModal');
  showToast('Jumlah stok fisik galon berhasil diperbarui!', 'success');
}

// ----------------------------------------------------------------------------
// MODAL SUPABASE DATABASE CONFIG
// ----------------------------------------------------------------------------
function openDatabaseModal() {
  const creds = window.dbManager.getCredentials();
  document.getElementById('supabaseUrlInput').value = creds.url;
  document.getElementById('supabaseKeyInput').value = creds.key;

  const testStatus = document.getElementById('dbTestResult');
  testStatus.innerHTML = '';
  testStatus.className = '';

  openModal('databaseModal');
}

async function handleTestDbConnection() {
  const url = document.getElementById('supabaseUrlInput').value.trim();
  const key = document.getElementById('supabaseKeyInput').value.trim();
  const testStatus = document.getElementById('dbTestResult');

  if (!url || !key) {
    testStatus.className = 'badge badge-out';
    testStatus.textContent = 'Harap masukkan Supabase URL dan Anon Key terlebih dahulu.';
    return;
  }

  testStatus.className = 'badge';
  testStatus.textContent = 'Menguji koneksi ke Supabase...';

  const res = await window.dbManager.testConnection(url, key);
  if (res.success) {
    testStatus.className = 'badge badge-in';
    testStatus.textContent = '✅ ' + res.message;
  } else {
    testStatus.className = 'badge badge-out';
    testStatus.textContent = '❌ ' + res.message;
  }
}

async function handleSaveDbConfig(e) {
  e.preventDefault();
  const url = document.getElementById('supabaseUrlInput').value.trim();
  const key = document.getElementById('supabaseKeyInput').value.trim();

  window.dbManager.setCredentials(url, key);
  showToast('Konfigurasi database Supabase disimpan!', 'success');
  closeModal('databaseModal');
  await loadData();
}

async function handleSyncToCloud() {
  const statusElem = document.getElementById('dbTestResult');
  statusElem.className = 'badge';
  statusElem.textContent = 'Menyinkronkan data lokal ke cloud...';

  const res = await window.dbManager.syncLocalToCloud();
  if (res.success) {
    statusElem.className = 'badge badge-in';
    statusElem.textContent = `✅ Berhasil sinkron ${res.count} data ke Supabase!`;
    showToast(`Berhasil upload ${res.count} data ke Supabase Cloud!`, 'success');
    await loadData();
  } else {
    statusElem.className = 'badge badge-out';
    statusElem.textContent = '❌ ' + res.message;
    showToast(res.message, 'error');
  }
}

function handleUseLocalDb() {
  window.dbManager.setCredentials('', '');
  document.getElementById('supabaseUrlInput').value = '';
  document.getElementById('supabaseKeyInput').value = '';
  showToast('Beralih ke mode database lokal (LocalStorage)', 'info');
  closeModal('databaseModal');
  loadData();
}

function handleRestoreJson(e) {
  const file = e.target.files[0];
  if (!file) return;

  ExportManager.restoreJSON(file, async (err, data) => {
    if (err) {
      showToast('Gagal memulihkan data: ' + err.message, 'error');
    } else {
      if (data.transactions) {
        localStorage.setItem(STORAGE_KEYS.LOCAL_TRANSACTIONS, JSON.stringify(data.transactions));
      }
      if (data.inventory) {
        localStorage.setItem(STORAGE_KEYS.LOCAL_INVENTORY, JSON.stringify(data.inventory));
      }
      showToast('Data berhasil dipulihkan dari file JSON!', 'success');
      closeModal('databaseModal');
      await loadData();
    }
  });
}

// ----------------------------------------------------------------------------
// MODAL HELPER & TOAST NOTIFICATION
// ----------------------------------------------------------------------------
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconMap = {
    success: 'check-circle',
    error: 'alert-triangle',
    warning: 'alert-circle',
    info: 'info'
  };

  toast.innerHTML = `
    <i data-lucide="${iconMap[type] || 'info'}" class="toast-icon"></i>
    <div class="toast-text">${message}</div>
  `;

  container.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Make functions accessible globally for onclick attributes in HTML
window.openModal = openModal;
window.closeModal = closeModal;
window.openTransactionModal = openTransactionModal;
window.openDeleteModal = openDeleteModal;
