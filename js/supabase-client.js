/**
 * ==============================================================================
 * AQUAFLOW - SUPABASE CLIENT & HYBRID STORAGE MODULE (STOCK MANAGEMENT)
 * ==============================================================================
 * Modul ini menangani operasi CRUD Mutasi Stok Galon ke Supabase Database
 * dengan fitur Auto-Fallback ke LocalStorage apabila offline.
 */

const STORAGE_KEYS = {
  SUPABASE_URL: 'aquaflow_supabase_url',
  SUPABASE_KEY: 'aquaflow_supabase_anon_key',
  LOCAL_TRANSACTIONS: 'aquaflow_local_transactions',
  LOCAL_INVENTORY: 'aquaflow_local_inventory',
  THEME: 'aquaflow_theme'
};

// Data Awal Bawaan (Default Sample Data) Stok Fisik Galon
const DEFAULT_INVENTORY = {
  stock_filled: 85,
  stock_empty: 30,
  stock_borrowed: 12,
  stock_broken: 2
};

const DEFAULT_TRANSACTIONS = [
  {
    id: 'demo-tx-1',
    date: new Date().toISOString().split('T')[0],
    time: '08:30',
    day_name: getIndonesianDayName(new Date()),
    day_of_week: getDayOfWeekNumber(new Date()),
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    type: 'keluar',
    category: 'Isi Ulang Galon',
    gallon_qty: 15,
    customer_name: 'Warung Bu Siti',
    notes: 'Pengiriman pagi 15 galon isi ulang (tukar galon)'
  },
  {
    id: 'demo-tx-2',
    date: new Date().toISOString().split('T')[0],
    time: '09:45',
    day_name: getIndonesianDayName(new Date()),
    day_of_week: getDayOfWeekNumber(new Date()),
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    type: 'keluar',
    category: 'Galon Baru + Isi',
    gallon_qty: 2,
    customer_name: 'Pak Hendra (Blok B-12)',
    notes: 'Pelanggan baru ambil 2 galon isi + bodi'
  },
  {
    id: 'demo-tx-3',
    date: new Date().toISOString().split('T')[0],
    time: '11:15',
    day_name: getIndonesianDayName(new Date()),
    day_of_week: getDayOfWeekNumber(new Date()),
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    type: 'keluar',
    category: 'Isi Ulang Galon',
    gallon_qty: 8,
    customer_name: 'Bpk. RT 04',
    notes: 'Isi ulang rutin warga RT 04'
  },
  {
    id: 'demo-tx-4',
    date: new Date().toISOString().split('T')[0],
    time: '13:00',
    day_name: getIndonesianDayName(new Date()),
    day_of_week: getDayOfWeekNumber(new Date()),
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    type: 'masuk',
    category: 'Pengadaan Galon Baru',
    gallon_qty: 20,
    customer_name: 'Pabrik Galon Mitra',
    notes: 'Masuk kiriman 20 unit galon baru'
  },
  {
    id: 'demo-tx-5',
    date: new Date().toISOString().split('T')[0],
    time: '14:20',
    day_name: getIndonesianDayName(new Date()),
    day_of_week: getDayOfWeekNumber(new Date()),
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    type: 'keluar',
    category: 'Isi Ulang Galon',
    gallon_qty: 20,
    customer_name: 'Laundry Barokah',
    notes: 'Langganan laundry antar 20 galon'
  },
  {
    id: 'demo-tx-6',
    date: getRelativeDateString(-1),
    time: '09:00',
    day_name: getIndonesianDayName(getRelativeDate(-1)),
    day_of_week: getDayOfWeekNumber(getRelativeDate(-1)),
    month: getRelativeDate(-1).getMonth() + 1,
    year: getRelativeDate(-1).getFullYear(),
    type: 'keluar',
    category: 'Isi Ulang Galon',
    gallon_qty: 35,
    customer_name: 'Loket Depot',
    notes: 'Penjualan loket Sabtu pagi'
  },
  {
    id: 'demo-tx-7',
    date: getRelativeDateString(-1),
    time: '14:00',
    day_name: getIndonesianDayName(getRelativeDate(-1)),
    day_of_week: getDayOfWeekNumber(getRelativeDate(-1)),
    month: getRelativeDate(-1).getMonth() + 1,
    year: getRelativeDate(-1).getFullYear(),
    type: 'masuk',
    category: 'Pengembalian Galon Pinjam',
    gallon_qty: 5,
    customer_name: 'Keluarga Bpk. Herman',
    notes: 'Kembalikan 5 galon sisa acara syukuran'
  },
  {
    id: 'demo-tx-8',
    date: getRelativeDateString(-2),
    time: '10:00',
    day_name: getIndonesianDayName(getRelativeDate(-2)),
    day_of_week: getDayOfWeekNumber(getRelativeDate(-2)),
    month: getRelativeDate(-2).getMonth() + 1,
    year: getRelativeDate(-2).getFullYear(),
    type: 'keluar',
    category: 'Galon Rusak / Pecah',
    gallon_qty: 2,
    customer_name: 'Internal Depot',
    notes: 'Galon pecah saat bongkar muat'
  },
  {
    id: 'demo-tx-9',
    date: getRelativeDateString(-3),
    time: '15:30',
    day_name: getIndonesianDayName(getRelativeDate(-3)),
    day_of_week: getDayOfWeekNumber(getRelativeDate(-3)),
    month: getRelativeDate(-3).getMonth() + 1,
    year: getRelativeDate(-3).getFullYear(),
    type: 'keluar',
    category: 'Isi Ulang Galon',
    gallon_qty: 40,
    customer_name: 'Depot & Antar',
    notes: 'Distribusi sore wilayah timur'
  }
];

