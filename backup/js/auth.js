/**
 * ==============================================================================
 * AQUAFLOW - AUTHENTICATION MODULE (SUPABASE AUTH & OFFLINE DEMO)
 * ==============================================================================
 * Mengelola login, registrasi, logout, persistensi sesi pengguna, serta
 * dukungan mode tamu/offline untuk depot air galon.
 */

const AUTH_STORAGE_KEYS = {
  LOCAL_USER: 'aquaflow_auth_user'
};

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.isInitialized = false;
  }

  // Inisialisasi status autentikasi saat aplikasi dimuat
  async init() {
    if (this.isInitialized) return this.currentUser;

    const dbManager = window.dbManager;
    
    // 1. Cek sesi Supabase jika cloud aktif
    if (dbManager && dbManager.isSupabaseConnected()) {
      try {
        const { data: { session }, error } = await dbManager.client.auth.getSession();
        if (session && session.user) {
          this.currentUser = {
            id: session.user.id,
            email: session.user.email,
            fullName: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
            isDemo: false
          };
          this.setupSupabaseListener();
          this.isInitialized = true;
          return this.currentUser;
        }
      } catch (err) {
        console.warn('Gagal memulihkan sesi Supabase:', err);
      }
    }

    // 2. Cek sesi lokal (Demo / Offline mode)
    const localUserJson = localStorage.getItem(AUTH_STORAGE_KEYS.LOCAL_USER);
    if (localUserJson) {
      try {
        this.currentUser = JSON.parse(localUserJson);
      } catch {
        this.currentUser = null;
      }
    }

    this.isInitialized = true;
    return this.currentUser;
  }

  // Listener untuk perubahan status sesi Supabase
  setupSupabaseListener() {
    const dbManager = window.dbManager;
    if (!dbManager || !dbManager.client) return;

    dbManager.client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        this.currentUser = {
          id: session.user.id,
          email: session.user.email,
          fullName: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
          isDemo: false
        };
        localStorage.removeItem(AUTH_STORAGE_KEYS.LOCAL_USER);
        if (typeof window.onAuthStateChanged === 'function') {
          window.onAuthStateChanged(this.currentUser);
        }
      } else if (event === 'SIGNED_OUT') {
        this.currentUser = null;
        localStorage.removeItem(AUTH_STORAGE_KEYS.LOCAL_USER);
        if (typeof window.onAuthStateChanged === 'function') {
          window.onAuthStateChanged(null);
        }
      }
    });
  }

  // Cek apakah pengguna saat ini sudah login
  isLoggedIn() {
    return this.currentUser !== null;
  }

  // Dapatkan data pengguna saat ini
  getCurrentUser() {
    return this.currentUser;
  }

  // LOGIN DENGAN EMAIL & PASSWORD (SUPABASE)
  async signIn(email, password) {
    const dbManager = window.dbManager;

    if (!dbManager || !dbManager.isSupabaseConnected()) {
      // Jika Supabase belum dikonfigurasi, gunakan fallback login offline/lokal
      return this.signInDemo('Admin Depot', email);
    }

    try {
      const { data, error } = await dbManager.client.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (error) {
        throw error;
      }

      if (data && data.user) {
        this.currentUser = {
          id: data.user.id,
          email: data.user.email,
          fullName: data.user.user_metadata?.full_name || data.user.email.split('@')[0],
          isDemo: false
        };
        localStorage.removeItem(AUTH_STORAGE_KEYS.LOCAL_USER);
        return { success: true, user: this.currentUser, message: 'Login berhasil!' };
      }

      throw new Error('Gagal mendapatkan informasi sesi pengguna.');
    } catch (err) {
      let friendlyMsg = err.message || 'Login gagal.';
      if (friendlyMsg.includes('Invalid login credentials')) {
        friendlyMsg = 'Email atau password salah. Silakan periksa kembali.';
      } else if (friendlyMsg.includes('Email not confirmed')) {
        friendlyMsg = 'Email belum dikonfirmasi. Periksa kotak masuk / spam email Anda atau nonaktifkan konfirmasi email di Dashboard Supabase.';
      }
      return { success: false, message: friendlyMsg };
    }
  }

  // DAFTAR AKUN BARU (SUPABASE)
  async signUp(email, password, fullName) {
    const dbManager = window.dbManager;

    if (!dbManager || !dbManager.isSupabaseConnected()) {
      return {
        success: false,
        message: 'Supabase belum terhubung. Konfigurasikan Project URL & Anon Key di Pengaturan DB terlebih dahulu.'
      };
    }

    try {
      const { data, error } = await dbManager.client.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: fullName.trim()
          }
        }
      });

      if (error) {
        throw error;
      }

      // Jika auto-confirm aktif di Supabase, user langsung login
      if (data && data.session && data.user) {
        this.currentUser = {
          id: data.user.id,
          email: data.user.email,
          fullName: fullName.trim() || data.user.email.split('@')[0],
          isDemo: false
        };
        return { 
          success: true, 
          user: this.currentUser, 
          message: 'Pendaftaran berhasil dan Anda telah masuk!' 
        };
      }

      return {
        success: true,
        user: data.user,
        message: 'Pendaftaran berhasil! Silakan periksa email untuk konfirmasi (atau langsung login jika konfirmasi email dinonaktifkan).'
      };
    } catch (err) {
      let friendlyMsg = err.message || 'Pendaftaran gagal.';
      if (friendlyMsg.includes('User already registered')) {
        friendlyMsg = 'Email ini sudah terdaftar. Silakan gunakan menu Masuk / Login.';
      } else if (friendlyMsg.includes('Password should be at least')) {
        friendlyMsg = 'Password minimal harus 6 karakter.';
      }
      return { success: false, message: friendlyMsg };
    }
  }

  // LOGIN SEBAGAI TAMU / MODE DEMO OFFLINE
  signInDemo(name = 'Admin Depot', email = 'admin@depot.local') {
    this.currentUser = {
      id: 'demo-user-' + Date.now(),
      email: email,
      fullName: name,
      isDemo: true
    };
    localStorage.setItem(AUTH_STORAGE_KEYS.LOCAL_USER, JSON.stringify(this.currentUser));
    return { success: true, user: this.currentUser, message: 'Masuk dalam mode Tamu / Offline.' };
  }

  // LOGOUT PENGGUNA
  async signOut() {
    const dbManager = window.dbManager;

    if (dbManager && dbManager.isSupabaseConnected() && this.currentUser && !this.currentUser.isDemo) {
      try {
        await dbManager.client.auth.signOut();
      } catch (err) {
        console.warn('Supabase sign out error:', err);
      }
    }

    this.currentUser = null;
    localStorage.removeItem(AUTH_STORAGE_KEYS.LOCAL_USER);
    return { success: true, message: 'Berhasil keluar.' };
  }
}

// Instance global AuthManager
window.authManager = new AuthManager();
