/**
 * 秋招投递追踪 - API 版本
 */

const API_BASE = '/api';
const TOKEN_KEY = 'qiuzhao_token';

const STATUS_OPTIONS = ['待投递', '已投递', '笔试中', '面试中', '已offer', '已拒信', '流程结束'];
const EVENT_OPTIONS = ['笔试', '一面', '二面', '三面', 'HR面', 'OC/谈薪'];

// 状态
let applications = [];
let charts = {};
let currentUser = null;
let authToken = localStorage.getItem(TOKEN_KEY);

// DOM 元素
document.addEventListener('DOMContentLoaded', () => {
    initAuthUI();
    initNavigation();
    initForm();
    initListFilters();
    initSettings();
    initTheme();
    requestNotificationPermission();

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDetailModal();
        }
    });

    if (authToken) {
        validateToken();
    }
});

// ---------------- API 工具 ----------------

async function api(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    try {
        const res = await fetch(url, { ...options, headers });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            if (res.status === 401) {
                logout();
                throw new Error('登录已过期，请重新登录');
            }
            throw new Error(data.message || `请求失败: ${res.status}`);
        }
        return data;
    } catch (err) {
        if (err.message.includes('Failed to fetch')) {
            throw new Error('无法连接服务器，请确认后端已启动');
        }
        throw err;
    }
}

// ---------------- 认证 ----------------

function initAuthUI() {
    const authContainer = document.getElementById('authContainer');
    const appContainer = document.getElementById('appContainer');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const tabs = document.querySelectorAll('.auth-tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const auth = tab.dataset.auth;
            if (auth === 'login') {
                loginForm.classList.remove('hidden');
                registerForm.classList.add('hidden');
            } else {
                loginForm.classList.add('hidden');
                registerForm.classList.remove('hidden');
            }
        });
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        await login(username, password);
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('registerUsername').value.trim();
        const password = document.getElementById('registerPassword').value;
        await register(username, password);
    });

    document.getElementById('logoutBtn').addEventListener('click', logout);
}

async function register(username, password) {
    try {
        const data = await api('/register', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        setAuth(data.token, data.user);
        showToast('注册成功', 'success');
        showApp();
        await loadApplications();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function login(username, password) {
    try {
        const data = await api('/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        setAuth(data.token, data.user);
        showToast('登录成功', 'success');
        showApp();
        await loadApplications();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function setAuth(token, user) {
    authToken = token;
    currentUser = user;
    localStorage.setItem(TOKEN_KEY, token);
}

async function validateToken() {
    try {
        const user = await api('/me');
        currentUser = user;
        showApp();
        await loadApplications();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    applications = [];
    localStorage.removeItem(TOKEN_KEY);
    showAuth();
}

function showApp() {
    document.getElementById('authContainer').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');
    document.getElementById('currentUserName').textContent = currentUser ? currentUser.username : '未登录';
}

function showAuth() {
    document.getElementById('authContainer').classList.remove('hidden');
    document.getElementById('appContainer').classList.add('hidden');
}

// ---------------- 应用数据 ----------------

async function loadApplications() {
    try {
        applications = await api('/applications');
        renderAll();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ---------------- 导航 ----------------

function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.dataset.view;
            switchView(view);
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
        });
    });

    document.querySelectorAll('.btn-text[data-view]').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            switchView(view);
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.querySelector(`.nav-item[data-view="${view}"]`)?.classList.add('active');
        });
    });
}

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(`view-${viewName}`).classList.remove('hidden');

    const titles = {
        dashboard: '概览',
        add: '新增投递',
        list: '投递列表',
        stats: '数据可视化',
        settings: '设置'
    };
    document.getElementById('pageTitle').textContent = titles[viewName] || '';

    if (viewName === 'stats') {
        renderCharts();
    }
}

// ---------------- 表单 ----------------

function initForm() {
    const form = document.getElementById('applicationForm');
    form.addEventListener('submit', handleSubmit);
    document.getElementById('resetFormBtn').addEventListener('click', resetForm);
    document.getElementById('applyDate').valueAsDate = new Date();
}

