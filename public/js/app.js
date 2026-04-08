// ─────────────────────────────────────────────────────────
//  app.js — OpenClaw Dashboard
// ─────────────────────────────────────────────────────────

const BASE = 'data/';
const DATA_URL = BASE + 'data.json?_=' + Date.now();

let ALL_DATA = null;

// ── Util ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const esc = s => s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function pctColor(p) {
  if (p >= 80) return 'green';
  if (p >= 40) return 'yellow';
  return 'red';
}

function typeLabel(type) {
  return { project:'專案', memory:'記憶', research:'研究', file:'檔案' }[type] || type;
}

function statusLabel(s) {
  return { active:'進行中', planning:'規劃中', completed:'已完成', onhold:'擱置' }[s] || s;
}

function progressBar(pct, colorFn = pctColor) {
  const c = colorFn(pct);
  return `<div class="progress-wrap">
    <div class="progress-bar"><div class="progress-fill ${c}" style="width:${pct}%"></div></div>
    <span class="progress-pct">${pct}%</span>
  </div>`;
}

function tagsHTML(tags) {
  if (!tags || !tags.length) return '';
  return `<div class="tags">${tags.map(t => `<span class="tag">#${esc(t)}</span>`).join('')}</div>`;
}

function chip(label, value) {
  return `<span class="stat-chip"><span>${value}</span> ${label}</span>`;
}

// ── Tab Switching ──────────────────────────────────────────
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

// ── Load Data ─────────────────────────────────────────────
async function loadData() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (e) {
    console.error('Failed to load data.json:', e);
    return null;
  }
}

function render() {
  if (!ALL_DATA) return;
  $('last-updated').textContent = new Date(ALL_DATA.meta.generated).toLocaleString('zh-TW');
  $('source-note').textContent = 'Source: ' + (ALL_DATA.meta.workspace || 'workspace');

  renderProjects(ALL_DATA.projects || []);
  renderFiles(ALL_DATA.files || []);
  renderMemory(ALL_DATA.memory || []);
  renderResearch(ALL_DATA.research || []);
  renderJobs(ALL_DATA.jobs || {});
}

async function init() {
  ALL_DATA = await loadData();
  render();
}

// ── Projects ──────────────────────────────────────────────
function renderProjects(items) {
  const stats = $('projects-stats');
  const active = items.filter(p => p.status === 'active').length;
  const done   = items.filter(p => p.status === 'completed').length;
  stats.innerHTML = `${chip('總數', items.length)}${chip('進行中', active)}${chip('已完成', done)}`;

  const grid = $('projects-grid');
  if (!items.length) { grid.innerHTML = '<p class="empty">尚無專案</p>'; return; }
  grid.innerHTML = items.map(p => `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${esc(p.title)}</div>
        <span class="status ${esc(p.status)}">${statusLabel(p.status)}</span>
      </div>
      ${p.description ? `<div class="desc">${esc(p.description)}</div>` : ''}
      ${p.progress !== undefined ? progressBar(p.progress) : ''}
      ${tagsHTML(p.tags)}
      ${p.completed && p.completed.length ? `<div><div class="list-label">已完成</div>${p.completed.map(c=>`<div class="list-item">${esc(c)}</div>`).join('')}</div>` : ''}
      ${p.pending && p.pending.length ? `<div><div class="list-label">待完成</div>${p.pending.map(c=>`<div class="list-item">${esc(c)}</div>`).join('')}</div>` : ''}
      <div class="card-meta">更新：${p.lastUpdated || ''}</div>
    </div>
  `).join('');
}

// ── Files ─────────────────────────────────────────────────
function renderFiles(items) {
  const stats = $('files-stats');
  stats.innerHTML = `${chip('總數', items.length)}`;

  const grid = $('files-grid');
  if (!items.length) { grid.innerHTML = '<p class="empty">尚無檔案</p>'; return; }
  grid.innerHTML = items.map(f => `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${esc(f.title)}</div>
        ${f.type ? `<span class="status active">${esc(f.type.replace('project-note','專案筆記'))}</span>` : ''}
      </div>
      ${f.description ? `<div class="desc">${esc(f.description.slice(0,100))}</div>` : ''}
      ${f.path ? `<div class="card-meta" style="word-break:break-all;font-size:11px;color:var(--accent)">${esc(f.path)}</div>` : ''}
      ${tagsHTML(f.tags)}
      ${f.progress !== null ? progressBar(f.progress) : ''}
      <div class="card-meta">更新：${f.lastUpdated || ''}</div>
    </div>
  `).join('');
}

