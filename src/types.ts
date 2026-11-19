export interface SceneComposition {
  environmentType: 'urban_alley' | 'interior_room' | 'rooftop_skyline' | 'overhead_desk' | 'corridor' | 'landscape_exterior' | string;
  primarySubject: 'standing_figure' | 'close_portrait' | 'leaping_action' | 'object_still_life' | 'two_characters' | 'vehicle' | string;
  timeOfDay: 'night' | 'dusk' | 'day' | 'interior_warm' | string;
  primaryColorHex: string;
  secondaryColorHex: string;
  highlightColorHex: string;
  vanishingPointX?: number; // 0-100 percentage across frame
  vanishingPointY?: number; // 0-100 percentage down frame
  subjectGridZone?: 'left_third' | 'center' | 'right_third' | 'foreground_left' | 'foreground_right';
  subjectMotionDirection?: 'none' | 'left_to_right' | 'right_to_left' | 'toward_camera' | 'away_from_camera';
  cameraMotionVector?: 'static' | 'push_in' | 'pull_out' | 'pan_left' | 'pan_right' | 'tilt_up' | 'tilt_down' | 'track_lateral';
}

export interface StoryboardPanel {
  id: string;
  panelNumber: number;
  title: string;
  sceneSlugline: string;
  shotSize: string;
  cameraAngle: string;
  cameraMovement: string;
  lensFocalLength: string;
  durationSeconds: number;
  actionNotes: string;
  dialogueSnippet: string;
  blockingNotes: string;
  visualPrompt: string;
  imageUrl?: string;
  isGeneratingImage?: boolean;
  rendererUsed?: string;
  sceneComposition?: SceneComposition;
}

export interface SampleScreenplay {
  id: string;
  title: string;
  genre: string;
  logline: string;
  draftingMode: string;
  aspectRatio: '16:9' | '2.39:1' | '4:3';
  scriptText: string;
  preloadedPanels?: StoryboardPanel[];
}

export const DRAFTING_MODES = [
  'Technical Wireframe & Camera Vectors',
  'Architectural Blocking & Mannequin Outline',
  'Monochrome Line & Perspective Grid',
  'Clean Pre-Vis Spatial Diagram',
] as const;

export const SHOT_SIZES = [
  'Extreme Wide Shot',
  'Wide Shot',
  'Medium Wide Shot',
  'Medium Shot',
  'Medium Close-Up',
  'Close-Up',
  'Extreme Close-Up',
] as const;

export const CAMERA_ANGLES = [
  'Eye Level',
  'Low Angle',
  'High Angle',
  'Dutch Angle',
  "Overhead Bird's-Eye",
  'Over-the-Shoulder',
] as const;

export const CAMERA_MOVEMENTS = [
  'Static Lock-off',
  'Slow Push In',
  'Pull Back / Zoom Out',
  'Tracking / Dolly Lateral',
  'Pan Left / Right',
  'Tilt Up / Down',
  'Crane Up / Down',
] as const;

export const LENS_FOCAL_LENGTHS = [
  '18mm Ultra-Wide',
  '24mm Wide',
  '35mm Standard Wide',
  '50mm Normal',
  '85mm Medium Telephoto',
  '135mm Telephoto',
] as const;