async function handleSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('appId').value;
    const appData = {
        company: document.getElementById('companyName').value.trim(),
        position: document.getElementById('position').value.trim(),
        jobType: document.getElementById('jobType').value,
        city: document.getElementById('city').value.trim(),
        applyDate: document.getElementById('applyDate').value,
        status: document.getElementById('status').value,
        nextEvent: document.getElementById('nextEvent').value,
        nextDate: document.getElementById('nextDate').value,
        remark: document.getElementById('remark').value.trim(),
        logoUrl: ''
    };

    if (!appData.company || !appData.position || !appData.applyDate || !appData.status) {
        showToast('请填写必填项', 'error');
        return;
    }

    try {
        if (id) {
            await api(`/applications/${id}`, {
                method: 'PUT',
                body: JSON.stringify(appData)
            });
            showToast('更新成功', 'success');
        } else {
            await api('/applications', {
                method: 'POST',
                body: JSON.stringify(appData)
            });
            showToast('添加成功', 'success');
        }
        resetForm();
        await loadApplications();
        switchView('dashboard');
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelector('.nav-item[data-view="dashboard"]').classList.add('active');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function resetForm() {
    document.getElementById('applicationForm').reset();
    document.getElementById('appId').value = '';
    document.getElementById('applyDate').valueAsDate = new Date();
}

function editApplication(id) {
    const app = applications.find(a => a.id === id);
    if (!app) return;

    document.getElementById('appId').value = app.id;
    document.getElementById('companyName').value = app.company;
    document.getElementById('position').value = app.position;
    document.getElementById('jobType').value = app.jobType;
    document.getElementById('city').value = app.city;
    document.getElementById('applyDate').value = app.applyDate;
    document.getElementById('status').value = app.status;
    document.getElementById('nextEvent').value = app.nextEvent;
    document.getElementById('nextDate').value = app.nextDate;
    document.getElementById('remark').value = app.remark;

    switchView('add');
    document.getElementById('pageTitle').textContent = '编辑投递';
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
}

async function deleteApplication(id) {
    if (!confirm('确定要删除这条投递记录吗？')) return;
    try {
        await api(`/applications/${id}`, { method: 'DELETE' });
        await loadApplications();
        showToast('删除成功', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ---------------- Logo 加载 ----------------

function getLogoUrl(company) {
    const domainMap = {
        '字节跳动': 'bytedance.com',
        '抖音': 'douyin.com',
        '今日头条': 'toutiao.com',
        '腾讯': 'tencent.com',
        '微信': 'wechat.com',
        '阿里巴巴': 'alibaba.com',
        '淘宝': 'taobao.com',
        '天猫': 'tmall.com',
        '蚂蚁集团': 'antgroup.com',
        '支付宝': 'alipay.com',
        '美团': 'meituan.com',
        '京东': 'jd.com',
        '拼多多': 'pinduoduo.com',
        '百度': 'baidu.com',
        '快手': 'kuaishou.com',
        '网易': '163.com',
        '哔哩哔哩': 'bilibili.com',
        '小米': 'mi.com',
        '华为': 'huawei.com',
        '滴滴': 'didiglobal.com',
        '携程': 'trip.com',
        '蔚来': 'nio.com',
        '理想汽车': 'lixiang.com',
        '小鹏汽车': 'xiaopeng.com',
        '小红书': 'xiaohongshu.com',
        '知乎': 'zhihu.com',
        '微博': 'weibo.com',
        '顺丰': 'sf-express.com',
        '招商银行': 'cmbchina.com',
        '平安': 'pingan.com',
        '华为海思': 'huawei.com',
        '海康威视': 'hikvision.com',
        '大疆': 'dji.com',
        '大疆dji': 'dji.com',
        '大疆车载': 'dji.com',
        '卓驭': 'zhuoyutech.com',
        '寻影': 'obsbot.com',
        '普渡科技': 'pudutech.com',
        '拓竹': 'bambulab.com',
        'oppo': 'oppo.com',
        '小鹏': 'xiaopeng.com',
        '小鹏汽车': 'xiaopeng.com',
        'insta360': 'insta360.com',
        '影石': 'insta360.com',
        '禾赛科技': 'hesaitech.com',
        '新凯来': 'sicarrier.com',
        '恒玄科技': 'besaudio.com',
        '星宸科技': 'sigmastar.com.tw',
        '全志科技': 'allwinnertech.com',
        '优必选': 'ubtrobot.com',
        '云鲸智能': 'narwal.com',
        '地平线': 'horizon.auto',
        '大华股份': 'dahuatech.com',
        '追觅科技': 'dreame.tech',
        '涂鸦智能': 'tuya.com',
        '智元机器人': 'agibot.com',
        '越疆科技': 'dobot.cc',
        'byd': 'byd.com',
        '比亚迪': 'byd.com'
    };

    const domain = domainMap[company];
    if (domain) {
        return `https://logo.clearbit.com/${domain}`;
    }

    const normalized = company.toLowerCase()
        .replace(/[（(].*?[)）]/g, '')
        .replace(/[\s\.]/g, '')
        .replace(/公司|集团|科技|网络|信息|技术|有限/g, '');
    if (normalized) {
        return `https://logo.clearbit.com/${normalized}.com`;
    }
    return '';
}

function renderLogo(img, company) {
    if (!img) return;
    const url = getLogoUrl(company);
    if (!url) {
        img.style.display = 'none';
        showFallback(img.parentElement, company);
        return;
    }

    img.src = url;
    img.style.display = 'block';
    img.onerror = () => {
        img.style.display = 'none';
        showFallback(img.parentElement, company);
    };
    img.onload = () => {
        const fallback = img.parentElement.querySelector('.logo-fallback');
        if (fallback) fallback.remove();
    };
}

function showFallback(container, company) {
    if (!container.querySelector('.logo-fallback')) {
        const el = document.createElement('div');
        el.className = 'logo-fallback';
        el.textContent = company.slice(0, 1);
        container.appendChild(el);
    }
}

// ---------------- 渲染 ----------------

function renderAll() {
    renderStats();
    renderRecentList();
    renderSchedule();
    renderTable();
    renderSidebarTodo();
    setTodayDate();
    checkTodayNotifications();
}

function renderStats() {
    const total = applications.length;
    const pending = applications.filter(a => a.status === '待投递').length;
    const written = applications.filter(a => a.status === '笔试中').length;
    const interview = applications.filter(a => a.status === '面试中').length;
    const offer = applications.filter(a => a.status === '已offer').length;
    const reject = applications.filter(a => a.status === '已拒信').length;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statPending').textContent = pending;
    document.getElementById('statWritten').textContent = written;
    document.getElementById('statInterview').textContent = interview;
    document.getElementById('statOffer').textContent = offer;
    document.getElementById('statReject').textContent = reject;

    document.getElementById('totalCountMini').textContent = total;
    document.getElementById('interviewCountMini').textContent = interview;
}

function renderRecentList() {
    const container = document.getElementById('recentList');
    if (applications.length === 0) {
        container.innerHTML = '<p class="empty-tip">还没有投递记录，点击左侧「新增投递」开始记录吧</p>';
        return;
    }

    const recent = [...applications].sort((a, b) => parseLocalDate(b.applyDate) - parseLocalDate(a.applyDate)).slice(0, 5);
    container.innerHTML = recent.map(app => `
        <div class="application-card">
            <div style="position:relative">
                <img class="company-logo" alt="${app.company}" data-company="${app.company}">
            </div>
            <div class="card-info">
                <h3>${escapeHtml(app.company)} · ${escapeHtml(app.position)}</h3>
                <p>${escapeHtml(app.jobType)} ${app.city ? '· ' + escapeHtml(app.city) : ''} · ${escapeHtml(app.username || '未知用户')}</p>
            </div>
            <div class="card-meta">
                <span class="status-badge status-${app.status}">${app.status}</span>
                <span class="card-date">${app.applyDate}</span>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.company-logo').forEach(img => {
        renderLogo(img, img.dataset.company);
    });
}

function renderSchedule() {
    const container = document.getElementById('scheduleList');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = applications
        .filter(a => a.nextEvent && a.nextDate)
        .map(a => {
            const d = parseLocalDate(a.nextDate);
            return { ...a, eventTime: d ? d.getTime() : 0 };
        })
        .filter(a => a.eventTime >= today.getTime() - 86400000)
        .sort((a, b) => a.eventTime - b.eventTime);

    if (upcoming.length === 0) {
        container.innerHTML = '<p class="empty-tip">暂无 upcoming 的笔试或面试</p>';
        return;
    }

    container.innerHTML = upcoming.map(app => {
        const date = parseLocalDate(app.nextDate);
        const isToday = date && date.getTime() === today.getTime();
        const month = date ? date.getMonth() + 1 : '';
        const day = date ? date.getDate() : '';

        return `
            <div class="schedule-item">
                <div class="schedule-date">
                    <span class="day">${day}</span>
                    <span class="month">${month}月</span>
                </div>
                <div class="schedule-info">
                    <h4>${escapeHtml(app.company)} · ${escapeHtml(app.position)}</h4>
                    <p>${escapeHtml(app.city || '')} · ${escapeHtml(app.username || '未知用户')}</p>
                </div>
                <span class="schedule-tag ${getEventTagClass(app.nextEvent, isToday)}">${isToday ? '今日' : app.nextEvent}</span>
            </div>
        `;
    }).join('');
}

function renderSidebarTodo() {
    const container = document.getElementById('sidebarTodoList');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayEvents = applications
        .filter(a => a.nextEvent && a.nextDate)
        .filter(a => {
            const d = parseLocalDate(a.nextDate);
            return d && d.getTime() === today.getTime();
        })
        .sort((a, b) => a.nextEvent.localeCompare(b.nextEvent));

    if (todayEvents.length === 0) {
        container.innerHTML = '<p class="empty-tip">暂无今日事项</p>';
        return;
    }

    container.innerHTML = todayEvents.map(app => `
        <div class="todo-item">
            <span class="todo-dot"></span>
            <div>
                <div>${escapeHtml(app.company)}</div>
                <div class="todo-time">${app.nextEvent} · ${escapeHtml(app.username || '未知用户')}</div>
            </div>
        </div>
    `).join('');
}

function renderTable() {
    const tbody = document.getElementById('applicationTableBody');
    const search = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatus').value;

    const filtered = applications.filter(app => {
        const matchSearch = !search ||
            app.company.toLowerCase().includes(search) ||
            app.position.toLowerCase().includes(search);
        const matchStatus = !statusFilter || app.status === statusFilter;
        return matchSearch && matchStatus;
    }).sort((a, b) => parseLocalDate(b.applyDate) - parseLocalDate(a.applyDate));

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="empty-tip">没有找到匹配的记录</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(app => {
        const isOwner = currentUser && String(app.userId) === String(currentUser.id);
        return `
            <tr>
                <td>
                    <div class="company-cell">
                        <div style="position:relative">
                            <img class="company-logo" alt="${app.company}" data-company="${app.company}">
                        </div>
                        <span>${escapeHtml(app.company)}</span>
                    </div>
                </td>
                <td>${escapeHtml(app.position)}</td>
                <td>${escapeHtml(app.jobType)}</td>
                <td>${escapeHtml(app.city || '-')}</td>
                <td>${app.applyDate}</td>
                <td><span class="status-badge status-${app.status}">${app.status}</span></td>
                <td>${app.nextEvent ? app.nextEvent + ' ' + app.nextDate : '-'}</td>
                <td>${escapeHtml(app.username || '-')}</td>
                <td>
                    <div class="actions">
                        <button class="btn btn-secondary btn-sm" onclick="openDetailModal('${app.id}')">详情</button>
                        ${isOwner ? `<button class="btn btn-secondary btn-sm" onclick="editApplication('${app.id}')">编辑</button>` : ''}
                        ${isOwner ? `<button class="btn btn-danger btn-sm" onclick="deleteApplication('${app.id}')">删除</button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('.company-logo').forEach(img => {
        renderLogo(img, img.dataset.company);
    });
}

// ---------------- 列表筛选 ----------------

function initListFilters() {
    document.getElementById('searchInput').addEventListener('input', renderTable);
    document.getElementById('filterStatus').addEventListener('change', renderTable);
}

// ---------------- 图表 ----------------

function renderCharts() {
    const statusCounts = {};
    STATUS_OPTIONS.forEach(s => statusCounts[s] = 0);
    applications.forEach(a => statusCounts[a.status]++);

    const typeCounts = {};
    applications.forEach(a => typeCounts[a.jobType] = (typeCounts[a.jobType] || 0) + 1);

    const cityCounts = {};
    applications.forEach(a => {
        if (a.city) cityCounts[a.city] = (cityCounts[a.city] || 0) + 1;
    });
    const cityEntries = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

    const today = new Date();
    const trendMap = {};
    for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = formatLocalDate(d);
        trendMap[key] = 0;
    }
    applications.forEach(a => {
        if (trendMap[a.applyDate] !== undefined) trendMap[a.applyDate]++;
    });

    const statusColors = {
        '待投递': '#f97316',
        '已投递': '#3b82f6',
        '笔试中': '#f59e0b',
        '面试中': '#10b981',
        '已offer': '#ef4444',
        '已拒信': '#6b7280',
        '流程结束': '#8b5cf6'
    };

    destroyCharts();

    charts.status = new Chart(document.getElementById('statusChart'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: Object.keys(statusCounts).map(k => statusColors[k]),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' }
            }
        }
    });

    charts.trend = new Chart(document.getElementById('trendChart'), {
        type: 'line',
        data: {
            labels: Object.keys(trendMap).map(d => d.slice(5)),
            datasets: [{
                label: '投递数',
                data: Object.values(trendMap),
                borderColor: '#4f46e5',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
        }
    });

    charts.type = new Chart(document.getElementById('typeChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(typeCounts),
            datasets: [{
                label: '岗位数',
                data: Object.values(typeCounts),
                backgroundColor: '#0ea5e9'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });

    charts.city = new Chart(document.getElementById('cityChart'), {
        type: 'bar',
        data: {
            labels: cityEntries.map(e => e[0]),
            datasets: [{
                label: '投递数',
                data: cityEntries.map(e => e[1]),
                backgroundColor: '#8b5cf6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

function destroyCharts() {
    Object.values(charts).forEach(chart => chart?.destroy?.());
    charts = {};
}

// ---------------- 详情弹窗 ----------------

async function openDetailModal(appId) {
    const app = applications.find(a => a.id === appId);
    if (!app) return;

    document.getElementById('detailTitle').textContent = `${app.company} · ${app.position}`;
    document.getElementById('detailInfo').innerHTML = `
        <div class="detail-item"><span class="detail-label">公司</span><span class="detail-value">${escapeHtml(app.company)}</span></div>
        <div class="detail-item"><span class="detail-label">岗位</span><span class="detail-value">${escapeHtml(app.position)}</span></div>
        <div class="detail-item"><span class="detail-label">类型</span><span class="detail-value">${escapeHtml(app.jobType)}</span></div>
        <div class="detail-item"><span class="detail-label">城市</span><span class="detail-value">${escapeHtml(app.city || '-')}</span></div>
        <div class="detail-item"><span class="detail-label">投递日期</span><span class="detail-value">${app.applyDate}</span></div>
        <div class="detail-item"><span class="detail-label">当前进度</span><span class="detail-value"><span class="status-badge status-${app.status}">${app.status}</span></span></div>
        <div class="detail-item"><span class="detail-label">下一步</span><span class="detail-value">${app.nextEvent ? app.nextEvent + ' ' + app.nextDate : '-'}</span></div>
        <div class="detail-item"><span class="detail-label">创建者</span><span class="detail-value">${escapeHtml(app.username || '-')}</span></div>
        <div class="detail-item" style="grid-column: 1 / -1"><span class="detail-label">备注</span><span class="detail-value">${escapeHtml(app.remark || '-')}</span></div>
    `;

    const timelineContainer = document.getElementById('detailTimeline');
    timelineContainer.innerHTML = '<p class="empty-tip">加载中...</p>';
    document.getElementById('detailModal').classList.remove('hidden');

    try {
        const histories = await api(`/applications/${appId}/history`);
        if (histories.length === 0) {
            timelineContainer.innerHTML = '<p class="empty-tip">暂无历史记录</p>';
        } else {
            timelineContainer.innerHTML = histories.map(h => {
                const time = new Date(h.createdAt).toLocaleString('zh-CN');
                let content = '';
                if (h.field === 'status') {
                    content = `进度从 <span class="status-badge status-${h.oldValue || '待投递'}">${h.oldValue || '无'}</span> 变为 <span class="status-badge status-${h.newValue}">${h.newValue}</span>`;
                } else if (h.field === 'nextEvent') {
                    content = `下一步事件从「${h.oldValue || '无'}」变为「${h.newValue || '无'}」`;
                } else {
                    content = `${h.field} 变更`;
                }
                return `
                    <div class="timeline-item">
                        <div class="timeline-time">${time} · ${escapeHtml(h.username || '未知用户')}</div>
                        <div class="timeline-content">${content}</div>
                        ${h.note ? `<div class="timeline-note">${escapeHtml(h.note)}</div>` : ''}
                    </div>
                `;
            }).join('');
        }
    } catch (err) {
        timelineContainer.innerHTML = `<p class="empty-tip">加载失败：${escapeHtml(err.message)}</p>`;
    }
}

function closeDetailModal() {
    document.getElementById('detailModal').classList.add('hidden');
}

// ---------------- 深色模式 ----------------

const THEME_KEY = 'qiuzhao_theme';

function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const isDark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setTheme(isDark);

    document.getElementById('themeToggle').addEventListener('click', () => {
        const currentlyDark = document.body.classList.contains('dark');
        setTheme(!currentlyDark);
    });
}

function setTheme(isDark) {
    if (isDark) {
        document.body.classList.add('dark');
        document.getElementById('themeIcon').textContent = '☀️';
        document.getElementById('themeText').textContent = '浅色模式';
    } else {
        document.body.classList.remove('dark');
        document.getElementById('themeIcon').textContent = '🌙';
        document.getElementById('themeText').textContent = '深色模式';
    }
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
}

// ---------------- 浏览器通知 ----------------

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function checkTodayNotifications() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayEvents = applications.filter(a => {
        if (!a.nextEvent || !a.nextDate) return false;
        const d = parseLocalDate(a.nextDate);
        return d && d.getTime() === today.getTime();
    });

    if (todayEvents.length === 0) return;

    const notifiedKey = `qiuzhao_notified_${formatLocalDate(today)}`;
    if (localStorage.getItem(notifiedKey)) return;

    const title = `今日有 ${todayEvents.length} 个秋招事项`;
    const body = todayEvents.map(a => `${a.company} · ${a.nextEvent}`).join('，');
    new Notification(title, { body, icon: '/favicon.ico' });

    localStorage.setItem(notifiedKey, '1');
}

// ---------------- 设置 ----------------

function initSettings() {
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('exportBtn2').addEventListener('click', exportData);
    document.getElementById('importFile').addEventListener('change', importData);
    document.getElementById('importFile2').addEventListener('change', importData);
    document.getElementById('clearAllBtn').addEventListener('click', clearAllData);
    document.getElementById('notifyBtn').addEventListener('click', async () => {
        if (!('Notification' in window)) {
            showToast('当前浏览器不支持通知', 'error');
            return;
        }
        const result = await Notification.requestPermission();
        if (result === 'granted') {
            showToast('通知已开启', 'success');
            checkTodayNotifications();
        } else {
            showToast('通知权限被拒绝', 'error');
        }
    });
}

function exportData() {
    const blob = new Blob([JSON.stringify(applications, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qiuzhao-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('备份已导出', 'success');
}

async function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (!Array.isArray(data)) throw new Error('格式错误');
            const res = await api('/seed', {
                method: 'POST',
                body: JSON.stringify({ data })
            });
            await loadApplications();
            showToast(res.message, 'success');
        } catch (err) {
            showToast('导入失败：' + err.message, 'error');
        }
        e.target.value = '';
    };
    reader.readAsText(file);
}

async function clearAllData() {
    if (!confirm('确定要清空所有投递记录吗？此操作不可恢复。')) return;
    try {
        for (const app of [...applications]) {
            await api(`/applications/${app.id}`, { method: 'DELETE' });
        }
        await loadApplications();
        showToast('数据已清空', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ---------------- 工具函数 ----------------

function generateId() {
    return 'app-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function getEventTagClass(event, isToday) {
    if (isToday) return 'tag-today';
    if (event === '笔试') return 'tag-written';
    if (event === 'HR面') return 'tag-hr';
    if (event === 'OC/谈薪') return 'tag-offer';
    if (['一面', '二面', '三面'].includes(event)) return 'tag-interview';
    return 'tag-interview';
}

function parseLocalDate(dateStr) {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
}

function formatLocalDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function setTodayDate() {
    const d = new Date();
    const str = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    document.getElementById('todayDate').textContent = str;
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}
