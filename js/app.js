/**
 * ==============================================================================
 * AQUAFLOW - MAIN APPLICATION LOGIC & CONTROLLER
 * ==============================================================================
 */

// Kategori Transaksi Bawaan
const CATEGORIES = {
  pemasukan: [
    'Isi Ulang Galon',
    'Galon Baru + Isi',
    'Tutup & Tisu Galon',
    'Galon Titip/Pinjam',
    'Delivery / Antar Galon',
    'Pemasukan Lainnya'
  ],
  pengeluaran: [
    'Pembelian Air Tangki Baku',
    'Pemeliharaan Mesin & Filter UV/RO',
    'Tutup & Tisu/Segel Galon',
    'Bensin Kurir/Operasional',
    'Listrik & Air PAM',
    'Gaji Karyawan',
    'Sewa Tempat',
    'Konsumsi & Operasional',
    'Pengeluaran Lainnya'
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
    type: 'all',            // 'all', 'pemasukan', 'pengeluaran'
    category: 'all',
    payment_method: 'all',
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

  // Refresh charts with updated theme palette
  updateAnalyticsAndCharts();
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('themeToggleBtn');
  if (!btn) return;
  btn.innerHTML = theme === 'dark' 
    ? '<i data-lucide="sun"></i>' 
    : '<i data-lucide="moon"></i>';
  lucide.createIcons();
}

function initTimeTicker() {
  const dateElem = document.getElementById('currentDateText');
  function updateTime() {
    if (!dateElem) return;
    const now = new Date();
    const formatted = new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(now);
    dateElem.textContent = formatted;
  }
  updateTime();
  setInterval(updateTime, 30000);
}

// ----------------------------------------------------------------------------
// LOAD DATA UTAMA
// ----------------------------------------------------------------------------
async function loadData() {
  updateDatabaseStatusIndicator();

  // Load Inventory
  AppState.inventory = await window.dbManager.getInventory();
  renderInventoryUI();

  // Load Transactions
  AppState.allTransactions = await window.dbManager.getAllTransactions();
  applyFiltersAndRender();
}

function updateDatabaseStatusIndicator() {
  const pill = document.getElementById('dbStatusPill');
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('dbStatusText');

  if (window.dbManager.isSupabaseConnected()) {
    dot.className = 'status-dot active';
    text.textContent = 'Supabase Cloud';
  } else {
    dot.className = 'status-dot offline';
    text.textContent = 'Local Storage (Offline)';
  }
}

// ----------------------------------------------------------------------------
// EVENT LISTENERS & BINDING
// ----------------------------------------------------------------------------
function initEventListeners() {
  // Theme Toggle
  document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);

  // Database Settings Modal
  document.getElementById('dbStatusPill')?.addEventListener('click', openDatabaseModal);
  document.getElementById('btnOpenDbSettings')?.addEventListener('click', openDatabaseModal);

  // Quick Cashier Buttons
  document.querySelectorAll('.btn-quick[data-quick-action]').forEach(btn => {
    btn.addEventListener('click', handleQuickCashierAction);
  });

  // Modal Transaksi Open Buttons
  document.getElementById('btnOpenAddTxModal')?.addEventListener('click', () => openTransactionModal());
  document.getElementById('btnOpenAddTxEmpty')?.addEventListener('click', () => openTransactionModal());

  // Form Transaksi Events
  document.querySelectorAll('input[name="txType"]').forEach(radio => {
    radio.addEventListener('change', handleTxTypeSwitch);
  });

  document.getElementById('txQty')?.addEventListener('input', calculateTxTotal);
  document.getElementById('txUnitPrice')?.addEventListener('input', calculateTxTotal);
  document.getElementById('txAmount')?.addEventListener('input', calculateTxTotal);
  document.getElementById('txCategory')?.addEventListener('change', handleCategoryChange);
  document.getElementById('transactionForm')?.addEventListener('submit', handleSaveTransaction);

  // Filter Mode Tabs
  document.querySelectorAll('.filter-tab-btn[data-mode]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-tab-btn[data-mode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      switchTimeFilterMode(btn.getAttribute('data-mode'));
    });
  });

  // Filter Quick Preset Buttons
  document.getElementById('filterQuickPreset')?.addEventListener('change', (e) => {
    AppState.filterCriteria.quickPreset = e.target.value;
    applyFiltersAndRender();
  });

  // Filter Date Inputs
  document.getElementById('filterStartDate')?.addEventListener('change', (e) => {
    AppState.filterCriteria.startDate = e.target.value;
    applyFiltersAndRender();
  });
  document.getElementById('filterEndDate')?.addEventListener('change', (e) => {
    AppState.filterCriteria.endDate = e.target.value;
    applyFiltersAndRender();
  });

  // Filter Day Pills
  document.querySelectorAll('.day-pill-btn[data-day]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.day-pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.filterCriteria.selectedDay = btn.getAttribute('data-day');
      applyFiltersAndRender();
    });
  });

  // Filter Month & Year
  document.getElementById('filterMonthSelect')?.addEventListener('change', (e) => {
    AppState.filterCriteria.selectedMonth = e.target.value;
    applyFiltersAndRender();
  });
  document.getElementById('filterYearSelect')?.addEventListener('change', (e) => {
    AppState.filterCriteria.selectedYear = e.target.value;
    applyFiltersAndRender();
  });

  // Filter Type Tabs (Semua / Pemasukan / Pengeluaran)
  document.querySelectorAll('.type-filter-btn[data-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.filterCriteria.type = btn.getAttribute('data-type');
      updateCategoryFilterOptions();
      applyFiltersAndRender();
    });
  });

  // Filter Category & Payment Method
  document.getElementById('filterCategorySelect')?.addEventListener('change', (e) => {
    AppState.filterCriteria.category = e.target.value;
    applyFiltersAndRender();
  });
  document.getElementById('filterPaymentSelect')?.addEventListener('change', (e) => {
    AppState.filterCriteria.payment_method = e.target.value;
    applyFiltersAndRender();
  });

  // Filter Search Input (Debounced)
  let searchTimeout = null;
  document.getElementById('filterSearchInput')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      AppState.filterCriteria.search = e.target.value;
      applyFiltersAndRender();
    }, 250);
  });

  // Reset Filter Button
  document.getElementById('btnResetFilter')?.addEventListener('click', resetFilters);

  // Export & Print Buttons
  document.getElementById('btnExportExcel')?.addEventListener('click', () => {
    ExportManager.exportToExcel(AppState.filteredTransactions, getActiveFilterDescription());
    showToast('Berhasil mengunduh laporan Excel (.xlsx)', 'success');
  });
  document.getElementById('btnExportCSV')?.addEventListener('click', () => {
    ExportManager.exportToCSV(AppState.filteredTransactions);
    showToast('Berhasil mengunduh laporan CSV', 'success');
  });
  document.getElementById('btnPrintReport')?.addEventListener('click', () => {
    ExportManager.printReport(getActiveFilterDescription());
  });

  // Backup & Restore
  document.getElementById('btnBackupJson')?.addEventListener('click', () => {
    ExportManager.backupJSON(AppState.allTransactions, AppState.inventory);
    showToast('Cadangan data berhasil diunduh', 'success');
  });

  document.getElementById('fileRestoreInput')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      ExportManager.restoreJSON(file, async (err, data) => {
        if (err) {
          showToast(err.message, 'danger');
          return;
        }
        if (confirm(`Impor ${data.transactions.length} data transaksi dari file cadangan?`)) {
          localStorage.setItem(STORAGE_KEYS.LOCAL_TRANSACTIONS, JSON.stringify(data.transactions));
          if (data.inventory) {
            localStorage.setItem(STORAGE_KEYS.LOCAL_INVENTORY, JSON.stringify(data.inventory));
          }
          await loadData();
          showToast('Data berhasil dipulihkan dari cadangan!', 'success');
          closeModal('databaseModal');
        }
      });
    }
  });

  // Inventory Modal Events
  document.getElementById('btnEditInventory')?.addEventListener('click', openInventoryModal);
  document.getElementById('inventoryForm')?.addEventListener('submit', handleSaveInventory);

  // Database Configuration Form Events
  document.getElementById('dbConfigForm')?.addEventListener('submit', handleSaveDbConfig);
  document.getElementById('btnTestDbConnection')?.addEventListener('click', handleTestDbConnection);
  document.getElementById('btnSyncCloud')?.addEventListener('click', handleSyncToCloud);
  document.getElementById('btnUseLocalDb')?.addEventListener('click', handleUseLocalDb);

  // Pagination Buttons
  document.getElementById('btnPrevPage')?.addEventListener('click', () => {
    if (AppState.pagination.page > 1) {
      AppState.pagination.page--;
      renderTable();
    }
  });
  document.getElementById('btnNextPage')?.addEventListener('click', () => {
    const totalPages = Math.ceil(AppState.filteredTransactions.length / AppState.pagination.pageSize) || 1;
    if (AppState.pagination.page < totalPages) {
      AppState.pagination.page++;
      renderTable();
    }
  });

  // Delete Confirm Button in Delete Modal
  document.getElementById('btnConfirmDelete')?.addEventListener('click', handleConfirmDelete);
}