export const INITIAL_TECHNICAL_PANELS: StoryboardPanel[] = [
  {
    id: 'panel-1',
    panelNumber: 1,
    title: 'Alleyway Establishing & Push-In',
    sceneSlugline: 'EXT. MERCER ALLEYWAY - NIGHT',
    shotSize: 'Wide Shot',
    cameraAngle: 'Eye Level',
    cameraMovement: 'Slow Push In',
    lensFocalLength: '35mm Standard Wide',
    durationSeconds: 4.5,
    actionNotes: 'Detective COLE VANCE (40s) stands stationary at center-left grid intersection beneath the streetlamp post.',
    dialogueSnippet: 'VANCE (V.O.): "Every alibi in this city has a price tag. Tonight I found the ledger."',
    blockingNotes: '1-point corridor perspective converging at center vanishing point (50%, 48%). Subject A placed on left vertical third line; camera pushes in along Z-axis.',
    visualPrompt: 'Technical monochrome line-art storyboard frame: 1-point perspective narrow alleyway geometry, clean architectural wall planes and ground grid, basic mannequin figure outline standing on the left third intersection, inward Z-axis camera push-in corner arrows, unshaded wireframe pre-vis.',
    rendererUsed: 'Technical Vector Blueprint',
    sceneComposition: {
      environmentType: 'urban_alley',
      primarySubject: 'standing_figure',
      timeOfDay: 'night',
      primaryColorHex: '#101216',
      secondaryColorHex: '#181B20',
      highlightColorHex: '#38BDF8',
      vanishingPointX: 52,
      vanishingPointY: 46,
      subjectGridZone: 'left_third',
      subjectMotionDirection: 'none',
      cameraMotionVector: 'push_in',
    },
  },
  {
    id: 'panel-2',
    panelNumber: 2,
    title: 'Booth Four Profile Framing',
    sceneSlugline: 'INT. STARLIGHT DINER - NIGHT',
    shotSize: 'Medium Close-Up',
    cameraAngle: 'Eye Level',
    cameraMovement: 'Static Lock-off',
    lensFocalLength: '50mm Normal',
    durationSeconds: 3.5,
    actionNotes: 'ELENA ROSTOVA (30s) seated in booth at left third, head and sightline oriented left-to-right through window plane.',
    dialogueSnippet: 'ELENA: "You are twelve minutes late, Cole. They already cleared the safe."',
    blockingNotes: 'Static 50mm lock-off. Subject framed chest-up on left third vertical axis; sightline vector points right toward window mullion grid.',
    visualPrompt: 'Technical line-art storyboard diagram: Medium close-up mannequin head-and-shoulders outline seated on left third, window frame perspective lines on right two-thirds, sightline arrow pointing right, static camera lock-off crosshairs.',
    rendererUsed: 'Technical Vector Blueprint',
    sceneComposition: {
      environmentType: 'interior_room',
      primarySubject: 'close_portrait',
      timeOfDay: 'interior_warm',
      primaryColorHex: '#101216',
      secondaryColorHex: '#181B20',
      highlightColorHex: '#38BDF8',
      vanishingPointX: 72,
      vanishingPointY: 50,
      subjectGridZone: 'left_third',
      subjectMotionDirection: 'left_to_right',
      cameraMotionVector: 'static',
    },
  },
  {
    id: 'panel-3',
    panelNumber: 3,
    title: 'Overhead Tabletop Plan View',
    sceneSlugline: 'INT. VANCE OFFICE - LATER',
    shotSize: 'Medium Shot',
    cameraAngle: "Overhead Bird's-Eye",
    cameraMovement: 'Crane Up',
    lensFocalLength: '24mm Wide',
    durationSeconds: 4.0,
    actionNotes: 'Orthographic top-down view of rectangular desk surface. Compass centered at crosshair; photo rectangles arranged radially.',
    dialogueSnippet: 'No dialogue — ambient audio only',
    blockingNotes: '90-degree nadir overhead angle. Camera cranes vertically up along Y/Z axis (pull-out bounding box). Rectangular props aligned to rule-of-thirds intersections.',
    visualPrompt: 'Technical top-down orthographic storyboard layout: rectangular desk boundary, geometric rectangles for photographs and central circle for compass, radial connecting lines, outward camera pull-back arrows at frame corners.',
    rendererUsed: 'Technical Vector Blueprint',
    sceneComposition: {
      environmentType: 'overhead_desk',
      primarySubject: 'object_still_life',
      timeOfDay: 'interior_warm',
      primaryColorHex: '#101216',
      secondaryColorHex: '#181B20',
      highlightColorHex: '#38BDF8',
      vanishingPointX: 50,
      vanishingPointY: 50,
      subjectGridZone: 'center',
      subjectMotionDirection: 'none',
      cameraMotionVector: 'pull_out',
    },
  },
  {
    id: 'panel-4',
    panelNumber: 4,
    title: 'Rooftop Gap Lateral Pan',
    sceneSlugline: 'EXT. EXCHANGE ROOFTOP - DUSK',
    shotSize: 'Wide Shot',
    cameraAngle: 'Low Angle',
    cameraMovement: 'Pan Left / Right',
    lensFocalLength: '24mm Wide',
    durationSeconds: 3.0,
    actionNotes: 'Subject A (Courier) traverses left-to-right across elevated duct plane. Subject B (Vance) enters lower-left foreground third.',
    dialogueSnippet: 'VANCE: "Hold it! Drop the cylinder!"',
    blockingNotes: 'Low horizon line (72% down frame) to establish low camera elevation. Subject A motion arrow tracks left-to-right; camera pans right in sync.',
    visualPrompt: 'Technical storyboard blocking diagram: low horizon line with basic boxy HVAC geometric volumes, two anatomical mannequin outlines in motion from left to right, bold directional action arrow for character trajectory and horizontal camera pan arrow.',
    rendererUsed: 'Technical Vector Blueprint',
    sceneComposition: {
      environmentType: 'rooftop_skyline',
      primarySubject: 'leaping_action',
      timeOfDay: 'dusk',
      primaryColorHex: '#101216',
      secondaryColorHex: '#181B20',
      highlightColorHex: '#38BDF8',
      vanishingPointX: 60,
      vanishingPointY: 72,
      subjectGridZone: 'center',
      subjectMotionDirection: 'left_to_right',
      cameraMotionVector: 'pan_right',
    },
  },
];

