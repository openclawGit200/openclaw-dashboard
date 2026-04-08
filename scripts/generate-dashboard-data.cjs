#!/usr/bin/env node
/**
 * generate-dashboard-data.cjs
 * 統一記憶來源：notes/ + financial_notes/ + memory/ + Obsidian/ + research/
 * 研究 tab 移除，research 內容統一併入記憶
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = '/Users/downtoearth/.openclaw/workspace';
const OUT  = path.join(__dirname, '../public/data/data.json');

const data = {
  meta: { generated: new Date().toISOString(), workspace: ROOT },
  projects: [],
  files:    [],   // notes/projects/ — 專案說明
  memory:   [],   // 統一記憶：notes/ + financial_notes/ + memory/ + Obsidian/ + research/
  relationships: [],
  jobs: {
    items: [],
    heartbeat: null,
    cron: { items: [], history: [] },
    launchctl: { items: [], history: [] },
  }
};

// ── helpers ─────────────────────────────────────────────────────────────────
function slugify(s) {
  return s.toLowerCase().replace(/\s+/g,'-').replace(/[<>()#\/]/g,'').slice(0,60);
}

function extractTitle(lines) {
  return lines.find(l => l.startsWith('#'))?.replace(/^#+\s*/,'').trim()
    || lines[0]?.trim().slice(0,60) || 'Untitled';
}

function extractDesc(lines) {
  return lines.find(l => l.trim().length > 20 && !l.startsWith('#') && !l.startsWith('>'))?.trim().slice(0,120) || '';
}