// ----------------------------------------------------------------------------
// FILTER SWITCHING & RENDERING
// ----------------------------------------------------------------------------
function switchTimeFilterMode(mode) {
  AppState.filterCriteria.timeMode = mode;

  // Sembunyikan semua wadah opsi waktu
  document.getElementById('quickPresetWrap').style.display = 'none';
  document.getElementById('dateRangeWrap').style.display = 'none';
  document.getElementById('dayFilterWrap').style.display = 'none';
  document.getElementById('monthYearWrap').style.display = 'none';

  if (mode === 'quick') {
    document.getElementById('quickPresetWrap').style.display = 'block';
  } else if (mode === 'date') {
    document.getElementById('dateRangeWrap').style.display = 'grid';
    if (!AppState.filterCriteria.startDate) {
      const todayStr = new Date().toISOString().split('T')[0];
      document.getElementById('filterStartDate').value = todayStr;
      AppState.filterCriteria.startDate = todayStr;
    }
  } else if (mode === 'day') {
    document.getElementById('dayFilterWrap').style.display = 'block';
  } else if (mode === 'month' || mode === 'year') {
    document.getElementById('monthYearWrap').style.display = 'grid';
    document.getElementById('monthSelectGroup').style.display = mode === 'month' ? 'flex' : 'none';
  }

  applyFiltersAndRender();
}

