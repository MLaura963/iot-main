// app.js (versão corrigida)
const API_URL = 'http://localhost:5000/api/data';

// Detectar página atual
const pathname = window.location.pathname;
const pageFile = pathname.split('/').pop().toLowerCase();
const isLoginPage = pageFile === '' || pageFile === 'index.html' || pageFile === 'login.html';
const isDashboardPage = pageFile === 'dashboard.html' || pageFile === 'dashboard';

// Elementos do DOM (podem não existir em todas as páginas)
const loginContainer = document.getElementById('login-container');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');

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

// Credenciais hardcoded (exemplo)
const VALID_USERNAME = 'admin';
const VALID_PASSWORD = 'password';

// Datas padrão
function setDefaultDates() {
    if (!startDateInput || !endDateInput) return;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    endDateInput.value = end.toISOString().slice(0, 16);
    startDateInput.value = start.toISOString().slice(0, 16);
}

function checkLogin() {
    return localStorage.getItem('loggedIn') === 'true';
}

// Mostra tela apropriada SEM criar redirect-loop
function showScreen() {
    if (checkLogin()) {
        // se está logado e não está no dashboard, vai para dashboard
        if (!isDashboardPage) {
            console.log('Usuário logado -> redirecionando para dashboard');
            window.location.href = 'dashboard.html';
        } else {
            // já está no dashboard, não redireciona (evita reload infinito)
            console.log('Usuário logado e já no dashboard. Inicializando dashboard.');
        }
    } else {
        // não está logado
        if (isDashboardPage) {
            // se está tentando acessar dashboard sem login, manda para login
            console.log('Usuário NÃO logado -> redirecionando para login');
            window.location.href = 'index.html';
        } else {
            // está na tela de login: garantir que o container apareça (se existir)
            if (loginContainer) loginContainer.style.display = 'block';
        }
    }
}

// --- fetchData e funções auxiliares (sem alteração lógica, só guardas de null) ---
async function fetchData() {
    if (loadingChart) loadingChart.classList.remove('hidden');
    if (loadingTable) loadingTable.classList.remove('hidden');
    if (chartCanvas) chartCanvas.classList.add('hidden');
    if (errorChart) errorChart.classList.add('hidden');
    if (statsContainer) statsContainer.classList.add('hidden');

    try {
        const limit = limitSelect ? limitSelect.value : 100;
        const startDate = startDateInput ? startDateInput.value : '';
        const endDate = endDateInput ? endDateInput.value : '';

        let url = `${API_URL}?limit=${limit}`;
        if (startDate) url += `&start_date=${startDate}`;
        if (endDate) url += `&end_date=${endDate}`;

        console.log('Buscando dados com URL:', url);

        const response = await fetch(url);
        if (!response.ok) throw new Error('Erro na resposta da rede: ' + response.statusText);
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        const feeds = data.feeds || [];

        if (feeds.length === 0) {
            if (loadingChart) loadingChart.textContent = 'Nenhum dado encontrado para os filtros aplicados.';
            if (loadingTable) loadingTable.classList.add('hidden');
            if (statsContainer) statsContainer.classList.add('hidden');
            return { labels: [], humidityData: [], temperatureData: [], feeds: [] };
        }

        const filteredFeeds = feeds.filter(feed => feed.field1 !== null && feed.field2 !== null);
        const labels = filteredFeeds.map(feed => new Date(feed.created_at).toLocaleString('pt-BR'));
        const humidityData = filteredFeeds.map(feed => parseFloat(feed.field1));
        const temperatureData = filteredFeeds.map(feed => parseFloat(feed.field2));

        currentData = filteredFeeds;
        updateTable();
        updateStats(filteredFeeds);

        if (loadingChart) loadingChart.classList.add('hidden');
        if (chartCanvas) chartCanvas.classList.remove('hidden');
        if (loadingTable) loadingTable.classList.add('hidden');
        if (statsContainer) statsContainer.classList.remove('hidden');

        return { labels, humidityData, temperatureData, feeds: filteredFeeds };
    } catch (error) {
        console.error('Erro ao buscar dados:', error);
        if (loadingChart) loadingChart.textContent = '';
        if (errorChart) {
            errorChart.textContent = `Erro ao carregar os dados: ${error.message}`;
            errorChart.classList.remove('hidden');
        }
        if (loadingTable) loadingTable.classList.add('hidden');
        if (statsContainer) statsContainer.classList.add('hidden');
        return { labels: [], humidityData: [], temperatureData: [], feeds: [] };
    }
}

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

// Export e CSV (mantidos)
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

// Event listeners (com safe checks)
refreshBtn?.addEventListener('click', async () => { currentPage = 1; const data = await fetchData(); renderChart(data); });
applyFiltersBtn?.addEventListener('click', async () => { currentPage = 1; const data = await fetchData(); renderChart(data); });
resetFiltersBtn?.addEventListener('click', () => { if (limitSelect) limitSelect.value = '100'; setDefaultDates(); currentPage = 1; fetchData().then(renderChart); });
prevPageBtn?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; updateTable(); } });
nextPageBtn?.addEventListener('click', () => { const totalPages = Math.ceil(currentData.length / itemsPerPage); if (currentPage < totalPages) { currentPage++; updateTable(); } });
exportChartBtn?.addEventListener('click', exportChart);
exportCsvBtn?.addEventListener('click', exportToCSV);

loginForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    if (username === VALID_USERNAME && password === VALID_PASSWORD) {
        localStorage.setItem('loggedIn', 'true');
        window.location.href = 'dashboard.html';
    } else {
        if (loginError) loginError.classList.remove('hidden');
    }
});

logoutBtn?.addEventListener('click', () => {
    localStorage.removeItem('loggedIn');
    window.location.href = 'index.html';
});

async function initDashboard() {
    setDefaultDates();
    const data = await fetchData();
    renderChart(data);
}

function init() {
    showScreen();
    // Inicializa dashboard somente se estivermos no dashboard E estiver logado
    if (isDashboardPage && checkLogin()) {
        initDashboard();
    }
}

// DOMContentLoaded é mais apropriado para scripts que mexem com DOM
document.addEventListener('DOMContentLoaded', init);