// ── Memory ────────────────────────────────────────────────
function renderMemory(items) {
  const stats = $('memory-stats');
  stats.innerHTML = `${chip('總數', items.length)}`;

  const grid = $('memory-grid');
  if (!items.length) { grid.innerHTML = '<p class="empty">尚無記憶</p>'; return; }
  grid.innerHTML = items.map(m => `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${esc(m.title)}</div>
      </div>
      ${m.description ? `<div class="desc">${esc(m.description.slice(0,100))}</div>` : ''}
      ${tagsHTML(m.tags)}
      ${m.connections && m.connections.length ? `<div class="card-meta">🔗 ${m.connections.length} 個關聯</div>` : ''}
      <div class="card-meta">${m.date || ''}</div>
    </div>
  `).join('');
}

// ── Research ──────────────────────────────────────────────
function renderResearch(items) {
  const stats = $('research-stats');
  stats.innerHTML = `${chip('總數', items.length)}`;

  const grid = $('research-grid');
  if (!items.length) { grid.innerHTML = '<p class="empty">尚無研究</p>'; return; }
  grid.innerHTML = items.map(r => `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${esc(r.title)}</div>
        ${r.status ? `<span class="status active">${esc(r.status)}</span>` : ''}
      </div>
      ${r.description ? `<div class="desc">${esc(r.description.slice(0,120))}</div>` : ''}
      ${tagsHTML(r.tags)}
      ${r.path ? `<div class="card-meta" style="font-size:11px;color:var(--accent)">${esc(r.path)}</div>` : ''}
      <div class="card-meta">${r.date || ''}</div>
    </div>
  `).join('');
}

// ── Jobs ──────────────────────────────────────────────────
function renderJobs(jobs) {
  const list = $('jobs-list');
  const items = [];

  // Heartbeat
  if (jobs.heartbeat) {
    items.push(`
      <div class="job-item">
        <div class="job-item-header">
          <span class="job-type-badge heartbeat">❤️ Heartbeat</span>
          <span class="job-label">OpenClaw Heartbeat</span>
          <span class="job-schedule">排程：${esc(jobs.heartbeat.schedule || 'per poll')}</span>
        </div>
        <div class="job-next">⏰ 下次：${esc(jobs.heartbeat.next || '等待觸發')}</div>
        <div class="job-last">上次：${esc(jobs.heartbeat.last || '未知')}</div>
        <div class="job-history">
          ${(jobs.heartbeat.history||[]).map(h=>`<div class="job-history-item"><div class="jh-dot ${h.ok?'jh-ok':'jh-fail'}"></div>${esc(h.time)} — ${esc(h.result||'unknown')}</div>`).join('')}
          ${!(jobs.heartbeat.history||[]).length ? '<div class="job-history-item"><div class="jh-dot jh-unknown"></div>無執行記錄</div>' : ''}
        </div>
      </div>
    `);
  }

  // Cron
  if (jobs.cron && jobs.cron.items && jobs.cron.items.length) {
    items.push(...jobs.cron.items.map(j => `
      <div class="job-item">
        <div class="job-item-header">
          <span class="job-type-badge cron">⏱ Cron</span>
          <span class="job-label">${esc(j.label || j.command.slice(0,40))}</span>
          <span class="job-schedule">${esc(j.cron)}</span>
        </div>
        <div class="job-last">命令：${esc(j.command)}</div>
      </div>
    `));
  } else {
    items.push(`
      <div class="job-item">
        <div class="job-item-header">
          <span class="job-type-badge cron">⏱ Cron</span>
          <span class="job-label">無 cron 項目</span>
        </div>
        <div class="job-last">crontab 目前沒有設定任何工作</div>
      </div>
    `);
  }

  // Launchctl
  if (jobs.launchctl && jobs.launchctl.items && jobs.launchctl.items.length) {
    // Show first 20
    const show = jobs.launchctl.items.slice(0, 20);
    const extra = jobs.launchctl.items.length - show.length;
    items.push(...show.map(j => `
      <div class="job-item">
        <div class="job-item-header">
          <span class="job-type-badge launchctl">🚀 Launchd</span>
          <span class="job-label" style="font-size:12px;font-weight:400">${esc(j.label)}</span>
          <span class="job-schedule">PID: ${j.pid !== '-' ? esc(j.pid) : '—'}</span>
        </div>
        <div class="job-last">Status: ${esc(j.status)}</div>
      </div>
    `));
    if (extra > 0) {
      items.push(`<div class="job-item" style="text-align:center;color:var(--muted)">... 還有 ${extra} 項</div>`);
    }
  }

  list.innerHTML = items.join('');
}

// ─────────────────────────────────────────────────────────
//  D3.js Force-Directed Graph
// ─────────────────────────────────────────────────────────
let simulation = null;