function updateCategoryFilterOptions() {
  const select = document.getElementById('filterCategorySelect');
  if (!select) return;
  select.innerHTML = '<option value="all">Semua Kategori</option>';

  const type = AppState.filterCriteria.type;
  let list = [];
  if (type === 'pemasukan') list = CATEGORIES.pemasukan;
  else if (type === 'pengeluaran') list = CATEGORIES.pengeluaran;
  else list = [...CATEGORIES.pemasukan, ...CATEGORIES.pengeluaran];

  list.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
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
    payment_method: 'all',
    search: ''
  };

  // Reset UI elements
  document.querySelectorAll('.filter-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.filter-tab-btn[data-mode="quick"]')?.classList.add('active');
  document.getElementById('filterQuickPreset').value = 'thisMonth';
  document.getElementById('filterSearchInput').value = '';
  document.getElementById('filterPaymentSelect').value = 'all';
  document.querySelectorAll('.day-pill-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.day-pill-btn[data-day="all"]')?.classList.add('active');
  document.querySelectorAll('.type-filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.type-filter-btn[data-type="all"]')?.classList.add('active');

  switchTimeFilterMode('quick');
  updateCategoryFilterOptions();
  applyFiltersAndRender();
  showToast('Filter waktu & pencarian telah direset', 'info');
}

function applyFiltersAndRender() {
  AppState.filteredTransactions = FilterManager.filterTransactions(AppState.allTransactions, AppState.filterCriteria);
  AppState.pagination.page = 1; // Reset to page 1

  renderSummaryCards();
  renderTable();
  updateAnalyticsAndCharts();
  updateFilterDescriptionBadge();
}

