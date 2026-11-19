import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGenAIClient() {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // 1. Parse Screenplay into Fundamental Technical Storyboard Panels
  app.post('/api/storyboard/parse', async (req, res) => {
    try {
      const { scriptText, scriptElements, draftingMode, targetPanelCount } = req.body;
      if (!scriptText || typeof scriptText !== 'string' || !scriptText.trim()) {
        return res.status(400).json({
          error: 'Please provide screenplay text or a .fadein file to break down into storyboard panels.',
        });
      }

      const ai = getGenAIClient();
      const countDirective = targetPanelCount
        ? `Create approximately ${targetPanelCount} sequential storyboard panels.`
        : 'Create between 4 and 8 sequential storyboard panels covering the fundamental spatial and camera beats.';

      const structuredContext =
        Array.isArray(scriptElements) && scriptElements.length > 0
          ? `\n\nStructured Fade In Open Screenplay Format Elements (JSON):\n${JSON.stringify(
              scriptElements.map((e: any) => ({
                type: e.type,
                sceneNumber: e.sceneNumber,
                text: e.text,
              })),
              null,
              2
            )}`
          : '';

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Break down the following Fade In screenplay into sequential technical storyboard panels focusing strictly on fundamental storyboard mechanics: basic character mannequin outlines, spatial room/environment geometry, camera movement vectors, and rule-of-thirds composition.\n\nDrafting Mode: ${draftingMode || 'Technical Wireframe & Camera Vectors'}\n${countDirective}\n\nFormatted Screenplay Text:\n${scriptText}${structuredContext}`,
        config: {
          systemInstruction: `You are a technical film storyboard draftsman and layout supervisor working with Fade In (.fadein / Open Screenplay Format) scripts.
Do NOT perform artistic, atmospheric, or stylistic interpretation of the screenplay (avoid mood lighting adjectives, painterly shading, color palettes, or decorative illustration).
Focus strictly on fundamental storyboard mechanics:
1. Basic character outlines (anatomical mannequins, head/shoulder orientation, sightline vectors, foreground/midground/background depth placement).
2. Space outlines (horizon line height, 1-point/2-point/orthographic perspective grid, vanishing point position, architectural walls, doorways, ground planes, and basic geometric prop volumes).
3. Camera movement (Static Lock-off, Slow Push In, Pull Back / Zoom Out, Tracking / Dolly Lateral, Pan Left / Right, Tilt Up / Down, Crane Up / Down).
4. Composition mechanics (shot size, camera elevation angle, focal length, and rule-of-thirds grid placement).

For each panel:
- Assign a sequential panelNumber starting at 1.
- Preserve the exact sceneSlugline from the Fade In Scene Heading.
- Choose a shotSize ("Extreme Wide Shot", "Wide Shot", "Medium Wide Shot", "Medium Shot", "Medium Close-Up", "Close-Up", "Extreme Close-Up").
- Choose a cameraAngle ("Eye Level", "Low Angle", "High Angle", "Dutch Angle", "Overhead Bird's-Eye", "Over-the-Shoulder").
- Choose a cameraMovement ("Static Lock-off", "Slow Push In", "Pull Back / Zoom Out", "Tracking / Dolly Lateral", "Pan Left / Right", "Tilt Up / Down", "Crane Up / Down").
- Choose a lensFocalLength ("18mm Ultra-Wide", "24mm Wide", "35mm Standard Wide", "50mm Normal", "85mm Medium Telephoto", "135mm Telephoto").
- Write concise actionNotes preserving the literal physical movement in the frame.
- Include dialogueSnippet preserving exact Character Cue, Parenthetical, and Dialogue lines (or "No dialogue — ambient audio only").
- Write blockingNotes specifying horizon height, vanishing point convergence, rule-of-thirds subject placement, and camera movement vector direction.
- Write a strictly technical visualPrompt describing an unshaded monochrome wireframe/line-art storyboard diagram with perspective grid lines, basic mannequin character outlines, and directional arrows for character and camera movement.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                panelNumber: { type: Type.INTEGER },
                title: { type: Type.STRING, description: 'Technical shot title (e.g. "Corridor 1-Pt Push-In")' },
                sceneSlugline: { type: Type.STRING },
                shotSize: { type: Type.STRING },
                cameraAngle: { type: Type.STRING },
                cameraMovement: { type: Type.STRING },
                lensFocalLength: { type: Type.STRING },
                durationSeconds: { type: Type.NUMBER },
                actionNotes: { type: Type.STRING },
                dialogueSnippet: { type: Type.STRING },
                blockingNotes: {
                  type: Type.STRING,
                  description: 'Spatial geometry, horizon line, rule-of-thirds placement, and camera vector note',
                },
                visualPrompt: {
                  type: Type.STRING,
                  description: 'Technical line-art schematic description (basic mannequin outlines, spatial perspective grid, motion arrows, no artistic styling)',
                },
                sceneComposition: {
                  type: Type.OBJECT,
                  properties: {
                    environmentType: {
                      type: Type.STRING,
                      description: 'One of: "urban_alley", "interior_room", "rooftop_skyline", "overhead_desk", "corridor", "landscape_exterior"',
                    },
                    primarySubject: {
                      type: Type.STRING,
                      description: 'One of: "standing_figure", "close_portrait", "leaping_action", "object_still_life", "two_characters", "vehicle"',
                    },
                    timeOfDay: { type: Type.STRING },
                    primaryColorHex: { type: Type.STRING },
                    secondaryColorHex: { type: Type.STRING },
                    highlightColorHex: { type: Type.STRING },
                    vanishingPointX: { type: Type.NUMBER, description: '0-100 horizontal vanishing point percentage' },
                    vanishingPointY: { type: Type.NUMBER, description: '0-100 vertical horizon line percentage' },
                    subjectGridZone: {
                      type: Type.STRING,
                      description: 'One of: "left_third", "center", "right_third", "foreground_left", "foreground_right"',
                    },
                    subjectMotionDirection: {
                      type: Type.STRING,
                      description: 'One of: "none", "left_to_right", "right_to_left", "toward_camera", "away_from_camera"',
                    },
                    cameraMotionVector: {
                      type: Type.STRING,
                      description: 'One of: "static", "push_in", "pull_out", "pan_left", "pan_right", "tilt_up", "tilt_down", "track_lateral"',
                    },
                  },
                  required: [
                    'environmentType',
                    'primarySubject',
                    'timeOfDay',
                    'primaryColorHex',
                    'secondaryColorHex',
                    'highlightColorHex',
                    'vanishingPointX',
                    'vanishingPointY',
                    'subjectGridZone',
                    'subjectMotionDirection',
                    'cameraMotionVector',
                  ],
                },
              },
              required: [
                'panelNumber',
                'title',
                'sceneSlugline',
                'shotSize',
                'cameraAngle',
                'cameraMovement',
                'lensFocalLength',
                'durationSeconds',
                'actionNotes',
                'dialogueSnippet',
                'blockingNotes',
                'visualPrompt',
                'sceneComposition',
              ],
            },
          },
        },
      });

      const rawText = (response.text ?? '[]').trim();
      const panels = JSON.parse(rawText);
      return res.json({ panels });
    } catch (error: any) {
      console.error('Error parsing screenplay:', error);
      const status = error?.status || 500;
      return res.status(status).json({
        error: error?.message || 'Failed to parse screenplay with Gemini API.',
      });
    }
  });

  // 2. Generate Technical Storyboard Panel Diagram (strictly basic character/space outlines, composition grids, and camera movement vectors)
  app.post('/api/storyboard/generate-image', async (req, res) => {
    try {
      const {
        visualPrompt,
        draftingMode,
        aspectRatio = '16:9',
        shotSize,
        cameraAngle,
        cameraMovement,
        lensFocalLength,
        title,
        sceneSlugline,
        blockingNotes,
      } = req.body;
      if (!visualPrompt) {
        return res.status(400).json({ error: 'Visual prompt is required.' });
      }

      const ai = getGenAIClient();
      const technicalPrompt = `Technical pre-visualization storyboard diagram (${draftingMode || 'Technical Wireframe & Camera Vectors'}). Unshaded monochrome line-art only. Show basic geometric space outlines (horizon line, perspective grid, simple architectural walls and prop boxes), neutral anatomical mannequin figure outlines with head crosshairs, rule-of-thirds composition ticks, and clear directional arrows for camera movement (${cameraMovement || 'Static Lock-off'}). Shot parameters: ${shotSize || 'Medium Shot'}, ${cameraAngle || 'Eye Level'}, ${lensFocalLength || '35mm'}. Blocking: ${blockingNotes || ''}. ${visualPrompt}. Strictly avoid artistic shading, painterly effects, dramatic lighting, or stylistic interpretation.`;

      // First attempt: Try Gemini Image Generation model if available on user's tier with strict technical line-art prompt
      try {
        const imageResponse = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-image',
          contents: {
            parts: [{ text: technicalPrompt }],
          },
          config: {
            imageConfig: {
              aspectRatio: aspectRatio === '2.39:1' ? '16:9' : aspectRatio,
            },
          },
        });

        for (const part of imageResponse.candidates?.[0]?.content?.parts ?? []) {
          if (part.inlineData?.data) {
            const mime = part.inlineData.mimeType ?? 'image/png';
            const imageUrl = `data:${mime};base64,${part.inlineData.data}`;
            return res.json({
              imageUrl,
              renderer: 'gemini-3.1-flash-lite-image',
            });
          }
        }
      } catch (imgErr: any) {
        console.warn('Using Gemini Technical SVG Storyboard Draftsman:', imgErr?.message);
      }

      // Primary Technical Vector Draftsman (gemini-4-hydrogen): Synthesizes precise SVG storyboard schematic
      const svgResponse = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Draft a precise, unshaded technical SVG storyboard schematic (viewBox="0 0 800 450") for this camera setup:
Shot Title: ${title || 'Storyboard Frame'}
Scene: ${sceneSlugline || 'INT./EXT. SCENE'}
Framing: ${shotSize || 'Medium Shot'}, ${cameraAngle || 'Eye Level'}, ${lensFocalLength || '35mm'}
Camera Movement: ${cameraMovement || 'Static Lock-off'}
Spatial & Blocking Notes: ${blockingNotes || ''}
Technical Description: ${visualPrompt}`,
        config: {
          systemInstruction: `You are a technical film storyboard layout engine. Return ONLY a valid, self-contained <svg> element with viewBox="0 0 800 450" and xmlns="http://www.w3.org/2000/svg".
STRICT RULES — NO ARTISTIC OR STYLISTIC INTERPRETATION:
1. Use a clean dark drafting slate background (<rect width="800" height="450" fill="#101216"/>). Do NOT use atmospheric gradients, glowing lights, rain effects, or color painting.
2. Draw fundamental space outlines in crisp grey wireframe lines (stroke="#64748B" and "#475569", fill="none"): horizon line (adjusted for ${cameraAngle}), vanishing point rays, floor perspective grid, and simple geometric room walls, doorways, furniture, or environmental boxes.
3. Draw basic character mannequin outlines in high-contrast white/light-grey line-art (stroke="#F4F4F5", fill="#181C24", stroke-width="2"): simple anatomical head ovals with facial crosshairs (eye-line and center-line), torso trapezoids, joint circles, and limb outlines scaled accurately to ${shotSize}.
4. Include composition overlays: dashed rule-of-thirds grid lines (x=266, 533; y=150, 300) and center viewfinder crosshair.
5. Draw explicit vector arrows:
   - Cyan arrows (stroke="#38BDF8", fill="#38BDF8") indicating camera movement (${cameraMovement}): e.g. 4 inward corner arrows + inner frame box for Push In, outward arrows for Pull Out, or bold horizontal/vertical vector arrows for Pan/Tilt/Tracking.
   - Amber arrows (stroke="#F2B705", fill="#F2B705") indicating character movement trajectory or sightline direction.
6. Do NOT wrap in markdown code fences. Return raw <svg ...>...</svg> markup only.`,
        },
      });

      let svgContent = (svgResponse.text ?? '').trim();
      const svgMatch = svgContent.match(/<svg[\s\S]*<\/svg>/i);
      if (svgMatch) {
        svgContent = svgMatch[0];
        const base64Svg = Buffer.from(svgContent, 'utf-8').toString('base64');
        return res.json({
          imageUrl: `data:image/svg+xml;base64,${base64Svg}`,
          renderer: 'gemini-4-hydrogen-svg',
        });
      }

      return res.status(500).json({
        error: 'Could not generate technical panel diagram from model output.',
      });
    } catch (error: any) {
      console.error('Error generating panel visual:', error);
      const status = error?.status || 500;
      return res.status(status).json({
        error: error?.message || 'Failed to generate technical storyboard panel.',
      });
    }
  });

  // 3. Technical Blocking & Composition Adjuster
  app.post('/api/storyboard/enhance-shot', async (req, res) => {
    try {
      const { panel, directorInstruction, draftingMode } = req.body;
      if (!panel) {
        return res.status(400).json({ error: 'Panel data is required.' });
      }

      const ai = getGenAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Update the fundamental storyboard mechanics (spatial blocking, camera movement, and composition geometry) for this shot based on the layout instruction. Avoid any artistic or stylistic prose.
Current Shot:
Title: ${panel.title}
Slugline: ${panel.sceneSlugline}
Shot Size: ${panel.shotSize}
Angle: ${panel.cameraAngle}
Movement: ${panel.cameraMovement}
Lens: ${panel.lensFocalLength}
Action: ${panel.actionNotes}
Blocking Notes: ${panel.blockingNotes}
Technical Prompt: ${panel.visualPrompt}
Drafting Mode: ${draftingMode || 'Technical Wireframe & Camera Vectors'}
Blocking & Camera Instruction: ${directorInstruction || 'Clarify the 1-point perspective geometry, place primary mannequin on the rule-of-thirds intersection, and specify explicit camera movement vectors.'}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              shotSize: { type: Type.STRING },
              cameraAngle: { type: Type.STRING },
              cameraMovement: { type: Type.STRING },
              lensFocalLength: { type: Type.STRING },
              actionNotes: { type: Type.STRING },
              blockingNotes: { type: Type.STRING },
              visualPrompt: { type: Type.STRING },
            },
            required: [
              'title',
              'shotSize',
              'cameraAngle',
              'cameraMovement',
              'lensFocalLength',
              'actionNotes',
              'blockingNotes',
              'visualPrompt',
            ],
          },
        },
      });

      const updated = JSON.parse((response.text ?? '{}').trim());
      return res.json({ updated });
    } catch (error: any) {
      console.error('Error updating shot mechanics:', error);
      return res.status(error?.status || 500).json({
        error: error?.message || 'Failed to update shot mechanics.',
      });
    }
  });

  const distPath = path.join(__dirname, 'dist');
  const useStaticBuild =
    process.env.NODE_ENV === 'production' ||
    process.env.DISABLE_HMR === 'true' ||
    fs.existsSync(path.join(distPath, 'index.html'));

  if (!useStaticBuild) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use('/src/assets', express.static(path.join(__dirname, 'src/assets')));
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CineBoard Studio server running on http://localhost:${PORT}`);
  });
}

startServer();
