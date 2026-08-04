document.addEventListener('DOMContentLoaded', () => {
    // Theme Toggle Logic
    const themeToggleBtn = document.getElementById('theme-toggle');
    const sunIcon = themeToggleBtn.querySelector('.sun-icon');
    const moonIcon = themeToggleBtn.querySelector('.moon-icon');

    function setTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark');
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        } else {
            document.body.classList.remove('dark');
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        }
        localStorage.setItem('theme', theme);
    }

    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);

    themeToggleBtn.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark');
        setTheme(isDark ? 'light' : 'dark');
    });

    // Form inputs and UI elements
    const form = document.getElementById('generate-form');
    const ddlInput = document.getElementById('ddl-input');
    const rowsInput = document.getElementById('rows-input');
    const generateBtn = document.getElementById('generate-btn');
    const btnText = generateBtn.querySelector('.btn-text');
    const spinner = generateBtn.querySelector('.spinner');
    const errorMsg = document.getElementById('error-message');
    
    const tokenCounterElement = document.getElementById('token-counter');
    const tabsContainer = document.getElementById('tabs');
    const resultsContent = document.getElementById('results-content');
    const tokenCountValue = document.getElementById('token-count-value');

    const tabDdl = document.getElementById('tab-ddl');
    const tabNlp = document.getElementById('tab-nlp');
    const ddlSection = document.getElementById('ddl-section');
    const nlpSection = document.getElementById('nlp-section');
    const nlpInput = document.getElementById('nlp-input');
    const generateDdlBtn = document.getElementById('generate-ddl-btn');
    const nlpBtnText = document.getElementById('nlp-btn-text');
    const nlpSpinner = document.getElementById('nlp-spinner');

    let currentData = null;
    let globalTokenCount = 0;

    // Tab Switching Logic
    tabDdl.addEventListener('click', () => {
        tabDdl.classList.add('active');
        tabNlp.classList.remove('active');
        ddlSection.style.display = 'block';
        nlpSection.style.display = 'none';
    });

    tabNlp.addEventListener('click', () => {
        tabNlp.classList.add('active');
        tabDdl.classList.remove('active');
        nlpSection.style.display = 'flex';
        nlpSection.style.flexDirection = 'column';
        ddlSection.style.display = 'none';
    });

    // Generate DDL from NLP Logic
    generateDdlBtn.addEventListener('click', async () => {
        const prompt = nlpInput.value.trim();
        if (!prompt) return;

        generateDdlBtn.disabled = true;
        nlpBtnText.classList.add('hidden');
        nlpSpinner.classList.remove('hidden');
        errorMsg.classList.add('hidden');

        try {
            const isLocalOrDifferentPort = window.location.protocol === 'file:' || window.location.port !== '8000';
            const baseUrl = isLocalOrDifferentPort ? 'http://localhost:8000' : '';
            const response = await fetch(`${baseUrl}/api/generate-ddl`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'An error occurred during DDL generation.');
            }

            ddlInput.value = data.ddl;
            tabDdl.click();

            if (data.tokens_used) {
                globalTokenCount += data.tokens_used;
                if (tokenCountValue) tokenCountValue.textContent = globalTokenCount;
                if (globalTokenCount > 0 && tokenCounterElement) {
                    tokenCounterElement.classList.remove('hidden');
                }
            }
        } catch (error) {
            errorMsg.textContent = error.message;
            errorMsg.classList.remove('hidden');
        } finally {
            generateDdlBtn.disabled = false;
            nlpBtnText.classList.remove('hidden');
            nlpSpinner.classList.add('hidden');
        }
    });

    // Generate Synthetic Data Form Submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const ddl = ddlInput.value.trim();
        const rows = parseInt(rowsInput.value);

        if (!ddl) return;

        generateBtn.disabled = true;
        btnText.classList.add('hidden');
        spinner.classList.remove('hidden');
        errorMsg.classList.add('hidden');
        resultsContent.innerHTML = `
            <div class="output-empty">
                <span class="spinner" style="border-top-color: var(--accent); width: 24px; height: 24px;"></span>
                <p>Generating data (calling LLM)...</p>
            </div>
        `;

        try {
            const isLocalOrDifferentPort = window.location.protocol === 'file:' || window.location.port !== '8000';
            const baseUrl = isLocalOrDifferentPort ? 'http://localhost:8000' : '';
            const response = await fetch(`${baseUrl}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ddl, rows })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'An error occurred during generation.');
            }

            currentData = data;
            
            if (data.tokens_used) {
                globalTokenCount += data.tokens_used;
                if (tokenCountValue) tokenCountValue.textContent = globalTokenCount;
                if (globalTokenCount > 0 && tokenCounterElement) {
                    tokenCounterElement.classList.remove('hidden');
                }
            }
            renderTabs();
            if (tabsContainer.firstChild) {
                tabsContainer.firstChild.click(); // Default to first table
            }

        } catch (error) {
            errorMsg.textContent = error.message;
            errorMsg.classList.remove('hidden');
            resultsContent.innerHTML = `
                <div class="output-empty">
                    <p style="color: #ef4444;">Error generating data.</p>
                </div>
            `;
        } finally {
            generateBtn.disabled = false;
            btnText.classList.remove('hidden');
            spinner.classList.add('hidden');
        }
    });

    function renderTabs() {
        tabsContainer.innerHTML = '';

        // Table tabs first
        currentData.tables.forEach((table, index) => {
            const tab = document.createElement('button');
            tab.className = 'output-tab-btn';
            tab.textContent = table.name;
            tab.onclick = () => {
                setActiveTab(tab);
                renderTableViewer(index);
            };
            tabsContainer.appendChild(tab);
        });

        // Seed All tab last
        const seedTab = document.createElement('button');
        seedTab.className = 'output-tab-btn';
        seedTab.textContent = 'seed_all.sql';
        seedTab.onclick = () => {
            setActiveTab(seedTab);
            renderSeedAll();
        };
        tabsContainer.appendChild(seedTab);
    }

    function setActiveTab(selectedTab) {
        document.querySelectorAll('.output-tab-btn').forEach(t => t.classList.remove('active'));
        selectedTab.classList.add('active');
    }

    function renderSeedAll() {
        resultsContent.innerHTML = `
            <div style="height: 100%; display: flex; flex-direction: column;">
                <div class="format-bar">
                    <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); padding: 0.4rem 0.75rem;">Combined SQL Script</div>
                    <button id="download-sql-btn" class="btn-download">Download SQL</button>
                </div>
                <div class="output-body">
                    <div class="code-viewer">${escapeHtml(currentData.seed_all)}</div>
                </div>
            </div>
        `;

        document.getElementById('download-sql-btn').onclick = () => {
            const blob = new Blob([currentData.seed_all], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `seed_all.sql`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };
    }

    function renderTableViewer(tableIndex) {
        const table = currentData.tables[tableIndex];

        resultsContent.innerHTML = `
            <div style="height: 100%; display: flex; flex-direction: column;">
                <div class="format-bar">
                    <div style="display: flex; gap: 0.25rem;">
                        <button class="format-btn active" id="view-table">Table Data</button>
                        <button class="format-btn" id="view-sql">SQL Insert</button>
                        <button class="format-btn" id="view-csv">CSV Data</button>
                    </div>
                    <button id="download-csv-btn" class="btn-download">Download CSV</button>
                </div>
                <div class="output-body" id="code-content"></div>
            </div>
        `;

        function buildTableHtml(dataRows) {
            if (!dataRows || dataRows.length === 0) return '<div class="output-empty">No data generated</div>';
            const headers = Object.keys(dataRows[0]);
            let html = '<div class="data-table-container"><table class="data-table"><thead><tr>';
            headers.forEach(h => html += `<th>${escapeHtml(h)}</th>`);
            html += '</tr></thead><tbody>';
            dataRows.forEach(row => {
                html += '<tr>';
                headers.forEach(h => html += `<td>${escapeHtml(String(row[h] !== null ? row[h] : ''))}</td>`);
                html += '</tr>';
            });
            html += '</tbody></table></div>';
            return html;
        }

        const codeContent = document.getElementById('code-content');

        document.getElementById('download-csv-btn').onclick = () => {
            const blob = new Blob([table.csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${table.name}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };

        document.getElementById('view-table').onclick = (e) => {
            document.querySelectorAll('.format-btn').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            codeContent.innerHTML = buildTableHtml(table.data);
        };

        document.getElementById('view-sql').onclick = (e) => {
            document.querySelectorAll('.format-btn').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            codeContent.innerHTML = `<div class="code-viewer">${escapeHtml(table.sql)}</div>`;
        };

        document.getElementById('view-csv').onclick = (e) => {
            document.querySelectorAll('.format-btn').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            codeContent.innerHTML = `<div class="code-viewer">${escapeHtml(table.csv)}</div>`;
        };

        // Default
        document.getElementById('view-table').click();
    }

    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
