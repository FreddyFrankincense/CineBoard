import { jsPDF } from 'jspdf';
import { StoryboardPanel } from '../types';

export interface PdfExportOptions {
  projectTitle: string;
  draftingMode: string;
  aspectRatio: '16:9' | '2.39:1' | '4:3';
  panels: StoryboardPanel[];
  showCompositionGuides: boolean;
  includeShotSchedulePage: boolean;
  layoutPerPage: '2-up' | '4-up';
  productionNotes?: string;
}

/**
 * Generates an offscreen SVG markup string for a panel's technical blueprint schematic
 * (matching CinematicFallbackPlate's perspective grid, mannequin outlines, and camera movement vectors)
 * and rasterizes it onto a high-DPI HTML5 canvas (1600x900) so it embeds sharply in the PDF.
 */
function buildTechnicalSchematicSvgString(panel: StoryboardPanel, showGuides: boolean): string {
  const comp = panel.sceneComposition || {
    environmentType: 'interior_room',
    primarySubject: 'standing_figure',
    timeOfDay: 'day',
    primaryColorHex: '#101216',
    secondaryColorHex: '#181B20',
    highlightColorHex: '#38BDF8',
    vanishingPointX: 50,
    vanishingPointY: 48,
    subjectGridZone: 'center',
    subjectMotionDirection: 'none',
    cameraMotionVector: 'static',
  };

  const angleLower = panel.cameraAngle.toLowerCase();
  const shotLower = panel.shotSize.toLowerCase();
  const moveLower = panel.cameraMovement.toLowerCase();

  const isLowAngle = angleLower.includes('low');
  const isHighAngle = angleLower.includes('high');
  const isOverhead = angleLower.includes('overhead') || angleLower.includes('bird');
  const isDutch = angleLower.includes('dutch');
  const isOTS = angleLower.includes('shoulder');

  const isExtremeCloseUp = shotLower.includes('extreme close');
  const isCloseUp = !isExtremeCloseUp && shotLower.includes('close');
  const isMedium = shotLower.includes('medium');

  const vpX = ((comp.vanishingPointX ?? 50) / 100) * 800;
  const defaultHorizonY = isOverhead ? 225 : isLowAngle ? 335 : isHighAngle ? 120 : 220;
  const vpY = comp.vanishingPointY ? (comp.vanishingPointY / 100) * 450 : defaultHorizonY;

  const subjectX =
    comp.subjectGridZone === 'left_third' || comp.subjectGridZone === 'foreground_left'
      ? 266
      : comp.subjectGridZone === 'right_third' || comp.subjectGridZone === 'foreground_right'
      ? 533
      : 400;

  const camMove =
    comp.cameraMotionVector ||
    (moveLower.includes('push') || moveLower.includes('in')
      ? 'push_in'
      : moveLower.includes('pull') || moveLower.includes('out') || moveLower.includes('crane up')
      ? 'pull_out'
      : moveLower.includes('pan')
      ? 'pan_right'
      : moveLower.includes('tilt')
      ? 'tilt_up'
      : moveLower.includes('track') || moveLower.includes('dolly')
      ? 'track_lateral'
      : 'static');

  const escapeXml = (s: string) =>
    (s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const primaryLabel = escapeXml((comp.subjectLabel || 'SUBJ A').slice(0, 14).toUpperCase());
  const secondaryLabel = escapeXml((comp.secondarySubjectLabel || '').slice(0, 14).toUpperCase());
  const hasSecondarySubject =
    Boolean(secondaryLabel) ||
    isOTS ||
    (comp.secondarySubjectZone && comp.secondarySubjectZone !== 'none') ||
    comp.primarySubject === 'two_figures_conversing';

  const secondaryZone =
    comp.secondarySubjectZone && comp.secondarySubjectZone !== 'none'
      ? comp.secondarySubjectZone
      : isOTS
      ? comp.subjectGridZone === 'right_third'
        ? 'foreground_ots_left'
        : 'foreground_ots_right'
      : comp.subjectGridZone === 'left_third'
      ? 'right_third'
      : 'left_third';

  const secondaryX =
    secondaryZone === 'left_third'
      ? 266
      : secondaryZone === 'right_third'
      ? 533
      : secondaryZone === 'foreground_ots_left'
      ? 145
      : secondaryZone === 'foreground_ots_right'
      ? 655
      : 533;

  let environmentSvg = '';
  if (isOverhead) {
    environmentSvg = `
      <g stroke="#3F4451" stroke-width="1" fill="none">
        <line x1="100" y1="0" x2="100" y2="450" stroke-opacity="0.45"/>
        <line x1="200" y1="0" x2="200" y2="450" stroke-opacity="0.45"/>
        <line x1="300" y1="0" x2="300" y2="450" stroke-opacity="0.45"/>
        <line x1="400" y1="0" x2="400" y2="450" stroke-opacity="0.45"/>
        <line x1="500" y1="0" x2="500" y2="450" stroke-opacity="0.45"/>
        <line x1="600" y1="0" x2="600" y2="450" stroke-opacity="0.45"/>
        <line x1="700" y1="0" x2="700" y2="450" stroke-opacity="0.45"/>
        <line x1="0" y1="75" x2="800" y2="75" stroke-opacity="0.45"/>
        <line x1="0" y1="150" x2="800" y2="150" stroke-opacity="0.45"/>
        <line x1="0" y1="225" x2="800" y2="225" stroke-opacity="0.45"/>
        <line x1="0" y1="300" x2="800" y2="300" stroke-opacity="0.45"/>
        <line x1="0" y1="375" x2="800" y2="375" stroke-opacity="0.45"/>
        <rect x="160" y="85" width="480" height="280" fill="#161920" stroke="#94A3B8" stroke-width="2"/>
        <rect x="210" y="130" width="95" height="70" stroke="#CBD5E1" stroke-width="1.5"/>
        <rect x="490" y="125" width="90" height="75" stroke="#CBD5E1" stroke-width="1.5"/>
        <rect x="230" y="255" width="110" height="70" stroke="#CBD5E1" stroke-width="1.5"/>
        <circle cx="400" cy="225" r="46" stroke="#E2E8F0" stroke-width="2"/>
        <line x1="257" y1="165" x2="354" y2="225" stroke="#94A3B8" stroke-dasharray="4 4"/>
        <line x1="340" y1="290" x2="365" y2="255" stroke="#94A3B8" stroke-dasharray="4 4"/>
        <line x1="446" y1="225" x2="490" y2="162" stroke="#94A3B8" stroke-dasharray="4 4"/>
      </g>`;
  } else {
    environmentSvg = `
      <g>
        <rect x="0" y="${vpY}" width="800" height="${450 - vpY}" fill="#14171D"/>
        <line x1="0" y1="${vpY}" x2="800" y2="${vpY}" stroke="#64748B" stroke-width="1.5"/>
        <text x="14" y="${vpY - 6}" fill="#64748B" font-size="10" font-family="monospace">HL (${escapeXml(panel.cameraAngle.toUpperCase())})</text>
        <g stroke="#333946" stroke-width="1">
          <line x1="${vpX}" y1="${vpY}" x2="0" y2="0"/>
          <line x1="${vpX}" y1="${vpY}" x2="266" y2="0"/>
          <line x1="${vpX}" y1="${vpY}" x2="533" y2="0"/>
          <line x1="${vpX}" y1="${vpY}" x2="800" y2="0"/>
          <line x1="${vpX}" y1="${vpY}" x2="0" y2="450"/>
          <line x1="${vpX}" y1="${vpY}" x2="180" y2="450"/>
          <line x1="${vpX}" y1="${vpY}" x2="380" y2="450"/>
          <line x1="${vpX}" y1="${vpY}" x2="600" y2="450"/>
          <line x1="${vpX}" y1="${vpY}" x2="800" y2="450"/>
          <line x1="${vpX}" y1="${vpY}" x2="0" y2="${vpY + 110}"/>
          <line x1="${vpX}" y1="${vpY}" x2="800" y2="${vpY + 110}"/>
        </g>
        <g stroke="#2C323E" stroke-width="1">
          <line x1="0" y1="${vpY + 25}" x2="800" y2="${vpY + 25}"/>
          <line x1="0" y1="${vpY + 60}" x2="800" y2="${vpY + 60}"/>
          <line x1="0" y1="${vpY + 110}" x2="800" y2="${vpY + 110}"/>
          <line x1="0" y1="${vpY + 175}" x2="800" y2="${vpY + 175}"/>
        </g>
        <g stroke="#64748B" stroke-width="1.5" fill="none">
          <rect x="${vpX - 130}" y="${vpY - 85}" width="260" height="155" stroke-opacity="0.65" fill="#12151B" fill-opacity="0.5"/>
          <line x1="115" y1="22" x2="115" y2="412" stroke-opacity="0.55"/>
          <line x1="685" y1="22" x2="685" y2="412" stroke-opacity="0.55"/>
          <line x1="115" y1="22" x2="${vpX - 130}" y2="${vpY - 85}" stroke-opacity="0.55"/>
          <line x1="685" y1="22" x2="${vpX + 130}" y2="${vpY - 85}" stroke-opacity="0.55"/>
          <line x1="115" y1="412" x2="${vpX - 130}" y2="${vpY + 70}" stroke-opacity="0.55"/>
          <line x1="685" y1="412" x2="${vpX + 130}" y2="${vpY + 70}" stroke-opacity="0.55"/>
        </g>
        <circle cx="${vpX}" cy="${vpY}" r="3.5" fill="#F2B705"/>
        <text x="${vpX + 7}" y="${vpY - 6}" fill="#F2B705" font-size="9" font-family="monospace">VP</text>
      </g>`;
  }

  let subjectSvg = '';
  if (!isOverhead) {
    const otsAnchorX = secondaryZone === 'foreground_ots_right' ? 655 : 145;
    const isForegroundOts =
      isOTS ||
      secondaryZone === 'foreground_ots_left' ||
      secondaryZone === 'foreground_ots_right';
    const otsSvg = isForegroundOts
      ? `<g transform="translate(${otsAnchorX}, 0)" stroke="#94A3B8" stroke-width="2" fill="#181C23">
           <path d="M -165,450 C -135,310 -75,275 10,275 C 80,275 120,330 135,450 Z"/>
           <ellipse cx="0" cy="175" rx="68" ry="86"/>
           <text x="0" y="392" text-anchor="middle" fill="#94A3B8" font-size="10" font-family="monospace" font-weight="bold" stroke="none">${secondaryLabel || 'OTS FOREGROUND'}</text>
         </g>`
      : '';

    const twoShotPartnerSvg =
      hasSecondarySubject && !isForegroundOts && !isExtremeCloseUp
        ? `<g transform="translate(${secondaryX}, ${Math.min(vpY + 115, 345)}) scale(0.84)">
             <ellipse cx="0" cy="38" rx="48" ry="12" fill="#181D26" stroke="#64748B" stroke-width="1.2" stroke-dasharray="3 3"/>
             <g stroke="#CBD5E1" stroke-width="1.8" fill="#141820">
               <line x1="-18" y1="-42" x2="-24" y2="35" stroke-width="11" stroke-linecap="round"/>
               <line x1="18" y1="-42" x2="26" y2="35" stroke-width="11" stroke-linecap="round"/>
               <polygon points="-26,-68 26,-68 22,-40 -22,-40"/>
               <polygon points="-34,-145 34,-145 26,-68 -26,-68"/>
               <ellipse cx="0" cy="-174" rx="18" ry="23"/>
             </g>
             <text x="0" y="56" text-anchor="middle" fill="#94A3B8" font-size="11" font-family="monospace" font-weight="bold">${secondaryLabel || 'SUBJ B'}</text>
           </g>`
        : '';

    if (isExtremeCloseUp) {
      subjectSvg = `${otsSvg}
        <g transform="translate(${subjectX}, 225)" stroke="#F4F4F5" stroke-width="2.5" fill="#181C24">
          <ellipse cx="0" cy="0" rx="195" ry="230"/>
          <line x1="-195" y1="-15" x2="195" y2="-15" stroke="#94A3B8" stroke-width="1.5" stroke-dasharray="6 4"/>
          <line x1="0" y1="-230" x2="0" y2="230" stroke="#94A3B8" stroke-width="1.5" stroke-dasharray="6 4"/>
          <rect x="-110" y="-42" width="75" height="28" rx="4" stroke="#E2E8F0" stroke-width="2" fill="none"/>
          <rect x="35" y="-42" width="75" height="28" rx="4" stroke="#E2E8F0" stroke-width="2" fill="none"/>
          <circle cx="-72" cy="-28" r="7" fill="#F4F4F5"/>
          <circle cx="72" cy="-28" r="7" fill="#F4F4F5"/>
          <text x="0" y="190" text-anchor="middle" fill="#F2B705" font-size="11" font-family="monospace" font-weight="bold" stroke="none">${primaryLabel}</text>
        </g>`;
    } else if (isCloseUp) {
      const targetX = comp.subjectMotionDirection === 'right_to_left' ? -155 : 155;
      subjectSvg = `${otsSvg}${twoShotPartnerSvg}
        <g transform="translate(${subjectX}, 240)" stroke="#F4F4F5" stroke-width="2.2" fill="#181C24">
          <path d="M -145,210 C -135,95 -80,62 0,62 C 80,62 135,95 145,210 Z"/>
          <rect x="-24" y="20" width="48" height="48"/>
          <ellipse cx="0" cy="-45" rx="64" ry="82"/>
          <path d="M -64,-45 Q 0,-35 64,-45" fill="none" stroke="#94A3B8" stroke-width="1.5"/>
          <path d="M 0,-127 Q 14,-45 0,37" fill="none" stroke="#94A3B8" stroke-width="1.5"/>
          <line x1="15" y1="-45" x2="${targetX}" y2="-45" stroke="#F2B705" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#act-arrow)"/>
          <text x="0" y="155" text-anchor="middle" fill="#F2B705" font-size="11" font-family="monospace" font-weight="bold" stroke="none">${primaryLabel}</text>
        </g>`;
    } else if (isMedium) {
      subjectSvg = `${otsSvg}${twoShotPartnerSvg}
        <g transform="translate(${subjectX}, 220)" stroke="#F4F4F5" stroke-width="2.2" fill="#181C24">
          <polygon points="-68,-10 68,-10 52,145 -52,145"/>
          <polygon points="-52,145 52,145 60,220 -60,220"/>
          <line x1="0" y1="-10" x2="0" y2="220" stroke="#64748B" stroke-width="1.2"/>
          <circle cx="-74" cy="4" r="12"/>
          <circle cx="74" cy="4" r="12"/>
          <path d="M -78,16 L -98,110 L -65,175" fill="none" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M 78,16 L 105,95 L 55,140" fill="none" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
          <rect x="-14" y="-32" width="28" height="24"/>
          <ellipse cx="0" cy="-72" rx="36" ry="46"/>
          <line x1="-36" y1="-72" x2="36" y2="-72" stroke="#94A3B8" stroke-width="1.2"/>
          <line x1="0" y1="-118" x2="0" y2="-26" stroke="#94A3B8" stroke-width="1.2"/>
          <text x="0" y="185" text-anchor="middle" fill="#F2B705" font-size="11" font-family="monospace" font-weight="bold" stroke="none">${primaryLabel}</text>
        </g>`;
    } else {
      const footY = Math.min(vpY + 125, 360);
      const motionArrow =
        comp.subjectMotionDirection && comp.subjectMotionDirection !== 'none'
          ? `<g>
               <line x1="45" y1="-95" x2="${comp.subjectMotionDirection === 'right_to_left' ? -150 : 165}" y2="-95" stroke="#F2B705" stroke-width="3" marker-end="url(#act-arrow)"/>
               <text x="${comp.subjectMotionDirection === 'right_to_left' ? -95 : 105}" y="-104" text-anchor="middle" fill="#F2B705" font-size="9" font-family="monospace" font-weight="bold">ACTION PATH</text>
             </g>`
          : '';

      subjectSvg = `${otsSvg}${twoShotPartnerSvg}
        <g transform="translate(${subjectX}, ${footY})">
          <ellipse cx="0" cy="38" rx="52" ry="14" fill="#1E2430" stroke="#38BDF8" stroke-width="1.5" stroke-dasharray="4 3"/>
          <g stroke="#F4F4F5" stroke-width="2" fill="#181C24">
            <line x1="-18" y1="-42" x2="-24" y2="35" stroke-width="12" stroke-linecap="round"/>
            <line x1="18" y1="-42" x2="26" y2="35" stroke-width="12" stroke-linecap="round"/>
            <polygon points="-26,-68 26,-68 22,-40 -22,-40"/>
            <polygon points="-34,-145 34,-145 26,-68 -26,-68"/>
            <path d="M -36,-140 L -52,-85 L -38,-45" fill="none" stroke-width="9" stroke-linecap="round"/>
            <path d="M 36,-140 L 52,-85 L 42,-45" fill="none" stroke-width="9" stroke-linecap="round"/>
            <ellipse cx="0" cy="-174" rx="18" ry="23"/>
            <line x1="0" y1="-197" x2="0" y2="-40" stroke="#94A3B8" stroke-width="1"/>
          </g>
          <text x="0" y="56" text-anchor="middle" fill="#F2B705" font-size="10" font-family="monospace" font-weight="bold">${primaryLabel}</text>
          ${motionArrow}
        </g>`;
    }
  }

  const floorPlanInsetSvg = showGuides
    ? `<g transform="translate(48, 30)">
         <rect x="0" y="0" width="128" height="72" rx="4" fill="#0B0D12" fill-opacity="0.88" stroke="#334155" stroke-width="1.2"/>
         <text x="64" y="12" text-anchor="middle" fill="#94A3B8" font-size="7.5" font-family="monospace" font-weight="bold">180° AXIS FLOOR PLAN</text>
         <line x1="14" y1="34" x2="114" y2="34" stroke="#F2B705" stroke-opacity="0.65" stroke-width="1" stroke-dasharray="3 2"/>
         <circle cx="34" cy="34" r="5.5" fill="#181C24" stroke="#F2B705" stroke-width="1.4"/>
         <text x="34" y="36.5" text-anchor="middle" fill="#F2B705" font-size="6.5" font-family="monospace" font-weight="bold">A</text>
         ${
           hasSecondarySubject
             ? `<circle cx="94" cy="34" r="5.5" fill="#181C24" stroke="#94A3B8" stroke-width="1.4"/>
                <text x="94" y="36.5" text-anchor="middle" fill="#CBD5E1" font-size="6.5" font-family="monospace" font-weight="bold">B</text>`
             : ''
         }
         <g transform="translate(${comp.cameraSideOfAxis === 'B_SIDE_REVERSE' ? 78 : 50}, 58)">
           <polygon points="0,0 -15,-20 15,-20" fill="#38BDF8" fill-opacity="0.22" stroke="#38BDF8" stroke-width="1"/>
           <rect x="-5" y="0" width="10" height="6" rx="1" fill="#38BDF8"/>
         </g>
       </g>`
    : '';

  const guidesSvg = showGuides
    ? `<g>
         <rect x="40" y="22.5" width="720" height="405" fill="none" stroke="#64748B" stroke-opacity="0.35" stroke-width="1"/>
         <g stroke="#94A3B8" stroke-opacity="0.28" stroke-width="1" stroke-dasharray="5 5">
           <line x1="266.6" y1="22.5" x2="266.6" y2="427.5"/>
           <line x1="533.3" y1="22.5" x2="533.3" y2="427.5"/>
           <line x1="40" y1="157.5" x2="760" y2="157.5"/>
           <line x1="40" y1="292.5" x2="760" y2="292.5"/>
         </g>
         <g stroke="#38BDF8" stroke-opacity="0.65" stroke-width="1.2">
           <line x1="388" y1="225" x2="412" y2="225"/>
           <line x1="400" y1="213" x2="400" y2="237"/>
           <circle cx="400" cy="225" r="8" fill="none" stroke-opacity="0.4"/>
         </g>
         ${floorPlanInsetSvg}
       </g>`
    : '';

  let camVectorSvg = '';
  if (camMove === 'push_in') {
    camVectorSvg = `
      <g stroke="#38BDF8" stroke-width="2.5" fill="none">
        <rect x="135" y="75" width="530" height="300" stroke-dasharray="6 4" stroke-opacity="0.7"/>
        <line x1="55" y1="35" x2="125" y2="70" marker-end="url(#cam-arrow)"/>
        <line x1="745" y1="35" x2="675" y2="70" marker-end="url(#cam-arrow)"/>
        <line x1="55" y1="415" x2="125" y2="380" marker-end="url(#cam-arrow)"/>
        <line x1="745" y1="415" x2="675" y2="380" marker-end="url(#cam-arrow)"/>
        <text x="400" y="66" text-anchor="middle" fill="#38BDF8" font-size="10" font-family="monospace" font-weight="bold">CAM: PUSH IN (Z+)</text>
      </g>`;
  } else if (camMove === 'pull_out') {
    camVectorSvg = `
      <g stroke="#38BDF8" stroke-width="2.5" fill="none">
        <rect x="155" y="88" width="490" height="274" stroke-dasharray="6 4" stroke-opacity="0.7"/>
        <line x1="150" y1="84" x2="70" y2="42" marker-end="url(#cam-arrow)"/>
        <line x1="650" y1="84" x2="730" y2="42" marker-end="url(#cam-arrow)"/>
        <line x1="150" y1="366" x2="70" y2="408" marker-end="url(#cam-arrow)"/>
        <line x1="650" y1="366" x2="730" y2="408" marker-end="url(#cam-arrow)"/>
        <text x="400" y="80" text-anchor="middle" fill="#38BDF8" font-size="10" font-family="monospace" font-weight="bold">CAM: PULL BACK / CRANE OUT (Z-)</text>
      </g>`;
  } else if (camMove === 'pan_right' || camMove === 'pan_left' || camMove === 'track_lateral') {
    camVectorSvg = `
      <g stroke="#38BDF8" stroke-width="3" fill="none">
        <line x1="${camMove === 'pan_left' ? 680 : 120}" y1="48" x2="${camMove === 'pan_left' ? 120 : 680}" y2="48" marker-end="url(#cam-arrow)"/>
        <text x="400" y="38" text-anchor="middle" fill="#38BDF8" font-size="10" font-family="monospace" font-weight="bold">CAM: ${escapeXml(panel.cameraMovement.toUpperCase())}</text>
      </g>`;
  } else if (camMove === 'tilt_up' || camMove === 'tilt_down') {
    camVectorSvg = `
      <g stroke="#38BDF8" stroke-width="3" fill="none">
        <line x1="735" y1="${camMove === 'tilt_down' ? 75 : 375}" x2="735" y2="${camMove === 'tilt_down' ? 375 : 75}" marker-end="url(#cam-arrow)"/>
        <text x="722" y="225" text-anchor="end" fill="#38BDF8" font-size="10" font-family="monospace" font-weight="bold">${escapeXml(panel.cameraMovement.toUpperCase())}</text>
      </g>`;
  }

  return `<svg viewBox="0 0 800 450" width="1600" height="900" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="cam-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#38BDF8"/>
      </marker>
      <marker id="act-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#F2B705"/>
      </marker>
    </defs>
    <rect width="800" height="450" fill="#101216"/>
    <g ${isDutch ? 'transform="rotate(-7 400 225)"' : ''}>
      ${environmentSvg}
      ${subjectSvg}
    </g>
    ${guidesSvg}
    ${camVectorSvg}
  </svg>`;
}

/**
 * Converts a panel's visual representation (either an existing image/SVG data URL
 * or the parametric technical schematic) into a high-resolution PNG Data URL (1600x900)
 * suitable for crisp PDF embedding.
 */
async function renderPanelDiagramToPngDataUrl(
  panel: StoryboardPanel,
  showGuides: boolean
): Promise<string> {
  const width = 1600;
  const height = 900;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Helper to load an Image object from a source URL
  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = src;
    });

  try {
    if (panel.imageUrl) {
      const img = await loadImage(panel.imageUrl);
      ctx.fillStyle = '#101216';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      return canvas.toDataURL('image/png', 0.95);
    }
  } catch (err) {
    console.warn('Falling back to parametric technical schematic for PDF panel:', panel.panelNumber, err);
  }

  // Render the parametric technical SVG schematic to high-DPI PNG
  const svgString = buildTechnicalSchematicSvgString(panel, showGuides);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const blobUrl = URL.createObjectURL(svgBlob);
  try {
    const img = await loadImage(blobUrl);
    ctx.fillStyle = '#101216';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/png', 0.95);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Parses a panel's dialogueSnippet into structured Character Cue, Parenthetical, and Dialogue text
 * so the PDF exporter can render authentic Fade In indented screenplay margins.
 */
function parseDialogueForPdf(dialogueSnippet: string): {
  isNoDialogue: boolean;
  characterCue?: string;
  parenthetical?: string;
  dialogueBody: string;
} {
  const trimmed = (dialogueSnippet || '').trim();
  if (!trimmed || /^no dialogue/i.test(trimmed)) {
    return {
      isNoDialogue: true,
      dialogueBody: trimmed || 'No dialogue — ambient audio only',
    };
  }

  const match = trimmed.match(/^([A-Z][A-Z0-9\s.\-']*(\s*\([^)]+\))?)\s*:\s*(.+)$/s);
  if (match) {
    const characterCue = match[1].trim().toUpperCase();
    const rawBody = match[3].trim().replace(/^"|"$/g, '');
    const parenMatch = rawBody.match(/^(\([^)]+\))\s*(.+)$/s);
    if (parenMatch) {
      return {
        isNoDialogue: false,
        characterCue,
        parenthetical: parenMatch[1].trim(),
        dialogueBody: parenMatch[2].trim(),
      };
    }
    return {
      isNoDialogue: false,
      characterCue,
      dialogueBody: rawBody,
    };
  }

  return {
    isNoDialogue: false,
    dialogueBody: trimmed,
  };
}

/**
 * Generates and downloads a production-grade Film Crew Storyboard & Blocking Packet PDF.
 * Uses landscape US Letter (279.4mm x 215.9mm) with crisp diagrams, vector camera specs,
 * and Courier screenplay formatting for Scene Headings, Action, Character Cues, Parentheticals, and Dialogue.
 */
export async function exportStoryboardCrewPdf(
  options: PdfExportOptions,
  onProgress?: (message: string) => void
): Promise<void> {
  const {
    projectTitle,
    draftingMode,
    aspectRatio,
    panels,
    showCompositionGuides,
    includeShotSchedulePage,
    layoutPerPage,
    productionNotes,
  } = options;

  // Landscape US Letter in mm: 279.4 x 215.9
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 279.4
  const pageHeight = doc.internal.pageSize.getHeight(); // 215.9
  const margin = 12;

  const totalRuntime = panels.reduce((sum, p) => sum + (Number(p.durationSeconds) || 3.5), 0);
  const uniqueScenes = new Set(panels.map((p) => p.sceneSlugline.trim().toUpperCase())).size;
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  // Pre-render all panel diagrams at 1600x900 PNG
  const panelImageUrls: string[] = [];
  for (let i = 0; i < panels.length; i++) {
    if (onProgress) {
      onProgress(`Rasterizing high-DPI schematic ${i + 1} of ${panels.length}...`);
    }
    const dataUrl = await renderPanelDiagramToPngDataUrl(panels[i], showCompositionGuides);
    panelImageUrls.push(dataUrl);
  }

  // Helper to draw consistent Production Header & Footer on every page
  const drawPageChrome = (pageNum: number, totalPages: number, sectionLabel: string) => {
    // Top Header Bar
    doc.setFillColor(16, 18, 22);
    doc.rect(margin, 8, pageWidth - margin * 2, 11, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(244, 244, 245);
    doc.text(`${projectTitle.toUpperCase()} — CREW STORYBOARD & BLOCKING PACKET`, margin + 4, 14.8);

    doc.setFont('courier', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(56, 189, 248);
    doc.text(
      `${sectionLabel}  |  GATE: ${aspectRatio}  |  SETUPS: ${panels.length}  |  SCENES: ${uniqueScenes}  |  EST: ${totalRuntime.toFixed(1)}s`,
      pageWidth - margin - 4,
      14.8,
      { align: 'right' }
    );

    // Bottom Footer Hairline & Page Number
    doc.setDrawColor(210, 214, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `CineBoard Studio Technical Pre-Vis · Mode: ${draftingMode} · Generated ${dateStr}`,
      margin,
      pageHeight - 7
    );
    doc.setFont('courier', 'bold');
    doc.text(`PAGE ${pageNum} OF ${totalPages}`, pageWidth - margin, pageHeight - 7, {
      align: 'right',
    });
  };

  const panelsPerPage = layoutPerPage === '2-up' ? 2 : 4;
  const storyboardPageCount = Math.max(1, Math.ceil(panels.length / panelsPerPage));
  const totalPages = storyboardPageCount + (includeShotSchedulePage ? 1 : 0);

  // ============================================================================
  // PART 1: STORYBOARD CONTACT & SCRIPT EXCERPT PAGES (2-UP OR 4-UP)
  // ============================================================================
  for (let pageIdx = 0; pageIdx < storyboardPageCount; pageIdx++) {
    if (pageIdx > 0) {
      doc.addPage('letter', 'landscape');
    }

    drawPageChrome(pageIdx + 1, totalPages, 'TECHNICAL STORYBOARD');

    const startIdx = pageIdx * panelsPerPage;
    const pagePanels = panels.slice(startIdx, startIdx + panelsPerPage);

    if (layoutPerPage === '2-up') {
      // 2-UP DETAILED CREW BREAKDOWN: 2 Stacked Horizontal Rows per Page
      // Left side of row: Large 16:9 High-DPI Technical Diagram
      // Right side of row: Telemetry Box + Blocking Specification + Formatted Fade In Screenplay Excerpt
      const contentTop = 22;
      const availableHeight = pageHeight - contentTop - 14; // ~179.9mm
      const rowGap = 5;
      const rowHeight = (availableHeight - rowGap) / 2; // ~87.4mm
      const rowWidth = pageWidth - margin * 2; // 255.4mm

      pagePanels.forEach((panel, idxOnPage) => {
        const globalIdx = startIdx + idxOnPage;
        const rowY = contentTop + idxOnPage * (rowHeight + rowGap);

        // Outer Card Border
        doc.setFillColor(250, 251, 252);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.35);
        doc.roundedRect(margin, rowY, rowWidth, rowHeight, 2, 2, 'FD');

        // Left Column: Diagram Frame (Width 122mm, Height 68.6mm for 16:9 + Top/Bottom Strip)
        const diagX = margin + 3.5;
        const diagY = rowY + 11;
        const diagW = 122;
        const diagH = 68.6;

        // Setup Number Header Banner above Diagram
        doc.setFillColor(16, 18, 22);
        doc.rect(diagX, rowY + 3.5, diagW, 7, 'F');
        doc.setFont('courier', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(56, 189, 248);
        doc.text(
          `SETUP ${String(panel.panelNumber).padStart(2, '0')}`,
          diagX + 2.5,
          rowY + 8.2
        );
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(244, 244, 245);
        doc.text(
          panel.title.substring(0, 38),
          diagX + 24,
          rowY + 8.2
        );
        doc.setFont('courier', 'normal');
        doc.setTextColor(242, 183, 5);
        doc.text(
          `${panel.durationSeconds.toFixed(1)}s`,
          diagX + diagW - 2.5,
          rowY + 8.2,
          { align: 'right' }
        );

        // Draw High-DPI Technical Diagram Image
        const imgData = panelImageUrls[globalIdx];
        if (imgData) {
          doc.addImage(imgData, 'PNG', diagX, diagY, diagW, diagH, undefined, 'FAST');
        }
        doc.setDrawColor(30, 41, 59);
        doc.setLineWidth(0.3);
        doc.rect(diagX, diagY, diagW, diagH);

        // Right Column: Camera Mechanics & Formatted Fade In Screenplay Excerpt
        const rightX = diagX + diagW + 5;
        const rightW = rowWidth - diagW - 12; // ~121.4mm
        let cursorY = rowY + 3.5;

        // 1. Fade In Scene Heading (Slugline) Bar
        doc.setFillColor(226, 232, 240);
        doc.rect(rightX, cursorY, rightW, 6.5, 'F');
        doc.setFont('courier', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(panel.sceneSlugline.toUpperCase(), rightX + 2.5, cursorY + 4.5);
        cursorY += 8.5;

        // 2. Technical Camera & Optics Metadata Grid
        doc.setFillColor(241, 245, 249);
        doc.setDrawColor(203, 213, 225);
        doc.rect(rightX, cursorY, rightW, 11, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text('SHOT SIZE', rightX + 2.5, cursorY + 3.5);
        doc.text('ELEVATION ANGLE', rightX + 34, cursorY + 3.5);
        doc.text('LENS / OPTIC', rightX + 66, cursorY + 3.5);
        doc.text('CAMERA VECTOR', rightX + 94, cursorY + 3.5);

        doc.setFont('courier', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(panel.shotSize.substring(0, 17), rightX + 2.5, cursorY + 8.5);
        doc.text(panel.cameraAngle.substring(0, 17), rightX + 34, cursorY + 8.5);
        doc.text(panel.lensFocalLength.substring(0, 14), rightX + 66, cursorY + 8.5);
        doc.setTextColor(3, 105, 161);
        doc.text(panel.cameraMovement.substring(0, 16), rightX + 94, cursorY + 8.5);
        cursorY += 13.5;

        // 3. Spatial Blocking & Composition Mechanics
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text('SPATIAL BLOCKING & COMPOSITION:', rightX, cursorY);
        cursorY += 3.5;

        doc.setFont('courier', 'normal');
        doc.setFontSize(7.8);
        doc.setTextColor(30, 41, 59);
        const blockingLines = doc.splitTextToSize(
          panel.blockingNotes || '1-point perspective grid; primary figure on rule-of-thirds intersection.',
          rightW
        );
        doc.text(blockingLines.slice(0, 2), rightX, cursorY);
        cursorY += Math.min(blockingLines.length, 2) * 3.6 + 2.5;

        // 4. Formatted Fade In Screenplay Excerpt Box (Courier 12pt style proportional miniature)
        const scriptBoxH = Math.max(22, rowY + rowHeight - cursorY - 3.5);
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.rect(rightX, cursorY, rightW, scriptBoxH, 'FD');

        let scriptY = cursorY + 4;

        // Action Paragraph (Full Width Screenplay Margin)
        doc.setFont('courier', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        const actionLines = doc.splitTextToSize(panel.actionNotes, rightW - 6);
        doc.text(actionLines.slice(0, 3), rightX + 3, scriptY);
        scriptY += Math.min(actionLines.length, 3) * 3.5 + 2.5;

        // Character Cue, Parenthetical & Indented Dialogue (Standard Fade In Screenplay Indentation)
        const parsedDial = parseDialogueForPdf(panel.dialogueSnippet);
        if (parsedDial.isNoDialogue) {
          doc.setFont('courier', 'italic');
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          doc.text(parsedDial.dialogueBody, rightX + 3, scriptY);
        } else {
          if (parsedDial.characterCue && scriptY < cursorY + scriptBoxH - 7) {
            doc.setFont('courier', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(15, 23, 42);
            // Centered/Indented Character Cue (~38% across script column)
            doc.text(parsedDial.characterCue, rightX + rightW * 0.36, scriptY);
            scriptY += 3.3;
          }
          if (parsedDial.parenthetical && scriptY < cursorY + scriptBoxH - 5) {
            doc.setFont('courier', 'italic');
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            doc.text(parsedDial.parenthetical, rightX + rightW * 0.3, scriptY);
            scriptY += 3.2;
          }
          if (scriptY < cursorY + scriptBoxH - 2) {
            doc.setFont('courier', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(15, 23, 42);
            const dialIndentX = rightX + rightW * 0.18;
            const dialMaxW = rightW * 0.64;
            const dialLines = doc.splitTextToSize(parsedDial.dialogueBody, dialMaxW);
            doc.text(dialLines.slice(0, 2), dialIndentX, scriptY);
          }
        }
      });
    } else {
      // 4-UP COMPACT CONTACT SHEET GRID (2x2 Grid per Landscape Page)
      const contentTop = 22;
      const availableHeight = pageHeight - contentTop - 14;
      const gapX = 5;
      const gapY = 5;
      const cardW = (pageWidth - margin * 2 - gapX) / 2; // ~125.2mm
      const cardH = (availableHeight - gapY) / 2; // ~87.4mm

      pagePanels.forEach((panel, idxOnPage) => {
        const globalIdx = startIdx + idxOnPage;
        const col = idxOnPage % 2;
        const row = Math.floor(idxOnPage / 2);
        const cardX = margin + col * (cardW + gapX);
        const cardY = contentTop + row * (cardH + gapY);

        doc.setFillColor(250, 251, 252);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.35);
        doc.roundedRect(cardX, cardY, cardW, cardH, 2, 2, 'FD');

        // Header Strip
        doc.setFillColor(16, 18, 22);
        doc.rect(cardX + 2.5, cardY + 2.5, cardW - 5, 6, 'F');
        doc.setFont('courier', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(56, 189, 248);
        doc.text(
          `SETUP ${String(panel.panelNumber).padStart(2, '0')} · ${panel.sceneSlugline.substring(0, 28)}`,
          cardX + 4.5,
          cardY + 6.7
        );
        doc.setTextColor(242, 183, 5);
        doc.text(
          `${panel.shotSize} · ${panel.durationSeconds.toFixed(1)}s`,
          cardX + cardW - 4.5,
          cardY + 6.7,
          { align: 'right' }
        );

        // Left Sub-column inside 4-up card: Diagram (68mm x 38.25mm)
        const diagW = 70;
        const diagH = 39.4;
        const diagX = cardX + 2.5;
        const diagY = cardY + 10;
        const imgData = panelImageUrls[globalIdx];
        if (imgData) {
          doc.addImage(imgData, 'PNG', diagX, diagY, diagW, diagH, undefined, 'FAST');
        }
        doc.setDrawColor(30, 41, 59);
        doc.rect(diagX, diagY, diagW, diagH);

        // Right Sub-column inside 4-up card: Camera Specs & Blocking
        const metaX = diagX + diagW + 3;
        const metaW = cardW - diagW - 8;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(doc.splitTextToSize(panel.title, metaW).slice(0, 2), metaX, diagY + 4);

        doc.setFont('courier', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(3, 105, 161);
        doc.text(`${panel.cameraAngle}`, metaX, diagY + 12);
        doc.text(`${panel.cameraMovement}`, metaX, diagY + 16);
        doc.setTextColor(71, 85, 105);
        doc.text(`Lens: ${panel.lensFocalLength}`, metaX, diagY + 20);

        doc.setFont('courier', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(51, 65, 85);
        const blockLines = doc.splitTextToSize(panel.blockingNotes || '', metaW);
        doc.text(blockLines.slice(0, 4), metaX, diagY + 25.5);

        // Bottom Strip inside 4-up card: Formatted Screenplay Excerpt (Action + Dialogue)
        const scriptBoxY = diagY + diagH + 2.5;
        const scriptBoxH = cardY + cardH - scriptBoxY - 2.5;
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.rect(cardX + 2.5, scriptBoxY, cardW - 5, scriptBoxH, 'FD');

        doc.setFont('courier', 'normal');
        doc.setFontSize(7.2);
        doc.setTextColor(15, 23, 42);
        const actLines = doc.splitTextToSize(panel.actionNotes, cardW - 9);
        doc.text(actLines.slice(0, 2), cardX + 4.5, scriptBoxY + 4);

        const parsedDial = parseDialogueForPdf(panel.dialogueSnippet);
        if (!parsedDial.isNoDialogue) {
          let dy = scriptBoxY + 11.5;
          if (parsedDial.characterCue) {
            doc.setFont('courier', 'bold');
            doc.text(
              `${parsedDial.characterCue}${parsedDial.parenthetical ? ' ' + parsedDial.parenthetical : ''}`,
              cardX + cardW * 0.3,
              dy
            );
            dy += 3.2;
          }
          doc.setFont('courier', 'normal');
          const dLines = doc.splitTextToSize(parsedDial.dialogueBody, cardW * 0.65);
          doc.text(dLines.slice(0, 2), cardX + cardW * 0.16, dy);
        } else {
          doc.setFont('courier', 'italic');
          doc.setTextColor(100, 116, 139);
          doc.text(parsedDial.dialogueBody, cardX + 4.5, scriptBoxY + 13);
        }
      });
    }
  }

  // ============================================================================
  // PART 2: APPENDED TABULAR CREW SHOT SCHEDULE & CAMERA LOG SHEET
  // ============================================================================
  if (includeShotSchedulePage) {
    doc.addPage('letter', 'landscape');
    drawPageChrome(totalPages, totalPages, 'MASTER SHOT SCHEDULE');

    let tableY = 23;
    const tableW = pageWidth - margin * 2;

    if (productionNotes && productionNotes.trim()) {
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, tableY, tableW, 10, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`CREW / DIRECTOR NOTES: `, margin + 3, tableY + 6.2);
      doc.setFont('courier', 'normal');
      doc.text(productionNotes.trim().substring(0, 130), margin + 38, tableY + 6.2);
      tableY += 13;
    }

    // Table Header
    doc.setFillColor(16, 18, 22);
    doc.rect(margin, tableY, tableW, 8, 'F');
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(244, 244, 245);

    doc.text('SETUP', margin + 3, tableY + 5.3);
    doc.text('SCENE HEADING', margin + 18, tableY + 5.3);
    doc.text('SHOT / ELEVATION', margin + 74, tableY + 5.3);
    doc.text('CAMERA VECTOR / LENS', margin + 122, tableY + 5.3);
    doc.text('SPATIAL BLOCKING & ACTION', margin + 174, tableY + 5.3);
    doc.text('EST', margin + tableW - 3, tableY + 5.3, { align: 'right' });

    tableY += 8;

    panels.forEach((panel, idx) => {
      if (tableY > pageHeight - 24) return;
      const rowH = 12;
      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
      } else {
        doc.setFillColor(255, 255, 255);
      }
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, tableY, tableW, rowH, 'FD');

      doc.setFont('courier', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(3, 105, 161);
      doc.text(String(panel.panelNumber).padStart(2, '0'), margin + 4, tableY + 7.2);

      doc.setFont('courier', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(panel.sceneSlugline.substring(0, 30), margin + 18, tableY + 5.2);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(panel.title.substring(0, 32), margin + 18, tableY + 9.6);

      doc.setFont('courier', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(panel.shotSize.substring(0, 22), margin + 74, tableY + 5.2);
      doc.text(panel.cameraAngle.substring(0, 22), margin + 74, tableY + 9.6);

      doc.setFont('courier', 'bold');
      doc.setTextColor(3, 105, 161);
      doc.text(panel.cameraMovement.substring(0, 22), margin + 122, tableY + 5.2);
      doc.setFont('courier', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(panel.lensFocalLength.substring(0, 22), margin + 122, tableY + 9.6);

      doc.setFont('courier', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);
      doc.text((panel.blockingNotes || '').substring(0, 45), margin + 174, tableY + 5.2);
      doc.setTextColor(71, 85, 105);
      doc.text((panel.actionNotes || '').substring(0, 45), margin + 174, tableY + 9.6);

      doc.setFont('courier', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(`${panel.durationSeconds.toFixed(1)}s`, margin + tableW - 3, tableY + 7.2, {
        align: 'right',
      });

      tableY += rowH;
    });
  }

  const safeFilename =
    projectTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'storyboard';

  doc.save(`${safeFilename}-crew-storyboard.pdf`);
}