class DatabaseManager {
  constructor() {
    this.client = null;
    this.isCloudActive = false;
    this.initClient();
  }

  // Inisialisasi Supabase Client jika URL dan Key tersedia
  initClient() {
    const url = localStorage.getItem(STORAGE_KEYS.SUPABASE_URL) || (window.ENV && window.ENV.NEXT_PUBLIC_SUPABASE_URL);
    const key = localStorage.getItem(STORAGE_KEYS.SUPABASE_KEY) || (window.ENV && window.ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    if (url && key && typeof window.supabase !== 'undefined') {
      try {
        this.client = window.supabase.createClient(url.trim(), key.trim());
        this.isCloudActive = true;
        console.log('✅ Supabase Client initialized successfully.');
      } catch (err) {
        console.warn('⚠️ Supabase init error, falling back to LocalStorage:', err);
        this.client = null;
        this.isCloudActive = false;
      }
    } else {
      this.client = null;
      this.isCloudActive = false;
      console.log('ℹ️ Running in Local Storage Mode.');
    }
  }

  // Cek apakah Supabase sudah terhubung
  isSupabaseConnected() {
    return this.isCloudActive && this.client !== null;
  }

  // Simpan kredensial Supabase
  setCredentials(url, key) {
    if (url) localStorage.setItem(STORAGE_KEYS.SUPABASE_URL, url.trim());
    else localStorage.removeItem(STORAGE_KEYS.SUPABASE_URL);

    if (key) localStorage.setItem(STORAGE_KEYS.SUPABASE_KEY, key.trim());
    else localStorage.removeItem(STORAGE_KEYS.SUPABASE_KEY);

    this.initClient();
  }

  getCredentials() {
    return {
      url: localStorage.getItem(STORAGE_KEYS.SUPABASE_URL) || (window.ENV && window.ENV.NEXT_PUBLIC_SUPABASE_URL) || '',
      key: localStorage.getItem(STORAGE_KEYS.SUPABASE_KEY) || (window.ENV && window.ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY) || ''
    };
  }

  // Tes Koneksi ke Supabase
  async testConnection(url, key) {
    try {
      if (typeof window.supabase === 'undefined') {
        throw new Error('Library Supabase JS SDK belum dimuat.');
      }
      const testClient = window.supabase.createClient(url.trim(), key.trim());
      const { data, error } = await testClient.from('gallon_transactions').select('id').limit(1);
      if (error) {
        throw new Error(error.message || 'Gagal query tabel gallon_transactions');
      }
      return { success: true, message: 'Koneksi ke Supabase berhasil!' };
    } catch (err) {
      return { success: false, message: err.message || 'Gagal terhubung ke Supabase' };
    }
  }

  // --------------------------------------------------------------------------
  // OPERASI CRUD MUTASI STOK GALON
  // --------------------------------------------------------------------------

  // READ: Ambil Semua Mutasi Stok
  async getAllTransactions() {
    if (this.isSupabaseConnected()) {
      try {
        const { data, error } = await this.client
          .from('gallon_transactions')
          .select('*')
          .order('date', { ascending: false })
          .order('time', { ascending: false });

        if (error) throw error;
        
        if (data) {
          localStorage.setItem(STORAGE_KEYS.LOCAL_TRANSACTIONS, JSON.stringify(data));
          return data;
        }
      } catch (err) {
        console.warn('Gagal ambil dari Supabase, memuat dari local cache:', err);
      }
    }

    // Fallback Local Storage
    const local = localStorage.getItem(STORAGE_KEYS.LOCAL_TRANSACTIONS);
    if (!local) {
      localStorage.setItem(STORAGE_KEYS.LOCAL_TRANSACTIONS, JSON.stringify(DEFAULT_TRANSACTIONS));
      return DEFAULT_TRANSACTIONS;
    }
    try {
      return JSON.parse(local);
    } catch {
      return [];
    }
  }

  // CREATE: Tambah Mutasi Stok Baru
  async createTransaction(txData) {
    const enrichedData = {
      ...txData,
      gallon_qty: parseInt(txData.gallon_qty) || 1,
      day_name: txData.day_name || getIndonesianDayName(new Date(txData.date)),
      day_of_week: txData.day_of_week || getDayOfWeekNumber(new Date(txData.date)),
      month: txData.month || (new Date(txData.date).getMonth() + 1),
      year: txData.year || new Date(txData.date).getFullYear()
    };

    if (this.isSupabaseConnected()) {
      try {
        const { data, error } = await this.client
          .from('gallon_transactions')
          .insert([enrichedData])
          .select();

        if (error) throw error;
        if (data && data[0]) {
          await this.syncLocalCacheAdd(data[0]);
          await this.autoUpdateStock(data[0]);
          return { success: true, data: data[0], source: 'supabase' };
        }
      } catch (err) {
        console.warn('Gagal simpan ke Supabase, menyimpan ke local storage:', err);
      }
    }

    // Fallback LocalStorage
    const localList = await this.getAllTransactions();
    const newTx = {
      ...enrichedData,
      id: 'local-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString()
    };
    localList.unshift(newTx);
    localStorage.setItem(STORAGE_KEYS.LOCAL_TRANSACTIONS, JSON.stringify(localList));

    // Update stok galon fisik
    await this.autoUpdateStock(newTx);

    return { success: true, data: newTx, source: 'local' };
  }

  // UPDATE: Edit Mutasi Stok
  async updateTransaction(id, updatedFields) {
    const enrichedData = {
      ...updatedFields,
      gallon_qty: updatedFields.gallon_qty !== undefined ? (parseInt(updatedFields.gallon_qty) || 1) : undefined,
      day_name: updatedFields.day_name || (updatedFields.date ? getIndonesianDayName(new Date(updatedFields.date)) : undefined),
      day_of_week: updatedFields.day_of_week || (updatedFields.date ? getDayOfWeekNumber(new Date(updatedFields.date)) : undefined),
      month: updatedFields.month || (updatedFields.date ? new Date(updatedFields.date).getMonth() + 1 : undefined),
      year: updatedFields.year || (updatedFields.date ? new Date(updatedFields.date).getFullYear() : undefined),
      updated_at: new Date().toISOString()
    };

    if (this.isSupabaseConnected()) {
      try {
        const { data, error } = await this.client
          .from('gallon_transactions')
          .update(enrichedData)
          .select();

        if (error) throw error;
        if (data && data[0]) {
          await this.syncLocalCacheUpdate(data[0]);
          return { success: true, data: data[0], source: 'supabase' };
        }
      } catch (err) {
        console.warn('Gagal update ke Supabase, update di local:', err);
      }
    }

    // Fallback LocalStorage
    const localList = await this.getAllTransactions();
    const index = localList.findIndex(t => t.id === id);
    if (index !== -1) {
      localList[index] = { ...localList[index], ...enrichedData };
      localStorage.setItem(STORAGE_KEYS.LOCAL_TRANSACTIONS, JSON.stringify(localList));
      return { success: true, data: localList[index], source: 'local' };
    }

    return { success: false, message: 'Data tidak ditemukan' };
  }

  // DELETE: Hapus Catatan Mutasi
  async deleteTransaction(id) {
    if (this.isSupabaseConnected()) {
      try {
        const { error } = await this.client
          .from('gallon_transactions')
          .delete()
          .eq('id', id);

        if (error) throw error;
      } catch (err) {
        console.warn('Gagal hapus di Supabase, menghapus dari lokal:', err);
      }
    }

    // Update LocalStorage
    const localList = await this.getAllTransactions();
    const filtered = localList.filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEYS.LOCAL_TRANSACTIONS, JSON.stringify(filtered));
    return { success: true };
  }

