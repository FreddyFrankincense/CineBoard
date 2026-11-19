import JSZip from 'jszip';

export type ScreenplayElementType =
  | 'scene_heading'
  | 'action'
  | 'character'
  | 'parenthetical'
  | 'dialogue'
  | 'transition'
  | 'shot'
  | 'note'
  | 'general';

export interface ScreenplayElement {
  id: string;
  type: ScreenplayElementType;
  text: string;
  sceneNumber?: string;
  dualDialogue?: boolean;
}

export interface ParsedFadeInDocument {
  title: string;
  author?: string;
  sourceFormat: 'fadein-zip' | 'fadein-xml' | 'fountain';
  elements: ScreenplayElement[];
  rawText: string;
}

/**
 * Maps Fade In Pro (Open Screenplay Format `document.xml`) style / base-style attributes
 * to standard industry screenplay element types.
 */
function mapFadeInStyleToElementType(styleAttr: string, text: string): ScreenplayElementType {
  const s = (styleAttr || '').toLowerCase().trim();
  if (s.includes('scene') || s.includes('heading') || s.includes('slug')) {
    return 'scene_heading';
  }
  if (s.includes('character')) {
    return 'character';
  }
  if (s.includes('parenthetical') || s.includes('paren')) {
    return 'parenthetical';
  }
  if (s.includes('dialogue')) {
    return 'dialogue';
  }
  if (s.includes('transition')) {
    return 'transition';
  }
  if (s.includes('shot')) {
    return 'shot';
  }
  if (s.includes('action') || s.includes('description')) {
    return 'action';
  }

  // Fallback heuristics if a paragraph in XML lacks an explicit style name
  const trimmed = text.trim();
  if (/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i.test(trimmed)) {
    return 'scene_heading';
  }
  if (/^\(.*\)$/.test(trimmed)) {
    return 'parenthetical';
  }
  if (/(TO:|FADE IN:|FADE OUT\.|CUT TO BLACK\.)$/i.test(trimmed) && trimmed === trimmed.toUpperCase()) {
    return 'transition';
  }
  return 'action';
}

/**
 * Parses an Open Screenplay Format XML string (`document.xml` inside a `.fadein` file
 * or standalone `.xml` / `.osf` export) into structured ScreenplayElements.
 */
