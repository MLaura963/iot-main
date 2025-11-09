const API_URL = 'http://localhost:5000/api/data';
const AUTH_API_URL = 'http://localhost:5000/api/auth';

// Detectar página atual
const pathname = window.location.pathname;
const pageFile = pathname.split('/').pop().toLowerCase();
const isLoginPage = pageFile === '' || pageFile === 'index.html' || pageFile === 'login.html';
const isDashboardPage = pageFile === 'dashboard.html' || pageFile === 'dashboard';

// Elementos do DOM
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const alertModal = document.getElementById('alert-modal');
const alertMessage = document.getElementById('alert-message');
const closeAlertBtn = document.getElementById('close-alert');
const acknowledgeBtn = document.getElementById('acknowledge-alert');

let myChart;
const loadingChart = document.getElementById('loading-chart');
const errorChart = document.getElementById('error-chart');
const chartCanvas = document.getElementById('myChart');
const refreshBtn = document.getElementById('refresh-btn');
const tableBody = document.querySelector('#data-table tbody');
const loadingTable = document.getElementById('loading-table');
const statsContainer = document.getElementById('stats-container');
const limitSelect = document.getElementById('limit-select');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const applyFiltersBtn = document.getElementById('apply-filters');
const resetFiltersBtn = document.getElementById('reset-filters');
const totalRecordsEl = document.getElementById('total-records');
const avgHumidityEl = document.getElementById('avg-humidity');
const avgTemperatureEl = document.getElementById('avg-temperature');
const periodRangeEl = document.getElementById('period-range');
const paginationEl = document.getElementById('pagination');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const pageInfoEl = document.getElementById('page-info');
const showingFromEl = document.getElementById('showing-from');
const showingToEl = document.getElementById('showing-to');
const totalItemsEl = document.getElementById('total-items');
const exportChartBtn = document.getElementById('export-chart');
const exportCsvBtn = document.getElementById('export-csv');

// Estado
let currentData = [];
let currentPage = 1;
const itemsPerPage = 20;

// Configuração de alertas
const ALERT_CONFIG = {
    humidity: { min: 60, max: 70 },
    temperature: { min: 18, max: 25 },
};

let lastAlertTime = 0;
const ALERT_COOLDOWN = 30000; // 30 segundos

// === FUNÇÕES DE ALERTA ===
function closeAlert() {
    alertModal?.classList.remove('show');
    setTimeout(() => alertModal?.classList.add('hidden'), 300);
}

function playAlertSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
    } catch (e) { /* Silenciar erro */ }
}

