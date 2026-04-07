// === Tab Switching ===
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// === Load All Data ===
const BASE = 'data/';

async function loadJSON(name) {
  try {
    const res = await fetch(BASE + name + '.json?_=' + Date.now());
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (e) {
    console.warn('Failed to load', name, e);
    return null;
  }
}

function render() {
  document.getElementById('last-updated').textContent = new Date().toLocaleString('zh-TW');
}

async function init() {
  const [projects, files, memory, research, jobs] = await Promise.all([
    loadJSON('projects'),
    loadJSON('files'),
    loadJSON('memory'),
    loadJSON('research'),
    loadJSON('jobs')
  ]);

  if (projects) renderProjects(projects.projects || []);
  if (files)    renderFiles(files.files || []);
  if (memory)   renderMemory(memory.memory || []);
  if (research) renderResearch(research.research || []);
  if (jobs)     renderJobs(jobs.jobs || []);

  render();
}

// === Render: Projects ===
function renderProjects(items) {
  const grid = document.getElementById('projects-grid');
  if (!items.length) { grid.innerHTML = '<p class="empty">尚無專案</p>'; return; }
  grid.innerHTML = items.map(p => `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${esc(p.title)}</div>
        <span class="status ${p.status}">${statusLabel(p.status)}</span>
      </div>
      <div class="desc">${esc(p.description || '')}</div>
      ${p.progress !== undefined ? progressBar(p.progress) : ''}
      ${p.tags ? tags(p.tags) : ''}
      ${p.completed && p.completed.length ? list('已完成', p.completed) : ''}
      ${p.pending && p.pending.length ? list('待完成', p.pending) : ''}
      <div class="card-meta">更新：${p.lastUpdated || ''}</div>
    </div>
  `).join('');
}

// === Render: Files ===
function renderFiles(items) {
  const grid = document.getElementById('files-grid');
  if (!items.length) { grid.innerHTML = '<p class="empty">尚無檔案</p>'; return; }
  grid.innerHTML = items.map(f => `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${esc(f.title)}</div>
        <div class="card-meta">${f.count || ''}</div>
      </div>
      <div class="desc">${esc(f.description || '')}</div>
      ${f.path ? `<div class="card-meta" style="word-break:break-all">路徑：${esc(f.path)}</div>` : ''}
      ${f.tags ? tags(f.tags) : ''}
      <div class="card-meta">更新：${f.lastUpdated || ''}</div>
    </div>
  `).join('');
}

// === Render: Memory ===
function renderMemory(items) {
  const grid = document.getElementById('memory-grid');
  if (!items.length) { grid.innerHTML = '<p class="empty">尚無記憶</p>'; return; }
  grid.innerHTML = items.map(m => `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${esc(m.title)}</div>
      </div>
      <div class="desc">${esc(m.summary || '')}</div>
      ${m.tags ? tags(m.tags) : ''}
      <div class="card-meta">${m.date || ''}</div>
    </div>
  `).join('');
}

// === Render: Jobs ===
function renderJobs(items) {
  const grid = document.getElementById('jobs-grid');
  if (!items.length) { grid.innerHTML = '<p class="empty">尚無定時作業</p>'; return; }
  grid.innerHTML = items.map(j => `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${esc(j.name)}</div>
        <span class="status ${j.lastStatus === 'ok' || j.lastStatus === 'running' ? 'active' : 'planning'}">
          ${j.lastStatus === 'ok' ? '✓ OK' : j.lastStatus === 'running' ? '運行中' : '⚠ error'}
        </span>
      </div>
      <div class="desc">${esc(j.description || '')}</div>
      ${j.schedule ? `<div class="list-item">排程：${esc(j.schedule)}</div>` : ''}
      ${j.nextRun ? `<div class="list-item">下次執行：<strong>${esc(j.nextRun)}</strong></div>` : ''}
      ${j.lastRun ? `<div class="list-item">上次執行：${esc(j.lastRun)}</div>` : ''}
      ${j.pid ? `<div class="list-item">PID：${j.pid}</div>` : ''}
      ${j.lastResult ? `<div class="list-item">結果：${esc(j.lastResult)}</div>` : ''}
      <div class="card-meta" style="margin-top:4px">
        <span class="tag" style="background:rgba(139,148,158,0.15)">${esc(j.type)}</span>
      </div>
    </div>
  `).join('');
}

// === Render: Research ===
function renderResearch(items) {
  const grid = document.getElementById('research-grid');
  if (!items.length) { grid.innerHTML = '<p class="empty">尚無研究</p>'; return; }
  grid.innerHTML = items.map(r => `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${esc(r.topic)}</div>
        <span class="status ${r.status === 'completed' ? 'completed' : r.status === 'ongoing' ? 'active' : 'planning'}">
          ${r.status === 'completed' ? '已完成' : r.status === 'ongoing' ? '進行中' : '規劃中'}
        </span>
      </div>
      <div class="desc">${esc(r.summary || '')}</div>
      ${r.tags ? tags(r.tags) : ''}
      ${r.links && r.links.length ? links(r.links) : ''}
      <div class="card-meta">${r.date || ''}</div>
    </div>
  `).join('');
}

// === Helpers ===
function esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function tags(arr) {
  return `<div class="tags">${arr.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>`;
}

function progressBar(pct) {
  const color = pct >= 80 ? 'green' : pct >= 40 ? 'yellow' : 'red';
  return `
    <div class="progress-wrap">
      <div class="progress-bar"><div class="progress-fill ${color}" style="width:${pct}%"></div></div>
      <span class="progress-pct">${pct}%</span>
    </div>`;
}

function list(label, items) {
  return `
    <div>
      <div class="list-label">${label}</div>
      ${items.map(i => `<div class="list-item">${esc(i)}</div>`).join('')}
    </div>`;
}

function links(items) {
  return `<div class="tags">${items.map(l => `<a class="tag" href="${esc(l)}" target="_blank" rel="noopener">🔗</a>`).join('')}</div>`;
}

function statusLabel(s) {
  return {active:'進行中', planning:'規劃中', completed:'已完成'}[s] || s;
}

init();
