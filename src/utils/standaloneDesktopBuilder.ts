import JSZip from 'jszip';
import { StoryboardPanel } from '../types';
import { ScreenplayElement } from './fadeInParser';

/**
 * Generates a 100% self-contained, offline-capable single-file HTML5 Desktop Studio
 * (`<project>-desktop-studio.html`) plus a zipped Desktop Testing Bundle (`<project>-desktop-bundle.zip`)
 * containing:
 *  - The standalone interactive Desktop Studio app (.html)
 *  - The native Fade In screenplay file (.fadein)
 *  - The project JSON data file (.json)
 *  - A README.txt with offline testing instructions
 */
export function buildStandaloneDesktopHtml(params: {
  projectTitle: string;
  draftingMode: string;
  aspectRatio: '16:9' | '2.39:1' | '4:3';
  scriptText: string;
  scriptElements: ScreenplayElement[];
  panels: StoryboardPanel[];
}): string {
  const safeJson = JSON.stringify(params).replace(/<\/script>/gi, '<\\/script>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${params.projectTitle} — CineBoard Standalone Desktop Studio</title>
  <style>
    :root {
      --bg: #08080A;
      --surface: #111116;
      --surface-alt: #16161D;
      --border: #232329;
      --text: #F4F4F5;
      --muted: #A1A1AA;
      --cyan: #38BDF8;
      --amber: #F2B705;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 14px 24px;
      background: #0B0B0F;
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 20;
    }
    .brand { font-weight: 700; font-size: 17px; letter-spacing: -0.02em; }
    .nav-tabs { display: flex; gap: 20px; }
    .nav-tabs button {
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--muted);
      font-size: 13px;
      font-weight: 600;
      padding: 4px 2px;
      cursor: pointer;
    }
    .nav-tabs button.active { color: var(--text); border-color: var(--amber); }
    .btn {
      background: var(--surface-alt);
      color: var(--text);
      border: 1px solid #2E2E38;
      padding: 7px 13px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn-primary { background: var(--amber); color: #08080A; border-color: var(--amber); }
    .btn-cyan { background: var(--cyan); color: #08080A; border-color: var(--cyan); }
    .subbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 9px 24px;
      background: #101015;
      border-bottom: 1px solid var(--border);
      font-size: 12px;
      color: var(--muted);
      flex-wrap: wrap;
      gap: 12px;
    }
    .workspace {
      display: grid;
      grid-template-columns: 420px 1fr;
      flex: 1;
      min-height: calc(100vh - 95px);
    }
    @media (max-width: 1024px) {
      .workspace { grid-template-columns: 1fr; }
    }
    .left-pane {
      border-right: 1px solid var(--border);
      background: #0D0D11;
      display: flex;
      flex-direction: column;
      padding: 18px;
      gap: 12px;
    }
    .script-box {
      flex: 1;
      background: #101016;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
      font-family: "Courier New", Courier, monospace;
      font-size: 12.5px;
      line-height: 1.55;
      color: #E4E4E7;
      overflow-y: auto;
      max-height: 68vh;
      white-space: pre-wrap;
    }
    .right-pane {
      padding: 22px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      overflow-y: auto;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 20px;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      cursor: pointer;
    }
    .card.selected { border-color: var(--cyan); }
    .card-head {
      padding: 10px 14px;
      border-bottom: 1px solid #1E1E26;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
    }
    .viewport {
      width: 100%;
      aspect-ratio: 16 / 9;
      background: #101216;
      position: relative;
    }
    .card-body {
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-family: "Courier New", Courier, monospace;
      font-size: 11.5px;
    }
    .slug {
      background: #17171F;
      padding: 5px 8px;
      border-radius: 4px;
      font-weight: 700;
      color: var(--text);
    }
    .specs { color: var(--cyan); }
    .blocking { color: #94A3B8; border-top: 1px solid #1E1E26; padding-top: 6px; }
    .dialogue-box {
      background: #0B0B10;
      border: 1px solid #1E1E28;
      border-radius: 6px;
      padding: 8px 10px;
      margin-top: 4px;
      color: var(--amber);
    }
    .inspector {
      background: #0E0E13;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
    }
    .field label {
      display: block;
      font-size: 11px;
      color: var(--muted);
      margin-bottom: 4px;
    }
    .field input, .field select, .field textarea {
      width: 100%;
      background: var(--surface-alt);
      border: 1px solid #2A2A35;
      color: var(--text);
      padding: 7px 9px;
      border-radius: 6px;
      font-size: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      font-family: "Courier New", Courier, monospace;
    }
    th, td {
      border-bottom: 1px solid var(--border);
      padding: 11px 12px;
      text-align: left;
    }
    th { background: #14141B; color: var(--muted); }
    .hidden { display: none !important; }
    @media print {
      header, .subbar, .left-pane, .inspector { display: none !important; }
      body { background: #fff; color: #000; }
      .workspace { display: block; }
      .card { break-inside: avoid; border: 1px solid #ccc; margin-bottom: 14px; }
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">CineBoard Desktop Studio (Standalone Internal Build)</div>
    <nav class="nav-tabs">
      <button id="tab-workspace" class="active" onclick="switchTab('workspace')">Blocking Workspace</button>
      <button id="tab-shotlist" onclick="switchTab('shotlist')">Shot Schedule</button>
    </nav>
    <div style="display:flex;gap:8px;">
      <button class="btn" onclick="toggleGuides()" id="btn-guides">Guides: ON</button>
      <button class="btn" onclick="exportJson()">Save .json</button>
      <button class="btn btn-primary" onclick="window.print()">Print / Save PDF</button>
    </div>
  </header>

  <div class="subbar">
    <div id="project-summary"></div>
    <div style="font-family:monospace;font-size:11px;">
      <span style="color:#38BDF8;">→ CAM VECTOR</span> ·
      <span style="color:#F2B705;">→ SUBJECT / SIGHTLINE</span> ·
      <span>+ VP / HORIZON</span>
    </div>
  </div>

  <div id="view-workspace" class="workspace">
    <aside class="left-pane">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong style="font-size:14px;">Fade In Screenplay Manuscript</strong>
        <button class="btn" onclick="addSetup()">+ Add Setup</button>
      </div>
      <textarea id="script-editor" class="script-box" oninput="updateScript(this.value)"></textarea>
    </aside>

    <section class="right-pane">
      <div id="inspector-container" class="inspector"></div>
      <div id="panels-grid" class="grid"></div>
    </section>
  </div>

  <div id="view-shotlist" class="hidden" style="padding:24px;max-width:1280px;margin:0 auto;width:100%;">
    <h2 style="margin-bottom:16px;">Master Technical Shot Schedule</h2>
    <div style="background:#0E0E13;border:1px solid var(--border);border-radius:12px;overflow:hidden;">
      <table>
        <thead>
          <tr>
            <th>SETUP</th>
            <th>SCENE HEADING</th>
            <th>SHOT / ELEVATION</th>
            <th>CAMERA VECTOR / LENS</th>
            <th>SPATIAL BLOCKING & ACTION</th>
            <th>EST</th>
          </tr>
        </thead>
        <tbody id="shotlist-tbody"></tbody>
      </table>
    </div>
  </div>

  <script>
    const STATE = ${safeJson};
    let showGuides = true;
    let selectedId = STATE.panels[0]?.id || null;

    function esc(s) {
      return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function buildSchematicSvg(panel) {
      const comp = panel.sceneComposition || {};
      const angle = (panel.cameraAngle || '').toLowerCase();
      const shot = (panel.shotSize || '').toLowerCase();
      const move = (panel.cameraMovement || '').toLowerCase();
      const isOverhead = angle.includes('overhead') || angle.includes('bird');
      const isLow = angle.includes('low');
      const isHigh = angle.includes('high');
      const isClose = shot.includes('close');
      const isMed = shot.includes('medium');

      const vpX = ((comp.vanishingPointX ?? 50) / 100) * 800;
      const vpY = comp.vanishingPointY ? (comp.vanishingPointY / 100) * 450 : (isOverhead ? 225 : isLow ? 335 : isHigh ? 120 : 220);
      const subjX = comp.subjectGridZone === 'left_third' ? 266 : comp.subjectGridZone === 'right_third' ? 533 : 400;

      let env = '';
      if (isOverhead) {
        env = '<rect x="160" y="85" width="480" height="280" fill="#161920" stroke="#94A3B8" stroke-width="2"/><circle cx="400" cy="225" r="46" stroke="#E2E8F0" stroke-width="2" fill="none"/>';
      } else {
        env = '<rect x="0" y="'+vpY+'" width="800" height="'+(450-vpY)+'" fill="#14171D"/>' +
              '<line x1="0" y1="'+vpY+'" x2="800" y2="'+vpY+'" stroke="#64748B" stroke-width="1.5"/>' +
              '<g stroke="#333946" stroke-width="1"><line x1="'+vpX+'" y1="'+vpY+'" x2="0" y2="0"/><line x1="'+vpX+'" y1="'+vpY+'" x2="800" y2="0"/><line x1="'+vpX+'" y1="'+vpY+'" x2="0" y2="450"/><line x1="'+vpX+'" y1="'+vpY+'" x2="800" y2="450"/></g>' +
              '<rect x="'+(vpX-130)+'" y="'+(vpY-85)+'" width="260" height="155" stroke="#64748B" fill="none"/>' +
              '<circle cx="'+vpX+'" cy="'+vpY+'" r="3.5" fill="#F2B705"/>';
      }

      let subj = '';
      if (!isOverhead) {
        if (isClose) {
          subj = '<g transform="translate('+subjX+',240)" stroke="#F4F4F5" stroke-width="2.2" fill="#181C24"><path d="M-135,210 C-125,95 -75,62 0,62 C75,62 125,95 135,210 Z"/><ellipse cx="0" cy="-45" rx="62" ry="80"/></g>';
        } else if (isMed) {
          subj = '<g transform="translate('+subjX+',220)" stroke="#F4F4F5" stroke-width="2.2" fill="#181C24"><polygon points="-65,-10 65,-10 50,145 -50,145"/><ellipse cx="0" cy="-70" rx="35" ry="45"/></g>';
        } else {
          subj = '<g transform="translate('+subjX+','+Math.min(vpY+125,360)+')" stroke="#F4F4F5" stroke-width="2" fill="#181C24"><polygon points="-32,-145 32,-145 24,-68 -24,-68"/><ellipse cx="0" cy="-174" rx="18" ry="23"/><line x1="-16" y1="-68" x2="-22" y2="35" stroke-width="10"/><line x1="16" y1="-68" x2="22" y2="35" stroke-width="10"/></g>';
        }
      }

      const guides = showGuides
        ? '<rect x="40" y="22.5" width="720" height="405" fill="none" stroke="#64748B" stroke-opacity="0.35"/><g stroke="#94A3B8" stroke-opacity="0.28" stroke-dasharray="5 5"><line x1="266.6" y1="22.5" x2="266.6" y2="427.5"/><line x1="533.3" y1="22.5" x2="533.3" y2="427.5"/><line x1="40" y1="157.5" x2="760" y2="157.5"/><line x1="40" y1="292.5" x2="760" y2="292.5"/></g>'
        : '';

      let cam = '';
      if (move.includes('push')) {
        cam = '<rect x="135" y="75" width="530" height="300" fill="none" stroke="#38BDF8" stroke-width="2" stroke-dasharray="6 4"/><text x="400" y="66" text-anchor="middle" fill="#38BDF8" font-size="11" font-family="monospace" font-weight="bold">CAM: PUSH IN (Z+)</text>';
      } else if (move.includes('pull') || move.includes('crane')) {
        cam = '<rect x="155" y="88" width="490" height="274" fill="none" stroke="#38BDF8" stroke-width="2" stroke-dasharray="6 4"/><text x="400" y="80" text-anchor="middle" fill="#38BDF8" font-size="11" font-family="monospace" font-weight="bold">CAM: PULL BACK / CRANE (Z-)</text>';
      } else if (!move.includes('static')) {
        cam = '<line x1="140" y1="46" x2="660" y2="46" stroke="#38BDF8" stroke-width="3"/><text x="400" y="36" text-anchor="middle" fill="#38BDF8" font-size="11" font-family="monospace" font-weight="bold">CAM: '+esc(panel.cameraMovement.toUpperCase())+'</text>';
      }

      return '<svg viewBox="0 0 800 450" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="450" fill="#101216"/>'+env+subj+guides+cam+'</svg>';
    }

    function render() {
      document.getElementById('script-editor').value = STATE.scriptText;
      const totalSec = STATE.panels.reduce((acc, p) => acc + (Number(p.durationSeconds) || 3.5), 0);
      document.getElementById('project-summary').innerHTML =
        '<strong>'+esc(STATE.projectTitle)+'</strong> · '+STATE.panels.length+' Setups · Frame Gate '+esc(STATE.aspectRatio)+' · Est. '+totalSec.toFixed(1)+'s';

      const grid = document.getElementById('panels-grid');
      grid.innerHTML = STATE.panels.map((p) => {
        const isSel = p.id === selectedId;
        return '<article class="card '+(isSel?'selected':'')+'" onclick="selectPanel(\\''+p.id+'\\')">' +
          '<div class="card-head"><span style="color:#38BDF8;font-family:monospace;font-weight:700;">SETUP '+String(p.panelNumber).padStart(2,'0')+' · '+esc(p.title)+'</span><span style="font-family:monospace;color:#A1A1AA;">'+p.durationSeconds+'s</span></div>' +
          '<div class="viewport">'+buildSchematicSvg(p)+'</div>' +
          '<div class="card-body">' +
            '<div class="slug">'+esc(p.sceneSlugline)+'</div>' +
            '<div class="specs">'+esc(p.shotSize)+' · '+esc(p.cameraAngle)+' · '+esc(p.lensFocalLength)+' · '+esc(p.cameraMovement)+'</div>' +
            '<div class="blocking"><strong>BLOCKING:</strong> '+esc(p.blockingNotes)+'</div>' +
            '<div>'+esc(p.actionNotes)+'</div>' +
            '<div class="dialogue-box">'+esc(p.dialogueSnippet)+'</div>' +
          '</div>' +
        '</article>';
      }).join('');

      const active = STATE.panels.find((p) => p.id === selectedId) || STATE.panels[0];
      const insp = document.getElementById('inspector-container');
      if (active) {
        insp.innerHTML =
          '<div class="field"><label>Setup Title</label><input value="'+esc(active.title)+'" oninput="updatePanelField(\\''+active.id+'\\',\\'title\\',this.value)"/></div>' +
          '<div class="field"><label>Scene Heading</label><input value="'+esc(active.sceneSlugline)+'" oninput="updatePanelField(\\''+active.id+'\\',\\'sceneSlugline\\',this.value.toUpperCase())"/></div>' +
          '<div class="field"><label>Shot Size</label><select onchange="updatePanelField(\\''+active.id+'\\',\\'shotSize\\',this.value)">' +
            ['Extreme Wide Shot','Wide Shot','Medium Wide Shot','Medium Shot','Medium Close-Up','Close-Up','Extreme Close-Up'].map(s=>'<option '+(active.shotSize===s?'selected':'')+'>'+s+'</option>').join('') +
          '</select></div>' +
          '<div class="field"><label>Camera Elevation</label><select onchange="updatePanelField(\\''+active.id+'\\',\\'cameraAngle\\',this.value)">' +
            ['Eye Level','Low Angle','High Angle','Dutch Angle',"Overhead Bird's-Eye",'Over-the-Shoulder'].map(a=>'<option '+(active.cameraAngle===a?'selected':'')+'>'+a+'</option>').join('') +
          '</select></div>' +
          '<div class="field"><label>Camera Vector</label><select onchange="updatePanelField(\\''+active.id+'\\',\\'cameraMovement\\',this.value)">' +
            ['Static Lock-off','Slow Push In','Pull Back / Zoom Out','Tracking / Dolly Lateral','Pan Left / Right','Tilt Up / Down','Crane Up / Down'].map(m=>'<option '+(active.cameraMovement===m?'selected':'')+'>'+m+'</option>').join('') +
          '</select></div>' +
          '<div class="field"><label>Subject Rule-of-Thirds</label><select onchange="updateCompField(\\''+active.id+'\\',\\'subjectGridZone\\',this.value)">' +
            [['left_third','Left Vertical Third'],['center','Center Axis'],['right_third','Right Vertical Third']].map(([k,l])=>'<option value="'+k+'" '+((active.sceneComposition?.subjectGridZone||'center')===k?'selected':'')+'>'+l+'</option>').join('') +
          '</select></div>';
      }

      const tbody = document.getElementById('shotlist-tbody');
      tbody.innerHTML = STATE.panels.map((p) =>
        '<tr>' +
          '<td style="color:#38BDF8;font-weight:700;">'+String(p.panelNumber).padStart(2,'0')+'</td>' +
          '<td>'+esc(p.sceneSlugline)+'</td>' +
          '<td>'+esc(p.shotSize)+' · '+esc(p.cameraAngle)+'</td>' +
          '<td style="color:#F2B705;">'+esc(p.cameraMovement)+' · '+esc(p.lensFocalLength)+'</td>' +
          '<td>'+esc(p.blockingNotes)+'<br/><span style="color:#A1A1AA;">'+esc(p.actionNotes)+'</span></td>' +
          '<td>'+Number(p.durationSeconds).toFixed(1)+'s</td>' +
        '</tr>'
      ).join('');
    }

    function selectPanel(id) { selectedId = id; render(); }
    function updateScript(val) { STATE.scriptText = val; }
    function updatePanelField(id, field, val) {
      const p = STATE.panels.find(x => x.id === id);
      if (p) { p[field] = val; render(); }
    }
    function updateCompField(id, field, val) {
      const p = STATE.panels.find(x => x.id === id);
      if (p) {
        p.sceneComposition = p.sceneComposition || {};
        p.sceneComposition[field] = val;
        render();
      }
    }
    function toggleGuides() {
      showGuides = !showGuides;
      document.getElementById('btn-guides').textContent = 'Guides: ' + (showGuides ? 'ON' : 'OFF');
      render();
    }
    function addSetup() {
      const n = STATE.panels.length + 1;
      const p = {
        id: 'panel-' + Date.now(),
        panelNumber: n,
        title: 'Camera Setup ' + n,
        sceneSlugline: 'INT. LOCATION - DAY',
        shotSize: 'Medium Shot',
        cameraAngle: 'Eye Level',
        cameraMovement: 'Static Lock-off',
        lensFocalLength: '35mm Standard Wide',
        durationSeconds: 3.5,
        actionNotes: 'Subject A enters frame and holds on left third.',
        dialogueSnippet: 'No dialogue',
        blockingNotes: '1-point perspective grid; primary figure on left third intersection.',
        sceneComposition: { vanishingPointX: 50, vanishingPointY: 48, subjectGridZone: 'left_third' }
      };
      STATE.panels.push(p);
      selectedId = p.id;
      render();
    }
    function switchTab(tab) {
      document.getElementById('view-workspace').classList.toggle('hidden', tab !== 'workspace');
      document.getElementById('view-shotlist').classList.toggle('hidden', tab !== 'shotlist');
      document.getElementById('tab-workspace').classList.toggle('active', tab === 'workspace');
      document.getElementById('tab-shotlist').classList.toggle('active', tab === 'shotlist');
    }
    function exportJson() {
      const blob = new Blob([JSON.stringify(STATE, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'storyboard-desktop-project.json';
      a.click();
    }

    render();
  </script>
</body>
</html>`;
}

/**
 * Packages and downloads a complete Standalone Desktop Testing Bundle (`.zip`)
 * containing the self-contained single-file HTML5 Desktop Application, the native
 * `.fadein` screenplay file, the `.json` storyboard project file, and desktop launcher instructions.
 */
export async function downloadStandaloneDesktopBundle(params: {
  projectTitle: string;
  draftingMode: string;
  aspectRatio: '16:9' | '2.39:1' | '4:3';
  scriptText: string;
  scriptElements: ScreenplayElement[];
  panels: StoryboardPanel[];
  fadeInBlob: Blob;
}): Promise<void> {
  const safeSlug =
    params.projectTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'cineboard-project';

  const standaloneHtml = buildStandaloneDesktopHtml(params);

  const readmeText = `CINEBOARD STUDIO — STANDALONE DESKTOP TESTING BUILD
====================================================
Project: ${params.projectTitle}
Exported: ${new Date().toISOString()}

INCLUDED FILES IN THIS DESKTOP BUNDLE:
1. ${safeSlug}-desktop-app.html
   - A 100% standalone, zero-dependency offline desktop application.
   - Double-click to open directly in any desktop browser (Chrome, Edge, Safari, Firefox) with no server or internet connection required.
   - Supports interactive spatial blocking edits, shot size/elevation/vector changes, rule-of-thirds guides, shot schedule tables, and native Print/PDF output.

2. ${safeSlug}.fadein
   - Native Fade In Professional Screenwriting Software archive (Open Screenplay Format document.xml).

3. ${safeSlug}-project.json
   - Complete structured JSON storyboard & camera setup data.
`;

  const zip = new JSZip();
  zip.file(`${safeSlug}-desktop-app.html`, standaloneHtml);
  zip.file(`${safeSlug}.fadein`, params.fadeInBlob);
  zip.file(`${safeSlug}-project.json`, JSON.stringify(params, null, 2));
  zip.file('README-DESKTOP-TESTING.txt', readmeText);

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeSlug}-standalone-desktop-bundle.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