async function sendEmailAlert(message) {
    try {
        await fetch(`${AUTH_API_URL}/send-alert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message.replace(/<[^>]*>/g, '') })
        });
    } catch (error) {
        console.error('Falha ao enviar e-mail:', error);
    }
}

function showAlert(message) {
    const now = Date.now();
    if (now - lastAlertTime < ALERT_COOLDOWN) return;

    if (alertMessage) alertMessage.innerHTML = message;
    if (alertModal) {
        alertModal.classList.remove('hidden');
        setTimeout(() => alertModal.classList.add('show'), 10);
    }

    playAlertSound();
    lastAlertTime = now;
    sendEmailAlert(message);
}

function analyzeDataForAlerts(feeds) {
    if (!feeds?.length) return;

    const alerts = [];
    let lastBadHumidity = null, lastLowTemp = null, lastHighTemp = null;
    const reversed = [...feeds].reverse();

    for (const feed of reversed) {
        const h = parseFloat(feed.field1);
        const t = parseFloat(feed.field2);
        const time = new Date(feed.created_at).toLocaleString('pt-BR');

        if (!isNaN(h) && !lastBadHumidity && (h < ALERT_CONFIG.humidity.min || h > ALERT_CONFIG.humidity.max)) {
            lastBadHumidity = `Umidade: <strong>${h.toFixed(2)}%</strong> às ${time}`;
        }
        if (!isNaN(t) && !lastLowTemp && t < ALERT_CONFIG.temperature.min) {
            lastLowTemp = `Temp. baixa: <strong>${t.toFixed(2)}°C</strong> às ${time}`;
        }
        if (!isNaN(t) && !lastHighTemp && t > ALERT_CONFIG.temperature.max) {
            lastHighTemp = `Temp. alta: <strong>${t.toFixed(2)}°C</strong> às ${time}`;
        }
        if (lastBadHumidity && lastLowTemp && lastHighTemp) break;
    }

    [lastBadHumidity, lastLowTemp, lastHighTemp].forEach(a => a && alerts.push(a));
    if (alerts.length) {
        showAlert(`<b>Alertas Críticos:</b><br>${alerts.map(a => `• ${a}`).join('<br>')}`);
    }
}

// === AUTENTICAÇÃO ===
function checkLogin() {
    return localStorage.getItem('authToken') !== null;
}

function showScreen() {
    if (checkLogin()) {
        if (!isDashboardPage) window.location.href = 'dashboard.html';
    } else {
        if (isDashboardPage) window.location.href = 'index.html';
    }
}

// === LOGIN ===
loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
        const res = await fetch(`${AUTH_API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Login falhou');

        localStorage.setItem('authToken', data.token);
        window.location.href = 'dashboard.html';
    } catch (err) {
        loginError.textContent = err.message;
        loginError.classList.remove('hidden');
    }
});

// === LOGOUT ===
logoutBtn?.addEventListener('click', () => {
    localStorage.removeItem('authToken');
    window.location.href = 'index.html';
});

// === FETCH DATA COM TOKEN ===
async function fetchData() {
    if (loadingChart) loadingChart.classList.remove('hidden');
    if (loadingTable) loadingTable.classList.remove('hidden');
    if (chartCanvas) chartCanvas.classList.add('hidden');
    if (errorChart) errorChart.classList.add('hidden');
    if (statsContainer) statsContainer.classList.add('hidden');

    const token = localStorage.getItem('authToken');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    try {
        const limit = limitSelect?.value || 100;
        let url = `${API_URL}?limit=${limit}`;
        if (startDateInput?.value) url += `&start_date=${startDateInput.value}`;
        if (endDateInput?.value) url += `&end_date=${endDateInput.value}`;

        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error('Erro de autenticação ou servidor');

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        const feeds = data.feeds || [];
        const filtered = feeds.filter(f => f.field1 != null && f.field2 != null);
        const labels = filtered.map(f => new Date(f.created_at).toLocaleString('pt-BR'));
        const humidityData = filtered.map(f => parseFloat(f.field1));
        const temperatureData = filtered.map(f => parseFloat(f.field2));

        currentData = filtered;
        updateTable();
        updateStats(filtered);
        analyzeDataForAlerts(filtered);

        return { labels, humidityData, temperatureData, feeds: filtered };
    } catch (error) {
        console.error(error);
        if (errorChart) {
            errorChart.textContent = `Erro: ${error.message}`;
            errorChart.classList.remove('hidden');
        }
        return { labels: [], humidityData: [], temperatureData: [], feeds: [] };
    } finally {
        if (loadingChart) loadingChart.classList.add('hidden');
        if (loadingTable) loadingTable.classList.add('hidden');
        if (chartCanvas) chartCanvas.classList.remove('hidden');
        if (statsContainer) statsContainer.classList.remove('hidden');
    }
}

// === RESTO DAS FUNÇÕES ===
function updateStats(feeds) {
    if (!totalRecordsEl || !avgHumidityEl || !avgTemperatureEl || !periodRangeEl) return;
    if (feeds.length === 0) {
        totalRecordsEl.textContent = '0';
        avgHumidityEl.textContent = '0%';
        avgTemperatureEl.textContent = '0°C';
        periodRangeEl.textContent = '-';
        return;
    }
    const humidities = feeds.map(f => parseFloat(f.field1)).filter(v => !isNaN(v));
    const temperatures = feeds.map(f => parseFloat(f.field2)).filter(v => !isNaN(v));
    const avgHumidity = humidities.length ? (humidities.reduce((a,b)=>a+b)/humidities.length).toFixed(2) : 0;
    const avgTemperature = temperatures.length ? (temperatures.reduce((a,b)=>a+b)/temperatures.length).toFixed(2) : 0;
    const dates = feeds.map(f => new Date(f.created_at));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));

    totalRecordsEl.textContent = feeds.length;
    avgHumidityEl.textContent = `${avgHumidity}%`;
    avgTemperatureEl.textContent = `${avgTemperature}°C`;
    periodRangeEl.textContent = `${minDate.toLocaleDateString('pt-BR')} - ${maxDate.toLocaleDateString('pt-BR')}`;
}