function renderGraph(data) {
  const svg    = d3.select('#graph-canvas');
  const wrap  = $('graph-wrap');
  const W = wrap.clientWidth  || 900;
  const H = wrap.clientHeight || 560;

  svg.attr('viewBox', `0 0 ${W} ${H}`).selectAll('*').remove();

  const typeFilter = $('graph-type-filter').value;
  const linkFilter = $('graph-link-filter').value;

  // Build node list
  const allNodes = [
    ...(data.projects || []).map(p => ({ ...p, nodeType: 'project' })),
    ...(data.memory  || []).map(m => ({ ...m, nodeType: 'memory'  })),
    ...(data.research|| []).map(r => ({ ...r, nodeType: 'research' })),
    ...(data.files   || []).map(f => ({ ...f, nodeType: 'file'     })),
  ];

  const rels = (data.relationships || []).filter(r => {
    const fromNode = allNodes.find(n => n.id === r.from);
    const toNode   = allNodes.find(n => n.id === r.to);
    if (!fromNode || !toNode) return false;
    if (typeFilter !== 'all' && (fromNode.nodeType !== typeFilter && toNode.nodeType !== typeFilter)) return false;
    if (linkFilter === 'tag' && r.type !== 'tag') return false;
    return true;
  });

  const nodeMap = {};
  allNodes.forEach(n => nodeMap[n.id] = n);

  const nodes = [...new Set(rels.flatMap(r => [r.from, r.to]))]
    .map(id => nodeMap[id])
    .filter(Boolean)
    .filter(n => typeFilter === 'all' || n.nodeType === typeFilter);

  const links = rels.filter(r => nodes.find(n => n.id === r.from) && nodes.find(n => n.id === r.to));

  $('graph-node-count').innerHTML = `節點: <span>${nodes.length}</span> · 連線: <span>${links.length}</span>`;

  if (!nodes.length) return;

  const colorMap = { project: '#58a6ff', memory: '#3fb950', research: '#d29922', file: '#bc8cff' };
  const radiusMap = { project: 12, memory: 7, research: 9, file: 7 };

  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(d => d.type === 'has-note' ? 60 : 90).strength(0.5))
    .force('charge', d3.forceManyBody().strength(-200))
    .force('center', d3.forceCenter(W / 2, H / 2))
    .force('collision', d3.forceCollide(d => radiusMap[d.nodeType] + 10));

  svg.append('g').selectAll('line')
    .data(links)
    .join('line')
    .attr('class', d => `link ${esc(d.type)}`)
    .attr('stroke-width', d => Math.sqrt(d.strength || 1));

  const g = svg.append('g').selectAll('g')
    .data(nodes)
    .join('g')
    .attr('class', 'node')
    .call(drag(sim));

  g.append('circle')
    .attr('r', d => radiusMap[d.nodeType])
    .attr('fill', d => colorMap[d.nodeType]);

  g.append('text')
    .attr('dy', d => -(radiusMap[d.nodeType] + 4))
    .text(d => d.title ? d.title.slice(0, 20) : d.id.slice(0, 20));

  // Tooltip
  const tooltip = $('d3-tooltip');
  const info   = $('graph-info');

  g.on('mouseover', (event, d) => {
    tooltip.style.display = 'block';
    tooltip.innerHTML = `<b>${esc(d.title||d.id)}</b><br><span style="color:#8b949e">${typeLabel(d.nodeType)}</span>`;
    $('gi-title').textContent = d.title || d.id;
    $('gi-type').textContent = typeLabel(d.nodeType);
    $('gi-tags').innerHTML = tagsHTML(d.tags);
    const descEl = $('gi-desc');
    if (d.description) { descEl.textContent = d.description.slice(0, 80); descEl.style.display = ''; } else { descEl.style.display = 'none'; }
    const linkEl = $('gi-link');
    if (d.path) { linkEl.innerHTML = `<a href="#">${esc(d.path)}</a>`; linkEl.style.display = ''; } else { linkEl.style.display = 'none'; }
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
    // Navigate to relevant section
    const tabMap = { project: 'projects', memory: 'memory', research: 'research', file: 'files' };
    const tab = tabMap[d.nodeType];
    if (tab) {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
      $(tab).classList.add('active');
      $('graph-section').classList.remove('active');
    }
  });

  sim.on('tick', () => {
    svg.selectAll('line')
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    svg.selectAll('.node')
      .attr('transform', d => `translate(${Math.max(20, Math.min(W-20, d.x))},${Math.max(20, Math.min(H-20, d.y))})`);
  });

  simulation = sim;

  // Filters
  $('graph-type-filter').onchange = () => renderGraph(data);
  $('graph-link-filter').onchange = () => renderGraph(data);
}

function drag(sim) {
  return d3.drag()
    .on('start', (event, d) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
    .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
    .on('end', (event, d) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; });
}

// ── Start ─────────────────────────────────────────────────
init();