export function parseFadeInXml(xmlString: string, fallbackTitle = 'Untitled Screenplay'): ParsedFadeInDocument {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  const elements: ScreenplayElement[] = [];
  let extractedTitle = fallbackTitle.replace(/\.(fadein|osf|xml|fountain|txt)$/i, '');
  let extractedAuthor = '';

  // Extract title/author from Fade In <titlepage> or <info> if present
  const titleNode =
    xmlDoc.querySelector('titlepage para[style*="Title" i], info title, meta[name="Title" i]');
  if (titleNode && titleNode.textContent?.trim()) {
    extractedTitle = titleNode.textContent.trim();
  }

  const authorNode =
    xmlDoc.querySelector('titlepage para[style*="Author" i], info author, meta[name="Author" i]');
  if (authorNode && authorNode.textContent?.trim()) {
    extractedAuthor = authorNode.textContent.trim();
  }

  // In Open Screenplay Format (Fade In), body paragraphs are <para> inside <paragraphs> (or root)
  const paraNodes = Array.from(xmlDoc.querySelectorAll('paragraphs > para, document > paragraphs > para, para'));

  paraNodes.forEach((para, idx) => {
    // Skip titlepage paragraphs
    if (para.closest('titlepage')) return;

    const styleEl = para.querySelector('style');
    const styleName =
      para.getAttribute('style') ||
      para.getAttribute('basestyle') ||
      styleEl?.getAttribute('basestyle') ||
      styleEl?.getAttribute('name') ||
      '';

    const sceneNum = para.getAttribute('scenenumber') || para.getAttribute('number') || undefined;
    const dual = para.getAttribute('dualdialogue') === 'true' || para.hasAttribute('dualdialogue');

    // Concatenate all <text> child nodes inside <para>; if no <text> children exist, use textContent
    const textNodes = Array.from(para.querySelectorAll('text'));
    let lineText = '';
    if (textNodes.length > 0) {
      lineText = textNodes.map((t) => t.textContent || '').join('');
    } else {
      lineText = para.textContent || '';
    }

    const cleaned = lineText.replace(/\r?\n/g, ' ').trim();
    if (!cleaned) return;

    const elemType = mapFadeInStyleToElementType(styleName, cleaned);

    // Ensure parentheticals are wrapped in parentheses
    const normalizedText =
      elemType === 'parenthetical' && !cleaned.startsWith('(')
        ? `(${cleaned})`
        : elemType === 'scene_heading' || elemType === 'character' || elemType === 'transition'
        ? cleaned.toUpperCase()
        : cleaned;

    elements.push({
      id: `el-${idx + 1}`,
      type: elemType,
      text: normalizedText,
      sceneNumber: sceneNum,
      dualDialogue: dual,
    });
  });

  // Also support Final Draft .fdx <Paragraph Type="..."> if user drops an XML-based script
  if (elements.length === 0) {
    const fdxParas = Array.from(xmlDoc.querySelectorAll('Content > Paragraph, Paragraph'));
    fdxParas.forEach((p, idx) => {
      const pType = p.getAttribute('Type') || 'Action';
      const sceneNum = p.getAttribute('Number') || undefined;
      const textParts = Array.from(p.querySelectorAll('Text')).map((t) => t.textContent || '');
      const cleaned = (textParts.length ? textParts.join('') : p.textContent || '').trim();
      if (!cleaned) return;

      const elemType = mapFadeInStyleToElementType(pType, cleaned);
      elements.push({
        id: `el-${idx + 1}`,
        type: elemType,
        text: cleaned,
        sceneNumber: sceneNum,
      });
    });
  }

  return {
    title: extractedTitle,
    author: extractedAuthor || undefined,
    sourceFormat: 'fadein-xml',
    elements,
    rawText: elementsToFormattedScriptText(elements),
  };
}

/**
 * Parses plain text or Fountain-formatted screenplay strings into structured Fade In ScreenplayElements
 * so every script in the studio renders with true screenplay page margins and element formatting.
 */