function getActiveFilterDescription() {
  const fc = AppState.filterCriteria;
  if (fc.timeMode === 'quick') {
    const map = {
      today: 'Hari Ini',
      yesterday: 'Kemarin',
      last7days: '7 Hari Terakhir',
      thisMonth: 'Bulan Ini',
      lastMonth: 'Bulan Lalu',
      thisYear: 'Tahun Ini',
      all: 'Semua Periode'
    };
    return map[fc.quickPreset] || 'Periode Kustom';
  }
  if (fc.timeMode === 'date') {
    if (fc.startDate && fc.endDate) {
      return `${FilterManager.formatDateShort(fc.startDate)} - ${FilterManager.formatDateShort(fc.endDate)}`;
    }
    return FilterManager.formatDateIndo(fc.startDate);
  }
  if (fc.timeMode === 'day') {
    return fc.selectedDay === 'all' ? 'Semua Hari' : `Hari ${fc.selectedDay}`;
  }
  if (fc.timeMode === 'month') {
    return `${FilterManager.getMonthName(fc.selectedMonth)} ${fc.selectedYear}`;
  }
  if (fc.timeMode === 'year') {
    return `Tahun ${fc.selectedYear}`;
  }
  return 'Semua Data';
}

function updateFilterDescriptionBadge() {
  const badge = document.getElementById('activeFilterDescriptionBadge');
  const printDesc = document.getElementById('printPeriodDesc');
  const desc = getActiveFilterDescription();
  if (badge) badge.textContent = `Periode: ${desc}`;
  if (printDesc) printDesc.textContent = `Periode Laporan: ${desc} | Dicetak: ${new Date().toLocaleDateString('id-ID')}`;
}

// ----------------------------------------------------------------------------
// RENDER KPI & SUMMARY CARDS
// ----------------------------------------------------------------------------
function renderSummaryCards() {
  const summary = FilterManager.calculateSummary(AppState.filteredTransactions);

  document.getElementById('kpiTotalIncome').textContent = FilterManager.formatRupiah(summary.totalIncome);
  document.getElementById('kpiTotalExpense').textContent = FilterManager.formatRupiah(summary.totalExpense);
  
  const profitElem = document.getElementById('kpiNetProfit');
  profitElem.textContent = FilterManager.formatRupiah(summary.netProfit);
  if (summary.netProfit < 0) {
    profitElem.style.color = 'var(--danger-600)';
  } else {
    profitElem.style.color = '';
  }

  document.getElementById('kpiTotalGallons').textContent = summary.totalGallonsSold.toLocaleString('id-ID') + ' Galon';
  document.getElementById('kpiAvgSales').textContent = FilterManager.formatRupiah(summary.avgSalesPerDay) + ' /hari';
  document.getElementById('kpiTxCount').textContent = `${summary.totalTransactions} transaksi`;
}

function updateAnalyticsAndCharts() {
  const dateAggregated = FilterManager.aggregateByDate(AppState.filteredTransactions);
  const categoryAggregated = FilterManager.aggregateByCategory(AppState.filteredTransactions, AppState.filterCriteria.type === 'pengeluaran' ? 'pengeluaran' : 'pemasukan');

  window.chartManager.refreshCharts(dateAggregated, categoryAggregated);

  // Update Category Chart Title
  const catTitle = document.getElementById('categoryChartTitle');
  if (catTitle) {
    catTitle.innerHTML = AppState.filterCriteria.type === 'pengeluaran'
      ? '<i data-lucide="pie-chart"></i> Komposisi Pengeluaran'
      : '<i data-lucide="pie-chart"></i> Komposisi Pemasukan';
    lucide.createIcons();
  }
}

