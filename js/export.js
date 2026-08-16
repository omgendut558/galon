/**
 * ==============================================================================
 * AQUAFLOW - EXPORT & REPORTING MODULE (EXCEL, CSV, CETAK PDF, BACKUP JSON)
 * ==============================================================================
 */

const ExportManager = {
  // Ekspor Data ke File Excel (.xlsx) menggunakan SheetJS
  exportToExcel(transactions, filterDescription = 'Semua Data') {
    if (!transactions || transactions.length === 0) {
      alert('Tidak ada data untuk diekspor.');
      return;
    }

    if (typeof XLSX === 'undefined') {
      alert('Library SheetJS belum dimuat.');
      return;
    }

    // Siapkan Baris Data
    const formattedData = transactions.map((t, index) => ({
      'No': index + 1,
      'Tanggal': t.date,
      'Jam': t.time || '-',
      'Hari': t.day_name,
      'Bulan': FilterManager.getMonthName(t.month) || t.month,
      'Tahun': t.year,
      'Tipe Transaksi': t.type === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran',
      'Kategori': t.category,
      'Qty Galon': t.gallon_qty || 0,
      'Harga Satuan (Rp)': t.unit_price || 0,
      'Total Nominal (Rp)': t.amount || 0,
      'Metode Pembayaran': t.payment_method || 'Tunai',
      'Nama Pelanggan/Vendor': t.customer_name || '-',
      'Keterangan / Catatan': t.notes || '-'
    }));

    // Kalkulasi Total untuk Row Summary
    const summary = FilterManager.calculateSummary(transactions);
    formattedData.push({});
    formattedData.push({
      'No': 'RINGKASAN',
      'Tanggal': `Filter: ${filterDescription}`,
      'Tipe Transaksi': `Total Transaksi: ${summary.totalTransactions}`,
      'Qty Galon': `Total Galon Terjual: ${summary.totalGallonsSold}`,
      'Total Nominal (Rp)': `Pemasukan: Rp ${summary.totalIncome.toLocaleString('id-ID')} | Pengeluaran: Rp ${summary.totalExpense.toLocaleString('id-ID')} | Laba Bersih: Rp ${summary.netProfit.toLocaleString('id-ID')}`
    });

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Keuangan Galon');

    const fileName = `Laporan_Keuangan_Galon_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  },

  // Ekspor Data ke File CSV
  exportToCSV(transactions) {
    if (!transactions || transactions.length === 0) {
      alert('Tidak ada data untuk diekspor.');
      return;
    }

    const headers = ['No', 'Tanggal', 'Jam', 'Hari', 'Bulan', 'Tahun', 'Tipe', 'Kategori', 'Qty_Galon', 'Harga_Satuan', 'Total_Nominal', 'Metode_Pembayaran', 'Pelanggan', 'Catatan'];
    
    const csvRows = [];
    csvRows.push(headers.join(','));

    transactions.forEach((t, idx) => {
      const row = [
        idx + 1,
        `"${t.date}"`,
        `"${t.time || ''}"`,
        `"${t.day_name}"`,
        `"${t.month}"`,
        `"${t.year}"`,
        `"${t.type}"`,
        `"${t.category}"`,
        t.gallon_qty || 0,
        t.unit_price || 0,
        t.amount || 0,
        `"${t.payment_method || 'Tunai'}"`,
        `"${(t.customer_name || '').replace(/"/g, '""')}"`,
        `"${(t.notes || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvString = '\uFEFF' + csvRows.join('\n'); // Add UTF-8 BOM
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Laporan_Galon_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // Cetak Laporan Keuangan (Print Friendly Layout)
  printReport(filterDescription = '') {
    window.print();
  },

  // Backup Data ke JSON
  backupJSON(transactions, inventory) {
    const backupData = {
      app: 'AquaFlow Galon App',
      version: '1.0',
      exported_at: new Date().toISOString(),
      inventory: inventory,
      transactions: transactions
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `AquaFlow_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  },

  // Restore Data dari JSON
  restoreJSON(file, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const parsed = JSON.parse(e.target.result);
        if (parsed.transactions && Array.isArray(parsed.transactions)) {
          callback(null, parsed);
        } else {
          callback(new Error('Format file JSON tidak valid.'));
        }
      } catch (err) {
        callback(err);
      }
    };
    reader.readAsText(file);
  }
};

window.ExportManager = ExportManager;