export function parsePlainScriptToElements(rawText: string, title = 'Untitled Screenplay'): ParsedFadeInDocument {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const elements: ScreenplayElement[] = [];

  let lastElementType: ScreenplayElementType | null = null;
  let sceneCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      lastElementType = null;
      continue;
    }

    // 1. Scene Heading (Slugline)
    if (
      /^(INT\.|EXT\.|INT\/EXT\.|EXT\/INT\.|I\/E\.|EST\.)/i.test(trimmed) ||
      /^\.[A-Z0-9]/.test(trimmed)
    ) {
      sceneCounter += 1;
      const cleanHeading = trimmed.replace(/^\./, '').toUpperCase();
      elements.push({
        id: `el-${i + 1}`,
        type: 'scene_heading',
        text: cleanHeading,
        sceneNumber: String(sceneCounter),
      });
      lastElementType = 'scene_heading';
      continue;
    }

    // 2. Transition
    if (
      (/^(FADE IN:|FADE OUT\.|FADE TO BLACK\.|CUT TO:|SMASH CUT TO:|DISSOLVE TO:|MATCH CUT TO:)/i.test(trimmed) ||
        (trimmed.endsWith('TO:') && trimmed === trimmed.toUpperCase() && trimmed.length < 32))
    ) {
      elements.push({
        id: `el-${i + 1}`,
        type: 'transition',
        text: trimmed.toUpperCase(),
      });
      lastElementType = 'transition';
      continue;
    }

    // 3. Parenthetical
    if (/^\(.*\)$/.test(trimmed)) {
      elements.push({
        id: `el-${i + 1}`,
        type: 'parenthetical',
        text: trimmed,
      });
      lastElementType = 'parenthetical';
      continue;
    }

    // 4. Inline "CHARACTER: Dialogue" shorthand support
    const inlineDialogueMatch = trimmed.match(/^([A-Z][A-Z0-9\s.\-']{1,28}(\s*\((V\.O\.|O\.S\.|CONT'D|OVER COMMS)\))?)\s*:\s+(.+)$/);
    if (inlineDialogueMatch && !/^(EXT|INT|NOTE|SHOT)/i.test(inlineDialogueMatch[1])) {
      elements.push({
        id: `el-${i + 1}-char`,
        type: 'character',
        text: inlineDialogueMatch[1].trim().toUpperCase(),
      });
      elements.push({
        id: `el-${i + 1}-dial`,
        type: 'dialogue',
        text: inlineDialogueMatch[4].trim().replace(/^"|"$/g, ''),
      });
      lastElementType = 'dialogue';
      continue;
    }

    // 5. Character Cue (ALL CAPS line followed by non-empty line, not ending in period)
    const nextLine = (lines[i + 1] || '').trim();
    const isAllCaps =
      trimmed === trimmed.toUpperCase() &&
      /[A-Z]/.test(trimmed) &&
      trimmed.length <= 38 &&
      !trimmed.endsWith('.');

    if (isAllCaps && nextLine.length > 0 && lastElementType !== 'character') {
      elements.push({
        id: `el-${i + 1}`,
        type: 'character',
        text: trimmed,
      });
      lastElementType = 'character';
      continue;
    }

    // 6. Dialogue (immediately follows Character or Parenthetical, or indented dialogue continuation)
    if (lastElementType === 'character' || lastElementType === 'parenthetical' || (lastElementType === 'dialogue' && /^\s{2,}/.test(rawLine))) {
      elements.push({
        id: `el-${i + 1}`,
        type: 'dialogue',
        text: trimmed,
      });
      lastElementType = 'dialogue';
      continue;
    }

    // 7. Shot / Camera Directive (e.g. EXTREME CLOSE-UP, ANGLE ON, POV)
    if (/^(EXTREME CLOSE-UP|CLOSE-UP|WIDE SHOT|ANGLE ON|POV|INSERT|BACK TO)/i.test(trimmed)) {
      elements.push({
        id: `el-${i + 1}`,
        type: 'shot',
        text: trimmed,
      });
      lastElementType = 'shot';
      continue;
    }

    // 8. Default: Action paragraph
    elements.push({
      id: `el-${i + 1}`,
      type: 'action',
      text: trimmed,
    });
    lastElementType = 'action';
  }

  return {
    title,
    sourceFormat: 'fountain',
    elements,
    rawText,
  };
}

/**
 * Converts structured ScreenplayElements back into clean, indented standard screenplay text
 * that preserves Fade In structure for AI parsing and plain-text editing.
 */
export function elementsToFormattedScriptText(elements: ScreenplayElement[]): string {
  const blocks: string[] = [];

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    const prev = elements[i - 1];

    switch (el.type) {
      case 'scene_heading':
        if (blocks.length > 0) blocks.push('');
        blocks.push(el.text.toUpperCase());
        break;
      case 'character':
        if (blocks.length > 0) blocks.push('');
        blocks.push(`                    ${el.text.toUpperCase()}`);
        break;
      case 'parenthetical':
        blocks.push(`               ${el.text}`);
        break;
      case 'dialogue':
        blocks.push(`          ${el.text}`);
        break;
      case 'transition':
        if (blocks.length > 0) blocks.push('');
        blocks.push(`                                             ${el.text.toUpperCase()}`);
        break;
      case 'shot':
      case 'action':
      default:
        if (prev && prev.type !== 'parenthetical') {
          blocks.push('');
        }
        blocks.push(el.text);
        break;
    }
  }

  return blocks.join('\n').trim();
}

/**
 * Reads an uploaded `.fadein` file (ZIP archive containing `document.xml`),
 * `.osf` / `.xml` file, or `.fountain` / `.txt` screenplay file.
 */