export const SAMPLE_SCREENPLAYS: SampleScreenplay[] = [
  {
    id: 'mercer-ledger',
    title: 'The Mercer Ledger',
    genre: 'Investigative Thriller',
    logline: 'Four foundational camera setups demonstrating corridor push-in, profile lock-off, overhead plan view, and low-angle lateral pan.',
    draftingMode: 'Technical Wireframe & Camera Vectors',
    aspectRatio: '16:9',
    preloadedPanels: INITIAL_TECHNICAL_PANELS,
    scriptText: `EXT. MERCER ALLEYWAY - NIGHT

Sheets of cold rain hammer the narrow brick corridor behind the old customs house. A single streetlamp stands overhead.

Detective COLE VANCE (40s) stands stationary in the corridor.

VANCE (V.O.)
Every alibi in this city has a price tag. Tonight I found the ledger.

INT. STARLIGHT DINER - NIGHT

ELENA ROSTOVA (30s) sits alone in Booth Four, fingers wrapped around a ceramic mug. She looks right through the plate glass window as a vehicle passes on the avenue.

ELENA
You are twelve minutes late, Cole. They already cleared the safe.

INT. VANCE OFFICE - LATER

Overhead view of a scarred oak desk: archival portraits are linked by taut thread around a brass compass and an open harbor logbook.

EXT. EXCHANGE ROOFTOP - DUSK

A COURIER sprints along the ductwork and leaps across a ten-foot gap between rooftops. Vance scrambles onto the lower turbine housing behind him.

VANCE
Hold it! Drop the cylinder!`,
  },
  {
    id: 'solaris-drift',
    title: 'Perigee at Outpost Nine',
    genre: 'Spatial Blocking Study',
    logline: 'Zero-gravity axial tracking and spherical chamber blocking across three interior/exterior station setups.',
    draftingMode: 'Architectural Blocking & Mannequin Outline',
    aspectRatio: '2.39:1',
    scriptText: `EXT. ORBITAL SALVAGE RING - NIGHT

The tether-skiff approaches the rectangular docking bay of Outpost Nine along a central docking axis.

COMMANDER MARA CHEN (30s) holds position in the open airlock frame.

CHEN (OVER COMMS)
Magnetic clamps engaged. I'm reading auxiliary power on Deck C.

INT. HYDROPONIC CORRIDOR - CONTINUOUS

Cylindrical glass columns line both sides of the narrow bulkhead.

Chen pulls herself forward along the central guide cable toward the camera.

INT. COMMUNICATIONS CORE - MOMENTS LATER

At the center of the chamber, a reel-to-reel tape console sits on a pedestal.

Chen steps into the left foreground and reaches her right hand toward the toggle switch.

CHEN
Somebody rewound this less than an hour ago.`,
  },
  {
    id: 'glass-conservatory',
    title: 'Winter at the Glass Conservatory',
    genre: 'Multi-Elevation Study',
    logline: 'Wide exterior establishing geometry, extreme close-up insert framing, and high-angle balcony look-down.',
    draftingMode: 'Monochrome Line & Perspective Grid',
    aspectRatio: '16:9',
    scriptText: `EXT. VANDERBILT GLASS CONSERVATORY - DAY

A wide domed iron-and-glass structure sits on a coastal bluff. Rows of chairs are aligned along the central aisle inside.

INT. RESTORATION VAULT - DAY

JULIAN MERCER (50s) stands at a tall easel holding a portrait canvas. He positions an inspection lamp six inches from the lower-right quadrant of the frame.

EXTREME CLOSE-UP on the canvas: geometric floorplan lines and a numbered key outline appear on the surface.

JULIAN
(whispering)
He didn't burn the codicil. He painted over it.

INT. GRAND ROTUNDA BALCONY - MOMENTS LATER

High angle looking down from the upper catwalk. Below, twelve figures stand in a semicircle around the central auction podium as the AUCTIONEER raises his gavel.`,
  },
];