  // --------------------------------------------------------------------------
  // OPERASI INVENTARIS & STOK FISIK GALON
  // --------------------------------------------------------------------------

  async getInventory() {
    if (this.isSupabaseConnected()) {
      try {
        const { data, error } = await this.client
          .from('gallon_inventory')
          .select('*')
          .limit(1)
          .single();

        if (!error && data) {
          localStorage.setItem(STORAGE_KEYS.LOCAL_INVENTORY, JSON.stringify(data));
          return data;
        }
      } catch (err) {
        console.warn('Gagal ambil inventaris Supabase:', err);
      }
    }

    const local = localStorage.getItem(STORAGE_KEYS.LOCAL_INVENTORY);
    if (!local) {
      localStorage.setItem(STORAGE_KEYS.LOCAL_INVENTORY, JSON.stringify(DEFAULT_INVENTORY));
      return DEFAULT_INVENTORY;
    }
    return JSON.parse(local);
  }

  async updateInventory(newInventory) {
    if (this.isSupabaseConnected()) {
      try {
        const { data: existing } = await this.client.from('gallon_inventory').select('id').limit(1);
        if (existing && existing.length > 0) {
          await this.client.from('gallon_inventory').update(newInventory).eq('id', existing[0].id);
        } else {
          await this.client.from('gallon_inventory').insert([newInventory]);
        }
      } catch (err) {
        console.warn('Gagal simpan stok ke Supabase:', err);
      }
    }
    localStorage.setItem(STORAGE_KEYS.LOCAL_INVENTORY, JSON.stringify(newInventory));
    return { success: true, data: newInventory };
  }