export async function importFadeInFile(file: File): Promise<ParsedFadeInDocument> {
  const fileName = file.name;
  const baseTitle = fileName.replace(/\.(fadein|osf|xml|fdx|fountain|txt)$/i, '');

  // Check if file is a ZIP archive (.fadein files are ZIP packages containing document.xml)
  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);
  const isZipHeader =
    uint8.length >= 4 &&
    uint8[0] === 0x50 &&
    uint8[1] === 0x4b &&
    (uint8[2] === 0x03 || uint8[2] === 0x05 || uint8[2] === 0x07);

  if (isZipHeader || fileName.toLowerCase().endsWith('.fadein')) {
    try {
      const zip = await JSZip.loadAsync(arrayBuffer);
      // Locate document.xml or any .xml file inside the .fadein archive
      let xmlFile = zip.file('document.xml');
      if (!xmlFile) {
        const xmlFiles = zip.file(/\.xml$/i);
        if (xmlFiles.length > 0) {
          xmlFile = xmlFiles[0];
        }
      }

      if (xmlFile) {
        const xmlContent = await xmlFile.async('string');
        const parsed = parseFadeInXml(xmlContent, baseTitle);
        return {
          ...parsed,
          sourceFormat: 'fadein-zip',
        };
      }
    } catch (zipErr) {
      // If a .fadein file happens to be raw XML or text rather than zipped, fall through to text reader
      console.warn('ZIP extraction fallback to raw text/XML:', zipErr);
    }
  }

  // Decode as UTF-8 text (handles standalone document.xml, .osf, .fdx, .json, .fountain, .txt)
  const textContent = new TextDecoder('utf-8').decode(arrayBuffer).replace(/^\uFEFF/, '');
  const trimmedText = textContent.trim();

  // Support importing exported CineBoard JSON project files directly
  if (trimmedText.startsWith('{') || fileName.toLowerCase().endsWith('.json')) {
    try {
      const jsonObj = JSON.parse(trimmedText);
      if (Array.isArray(jsonObj.scriptElements) && jsonObj.scriptElements.length > 0) {
        return {
          title: jsonObj.projectTitle || baseTitle,
          sourceFormat: 'fadein-xml',
          elements: jsonObj.scriptElements,
          rawText: jsonObj.scriptText || elementsToFormattedScriptText(jsonObj.scriptElements),
        };
      }
      if (typeof jsonObj.scriptText === 'string' && jsonObj.scriptText.trim()) {
        return parsePlainScriptToElements(jsonObj.scriptText, jsonObj.projectTitle || baseTitle);
      }
    } catch {
      // Not a JSON project file; continue to XML / plain text parsing
    }
  }

  if (trimmedText.startsWith('<')) {
    const parsed = parseFadeInXml(trimmedText, baseTitle);
    if (parsed.elements.length > 0) {
      return parsed;
    }
  }

  return parsePlainScriptToElements(textContent, baseTitle);
}

export interface ParsedSceneSummary {
  sceneIndex: number;
  sceneNumber: string;
  slugline: string;
  elementCount: number;
  charactersInScene: string[];
  elements: ScreenplayElement[];
}

/**
 * Groups parsed Fade In ScreenplayElements by Scene Heading so the user can inspect
 * or generate technical storyboards for any specific scene or the entire draft.
 */
export function extractScenesFromElements(elements: ScreenplayElement[]): ParsedSceneSummary[] {
  const scenes: ParsedSceneSummary[] = [];
  let current: ParsedSceneSummary | null = null;

  const cleanCharName = (raw: string) =>
    raw
      .replace(/\s*\([^)]*\)/g, '')
      .trim()
      .toUpperCase();

  for (const el of elements) {
    if (el.type === 'scene_heading') {
      if (current) {
        scenes.push(current);
      }
      const nextIdx = scenes.length + 1;
      current = {
        sceneIndex: nextIdx,
        sceneNumber: el.sceneNumber || String(nextIdx),
        slugline: el.text.toUpperCase(),
        elementCount: 1,
        charactersInScene: [],
        elements: [el],
      };
    } else {
      if (!current) {
        current = {
          sceneIndex: 1,
          sceneNumber: '1',
          slugline: 'INT. OPENING SCENE - DAY',
          elementCount: 0,
          charactersInScene: [],
          elements: [],
        };
      }
      current.elementCount += 1;
      current.elements.push(el);
      if (el.type === 'character') {
        const cName = cleanCharName(el.text);
        if (cName && !current.charactersInScene.includes(cName)) {
          current.charactersInScene.push(cName);
        }
      }
    }
  }

  if (current && current.elements.length > 0) {
    scenes.push(current);
  }

  return scenes;
}

