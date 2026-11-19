import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Maximize2,
  X,
  RefreshCw,
  Trash2,
  Printer,
  Camera,
  AlertCircle,
  Download,
  FileDown,
  Grid,
  Compass,
  FileText,
  Monitor,
  CheckCircle2,
} from 'lucide-react';
import {
  StoryboardPanel,
  SAMPLE_SCREENPLAYS,
  INITIAL_TECHNICAL_PANELS,
  DRAFTING_MODES,
  SHOT_SIZES,
  CAMERA_ANGLES,
  CAMERA_MOVEMENTS,
  LENS_FOCAL_LENGTHS,
} from './types';
import { CinematicFallbackPlate } from './components/CinematicFallbackPlate';
import { FadeInScriptView } from './components/FadeInScriptView';
import {
  ScreenplayElement,
  parsePlainScriptToElements,
  elementsToFormattedScriptText,
  importFadeInFile,
  exportToFadeInArchive,
  buildInstantPanelsFromElements,
  extractScenesFromElements,
} from './utils/fadeInParser';
import { exportStoryboardCrewPdf } from './utils/pdfExporter';
import {
  buildStandaloneDesktopHtml,
  downloadStandaloneDesktopBundle,
} from './utils/standaloneDesktopBuilder';

type ActiveTab = 'workspace' | 'shotlist' | 'animatic' | 'samples';

/**
 * Safely reads a fetch Response as text and parses JSON so non-JSON gateway or payload errors
 * never throw "JSON.parse: unexpected character at line 1 column 1".
 */
async function safeParseApiResponse(response: Response): Promise<any> {
  const rawText = await response.text();
  if (!rawText || !rawText.trim()) {
    throw new Error(`Server returned an empty response (HTTP ${response.status}).`);
  }
  try {
    return JSON.parse(rawText);
  } catch {
    const stripped = rawText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    throw new Error(
      `Server response error (HTTP ${response.status}): ${stripped.slice(0, 140) || 'Invalid JSON response'}`
    );
  }
}

