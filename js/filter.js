/**
 * ==============================================================================
 * AQUAFLOW - MULTI-DIMENSIONAL FILTER & ANALYTICS MODULE
 * ==============================================================================
 * Modul ini menangani penyaringan data transaksi berdasarkan tanggal, hari,
 * bulan, tahun, tipe, kategori, metode pembayaran, dan kalkulasi ringkasan KPI.
 */

const FilterManager = {
  // Format Mata Uang Rupiah (Rp)
  formatRupiah(number) {
    if (isNaN(number) || number === null || number === undefined) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(number);
  },

  // Format Tanggal Indonesia (contoh: 16 Agustus 2026)
  formatDateIndo(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  },

  // Format Tanggal Singkat (contoh: 16 Agu)
  formatDateShort(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short'
    }).format(date);
  },

  // Nama Bulan Indonesia
  getMonthName(monthNum) {
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return months[monthNum - 1] || '';
  },

  // Filter Utama Berdasarkan Kriteria Waktu & Kategori
  filterTransactions(transactions, criteria) {
    if (!Array.isArray(transactions)) return [];

    return transactions.filter(tx => {
      // 1. Filter Tipe Transaksi (Semua / Pemasukan / Pengeluaran)
      if (criteria.type && criteria.type !== 'all' && tx.type !== criteria.type) {
        return false;
      }

      // 2. Filter Kategori
      if (criteria.category && criteria.category !== 'all' && tx.category !== criteria.category) {
        return false;
      }

      // 3. Filter Metode Pembayaran
      if (criteria.payment_method && criteria.payment_method !== 'all' && tx.payment_method !== criteria.payment_method) {
        return false;
      }

      // 4. Filter Pencarian Teks (Nama Pelanggan / Catatan / Kategori)
      if (criteria.search && criteria.search.trim() !== '') {
        const query = criteria.search.toLowerCase().trim();
        const matchCustomer = (tx.customer_name || '').toLowerCase().includes(query);
        const matchNotes = (tx.notes || '').toLowerCase().includes(query);
        const matchCategory = (tx.category || '').toLowerCase().includes(query);
        const matchAmount = String(tx.amount || '').includes(query);
        if (!matchCustomer && !matchNotes && !matchCategory && !matchAmount) {
          return false;
        }
      }

      // 5. Filter Berdasarkan Mode Waktu
      const txDate = tx.date ? new Date(tx.date + 'T00:00:00') : new Date();
      const txDayName = tx.day_name || getIndonesianDayName(txDate);
      const txMonth = tx.month || (txDate.getMonth() + 1);
      const txYear = tx.year || txDate.getFullYear();

      // Mode Filter: Preset Cepat (Quick)
      if (criteria.timeMode === 'quick') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (criteria.quickPreset === 'today') {
          const checkDate = new Date(txDate);
          checkDate.setHours(0, 0, 0, 0);
          return checkDate.getTime() === today.getTime();
        }

        if (criteria.quickPreset === 'yesterday') {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const checkDate = new Date(txDate);
          checkDate.setHours(0, 0, 0, 0);
          return checkDate.getTime() === yesterday.getTime();
        }

        if (criteria.quickPreset === 'last7days') {
          const sevenDaysAgo = new Date(today);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
          const checkDate = new Date(txDate);
          checkDate.setHours(0, 0, 0, 0);
          return checkDate >= sevenDaysAgo && checkDate <= today;
        }

        if (criteria.quickPreset === 'thisMonth') {
          return txMonth === (today.getMonth() + 1) && txYear === today.getFullYear();
        }

        if (criteria.quickPreset === 'lastMonth') {
          const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          return txMonth === (lastMonthDate.getMonth() + 1) && txYear === lastMonthDate.getFullYear();
        }

        if (criteria.quickPreset === 'thisYear') {
          return txYear === today.getFullYear();
        }

        if (criteria.quickPreset === 'all') {
          return true;
        }
      }

      // Mode Filter: Tanggal Spesifik / Rentang Tanggal (Date Range)
      if (criteria.timeMode === 'date') {
        if (criteria.startDate && criteria.endDate) {
          const start = new Date(criteria.startDate + 'T00:00:00');
          const end = new Date(criteria.endDate + 'T23:59:59');
          return txDate >= start && txDate <= end;
        } else if (criteria.startDate) {
          const singleDate = criteria.startDate;
          return tx.date === singleDate;
        }
      }

      // Mode Filter: Hari dalam Seminggu (Senin - Minggu)
      if (criteria.timeMode === 'day') {
        if (criteria.selectedDay && criteria.selectedDay !== 'all') {
          return txDayName.toLowerCase() === criteria.selectedDay.toLowerCase();
        }
      }

      // Mode Filter: Bulan Spesifik + Tahun
      if (criteria.timeMode === 'month') {
        const monthMatch = criteria.selectedMonth ? parseInt(txMonth) === parseInt(criteria.selectedMonth) : true;
        const yearMatch = criteria.selectedYear ? parseInt(txYear) === parseInt(criteria.selectedYear) : true;
        return monthMatch && yearMatch;
      }

      // Mode Filter: Tahun Spesifik
      if (criteria.timeMode === 'year') {
        if (criteria.selectedYear) {
          return parseInt(txYear) === parseInt(criteria.selectedYear);
        }
      }

      return true;
    });
  },

  // Kalkulasi Ringkasan Finansial & Statistik (KPI)
  calculateSummary(filteredTransactions) {
    let totalIncome = 0;
    let totalExpense = 0;
    let totalGallonsSold = 0;
    let totalTransactions = filteredTransactions.length;
    const uniqueDates = new Set();

    filteredTransactions.forEach(tx => {
      const amount = parseFloat(tx.amount) || 0;
      const qty = parseInt(tx.gallon_qty) || 0;

      if (tx.date) uniqueDates.add(tx.date);

      if (tx.type === 'pemasukan') {
        totalIncome += amount;
        totalGallonsSold += qty;
      } else if (tx.type === 'pengeluaran') {
        totalExpense += amount;
      }
    });

    const netProfit = totalIncome - totalExpense;
    const activeDaysCount = Math.max(1, uniqueDates.size);
    const avgSalesPerDay = totalIncome / activeDaysCount;
    const avgGallonsPerDay = Math.round(totalGallonsSold / activeDaysCount);

    return {
      totalIncome,
      totalExpense,
      netProfit,
      totalGallonsSold,
      totalTransactions,
      activeDaysCount,
      avgSalesPerDay,
      avgGallonsPerDay
    };
  },

  // Agregasi Data untuk Grafik Tren Waktu (Pemasukan vs Pengeluaran per Tanggal)
  aggregateByDate(transactions) {
    const map = {};

    transactions.forEach(tx => {
      const dateKey = tx.date || 'Lainnya';
      if (!map[dateKey]) {
        map[dateKey] = {
          date: dateKey,
          label: FilterManager.formatDateShort(dateKey),
          income: 0,
          expense: 0,
          gallonQty: 0
        };
      }
      const amt = parseFloat(tx.amount) || 0;
      const qty = parseInt(tx.gallon_qty) || 0;
      if (tx.type === 'pemasukan') {
        map[dateKey].income += amt;
        map[dateKey].gallonQty += qty;
      } else if (tx.type === 'pengeluaran') {
        map[dateKey].expense += amt;
      }
    });

    // Urutkan berdasarkan tanggal kronologis
    const sorted = Object.values(map).sort((a, b) => new Date(a.date) - new Date(b.date));
    return sorted;
  },

  // Agregasi Data Berdasarkan Hari dalam Seminggu
  aggregateByDayOfWeek(transactions) {
    const daysOrder = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    const summary = {};
    daysOrder.forEach(d => {
      summary[d] = { day: d, income: 0, gallons: 0, count: 0 };
    });

    transactions.forEach(tx => {
      const day = tx.day_name;
      if (summary[day]) {
        const amt = parseFloat(tx.amount) || 0;
        const qty = parseInt(tx.gallon_qty) || 0;
        if (tx.type === 'pemasukan') {
          summary[day].income += amt;
          summary[day].gallons += qty;
          summary[day].count += 1;
        }
      }
    });

    return Object.values(summary);
  },

  // Agregasi Komposisi Kategori untuk Diagram Donat
  aggregateByCategory(transactions, type = 'pemasukan') {
    const catMap = {};
    transactions
      .filter(tx => tx.type === type)
      .forEach(tx => {
        const cat = tx.category || 'Lain-lain';
        const amt = parseFloat(tx.amount) || 0;
        catMap[cat] = (catMap[cat] || 0) + amt;
      });

    return {
      labels: Object.keys(catMap),
      values: Object.values(catMap)
    };
  }
};

window.FilterManager = FilterManager;