// ----------------------------------------------------------------------------
// RENDER TABEL TRANSAKSI & PAGINASI
// ----------------------------------------------------------------------------
function renderTable() {
  const tbody = document.getElementById('transactionsTableBody');
  const countBadge = document.getElementById('tableCountBadge');
  const emptyState = document.getElementById('tableEmptyState');
  const table = document.getElementById('transactionsTable');
  const footer = document.getElementById('tableFooter');

  const total = AppState.filteredTransactions.length;
  countBadge.textContent = `${total} Data`;

  if (total === 0) {
    table.style.display = 'none';
    emptyState.style.display = 'block';
    footer.style.display = 'none';
    return;
  }

  table.style.display = 'table';
  emptyState.style.display = 'none';
  footer.style.display = 'flex';

  // Pagination Slice
  const page = AppState.pagination.page;
  const pageSize = AppState.pagination.pageSize;
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);
  const pageItems = AppState.filteredTransactions.slice(startIndex, endIndex);

  // Update Pagination Info
  document.getElementById('paginationInfo').textContent = `Menampilkan ${startIndex + 1}-${endIndex} dari ${total} data`;
  document.getElementById('btnPrevPage').disabled = page === 1;
  document.getElementById('btnNextPage').disabled = endIndex >= total;

  tbody.innerHTML = '';
  pageItems.forEach((tx, idx) => {
    const tr = document.createElement('tr');

    const isIncome = tx.type === 'pemasukan';
    const amountClass = isIncome ? 'amount-income' : 'amount-expense';
    const amountPrefix = isIncome ? '+ ' : '- ';
    const badgeClass = isIncome ? 'badge-income' : 'badge-expense';
    const badgeIcon = isIncome ? 'arrow-down-left' : 'arrow-up-right';

    tr.innerHTML = `
      <td>
        <div style="font-weight: 700;">${FilterManager.formatDateIndo(tx.date)}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.35rem;">
          <span class="day-badge">${tx.day_name || '-'}</span>
          <span>${tx.time || ''}</span>
        </div>
      </td>
      <td>
        <span class="badge ${badgeClass}">
          <i data-lucide="${badgeIcon}" style="width: 12px; height: 12px;"></i>
          ${tx.category}
        </span>
      </td>
      <td style="text-align: center; font-weight: 700;">
        ${tx.gallon_qty > 0 ? `${tx.gallon_qty} Galon` : '<span style="color: var(--text-subtle);">-</span>'}
      </td>
      <td style="font-size: 0.8rem; color: var(--text-muted);">
        ${tx.unit_price > 0 ? FilterManager.formatRupiah(tx.unit_price) : '-'}
      </td>
      <td>
        <span class="${amountClass}">
          ${amountPrefix}${FilterManager.formatRupiah(tx.amount)}
        </span>
      </td>
      <td>
        <span class="badge badge-pay">${tx.payment_method || 'Tunai'}</span>
      </td>
      <td>
        <div style="font-weight: 600; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${tx.customer_name || '<span style="color: var(--text-subtle); font-style: italic;">Umum</span>'}
        </div>
        ${tx.notes ? `<div style="font-size: 0.75rem; color: var(--text-muted); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${tx.notes}</div>` : ''}
      </td>
      <td class="actions-cell">
        <button class="btn btn-outline btn-sm btn-icon" title="Edit Transaksi" onclick="editTransaction('${tx.id}')">
          <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
        </button>
        <button class="btn btn-danger-outline btn-sm btn-icon" title="Hapus Transaksi" onclick="confirmDeleteTransaction('${tx.id}')">
          <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  lucide.createIcons();
}

// ----------------------------------------------------------------------------
// QUICK CASHIER ACTION SHORTCUTS
// ----------------------------------------------------------------------------
async function handleQuickCashierAction(e) {
  const btn = e.currentTarget;
  const action = btn.getAttribute('data-quick-action');
  const today = new Date();
  const defaultRefillPrice = AppState.inventory.refill_price || 6000;
  const defaultNewPrice = AppState.inventory.new_gallon_price || 45000;

  let qty = 1;
  let unitPrice = defaultRefillPrice;
  let category = 'Isi Ulang Galon';
  let notes = 'Kasir Cepat';

  if (action === 'refill-1') {
    qty = 1;
    unitPrice = defaultRefillPrice;
    category = 'Isi Ulang Galon';
    notes = 'Kasir Cepat (1 Galon)';
  } else if (action === 'refill-5') {
    qty = 5;
    unitPrice = defaultRefillPrice;
    category = 'Isi Ulang Galon';
    notes = 'Kasir Cepat (5 Galon)';
  } else if (action === 'refill-10') {
    qty = 10;
    unitPrice = defaultRefillPrice;
    category = 'Isi Ulang Galon';
    notes = 'Kasir Cepat (10 Galon)';
  } else if (action === 'new-1') {
    qty = 1;
    unitPrice = defaultNewPrice;
    category = 'Galon Baru + Isi';
    notes = 'Kasir Cepat (1 Galon Baru + Isi)';
  }

  const txData = {
    date: today.toISOString().split('T')[0],
    time: today.toTimeString().substring(0, 5),
    day_name: getIndonesianDayName(today),
    day_of_week: getDayOfWeekNumber(today),
    month: today.getMonth() + 1,
    year: today.getFullYear(),
    type: 'pemasukan',
    category: category,
    gallon_qty: qty,
    unit_price: unitPrice,
    amount: qty * unitPrice,
    payment_method: 'Tunai',
    customer_name: 'Pelanggan Loket',
    notes: notes
  };

  const res = await window.dbManager.createTransaction(txData);
  if (res.success) {
    showToast(`+${qty} Galon (${FilterManager.formatRupiah(txData.amount)}) berhasil dicatat!`, 'success');
    await loadData();
  } else {
    showToast('Gagal menyimpan transaksi kasir cepat.', 'danger');
  }
}

// ----------------------------------------------------------------------------
// MODAL CRUD TRANSAKSI
// ----------------------------------------------------------------------------
function openTransactionModal(txId = null) {
  AppState.editingTxId = txId;
  const modal = document.getElementById('transactionModal');
  const title = document.getElementById('txModalTitle');
  const form = document.getElementById('transactionForm');
  form.reset();

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const timeStr = today.toTimeString().substring(0, 5);

  if (txId) {
    // Mode Edit
    title.innerHTML = '<i data-lucide="edit-3"></i> Edit Transaksi';
    const tx = AppState.allTransactions.find(t => t.id === txId);
    if (tx) {
      document.querySelector(`input[name="txType"][value="${tx.type}"]`).checked = true;
      handleTxTypeSwitch();
      document.getElementById('txDate').value = tx.date;
      document.getElementById('txTime').value = tx.time || timeStr;
      document.getElementById('txCategory').value = tx.category;
      document.getElementById('txQty').value = tx.gallon_qty || 0;
      document.getElementById('txUnitPrice').value = tx.unit_price || 0;
      document.getElementById('txAmount').value = tx.amount;
      document.getElementById('txPaymentMethod').value = tx.payment_method || 'Tunai';
      document.getElementById('txCustomer').value = tx.customer_name || '';
      document.getElementById('txNotes').value = tx.notes || '';
      calculateTxTotal();
    }
  } else {
    // Mode Tambah Baru
    title.innerHTML = '<i data-lucide="plus-circle"></i> Tambah Transaksi';
    document.querySelector('input[name="txType"][value="pemasukan"]').checked = true;
    handleTxTypeSwitch();
    document.getElementById('txDate').value = todayStr;
    document.getElementById('txTime').value = timeStr;
    document.getElementById('txCategory').value = 'Isi Ulang Galon';
    document.getElementById('txQty').value = 1;
    document.getElementById('txUnitPrice').value = AppState.inventory.refill_price || 6000;
    document.getElementById('txPaymentMethod').value = 'Tunai';
    calculateTxTotal();
  }

  lucide.createIcons();
  openModal('transactionModal');
}

window.editTransaction = function(id) {
  openTransactionModal(id);
};

function handleTxTypeSwitch() {
  const type = document.querySelector('input[name="txType"]:checked')?.value || 'pemasukan';
  const categorySelect = document.getElementById('txCategory');
  const qtyGroup = document.getElementById('txQtyGroup');
  const unitPriceGroup = document.getElementById('txUnitPriceGroup');

  categorySelect.innerHTML = '';
  const list = type === 'pemasukan' ? CATEGORIES.pemasukan : CATEGORIES.pengeluaran;
  list.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  });

  if (type === 'pemasukan') {
    qtyGroup.style.display = 'block';
    unitPriceGroup.style.display = 'block';
    document.getElementById('txUnitPrice').value = AppState.inventory.refill_price || 6000;
  } else {
    qtyGroup.style.display = 'none';
    unitPriceGroup.style.display = 'none';
    document.getElementById('txQty').value = 0;
    document.getElementById('txUnitPrice').value = 0;
  }

  calculateTxTotal();
}

