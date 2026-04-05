// ========================================
// API 中转服务 - 管理面板 JavaScript
// ========================================

// 全局变量
let sessionToken = '';
let currentPage = 'dashboard';
let logsOffset = 0;
let logsLimit = 50;
let allKeys = [];
let allModels = {};

// ========================================
// API 请求辅助函数
// ========================================
async function apiRequest(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-Session-Token': sessionToken
        }
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`/admin/api/${endpoint}`, options);

        if (response.status === 401) {
            showToast('未授权，请重新登录', 'error');
            logout();
            return null;
        }

        if (response.status === 403) {
            showToast('会话无效，请重新登录', 'error');
            logout();
            return null;
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: '请求失败' }));
            showToast(error.detail || `HTTP ${response.status}`, 'error');
            return null;
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('API Error:', error);
        showToast('网络错误', 'error');
        return null;
    }
}

// ========================================
// 提示消息
// ========================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ========================================
// 登录/登出
// ========================================
async function login(password) {
    try {
        const response = await fetch('/admin/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || '登录失败');
        }

        const data = await response.json();
        sessionToken = data.session_token;
        localStorage.setItem('sessionToken', sessionToken);

        showMainPanel();
        return true;
    } catch (error) {
        document.getElementById('login-error').textContent = error.message;
        return false;
    }
}

function logout() {
    sessionToken = '';
    localStorage.removeItem('sessionToken');
    document.getElementById('login-page').classList.add('active');
    document.getElementById('main-panel').classList.remove('active');
}

function showMainPanel() {
    document.getElementById('login-page').classList.remove('active');
    document.getElementById('main-panel').classList.add('active');
    loadDashboard();
}

