#!/usr/bin/env node
/**
 * generate-dashboard-data.cjs
 * 掃描 workspace，產生 dashboard data.json
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = '/Users/downtoearth/.openclaw/workspace';
const OUT  = path.join(__dirname, '../data/data.json');

const data = {
  meta: { generated: new Date().toISOString(), workspace: ROOT },
  projects: [],
  files: [],
  memory: [],
  research: [],
  jobs: { heartbeat: { last: null, next: null, schedule: null, history: [] }, cron: { items: [], history: [] }, launchctl: { items: [], history: [] } },
  relationships: []
};

// ── 1. MEMORY.md → projects ──────────────────────────────────────────────────
function parseMEMORY() {
  const f = path.join(ROOT, 'MEMORY.md');
  if (!fs.existsSync(f)) return;
  const txt = fs.readFileSync(f, 'utf8');

  // Split by ### headings (project level)
  const sections = txt.split(/(?=^#{3}\s+)/gm).filter(s => s.trim());

  for (const section of sections) {
    const lines = section.split('\n');
    const titleLine = lines.find(l => l.startsWith('###'));
    if (!titleLine) continue;
    const title = titleLine.replace(/^#{3}\s+/, '').trim();
    if (!title) continue;
    if (['About Human', 'Recent Research', 'Key Decisions', 'Lessons Learned', 'Relationships & People'].includes(title)) continue;

    // Collect bullet lines
    const bullets = lines.filter(l => l.startsWith('- **'));
    const completed = [];
    const pending   = [];
    let progress    = 0;
    let description = '';
    const tags = [];

    for (const b of bullets) {
      // Bold label: - **Label**：content
      const m = b.match(/^- \*\*([^*]+)\*\*[：:]\s*(.+)/);
      if (!m) continue;
      const label = m[1].trim();
      const val   = m[2].replace(/^✅\s*|^❌\s*|^\S+\s+/, '').trim();
      if (label.includes('進度')) {
        // Try to extract percentage
        const pct = val.match(/(\d+)%/);
        progress = pct ? parseInt(pct[1]) : (val.includes('完成') ? 100 : 0);
        description = val;
      }
      if (val.includes('✅')) completed.push(val);
      else if (val.includes('❌') || val.includes('待')) pending.push(val);
      if (b.includes('#')) {
        const ts = [...b.matchAll(/#(\w+)/g)].map(t => t[1]);
        ts.forEach(t => { if (!tags.includes(t)) tags.push(t); });
      }
    }

    // Status
    let status = 'active';
    if (progress === 100 || title.includes('完成')) status = 'completed';

    // Find related notes/projects path
    const linkMatch = section.match(/notes\/projects\/([^\]]+)\.md/);
    const relatedNote = linkMatch ? `notes/projects/${linkMatch[1]}.md` : null;

    data.projects.push({
      id: title.toLowerCase().replace(/\s+/g, '-').replace(/[<>()]/g, ''),
      title,
      status,
      progress,
      description,
      tags,
      completed,
      pending,
      relatedNote,
      lastUpdated: new Date().toLocaleDateString('zh-TW')
    });
  }
}

// ── 2. notes/projects/*.md ──────────────────────────────────────────────────
function parseProjectNotes() {
  const dir = path.join(ROOT, 'notes', 'projects');
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const full = path.join(dir, file);
    const txt  = fs.readFileSync(full, 'utf8');
    const lines = txt.split('\n');
    const title = lines.find(l => l.startsWith('#'))?.replace(/^#+\s*/, '').trim() || file.replace('.md','');
    const firstPara = lines.find(l => l.trim().length > 20 && !l.startsWith('#')) || '';
    const tagRe  = /#(\w+)/g;
    const tags   = [...new Set([...txt.matchAll(tagRe)].map(t => t[1]))];
    const pct    = txt.match(/進度[：:]\s*(\d+)/)?.[1] || null;
    const statusMatch = txt.match(/狀態[：:]\s*([^\s]+)/)?.[1] || 'active';

    data.files.push({
      id: `projnote-${file.replace('.md','').toLowerCase()}`,
      title,
      description: firstPara.slice(0, 120),
      path: `notes/projects/${file}`,
      tags,
      type: 'project-note',
      progress: pct ? parseInt(pct) : null,
      status: statusMatch,
      lastUpdated: fs.statSync(full).mtime.toLocaleDateString('zh-TW')
    });
  }
}