function handleCategoryChange(e) {
  const cat = e.target.value;
  const type = document.querySelector('input[name="txType"]:checked')?.value || 'pemasukan';

  if (type === 'pemasukan') {
    if (cat === 'Isi Ulang Galon') {
      document.getElementById('txUnitPrice').value = AppState.inventory.refill_price || 6000;
    } else if (cat === 'Galon Baru + Isi') {
      document.getElementById('txUnitPrice').value = AppState.inventory.new_gallon_price || 45000;
    } else {
      document.getElementById('txUnitPrice').value = 0;
    }
    calculateTxTotal();
  }
}

function calculateTxTotal() {
  const qty = parseFloat(document.getElementById('txQty')?.value) || 0;
  const unitPrice = parseFloat(document.getElementById('txUnitPrice')?.value) || 0;
  const amountInput = document.getElementById('txAmount');
  const calcDisplay = document.getElementById('txCalcDisplay');

  if (qty > 0 && unitPrice > 0) {
    const total = qty * unitPrice;
    amountInput.value = total;
    calcDisplay.textContent = FilterManager.formatRupiah(total);
  } else {
    const manualAmount = parseFloat(amountInput.value) || 0;
    calcDisplay.textContent = FilterManager.formatRupiah(manualAmount);
  }
}

async function handleSaveTransaction(e) {
  e.preventDefault();

  const type = document.querySelector('input[name="txType"]:checked').value;
  const dateVal = document.getElementById('txDate').value;
  const timeVal = document.getElementById('txTime').value;
  const category = document.getElementById('txCategory').value;
  const qty = parseInt(document.getElementById('txQty').value) || 0;
  const unitPrice = parseFloat(document.getElementById('txUnitPrice').value) || 0;
  const amount = parseFloat(document.getElementById('txAmount').value) || 0;
  const paymentMethod = document.getElementById('txPaymentMethod').value;
  const customer = document.getElementById('txCustomer').value.trim();
  const notes = document.getElementById('txNotes').value.trim();

  if (!dateVal) {
    alert('Harap pilih tanggal transaksi.');
    return;
  }

  if (amount <= 0) {
    alert('Nominal transaksi harus lebih besar dari Rp 0.');
    return;
  }

  const txDateObj = new Date(dateVal + 'T' + (timeVal || '00:00') + ':00');

  const payload = {
    date: dateVal,
    time: timeVal,
    day_name: getIndonesianDayName(txDateObj),
    day_of_week: getDayOfWeekNumber(txDateObj),
    month: txDateObj.getMonth() + 1,
    year: txDateObj.getFullYear(),
    type: type,
    category: category,
    gallon_qty: qty,
    unit_price: unitPrice,
    amount: amount,
    payment_method: paymentMethod,
    customer_name: customer,
    notes: notes
  };

  let result;
  if (AppState.editingTxId) {
    result = await window.dbManager.updateTransaction(AppState.editingTxId, payload);
    if (result.success) {
      showToast('Transaksi berhasil diperbarui!', 'success');
    } else {
      showToast('Gagal memperbarui transaksi: ' + (result.message || ''), 'danger');
    }
  } else {
    result = await window.dbManager.createTransaction(payload);
    if (result.success) {
      showToast('Transaksi baru berhasil ditambahkan!', 'success');
    } else {
      showToast('Gagal menambahkan transaksi.', 'danger');
    }
  }

  closeModal('transactionModal');
  await loadData();
}