/**
 * Generates an immediate deterministic set of technical storyboard panels directly from
 * the parsed Fade In ScreenplayElements (Scene Headings, Action, Character Cues, Dialogue)
 * using real character names, 180-degree conversational shot/reverse-shot rules, and
 * spatial movement cues from the screenplay data.
 */
export function buildInstantPanelsFromElements(
  elements: ScreenplayElement[],
  maxPanels = 12,
  filterSceneSlugline?: string
): Array<{
  id: string;
  panelNumber: number;
  title: string;
  sceneSlugline: string;
  sceneNumber?: string;
  shotSize: string;
  cameraAngle: string;
  cameraMovement: string;
  lensFocalLength: string;
  durationSeconds: number;
  actionNotes: string;
  dialogueSnippet: string;
  blockingNotes: string;
  visualPrompt: string;
  sceneComposition: {
    environmentType: string;
    primarySubject: string;
    timeOfDay: string;
    primaryColorHex: string;
    secondaryColorHex: string;
    highlightColorHex: string;
    vanishingPointX: number;
    vanishingPointY: number;
    subjectGridZone: 'left_third' | 'center' | 'right_third';
    subjectMotionDirection: 'none' | 'left_to_right' | 'right_to_left';
    cameraMotionVector: 'static' | 'push_in' | 'pull_out' | 'pan_right' | 'track_lateral';
    subjectLabel: string;
    secondarySubjectLabel: string;
    secondarySubjectZone: 'none' | 'left_third' | 'center' | 'right_third' | 'foreground_ots_left' | 'foreground_ots_right';
    depthArrangement: 'single_midground' | 'fg_to_mg_conversational' | 'mg_to_bg_deep_focus' | 'lateral_two_shot';
    axis180Line: boolean;
    cameraSideOfAxis: 'A_SIDE_NORMAL' | 'B_SIDE_REVERSE';
  };
}> {
  const allScenes = extractScenesFromElements(elements);
  const targetScenes =
    filterSceneSlugline && filterSceneSlugline !== 'ALL'
      ? allScenes.filter(
          (s) => s.slugline.trim().toUpperCase() === filterSceneSlugline.trim().toUpperCase()
        )
      : allScenes;

  const activeElements =
    targetScenes.length > 0
      ? targetScenes.flatMap((s) => s.elements)
      : elements;

  const panels: ReturnType<typeof buildInstantPanelsFromElements> = [];
  let currentSlugline = 'INT. SCENE - DAY';
  let currentSceneNumber = '1';
  let currentSceneRoster: string[] = [];
  let sceneBeatCount = 0;

  let currentAction: string[] = [];
  let currentCharacter = '';
  let currentParen = '';
  let currentDialogue: string[] = [];

  const cleanCharName = (raw: string) =>
    raw
      .replace(/\s*\([^)]*\)/g, '')
      .trim()
      .toUpperCase();

  // Extract capitalized ALL-CAPS character names introduced in Action paragraphs (e.g. "COLE VANCE (40s)")
  const extractCapsNameFromAction = (text: string): string => {
    const m = text.match(/\b([A-Z]{2,}(?:\s+[A-Z]{2,})?)\s*\(\d+/);
    if (m) return m[1].trim();
    return '';
  };

  const flushBeat = () => {
    if (currentAction.length === 0 && currentDialogue.length === 0) return;
    if (panels.length >= maxPanels) return;

    const idx = panels.length;
    sceneBeatCount += 1;

    const actionText =
      currentAction.join(' ').trim() ||
      (currentCharacter
        ? `${currentCharacter} delivers dialogue in ${currentSlugline}.`
        : 'Establishing spatial layout and room geometry.');

    const dialogueText =
      currentCharacter && currentDialogue.length > 0
        ? `${currentCharacter}${currentParen ? ' ' + currentParen : ''}: "${currentDialogue.join(' ').trim()}"`
        : 'No dialogue — ambient audio only';

    const upperAction = actionText.toUpperCase();
    const upperSlug = currentSlugline.toUpperCase();

    // Identify Primary & Secondary Character names in this shot
    const speakerBase = currentCharacter ? cleanCharName(currentCharacter) : '';
    const actionIntroducedName = extractCapsNameFromAction(actionText);
    if (actionIntroducedName && !currentSceneRoster.includes(actionIntroducedName)) {
      currentSceneRoster.push(actionIntroducedName);
    }
    if (speakerBase && !currentSceneRoster.includes(speakerBase)) {
      currentSceneRoster.push(speakerBase);
    }

    const primaryLabel =
      speakerBase ||
      actionIntroducedName ||
      currentSceneRoster[0] ||
      'SUBJ A';

    const otherCharacters = currentSceneRoster.filter((c) => c !== primaryLabel);
    const secondaryLabel = otherCharacters[0] || '';

    // Determine Shot Size & Coverage Mechanics:
    // Beat 1 of a scene defaults to an Establishing Wide / Medium Wide Shot unless an explicit Close-Up is written.
    // Subsequent dialogue beats alternate cleanly along the 180-degree axis (OTS / Medium Close-Up shot/reverse-shot).
    const explicitECU = upperAction.includes('EXTREME CLOSE') || upperAction.includes('ECU') || upperAction.includes('INSERT');
    const explicitCU = !explicitECU && (upperAction.includes('CLOSE-UP') || upperAction.includes('CLOSE UP'));
    const explicitWide = upperAction.includes('WIDE SHOT') || upperAction.includes('ESTABLISH');

    const isConversationalExchange = Boolean(speakerBase && secondaryLabel);

    let shotSize = 'Medium Shot';
    if (explicitECU) {
      shotSize = 'Extreme Close-Up';
    } else if (explicitCU) {
      shotSize = 'Close-Up';
    } else if (sceneBeatCount === 1 || explicitWide) {
      shotSize = upperSlug.startsWith('EXT.') ? 'Wide Shot' : 'Medium Wide Shot';
    } else if (isConversationalExchange) {
      shotSize = 'Medium Close-Up';
    } else if (currentDialogue.length > 0) {
      shotSize = 'Medium Close-Up';
    }

    // Camera Elevation Angle from Action / Slugline cues
    let cameraAngle = 'Eye Level';
    if (
      upperAction.includes('OVERHEAD') ||
      upperAction.includes('TOP-DOWN') ||
      upperAction.includes('TOP DOWN') ||
      upperAction.includes('BIRD')
    ) {
      cameraAngle = "Overhead Bird's-Eye";
    } else if (
      upperAction.includes('LOW ANGLE') ||
      upperAction.includes('LOOKING UP') ||
      upperAction.includes('LEAP') ||
      upperAction.includes('ROOFTOP')
    ) {
      cameraAngle = 'Low Angle';
    } else if (
      upperAction.includes('HIGH ANGLE') ||
      upperAction.includes('LOOKING DOWN') ||
      upperAction.includes('BALCONY')
    ) {
      cameraAngle = 'High Angle';
    } else if (isConversationalExchange && sceneBeatCount > 1) {
      cameraAngle = 'Over-the-Shoulder';
    }

    // 180-Degree Axis Rule Placement:
    // Character 1 in scene roster stays on Left Third looking Right;
    // Character 2 in scene roster stays on Right Third looking Left.
    const rosterIndex = currentSceneRoster.indexOf(primaryLabel);
    const isSecondSpeaker = rosterIndex === 1;

    const subjectGridZone: 'left_third' | 'center' | 'right_third' =
      sceneBeatCount === 1 && !isConversationalExchange
        ? 'center'
        : isSecondSpeaker
        ? 'right_third'
        : 'left_third';

    const subjectMotionDirection: 'none' | 'left_to_right' | 'right_to_left' =
      isSecondSpeaker ? 'right_to_left' : 'left_to_right';

    let secondarySubjectZone: 'none' | 'left_third' | 'center' | 'right_third' | 'foreground_ots_left' | 'foreground_ots_right' =
      'none';
    let depthArrangement: 'single_midground' | 'fg_to_mg_conversational' | 'mg_to_bg_deep_focus' | 'lateral_two_shot' =
      'single_midground';

    if (secondaryLabel) {
      if (cameraAngle === 'Over-the-Shoulder') {
        secondarySubjectZone = isSecondSpeaker ? 'foreground_ots_left' : 'foreground_ots_right';
        depthArrangement = 'fg_to_mg_conversational';
      } else if (shotSize.includes('Wide') || shotSize === 'Medium Shot') {
        secondarySubjectZone = isSecondSpeaker ? 'left_third' : 'right_third';
        depthArrangement = 'lateral_two_shot';
      }
    }

    // Camera Movement Vector from Action Verbs
    let cameraMovement = 'Static Lock-off';
    if (
      upperAction.includes('PUSH') ||
      upperAction.includes('LEAN') ||
      upperAction.includes('APPROACH') ||
      upperAction.includes('STEP')
    ) {
      cameraMovement = 'Slow Push In';
    } else if (
      upperAction.includes('PULL') ||
      upperAction.includes('RETREAT') ||
      upperAction.includes('EXIT')
    ) {
      cameraMovement = 'Pull Back / Zoom Out';
    } else if (
      upperAction.includes('SPRINT') ||
      upperAction.includes('RUN') ||
      upperAction.includes('WALK') ||
      upperAction.includes('FOLLOW') ||
      upperAction.includes('CABLE')
    ) {
      cameraMovement = 'Tracking / Dolly Lateral';
    } else if (
      upperAction.includes('PAN') ||
      upperAction.includes('ACROSS') ||
      upperAction.includes('PASS')
    ) {
      cameraMovement = 'Pan Left / Right';
    }

    const lensFocalLength = explicitECU
      ? '85mm Medium Telephoto'
      : shotSize.includes('Close')
      ? '50mm Normal'
      : shotSize.includes('Wide')
      ? '24mm Wide'
      : '35mm Standard Wide';

    const camVectorMap: Record<string, 'static' | 'push_in' | 'pull_out' | 'pan_right' | 'track_lateral'> = {
      'Slow Push In': 'push_in',
      'Pull Back / Zoom Out': 'pull_out',
      'Tracking / Dolly Lateral': 'track_lateral',
      'Pan Left / Right': 'pan_right',
      'Static Lock-off': 'static',
    };

    // Estimate realistic shot timing from action + spoken word count (~2.5 words/sec for dialogue)
    const dialogueWords = currentDialogue.join(' ').split(/\s+/).filter(Boolean).length;
    const actionWords = actionText.split(/\s+/).filter(Boolean).length;
    const estimatedSeconds = Number(
      Math.min(12, Math.max(2.5, 2.0 + dialogueWords * 0.38 + actionWords * 0.08)).toFixed(1)
    );

    const shortLocation = currentSlugline
      .replace(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s*/i, '')
      .split(/[-–—]/)[0]
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .join(' ');

    const coverageTag =
      sceneBeatCount === 1
        ? 'Establishing'
        : cameraAngle === 'Over-the-Shoulder'
        ? `OTS on ${primaryLabel}`
        : `${primaryLabel} ${shotSize.replace(' Shot', '')}`;

    panels.push({
      id: `panel-${Date.now()}-${idx + 1}`,
      panelNumber: idx + 1,
      title: `${shortLocation || 'Scene'} — ${coverageTag}`,
      sceneSlugline: currentSlugline,
      sceneNumber: currentSceneNumber,
      shotSize,
      cameraAngle,
      cameraMovement,
      lensFocalLength,
      durationSeconds: estimatedSeconds,
      actionNotes: actionText.slice(0, 280),
      dialogueSnippet: dialogueText.slice(0, 260),
      blockingNotes: `${
        secondaryLabel
          ? `180° Axis between ${primaryLabel} (${subjectGridZone.replace('_', ' ')}) & ${secondaryLabel} (${secondarySubjectZone.replace(/_/g, ' ')})`
          : `Single subject ${primaryLabel} on ${subjectGridZone.replace('_', ' ')} axis`
      }. Horizon ${
        cameraAngle === 'Low Angle' ? '70%' : cameraAngle === 'High Angle' ? '28%' : '48%'
      }; Cam Vector: ${cameraMovement}.`,
      visualPrompt: `Technical monochrome line-art storyboard schematic for ${currentSlugline}: ${shotSize}, ${cameraAngle}, primary mannequin ${primaryLabel} on ${subjectGridZone.replace('_', ' ')}${
        secondaryLabel ? `, secondary mannequin ${secondaryLabel} on ${secondarySubjectZone.replace(/_/g, ' ')}` : ''
      }, 1-point perspective grid, camera ${cameraMovement} vector arrows.`,
      sceneComposition: {
        environmentType: upperSlug.startsWith('EXT.') ? 'urban_alley' : 'interior_room',
        primarySubject: secondaryLabel ? 'two_characters' : isConversationalExchange ? 'close_portrait' : 'standing_figure',
        timeOfDay: upperSlug.includes('NIGHT') ? 'night' : 'day',
        primaryColorHex: '#101216',
        secondaryColorHex: '#181B20',
        highlightColorHex: '#38BDF8',
        vanishingPointX: isSecondSpeaker ? 44 : 56,
        vanishingPointY: cameraAngle === 'Low Angle' ? 70 : cameraAngle === 'High Angle' ? 28 : 48,
        subjectGridZone,
        subjectMotionDirection,
        cameraMotionVector: camVectorMap[cameraMovement] || 'static',
        subjectLabel: primaryLabel,
        secondarySubjectLabel: secondaryLabel,
        secondarySubjectZone,
        depthArrangement,
        axis180Line: true,
        cameraSideOfAxis: 'A_SIDE_NORMAL',
      },
    });

    currentAction = [];
    currentCharacter = '';
    currentParen = '';
    currentDialogue = [];
  };

  for (const el of activeElements) {
    if (panels.length >= maxPanels) break;
    if (el.type === 'scene_heading') {
      flushBeat();
      currentSlugline = el.text.toUpperCase();
      currentSceneNumber = el.sceneNumber || String(panels.length + 1);
      const matchingScene = allScenes.find(
        (s) => s.slugline.trim().toUpperCase() === currentSlugline.trim().toUpperCase()
      );
      currentSceneRoster = matchingScene ? [...matchingScene.charactersInScene] : [];
      sceneBeatCount = 0;
    } else if (el.type === 'action' || el.type === 'shot') {
      if (currentDialogue.length > 0 || currentAction.length >= 2) {
        flushBeat();
      }
      currentAction.push(el.text);
    } else if (el.type === 'character') {
      if (currentDialogue.length > 0) {
        flushBeat();
      }
      currentCharacter = el.text.toUpperCase();
    } else if (el.type === 'parenthetical') {
      currentParen = el.text;
    } else if (el.type === 'dialogue') {
      currentDialogue.push(el.text);
      flushBeat();
    }
  }
  flushBeat();

  return panels;
}

