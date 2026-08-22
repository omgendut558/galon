/**
 * ==============================================================================
 * AQUAFLOW - MULTI-DIMENSIONAL FILTER & ANALYTICS MODULE (STOCK MANAGEMENT)
 * ==============================================================================
 * Modul ini menangani penyaringan data mutasi stok galon berdasarkan tanggal,
 * hari, bulan, tahun, tipe mutasi, kategori, dan kalkulasi ringkasan metrik galon.
 */

const FilterManager = {
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
      // 1. Filter Tipe Mutasi (Semua / Keluar / Masuk)
      if (criteria.type && criteria.type !== 'all' && tx.type !== criteria.type) {
        return false;
      }

      // 2. Filter Kategori
      if (criteria.category && criteria.category !== 'all' && tx.category !== criteria.category) {
        return false;
      }

      // 3. Filter Pencarian Teks (Nama Pelanggan / Catatan / Kategori)
      if (criteria.search && criteria.search.trim() !== '') {
        const query = criteria.search.toLowerCase().trim();
        const matchCustomer = (tx.customer_name || '').toLowerCase().includes(query);
        const matchNotes = (tx.notes || '').toLowerCase().includes(query);
        const matchCategory = (tx.category || '').toLowerCase().includes(query);
        const matchQty = String(tx.gallon_qty || '').includes(query);
        if (!matchCustomer && !matchNotes && !matchCategory && !matchQty) {
          return false;
        }
      }

      // 4. Filter Berdasarkan Mode Waktu
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

  // Kalkulasi Ringkasan Mutasi Stok Galon (KPI)
  calculateSummary(filteredTransactions) {
    let totalGallonsOut = 0;
    let totalGallonsIn = 0;
    let totalTransactions = filteredTransactions.length;
    const uniqueDates = new Set();

    filteredTransactions.forEach(tx => {
      const qty = parseInt(tx.gallon_qty) || 0;
      if (tx.date) uniqueDates.add(tx.date);

      if (tx.type === 'keluar') {
        totalGallonsOut += qty;
      } else if (tx.type === 'masuk') {
        totalGallonsIn += qty;
      }
    });

    const netGallonMovement = totalGallonsIn - totalGallonsOut;
    const activeDaysCount = Math.max(1, uniqueDates.size);
    const avgGallonsOutPerDay = Math.round(totalGallonsOut / activeDaysCount);
    const avgGallonsInPerDay = Math.round(totalGallonsIn / activeDaysCount);

    return {
      totalGallonsOut,
      totalGallonsIn,
      netGallonMovement,
      totalTransactions,
      activeDaysCount,
      avgGallonsOutPerDay,
      avgGallonsInPerDay
    };
  },

  // Agregasi Data untuk Grafik Tren Waktu (Galon Keluar vs Galon Masuk per Tanggal)
  aggregateByDate(transactions) {
    const map = {};

    transactions.forEach(tx => {
      const dateKey = tx.date || 'Lainnya';
      if (!map[dateKey]) {
        map[dateKey] = {
          date: dateKey,
          label: FilterManager.formatDateShort(dateKey),
          gallonsOut: 0,
          gallonsIn: 0
        };
      }
      const qty = parseInt(tx.gallon_qty) || 0;
      if (tx.type === 'keluar') {
        map[dateKey].gallonsOut += qty;
      } else if (tx.type === 'masuk') {
        map[dateKey].gallonsIn += qty;
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
      summary[d] = { day: d, gallonsOut: 0, gallonsIn: 0, count: 0 };
    });

    transactions.forEach(tx => {
      const day = tx.day_name;
      if (summary[day]) {
        const qty = parseInt(tx.gallon_qty) || 0;
        if (tx.type === 'keluar') {
          summary[day].gallonsOut += qty;
        } else if (tx.type === 'masuk') {
          summary[day].gallonsIn += qty;
        }
        summary[day].count += 1;
      }
    });

    return Object.values(summary);
  },

  // Agregasi Komposisi Kategori untuk Diagram Donat (Berdasarkan Qty Galon)
  aggregateByCategory(transactions, type = 'keluar') {
    const catMap = {};
    transactions
      .filter(tx => (type === 'all' ? true : tx.type === type))
      .forEach(tx => {
        const cat = tx.category || 'Lain-lain';
        const qty = parseInt(tx.gallon_qty) || 0;
        catMap[cat] = (catMap[cat] || 0) + qty;
      });

    return {
      labels: Object.keys(catMap),
      values: Object.values(catMap)
    };
  }
};

window.FilterManager = FilterManager;