// ----------------------------------------------------------------------------
// MODAL HAPUS TRANSAKSI
// ----------------------------------------------------------------------------
window.confirmDeleteTransaction = function(id) {
  AppState.deleteTxId = id;
  const tx = AppState.allTransactions.find(t => t.id === id);
  if (tx) {
    document.getElementById('deleteTxDetails').innerHTML = `
      <strong>${FilterManager.formatDateIndo(tx.date)}</strong> (${tx.day_name})<br/>
      Kategori: <strong>${tx.category}</strong> - Nominal: <strong>${FilterManager.formatRupiah(tx.amount)}</strong>
    `;
  }
  openModal('deleteModal');
};

async function handleConfirmDelete() {
  if (!AppState.deleteTxId) return;

  const res = await window.dbManager.deleteTransaction(AppState.deleteTxId);
  if (res.success) {
    showToast('Transaksi berhasil dihapus!', 'success');
    closeModal('deleteModal');
    AppState.deleteTxId = null;
    await loadData();
  } else {
    showToast('Gagal menghapus transaksi.', 'danger');
  }
}

// ----------------------------------------------------------------------------
// MODAL & MANAJEMEN INVENTARIS STOK GALON
// ----------------------------------------------------------------------------
function renderInventoryUI() {
  const inv = AppState.inventory || {};
  document.getElementById('stockFilledDisplay').textContent = (inv.stock_filled || 0) + ' Galon';
  document.getElementById('stockEmptyDisplay').textContent = (inv.stock_empty || 0) + ' Galon';
  document.getElementById('stockBorrowedDisplay').textContent = (inv.stock_borrowed || 0) + ' Galon';
}

