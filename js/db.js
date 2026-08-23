function getIndonesianDayName(dateObj) {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return days[dateObj.getDay()];
}

function getDayOfWeekNumber(dateObj) {
  const day = dateObj.getDay();
  return day === 0 ? 7 : day;
}

function enrichTxData(data) {
  const d = new Date(data.date + 'T00:00:00');
  return {
    ...data,
    category: data.category || 'Umum',
    gallon_qty: parseInt(data.gallon_qty, 10) || 1,
    time: data.time || '00:00',
    day_name: getIndonesianDayName(d),
    day_of_week: getDayOfWeekNumber(d),
    month: d.getMonth() + 1,
    year: d.getFullYear()
  };
}

function sanitizeSearch(term) {
  return (term || '').trim().replace(/[%(),*]/g, ' ').replace(/\s+/g, ' ');
}

const SORT_COLUMNS = {
  tanggal: ['date', 'time'],
  type: ['type'],
  qty: ['gallon_qty'],
  customer_name: ['customer_name']
};

window.DB = {
  client: null,
  connected: false,
  currentUser: null,
  SESSION_KEY: 'galon_session_user',

  init() {
    const url = window.ENV && window.ENV.NEXT_PUBLIC_SUPABASE_URL;
    const key = window.ENV && window.ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key || typeof window.supabase === 'undefined') {
      this.connected = false;
      return false;
    }
    try {
      this.client = window.supabase.createClient(url.trim(), key.trim());
      this.connected = true;
      return true;
    } catch (err) {
      console.error('Supabase init error:', err);
      this.connected = false;
      return false;
    }
  },

  async testConnection() {
    if (!this.client) return { success: false, message: 'Client Supabase belum terinisialisasi.' };
    const { error } = await this.client.from('gallon_users').select('id').limit(1);
    if (error) {
      // Fallback check on transactions if users table is not yet created
      const { error: txErr } = await this.client.from('gallon_transactions').select('id').limit(1);
      if (txErr) return { success: false, message: error.message || txErr.message };
    }
    return { success: true, message: 'Koneksi ke Supabase berhasil.' };
  },

  getCurrentUserId() {
    return this.currentUser?.id || null;
  },

  async hashPin(loginId, pin) {
    const data = new TextEncoder().encode(`${String(loginId).toLowerCase()}:${pin}`);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  },

  cleanLoginId(loginId) {
    return String(loginId || '').trim().toLowerCase();
  },

  validateCredentials(loginId, pin) {
    if (!/^[a-zA-Z0-9._-]{3,20}$/.test(String(loginId || '').trim())) {
      return 'ID harus 3-20 karakter (huruf, angka, titik, atau garis).';
    }
    if (!/^\d{6,8}$/.test(String(pin || ''))) {
      return 'PIN harus terdiri dari 6-8 angka.';
    }
    return null;
  },

  saveSession(user) {
    try {
      this.currentUser = user || null;
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(user));
    } catch (err) {
      console.warn('saveSession error:', err);
    }
  },

  async getSessionUser() {
    try {
      const raw = localStorage.getItem(this.SESSION_KEY);
      const user = raw ? JSON.parse(raw) : null;
      if (user && user.id && user.loginId) {
        this.currentUser = user;
        return user;
      }
      this.currentUser = null;
      return null;
    } catch (err) {
      this.currentUser = null;
      return null;
    }
  },

  async signIn(loginId, pin) {
    if (!this.client) return { success: false, message: 'Database tidak terhubung.' };
    const invalid = this.validateCredentials(loginId, pin);
    if (invalid) return { success: false, message: invalid };

    const id = this.cleanLoginId(loginId);
    const { data, error } = await this.client
      .from('gallon_users')
      .select('*')
      .eq('login_id', id)
      .maybeSingle();

    if (error) {
      const raw = String(error.message || '').toLowerCase();
      let msg = error.message || 'Login gagal.';
      if (raw.includes('does not exist') || raw.includes('schema cache')) {
        msg = 'Tabel pengguna belum dibuat di Supabase. Jalankan skrip supabase_users.sql di Supabase SQL Editor.';
      }
      return { success: false, message: msg };
    }
    if (!data) return { success: false, message: 'ID atau PIN salah.' };

    const pinHash = await this.hashPin(id, pin);
    if (pinHash !== data.pin_hash) return { success: false, message: 'ID atau PIN salah.' };

    const user = {
      id: data.id,
      loginId: data.login_id,
      fullName: data.full_name || id,
      isGuest: false
    };
    this.currentUser = user;

    return {
      success: true,
      user
    };
  },

  async signUp(loginId, pin, fullName) {
    if (!this.client) return { success: false, message: 'Database tidak terhubung.' };
    const invalid = this.validateCredentials(loginId, pin);
    if (invalid) return { success: false, message: invalid };

    const id = this.cleanLoginId(loginId);
    const name = (fullName || '').trim() || id;

    const { data: existing } = await this.client
      .from('gallon_users')
      .select('id')
      .eq('login_id', id)
      .maybeSingle();
    if (existing) return { success: false, message: `ID "${id}" sudah terdaftar. Silakan masuk.` };

    const pinHash = await this.hashPin(id, pin);
    const { data, error } = await this.client
      .from('gallon_users')
      .insert({ login_id: id, full_name: name, pin_hash: pinHash })
      .select()
      .single();

    if (error) {
      const raw = String(error.message || '').toLowerCase();
      let msg = error.message || 'Pendaftaran gagal.';
      if (raw.includes('duplicate') || raw.includes('unique')) {
        msg = `ID "${id}" sudah terdaftar. Silakan masuk.`;
      } else if (raw.includes('does not exist') || raw.includes('schema cache')) {
        msg = 'Tabel pengguna belum dibuat di Supabase. Jalankan skrip supabase_users.sql di Supabase SQL Editor.';
      } else if (raw.includes('row-level security') || raw.includes('permission')) {
        msg = 'Server menolak penyimpanan (kebijakan RLS). Pastikan policy INSERT pada gallon_users sudah aktif.';
      }
      return { success: false, message: msg };
    }

    const user = {
      id: data.id,
      loginId: data.login_id,
      fullName: data.full_name || id,
      isGuest: false
    };
    this.currentUser = user;

    // Inisialisasi data stok inventaris awal untuk akun baru
    try {
      await this.client
        .from('gallon_inventory')
        .insert({
          user_id: user.id,
          stock_filled: 85,
          stock_empty: 30,
          stock_borrowed: 12,
          stock_broken: 0
        });
    } catch (invErr) {
      console.warn('Init inventory for new user notice:', invErr);
    }

    return {
      success: true,
      user
    };
  },

  signOut() {
    this.currentUser = null;
    try {
      localStorage.removeItem(this.SESSION_KEY);
    } catch (err) {
      console.warn('signOut error:', err);
    }
  },

  async fetchTransactions({ page = 1, pageSize = 10, sortBy = 'tanggal', sortDir = 'desc', filters = {} }) {
    if (!this.client) throw new Error('Database tidak terhubung.');
    const userId = this.getCurrentUserId();
    if (!userId) {
      return { data: [], total: 0, page: 1, pageSize };
    }

    let query = this.client
      .from('gallon_transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    if (filters.type === 'masuk' || filters.type === 'keluar') {
      query = query.eq('type', filters.type);
    }

    const term = sanitizeSearch(filters.search);
    if (term) {
      const like = `%${term}%`;
      query = query.or(`customer_name.ilike.${like},notes.ilike.${like}`);
    }

    let start = null;
    let end = null;
    const today = new Date();

    switch (filters.preset) {
      case 'today':
        start = end = toDateInputValue(today);
        break;
      case 'yesterday': {
        const y = new Date(today);
        y.setDate(y.getDate() - 1);
        start = end = toDateInputValue(y);
        break;
      }
      case 'last7days': {
        const s = new Date(today);
        s.setDate(s.getDate() - 6);
        start = toDateInputValue(s);
        end = toDateInputValue(today);
        break;
      }
      case 'thisMonth':
        start = toDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1));
        end = toDateInputValue(new Date(today.getFullYear(), today.getMonth() + 1, 0));
        break;
      case 'lastMonth':
        start = toDateInputValue(new Date(today.getFullYear(), today.getMonth() - 1, 1));
        end = toDateInputValue(new Date(today.getFullYear(), today.getMonth(), 0));
        break;
      case 'thisYear':
        start = `${today.getFullYear()}-01-01`;
        end = `${today.getFullYear()}-12-31`;
        break;
      default:
        break;
    }

    if (filters.preset === 'custom') {
      start = filters.start || null;
      end = filters.end || null;
    }

    if (start) query = query.gte('date', start);
    if (end) query = query.lte('date', end);

    const columns = SORT_COLUMNS[sortBy] || SORT_COLUMNS.tanggal;
    const ascending = sortDir !== 'desc';
    columns.forEach((col) => {
      query = query.order(col, { ascending });
    });

    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeSize = Math.max(1, parseInt(pageSize, 10) || 10);
    const from = (safePage - 1) * safeSize;
    const to = from + safeSize - 1;

    const { data, error, count } = await query.range(from, to);

    if (error) throw new Error(error.message);

    return {
      data: data || [],
      total: count || 0,
      page: safePage,
      pageSize: safeSize
    };
  },

  async getTodayStats() {
    if (!this.client) throw new Error('Database tidak terhubung.');
    const userId = this.getCurrentUserId();
    if (!userId) return { masuk: 0, keluar: 0 };

    const today = toDateInputValue(new Date());
    const { data, error } = await this.client
      .from('gallon_transactions')
      .select('type, gallon_qty')
      .eq('user_id', userId)
      .eq('date', today);

    if (error) throw new Error(error.message);

    const stats = { masuk: 0, keluar: 0 };
    (data || []).forEach((row) => {
      const qty = parseInt(row.gallon_qty, 10) || 0;
      if (row.type === 'masuk') stats.masuk += qty;
      else if (row.type === 'keluar') stats.keluar += qty;
    });
    return stats;
  },

  async getRecentTransactions(limit = 5) {
    if (!this.client) throw new Error('Database tidak terhubung.');
    const userId = this.getCurrentUserId();
    if (!userId) return [];

    const { data, error } = await this.client
      .from('gallon_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('time', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return data || [];
  },

  async createTransaction(txData) {
    if (!this.client) throw new Error('Database tidak terhubung.');
    const userId = this.getCurrentUserId();
    if (!userId) throw new Error('Silakan masuk ke akun Anda untuk menyimpan transaksi.');

    const payload = enrichTxData({ ...txData, user_id: userId });
    const { data, error } = await this.client
      .from('gallon_transactions')
      .insert([payload])
      .select()
      .single();

    if (error) throw new Error(error.message);
    await this.applyStockAdjustment(data);
    return data;
  },

  async updateTransaction(id, txData) {
    if (!this.client) throw new Error('Database tidak terhubung.');
    const userId = this.getCurrentUserId();
    if (!userId) throw new Error('Silakan masuk ke akun Anda.');

    const payload = enrichTxData({ ...txData, updated_at: new Date().toISOString() });
    const { data, error } = await this.client
      .from('gallon_transactions')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async deleteTransaction(id) {
    if (!this.client) throw new Error('Database tidak terhubung.');
    const userId = this.getCurrentUserId();
    if (!userId) throw new Error('Silakan masuk ke akun Anda.');

    const { error } = await this.client
      .from('gallon_transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
    return true;
  },

  async getInventory() {
    if (!this.client) throw new Error('Database tidak terhubung.');
    const userId = this.getCurrentUserId();
    const defaultSeed = { stock_filled: 85, stock_empty: 30, stock_borrowed: 12, stock_broken: 0 };
    if (!userId) return defaultSeed;

    const { data, error } = await this.client
      .from('gallon_inventory')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) return data;

    // Jika belum ada record untuk user ini, buatkan baru
    return await this.updateInventory(defaultSeed);
  },

  async updateInventory(values) {
    if (!this.client) throw new Error('Database tidak terhubung.');
    const userId = this.getCurrentUserId();
    if (!userId) return values;

    const clean = {};
    ['stock_filled', 'stock_empty', 'stock_borrowed', 'stock_broken'].forEach((k) => {
      if (values[k] !== undefined) clean[k] = Math.max(0, parseInt(values[k], 10) || 0);
    });

    const { data: existing } = await this.client
      .from('gallon_inventory')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing && existing.id) {
      const { data, error } = await this.client
        .from('gallon_inventory')
        .update({ ...clean, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }

    const { data, error } = await this.client
      .from('gallon_inventory')
      .insert([{ ...clean, user_id: userId }])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async adjustStock(field, delta) {
    const inv = await this.getInventory();
    const next = Math.max(0, (parseInt(inv[field], 10) || 0) + delta);
    return await this.updateInventory({ [field]: next });
  },

  async applyStockAdjustment(tx) {
    if (!tx) return;
    const inv = await this.getInventory();
    const qty = parseInt(tx.gallon_qty, 10) || 0;
    if (qty <= 0) return;

    const next = {
      stock_filled: parseInt(inv.stock_filled, 10) || 0,
      stock_empty: parseInt(inv.stock_empty, 10) || 0,
      stock_borrowed: parseInt(inv.stock_borrowed, 10) || 0,
      stock_broken: parseInt(inv.stock_broken, 10) || 0
    };

    if (tx.type === 'keluar') {
      next.stock_filled -= qty;
      next.stock_empty += qty;
    } else if (tx.type === 'masuk') {
      next.stock_empty -= qty;
      next.stock_filled += qty;
    }

    Object.keys(next).forEach((k) => {
      next[k] = Math.max(0, next[k]);
    });

    await this.updateInventory(next);
  }
};

function toDateInputValue(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