/**
 * Packages the current structured ScreenplayElements into a genuine `.fadein` file
 * (a valid ZIP archive containing an Open Screenplay Format `document.xml` file)
 * that can be opened directly in Fade In Professional Screenwriting Software.
 */
export async function exportToFadeInArchive(
  title: string,
  elements: ScreenplayElement[]
): Promise<Blob> {
  const escapeXml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const styleNameMap: Record<ScreenplayElementType, string> = {
    scene_heading: 'Scene Heading',
    action: 'Action',
    character: 'Character',
    parenthetical: 'Parenthetical',
    dialogue: 'Dialogue',
    transition: 'Transition',
    shot: 'Shot',
    note: 'Note',
    general: 'Normal Text',
  };

  const paraXmlLines = elements.map((el) => {
    const fadeInStyle = styleNameMap[el.type] || 'Action';
    const sceneAttr = el.sceneNumber ? ` scenenumber="${escapeXml(el.sceneNumber)}"` : '';
    return `    <para${sceneAttr}>
      <style basestyle="${fadeInStyle}"/>
      <text>${escapeXml(el.text)}</text>
    </para>`;
  });

  const documentXml = `<?xml version="1.0" encoding="UTF-8"?>
<document type="Open Screenplay Format document" version="30">
  <info>
    <title>${escapeXml(title)}</title>
    <generator>CineBoard Studio</generator>
  </info>
  <paragraphs>
${paraXmlLines.join('\n')}
  </paragraphs>
</document>`;

  const zip = new JSZip();
  zip.file('document.xml', documentXml);
  return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
