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

  // Decode as UTF-8 text (handles standalone document.xml, .osf, .fdx, .fountain, .txt)
  const textContent = new TextDecoder('utf-8').decode(arrayBuffer);
  if (textContent.trim().startsWith('<')) {
    const parsed = parseFadeInXml(textContent, baseTitle);
    if (parsed.elements.length > 0) {
      return parsed;
    }
  }

  return parsePlainScriptToElements(textContent, baseTitle);
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
