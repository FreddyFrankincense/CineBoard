import React, { useState, useRef } from 'react';
import {
  Upload,
  FileDown,
  Plus,
  Trash2,
  Eye,
  Edit3,
  FileCheck,
} from 'lucide-react';
import {
  ScreenplayElement,
  ScreenplayElementType,
} from '../utils/fadeInParser';

interface FadeInScriptViewProps {
  elements: ScreenplayElement[];
  rawText: string;
  sourceFormat: 'fadein-zip' | 'fadein-xml' | 'fountain';
  lastImportedFileName: string | null;
  activeSlugline?: string;
  onUpdateElements: (updatedElements: ScreenplayElement[]) => void;
  onUpdateRawText: (newText: string) => void;
  onImportFile: (file: File) => void;
  onExportFadeIn: () => void;
  onSelectSlugline?: (slugline: string) => void;
}

const ELEMENT_TYPE_LABELS: Record<ScreenplayElementType, string> = {
  scene_heading: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  parenthetical: 'Parenthetical',
  dialogue: 'Dialogue',
  transition: 'Transition',
  shot: 'Shot',
  note: 'Note',
  general: 'General',
};

export const FadeInScriptView: React.FC<FadeInScriptViewProps> = ({
  elements,
  rawText,
  sourceFormat,
  lastImportedFileName,
  activeSlugline,
  onUpdateElements,
  onUpdateRawText,
  onImportFile,
  onExportFadeIn,
  onSelectSlugline,
}) => {
  const [editorMode, setEditorMode] = useState<'formatted' | 'raw'>('formatted');
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportFile(file);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onImportFile(file);
    }
  };

  const handleElementTextChange = (id: string, newText: string) => {
    const updated = elements.map((el) =>
      el.id === id
        ? {
            ...el,
            text:
              el.type === 'scene_heading' || el.type === 'character' || el.type === 'transition'
                ? newText.toUpperCase()
                : newText,
          }
        : el
    );
    onUpdateElements(updated);
  };

  const handleElementTypeChange = (id: string, newType: ScreenplayElementType) => {
    const updated = elements.map((el) => {
      if (el.id !== id) return el;
      let text = el.text;
      if (newType === 'parenthetical' && !text.startsWith('(')) {
        text = `(${text.replace(/^\(|\)$/g, '')})`;
      } else if (newType === 'scene_heading' || newType === 'character' || newType === 'transition') {
        text = text.toUpperCase();
      }
      return { ...el, type: newType, text };
    });
    onUpdateElements(updated);
  };

  const handleInsertElementAfter = (index: number, defaultType: ScreenplayElementType = 'action') => {
    const newEl: ScreenplayElement = {
      id: `el-${Date.now()}`,
      type: defaultType,
      text:
        defaultType === 'scene_heading'
          ? 'INT. NEW LOCATION - NIGHT'
          : defaultType === 'character'
          ? 'CHARACTER'
          : defaultType === 'dialogue'
          ? 'New dialogue line.'
          : 'New action beat.',
    };
    const next = [...elements];
    next.splice(index + 1, 0, newEl);
    onUpdateElements(next);
    setEditingElementId(newEl.id);
  };

  const handleDeleteElement = (id: string) => {
    if (elements.length <= 1) return;
    onUpdateElements(elements.filter((el) => el.id !== id));
  };

  // Returns authentic Fade In Pro / industry screenplay margins & typography classes for each element type
  const getElementFormattingClasses = (type: ScreenplayElementType): string => {
    switch (type) {
      case 'scene_heading':
        return 'mt-5 mb-2 font-bold uppercase tracking-wide text-[#F4F4F5] bg-[#181820] px-2.5 py-1 rounded border-b border-[#2A2A35]';
      case 'action':
        return 'my-2 text-[#E4E4E7] leading-relaxed';
      case 'character':
        return 'mt-4 mb-0.5 ml-[34%] mr-[15%] font-bold uppercase tracking-wider text-[#F2B705]';
      case 'parenthetical':
        return 'my-0.5 ml-[27%] mr-[25%] italic text-[#A1A1AA]';
      case 'dialogue':
        return 'mb-2 ml-[18%] mr-[18%] text-[#F4F4F5] leading-relaxed';
      case 'transition':
        return 'my-3 text-right font-bold uppercase tracking-wider text-[#A1A1AA]';
      case 'shot':
        return 'mt-3 mb-1.5 font-bold uppercase text-[#E4E4E7]';
      default:
        return 'my-1.5 text-[#D4D4D8]';
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
      className="flex-1 flex flex-col min-h-0"
    >
      {/* Hidden File Input for .fadein / .osf / .xml / .fountain */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".fadein,.osf,.xml,.fdx,.fountain,.txt"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Fade In Toolbar Strip */}
      <div className="px-5 py-2.5 bg-[#121218] border-b border-[#232329] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#F2B705]/15 hover:bg-[#F2B705]/25 border border-[#F2B705]/40 text-xs font-semibold text-[#F2B705] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import .fadein</span>
          </button>

          <button
            type="button"
            onClick={onExportFadeIn}
            title="Download as native .fadein Open Screenplay Format archive"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#1A1A22] hover:bg-[#23232E] border border-[#2C2C38] text-xs font-medium text-[#E4E4E7] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5 text-[#A1A1AA]" />
            <span>Save .fadein</span>
          </button>
        </div>

        {/* Formatted Page vs Raw Fountain/Text Mode Switch */}
        <div className="flex items-center gap-1 p-0.5 bg-[#09090D] border border-[#232329] rounded-lg">
          <button
            type="button"
            onClick={() => setEditorMode('formatted')}
            className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              editorMode === 'formatted'
                ? 'bg-[#22222C] text-[#F4F4F5]'
                : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>Fade In Page</span>
          </button>
          <button
            type="button"
            onClick={() => setEditorMode('raw')}
            className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              editorMode === 'raw'
                ? 'bg-[#22222C] text-[#F4F4F5]'
                : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
            }`}
          >
            <Edit3 className="w-3 h-3" />
            <span>Raw Text</span>
          </button>
        </div>
      </div>

      {/* Active Fade In Document Status Metadata Line */}
      <div className="px-5 py-1.5 bg-[#0A0A0E] border-b border-[#1E1E26] flex items-center justify-between text-[11px] font-mono text-[#A1A1AA]">
        <div className="flex items-center gap-1.5 truncate">
          <FileCheck className="w-3.5 h-3.5 text-[#F2B705] shrink-0" />
          <span className="truncate">
            {lastImportedFileName
              ? `${lastImportedFileName} (${sourceFormat === 'fadein-zip' ? 'Fade In OSF Archive' : 'Fade In XML'})`
              : 'Fade In Open Screenplay Format (.fadein)'}
          </span>
        </div>
        <span className="tabular-nums shrink-0">{elements.length} elements</span>
      </div>

      {/* Drag & Drop Overlay or Main Screenplay Manuscript Surface */}
      <div className="relative flex-1 flex flex-col p-4 overflow-hidden">
        {isDraggingOver && (
          <div className="absolute inset-3 z-20 rounded-xl border-2 border-dashed border-[#F2B705] bg-[#08080A]/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
            <Upload className="w-8 h-8 text-[#F2B705] mb-2" />
            <p className="font-display text-sm font-semibold text-[#F4F4F5]">
              Drop .fadein Screenplay File Here
            </p>
            <p className="text-xs text-[#A1A1AA] mt-1">
              Preserves Scene Headings, Action, Character Cues, Parentheticals, Dialogue & Transitions
            </p>
          </div>
        )}

        {editorMode === 'formatted' ? (
          <div className="flex-1 overflow-y-auto rounded-xl bg-[#101015] border border-[#232329] p-5 font-mono text-[12.5px] shadow-inner">
            {/* Quick Element Insertion Bar */}
            <div className="mb-4 pb-3 border-b border-[#1E1E26] flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="text-[#A1A1AA]">Click any screenplay line to edit or re-style:</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleInsertElementAfter(elements.length - 1, 'scene_heading')}
                  className="px-2 py-0.5 rounded bg-[#1A1A23] hover:bg-[#252532] text-[#E4E4E7] border border-[#2C2C3A] transition-colors cursor-pointer"
                >
                  + Scene
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertElementAfter(elements.length - 1, 'action')}
                  className="px-2 py-0.5 rounded bg-[#1A1A23] hover:bg-[#252532] text-[#E4E4E7] border border-[#2C2C3A] transition-colors cursor-pointer"
                >
                  + Action
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertElementAfter(elements.length - 1, 'character')}
                  className="px-2 py-0.5 rounded bg-[#1A1A23] hover:bg-[#252532] text-[#F2B705] border border-[#2C2C3A] transition-colors cursor-pointer"
                >
                  + Character
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertElementAfter(elements.length - 1, 'dialogue')}
                  className="px-2 py-0.5 rounded bg-[#1A1A23] hover:bg-[#252532] text-[#E4E4E7] border border-[#2C2C3A] transition-colors cursor-pointer"
                >
                  + Dialogue
                </button>
              </div>
            </div>

            {/* Structured Fade In Page Elements */}
            <div>
              {elements.map((el, idx) => {
                const isEditing = editingElementId === el.id;
                const isSceneActive =
                  el.type === 'scene_heading' &&
                  activeSlugline &&
                  el.text.trim().toUpperCase() === activeSlugline.trim().toUpperCase();

                return (
                  <div
                    key={el.id}
                    onClick={() => {
                      setEditingElementId(el.id);
                      if (el.type === 'scene_heading' && onSelectSlugline) {
                        onSelectSlugline(el.text);
                      }
                    }}
                    className={`group relative rounded transition-colors ${getElementFormattingClasses(
                      el.type
                    )} ${
                      isSceneActive
                        ? 'ring-1 ring-[#F2B705]'
                        : isEditing
                        ? 'bg-[#191923]/90 ring-1 ring-[#3F3F50] p-2'
                        : 'hover:bg-[#16161F]/70'
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between gap-2">
                          <select
                            value={el.type}
                            onChange={(e) =>
                              handleElementTypeChange(el.id, e.target.value as ScreenplayElementType)
                            }
                            className="bg-[#0B0B0F] border border-[#2E2E3A] rounded px-2 py-0.5 text-[11px] font-sans text-[#F2B705] focus:outline-none"
                          >
                            {Object.entries(ELEMENT_TYPE_LABELS).map(([key, label]) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            ))}
                          </select>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleInsertElementAfter(idx, 'action')}
                              title="Insert element below"
                              className="p-1 rounded bg-[#1F1F29] hover:bg-[#2C2C3A] text-zinc-300 text-[10px] font-sans flex items-center gap-0.5 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Below</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteElement(el.id)}
                              title="Delete element"
                              className="p-1 rounded bg-[#1F1F29] hover:bg-rose-950 text-rose-400 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingElementId(null)}
                              className="px-2 py-0.5 rounded bg-[#F2B705] text-[#08080A] font-sans font-semibold text-[10px] cursor-pointer"
                            >
                              Done
                            </button>
                          </div>
                        </div>

                        <textarea
                          rows={el.type === 'action' || el.type === 'dialogue' ? 2 : 1}
                          value={el.text}
                          onChange={(e) => handleElementTextChange(el.id, e.target.value)}
                          autoFocus
                          className="w-full bg-[#0B0B0F] border border-[#2E2E3A] rounded p-2 font-mono text-xs text-[#F4F4F5] focus:outline-none focus:border-[#F2B705]"
                        />
                      </div>
                    ) : (
                      <div className="flex items-baseline justify-between gap-2">
                        {el.type === 'scene_heading' && el.sceneNumber && (
                          <span className="text-[11px] text-[#71717A] mr-1.5 select-none tabular-nums">
                            {el.sceneNumber}
                          </span>
                        )}
                        <span className="flex-1">{el.text}</span>
                        {el.type === 'scene_heading' && el.sceneNumber && (
                          <span className="text-[11px] text-[#71717A] ml-1.5 select-none tabular-nums">
                            {el.sceneNumber}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <textarea
            value={rawText}
            onChange={(e) => onUpdateRawText(e.target.value)}
            placeholder="EXT. LOCATION - NIGHT&#10;&#10;Paste screenplay text or import a .fadein file..."
            className="flex-1 w-full min-h-[360px] bg-[#101015] border border-[#232329] rounded-xl p-4 font-mono text-[12.5px] leading-relaxed text-[#E4E4E7] placeholder-[#52525B] focus:outline-none focus:border-[#F2B705] resize-none"
          />
        )}
      </div>
    </div>
  );
};