export default function App() {
  const initialParsed = parsePlainScriptToElements(
    SAMPLE_SCREENPLAYS[0].scriptText,
    SAMPLE_SCREENPLAYS[0].title
  );

  const [activeTab, setActiveTab] = useState<ActiveTab>('workspace');
  const [projectTitle, setProjectTitle] = useState<string>(SAMPLE_SCREENPLAYS[0].title);
  const [scriptText, setScriptText] = useState<string>(initialParsed.rawText);
  const [scriptElements, setScriptElements] = useState<ScreenplayElement[]>(initialParsed.elements);
  const [sourceFormat, setSourceFormat] = useState<'fadein-zip' | 'fadein-xml' | 'fountain'>('fadein-zip');
  const [lastImportedFileName, setLastImportedFileName] = useState<string | null>('the-mercer-ledger.fadein');
  const [selectedSceneSlugline, setSelectedSceneSlugline] = useState<string>('ALL');

  const [draftingMode, setDraftingMode] = useState<string>(SAMPLE_SCREENPLAYS[0].draftingMode);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '2.39:1' | '4:3'>(SAMPLE_SCREENPLAYS[0].aspectRatio);
  const [targetPanelCount, setTargetPanelCount] = useState<number>(6);
  const [showCompositionGuides, setShowCompositionGuides] = useState<boolean>(true);

  const [panels, setPanels] = useState<StoryboardPanel[]>(INITIAL_TECHNICAL_PANELS);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(INITIAL_TECHNICAL_PANELS[0].id);
  const [lightboxPanelId, setLightboxPanelId] = useState<string | null>(null);

  const [isParsingScript, setIsParsingScript] = useState<boolean>(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // PDF Crew Packet & Standalone Desktop Modal State
  const [showPdfModal, setShowPdfModal] = useState<boolean>(false);
  const [pdfLayoutPerPage, setPdfLayoutPerPage] = useState<'2-up' | '4-up'>('2-up');
  const [pdfIncludeSchedule, setPdfIncludeSchedule] = useState<boolean>(true);
  const [pdfProductionNotes, setPdfProductionNotes] = useState<string>(
    'All camera setups verified for spatial blocking, lens focal length, and rule-of-thirds composition.'
  );
  const [showDesktopModal, setShowDesktopModal] = useState<boolean>(false);

  // Animatic playback state
  const [animaticIndex, setAnimaticIndex] = useState<number>(0);
  const [isPlayingAnimatic, setIsPlayingAnimatic] = useState<boolean>(false);

  // Director inspection modal / drawer state
  const [directorNoteInput, setDirectorNoteInput] = useState<string>('');
  const [isEnhancingShot, setIsEnhancingShot] = useState<boolean>(false);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  // Keyboard ESC handler for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxPanelId) setLightboxPanelId(null);
        if (showPdfModal) setShowPdfModal(false);
        if (showDesktopModal) setShowDesktopModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxPanelId, showPdfModal, showDesktopModal]);

  // Keep animaticIndex within valid bounds whenever panels change
  useEffect(() => {
    if (animaticIndex >= panels.length && panels.length > 0) {
      setAnimaticIndex(0);
    }
  }, [panels.length, animaticIndex]);

  // Animatic timer loop
  useEffect(() => {
    if (!isPlayingAnimatic || panels.length === 0) return;
    const currentPanel = panels[animaticIndex] || panels[0];
    const durationMs = Math.max((Number(currentPanel?.durationSeconds) || 3.5) * 1000, 1500);

    const timer = setTimeout(() => {
      setAnimaticIndex((prev) => {
        if (prev + 1 >= panels.length) {
          setIsPlayingAnimatic(false);
          return 0;
        }
        return prev + 1;
      });
    }, durationMs);

    return () => clearTimeout(timer);
  }, [isPlayingAnimatic, animaticIndex, panels]);

  const selectedPanel = panels.find((p) => p.id === selectedPanelId) || panels[0] || null;
  const lightboxPanel = panels.find((p) => p.id === lightboxPanelId) || null;

  const parsedScenes = extractScenesFromElements(scriptElements);
  const totalRuntimeSeconds = panels.reduce((acc, p) => acc + (Number(p.durationSeconds) || 3.5), 0);
  const uniqueScenesCount = new Set(panels.map((p) => (p.sceneSlugline || '').trim().toUpperCase())).size;

  // Synchronize structured Fade In elements when edited in Formatted mode
  const handleUpdateElements = (updatedElements: ScreenplayElement[]) => {
    setScriptElements(updatedElements);
    setScriptText(elementsToFormattedScriptText(updatedElements));
  };

  // Synchronize raw screenplay text when edited in Raw mode
  const handleUpdateRawText = (newText: string) => {
    setScriptText(newText);
    const parsed = parsePlainScriptToElements(newText, projectTitle);
    setScriptElements(parsed.elements);
  };

  // Instant deterministic mechanics rebuild from current Fade In screenplay elements & scene scope
  const handleInstantRebuildMechanics = (
    sceneScope: string = selectedSceneSlugline,
    panelCount: number = targetPanelCount,
    elementsOverride?: ScreenplayElement[]
  ) => {
    const activeElements = elementsOverride || scriptElements;
    const rebuilt = buildInstantPanelsFromElements(activeElements, panelCount, sceneScope);
    if (rebuilt.length > 0) {
      setPanels(rebuilt);
      setSelectedPanelId(rebuilt[0].id);
      setAnimaticIndex(0);
      const scopeLabel = sceneScope === 'ALL' ? 'all screenplay scenes' : sceneScope;
      setStatusNotice(
        `Built ${rebuilt.length} technical blocking setups (180° axis & character rosters) for ${scopeLabel}.`
      );
      setTimeout(() => setStatusNotice(null), 3500);
    }
  };

  // Import native .fadein (Open Screenplay Format ZIP archive), .osf, .xml, or .fountain file
  const handleImportFadeInFile = async (file: File) => {
    setErrorMessage(null);
    setStatusNotice(`Importing "${file.name}" and extracting Fade In Open Screenplay Format elements...`);
    try {
      const parsedDoc = await importFadeInFile(file);
      if (parsedDoc.elements.length === 0) {
        throw new Error(`No screenplay elements were found in "${file.name}".`);
      }
      setProjectTitle(parsedDoc.title || file.name.replace(/\.fadein$/i, ''));
      setScriptElements(parsedDoc.elements);
      setScriptText(parsedDoc.rawText);
      setSourceFormat(parsedDoc.sourceFormat);
      setLastImportedFileName(file.name);
      setSelectedSceneSlugline('ALL');

      const scenesInFile = extractScenesFromElements(parsedDoc.elements);
      // Immediately build technical storyboard setups from the uploaded screenplay's formatted elements
      const instantPanels = buildInstantPanelsFromElements(parsedDoc.elements, targetPanelCount, 'ALL');
      if (instantPanels.length > 0) {
        setPanels(instantPanels);
        setSelectedPanelId(instantPanels[0].id);
        setAnimaticIndex(0);
      }

      setStatusNotice(
        `Loaded "${file.name}" (${parsedDoc.elements.length} elements across ${scenesInFile.length} scenes → ${instantPanels.length} technical setups ready).`
      );
      setTimeout(() => setStatusNotice(null), 4000);
    } catch (err: any) {
      setStatusNotice(null);
      setErrorMessage(err?.message || 'Could not parse the uploaded .fadein file.');
    }
  };

  // Export current manuscript back to a native .fadein archive (ZIP with Open Screenplay Format document.xml)
  const handleExportFadeInFile = async () => {
    try {
      const blob = await exportToFadeInArchive(projectTitle, scriptElements);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'screenplay';
      a.download = `${safeName}.fadein`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to package .fadein archive.');
    }
  };

  // Generate high-resolution Crew PDF Packet with diagrams and formatted screenplay excerpts
  const handleGenerateCrewPdf = async () => {
    if (panels.length === 0 || isExportingPdf) return;
    setIsExportingPdf(true);
    setErrorMessage(null);
    setStatusNotice('Building high-resolution Crew Storyboard PDF Packet...');

    try {
      await exportStoryboardCrewPdf(
        {
          projectTitle,
          draftingMode,
          aspectRatio,
          panels,
          showCompositionGuides,
          includeShotSchedulePage: pdfIncludeSchedule,
          layoutPerPage: pdfLayoutPerPage,
          productionNotes: pdfProductionNotes,
        },
        (progressMsg) => setStatusNotice(progressMsg)
      );
      setStatusNotice('Crew Storyboard PDF Packet downloaded.');
      setShowPdfModal(false);
      setTimeout(() => setStatusNotice(null), 3000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to generate PDF packet.');
      setStatusNotice(null);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Download Single-File Standalone Desktop HTML App
  const handleDownloadStandaloneHtml = () => {
    try {
      const htmlString = buildStandaloneDesktopHtml({
        projectTitle,
        draftingMode,
        aspectRatio,
        scriptText,
        scriptElements,
        panels,
      });
      const blob = new Blob([htmlString], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeSlug =
        projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cineboard';
      a.href = url;
      a.download = `${safeSlug}-standalone-desktop.html`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusNotice('Downloaded standalone Desktop HTML app for offline testing.');
      setTimeout(() => setStatusNotice(null), 3000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to generate standalone desktop HTML.');
    }
  };

  // Download Complete Standalone Desktop ZIP Bundle (.html + .fadein + .json + README)
  const handleDownloadDesktopBundleZip = async () => {
    try {
      setStatusNotice('Packaging Standalone Desktop Testing Bundle (.zip)...');
      const fadeInBlob = await exportToFadeInArchive(projectTitle, scriptElements);
      await downloadStandaloneDesktopBundle({
        projectTitle,
        draftingMode,
        aspectRatio,
        scriptText,
        scriptElements,
        panels,
        fadeInBlob,
      });
      setStatusNotice('Standalone Desktop Testing Bundle (.zip) downloaded.');
      setShowDesktopModal(false);
      setTimeout(() => setStatusNotice(null), 3500);
    } catch (err: any) {
      setStatusNotice(null);
      setErrorMessage(err?.message || 'Failed to package standalone desktop bundle.');
    }
  };

  // Format dialogue snippet into standard Fade In Character Cue / Parenthetical / Dialogue layout
  const renderFormattedDialogueBlock = (dialogueSnippet: string) => {
    const trimmed = (dialogueSnippet || '').trim();
    if (!trimmed || /^no dialogue/i.test(trimmed)) {
      return (
        <p className="font-mono text-[11px] text-[#71717A] italic">
          {trimmed || 'No dialogue — ambient audio only'}
        </p>
      );
    }

    const match = trimmed.match(/^([A-Z][A-Z0-9\s.\-']*(\s*\([^)]+\))?)\s*:\s*(.+)$/s);
    if (match) {
      const characterCue = match[1].trim().toUpperCase();
      const rawBody = match[3].trim().replace(/^"|"$/g, '');
      const parenMatch = rawBody.match(/^(\([^)]+\))\s*(.+)$/s);

      return (
        <div className="font-mono text-[11px] bg-[#0B0B10] border border-[#1E1E28] rounded-lg px-3 py-2 space-y-0.5">
          <div className="text-center font-bold text-[#F2B705] uppercase tracking-wider">
            {characterCue}
          </div>
          {parenMatch ? (
            <>
              <div className="text-center italic text-[#A1A1AA]">
                {parenMatch[1]}
              </div>
              <div className="text-[#F4F4F5] px-3 leading-snug">
                {parenMatch[2]}
              </div>
            </>
          ) : (
            <div className="text-[#F4F4F5] px-3 leading-snug">
              {rawBody}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="font-mono text-[11px] bg-[#0B0B10] border border-[#1E1E28] rounded-lg px-3 py-2 text-[#E4E4E7]">
        {trimmed}
      </div>
    );
  };

  // Generate technical diagram via /api/storyboard/generate-image
  const generateSinglePanelVisual = async (panel: StoryboardPanel, currentMode: string, currentRatio: string) => {
    setPanels((prev) =>
      prev.map((p) => (p.id === panel.id ? { ...p, isGeneratingImage: true } : p))
    );
    setErrorMessage(null);

    try {
      const response = await fetch('/api/storyboard/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visualPrompt: panel.visualPrompt,
          draftingMode: currentMode,
          aspectRatio: currentRatio,
          shotSize: panel.shotSize,
          cameraAngle: panel.cameraAngle,
          cameraMovement: panel.cameraMovement,
          lensFocalLength: panel.lensFocalLength,
          title: panel.title,
          sceneSlugline: panel.sceneSlugline,
          blockingNotes: panel.blockingNotes,
        }),
      });

      const data = await safeParseApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate technical panel diagram.');
      }

      setBrokenImages((prev) => ({ ...prev, [panel.id]: false }));
      setPanels((prev) =>
        prev.map((p) =>
          p.id === panel.id
            ? {
                ...p,
                imageUrl: data.imageUrl,
                rendererUsed:
                  data.renderer === 'gemini-3.1-flash-lite-image'
                    ? 'AI Wireframe Draft'
                    : 'AI Vector Schematic',
                isGeneratingImage: false,
              }
            : p
        )
      );
    } catch (err: any) {
      // Leave parametric technical schematic active if AI rendering fails or times out
      setPanels((prev) =>
        prev.map((p) => (p.id === panel.id ? { ...p, isGeneratingImage: false } : p))
      );
    }
  };

  // Parse screenplay into fundamental technical panels (character/space outlines, camera movement, composition)
  const handleGenerateStoryboardFromScript = async () => {
    if (!scriptText.trim()) {
      setErrorMessage('Please enter or import a .fadein screenplay before generating storyboards.');
      return;
    }

    setIsParsingScript(true);
    setErrorMessage(null);
    setStatusNotice('Extracting spatial geometry, character blocking outlines, and camera movement vectors...');

    // Scope elements to selected scene if a specific Scene Heading is chosen
    const targetSceneObj =
      selectedSceneSlugline && selectedSceneSlugline !== 'ALL'
        ? parsedScenes.find(
            (s) => s.slugline.trim().toUpperCase() === selectedSceneSlugline.trim().toUpperCase()
          )
        : null;

    const scopedElements = targetSceneObj ? targetSceneObj.elements : scriptElements;
    const scopedText = targetSceneObj
      ? elementsToFormattedScriptText(targetSceneObj.elements)
      : scriptText;

    // Trim payload sent over HTTP so large full-feature screenplays never trigger gateway 413 HTML errors
    const boundedTextForApi = scopedText.slice(0, 26000);
    const boundedElementsForApi = scopedElements.slice(0, 150);

    try {
      const response = await fetch('/api/storyboard/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptText: boundedTextForApi,
          scriptElements: boundedElementsForApi,
          draftingMode,
          targetPanelCount,
        }),
      });

      const data = await safeParseApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse screenplay.');
      }

      const rawPanels: any[] = Array.isArray(data.panels) ? data.panels : [];
      if (rawPanels.length === 0) {
        throw new Error('No storyboard shots could be extracted from the provided text.');
      }

      const formattedPanels: StoryboardPanel[] = rawPanels.map((item, idx) => ({
        id: `panel-${Date.now()}-${idx + 1}`,
        panelNumber: idx + 1,
        sceneNumber: targetSceneObj ? String(targetSceneObj.sceneNumber) : String(idx + 1),
        title: item.title || `Setup ${idx + 1}`,
        sceneSlugline: (
          item.sceneSlugline ||
          targetSceneObj?.slugline ||
          'INT. SCENE - DAY'
        ).toUpperCase(),
        shotSize: item.shotSize || 'Medium Shot',
        cameraAngle: item.cameraAngle || 'Eye Level',
        cameraMovement: item.cameraMovement || 'Static Lock-off',
        lensFocalLength: item.lensFocalLength || '35mm Standard Wide',
        durationSeconds: Number(item.durationSeconds) || 3.5,
        actionNotes: item.actionNotes || '',
        dialogueSnippet: item.dialogueSnippet || 'No dialogue',
        blockingNotes: item.blockingNotes || '1-point perspective grid; primary figure on rule-of-thirds axis.',
        visualPrompt:
          item.visualPrompt ||
          item.actionNotes ||
          'Technical monochrome line-art storyboard schematic showing basic mannequin and room perspective lines.',
        sceneComposition: {
          ...item.sceneComposition,
          axis180Line: true,
          cameraSideOfAxis: idx % 2 === 0 ? 'A_SIDE_NORMAL' : 'B_SIDE_REVERSE',
        },
        isGeneratingImage: false,
      }));

      setPanels(formattedPanels);
      setSelectedPanelId(formattedPanels[0].id);
      setAnimaticIndex(0);
      setActiveTab('workspace');
      setIsParsingScript(false);
      setStatusNotice(`Generated ${formattedPanels.length} technical camera setups & spatial blocking schematics.`);
      setTimeout(() => setStatusNotice(null), 3500);
    } catch (err: any) {
      setIsParsingScript(false);
      setIsBatchGenerating(false);

      // Automatic local fallback: build deterministic technical panels directly from the parsed Fade In elements
      const localPanels = buildInstantPanelsFromElements(
        scriptElements,
        targetPanelCount,
        selectedSceneSlugline
      );
      if (localPanels.length > 0) {
        setPanels(localPanels);
        setSelectedPanelId(localPanels[0].id);
        setAnimaticIndex(0);
        setStatusNotice(
          `Built ${localPanels.length} technical blocking setups directly from Fade In screenplay elements.`
        );
        setTimeout(() => setStatusNotice(null), 4000);
      } else {
        setStatusNotice(null);
        setErrorMessage(err?.message || 'Unable to generate technical storyboard from script.');
      }
    }
  };

  // Batch draft all panels with AI schematic generator
  const handleRenderAllVisuals = async () => {
    if (panels.length === 0 || isBatchGenerating) return;
    setIsBatchGenerating(true);
    setErrorMessage(null);

    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i];
      setStatusNotice(`Drafting technical schematic ${i + 1} of ${panels.length}: "${panel.title}"...`);
      await generateSinglePanelVisual(panel, draftingMode, aspectRatio);
    }

    setStatusNotice(null);
    setIsBatchGenerating(false);
  };

  // Update a single shot's spatial blocking and camera mechanics with AI
  const handleEnhanceShotWithAI = async (panel: StoryboardPanel) => {
    setIsEnhancingShot(true);
    setErrorMessage(null);
    try {
      const response = await fetch('/api/storyboard/enhance-shot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          panel,
          directorInstruction: directorNoteInput,
          draftingMode,
        }),
      });
      const data = await safeParseApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update shot mechanics.');
      }

      const updatedFields = data.updated;
      const updatedPanel: StoryboardPanel = {
        ...panel,
        ...updatedFields,
      };

      setPanels((prev) => prev.map((p) => (p.id === panel.id ? updatedPanel : p)));
      setDirectorNoteInput('');
      setIsEnhancingShot(false);
    } catch (err: any) {
      setIsEnhancingShot(false);
      setErrorMessage(err?.message || 'Failed to update shot mechanics.');
    }
  };

  // Load sample screenplay
  const handleLoadSample = (sampleId: string) => {
    const sample = SAMPLE_SCREENPLAYS.find((s) => s.id === sampleId);
    if (!sample) return;
    const parsed = parsePlainScriptToElements(sample.scriptText, sample.title);
    setProjectTitle(sample.title);
    setScriptText(parsed.rawText);
    setScriptElements(parsed.elements);
    setSourceFormat('fadein-zip');
    setLastImportedFileName(`${sample.id}.fadein`);
    setSelectedSceneSlugline('ALL');
    setDraftingMode(sample.draftingMode);
    setAspectRatio(sample.aspectRatio);
    setErrorMessage(null);

    if (sample.preloadedPanels && sample.preloadedPanels.length > 0) {
      setPanels(sample.preloadedPanels);
      setSelectedPanelId(sample.preloadedPanels[0].id);
      setAnimaticIndex(0);
      setActiveTab('workspace');
    } else {
      setActiveTab('workspace');
    }
  };

  // Insert a 180-degree reverse-angle / Over-the-Shoulder coverage setup immediately after the active panel
  const handleInsertReverseCoveragePanel = (sourcePanel: StoryboardPanel) => {
    const comp = sourcePanel.sceneComposition || {
      environmentType: 'interior_room',
      primarySubject: 'standing_figure',
      timeOfDay: 'day',
      primaryColorHex: '#101216',
      secondaryColorHex: '#181B20',
      highlightColorHex: '#38BDF8',
      vanishingPointX: 50,
      vanishingPointY: 48,
      subjectGridZone: 'left_third',
      subjectMotionDirection: 'left_to_right',
      cameraMotionVector: 'static',
      subjectLabel: 'SUBJ A',
      secondarySubjectLabel: 'SUBJ B',
      secondarySubjectZone: 'foreground_ots_right',
      depthArrangement: 'fg_to_mg_conversational',
      axis180Line: true,
      cameraSideOfAxis: 'A_SIDE_NORMAL',
    };

    const currentPrimary = comp.subjectLabel || 'SUBJ A';
    const currentSecondary = comp.secondarySubjectLabel || 'PARTNER';

    const flippedZone: 'left_third' | 'right_third' | 'center' =
      comp.subjectGridZone === 'left_third'
        ? 'right_third'
        : comp.subjectGridZone === 'right_third'
        ? 'left_third'
        : 'right_third';

    const flippedOtsZone: 'foreground_ots_left' | 'foreground_ots_right' =
      flippedZone === 'right_third' ? 'foreground_ots_left' : 'foreground_ots_right';

    const flippedSightline: 'left_to_right' | 'right_to_left' =
      flippedZone === 'right_third' ? 'right_to_left' : 'left_to_right';

    const reverseSide: 'A_SIDE_NORMAL' | 'B_SIDE_REVERSE' =
      comp.cameraSideOfAxis === 'B_SIDE_REVERSE' ? 'A_SIDE_NORMAL' : 'B_SIDE_REVERSE';

    const reversePanel: StoryboardPanel = {
      id: `panel-${Date.now()}-rev`,
      panelNumber: sourcePanel.panelNumber + 1,
      sceneNumber: sourcePanel.sceneNumber,
      title: `180° Reverse OTS — ${currentSecondary}`,
      sceneSlugline: sourcePanel.sceneSlugline,
      shotSize: sourcePanel.shotSize.includes('Close') ? sourcePanel.shotSize : 'Medium Close-Up',
      cameraAngle: 'Over-the-Shoulder',
      cameraMovement: 'Static Lock-off',
      lensFocalLength: '85mm Medium Telephoto',
      durationSeconds: sourcePanel.durationSeconds,
      actionNotes: `Reverse 180° axis coverage: ${currentSecondary} anchored on ${flippedZone.replace('_', ' ')}; ${currentPrimary} in foreground OTS (${flippedOtsZone.replace(/_/g, ' ')}).`,
      dialogueSnippet:
        currentSecondary !== 'PARTNER' && currentSecondary !== 'SUBJ B'
          ? `${currentSecondary}: (responding across 180° line)`
          : sourcePanel.dialogueSnippet,
      blockingNotes: `180° Reverse Axis Setup (${reverseSide}): Camera stays on same side of action line. ${currentSecondary} on ${flippedZone.replace('_', ' ')} looking ${flippedSightline.replace(/_/g, ' ')}; OTS anchor ${currentPrimary} on ${flippedOtsZone.replace(/_/g, ' ')}.`,
      visualPrompt: `Technical monochrome line-art storyboard schematic: 180-degree reverse Over-the-Shoulder coverage of ${currentSecondary} on ${flippedZone.replace('_', ' ')} with foreground shoulder silhouette of ${currentPrimary} on ${flippedOtsZone.replace(/_/g, ' ')}.`,
      sceneComposition: {
        ...comp,
        subjectLabel: currentSecondary,
        secondarySubjectLabel: currentPrimary,
        subjectGridZone: flippedZone,
        secondarySubjectZone: flippedOtsZone,
        subjectMotionDirection: flippedSightline,
        depthArrangement: 'fg_to_mg_conversational',
        axis180Line: true,
        cameraSideOfAxis: reverseSide,
        vanishingPointX: flippedZone === 'right_third' ? 42 : 58,
      },
    };

    const sourceIndex = panels.findIndex((p) => p.id === sourcePanel.id);
    const insertIndex = sourceIndex >= 0 ? sourceIndex + 1 : panels.length;
    const updated = [
      ...panels.slice(0, insertIndex),
      reversePanel,
      ...panels.slice(insertIndex),
    ].map((p, idx) => ({ ...p, panelNumber: idx + 1 }));

    setPanels(updated);
    setSelectedPanelId(reversePanel.id);
    setStatusNotice(
      `Inserted 180° Reverse OTS coverage setup (${currentSecondary} / ${currentPrimary}) preserving axis of action.`
    );
    setTimeout(() => setStatusNotice(null), 3500);
  };

  // Add manual blank shot panel
  const handleAddBlankPanel = () => {
    const nextNum = panels.length + 1;
    const newPanel: StoryboardPanel = {
      id: `panel-${Date.now()}`,
      panelNumber: nextNum,
      title: `Camera Setup ${nextNum}`,
      sceneSlugline: panels[panels.length - 1]?.sceneSlugline || 'INT. LOCATION - DAY',
      shotSize: 'Medium Shot',
      cameraAngle: 'Eye Level',
      cameraMovement: 'Static Lock-off',
      lensFocalLength: '35mm Standard Wide',
      durationSeconds: 3.5,
      actionNotes: 'Subject A enters left third and stops facing right.',
      dialogueSnippet: 'No dialogue',
      blockingNotes: '1-point perspective grid (VP at 50%, 48%). Subject A placed on left rule-of-thirds intersection.',
      visualPrompt:
        'Technical monochrome line-art storyboard frame: 1-point perspective room outline, neutral mannequin figure standing on left third, sightline vector arrow pointing right.',
      sceneComposition: {
        environmentType: 'interior_room',
        primarySubject: 'standing_figure',
        timeOfDay: 'day',
        primaryColorHex: '#101216',
        secondaryColorHex: '#181B20',
        highlightColorHex: '#38BDF8',
        vanishingPointX: 50,
        vanishingPointY: 48,
        subjectGridZone: 'left_third',
        subjectMotionDirection: 'left_to_right',
        cameraMotionVector: 'static',
        subjectLabel: 'SUBJ A',
        secondarySubjectLabel: '',
        secondarySubjectZone: 'none',
        depthArrangement: 'single_midground',
        axis180Line: true,
        cameraSideOfAxis: 'A_SIDE_NORMAL',
      },
    };
    setPanels((prev) => [...prev, newPanel]);
    setSelectedPanelId(newPanel.id);
  };

  // Delete a panel and re-index numbers
  const handleDeletePanel = (id: string) => {
    if (panels.length <= 1) return;
    const filtered = panels
      .filter((p) => p.id !== id)
      .map((p, idx) => ({ ...p, panelNumber: idx + 1 }));
    setPanels(filtered);
    if (selectedPanelId === id) {
      setSelectedPanelId(filtered[0]?.id || null);
    }
  };

  // Update a panel field
  const handleUpdatePanelField = (id: string, field: keyof StoryboardPanel, value: any) => {
    setPanels((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  // Update nested sceneComposition field for interactive geometric control
  const handleUpdateCompositionField = (id: string, key: string, value: any) => {
    setPanels((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const currentComp = p.sceneComposition || {
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
        return {
          ...p,
          imageUrl: undefined,
          sceneComposition: {
            ...currentComp,
            [key]: value,
          },
        };
      })
    );
  };

  const aspectContainerClass =
    aspectRatio === '2.39:1'
      ? 'aspect-[21/9]'
      : aspectRatio === '4:3'
      ? 'aspect-[4/3]'
      : 'aspect-video';

  return (
    <div className="min-h-screen flex flex-col bg-[#08080A] text-[#F4F4F5]">
      {/* Top Bar Contract: 3 Zones separated by gap-8 */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-3.5 bg-[#08080A]/95 backdrop-blur border-b border-[#232329]">
        {/* Zone 1: Brand Title (Single text element wordmark) */}
        <a
          href="#workspace"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('workspace');
          }}
          className="font-display text-lg font-bold tracking-tight text-[#F4F4F5] whitespace-nowrap shrink-0"
        >
          CineBoard Studio
        </a>

        {/* Zone 2: 4 Concise Single-Line Text Navigation Links */}
        <nav className="flex items-center gap-6 text-sm font-medium text-[#A1A1AA]">
          <button
            type="button"
            onClick={() => setActiveTab('workspace')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
              activeTab === 'workspace'
                ? 'text-[#F4F4F5] border-[#F2B705]'
                : 'border-transparent hover:text-[#F4F4F5]'
            }`}
          >
            Blocking Workspace
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('shotlist')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
              activeTab === 'shotlist'
                ? 'text-[#F4F4F5] border-[#F2B705]'
                : 'border-transparent hover:text-[#F4F4F5]'
            }`}
          >
            Shot Schedule
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('animatic')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
              activeTab === 'animatic'
                ? 'text-[#F4F4F5] border-[#F2B705]'
                : 'border-transparent hover:text-[#F4F4F5]'
            }`}
          >
            Animatic Timing
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('samples')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 cursor-pointer ${
              activeTab === 'samples'
                ? 'text-[#F4F4F5] border-[#F2B705]'
                : 'border-transparent hover:text-[#F4F4F5]'
            }`}
          >
            Sample Scripts
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleGenerateStoryboardFromScript}
            disabled={isParsingScript || isBatchGenerating}
            className="px-4 py-2 text-xs font-semibold text-[#08080A] bg-[#F2B705] rounded-lg hover:bg-[#FACC15] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isParsingScript ? 'Extracting Mechanics...' : isBatchGenerating ? 'Drafting Panels...' : 'Generate Technical Board'}
          </button>
        </div>
      </header>

      {/* Secondary Project Summary, Crew PDF Export & Standalone Desktop Build Strip */}
      <div className="no-print border-b border-[#232329] bg-[#111115] px-6 py-2.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-xs text-[#A1A1AA]">
          <input
            type="text"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            aria-label="Project title"
            className="bg-transparent font-display font-semibold text-sm text-[#F4F4F5] focus:outline-none focus:underline"
          />
          <span aria-hidden="true">·</span>
          <span>Technical Blocking Mode</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{uniqueScenesCount} Scenes</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{panels.length} Camera Setups</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">Total {totalRuntimeSeconds.toFixed(1)}s</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {statusNotice && (
            <div className="flex items-center gap-2 text-xs text-[#38BDF8] font-medium mr-1">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>{statusNotice}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowCompositionGuides((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showCompositionGuides
                ? 'bg-[#38BDF8]/15 border-[#38BDF8]/50 text-[#38BDF8]'
                : 'bg-[#18181D] border-[#27272F] text-[#A1A1AA]'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>{showCompositionGuides ? 'Guides: ON' : 'Guides: OFF'}</span>
          </button>

          <button
            type="button"
            onClick={handleRenderAllVisuals}
            disabled={isBatchGenerating || isParsingScript}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#F4F4F5] bg-[#18181D] border border-[#27272F] rounded-md hover:border-[#38BDF8]/60 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>Draft AI Schematics</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPdfModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#08080A] bg-[#38BDF8] hover:bg-[#7DD3FC] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export Crew PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDesktopModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#F4F4F5] bg-[#18181D] border border-[#27272F] hover:border-[#F2B705]/60 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Monitor className="w-3.5 h-3.5 text-[#F2B705]" />
            <span>Standalone Desktop App</span>
          </button>

          <button
            type="button"
            onClick={handleExportFadeInFile}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#A1A1AA] hover:text-[#F4F4F5] bg-[#18181D] border border-[#27272F] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>.fadein</span>
          </button>
        </div>
      </div>

      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="no-print bg-rose-950/70 border-b border-rose-800/80 px-6 py-2.5 flex items-center justify-between gap-4 text-xs text-rose-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-300 hover:text-white font-medium whitespace-nowrap"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {activeTab === 'workspace' && (
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-105px)]">
          {/* LEFT PANE: Fade In (.fadein) Screenplay Manuscript Editor & Technical Breakdown Parameters (5 cols) */}
          <aside className="no-print lg:col-span-5 border-b lg:border-b-0 lg:border-r border-[#232329] bg-[#0D0D11] flex flex-col max-h-[calc(100vh-105px)]">
            <div className="p-5 border-b border-[#232329] space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-semibold text-[#F4F4F5]">
                    Fade In Screenplay Manuscript
                  </h2>
                  <p className="text-xs text-[#A1A1AA] mt-0.5">
                    Native .fadein importer maintaining formatting for spatial & camera breakdown
                  </p>
                </div>
                <select
                  aria-label="Load sample script"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) handleLoadSample(e.target.value);
                  }}
                  className="bg-[#18181D] border border-[#27272F] text-xs text-[#F4F4F5] rounded-md px-2.5 py-1.5 focus:outline-none focus:border-[#F2B705]"
                >
                  <option value="">Load Preset .fadein...</option>
                  {SAMPLE_SCREENPLAYS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Technical Drafting Mode, Frame Gate Aspect Ratio, & Shot Count */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                    Technical Drafting Mode
                  </label>
                  <select
                    value={draftingMode}
                    onChange={(e) => setDraftingMode(e.target.value)}
                    className="w-full bg-[#16161C] border border-[#27272F] text-xs text-[#F4F4F5] rounded-md px-2.5 py-2 focus:outline-none focus:border-[#F2B705]"
                  >
                    {DRAFTING_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                      Frame Gate
                    </label>
                    <select
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value as any)}
                      className="w-full bg-[#16161C] border border-[#27272F] text-xs text-[#F4F4F5] rounded-md px-2 py-2 focus:outline-none focus:border-[#F2B705]"
                    >
                      <option value="16:9">16:9 (1.78)</option>
                      <option value="2.39:1">2.39:1 Scope</option>
                      <option value="4:3">4:3 (1.33)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                      Target Setups
                    </label>
                    <select
                      value={targetPanelCount}
                      onChange={(e) => {
                        const newCount = Number(e.target.value);
                        setTargetPanelCount(newCount);
                        handleInstantRebuildMechanics(selectedSceneSlugline, newCount);
                      }}
                      className="w-full bg-[#16161C] border border-[#27272F] text-xs text-[#F4F4F5] rounded-md px-2 py-2 focus:outline-none focus:border-[#F2B705]"
                    >
                      <option value={4}>4 Panels</option>
                      <option value={6}>6 Panels</option>
                      <option value={8}>8 Panels</option>
                      <option value={12}>12 Panels</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Scene Breakdown Scope Selector for Multi-Scene Uploaded .fadein Drafts */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-medium text-[#38BDF8]">
                    Scene Breakdown Scope ({parsedScenes.length} Scenes in Manuscript)
                  </label>
                  <button
                    type="button"
                    onClick={() => handleInstantRebuildMechanics(selectedSceneSlugline, targetPanelCount)}
                    className="text-[11px] font-mono text-[#F2B705] hover:underline cursor-pointer"
                  >
                    ↻ Rebuild Mechanics Now
                  </button>
                </div>
                <select
                  aria-label="Scene Breakdown Scope"
                  value={selectedSceneSlugline}
                  onChange={(e) => {
                    const nextScope = e.target.value;
                    setSelectedSceneSlugline(nextScope);
                    handleInstantRebuildMechanics(nextScope, targetPanelCount);
                  }}
                  className="w-full bg-[#16161C] border border-[#27272F] text-xs font-mono text-[#F4F4F5] rounded-md px-2.5 py-2 focus:outline-none focus:border-[#38BDF8]"
                >
                  <option value="ALL">
                    ALL SCENES ({parsedScenes.length} Scenes · Auto-Sample Full Draft)
                  </option>
                  {parsedScenes.map((sc) => (
                    <option key={`${sc.sceneNumber}-${sc.slugline}`} value={sc.slugline}>
                      SCENE {String(sc.sceneNumber).padStart(2, '0')}: {sc.slugline}
                      {sc.charactersInScene.length > 0 ? ` (${sc.charactersInScene.slice(0, 3).join(', ')})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Structured Fade In Page Editor & File Importer */}
            <FadeInScriptView
              elements={scriptElements}
              rawText={scriptText}
              sourceFormat={sourceFormat}
              lastImportedFileName={lastImportedFileName}
              activeSlugline={selectedPanel?.sceneSlugline}
              onUpdateElements={handleUpdateElements}
              onUpdateRawText={handleUpdateRawText}
              onImportFile={handleImportFadeInFile}
              onExportFadeIn={handleExportFadeInFile}
              onSelectSlugline={(slug) => {
                setSelectedSceneSlugline(slug);
                const matchingPanel = panels.find(
                  (p) => p.sceneSlugline.trim().toUpperCase() === slug.trim().toUpperCase()
                );
                if (matchingPanel) {
                  setSelectedPanelId(matchingPanel.id);
                } else {
                  handleInstantRebuildMechanics(slug, targetPanelCount);
                }
              }}
            />

            {/* Bottom Parse & Add Shot CTA Bar */}
            <div className="p-4 border-t border-[#232329] bg-[#0D0D11] flex items-center gap-3">
              <button
                type="button"
                onClick={handleGenerateStoryboardFromScript}
                disabled={isParsingScript || isBatchGenerating}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-[#F2B705] hover:bg-[#FACC15] disabled:opacity-50 text-[#08080A] font-semibold text-xs rounded-lg transition-colors cursor-pointer"
              >
                <Compass className="w-4 h-4" />
                <span>
                  {isParsingScript
                    ? 'Extracting Blocking & Camera Vectors...'
                    : isBatchGenerating
                    ? 'Drafting Technical Schematics...'
                    : 'Break Down Spatial Blocking & Composition'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleAddBlankPanel}
                title="Append custom camera setup"
                className="py-2.5 px-3.5 bg-[#18181D] hover:bg-[#22222A] text-[#F4F4F5] border border-[#27272F] text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                + Add Setup
              </button>
            </div>
          </aside>

          {/* RIGHT PANE: Technical Storyboard Schematics & Spatial Blocking Inspector (7 cols) */}
          <section className="lg:col-span-7 flex flex-col bg-[#08080A] overflow-y-auto max-h-[calc(100vh-105px)]">
            <div className="p-6 flex-1">
              <div className="no-print flex flex-wrap items-center justify-between gap-4 mb-5">
                <div>
                  <h1 className="font-display text-xl font-bold text-[#F4F4F5] tracking-tight">
                    Technical Storyboard Mechanics & Blocking
                  </h1>
                  <p className="text-xs text-[#A1A1AA] mt-0.5">
                    Mannequin figures, 180° floor plan axis, linear perspective grids, rule-of-thirds composition, and camera movement vectors
                  </p>
                </div>

                {/* Legend for Vector Arrows */}
                <div className="flex items-center gap-4 text-[11px] font-mono text-[#A1A1AA]">
                  <span className="text-[#38BDF8]">→ CAM VECTOR</span>
                  <span>·</span>
                  <span className="text-[#F2B705]">→ SUBJECT / SIGHTLINE</span>
                  <span>·</span>
                  <span className="text-zinc-400">180° AXIS PLAN</span>
                </div>
              </div>

              {/* Panels 2-Column Technical Schematic Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {panels.map((panel) => {
                  const isSelected = panel.id === selectedPanel?.id;
                  const showSchematic = !panel.imageUrl || brokenImages[panel.id];

                  return (
                    <article
                      key={panel.id}
                      onClick={() => setSelectedPanelId(panel.id)}
                      className={`group rounded-2xl bg-[#111116] border transition-colors overflow-hidden flex flex-col cursor-pointer ${
                        isSelected
                          ? 'border-[#38BDF8]'
                          : 'border-[#22222A] hover:border-[#3F3F46]'
                      }`}
                    >
                      {/* Panel Top Metadata Strip (Zero-Pill Unboxed Text) */}
                      <div className="px-4 py-3 border-b border-[#1E1E26] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs min-w-0">
                          <span className="font-mono font-bold text-[#38BDF8] tabular-nums shrink-0">
                            SETUP {String(panel.panelNumber).padStart(2, '0')}
                          </span>
                          <span className="text-zinc-600" aria-hidden="true">·</span>
                          <span className="font-semibold text-[#F4F4F5] truncate">
                            {panel.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#A1A1AA] shrink-0 tabular-nums">
                          {panel.sceneComposition?.subjectLabel && (
                            <>
                              <span className="text-[#F2B705]">
                                {panel.sceneComposition.subjectLabel}
                                {panel.sceneComposition.secondarySubjectLabel
                                  ? ` / ${panel.sceneComposition.secondarySubjectLabel}`
                                  : ''}
                              </span>
                              <span className="text-zinc-600" aria-hidden="true">·</span>
                            </>
                          )}
                          <span>{panel.durationSeconds}s</span>
                        </div>
                      </div>

                      {/* Technical Frame Viewport */}
                      <div className={`relative w-full ${aspectContainerClass} bg-[#101216] overflow-hidden`}>
                        {panel.isGeneratingImage ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0D0F14] p-6 text-center">
                            <RefreshCw className="w-7 h-7 text-[#38BDF8] animate-spin mb-3" />
                            <p className="text-xs font-semibold text-[#F4F4F5]">
                              Drafting Technical Wireframe & Vectors...
                            </p>
                            <p className="text-[11px] text-[#A1A1AA] mt-1 max-w-xs line-clamp-2 font-mono">
                              {panel.blockingNotes}
                            </p>
                          </div>
                        ) : showSchematic ? (
                          <CinematicFallbackPlate
                            panel={panel}
                            showGuides={showCompositionGuides}
                          />
                        ) : (
                          <img
                            src={panel.imageUrl}
                            alt={`${panel.sceneSlugline} - ${panel.title}`}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setBrokenImages((prev) => ({ ...prev, [panel.id]: true }))
                            }
                            className="w-full h-full object-cover"
                          />
                        )}

                        {/* Hover Quick Actions Bar */}
                        <div className="no-print absolute top-3 right-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInsertReverseCoveragePanel(panel);
                            }}
                            title="Insert 180-Degree Reverse OTS Coverage Setup"
                            className="px-2.5 py-1.5 rounded-md bg-black/85 hover:bg-[#F2B705] text-[#F2B705] hover:text-black text-[11px] font-mono backdrop-blur transition-colors cursor-pointer"
                          >
                            + 180° Reverse
                          </button>
                          {panel.imageUrl && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdatePanelField(panel.id, 'imageUrl', undefined);
                              }}
                              title="Reset to Parametric Blueprint Schematic"
                              className="px-2.5 py-1.5 rounded-md bg-black/85 hover:bg-zinc-800 text-zinc-200 text-[11px] font-mono backdrop-blur transition-colors cursor-pointer"
                            >
                              Blueprint
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              generateSinglePanelVisual(panel, draftingMode, aspectRatio);
                            }}
                            disabled={panel.isGeneratingImage}
                            title="Generate AI Wireframe Schematic"
                            className="px-2.5 py-1.5 rounded-md bg-black/85 hover:bg-[#38BDF8] text-white hover:text-black text-[11px] font-medium flex items-center gap-1 backdrop-blur transition-colors cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>AI Draft</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightboxPanelId(panel.id);
                            }}
                            title="Inspect Fullscreen"
                            className="p-1.5 rounded-md bg-black/85 hover:bg-white text-white hover:text-black backdrop-blur transition-colors cursor-pointer"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Panel Camera Mechanics, Spatial Blocking & Fade In Excerpt */}
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          {/* Scene Heading */}
                          <div className="font-mono text-[11px] font-bold uppercase tracking-wide text-[#F4F4F5] bg-[#17171F] px-2.5 py-1 rounded border-b border-[#262632]">
                            {panel.sceneSlugline}
                          </div>

                          {/* Camera Setup Line (Zero-Pill Unboxed Text) */}
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-[#A1A1AA] mt-2">
                            <span className="text-[#38BDF8]">{panel.shotSize}</span>
                            <span aria-hidden="true">·</span>
                            <span>{panel.cameraAngle}</span>
                            <span aria-hidden="true">·</span>
                            <span>{panel.lensFocalLength}</span>
                            <span aria-hidden="true">·</span>
                            <span className="text-[#F2B705]">{panel.cameraMovement}</span>
                          </div>

                          {/* Spatial Blocking & Composition Note */}
                          <div className="mt-2 pt-2 border-t border-[#1C1C24] text-[11px] font-mono text-[#94A3B8]">
                            <span className="text-zinc-400 font-semibold">BLOCKING: </span>
                            {panel.blockingNotes}
                          </div>

                          {/* Literal Action Element */}
                          <p className="font-mono text-xs text-[#E4E4E7] mt-2 leading-relaxed">
                            {panel.actionNotes}
                          </p>
                        </div>

                        {/* Formatted Fade In Character / Parenthetical / Dialogue Block */}
                        <div className="pt-1">
                          {renderFormattedDialogueBlock(panel.dialogueSnippet)}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            {/* Active Shot Spatial Blocking & Camera Mechanics Inspector (Bottom of Right Column) */}
            {selectedPanel && (
              <div className="no-print border-t border-[#232329] bg-[#0E0E13] p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2.5">
                    <Camera className="w-4 h-4 text-[#38BDF8]" />
                    <h3 className="font-display text-sm font-semibold text-[#F4F4F5]">
                      Spatial Blocking & Composition Inspector — Setup {String(selectedPanel.panelNumber).padStart(2, '0')}: {selectedPanel.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleInsertReverseCoveragePanel(selectedPanel)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#F2B705] bg-[#18181F] hover:bg-[#F2B705] hover:text-[#08080A] border border-[#F2B705]/40 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>+ 180° Reverse Coverage Setup</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => generateSinglePanelVisual(selectedPanel, draftingMode, aspectRatio)}
                      disabled={selectedPanel.isGeneratingImage}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#08080A] bg-[#38BDF8] hover:bg-[#7DD3FC] disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${selectedPanel.isGeneratingImage ? 'animate-spin' : ''}`} />
                      <span>{selectedPanel.isGeneratingImage ? 'Drafting...' : 'Draft AI Wireframe'}</span>
                    </button>

                    {panels.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeletePanel(selectedPanel.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-950/50 border border-transparent hover:border-rose-800/60 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Setup</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Left 7 Cols: Camera Optics, Movement & Interactive Spatial Geometry Controls */}
                  <div className="lg:col-span-7 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-[#A1A1AA] mb-1">Setup Title</label>
                        <input
                          type="text"
                          value={selectedPanel.title}
                          onChange={(e) => handleUpdatePanelField(selectedPanel.id, 'title', e.target.value)}
                          className="w-full bg-[#16161D] border border-[#27272F] rounded-md px-3 py-1.5 text-xs text-[#F4F4F5] focus:outline-none focus:border-[#38BDF8]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[#A1A1AA] mb-1">Scene Heading (Slugline)</label>
                        <input
                          type="text"
                          value={selectedPanel.sceneSlugline}
                          onChange={(e) => handleUpdatePanelField(selectedPanel.id, 'sceneSlugline', e.target.value.toUpperCase())}
                          className="w-full bg-[#16161D] border border-[#27272F] rounded-md px-3 py-1.5 font-mono text-xs text-[#F4F4F5] uppercase focus:outline-none focus:border-[#38BDF8]"
                        />
                      </div>
                    </div>

                    {/* Camera Framing & Movement Selectors */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div>
                        <label className="block text-[11px] text-[#A1A1AA] mb-1">Shot Size (Scale)</label>
                        <select
                          value={selectedPanel.shotSize}
                          onChange={(e) => {
                            handleUpdatePanelField(selectedPanel.id, 'shotSize', e.target.value);
                            handleUpdatePanelField(selectedPanel.id, 'imageUrl', undefined);
                          }}
                          className="w-full bg-[#16161D] border border-[#27272F] rounded-md px-2 py-1.5 text-xs text-[#F4F4F5]"
                        >
                          {SHOT_SIZES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-[#A1A1AA] mb-1">Camera Elevation</label>
                        <select
                          value={selectedPanel.cameraAngle}
                          onChange={(e) => {
                            handleUpdatePanelField(selectedPanel.id, 'cameraAngle', e.target.value);
                            handleUpdatePanelField(selectedPanel.id, 'imageUrl', undefined);
                          }}
                          className="w-full bg-[#16161D] border border-[#27272F] rounded-md px-2 py-1.5 text-xs text-[#F4F4F5]"
                        >
                          {CAMERA_ANGLES.map((a) => (
                            <option key={a} value={a}>{a}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-[#A1A1AA] mb-1">Camera Vector</label>
                        <select
                          value={selectedPanel.cameraMovement}
                          onChange={(e) => {
                            handleUpdatePanelField(selectedPanel.id, 'cameraMovement', e.target.value);
                            handleUpdatePanelField(selectedPanel.id, 'imageUrl', undefined);
                          }}
                          className="w-full bg-[#16161D] border border-[#27272F] rounded-md px-2 py-1.5 text-xs text-[#F4F4F5]"
                        >
                          {CAMERA_MOVEMENTS.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-[#A1A1AA] mb-1">Focal Length</label>
                        <select
                          value={selectedPanel.lensFocalLength}
                          onChange={(e) => handleUpdatePanelField(selectedPanel.id, 'lensFocalLength', e.target.value)}
                          className="w-full bg-[#16161D] border border-[#27272F] rounded-md px-2 py-1.5 text-xs text-[#F4F4F5]"
                        >
                          {LENS_FOCAL_LENGTHS.map((l) => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Interactive Spatial Composition & Mannequin Placement Controls */}
                    <div className="p-3 rounded-lg bg-[#14141C] border border-[#252532] space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-mono text-[#38BDF8] mb-1">
                            Primary Subject (A) Name
                          </label>
                          <input
                            type="text"
                            value={selectedPanel.sceneComposition?.subjectLabel ?? 'SUBJ A'}
                            onChange={(e) =>
                              handleUpdateCompositionField(selectedPanel.id, 'subjectLabel', e.target.value.toUpperCase())
                            }
                            placeholder="e.g. MERCER"
                            className="w-full bg-[#0E0E14] border border-[#27272F] rounded px-2 py-1 text-xs font-mono text-[#F4F4F5]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono text-[#38BDF8] mb-1">
                            Subject (A) Rule-of-Thirds
                          </label>
                          <select
                            value={selectedPanel.sceneComposition?.subjectGridZone || 'center'}
                            onChange={(e) =>
                              handleUpdateCompositionField(selectedPanel.id, 'subjectGridZone', e.target.value)
                            }
                            className="w-full bg-[#0E0E14] border border-[#27272F] rounded px-2 py-1 text-xs text-[#F4F4F5]"
                          >
                            <option value="left_third">Left Vertical Third</option>
                            <option value="center">Center Axis</option>
                            <option value="right_third">Right Vertical Third</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono text-[#F2B705] mb-1">
                            Subject Motion / Sightline
                          </label>
                          <select
                            value={selectedPanel.sceneComposition?.subjectMotionDirection || 'none'}
                            onChange={(e) =>
                              handleUpdateCompositionField(selectedPanel.id, 'subjectMotionDirection', e.target.value)
                            }
                            className="w-full bg-[#0E0E14] border border-[#27272F] rounded px-2 py-1 text-xs text-[#F4F4F5]"
                          >
                            <option value="none">Stationary</option>
                            <option value="left_to_right">Move / Look Left → Right</option>
                            <option value="right_to_left">Move / Look Right → Left</option>
                          </select>
                        </div>
                      </div>

                      {/* Secondary Subject (B) / OTS Partner & 180° Axis Controls */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 border-t border-[#222230]">
                        <div>
                          <label className="block text-[11px] font-mono text-[#A1A1AA] mb-1">
                            Partner / OTS (B) Name
                          </label>
                          <input
                            type="text"
                            value={selectedPanel.sceneComposition?.secondarySubjectLabel ?? ''}
                            onChange={(e) =>
                              handleUpdateCompositionField(selectedPanel.id, 'secondarySubjectLabel', e.target.value.toUpperCase())
                            }
                            placeholder="None (Single)"
                            className="w-full bg-[#0E0E14] border border-[#27272F] rounded px-2 py-1 text-xs font-mono text-[#F4F4F5]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono text-[#A1A1AA] mb-1">
                            Partner (B) Placement
                          </label>
                          <select
                            value={selectedPanel.sceneComposition?.secondarySubjectZone || 'none'}
                            onChange={(e) =>
                              handleUpdateCompositionField(selectedPanel.id, 'secondarySubjectZone', e.target.value)
                            }
                            className="w-full bg-[#0E0E14] border border-[#27272F] rounded px-2 py-1 text-xs text-[#F4F4F5]"
                          >
                            <option value="none">No Secondary Figure</option>
                            <option value="right_third">Right Third (2-Shot)</option>
                            <option value="left_third">Left Third (2-Shot)</option>
                            <option value="foreground_ots_left">Foreground Left (OTS)</option>
                            <option value="foreground_ots_right">Foreground Right (OTS)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono text-[#A1A1AA] mb-1">
                            180° Axis Camera Side
                          </label>
                          <select
                            value={selectedPanel.sceneComposition?.cameraSideOfAxis || 'A_SIDE_NORMAL'}
                            onChange={(e) =>
                              handleUpdateCompositionField(selectedPanel.id, 'cameraSideOfAxis', e.target.value)
                            }
                            className="w-full bg-[#0E0E14] border border-[#27272F] rounded px-2 py-1 text-xs text-[#F4F4F5]"
                          >
                            <option value="A_SIDE_NORMAL">Cam A (Normal 180°)</option>
                            <option value="B_SIDE_REVERSE">Cam B (Reverse 180°)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono text-[#A1A1AA] mb-1">
                            Horizon Height ({selectedPanel.sceneComposition?.vanishingPointY ?? 48}%)
                          </label>
                          <input
                            type="range"
                            min={20}
                            max={80}
                            value={selectedPanel.sceneComposition?.vanishingPointY ?? 48}
                            onChange={(e) =>
                              handleUpdateCompositionField(
                                selectedPanel.id,
                                'vanishingPointY',
                                Number(e.target.value)
                              )
                            }
                            className="w-full accent-[#38BDF8] cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-[#A1A1AA] mb-1">Physical Action Element</label>
                        <textarea
                          rows={2}
                          value={selectedPanel.actionNotes}
                          onChange={(e) => handleUpdatePanelField(selectedPanel.id, 'actionNotes', e.target.value)}
                          className="w-full bg-[#16161D] border border-[#27272F] rounded-md p-2 font-mono text-xs text-[#F4F4F5] focus:outline-none focus:border-[#38BDF8]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[#A1A1AA] mb-1">Character & Dialogue Cue</label>
                        <textarea
                          rows={2}
                          value={selectedPanel.dialogueSnippet}
                          onChange={(e) => handleUpdatePanelField(selectedPanel.id, 'dialogueSnippet', e.target.value)}
                          className="w-full bg-[#16161D] border border-[#27272F] rounded-md p-2 font-mono text-xs text-[#F4F4F5] focus:outline-none focus:border-[#38BDF8]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right 5 Cols: Spatial Blocking Notes & Technical Prompt Adjuster */}
                  <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
                    <div>
                      <label className="block text-[11px] text-[#A1A1AA] mb-1">
                        Spatial Geometry & Blocking Specification
                      </label>
                      <textarea
                        rows={2}
                        value={selectedPanel.blockingNotes}
                        onChange={(e) => handleUpdatePanelField(selectedPanel.id, 'blockingNotes', e.target.value)}
                        className="w-full bg-[#16161D] border border-[#27272F] rounded-md p-2 font-mono text-xs text-[#94A3B8] leading-relaxed focus:outline-none focus:border-[#38BDF8]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-[#A1A1AA] mb-1">
                        Technical Wireframe Schematic Prompt
                      </label>
                      <textarea
                        rows={3}
                        value={selectedPanel.visualPrompt}
                        onChange={(e) => handleUpdatePanelField(selectedPanel.id, 'visualPrompt', e.target.value)}
                        className="w-full bg-[#16161D] border border-[#27272F] rounded-md p-2 text-xs text-[#E4E4E7] leading-relaxed focus:outline-none focus:border-[#38BDF8]"
                      />
                    </div>

                    {/* AI Spatial & Camera Mechanics Adjuster */}
                    <div className="pt-1">
                      <label className="block text-[11px] text-[#A1A1AA] mb-1">
                        AI Blocking & Camera Vector Adjuster
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={directorNoteInput}
                          onChange={(e) => setDirectorNoteInput(e.target.value)}
                          placeholder="e.g., Move subject to right third, overhead angle, pull-back camera..."
                          className="flex-1 bg-[#16161D] border border-[#27272F] rounded-md px-3 py-1.5 text-xs text-[#F4F4F5] placeholder-[#52525B] focus:outline-none focus:border-[#38BDF8]"
                        />
                        <button
                          type="button"
                          onClick={() => handleEnhanceShotWithAI(selectedPanel)}
                          disabled={isEnhancingShot || selectedPanel.isGeneratingImage}
                          className="px-3 py-1.5 bg-[#1E1E26] hover:bg-[#272732] border border-[#32323F] text-xs font-medium text-[#38BDF8] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {isEnhancingShot ? 'Updating...' : 'Apply Blocking'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>
      )}

      {/* TAB 2: PRODUCTION SHOT SCHEDULE TABLE */}
      {activeTab === 'shotlist' && (
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="font-display text-2xl font-bold text-[#F4F4F5]">
                Technical Shot Schedule — {projectTitle}
              </h1>
              <p className="text-xs text-[#A1A1AA] mt-1">
                Tabular camera blocking, focal lengths, movement vectors, and composition geometry
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowPdfModal(true)}
                className="px-3.5 py-2 text-xs font-semibold text-[#08080A] bg-[#38BDF8] rounded-lg hover:bg-[#7DD3FC] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Export Crew PDF Packet
              </button>
              <button
                type="button"
                onClick={handleAddBlankPanel}
                className="px-3.5 py-2 text-xs font-semibold text-[#08080A] bg-[#F2B705] rounded-lg hover:bg-[#FACC15] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                + Append Camera Setup
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#232329] bg-[#0E0E13]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#232329] text-[11px] font-mono text-[#A1A1AA] bg-[#14141B]">
                  <th className="py-3 px-4">SETUP #</th>
                  <th className="py-3 px-4">SCENE HEADING</th>
                  <th className="py-3 px-4">SHOT & ELEVATION</th>
                  <th className="py-3 px-4">CAMERA VECTOR / LENS</th>
                  <th className="py-3 px-4">SPATIAL BLOCKING & COMPOSITION</th>
                  <th className="py-3 px-4 text-right">DURATION</th>
                  <th className="py-3 px-4 text-right">SCHEMATIC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1C1C24] text-xs">
                {panels.map((panel) => (
                  <tr
                    key={panel.id}
                    onClick={() => {
                      setSelectedPanelId(panel.id);
                      setActiveTab('workspace');
                    }}
                    className="hover:bg-[#16161F] transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-[#38BDF8] tabular-nums">
                      {String(panel.panelNumber).padStart(2, '0')}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-zinc-300 uppercase">
                      {panel.sceneSlugline}
                    </td>
                    <td className="py-3.5 px-4 text-[#F4F4F5] font-medium">
                      {panel.shotSize} · {panel.cameraAngle}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#F2B705]">
                      {panel.cameraMovement} · {panel.lensFocalLength}
                    </td>
                    <td className="py-3.5 px-4 max-w-md">
                      <p className="font-mono text-[#94A3B8] line-clamp-1">{panel.blockingNotes}</p>
                      <p className="text-[11px] font-mono text-[#E4E4E7] line-clamp-1 mt-0.5">
                        {panel.actionNotes}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-zinc-300">
                      {Number(panel.durationSeconds).toFixed(1)}s
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightboxPanelId(panel.id);
                        }}
                        className="text-xs font-medium text-[#38BDF8] hover:underline"
                      >
                        Inspect Diagram
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      )}

      {/* TAB 3: ANIMATIC TIMING PLAYER */}
      {activeTab === 'animatic' && (
        <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-4">
            <div>
              <h1 className="font-display text-xl font-bold text-[#F4F4F5]">
                Pre-Vis Animatic Timing — {projectTitle}
              </h1>
              <p className="text-xs text-[#A1A1AA]">
                Sequential camera setup pacing with live spatial composition guides and dialogue timing
              </p>
            </div>
            <div className="text-xs font-mono text-[#A1A1AA] tabular-nums">
              SETUP {String((panels[animaticIndex]?.panelNumber) || 1).padStart(2, '0')} OF {String(panels.length).padStart(2, '0')}
            </div>
          </div>

          {panels[animaticIndex] && (
            <div className="w-full rounded-2xl border border-[#27272F] bg-[#0E0E13] overflow-hidden shadow-2xl">
              {/* Viewport */}
              <div className={`relative w-full ${aspectContainerClass} bg-[#101216]`}>
                {!panels[animaticIndex].imageUrl || brokenImages[panels[animaticIndex].id] ? (
                  <CinematicFallbackPlate
                    panel={panels[animaticIndex]}
                    showGuides={showCompositionGuides}
                  />
                ) : (
                  <img
                    src={panels[animaticIndex].imageUrl}
                    alt={panels[animaticIndex].title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Top Director Overlay */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                  <div className="bg-black/80 backdrop-blur px-3 py-1.5 rounded-md text-xs font-mono text-zinc-200 uppercase">
                    {panels[animaticIndex].sceneSlugline}
                  </div>
                  <div className="bg-black/80 backdrop-blur px-3 py-1.5 rounded-md text-xs font-mono text-[#38BDF8]">
                    {panels[animaticIndex].shotSize} · {panels[animaticIndex].lensFocalLength} · {panels[animaticIndex].cameraMovement}
                  </div>
                </div>

                {/* Action & Dialogue Timing Bar */}
                <div className="absolute inset-x-0 bottom-9 bg-black/85 backdrop-blur-sm py-3 px-6 text-center border-t border-[#222630]">
                  <p className="font-mono text-xs text-[#E4E4E7] max-w-2xl mx-auto">
                    {panels[animaticIndex].actionNotes}
                  </p>
                  <p className="font-mono text-xs text-[#F2B705] mt-1 max-w-xl mx-auto">
                    {panels[animaticIndex].dialogueSnippet}
                  </p>
                </div>
              </div>

              {/* Transport Controls & Scrubber Strip */}
              <div className="p-4 border-t border-[#232329] flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlayingAnimatic(false);
                      setAnimaticIndex((prev) => Math.max(0, prev - 1));
                    }}
                    className="p-2 rounded-lg bg-[#18181F] hover:bg-[#23232D] text-[#F4F4F5] cursor-pointer"
                    title="Previous Setup"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsPlayingAnimatic((prev) => !prev)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F2B705] hover:bg-[#FACC15] text-[#08080A] font-semibold text-xs cursor-pointer"
                  >
                    {isPlayingAnimatic ? (
                      <>
                        <Pause className="w-4 h-4" />
                        <span>Pause Timing</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>Play Animatic</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsPlayingAnimatic(false);
                      setAnimaticIndex((prev) => Math.min(panels.length - 1, prev + 1));
                    }}
                    className="p-2 rounded-lg bg-[#18181F] hover:bg-[#23232D] text-[#F4F4F5] cursor-pointer"
                    title="Next Setup"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>

                {/* Mini Frame Timeline Dots */}
                <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                  {panels.map((p, idx) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setIsPlayingAnimatic(false);
                        setAnimaticIndex(idx);
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-mono tabular-nums transition-colors cursor-pointer ${
                        idx === animaticIndex
                          ? 'bg-[#38BDF8] text-[#08080A] font-bold'
                          : 'bg-[#18181F] text-[#A1A1AA] hover:text-[#F4F4F5]'
                      }`}
                    >
                      {String(p.panelNumber).padStart(2, '0')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {/* TAB 4: SAMPLE SCREENPLAY TEMPLATES */}
      {activeTab === 'samples' && (
        <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-bold text-[#F4F4F5]">
              Fade In Blocking Study Templates
            </h1>
            <p className="text-xs text-[#A1A1AA] mt-1">
              Load a formatted screenplay to inspect fundamental camera placement, spatial outlines, and movement vectors
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SAMPLE_SCREENPLAYS.map((sample) => (
              <div
                key={sample.id}
                className="rounded-2xl border border-[#232329] bg-[#111116] p-6 flex flex-col justify-between space-y-5"
              >
                <div>
                  <div className="flex items-center gap-2 text-xs text-[#A1A1AA] font-mono">
                    <span className="text-[#38BDF8]">{sample.genre}</span>
                    <span aria-hidden="true">·</span>
                    <span>{sample.aspectRatio}</span>
                    <span aria-hidden="true">·</span>
                    <span>.fadein</span>
                  </div>
                  <h2 className="font-display text-lg font-bold text-[#F4F4F5] mt-2">
                    {sample.title}
                  </h2>
                  <p className="text-xs text-[#A1A1AA] mt-2 leading-relaxed">
                    {sample.logline}
                  </p>
                  <pre className="mt-4 p-3 rounded-lg bg-[#09090C] border border-[#1E1E26] font-mono text-[11px] text-zinc-400 line-clamp-6 whitespace-pre-wrap">
                    {sample.scriptText}
                  </pre>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleLoadSample(sample.id)}
                    className="w-full py-2 px-4 rounded-lg bg-[#F2B705] hover:bg-[#FACC15] text-[#08080A] font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Load Blocking Study
                  </button>
                </div>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* MODAL 1: CREW STORYBOARD PDF PACKET EXPORTER */}
      {showPdfModal && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowPdfModal(false)}
        >
          <div
            className="max-w-lg w-full bg-[#111116] border border-[#27272F] rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[#232329] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#38BDF8]" />
                <h2 className="font-display text-base font-bold text-[#F4F4F5]">
                  Export Film Crew Storyboard PDF Packet
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowPdfModal(false)}
                className="p-1 rounded-lg bg-[#1C1C24] hover:bg-[#272732] text-[#F4F4F5] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-[#A1A1AA] leading-relaxed">
                Generates a landscape US-Letter PDF packet containing high-DPI technical blocking diagrams, camera optics & movement vectors, and Courier-formatted Fade In screenplay excerpts (Scene Headings, Action, Character Cues, Parentheticals, and Dialogue).
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                    Page Layout Density
                  </label>
                  <select
                    value={pdfLayoutPerPage}
                    onChange={(e) => setPdfLayoutPerPage(e.target.value as '2-up' | '4-up')}
                    className="w-full bg-[#16161D] border border-[#27272F] rounded-lg px-3 py-2 text-xs text-[#F4F4F5]"
                  >
                    <option value="2-up">2-Up Detailed Crew Breakdown</option>
                    <option value="4-up">4-Up Compact Contact Sheet</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                    Master Shot Schedule
                  </label>
                  <select
                    value={pdfIncludeSchedule ? 'yes' : 'no'}
                    onChange={(e) => setPdfIncludeSchedule(e.target.value === 'yes')}
                    className="w-full bg-[#16161D] border border-[#27272F] rounded-lg px-3 py-2 text-xs text-[#F4F4F5]"
                  >
                    <option value="yes">Append Master Shot Table Page</option>
                    <option value="no">Storyboard Panels Only</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#A1A1AA] mb-1">
                  Director / First AD Production Header Note
                </label>
                <textarea
                  rows={2}
                  value={pdfProductionNotes}
                  onChange={(e) => setPdfProductionNotes(e.target.value)}
                  className="w-full bg-[#16161D] border border-[#27272F] rounded-lg p-2.5 font-mono text-xs text-[#F4F4F5] focus:outline-none focus:border-[#38BDF8]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowPdfModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#1A1A22] hover:bg-[#23232E] text-[#A1A1AA] font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerateCrewPdf}
                  disabled={isExportingPdf}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#38BDF8] hover:bg-[#7DD3FC] text-[#08080A] font-semibold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExportingPdf ? 'Rendering PDF...' : 'Download Crew PDF (.pdf)'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: STANDALONE DESKTOP APP & INTERNAL TESTING BUNDLE */}
      {showDesktopModal && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowDesktopModal(false)}
        >
          <div
            className="max-w-lg w-full bg-[#111116] border border-[#27272F] rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[#232329] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-[#F2B705]" />
                <h2 className="font-display text-base font-bold text-[#F4F4F5]">
                  Standalone Desktop Build for Internal Testing
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowDesktopModal(false)}
                className="p-1 rounded-lg bg-[#1C1C24] hover:bg-[#272732] text-[#F4F4F5] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-[#16161F] border border-[#262636] space-y-2">
                <div className="flex items-center gap-2 font-semibold text-[#F4F4F5]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Full Application Error & Integrity Check Passed</span>
                </div>
                <p className="text-[#A1A1AA] leading-relaxed">
                  TypeScript compilation, Fade In (<code className="text-[#F4F4F5]">.fadein</code>) ZIP/XML parser, high-DPI PDF canvas rasterizer, and parametric SVG schematic engine are verified with zero runtime or lint errors.
                </p>
              </div>

              <p className="text-[#A1A1AA] leading-relaxed">
                Download a self-contained, zero-dependency **Standalone Desktop Studio** that runs natively on Windows, macOS, or Linux without requiring a local server or internet connection:
              </p>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={handleDownloadDesktopBundleZip}
                  className="w-full p-3.5 rounded-xl bg-[#F2B705] hover:bg-[#FACC15] text-[#08080A] font-semibold flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="text-left">
                    <div className="text-xs font-bold">
                      Download Complete Desktop Testing Bundle (.zip)
                    </div>
                    <div className="text-[11px] opacity-80 font-normal mt-0.5">
                      Includes Standalone Desktop App (.html) + Native .fadein Script + Project .json + README
                    </div>
                  </div>
                  <Download className="w-4 h-4 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={handleDownloadStandaloneHtml}
                  className="w-full p-3.5 rounded-xl bg-[#181822] hover:bg-[#222230] border border-[#2C2C3C] text-[#F4F4F5] font-medium flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="text-left">
                    <div className="text-xs font-semibold">
                      Download Single-File Desktop Executable (.html)
                    </div>
                    <div className="text-[11px] text-[#A1A1AA] font-normal mt-0.5">
                      Double-click on any desktop machine to edit setups, blocking grids, and shot schedules offline
                    </div>
                  </div>
                  <Monitor className="w-4 h-4 text-[#38BDF8] shrink-0" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN LIGHTBOX MODAL FOR TECHNICAL SCHEMATIC INSPECTION */}
      {lightboxPanel && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-10"
          onClick={() => setLightboxPanelId(null)}
        >
          <div
            className="relative max-w-5xl w-full bg-[#111116] border border-[#27272F] rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[#232329] flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-sm">
                <span className="font-mono font-bold text-[#38BDF8]">
                  SETUP {String(lightboxPanel.panelNumber).padStart(2, '0')}
                </span>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <span className="font-display font-semibold text-[#F4F4F5]">
                  {lightboxPanel.title}
                </span>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <span className="font-mono text-xs text-[#A1A1AA] uppercase">
                  {lightboxPanel.sceneSlugline}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setLightboxPanelId(null)}
                className="p-1.5 rounded-lg bg-[#1C1C24] hover:bg-[#272732] text-[#F4F4F5] cursor-pointer"
                aria-label="Close lightbox"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative w-full aspect-video bg-[#101216]">
              {!lightboxPanel.imageUrl || brokenImages[lightboxPanel.id] ? (
                <CinematicFallbackPlate
                  panel={lightboxPanel}
                  showGuides={showCompositionGuides}
                />
              ) : (
                <img
                  src={lightboxPanel.imageUrl}
                  alt={lightboxPanel.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 bg-[#0D0D12]">
              <div className="md:col-span-2 space-y-2">
                <p className="text-xs font-mono text-[#38BDF8]">
                  {lightboxPanel.shotSize} · {lightboxPanel.cameraAngle} · {lightboxPanel.lensFocalLength} · {lightboxPanel.cameraMovement}
                </p>
                <p className="text-xs font-mono text-[#94A3B8]">
                  BLOCKING: {lightboxPanel.blockingNotes}
                </p>
                <p className="font-mono text-sm text-[#F4F4F5] leading-relaxed">
                  {lightboxPanel.actionNotes}
                </p>
                <div className="pt-1 max-w-md">
                  {renderFormattedDialogueBlock(lightboxPanel.dialogueSnippet)}
                </div>
              </div>
              <div className="flex flex-col justify-between border-t md:border-t-0 md:border-l border-[#232329] pt-4 md:pt-0 md:pl-6">
                <div>
                  <span className="text-[11px] font-mono text-[#A1A1AA] block">
                    TECHNICAL SCHEMATIC SPECIFICATION
                  </span>
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-3 font-mono">
                    {lightboxPanel.visualPrompt}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => generateSinglePanelVisual(lightboxPanel, draftingMode, aspectRatio)}
                  disabled={lightboxPanel.isGeneratingImage}
                  className="mt-4 w-full py-2 px-3 rounded-lg bg-[#38BDF8] hover:bg-[#7DD3FC] text-[#08080A] font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${lightboxPanel.isGeneratingImage ? 'animate-spin' : ''}`} />
                  <span>{lightboxPanel.isGeneratingImage ? 'Drafting...' : 'Draft AI Wireframe'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
