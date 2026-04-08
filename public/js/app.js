// app.js — OpenClaw Dashboard v3 (unified memory)
const BASE = 'data/';
const DATA_URL = BASE + 'data.json?_=' + Date.now();
let ALL_DATA = null;
let memoryFilter = 'all';

// ── Util ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const esc = s => s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function chip(label, value) {
  return `<span class="stat-chip"><span>${value}</span> ${label}</span>`;
}

function sourceLabel(s) {
  return { twse:'台股', notes:'notes', memory:'session', obsidian:'Obsidian', project:'專案' }[s] || s;
}

function progressBar(pct) {
  const c = pct >= 80 ? 'green' : pct >= 40 ? 'yellow' : 'red';
  return `<div class="progress-wrap">
    <div class="progress-bar"><div class="progress-fill ${c}" style="width:${pct}%"></div></div>
    <span class="progress-pct">${pct}%</span>
  </div>`;
}

function tagsHTML(tags, source) {
  if (!tags || !tags.length) return '';
  return `<div class="tags">${tags.map(t => {
    const cls = source === 'twse' ? 'twse' : source === 'memory' ? 'memory' : source === 'obsidian' ? 'obsidian' : '';
    return `<span class="tag ${cls}">#${esc(t)}</span>`;
  }).join('')}</div>`;
}

// ── Tab Switching ────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    $('graph-section').classList.toggle('active', btn.dataset.tab === 'graph-section');
    $(btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'graph-section' && ALL_DATA) renderGraph(ALL_DATA);
  });
});

// ── Memory Filter ──────────────────────────────────────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    memoryFilter = btn.dataset.filter;
    renderMemory(ALL_DATA);
  });
});

// ── Load & Render ──────────────────────────────────────────────────────────
async function loadData() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (e) {
    console.error('Load data.json failed:', e);
    return null;
  }
}

function render() {
  if (!ALL_DATA) return;
  $('last-updated').textContent = new Date(ALL_DATA.meta.generated).toLocaleString('zh-TW');
  renderProjects(ALL_DATA.projects || []);
  renderFiles(ALL_DATA.files || []);
  renderMemory(ALL_DATA);
  renderJobs(ALL_DATA.jobs || {});
}

async function init() {
  ALL_DATA = await loadData();
  render();
}

// ── Projects ───────────────────────────────────────────────────────────────
function renderProjects(items) {
  const stats = $('projects-stats');
  stats.innerHTML = `${chip('總數', items.length)}${chip('進行中', items.filter(p=>p.status==='active').length)}${chip('已完成', items.filter(p=>p.status==='completed').length)}`;
  const grid = $('projects-grid');
  if (!items.length) { grid.innerHTML = '<p class="empty">尚無專案</p>'; return; }
  grid.innerHTML = items.map(p => `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${esc(p.title)}</div>
        <span class="status ${esc(p.status)}">${p.status==='completed'?'已完成':'進行中'}</span>
      </div>
      ${p.description ? `<div class="desc">${esc(p.description)}</div>` : ''}
      ${p.progress !== undefined ? progressBar(p.progress) : ''}
      ${tagsHTML(p.tags)}
      ${p.completed && p.completed.length ? `<div class="list-label">已完成</div>${p.completed.map(c=>`<div class="list-item">${esc(c)}</div>`).join('')}` : ''}
      ${p.pending && p.pending.length ? `<div class="list-label">待完成</div>${p.pending.map(c=>`<div class="list-item">${esc(c)}</div>`).join('')}` : ''}
      <div class="card-meta">更新：${p.lastUpdated || ''}</div>
    </div>
  `).join('');
}

// ── Files ─────────────────────────────────────────────────────────────────
function renderFiles(items) {
  $('files-stats').innerHTML = chip('總數', items.length);
  const grid = $('files-grid');
  if (!items.length) { grid.innerHTML = '<p class="empty">尚無檔案</p>'; return; }
  grid.innerHTML = items.map(f => `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${esc(f.title)}</div>
        <span class="status ${esc(f.status)}">${esc(f.status)}</span>
      </div>
      ${f.description ? `<div class="desc">${esc(f.description.slice(0,100))}</div>` : ''}
      ${f.path ? `<div class="card-meta" style="word-break:break-all;font-size:11px">${esc(f.path)}</div>` : ''}
      ${tagsHTML(f.tags)}
      ${f.progress !== null ? progressBar(f.progress) : ''}
      <div class="card-meta">更新：${f.lastUpdated || ''}</div>
    </div>
  `).join('');
}

// ── Memory ─────────────────────────────────────────────────────────────────
function renderMemory(data) {
  const all = data.memory || [];
  const filtered = memoryFilter === 'all' ? all : all.filter(m => m.source === memoryFilter);

  $('memory-stats').innerHTML =
    chip('全部', all.length) +
    (all.filter(m=>m.source==='twse').length ? chip('台股', all.filter(m=>m.source==='twse').length) : '') +
    (all.filter(m=>m.source==='notes').length ? chip('notes', all.filter(m=>m.source==='notes').length) : '') +
    (all.filter(m=>m.source==='memory').length ? chip('session', all.filter(m=>m.source==='memory').length) : '') +
    (all.filter(m=>m.source==='obsidian').length ? chip('Obsidian', all.filter(m=>m.source==='obsidian').length) : '');

  const grid = $('memory-grid');
  if (!filtered.length) { grid.innerHTML = `<p class="empty">目前沒有 ${sourceLabel(memoryFilter)} 的記憶</p>`; return; }

  grid.innerHTML = filtered.map(m => `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${esc(m.title?.slice(0,40))}</div>
        <span class="source-badge ${esc(m.source)}">${sourceLabel(m.source)}</span>
      </div>
      ${m.stockId ? `<div class="stock-id">${esc(m.stockId)} ${esc(m.companyName||'')}</div>` : ''}
      ${m.description ? `<div class="desc">${esc(m.description.slice(0,100))}</div>` : ''}
      ${tagsHTML(m.tags, m.source)}
      ${m.connections && m.connections.length ? `<div class="card-meta">🔗 ${m.connections.length} 個關聯</div>` : ''}
      <div class="card-meta">${m.date || ''}${m.path ? ' · ' + esc(m.path.slice(0,40)) : ''}</div>
    </div>
  `).join('');
}

// ── Jobs ──────────────────────────────────────────────────────────────────
function openJobModal(job) {
  $('jm-name').textContent = job.name;
  $('jm-trigger').textContent = job.trigger;
  $('jm-next').textContent = job.nextRun || '—';
  $('jm-last').textContent = job.lastRun || '—';
  const histEl = $('jm-history');
  if (!job.history || !job.history.length) {
    histEl.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:20px">暫無執行記錄</div>';
  } else {
    histEl.innerHTML = job.history.map(h => `
      <div class="modal-hist-item">
        <div class="modal-hist-dot ${h.ok ? 'modal-hist-ok' : 'modal-hist-fail'}"></div>
        <div class="modal-hist-time">${esc(h.time || h.date || '')}</div>
        <div class="modal-hist-msg">${esc(h.message || h.desc || '')}</div>
      </div>
    `).join('');
  }
  $('job-modal').style.display = 'flex';
}

function closeJobModal() {
  $('job-modal').style.display = 'none';
}

document.getElementById('jm-close').addEventListener('click', closeJobModal);
document.querySelector('.modal-backdrop').addEventListener('click', closeJobModal);

function renderJobs(jobs) {
  const list = $('jobs-list');
  const items = jobs.items || [];
  if (!items.length) {
    list.innerHTML = '<p class="empty">目前沒有定時作業</p>';
    return;
  }
  list.innerHTML = items.map(job => `
    <div class="job-card" data-job-id="${esc(job.id)}">
      <div class="job-card-header">
        <div class="job-card-icon">${job.name.includes('Heartbeat') ? '❤️' : job.name.includes('GitHub') ? '🔄' : job.name.includes('Gateway') ? '🚀' : job.name.includes('語意') ? '🔍' : job.name.includes('季報') || job.name.includes('爬蟲') ? '📊' : '⏰'}</div>
        <div class="job-card-info">
          <div class="job-card-name">${esc(job.name)}</div>
          <div class="job-card-trigger">${esc(job.trigger)}</div>
        </div>
        <div class="job-card-next">
          <div class="job-card-next-label">下次</div>
          <div class="job-card-next-time">${esc(job.nextRun || '—')}</div>
        </div>
      </div>
      <div class="job-card-footer">
        <span class="job-card-badge ${job.status === 'running' ? 'badge-running' : job.status === 'active' ? 'badge-active' : 'badge-stopped'}">${job.status === 'running' ? '運行中' : job.status === 'active' ? 'active' : 'stopped'}</span>
        <span class="job-card-history-hint">點擊查看歷史</span>
      </div>
    </div>
  `).join('');

  // Click to open modal
  list.querySelectorAll('.job-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.jobId;
      const job = items.find(j => j.id === id);
      if (job) openJobModal(job);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────
//  D3.js Force-Directed Graph
// ─────────────────────────────────────────────────────────────────────────
let simulation = null;

function renderGraph(data) {
  const svg  = d3.select('#graph-canvas');
  const wrap = $('graph-wrap');
  const W = wrap.clientWidth  || 900;
  const H = wrap.clientHeight || 560;
  svg.attr('viewBox', `0 0 ${W} ${H}`).selectAll('*').remove();

  const nodeFilter = $('graph-node-filter').value;

  const graphSources = ['notes','memory','obsidian'];
  const graphNodes = [
    ...(data.projects || []).map(p => ({ ...p, nodeType: 'project' })),
    ...(data.memory  || []).filter(m => graphSources.includes(m.source) || m.nodeType).map(m => ({ ...m, nodeType: m.source }))
  ].filter(n => {
    if (n.nodeType === 'project') return true;
    if (nodeFilter === 'all') return true;
    return n.nodeType === nodeFilter;
  });

  const rels = (data.relationships || []).filter(r => {
    return graphNodes.find(n => n.id === r.from) && graphNodes.find(n => n.id === r.to);
  });

  $('graph-node-count').innerHTML = `節點: <span>${graphNodes.length}</span> · 連線: <span>${rels.length}</span>`;

  if (!graphNodes.length) return;

  const colorMap = { project:'#58a6ff', notes:'#d29922', memory:'#3fb950', obsidian:'#bc8cff' };
  const radiusMap = { project: 12, notes: 8, memory: 7, obsidian: 9 };

  const sim = d3.forceSimulation(graphNodes)
    .force('link', d3.forceLink(rels).id(d => d.id).distance(d => d.type === 'project-note' ? 70 : 100).strength(0.4))
    .force('charge', d3.forceManyBody().strength(-180))
    .force('center', d3.forceCenter(W/2, H/2))
    .force('collision', d3.forceCollide(d => (radiusMap[d.nodeType] || 8) + 12));

  svg.append('g').selectAll('line').data(rels).join('line')
    .attr('class', d => `link ${esc(d.type)}`)
    .attr('stroke-width', d => Math.sqrt(d.strength || 1));

  const g = svg.append('g').selectAll('g').data(graphNodes).join('g')
    .attr('class', 'node').call(drag(sim));

  g.append('circle').attr('r', d => radiusMap[d.nodeType] || 8).attr('fill', d => colorMap[d.nodeType] || '#8b949e');
  g.append('text').attr('dy', d => -(radiusMap[d.nodeType] || 8) - 4)
    .text(d => (d.title || d.id || '').slice(0,18));

  const tooltip = $('d3-tooltip');
  const info   = $('graph-info');

  g.on('mouseover', (event, d) => {
    tooltip.style.display = 'block';
    tooltip.innerHTML = `<b>${esc(d.title||d.id)}</b><br><span style="color:#8b949e">${sourceLabel(d.nodeType)}</span>`;
    $('gi-title').textContent = d.title || d.id;
    $('gi-type').textContent = sourceLabel(d.nodeType);
    $('gi-tags').innerHTML = tagsHTML(d.tags, d.nodeType);
    $('gi-desc').textContent = d.description ? d.description.slice(0,80) : '';
    info.classList.remove('hidden');
  })
  .on('mousemove', (event) => {
    tooltip.style.left = (event.clientX + 14) + 'px';
    tooltip.style.top  = (event.clientY - 40) + 'px';
  })
  .on('mouseout', () => {
    tooltip.style.display = 'none';
    info.classList.add('hidden');
  })
  .on('click', (event, d) => {
    memoryFilter = d.nodeType === 'project' ? 'all' : d.nodeType;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.filter-btn[data-filter="${memoryFilter}"]`);
    if (btn) btn.classList.add('active');
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.tab[data-tab="memory"]').classList.add('active');
    $('memory').classList.add('active');
    $('graph-section').classList.remove('active');
    renderMemory(ALL_DATA);
  });

  sim.on('tick', () => {
    svg.selectAll('line')
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    svg.selectAll('.node')
      .attr('transform', d => `translate(${Math.max(20,Math.min(W-20,d.x))},${Math.max(20,Math.min(H-20,d.y))})`);
  });

  simulation = sim;
  $('graph-node-filter').onchange = () => renderGraph(data);
}

function drag(sim) {
  return d3.drag()
    .on('start', (event,d) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; })
    .on('drag', (event,d) => { d.fx=event.x; d.fy=event.y; })
    .on('end', (event,d) => { if (!event.active) sim.alphaTarget(0); d.fx=null; d.fy=null; });
}

// ── Start ─────────────────────────────────────────────────────────────────
init();