// ========================================
// 页面导航
// ========================================
function navigateTo(page) {
    currentPage = page;

    // 更新导航链接状态
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[data-page="${page}"]`)?.classList.add('active');

    // 显示对应 section
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(`${page}-section`)?.classList.add('active');

    // 加载页面数据
    switch(page) {
        case 'dashboard': loadDashboard(); break;
        case 'keys': loadKeys(); break;
        case 'models': switchModelTab('sources'); loadSources(); loadVirtualModels(); loadBindings(); break;
        case 'logs': loadLogs(); break;
        case 'stats': loadStatistics(); break;
        case 'settings': loadSettings(); break;
    }
}

// ========================================
// 仪表板
// ========================================
async function refreshDashboard() {
    loadDashboard();
}

async function loadUsageSummary() {
    const summary = await apiRequest('usage-summary');
    if (!summary) return;

    // 今日统计
    if (summary.today) {
        document.getElementById('requests-today').textContent = formatNumber(summary.today.requests);
        document.getElementById('input-tokens-today').textContent = formatNumber(summary.today.input_tokens);
        document.getElementById('output-tokens-today').textContent = formatNumber(summary.today.output_tokens);
        document.getElementById('error-rate').textContent = `${summary.today.errors}`;
        if (summary.today.active_users) {
            document.getElementById('active-keys').textContent = summary.today.active_users;
        }
    }
}

async function loadDashboard() {
    const data = await apiRequest('dashboard');
    if (!data) return;

    const dashboard = data.dashboard;

    // 更新统计卡片
    document.getElementById('requests-today').textContent = formatNumber(dashboard.requests_today || 0);
    document.getElementById('tokens-today').textContent = formatNumber(dashboard.tokens_today || 0);
    document.getElementById('error-rate').textContent = `${dashboard.error_rate_24h || 0}%`;

    // 更新详细的 Token 统计
    if (dashboard.input_tokens_today !== undefined) {
        document.getElementById('input-tokens-today').textContent = formatNumber(dashboard.input_tokens_today);
    }
    if (dashboard.output_tokens_today !== undefined) {
        document.getElementById('output-tokens-today').textContent = formatNumber(dashboard.output_tokens_today);
    }
    if (dashboard.input_output_ratio !== undefined) {
        document.getElementById('input-output-ratio').textContent = dashboard.input_output_ratio;
    }

    // 获取活跃密钥数
    const keysData = await apiRequest('keys');
    if (keysData) {
        const activeKeys = keysData.keys?.filter(k => k.is_active).length || 0;
        document.getElementById('active-keys').textContent = activeKeys;
    }

    // 活跃用户排行（使用今日活跃用户）
    const topUsersTable = document.getElementById('top-users-table');
    if (data.top_users && data.top_users.length > 0) {
        topUsersTable.innerHTML = data.top_users.map(user => `
            <tr>
                <td>
                    <div class="text-truncate" style="max-width: 200px;">
                        ${escapeHtml(user.name) || user.key_id?.substring(0, 8) + '...'}
                    </div>
                </td>
                <td>${formatNumber(user.request_count)}</td>
                <td>${formatNumber(user.total_tokens)}</td>
                <td><span class="status-badge status-active"><span class="status-dot-small"></span>活跃</span></td>
            </tr>
        `).join('');
    } else {
        topUsersTable.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">暂无数据</td></tr>';
    }

    // 热门模型排行
    const topModelsTable = document.getElementById('top-models-table');
    if (data.top_models && data.top_models.length > 0) {
        topModelsTable.innerHTML = data.top_models.map(model => `
            <tr>
                <td><span class="font-mono">${escapeHtml(model.model)}</span></td>
                <td>${formatNumber(model.request_count)}</td>
                <td>${Math.round(model.avg_response_time || 0)}ms</td>
                <td><span class="status-badge status-active"><span class="status-dot-small"></span>正常</span></td>
            </tr>
        `).join('');
    } else {
        topModelsTable.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">暂无数据</td></tr>';
    }
}

// ========================================
// 密钥管理
// ========================================
function showCreateKeyForm() {
    document.getElementById('create-key-form').style.display = 'block';
}

function hideCreateKeyForm() {
    document.getElementById('create-key-form').style.display = 'none';
    document.getElementById('new-key-form').reset();
}

async function createKey(event) {
    event.preventDefault();

    const name = document.getElementById('key-name').value;
    const rateLimit = parseInt(document.getElementById('key-rate-limit').value);
    const expiry = document.getElementById('key-expiry').value;
    const description = document.getElementById('key-description').value;

    const data = {
        name,
        rate_limit: rateLimit,
        expires_at: expiry ? new Date(expiry).toISOString() : null,
        metadata: description ? { description } : null
    };

    const result = await apiRequest('keys', 'POST', data);

    if (result) {
        showToast(`密钥创建成功！`, 'success');

        // 显示密钥模态框
        showKeyModal(result.name, result.api_key);

        hideCreateKeyForm();
        loadKeys();
    }
}

// API密钥相关函数
let currentShowKey = '';

function showKeyModal(name, key) {
    document.getElementById('show-key-name').value = name;
    document.getElementById('show-key-value').value = key;
    currentShowKey = key;
    document.getElementById('show-key-modal').style.display = 'block';
}

function closeShowKeyModal() {
    document.getElementById('show-key-modal').style.display = 'none';
    currentShowKey = '';
}

function copyApiKey() {
    const keyInput = document.getElementById('show-key-value');
    keyInput.select();

    if (navigator.clipboard) {
        navigator.clipboard.writeText(currentShowKey).then(() => {
            showToast('密钥已复制', 'success');
        }).catch(() => {
            showToast('密钥已复制', 'success');
        });
    } else {
        showToast('密钥已复制', 'success');
    }
}

async function loadKeys() {
    const data = await apiRequest('keys');
    if (!data) return;

    allKeys = data.keys || [];
    const keysTable = document.getElementById('keys-table');

    if (allKeys.length === 0) {
        keysTable.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 40px;">暂无密钥，请创建新密钥</td></tr>';
        return;
    }

    keysTable.innerHTML = allKeys.map(key => `
        <tr>
            <td>
                <div style="font-weight: 500;">${escapeHtml(key.name)}</div>
                ${key.metadata?.description ? `<div style="font-size: 12px; color: var(--text-muted);">${escapeHtml(key.metadata.description)}</div>` : ''}
            </td>
            <td class="font-mono" style="font-size: 12px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px; font-size: 11px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(key.api_key || '')}">${escapeHtml((key.api_key || '').substring(0, 12))}...</span>
                    <button class="btn btn-sm btn-secondary" onclick="copyPlainTextKey('${key.key_id}')" style="padding: 2px 6px; font-size: 11px;">复制</button>
                </div>
            </td>
            <td>${formatDate(key.created_at)}</td>
            <td>${key.expires_at ? formatDate(key.expires_at) : '<span style="color: var(--text-muted);">永久</span>'}</td>
            <td><span class="font-mono">${key.rate_limit}</span> req/min</td>
            <td>
                <a href="#" onclick="loadKeyStats('${key.key_id}'); return false;" style="color: var(--primary-color); text-decoration: none;">查看统计</a>
            </td>
            <td>
                <span class="status-badge ${key.is_active ? 'status-active' : 'status-inactive'}">
                    <span class="status-dot-small"></span>
                    ${key.is_active ? '活跃' : '已禁用'}
                </span>
            </td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-sm btn-secondary" onclick="editKey('${key.key_id}')">编辑</button>
                    ${key.is_active ? `
                        <button class="btn btn-sm btn-secondary" onclick="toggleKeyStatus('${key.key_id}', false)">禁用</button>
                    ` : `
                        <button class="btn btn-sm btn-secondary" onclick="toggleKeyStatus('${key.key_id}', true)">启用</button>
                    `}
                    <button class="btn btn-sm btn-danger" onclick="deleteKey('${key.key_id}')">删除</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// 复制明文密钥
async function copyPlainTextKey(keyId) {
    const key = allKeys.find(k => k.key_id === keyId);
    if (!key || !key.api_key) {
        showToast('无法获取密钥', 'error');
        return;
    }

    if (navigator.clipboard) {
        navigator.clipboard.writeText(key.api_key).then(() => {
            showToast('密钥已复制到剪贴板', 'success');
        }).catch(() => {
            showToast('复制失败', 'error');
        });
    } else {
        showToast('浏览器不支持复制', 'error');
    }
}

async function toggleKeyStatus(keyId, isActive) {
    const action = isActive ? '启用' : '禁用';
    const result = await apiRequest(`keys/${keyId}`, 'PATCH', { is_active: isActive });
    if (result) {
        showToast(`密钥已${action}`, 'success');
        loadKeys();
    }
}

async function showKeyDetail(keyId) {
    const key = allKeys.find(k => k.key_id === keyId);
    if (!key) return;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content modal-large">
            <div class="modal-header">
                <h3>密钥详情</h3>
                <button class="btn-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div style="padding: 24px;">
                <div class="info-list">
                    <div class="info-item">
                        <span class="info-label">密钥名称</span>
                        <span class="info-value">${escapeHtml(key.name)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">密钥 ID</span>
                        <span class="info-value font-mono">${key.key_id}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">创建时间</span>
                        <span class="info-value">${formatDateTime(key.created_at)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">过期时间</span>
                        <span class="info-value">${key.expires_at ? formatDateTime(key.expires_at) : '永久'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">限流</span>
                        <span class="info-value">${key.rate_limit} 请求/分钟</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">状态</span>
                        <span class="info-value">
                            <span class="status-badge ${key.is_active ? 'status-active' : 'status-inactive'}">
                                ${key.is_active ? '活跃' : '已禁用'}
                            </span>
                        </span>
                    </div>
                    ${key.metadata?.description ? `
                    <div class="info-item">
                        <span class="info-label">备注</span>
                        <span class="info-value">${escapeHtml(key.metadata.description)}</span>
                    </div>
                    ` : ''}
                </div>
                <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">关闭</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function showKeyStats(keyId) {
    const stats = await apiRequest(`user-stats/${keyId}`);
    if (stats) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>密钥统计</h3>
                    <button class="btn-close" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <div style="padding: 24px;">
                    <div class="stats-grid" style="grid-template-columns: repeat(2, 1fr); gap: 12px;">
                        <div class="stat-card" style="padding: 16px;">
                            <div class="stat-content">
                                <span class="stat-label">总请求数</span>
                                <span class="stat-value" style="font-size: 20px;">${formatNumber(stats.total_requests || 0)}</span>
                            </div>
                        </div>
                        <div class="stat-card" style="padding: 16px;">
                            <div class="stat-content">
                                <span class="stat-label">总 Token</span>
                                <span class="stat-value" style="font-size: 20px;">${formatNumber((stats.total_input_tokens || 0) + (stats.total_output_tokens || 0))}</span>
                            </div>
                        </div>
                        <div class="stat-card" style="padding: 16px;">
                            <div class="stat-content">
                                <span class="stat-label">输入 Token</span>
                                <span class="stat-value" style="font-size: 16px;">${formatNumber(stats.total_input_tokens || 0)}</span>
                            </div>
                        </div>
                        <div class="stat-card" style="padding: 16px;">
                            <div class="stat-content">
                                <span class="stat-label">输出 Token</span>
                                <span class="stat-value" style="font-size: 16px;">${formatNumber(stats.total_output_tokens || 0)}</span>
                            </div>
                        </div>
                    </div>
                    <div style="margin-top: 20px; text-align: center;">
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">关闭</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
}

async function deleteKey(keyId) {
    if (!confirm('确定要删除此密钥吗？删除后无法恢复。')) return;

    const result = await apiRequest(`keys/${keyId}`, 'DELETE');
    if (result) {
        showToast('密钥已删除', 'success');
        loadKeys();
    }
}

// 编辑密钥配置
async function editKey(keyId) {
    // 获取密钥详情
    const key = allKeys.find(k => k.key_id === keyId);
    if (!key) {
        showToast('密钥不存在', 'error');
        return;
    }

    // 填充表单
    document.getElementById('edit-key-id').value = keyId;
    document.getElementById('edit-key-name').value = key.name;
    document.getElementById('edit-key-rate-limit').value = key.rate_limit;
    document.getElementById('edit-key-encoded').value = key.api_key || '';

    // 显示模态框
    document.getElementById('edit-key-modal').style.display = 'block';
}

function copyPlainTextKeyFromEdit() {
    const keyInput = document.getElementById('edit-key-encoded');
    if (!keyInput.value) {
        showToast('无密钥数据', 'warning');
        return;
    }

    if (navigator.clipboard) {
        navigator.clipboard.writeText(keyInput.value).then(() => {
            showToast('密钥已复制', 'success');
        }).catch(() => {
            showToast('复制失败', 'error');
        });
    } else {
        showToast('浏览器不支持', 'error');
    }
}

function closeEditKeyModal() {
    document.getElementById('edit-key-modal').style.display = 'none';
    document.getElementById('edit-key-form').reset();
}

async function updateKey(event) {
    event.preventDefault();

    const keyId = document.getElementById('edit-key-id').value;
    const data = {
        name: document.getElementById('edit-key-name').value,
        rate_limit: parseInt(document.getElementById('edit-key-rate-limit').value)
    };

    const result = await apiRequest(`keys/${keyId}`, 'PATCH', data);
    if (result) {
        showToast('配置已更新', 'success');
        closeEditKeyModal();
        loadKeys();
    }
}

// ========================================
// 模型配置
// ========================================
function showAddModelModal() {
    document.getElementById('add-model-modal').style.display = 'flex';
}

function closeAddModelModal() {
    document.getElementById('add-model-modal').style.display = 'none';
    document.getElementById('add-model-form').reset();
}

async function loadModels() {
    const config = await apiRequest('config');
    if (!config) return;

    allModels = config.models || {};
    const modelsList = document.getElementById('models-list');

    const modelEntries = Object.entries(allModels);
    if (modelEntries.length === 0) {
        modelsList.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px; color: var(--text-muted);">
                <svg style="width: 48px; height: 48px; margin-bottom: 16px; opacity: 0.5;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
                <p>暂无模型配置</p>
                <button class="btn btn-primary" onclick="showAddModelModal()" style="margin-top: 16px;">添加第一个模型</button>
            </div>
        `;
        return;
    }

    modelsList.innerHTML = modelEntries.map(([name, model]) => `
        <div class="model-card">
            <div class="model-card-header">
                <span class="model-name font-mono">${escapeHtml(name)}</span>
                <span class="model-status ${model.enabled ? 'active' : 'inactive'}">
                    ${model.enabled ? '已启用' : '已禁用'}
                </span>
            </div>
            <div class="model-card-body">
                <div class="model-info">
                    <span class="model-info-label">Base URL:</span>
                    <span class="model-info-value font-mono">${escapeHtml(model.source_base_url)}</span>
                </div>
                <div class="model-info">
                    <span class="model-info-label">源模型:</span>
                    <span class="model-info-value font-mono">${escapeHtml(model.source_model)}</span>
                </div>
                <div class="model-info">
                    <span class="model-info-label">API Key:</span>
                    <span class="model-info-value font-mono">${maskApiKey(model.source_api_key)}</span>
                </div>
            </div>
            <div class="model-card-actions">
                <button class="btn btn-sm btn-secondary" onclick="editModel('${escapeHtml(name)}')">编辑</button>
                <button class="btn btn-sm btn-${model.enabled ? 'warning' : 'success'}" onclick="toggleModel('${escapeHtml(name)}', ${!model.enabled})">
                    ${model.enabled ? '禁用' : '启用'}
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteModel('${escapeHtml(name)}')">删除</button>
            </div>
        </div>
    `).join('');
}

async function addModel(event) {
    event.preventDefault();

    const name = document.getElementById('model-name').value;
    const baseUrl = document.getElementById('model-base-url').value;
    const source = document.getElementById('model-source').value;
    const apiKey = document.getElementById('model-api-key').value;
    const enabled = document.getElementById('model-enabled').checked;

    // 只发送新模型配置，后端会自动合并
    const result = await apiRequest('config', 'POST', {
        models: {
            [name]: {
                source_base_url: baseUrl,
                source_model: source,
                source_api_key: apiKey,
                enabled
            }
        }
    });
    if (result) {
        showToast('模型配置已保存', 'success');
        closeAddModelModal();
        loadModels();
    }
}

async function toggleModel(name, enabled) {
    // 只发送需要更新的模型配置
    const result = await apiRequest('config', 'POST', {
        models: {
            [name]: {
                enabled
            }
        }
    });
    if (result) {
        showToast(`模型已${enabled ? '启用' : '禁用'}`, 'success');
        loadModels();
    }
}

async function deleteModel(name) {
    if (!confirm(`确定要删除模型 "${name}" 吗？删除后无法恢复。`)) return;

    // 发送null表示删除该模型
    const result = await apiRequest('config', 'POST', { models: { [name]: null } });

    if (result) {
        showToast('模型已删除', 'success');
        loadModels();
    }
}

function editModel(name) {
    const model = allModels[name];
    if (!model) return;

    document.getElementById('model-name').value = name;
    document.getElementById('model-base-url').value = model.source_base_url;
    document.getElementById('model-source').value = model.source_model;
    document.getElementById('model-api-key').value = model.source_api_key;
    document.getElementById('model-enabled').checked = model.enabled;

    showAddModelModal();
}

// ========================================
// 三步模型管理
// ========================================

// 切换标签页
function switchModelTab(tabName) {
    // 移除所有活动状态
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // 设置新的活动状态
    document.getElementById(`tab-${tabName}`).classList.add('active');
    event.target.classList.add('active');

    // 加载对应数据
    if (tabName === 'sources') loadSources();
    if (tabName === 'virtual') loadVirtualModels();
    if (tabName === 'bindings') loadBindings();
}

// 显示添加源API模态框
function showAddSourceModal() {
    document.getElementById('add-source-modal').style.display = 'block';
    document.getElementById('add-source-form').reset();
}

// 源模型标签管理
let sourceModelsList = [];

function addSourceModelTag() {
    const input = document.getElementById('source-model-input');
    const value = input.value.trim();
    if (value && !sourceModelsList.includes(value)) {
        sourceModelsList.push(value);
        // 如果在编辑模式，同时更新editingSourceModels
        if (editingSourceId) {
            editingSourceModels = [...sourceModelsList];
        }
        renderSourceModelTags();
        input.value = '';
    }
}

function removeSourceModelTag(index) {
    sourceModelsList.splice(index, 1);
    // 如果在编辑模式，同时更新editingSourceModels
    if (editingSourceId) {
        editingSourceModels = [...sourceModelsList];
    }
    renderSourceModelTags();
}

function renderSourceModelTags() {
    const container = document.getElementById('source-models-list');
    if (container) {
        container.innerHTML = sourceModelsList.map((tag, i) => `
            <span class="tag">
                ${escapeHtml(tag)}
                <button type="button" class="tag-remove" onclick="removeSourceModelTag(${i})">×</button>
            </span>
        `).join('') + '<span style="color: var(--text-muted); font-size: 13px;">' + sourceModelsList.length + ' 个模型</span>';
    }
}

function showAddSourceModal() {
    document.getElementById('add-source-modal').style.display = 'block';
    document.getElementById('add-source-form').reset();
    sourceModelsList = [];
    renderSourceModelTags();
}

function closeAddSourceModal() {
    document.getElementById('add-source-modal').style.display = 'none';
    document.getElementById('add-source-form').reset();
    sourceModelsList = [];
    renderSourceModelTags();
}

// 源模型选择器联动
async function updateSourceModelOptions() {
    const sourceId = document.getElementById('binding-source')?.value ||
                     document.getElementById('update-binding-source')?.value;

    const modelSelect = document.getElementById('binding-source-model') ||
                        document.getElementById('update-binding-source-model');

    if (!sourceId || !modelSelect) return;

    // 获取源API详情
    const sourcesResponse = await apiRequest('source-apis');
    const sources = sourcesResponse?.source_apis || [];
    const source = sources.find(s => s.source_id === sourceId);

    if (source && source.supported_models && source.supported_models.length > 0) {
        // 使用源API配置中的模型列表
        modelSelect.innerHTML = '<option value="">选择源模型</option>' +
            source.supported_models.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
    } else {
        // 如果没有配置，提供手动输入选项
        modelSelect.innerHTML = '<option value="">或手动输入</option>';
        // 添加一个隐藏的输入框用于手动输入
        const manualInput = document.createElement('input');
        manualInput.type = 'text';
        manualInput.placeholder = '手动输入源模型名称';
        manualInput.style.display = 'none';
        manualInput.id = modelSelect.id + '-manual';

        // 添加"手动输入"选项
        const manualOption = document.createElement('option');
        manualOption.value = '__manual__';
        manualOption.textContent = '-- 手动输入 --';
        modelSelect.appendChild(manualOption);

        modelSelect.onchange = function() {
            if (this.value === '__manual__') {
                this.style.display = 'none';
                manualInput.style.display = 'block';
                manualInput.focus();
            }
        };

        // 插入手动输入框
        if (!document.getElementById(manualInput.id)) {
            modelSelect.parentNode.appendChild(manualInput);
        }
    }
}

async function addSource(event) {
    event.preventDefault();

    const data = {
        name: document.getElementById('source-name').value,
        base_url: document.getElementById('source-base-url').value,
        api_key: document.getElementById('source-api-key').value,
        supported_models: sourceModelsList.length > 0 ? sourceModelsList : null
    };

    const result = await apiRequest('source-apis', 'POST', data);
    if (result) {
        showToast('源API创建成功', 'success');
        closeAddSourceModal();
        loadSources();
    }
}

async function loadSources() {
    const response = await apiRequest('source-apis');
    if (!response) return;

    const sources = response.source_apis || [];
    const tbody = document.getElementById('sources-table');

    if (sources.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">暂无源API配置</td></tr>';
        return;
    }

    tbody.innerHTML = sources.map(source => {
        const modelsCount = (source.supported_models || []).length;
        return `
        <tr>
            <td>${escapeHtml(source.name)}</td>
            <td class="font-mono" style="font-size: 12px;">${escapeHtml(source.base_url)}</td>
            <td class="font-mono" style="font-size: 12px;">${maskApiKey(source.api_key)}</td>
            <td><span class="status-badge status-${source.is_active ? 'active' : 'inactive'}">
                ${source.is_active ? '激活' : '禁用'}
            </span></td>
            <td>
                <span style="font-size: 12px; color: var(--text-muted);">${modelsCount} 个模型</span>
                <button class="btn btn-sm btn-secondary" onclick="editSourceApi('${source.source_id}')" style="margin-left: 8px;">编辑</button>
                <button class="btn btn-sm btn-danger" onclick="deleteSourceApi('${source.source_id}')">删除</button>
            </td>
        </tr>
    `}).join('');
}

// 编辑源API
let editingSourceId = null;
let editingSourceModels = [];

async function editSourceApi(sourceId) {
    editingSourceId = sourceId;
    const response = await apiRequest(`source-apis/${sourceId}`);
    if (!response) return;

    document.getElementById('source-name').value = response.name;
    document.getElementById('source-base-url').value = response.base_url;
    document.getElementById('source-api-key').value = response.api_key;
    editingSourceModels = response.supported_models || [];
    sourceModelsList = [...editingSourceModels];
    renderSourceModelTags();

    document.getElementById('add-source-modal').style.display = 'block';
    document.querySelector('#add-source-modal h3').textContent = '编辑源API配置';
}

async function updateSource(event) {
    event.preventDefault();

    const data = {
        name: document.getElementById('source-name').value,
        base_url: document.getElementById('source-base-url').value,
        api_key: document.getElementById('source-api-key').value,
        supported_models: editingSourceModels.length > 0 ? editingSourceModels : null
    };

    const result = await apiRequest(`source-apis/${editingSourceId}`, 'PATCH', data);
    if (result) {
        showToast('源API更新成功', 'success');
        closeAddSourceModal();
        editingSourceId = null;
        editingSourceModels = [];
        document.querySelector('#add-source-modal h3').textContent = '添加源API配置';
        loadSources();
    }
}

// 表单提交事件处理
document.addEventListener('DOMContentLoaded', function() {
    // 源API表单
    const addSourceForm = document.getElementById('add-source-form');
    if (addSourceForm) {
        addSourceForm.addEventListener('submit', function(e) {
            if (editingSourceId) {
                updateSource(e);
            } else {
                addSource(e);
            }
        });
    }

    // 虚拟模型表单
    const addVirtualModelForm = document.getElementById('add-virtual-model-form');
    if (addVirtualModelForm) {
        addVirtualModelForm.addEventListener('submit', addVirtualModel);
    }

    // 绑定表单
    const addBindingForm = document.getElementById('add-binding-form');
    if (addBindingForm) {
        addBindingForm.addEventListener('submit', addBinding);
    }

    const updateBindingForm = document.getElementById('update-binding-form');
    if (updateBindingForm) {
        updateBindingForm.addEventListener('submit', updateBinding);
    }
});

async function deleteSourceApi(sourceId) {
    if (!confirm('删除源API会同时删除相关的绑定关系，确定继续吗？')) return;

    const result = await apiRequest(`source-apis/${sourceId}`, 'DELETE');
    if (result) {
        showToast('源API已删除', 'success');
        loadSources();
        loadBindings();
    }
}

// 虚拟模型管理
function showAddVirtualModelModal() {
    document.getElementById('add-virtual-model-modal').style.display = 'block';
    document.getElementById('add-virtual-model-form').reset();
}

function closeAddVirtualModelModal() {
    document.getElementById('add-virtual-model-modal').style.display = 'none';
    document.getElementById('add-virtual-model-form').reset();
}

async function addVirtualModel(event) {
    event.preventDefault();

    const data = {
        model_id: document.getElementById('virtual-model-id').value || null,
        name: document.getElementById('virtual-model-name').value,
        description: document.getElementById('virtual-model-description').value
    };

    try {
        const result = await apiRequest('virtual-models', 'POST', data);
        if (result) {
            showToast('虚拟模型创建成功', 'success');
            closeAddVirtualModelModal();
            loadVirtualModels();
        }
    } catch (error) {
        showToast(`创建失败: ${error.message}`, 'error');
    }
}

async function loadVirtualModels() {
    const response = await apiRequest('virtual-models');
    if (!response) return;

    const models = response.virtual_models || [];
    const tbody = document.getElementById('virtual-models-table');

    if (models.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">暂无虚拟模型</td></tr>';
        return;
    }

    tbody.innerHTML = models.map(model => `
        <tr>
            <td class="font-mono">${escapeHtml(model.model_id)}</td>
            <td>${escapeHtml(model.name)}</td>
            <td>${escapeHtml(model.description || '-')}</td>
            <td><span class="status-badge status-${model.is_active ? 'active' : 'inactive'}">
                ${model.is_active ? '激活' : '禁用'}
            </span></td>
            <td>
                <button class="btn btn-sm btn-danger" onclick="deleteVirtualModel('${model.model_id}')">删除</button>
            </td>
        </tr>
    `).join('');
}

async function deleteVirtualModel(modelId) {
    if (!confirm('删除虚拟模型会同时删除相关的绑定关系，确定继续吗？')) return;

    const result = await apiRequest(`virtual-models/${modelId}`, 'DELETE');
    if (result) {
        showToast('虚拟模型已删除', 'success');
        loadVirtualModels();
        loadBindings();
    }
}

// 绑定管理
function showAddBindingModal() {
    document.getElementById('add-binding-modal').style.display = 'block';
    document.getElementById('add-binding-form').reset();
    loadBindingOptions();
}

function closeAddBindingModal() {
    document.getElementById('add-binding-modal').style.display = 'none';
    document.getElementById('add-binding-form').reset();
}

function closeUpdateBindingModal() {
    document.getElementById('update-binding-modal').style.display = 'none';
}

async function loadBindingOptions() {
    // 加载虚拟模型选项（两个下拉框都要加载）
    const vModels = await apiRequest('virtual-models');
    const vSelect1 = document.getElementById('binding-virtual-model');
    const vSelect2 = document.getElementById('update-binding-virtual-model');

    if (vModels) {
        const options = '<option value="">选择虚拟模型</option>' +
            (vModels.virtual_models || []).map(m =>
                `<option value="${m.model_id}">${escapeHtml(m.name)} (${m.model_id})</option>`
            ).join('');

        if (vSelect1) vSelect1.innerHTML = options;
        if (vSelect2) vSelect2.innerHTML = options;
    }

    // 加载源API选项（两个下拉框都要加载）
    const sources = await apiRequest('source-apis');
    const sSelect1 = document.getElementById('binding-source');
    const sSelect2 = document.getElementById('update-binding-source');

    if (sources) {
        const options = '<option value="">选择源API</option>' +
            (sources.source_apis || []).map(s =>
                `<option value="${s.source_id}">${escapeHtml(s.name)}</option>`
            ).join('');

        if (sSelect1) sSelect1.innerHTML = options;
        if (sSelect2) sSelect2.innerHTML = options;
    }

    // 为两个源API选择器添加change事件监听器
    if (sSelect1) {
        sSelect1.addEventListener('change', async function() {
            await updateSourceModelOptionsForBinding('binding-source', 'binding-source-model');
        });
    }

    if (sSelect2) {
        sSelect2.addEventListener('change', async function() {
            await updateSourceModelOptionsForBinding('update-binding-source', 'update-binding-source-model');
        });
    }

    // 为两个源模型选择器添加change事件监听器
    const sourceModelSelect1 = document.getElementById('binding-source-model');
    const sourceModelSelect2 = document.getElementById('update-binding-source-model');

    if (sourceModelSelect1) {
        sourceModelSelect1.addEventListener('change', async function() {
            await handleSourceModelChange(this, 'binding-source-model');
        });
    }

    if (sourceModelSelect2) {
        sourceModelSelect2.addEventListener('change', async function() {
            await handleSourceModelChange(this, 'update-binding-source-model');
        });
    }
}

async function updateSourceModelOptionsForBinding(sourceSelectId, modelSelectId) {
    const sourceId = document.getElementById(sourceSelectId)?.value;
    if (!sourceId) return;

    // 获取源API详情
    const sourcesResponse = await apiRequest('source-apis');
    const sources = sourcesResponse?.source_apis || [];
    const source = sources.find(s => s.source_id === sourceId);

    const modelSelect = document.getElementById(modelSelectId);
    if (!modelSelect) return;

    // 移除旧的手动输入框
    const oldManualInput = document.getElementById(modelSelectId + '-manual');
    if (oldManualInput) oldManualInput.remove();

    if (source && source.supported_models && source.supported_models.length > 0) {
        // 使用源API配置中的模型列表
        modelSelect.innerHTML = '<option value="">选择源模型</option>' +
            source.supported_models.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
    } else {
        // 如果没有配置，提供手动输入选项
        modelSelect.innerHTML = '<option value="">或手动输入</option>';

        // 添加"手动输入"选项
        const manualOption = document.createElement('option');
        manualOption.value = '__manual__';
        manualOption.textContent = '-- 手动输入 --';
        modelSelect.appendChild(manualOption);
    }
}

async function handleSourceModelChange(selectElement, baseId) {
    // 检查是否选择了手动输入
    if (selectElement.value === '__manual__') {
        selectElement.style.display = 'none';
        const manualInput = document.getElementById(baseId + '-manual');
        if (manualInput) {
            manualInput.style.display = 'block';
            manualInput.focus();
        }
    }
}

async function addBinding(event) {
    event.preventDefault();

    // 检查是否有手动输入的模型名称
    const sourceModelSelect = document.getElementById('binding-source-model');
    let sourceModelName = sourceModelSelect.value;

    // 检查手动输入框
    const manualInput = document.getElementById('binding-source-model-manual');
    if (manualInput && manualInput.style.display !== 'none' && manualInput.value.trim()) {
        sourceModelName = manualInput.value.trim();
    }

    if (!sourceModelName) {
        showToast('请选择或输入源模型名称', 'error');
        return;
    }

    const data = {
        virtual_model_id: document.getElementById('binding-virtual-model').value,
        source_id: document.getElementById('binding-source').value,
        source_model_name: sourceModelName,
        priority: parseInt(document.getElementById('binding-priority').value) || 0
    };

    try {
        const result = await apiRequest('model-bindings', 'POST', data);
        if (result) {
            showToast('绑定创建成功', 'success');
            closeAddBindingModal();
            loadBindings();
        }
    } catch (error) {
        showToast(`创建失败: ${error.message}`, 'error');
    }
}

async function loadBindings() {
    const response = await apiRequest('model-bindings');
    if (!response) return;

    const bindings = response.model_bindings || [];
    const tbody = document.getElementById('bindings-table');

    if (bindings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">暂无绑定关系</td></tr>';
        return;
    }

    tbody.innerHTML = bindings.map(binding => `
        <tr>
            <td class="font-mono">${escapeHtml(binding.virtual_model_name || binding.virtual_model_id)}</td>
            <td class="font-mono">${escapeHtml(binding.source_name || binding.source_id)}</td>
            <td class="font-mono" style="font-size: 12px;">${escapeHtml(binding.source_model_name)}</td>
            <td>${binding.priority || 0}</td>
            <td><span class="status-badge status-${binding.is_active ? 'active' : 'inactive'}">
                ${binding.is_active ? '激活' : '禁用'}
            </span></td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="editBinding('${binding.binding_id}')">编辑</button>
                <button class="btn btn-sm btn-danger" onclick="deleteBinding('${binding.binding_id}')">删除</button>
            </td>
        </tr>
    `).join('');
}

let currentBindingId = null;

async function editBinding(bindingId) {
    currentBindingId = bindingId;
    document.getElementById('update-binding-modal').style.display = 'block';

    // 加载当前绑定信息
    const binding = await apiRequest(`model-bindings/${bindingId}`);
    if (!binding) return;

    // 加载选项
    await loadBindingOptions();

    // 设置当前值
    document.getElementById('update-binding-virtual-model').value = binding.virtual_model_id;
    document.getElementById('update-binding-source').value = binding.source_id;

    // 触发源模型选项更新
    const sourceSelect = document.getElementById('update-binding-source');
    if (sourceSelect) {
        // 手动触发change事件来更新源模型选项
        const event = new Event('change');
        sourceSelect.dispatchEvent(event);
    }

    // 等待选项更新后设置源模型值
    setTimeout(() => {
        const sourceModelSelect = document.getElementById('update-binding-source-model');
        if (!sourceModelSelect) return;

        // 尝试匹配现有选项
        const options = Array.from(sourceModelSelect.options);
        const matchingOption = options.find(opt => opt.value === binding.source_model_name);

        if (matchingOption) {
            sourceModelSelect.value = binding.source_model_name;
        } else {
            // 没有匹配，使用手动输入
            const manualInput = document.getElementById('update-binding-source-model-manual');
            if (manualInput) {
                manualInput.style.display = 'block';
                manualInput.value = binding.source_model_name;
                manualInput.focus();
                sourceModelSelect.value = '__manual__';
            }
        }
    }, 200);

    document.getElementById('update-binding-priority').value = binding.priority || 0;
}

async function updateBinding(event) {
    event.preventDefault();

    // 检查是否有手动输入的模型名称
    const sourceModelSelect = document.getElementById('update-binding-source-model');
    let sourceModelName = sourceModelSelect.value;

    // 检查手动输入框
    const manualInput = document.getElementById('update-binding-source-model-manual');
    if (manualInput && manualInput.style.display !== 'none' && manualInput.value.trim()) {
        sourceModelName = manualInput.value.trim();
    }

    if (!sourceModelName) {
        showToast('请选择或输入源模型名称', 'error');
        return;
    }

    const data = {
        virtual_model_id: document.getElementById('update-binding-virtual-model').value,
        source_id: document.getElementById('update-binding-source').value,
        source_model_name: sourceModelName,
        priority: parseInt(document.getElementById('update-binding-priority').value)
    };

    try {
        const result = await apiRequest(`model-bindings/${currentBindingId}`, 'PATCH', data);
        if (result) {
            showToast('绑定更新成功', 'success');
            closeUpdateBindingModal();
            loadBindings();
        }
    } catch (error) {
        showToast(`更新失败: ${error.message}`, 'error');
    }
}

async function deleteBinding(bindingId) {
    if (!confirm('确定要删除这个绑定关系吗？')) return;

    const result = await apiRequest(`model-bindings/${bindingId}`, 'DELETE');
    if (result) {
        showToast('绑定关系已删除', 'success');
        loadBindings();
    }
}


// ========================================
// 请求日志
// ========================================
async function clearLogs() {
    if (!confirm('确定要清空所有日志和统计数据吗？此操作不可恢复。')) return;

    const result = await apiRequest('logs/clear', 'POST', {});
    if (result) {
        showToast(`日志已清空（删除${result.logs_deleted}条日志，${result.statistics_deleted}条统计）`, 'success');
        loadLogs();
    }
}

async function loadLogs() {
    const keyId = document.getElementById('log-key-id').value;
    const model = document.getElementById('log-model').value;
    const status = document.getElementById('log-status').value;
    const startDate = document.getElementById('log-start-date').value;
    const endDate = document.getElementById('log-end-date').value;

    const params = new URLSearchParams({
        limit: logsLimit,
        offset: logsOffset
    });

    if (keyId) params.append('key_id', keyId);
    if (model) params.append('model', model);
    if (status) params.append('status_code', status);
    if (startDate) params.append('start_date', new Date(startDate).toISOString());
    if (endDate) params.append('end_date', new Date(endDate).toISOString());

    const data = await apiRequest(`logs?${params.toString()}`);
    if (!data) return;

    const logsTable = document.getElementById('logs-table');

    if (!data.logs || data.logs.length === 0) {
        logsTable.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 40px;">暂无日志记录</td></tr>';
    } else {
        logsTable.innerHTML = data.logs.map(log => `
            <tr>
                <td>${formatDateTime(log.request_time)}</td>
                <td class="font-mono">${log.client_ip || '-'}</td>
                <td class="font-mono" style="font-size: 12px;">${log.key_id ? log.key_id.substring(0, 16) + '...' : '-'}</td>
                <td class="font-mono">${escapeHtml(log.model)}</td>
                <td>
                    <span class="status-badge ${getStatusClass(log.status_code)}">
                        ${log.status_code || '-'}
                    </span>
                </td>
                <td class="font-mono">
                    ${log.input_tokens || 0} / ${log.output_tokens || 0}
                </td>
                <td>${log.response_time_ms ? log.response_time_ms + 'ms' : '-'}</td>
                <td style="max-width: 200px;" class="text-truncate">${log.error_message || '-'}</td>
            </tr>
        `).join('');
    }

    updateLogsPageInfo();
}

function getStatusClass(statusCode) {
    if (!statusCode) return '';
    if (statusCode >= 200 && statusCode < 300) return 'status-active';
    if (statusCode >= 400 && statusCode < 500) return 'status-warning';
    if (statusCode >= 500) return 'status-danger';
    return '';
}

function resetLogFilters() {
    document.getElementById('logs-filter-form').reset();
    logsOffset = 0;
    loadLogs();
}

function updateLogsPageInfo() {
    const pageNum = Math.floor(logsOffset / logsLimit) + 1;
    document.getElementById('logs-page-info').textContent = `第 ${pageNum} 页`;
}

function prevLogsPage() {
    if (logsOffset > 0) {
        logsOffset -= logsLimit;
        loadLogs();
    }
}

function nextLogsPage() {
    logsOffset += logsLimit;
    loadLogs();
}

// ========================================
// 统计报表
// ========================================
async function loadStatistics() {
    const keyId = document.getElementById('stats-key-id').value;
    const startDate = document.getElementById('stats-start-date').value;
    const endDate = document.getElementById('stats-end-date').value;

    const params = new URLSearchParams();
    if (keyId) params.append('key_id', keyId);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);

    const stats = await apiRequest(`statistics?${params.toString()}`);
    if (!stats) return;

    // 总体统计
    const total = stats.total || {};
    const totalTokens = (total.total_input_tokens || 0) + (total.total_output_tokens || 0);
    const activeUsers = stats.by_user?.length || 0;
    const avgRequestsPerUser = activeUsers > 0 ? Math.round(total.total_requests / activeUsers) : 0;

    document.getElementById('total-requests').textContent = formatNumber(total.total_requests || 0);
    document.getElementById('total-input-tokens').textContent = formatNumber(total.total_input_tokens || 0);
    document.getElementById('total-output-tokens').textContent = formatNumber(total.total_output_tokens || 0);
    document.getElementById('total-tokens').textContent = formatNumber(totalTokens);
    document.getElementById('total-errors').textContent = formatNumber(total.total_errors || 0);
    document.getElementById('avg-requests-per-user').textContent = avgRequestsPerUser;

    // 按日期统计
    const dailyStatsTable = document.getElementById('daily-stats-table');
    if (stats.by_date && stats.by_date.length > 0) {
        dailyStatsTable.innerHTML = stats.by_date.map(stat => `
            <tr>
                <td>${stat.date}</td>
                <td>${formatNumber(stat.total_requests)}</td>
                <td class="font-mono">${formatNumber(stat.total_input_tokens)}</td>
                <td class="font-mono">${formatNumber(stat.total_output_tokens)}</td>
                <td>${formatNumber(stat.total_errors)}</td>
                <td>--</td>
            </tr>
        `).join('');
    } else {
        dailyStatsTable.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">暂无数据</td></tr>';
    }

    // 按用户统计
    const userStatsTable = document.getElementById('user-stats-table');
    if (stats.by_user && stats.by_user.length > 0) {
        userStatsTable.innerHTML = stats.by_user.map(stat => `
            <tr>
                <td class="font-mono" style="font-size: 12px;">${stat.key_id ? stat.key_id.substring(0, 16) + '...' : '全局'}</td>
                <td>${formatNumber(stat.total_requests)}</td>
                <td class="font-mono">${formatNumber(stat.total_input_tokens || 0)}</td>
                <td class="font-mono">${formatNumber(stat.total_output_tokens || 0)}</td>
                <td>${formatNumber(stat.total_errors)}</td>
            </tr>
        `).join('');
    } else {
        userStatsTable.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">暂无数据</td></tr>';
    }
}

// ========================================
// 系统设置
// ========================================
async function loadSettings() {
    const config = await apiRequest('config');
    if (!config) return;

    document.getElementById('global-rpm').value = config.rate_limit?.global_rpm || 1000;
    document.getElementById('default-key-rpm').value = config.rate_limit?.default_key_rpm || 60;
}

async function saveRateLimit(event) {
    event.preventDefault();

    const globalRpm = parseInt(document.getElementById('global-rpm').value);
    const defaultKeyRpm = parseInt(document.getElementById('default-key-rpm').value);

    const result = await apiRequest('config', 'POST', {
        rate_limit: {
            global_rpm: globalRpm,
            default_key_rpm: defaultKeyRpm
        }
    });

    if (result) {
        showToast('限流配置已保存', 'success');
    }
}

let pendingPasswordChange = null;

function changeAdminPassword(event) {
    event.preventDefault();

    const newPassword = document.getElementById('new-admin-password').value;

    if (!newPassword || newPassword.length < 6) {
        showToast('密码长度至少为 6 位', 'warning');
        return;
    }

    // 显示二次确认模态框
    document.getElementById('confirm-new-password').value = newPassword;
    document.getElementById('confirm-current-password').value = '';
    document.getElementById('password-confirm-modal').style.display = 'block';
}

function closePasswordConfirmModal() {
    document.getElementById('password-confirm-modal').style.display = 'none';
    pendingPasswordChange = null;
}

async function confirmPasswordChange() {
    const currentPassword = document.getElementById('confirm-current-password').value;
    const newPassword = document.getElementById('confirm-new-password').value;

    if (!currentPassword) {
        showToast('请输入当前密码', 'warning');
        return;
    }

    // 验证当前密码
    try {
        const resp = await fetch('/admin/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: currentPassword })
        });

        if (!resp.ok) {
            showToast('当前密码错误', 'error');
            return;
        }

        const data = await resp.json();
        const token = data.session_token;

        // 当前密码验证通过，修改密码
        const result = await fetch('/admin/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': token
            },
            body: JSON.stringify({ admin_password: newPassword })
        });

        if (result.ok) {
            showToast('密码已修改', 'success');
            closePasswordConfirmModal();
            // 清除旧token并刷新
            localStorage.removeItem('sessionToken');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            const error = await result.json();
            showToast('密码修改失败: ' + (error.detail || '未知错误'), 'error');
        }
    } catch (error) {
        console.error('Password change error:', error);
        showToast('密码修改失败: ' + error.message, 'error');
    }
}

// ========================================
// 工具函数
// ========================================
function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function maskApiKey(key) {
    if (!key || key.length < 16) return '***';
    return key.substring(0, 6) + '...' + key.substring(key.length - 4);
}

// ========================================
// 移动端菜单
// ========================================
function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobile-overlay');
    const hamburger = document.getElementById('hamburger-btn');

    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    hamburger.classList.toggle('active');
}

function closeMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('mobile-overlay');
    const hamburger = document.getElementById('hamburger-btn');

    sidebar.classList.remove('active');
    overlay.classList.remove('active');
    hamburger.classList.remove('active');
}

// ========================================
// 初始化
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    // 汉堡菜单
    document.getElementById('hamburger-btn')?.addEventListener('click', toggleMobileMenu);
    document.getElementById('mobile-overlay')?.addEventListener('click', closeMobileMenu);

    // 导航链接点击时关闭移动端菜单
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                closeMobileMenu();
            }
        });
    });

    // 检查是否已登录
    const savedToken = localStorage.getItem('sessionToken');
    if (savedToken) {
        sessionToken = savedToken;
        showMainPanel();
    }

    // 登录表单
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const password = document.getElementById('password').value;

            const btn = e.target.querySelector('button[type="submit"]');
            if (!btn) return;

            btn.querySelector('.btn-text').style.display = 'none';
            btn.querySelector('.btn-loading').style.display = 'inline';
            btn.disabled = true;

            const result = await login(password);

            btn.querySelector('.btn-text').style.display = 'inline';
            btn.querySelector('.btn-loading').style.display = 'none';
            btn.disabled = false;

            // 如果登录成功，阻止表单默认行为
            if (result) {
                e.preventDefault();
            }
        });
    }

    // 登出按钮
    document.getElementById('logout-btn').addEventListener('click', logout);

    // 导航链接
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.target.closest('.nav-link').dataset.page;
            navigateTo(page);
        });
    });

    // 创建密钥
    const createKeyBtn = document.getElementById('create-key-btn');
    if (createKeyBtn) createKeyBtn.addEventListener('click', showCreateKeyForm);
    const newKeyForm = document.getElementById('new-key-form');
    if (newKeyForm) newKeyForm.addEventListener('submit', createKey);

    // 日志相关
    const logsFilterForm = document.getElementById('logs-filter-form');
    if (logsFilterForm) {
        logsFilterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            logsOffset = 0;
            loadLogs();
        });
    }

    // 统计相关
    const statsFilterForm = document.getElementById('stats-filter-form');
    if (statsFilterForm) {
        statsFilterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            loadStatistics();
        });
    }

    // 限流配置
    const rateLimitForm = document.getElementById('rate-limit-form');
    if (rateLimitForm) rateLimitForm.addEventListener('submit', saveRateLimit);

    // 修改密码
    const adminPasswordForm = document.getElementById('admin-password-form');
    if (adminPasswordForm) adminPasswordForm.addEventListener('submit', changeAdminPassword);

    // 编辑密钥表单
    const editKeyForm = document.getElementById('edit-key-form');
    if (editKeyForm) editKeyForm.addEventListener('submit', updateKey);
});

// ========================================
// 数据清理功能
// ========================================

function showCleanupLogsModal() {
    const modal = document.getElementById('cleanup-logs-modal');
    if (modal) {
        modal.style.display = 'block';
        // 确保模态框在最上层
        modal.style.zIndex = '9999';
    } else {
        console.error('cleanup-logs-modal not found');
    }
    // 清空表单
    document.getElementById('cleanup-key-id').value = '';
    document.getElementById('cleanup-model').value = '';
    document.getElementById('cleanup-start-date').value = '';
    document.getElementById('cleanup-end-date').value = '';
    document.getElementById('cleanup-status').value = '';
}

function closeCleanupLogsModal() {
    document.getElementById('cleanup-logs-modal').style.display = 'none';
}

function showCleanupStatsModal() {
    const modal = document.getElementById('cleanup-stats-modal');
    if (modal) {
        modal.style.display = 'block';
        modal.style.zIndex = '9999';
    }
    // 清空表单
    document.getElementById('cleanup-stats-key-id').value = '';
    document.getElementById('cleanup-stats-start-date').value = '';
    document.getElementById('cleanup-stats-end-date').value = '';
}

function closeCleanupStatsModal() {
    document.getElementById('cleanup-stats-modal').style.display = 'none';
}

async function cleanupLogs(event) {
    event.preventDefault();

    const keyId = document.getElementById('cleanup-key-id').value.trim();
    const model = document.getElementById('cleanup-model').value.trim();
    const startDate = document.getElementById('cleanup-start-date').value;
    const endDate = document.getElementById('cleanup-end-date').value;
    const statusFilter = document.getElementById('cleanup-status').value;

    if (!keyId && !model && !startDate && !endDate && !statusFilter) {
        if (!confirm('⚠️ 警告：您即将清理所有请求日志，此操作不可恢复！\n\n确定要继续吗？')) {
            return;
        }
    } else {
        let summary = '确认清理以下条件：\n';
        if (keyId) summary += `- 密钥: ${keyId}\n`;
        if (model) summary += `- 模型: ${model}\n`;
        if (startDate) summary += `- 起始日期: ${startDate}\n`;
        if (endDate) summary += `- 结束日期: ${endDate}\n`;
        if (statusFilter) summary += `- 状态过滤: ${statusFilter}\n`;
        if (!confirm(summary + '\n此操作不可恢复，确定继续吗？')) {
            return;
        }
    }

    try {
        const params = new URLSearchParams();
        if (keyId) params.append('key_id', keyId);
        if (model) params.append('model', model);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        if (statusFilter) params.append('status_filter', statusFilter);

        const result = await apiRequest(`cleanup/logs?${params.toString()}`, 'POST');
        if (result) {
            showToast(`成功清理 ${result.deleted_count} 条日志记录`);
            closeCleanupLogsModal();
            loadLogs(); // 刷新日志列表
        }
    } catch (error) {
        showToast(`清理失败: ${error.message}`, 'error');
    }
}

async function cleanupStats(event) {
    event.preventDefault();

    const keyId = document.getElementById('cleanup-stats-key-id').value.trim();
    const startDate = document.getElementById('cleanup-stats-start-date').value;
    const endDate = document.getElementById('cleanup-stats-end-date').value;

    if (!keyId && !startDate && !endDate) {
        if (!confirm('⚠️ 警告：您即将清理所有统计数据，此操作不可恢复！\n\n确定要继续吗？')) {
            return;
        }
    } else {
        let summary = '确认清理以下条件：\n';
        if (keyId) summary += `- 密钥: ${keyId}\n`;
        if (startDate) summary += `- 起始日期: ${startDate}\n`;
        if (endDate) summary += `- 结束日期: ${endDate}\n`;
        if (!confirm(summary + '\n此操作不可恢复，确定继续吗？')) {
            return;
        }
    }

    try {
        const params = new URLSearchParams();
        if (keyId) params.append('key_id', keyId);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);

        const result = await apiRequest(`cleanup/statistics?${params.toString()}`, 'POST');
        if (result) {
            showToast(`成功清理 ${result.deleted_count} 条统计记录`);
            closeCleanupStatsModal();
            loadStatistics(); // 刷新统计数据
        }
    } catch (error) {
        showToast(`清理失败: ${error.message}`, 'error');
    }
}

async function cleanupInactiveKeys() {
    if (!confirm('确定要删除所有禁用的密钥吗？此操作不可恢复。')) {
        return;
    }

    try {
        const result = await apiRequest('cleanup/inactive-keys', 'POST');
        if (result) {
            showToast(result.deleted_count > 0
                ? `成功删除 ${result.deleted_count} 个禁用密钥`
                : '没有禁用的密钥需要删除');
            loadKeys(); // 刷新密钥列表
        }
    } catch (error) {
        showToast(`清理失败: ${error.message}`, 'error');
    }
}

async function cleanupOrphanLogs() {
    if (!confirm('确定要清理孤立的日志记录吗？\n\n孤立日志指密钥已被删除但仍存在的日志记录。')) {
        return;
    }

    try {
        const result = await apiRequest('cleanup/orphan-logs', 'POST');
        if (result) {
            showToast(result.deleted_count > 0
                ? `成功清理 ${result.deleted_count} 条孤立日志`
                : '没有孤立日志需要清理');
            loadLogs(); // 刷新日志列表
        }
    } catch (error) {
        showToast(`清理失败: ${error.message}`, 'error');
    }
}

// 在DOMContentLoaded中添加表单事件绑定
document.addEventListener('DOMContentLoaded', () => {
    // 清理日志表单
    const logsForm = document.getElementById('cleanup-logs-form');
    if (logsForm) {
        logsForm.addEventListener('submit', cleanupLogs);
    }

    // 清理统计表单
    const statsForm = document.getElementById('cleanup-stats-form');
    if (statsForm) {
        statsForm.addEventListener('submit', cleanupStats);
    }
});