  // Otomatis menyesuaikan stok fisik galon berdasarkan jenis mutasi
  async autoUpdateStock(tx) {
    const inv = await this.getInventory();
    const qty = parseInt(tx.gallon_qty) || 0;
    if (qty <= 0) return;

    if (tx.type === 'keluar') {
      if (tx.category === 'Isi Ulang Galon') {
        // Penjualan isi ulang: galon isi berkurang, galon kosong bertambah (tukar galon)
        inv.stock_filled = Math.max(0, (inv.stock_filled || 0) - qty);
        inv.stock_empty = (inv.stock_empty || 0) + qty;
      } else if (tx.category === 'Galon Baru + Isi') {
        // Penjualan galon baru beserta bodi: galon isi berkurang
        inv.stock_filled = Math.max(0, (inv.stock_filled || 0) - qty);
      } else if (tx.category === 'Galon Dipinjamkan' || tx.category === 'Galon Titip/Pinjam') {
        // Dipinjamkan ke pelanggan: galon isi berkurang, stok dipinjam bertambah
        inv.stock_filled = Math.max(0, (inv.stock_filled || 0) - qty);
        inv.stock_borrowed = (inv.stock_borrowed || 0) + qty;
      } else if (tx.category === 'Galon Rusak / Pecah') {
        // Rusak: galon kosong berkurang, stok rusak bertambah
        inv.stock_empty = Math.max(0, (inv.stock_empty || 0) - qty);
        inv.stock_broken = (inv.stock_broken || 0) + qty;
      } else {
        inv.stock_filled = Math.max(0, (inv.stock_filled || 0) - qty);
      }
    } else if (tx.type === 'masuk') {
      if (tx.category === 'Pengadaan Galon Baru') {
        // Pasokan galon kosong baru
        inv.stock_empty = (inv.stock_empty || 0) + qty;
      } else if (tx.category === 'Pengembalian Galon Pinjam') {
        // Pelanggan mengembalikan pinjaman: stok dipinjam berkurang, galon kosong bertambah
        inv.stock_borrowed = Math.max(0, (inv.stock_borrowed || 0) - qty);
        inv.stock_empty = (inv.stock_empty || 0) + qty;
      } else if (tx.category === 'Pasokan Galon Isi Pabrik') {
        // Galon isi datang dari pabrik
        inv.stock_filled = (inv.stock_filled || 0) + qty;
      } else {
        inv.stock_empty = (inv.stock_empty || 0) + qty;
      }
    }

    await this.updateInventory(inv);
  }