function openInventoryModal() {
  const inv = AppState.inventory || {};
  document.getElementById('invStockFilled').value = inv.stock_filled || 0;
  document.getElementById('invStockEmpty').value = inv.stock_empty || 0;
  document.getElementById('invStockBorrowed').value = inv.stock_borrowed || 0;
  document.getElementById('invRefillPrice').value = inv.refill_price || 6000;
  document.getElementById('invNewPrice').value = inv.new_gallon_price || 45000;
  openModal('inventoryModal');
}

async function handleSaveInventory(e) {
  e.preventDefault();
  const newInv = {
    stock_filled: parseInt(document.getElementById('invStockFilled').value) || 0,
    stock_empty: parseInt(document.getElementById('invStockEmpty').value) || 0,
    stock_borrowed: parseInt(document.getElementById('invStockBorrowed').value) || 0,
    refill_price: parseFloat(document.getElementById('invRefillPrice').value) || 6000,
    new_gallon_price: parseFloat(document.getElementById('invNewPrice').value) || 45000
  };

  await window.dbManager.updateInventory(newInv);
  AppState.inventory = newInv;
  renderInventoryUI();
  closeModal('inventoryModal');
  showToast('Inventaris & harga galon berhasil diperbarui!', 'success');
}

// ----------------------------------------------------------------------------
// MODAL KONFIGURASI SUPABASE DATABASE
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
    testStatus.className = 'badge badge-expense';
    testStatus.textContent = 'Harap masukkan Supabase URL dan Anon Key terlebih dahulu.';
    return;
  }

  testStatus.className = 'badge';
  testStatus.textContent = 'Menguji koneksi ke Supabase...';

  const res = await window.dbManager.testConnection(url, key);
  if (res.success) {
    testStatus.className = 'badge badge-income';
    testStatus.textContent = '✅ ' + res.message;
  } else {
    testStatus.className = 'badge badge-expense';
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
    showToast(`Sukses sinkronisasi ${res.count} transaksi ke Supabase!`, 'success');
    closeModal('databaseModal');
    await loadData();
  } else {
    statusElem.className = 'badge badge-expense';
    statusElem.textContent = '❌ ' + res.message;
  }
}

function handleUseLocalDb() {
  window.dbManager.setCredentials('', '');
  showToast('Beralih ke mode penyimpanan lokal (LocalStorage).', 'info');
  closeModal('databaseModal');
  loadData();
}

// ----------------------------------------------------------------------------
// MODAL & TOAST HELPERS
// ----------------------------------------------------------------------------
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

window.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
};

// Close modal on click outside dialog
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      closeModal(backdrop.id);
    }
  });
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-backdrop.open').forEach(m => closeModal(m.id));
  }
});

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle';
  if (type === 'danger') iconName = 'alert-triangle';

  toast.innerHTML = `
    <i data-lucide="${iconName}" style="width: 18px; height: 18px; flex-shrink: 0;"></i>
    <div style="flex: 1;">${message}</div>
  `;

  container.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

window.showToast = showToast;