function extractTags(txt) {
  return [...new Set([...txt.matchAll(/#(\w+)/g)].map(m => m[1]))];
}

function extractDate(txt, fallback) {
  const m = txt.match(/(\d{4}[-/]\d{2}[-/]\d{2})/);
  return m ? m[1].replace(/\//g,'-') : fallback;
}

// ── 1. MEMORY.md → projects ─────────────────────────────────────────────────
function parseMEMORY() {
  const f = path.join(ROOT, 'MEMORY.md');
  if (!fs.existsSync(f)) return;
  const txt = fs.readFileSync(f, 'utf8');
  const sections = txt.split(/(?=^#{3}\s+)/gm).filter(s => s.trim());

  for (const section of sections) {
    const lines = section.split('\n');
    const titleLine = lines.find(l => l.startsWith('###'));
    if (!titleLine) continue;
    const title = titleLine.replace(/^#{3}\s+/,'').trim();
    if (!title) continue;
    const skipTitles = ['About Human','Recent Research','Key Decisions','Lessons Learned','Relationships & People'];
    if (skipTitles.includes(title)) continue;

    const bullets = lines.filter(l => l.startsWith('- **'));
    const completed=[], pending=[]; let progress=0; let description='';
    const tags=[];
    for (const b of bullets) {
      const m = b.match(/^- \*\*([^*]+)\*\*[：:]\s*(.+)/);
      if (!m) continue;
      const label=m[1].trim(), val=m[2].replace(/^✅\s*|^❌\s*/,'').trim();
      if (label.includes('進度')) {
        const pct=val.match(/(\d+)%/);
        progress=pct?parseInt(pct[1]):(val.includes('完成')?100:0);
        description=val;
      }
      if (val.includes('✅')) completed.push(val);
      else if (val.includes('❌')||val.includes('待')) pending.push(val);
      const ts=[...b.matchAll(/#(\w+)/g)].map(t=>t[1]);
      ts.forEach(t=>{ if(!tags.includes(t)) tags.push(t); });
    }
    const status = (progress===100||title.includes('完成')) ? 'completed' : 'active';
    data.projects.push({
      id: slugify(title),
      title, status, progress, description, tags,
      completed, pending,
      lastUpdated: new Date().toLocaleDateString('zh-TW')
    });
  }
}

// ── 2. notes/projects/*.md → files ──────────────────────────────────────────
function parseProjectNotes() {
  const dir = path.join(ROOT, 'notes', 'projects');
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.md')) continue;
    const full = path.join(dir, file);
    const txt  = fs.readFileSync(full, 'utf8');
    const lines = txt.split('\n');
    const title = extractTitle(lines);
    const desc  = extractDesc(lines);
    const tags  = extractTags(txt);
    const pct   = txt.match(/進度[：:]\s*(\d+)/)?.[1] || null;
    const status = txt.match(/狀態[：:]\s*([^\s]+)/)?.[1] || 'active';
    data.files.push({
      id:    `projnote-${slugify(file)}`,
      title, description: desc, tags,
      path:  `notes/projects/${file}`,
      type:  'project-note',
      progress: pct ? parseInt(pct) : null,
      status,
      source: 'project',
      lastUpdated: fs.statSync(full).mtime.toLocaleDateString('zh-TW')
    });
  }
}

// ── 3. 統一記憶：notes/ + notes/research/ + memory/ + Obsidian/ + financial_notes/ ───────
function scanDir(dir, { source, maxDepth = 99, skipDirs = [] } = {}) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (skipDirs.includes(entry.name)) continue;
      if (maxDepth <= 0) continue;
      results.push(...scanDir(path.join(dir, entry.name), { source, maxDepth: maxDepth - 1, skipDirs }));
    } else if (entry.name.endsWith('.md')) {
      const full = path.join(dir, entry.name);
      const txt  = fs.readFileSync(full, 'utf8');
      const lines = txt.split('\n');
      const title = extractTitle(lines);
      // 跳過 session-memory hook 自動寫的歸檔
      if (title.toLowerCase().startsWith('session')) continue;
      const desc = extractDesc(lines);
      const tags = extractTags(txt);
      const date = extractDate(txt, fs.statSync(full).mtime.toLocaleDateString('zh-TW'));

      // TWSE report：嘗試解析股號與公司名
      let stockId = null, companyName = null;
      const fn = entry.name;
      const m = fn.match(/^(\d{4})[-–]?\s*(.+?)\.md$/);
      if (m) {
        stockId = m[1];
        companyName = m[2].replace(/[_-]/g,' ').trim();
      }

      results.push({
        id:    `${source}-${slugify(fn.replace('.md',''))}`,
        title, description: desc, tags,
        source,
        stockId:    stockId || undefined,
        companyName: companyName || undefined,
        path:  path.relative(ROOT, full),
        date,
      });
    }
  }
  return results;
}

function parseAllNotes() {
  // notes/（含 research/）
  data.memory.push(...scanDir(path.join(ROOT,'notes'), { source: 'notes' }));
  // financial_notes/（台股季報）
  data.memory.push(...scanDir(path.join(ROOT,'financial_notes'), { source: 'twse' }));
  // memory/（session 歸檔，已過濾 session 標題）
  data.memory.push(...scanDir(path.join(ROOT,'memory'), { source: 'memory' }));
  // Obsidian vault
  data.memory.push(...scanDir('/Users/downtoearth/Documents/Obsidian', { source: 'obsidian' }));
}

// ── 4. Jobs ────────────────────────────────────────────────────────────────
// 統一 jobs[] 結構：每個 job 有 id, name, trigger, schedule, nextRun, history
function parseJobs() {
  // 4a. Heartbeat
  parseHeartbeat();

  // 4b. GitHub Backup (from plist + git log)
  parseGithubBackup();

  // 4c. Launchctl user jobs
  parseLaunchctl();
}

function parseHeartbeat() {
  const f = path.join(ROOT, 'HEARTBEAT.md');
  if (!fs.existsSync(f)) return;
  const txt = fs.readFileSync(f, 'utf8');
  const sched = txt.match(/cron[：:]\s*(.+)/i) || txt.match(/schedule[：:]\s*(.+)/i);
  const last  = txt.match(/更新[：:]\s*(.+)/i) || txt.match(/last[_-]?run[：:]\s*(.+)/i);
  // 嘗試抓 history 內的記錄
  const histMatches = [...txt.matchAll(/[-*]\s*\[(.)\]\s*(.+)/g)].slice(0, 10).map(m => ({
    ok: m[1] !== ' ',
    text: m[2].trim()
  }));

  data.jobs.items.push({
    id: 'heartbeat',
    name: 'OpenClaw Heartbeat',
    trigger: 'HOOK: session:compact:before',
    schedule: sched ? sched[1].trim() : 'per heartbeat poll',
    nextRun: sched ? sched[1].trim() : '等待觸發',
    lastRun: last ? last[1].trim() : '未知',
    status: 'active',
    history: histMatches
  });
}

function parseGithubBackup() {
  const plistPath = path.join(process.env.HOME || '/Users/downtoearth', 'Library/LaunchAgents/openclaw-github-backup.plist');
  if (!fs.existsSync(plistPath)) return;
  const plist = fs.readFileSync(plistPath, 'utf8');
  const hourMatch = plist.match(/<key>Hour<\/key>\s*<integer>(\d+)<\/integer>/);
  const minMatch  = plist.match(/<key>Minute<\/key>\s*<integer>(\d+)<\/integer>/);
  const hour = hourMatch ? parseInt(hourMatch[1]) : 3;
  const min  = minMatch  ? parseInt(minMatch[1])  : 0;

  // Git log history from backup repo
  let history = [];
  try {
    const backupRepo = path.join(process.env.HOME || '/Users/downtoearth', 'openclaw-backup');
    const gitLog = execSync(`git -C "${backupRepo}" log --oneline -10 2>/dev/null`, { encoding: 'utf8' });
    history = gitLog.trim().split('\n').map(line => {
      const m = line.match(/^([a-f0-9]+)\s+(.+)\s+(20\d{2}-\d{2}-\d{2}\s+\d{2}:\d{2})/);
      return m ? { ok: true, hash: m[1], message: m[2], time: m[3] } : { ok: true, message: line };
    }).slice(0, 10);
  } catch {}

  // 計算下一個週六
  const now = new Date();
  const dow = 6; // Saturday
  const next = new Date(now);
  next.setDate(now.getDate() + ((dow + 7 - now.getDay()) % 7 || 7));
  next.setHours(hour, min, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 7);

  data.jobs.items.push({
    id: 'github-backup',
    name: 'GitHub 異地備份',
    trigger: 'LaunchAgent: 每週六',
    schedule: `每週六 ${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`,
    nextRun: next.toLocaleString('zh-TW', { timeZone: 'Asia/Shanghai' }),
    lastRun: history[0]?.time || '未知',
    status: 'active',
    history
  });
}

function parseLaunchctl() {
  const systemPrefixes = ['com.apple.','com.google.','com.microsoft.','com.ollama.ollama','com.openssh.','org.postgresql.','homebrew.mxcl.','io.bombich.','ru.croc.'];
  const isSystem = label => systemPrefixes.some(p => label.startsWith(p));
  const isMacAppInstance = label => /^application\./.test(label);

  const nameMap = {
    'ai.openclaw.gateway':   { name: 'OpenClaw Gateway',  trigger: 'LaunchAgent: 開機自動' },
    'ai.openclaw.github-backup': null, // 已由 parseGithubBackup 處理
    'com.twse.semantic-sync':  { name: '台股語意同步',      trigger: 'LaunchAgent' },
    'com.twse.crawler-sync':   { name: '台股季報同步GITHUB', trigger: 'LaunchAgent: 每週日' },
    'taiwan-stock-crawler':   { name: '台股季報爬蟲',       trigger: 'LaunchAgent: 每週六' },
  };

  try {
    const out = execSync('launchctl list 2>/dev/null || echo ""', { encoding: 'utf8' });
    const lines = out.split('\n').slice(1).filter(l => l.trim());
    const items = lines
      .map((l,i) => { const p=l.split(/\t+/); return { id:`lc-${i}`, label:p[2]||p[1]||'', status:p[1]||'?', pid:p[0]||'-' }; })
      .filter(i => i.label && !i.label.startsWith('-') && !isSystem(i.label) && !isMacAppInstance(i.label));

    for (const j of items) {
      const mapped = nameMap[j.label];
      if (mapped === null) continue; // 跳過已由其他 parser 處理的項目
      if (!mapped) continue; // 未知的 launchctl job 也跳過
      data.jobs.items.push({
        id: j.label,
        name: mapped?.name || j.label,
        trigger: mapped?.trigger || 'LaunchAgent',
        schedule: 'LaunchAgent',
        nextRun: j.status === '1' ? '⚠️ 運行中' : (j.pid !== '-' ? `PID ${j.pid}` : '—'),
        lastRun: j.pid !== '-' ? `PID ${j.pid}` : `Status ${j.status}`,
        status: j.status === '0' ? 'running' : j.status === '1' ? 'active' : 'stopped',
        history: [{ ok: j.status === '0', message: `${j.label} — Status: ${j.status}, PID: ${j.pid}` }]
      });
    }
  } catch {}
}

// ── 5. Relationships ─────────────────────────────────────────────────────────
// 只用 notes/ + memory/ 的 shared tags 建立連線（不用 TWSE，太多了會爆 graph）
function buildRelationships() {
  const graphNodes = data.memory.filter(n => ['notes','memory','obsidian','research'].includes(n.source));
  const rels = [];
  for (let i = 0; i < graphNodes.length; i++) {
    for (let j = i+1; j < graphNodes.length; j++) {
      const a = graphNodes[i], b = graphNodes[j];
      const shared = a.tags.filter(t => b.tags.includes(t));
      if (shared.length > 0) {
        rels.push({ from: a.id, to: b.id, type: 'tag', tags: shared, strength: shared.length });
      }
    }
  }
  // Project → related notes (by tag match)
  for (const p of data.projects) {
    for (const m of graphNodes) {
      const shared = p.tags.filter(t => m.tags.includes(t));
      if (shared.length > 0) {
        rels.push({ from: p.id, to: m.id, type: 'project-note', tags: shared, strength: shared.length });
      }
    }
  }
  data.relationships = rels;

  // 每個 memory node 連接的 other node ids
  for (const m of data.memory) {
    m.connections = rels
      .filter(r => r.from === m.id || r.to === m.id)
      .map(r => r.from === m.id ? r.to : r.from);
  }
}

// ── Run ─────────────────────────────────────────────────────────────────────
parseMEMORY();
parseProjectNotes();
parseAllNotes();
parseJobs();
buildRelationships();

fs.writeFileSync(OUT, JSON.stringify(data, null, 2), 'utf8');

const twse  = data.memory.filter(m => m.source === 'twse').length;
const notes = data.memory.filter(m => ['notes','memory','obsidian','research'].includes(m.source)).length;
console.log(`✅ Written to ${OUT}`);
console.log(`   Projects:   ${data.projects.length}`);
console.log(`   Files:      ${data.files.length}`);
console.log(`   Memory:    ${data.memory.length}  (TWSE=${twse} | notes+memory+obsidian=${notes})`);
console.log(`   Jobs:       ${data.jobs.items.length}`);
console.log(`   Relations:  ${data.relationships.length}`);