  // --------------------------------------------------------------------------
  // SINKRONISASI LOKAL KE CLOUD (MIGRATION / SYNC)
  // --------------------------------------------------------------------------
  async syncLocalToCloud() {
    if (!this.isSupabaseConnected()) {
      return { success: false, message: 'Supabase belum terhubung. Konfigurasikan URL dan Anon Key terlebih dahulu.' };
    }

    try {
      const localList = await this.getAllTransactions();
      if (!localList || localList.length === 0) {
        return { success: true, count: 0, message: 'Tidak ada data lokal yang perlu disinkronkan.' };
      }

      // Bersihkan id dummy jika ada
      const uploadPayload = localList.map(t => {
        const item = { ...t };
        if (item.id && (item.id.startsWith('local-') || item.id.startsWith('demo-'))) {
          delete item.id;
        }
        delete item.amount;
        delete item.unit_price;
        delete item.payment_method;
        return item;
      });

      const { data, error } = await this.client
        .from('gallon_transactions')
        .insert(uploadPayload)
        .select();

      if (error) throw error;

      return { success: true, count: data ? data.length : uploadPayload.length, message: 'Sinkronisasi berhasil!' };
    } catch (err) {
      return { success: false, message: err.message || 'Gagal sinkronisasi data ke cloud' };
    }
  }

  // Helper Cache
  async syncLocalCacheAdd(item) {
    const list = await this.getAllTransactions();
    list.unshift(item);
    localStorage.setItem(STORAGE_KEYS.LOCAL_TRANSACTIONS, JSON.stringify(list));
  }

  async syncLocalCacheUpdate(updatedItem) {
    const list = await this.getAllTransactions();
    const idx = list.findIndex(i => i.id === updatedItem.id);
    if (idx !== -1) {
      list[idx] = updatedItem;
      localStorage.setItem(STORAGE_KEYS.LOCAL_TRANSACTIONS, JSON.stringify(list));
    }
  }
}

// Helper Tanggal & Hari Bahasa Indonesia
function getIndonesianDayName(dateObj) {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return days[dateObj.getDay()];
}

function getDayOfWeekNumber(dateObj) {
  const day = dateObj.getDay();
  return day === 0 ? 7 : day; // 1 = Senin, 7 = Minggu
}

function getRelativeDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d;
}

function getRelativeDateString(offsetDays) {
  return getRelativeDate(offsetDays).toISOString().split('T')[0];
}

// Buat instance global
window.dbManager = new DatabaseManager();