// ── 3. notes/research/*.md ──────────────────────────────────────────────────
function parseResearchNotes() {
  const dir = path.join(ROOT, 'notes', 'research');
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const full = path.join(dir, file);
    const txt  = fs.readFileSync(full, 'utf8');
    const lines = txt.split('\n');
    const title = lines.find(l => l.startsWith('#'))?.replace(/^#+\s*/, '').trim() || file.replace('.md','');
    const firstPara = lines.find(l => l.trim().length > 10 && !l.startsWith('#')) || '';
    const tagRe  = /#(\w+)/g;
    const tags   = [...new Set([...txt.matchAll(tagRe)].map(t => t[1]))];
    const dateRe = txt.match(/(\d{4}[-/]\d{2}[-/]\d{2})/);
    const statusMatch = txt.match(/狀態[：:]\s*([^\s]+)/)?.[1] || '研究';

    data.research.push({
      id: `res-${file.replace('.md','').toLowerCase()}`,
      title,
      description: firstPara.slice(0, 120),
      path: `notes/research/${file}`,
      tags,
      status: statusMatch,
      date: dateRe ? dateRe[1].replace(/\//g,'-') : fs.statSync(full).mtime.toLocaleDateString('zh-TW')
    });
  }
}

// ── 4. memory/*.md ──────────────────────────────────────────────────────────
function parseMemoryFiles() {
  const dir = path.join(ROOT, 'memory');
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const full = path.join(dir, file);
    const txt  = fs.readFileSync(full, 'utf8');
    const lines = txt.split('\n');
    const title = lines.find(l => l.startsWith('#'))?.replace(/^#+\s*/, '').trim() || file.replace('.md','');
    if (title.toLowerCase().startsWith('session')) continue; // 過濾掉 session-memory hook 自動寫的作業記錄
    const firstPara = lines.find(l => l.trim().length > 20 && !l.startsWith('#')) || '';
    const tagRe  = /#(\w+)/g;
    const tags   = [...new Set([...txt.matchAll(tagRe)].map(t => t[1]))];
    const dateRe = txt.match(/(\d{4}[-/]\d{2}[-/]\d{2})/);
    data.memory.push({
      id: `mem-${file.replace('.md','').toLowerCase()}`,
      title,
      description: firstPara.slice(0, 120),
      tags,
      connections: [],
      date: dateRe ? dateRe[1].replace(/\//g,'-') : fs.statSync(full).mtime.toLocaleDateString('zh-TW')
    });
  }
}

// ── 5. Cron ─────────────────────────────────────────────────────────────────
function parseCron() {
  try {
    const out = execSync('crontab -l 2>/dev/null || echo ""', { encoding: 'utf8' });
    const lines = out.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    data.jobs.cron.items = lines.map(l => {
      const parts = l.trim().split(/\s+/);
      const cron  = parts.slice(0,5).join(' ');
      const cmd   = parts.slice(5).join(' ');
      const label = cmd.split('/').pop().replace('.sh','').replace('.py','') || cron;
      return { id: `cron-${cron.replace(/\s+/g,'-')}`, cron, command: cmd, label };
    });
  } catch { data.jobs.cron.items = []; }
}

// ── 6. launchctl ────────────────────────────────────────────────────────────
function parseLaunchctl() {
  // 系統自帶要排除的 prefix（精確匹配）
  const systemPrefixes = [
    'com.apple.',
    'com.google.',
    'com.microsoft.',
    'com.ollama.ollama',
    'com.openssh.',
    'org.postgresql.',
    'homebrew.mxcl.',
    'io.bombich.',
    'ru.croc.',
  ];
  // 過濾 Electron app 實例（如 application.com.electron.lark.<UUID>）
  const isElectronInstance = label => /^application\.com\.electron\.[^/]+$/.test(label);
  const isSystem = label => systemPrefixes.some(p => label.startsWith(p)) || isElectronInstance(label);

  try {
    const out = execSync('launchctl list 2>/dev/null || echo ""', { encoding: 'utf8' });
    const lines = out.split('\n').slice(1).filter(l => l.trim());
    data.jobs.launchctl.items = lines.map((l, i) => {
      const parts = l.split(/\t+/);
      return {
        id: `lc-${i}`,
        label: parts[2] || parts[1] || '',  // parts[2] = Label (pid\tstatus\tlabel format)
        status: parts[1] || '?',
        pid: parts[0] || '-'
      };
    }).filter(i => i.label && !i.label.startsWith('-') && !isSystem(i.label) && !isElectronInstance(i.label));
  } catch { data.jobs.launchctl.items = []; }
}

// ── 7. HEARTBEAT.md ────────────────────────────────────────────────────────
function parseHeartbeat() {
  const f = path.join(ROOT, 'HEARTBEAT.md');
  if (!fs.existsSync(f)) return;
  const txt = fs.readFileSync(f, 'utf8');
  const schedMatch = txt.match(/cron[：:]\s*(.+)/i) || txt.match(/schedule[：:]\s*(.+)/i);
  const lastMatch  = txt.match(/last[_-]?run[：:]\s*(.+)/i) || txt.match(/更新[：:]\s*(.+)/i);
  data.jobs.heartbeat = {
    last: lastMatch ? lastMatch[1].trim() : 'unknown',
    next: schedMatch ? schedMatch[1].trim() : 'per heartbeat poll',
    schedule: schedMatch ? schedMatch[1].trim() : 'per heartbeat poll',
    history: []
  };
}

// ── 8. Relationships ─────────────────────────────────────────────────────────
function buildRelationships() {
  const allNodes = [
    ...data.projects.map(p => ({ id: p.id, type: 'project', tags: p.tags })),
    ...data.memory.map(m => ({ id: m.id, type: 'memory', tags: m.tags })),
    ...data.research.map(r => ({ id: r.id, type: 'research', tags: r.tags })),
    ...data.files.map(f  => ({ id: f.id, type: 'file', tags: f.tags })),
  ];

  const rels = [];
  for (let i = 0; i < allNodes.length; i++) {
    for (let j = i + 1; j < allNodes.length; j++) {
      const a = allNodes[i], b = allNodes[j];
      const shared = a.tags.filter(t => b.tags.includes(t));
      if (shared.length > 0) {
        rels.push({ from: a.id, to: b.id, type: 'tag', tags: shared, strength: shared.length });
      }
    }
  }

  // Project → relatedNote link
  for (const p of data.projects) {
    if (p.relatedNote) {
      const matched = data.files.find(f => f.path === p.relatedNote);
      if (matched) rels.push({ from: p.id, to: matched.id, type: 'has-note', strength: 3 });
    }
  }

  data.relationships = rels;

  // Infer memory connections
  for (const m of data.memory) {
    m.connections = rels.filter(r => r.from === m.id || r.to === m.id).map(r => r.from === m.id ? r.to : r.from);
  }
}

// ── Run ─────────────────────────────────────────────────────────────────────
parseMEMORY();
parseProjectNotes();
parseResearchNotes();
parseMemoryFiles();
parseCron();
parseLaunchctl();
parseHeartbeat();
buildRelationships();

fs.writeFileSync(OUT, JSON.stringify(data, null, 2), 'utf8');
console.log(`✅ Written to ${OUT}`);
console.log(`   Projects: ${data.projects.length}`);
console.log(`   Files:    ${data.files.length}`);
console.log(`   Memory:   ${data.memory.length}`);
console.log(`   Research: ${data.research.length}`);
console.log(`   Cron:     ${data.jobs.cron.items.length}`);
console.log(`   Launchctl:${data.jobs.launchctl.items.length}`);
console.log(`   Relations: ${data.relationships.length}`);
