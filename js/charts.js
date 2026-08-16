/**
 * ==============================================================================
 * AQUAFLOW - CHARTS & VISUALIZATION MODULE (CHART.JS - STOCK MANAGEMENT)
 * ==============================================================================
 * Modul ini merender grafik tren mutasi galon (Keluar vs Masuk)
 * dan diagram donat distribusi volume galon per kategori.
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
      danger: '#f43f5e',
      dangerFill: isDark ? 'rgba(244, 63, 94, 0.15)' : 'rgba(244, 63, 94, 0.1)',
      warning: '#f59e0b',
      palette: ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6', '#14b8a6', '#f97316']
    };
  }

  // Render Grafik Tren Mutasi Galon (Galon Keluar vs Galon Masuk)
  renderTrendChart(canvasId, dateAggregatedData) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;

    const ctx = canvas.getContext('2d');
    const colors = this.getThemeColors();

    const labels = dateAggregatedData.map(d => d.label);
    const outData = dateAggregatedData.map(d => d.gallonsOut);
    const inData = dateAggregatedData.map(d => d.gallonsIn);

    if (this.trendChart) {
      this.trendChart.destroy();
    }

    this.trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels.length ? labels : ['Tidak Ada Data'],
        datasets: [
          {
            label: 'Galon Keluar (Terjual/Dipinjam)',
            data: outData.length ? outData : [0],
            borderColor: colors.danger,
            backgroundColor: colors.dangerFill,
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: colors.danger
          },
          {
            label: 'Galon Masuk (Pasokan/Kembali)',
            data: inData.length ? inData : [0],
            borderColor: colors.success,
            backgroundColor: colors.successFill,
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: colors.success
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
                return ` ${context.dataset.label}: ${context.raw} Galon`;
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
                return Number.isInteger(value) ? `${value} Gln` : '';
              }
            }
          }
        }
      }
    });
  }

  // Render Diagram Donat Distribusi Kategori Galon
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
                return ` ${context.label}: ${context.raw} Galon`;
              }
            }
          }
        }
      }
    });
  }

  // Refresh Semua Grafik
  refreshCharts(trendData, categoryData) {
    if (trendData) this.renderTrendChart('trendChartCanvas', trendData);
    if (categoryData) this.renderCategoryChart('categoryChartCanvas', categoryData);
  }
}

window.chartManager = new ChartManager();