function updateTable() {
    if (!tableBody) return;
    tableBody.innerHTML = '';
    if (!currentData.length) {
        const noDataRow = document.createElement('tr');
        noDataRow.innerHTML = `<td colspan="3" class="px-6 py-4 whitespace-nowrap text-center text-sm italic text-gray-500">Nenhum dado encontrado.</td>`;
        tableBody.appendChild(noDataRow);
        if (paginationEl) paginationEl.classList.add('hidden');
        return;
    }
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, currentData.length);
    const pageData = currentData.slice(startIndex, endIndex);

    pageData.forEach(feed => {
        const row = document.createElement('tr');
        const humidity = feed.field1 !== null ? `${parseFloat(feed.field1).toFixed(2)}%` : 'N/A';
        const temperature = feed.field2 !== null ? `${parseFloat(feed.field2).toFixed(2)}°C` : 'N/A';
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(feed.created_at).toLocaleString('pt-BR')}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${humidity}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${temperature}</td>
        `;
        tableBody.appendChild(row);
    });

    updatePagination();
}

function updatePagination() {
    if (!showingFromEl || !showingToEl || !totalItemsEl || !pageInfoEl || !prevPageBtn || !nextPageBtn || !paginationEl) return;
    const totalPages = Math.ceil(currentData.length / itemsPerPage);
    showingFromEl.textContent = ((currentPage - 1) * itemsPerPage) + 1;
    showingToEl.textContent = Math.min(currentPage * itemsPerPage, currentData.length);
    totalItemsEl.textContent = currentData.length;
    pageInfoEl.textContent = `Página ${currentPage} de ${totalPages}`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
    paginationEl.classList.remove('hidden');
}

function renderChart(data) {
    if (!chartCanvas) return;
    const ctx = chartCanvas.getContext('2d');
    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: 'Umidade (%)',
                    data: data.humidityData,
                    borderColor: '#5F8C1B',
                    backgroundColor: 'rgba(95, 140, 27, 0.4)',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'y'
                },
                {
                    label: 'Temperatura (°C)',
                    data: data.temperatureData,
                    borderColor: '#F2CF63',
                    backgroundColor: 'rgba(242, 207, 99, 0.4)',
                    borderWidth: 2,
                    tension: 0.3,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { display: true, title: { display: true, text: 'Tempo' } },
                y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Umidade (%)' } },
                y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Temperatura (°C)' }, grid: { drawOnChartArea: false } }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(2);
                                if (context.dataset.label.includes('Umidade')) label += '%';
                                else label += '°C';
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

function exportChart() {
    if (!chartCanvas || !myChart) return;
    const link = document.createElement('a');
    link.download = `grafico-sensor-${new Date().toISOString().split('T')[0]}.png`;
    link.href = chartCanvas.toDataURL();
    link.click();
}

function exportToCSV() {
    if (!currentData.length) return;
    const headers = ['Data/Hora', 'Umidade (%)', 'Temperatura (°C)'];
    const csvData = currentData.map(feed => [
        new Date(feed.created_at).toLocaleString('pt-BR'),
        feed.field1 !== null ? parseFloat(feed.field1).toFixed(2) : 'N/A',
        feed.field2 !== null ? parseFloat(feed.field2).toFixed(2) : 'N/A'
    ]);
    const csvContent = [headers.join(','), ...csvData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `dados-sensor-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Event listeners
refreshBtn?.addEventListener('click', async () => { currentPage = 1; const data = await fetchData(); renderChart(data); });
applyFiltersBtn?.addEventListener('click', async () => { currentPage = 1; const data = await fetchData(); renderChart(data); });
resetFiltersBtn?.addEventListener('click', () => { if (limitSelect) limitSelect.value = '100'; setDefaultDates(); currentPage = 1; fetchData().then(renderChart); });
prevPageBtn?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; updateTable(); } });
nextPageBtn?.addEventListener('click', () => { const totalPages = Math.ceil(currentData.length / itemsPerPage); if (currentPage < totalPages) { currentPage++; updateTable(); } });
exportChartBtn?.addEventListener('click', exportChart);
exportCsvBtn?.addEventListener('click', exportToCSV);

closeAlertBtn?.addEventListener('click', closeAlert);
acknowledgeBtn?.addEventListener('click', closeAlert);

function setDefaultDates() {
    if (!startDateInput || !endDateInput) return;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    endDateInput.value = end.toISOString().slice(0, 16);
    startDateInput.value = start.toISOString().slice(0, 16);
}

async function initDashboard() {
    setDefaultDates();
    const data = await fetchData();
    renderChart(data);
}

function init() {
    showScreen();
    if (isDashboardPage && checkLogin()) {
        initDashboard();
    }
}

document.addEventListener('DOMContentLoaded', init);