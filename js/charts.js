/**
 * ==============================================================================
 * AQUAFLOW - CHARTS & VISUALIZATION MODULE (CHART.JS)
 * ==============================================================================
 * Modul ini merender grafik tren keuangan, grafik volume penjualan galon,
 * dan diagram donat distribusi kategori dengan dukungan Dark/Light theme.
 */

class ChartManager {
  constructor() {
    this.trendChart = null;
    this.categoryChart = null;
  }

  // Dapatkan Warna Sesuai Tema Aktif
  getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      textColor: isDark ? '#94a3b8' : '#64748b',
      gridColor: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)',
      primary: '#0ea5e9',
      primaryFill: isDark ? 'rgba(14, 165, 233, 0.15)' : 'rgba(14, 165, 233, 0.1)',
      success: '#10b981',
      successFill: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
      danger: '#ef4444',
      dangerFill: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
      warning: '#f59e0b',
      palette: ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6', '#14b8a6']
    };
  }

  // Render atau Update Grafik Tren Finansial (Line Chart Pemasukan vs Pengeluaran)
  renderTrendChart(canvasId, dateAggregatedData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    const ctx = canvas.getContext('2d');
    const colors = this.getThemeColors();

    const labels = dateAggregatedData.map(d => d.label);
    const incomeData = dateAggregatedData.map(d => d.income);
    const expenseData = dateAggregatedData.map(d => d.expense);
    const gallonData = dateAggregatedData.map(d => d.gallonQty);

    if (this.trendChart) {
      this.trendChart.destroy();
    }

    this.trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length ? labels : ['Tidak Ada Data'],
        datasets: [
          {
            label: 'Pemasukan (Rp)',
            data: incomeData.length ? incomeData : [0],
            borderColor: colors.success,
            backgroundColor: colors.successFill,
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: colors.success
          },
          {
            label: 'Pengeluaran (Rp)',
            data: expenseData.length ? expenseData : [0],
            borderColor: colors.danger,
            backgroundColor: colors.dangerFill,
            borderWidth: 2,
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: colors.danger
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: colors.textColor,
              font: { family: 'Plus Jakarta Sans', size: 12, weight: 600 },
              usePointStyle: true,
              boxWidth: 8
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleFont: { family: 'Plus Jakarta Sans', size: 13, weight: 700 },
            bodyFont: { family: 'Plus Jakarta Sans', size: 12 },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: function(context) {
                return ` ${context.dataset.label}: ${FilterManager.formatRupiah(context.raw)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: colors.gridColor, drawBorder: false },
            ticks: {
              color: colors.textColor,
              font: { family: 'Plus Jakarta Sans', size: 11 }
            }
          },
          y: {
            beginAtZero: true,
            grid: { color: colors.gridColor, drawBorder: false },
            ticks: {
              color: colors.textColor,
              font: { family: 'Plus Jakarta Sans', size: 11 },
              callback: function(value) {
                if (value >= 1000000) return (value / 1000000).toFixed(1) + ' Jt';
                if (value >= 1000) return (value / 1000).toFixed(0) + ' Rb';
                return value;
              }
            }
          }
        }
      }
    });
  }

  // Render atau Update Diagram Donat Distribusi Kategori
  renderCategoryChart(canvasId, categoryData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    const ctx = canvas.getContext('2d');
    const colors = this.getThemeColors();

    const hasData = categoryData.labels && categoryData.labels.length > 0;
    const labels = hasData ? categoryData.labels : ['Belum Ada Data'];
    const values = hasData ? categoryData.values : [1];
    const bgColors = hasData ? colors.palette.slice(0, labels.length) : ['#94a3b8'];

    if (this.categoryChart) {
      this.categoryChart.destroy();
    }

    this.categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [
          {
            data: values,
            backgroundColor: bgColors,
            borderWidth: 2,
            borderColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#0f172a' : '#ffffff'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: colors.textColor,
              font: { family: 'Plus Jakarta Sans', size: 11, weight: 600 },
              usePointStyle: true,
              boxWidth: 8,
              padding: 12
            }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: 700 },
            bodyFont: { family: 'Plus Jakarta Sans', size: 12 },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: function(context) {
                if (!hasData) return ' Tidak ada data';
                return ` ${context.label}: ${FilterManager.formatRupiah(context.raw)}`;
              }
            }
          }
        }
      }
    });
  }

  // Refresh Semua Grafik (Misal saat ganti mode tema Dark/Light)
  refreshCharts(trendData, categoryData) {
    if (trendData) this.renderTrendChart('trendChartCanvas', trendData);
    if (categoryData) this.renderCategoryChart('categoryChartCanvas', categoryData);
  }
}

window.chartManager = new ChartManager();
