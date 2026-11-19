import React from 'react';
import { StoryboardPanel } from '../types';

interface CinematicFallbackPlateProps {
  panel: StoryboardPanel;
  className?: string;
  showGuides?: boolean;
}

/**
 * Renders a fundamental technical storyboard schematic focusing strictly on:
 * 1. Spatial geometry (horizon line, 1-point/2-point/orthographic perspective grid, architectural room/wall planes)
 * 2. Basic neutral character mannequin outlines scaled and placed by Shot Size, Camera Angle, and Rule-of-Thirds zone
 * 3. Explicit Camera Movement vectors (Push-in/Pull-out corner frame arrows, Pan/Tilt/Track directional arrows)
 * 4. Composition overlays (Rule-of-thirds grid, 90% action safe frame, center reticle, vanishing point marker)
 */
export const CinematicFallbackPlate: React.FC<CinematicFallbackPlateProps> = ({
  panel,
  className = '',
  showGuides = true,
}) => {
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
  const isWide = shotLower.includes('wide');

  // Determine Vanishing Point & Horizon Line Y coordinate (in 800x450 viewBox)
  const vpX = ((comp.vanishingPointX ?? 50) / 100) * 800;
  const defaultHorizonY = isOverhead ? 225 : isLowAngle ? 335 : isHighAngle ? 120 : 220;
  const vpY = comp.vanishingPointY ? (comp.vanishingPointY / 100) * 450 : defaultHorizonY;

  // Determine Subject Horizontal Placement on Rule-of-Thirds
  const subjectX =
    comp.subjectGridZone === 'left_third' || comp.subjectGridZone === 'foreground_left'
      ? 266
      : comp.subjectGridZone === 'right_third' || comp.subjectGridZone === 'foreground_right'
      ? 533
      : 400;

  // Determine Camera Movement Vector type from either sceneComposition or panel.cameraMovement
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

  return (
    <div className={`relative w-full h-full overflow-hidden bg-[#101216] select-none ${className}`}>
      <svg
        viewBox="0 0 800 450"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full object-cover"
        aria-label={`Technical Storyboard Schematic: ${panel.title}`}
      >
        <defs>
          {/* Arrowhead for Camera Movement (Cyan #38BDF8) */}
          <marker
            id={`cam-arrow-${panel.id}`}
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#38BDF8" />
          </marker>

          {/* Arrowhead for Character Blocking / Sightline (Amber #F2B705) */}
          <marker
            id={`act-arrow-${panel.id}`}
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#F2B705" />
          </marker>
        </defs>

        {/* Neutral Drafting Paper Canvas */}
        <rect width="800" height="450" fill="#101216" />

        {/* Optional Dutch Angle Tilt Group */}
        <g transform={isDutch ? 'rotate(-7 400 225)' : undefined}>
          {/* 1. SPATIAL ENVIRONMENT & PERSPECTIVE GEOMETRY */}
          {isOverhead ? (
            /* Orthographic Overhead Plan Grid & Bounding Room/Desk Planes */
            <g stroke="#3F4451" strokeWidth="1" fill="none">
              {/* Orthogonal Floor Grid */}
              {[100, 200, 300, 400, 500, 600, 700].map((x) => (
                <line key={`ov-x-${x}`} x1={x} y1="0" x2={x} y2="450" strokeOpacity="0.45" />
              ))}
              {[75, 150, 225, 300, 375].map((y) => (
                <line key={`ov-y-${y}`} x1="0" y1={y} x2="800" y2={y} strokeOpacity="0.45" />
              ))}
              {/* Primary Surface / Table Plan Outline */}
              <rect
                x="160"
                y="85"
                width="480"
                height="280"
                fill="#161920"
                stroke="#94A3B8"
                strokeWidth="2"
              />
              {/* Spatial Prop Outlines on Surface */}
              <rect x="210" y="130" width="95" height="70" stroke="#CBD5E1" strokeWidth="1.5" />
              <rect x="490" y="125" width="90" height="75" stroke="#CBD5E1" strokeWidth="1.5" />
              <rect x="230" y="255" width="110" height="70" stroke="#CBD5E1" strokeWidth="1.5" />
              <circle cx="400" cy="225" r="46" stroke="#E2E8F0" strokeWidth="2" />
              <line x1="257" y1="165" x2="354" y2="225" stroke="#94A3B8" strokeDasharray="4 4" />
              <line x1="340" y1="290" x2="365" y2="255" stroke="#94A3B8" strokeDasharray="4 4" />
              <line x1="446" y1="225" x2="490" y2="162" stroke="#94A3B8" strokeDasharray="4 4" />
            </g>
          ) : (
            /* 1-Point / 2-Point Linear Perspective Space Outlines */
            <g>
              {/* Ground Plane Fill below Horizon */}
              <rect x="0" y={vpY} width="800" height={450 - vpY} fill="#14171D" />

              {/* Horizon Line (HL) */}
              <line
                x1="0"
                y1={vpY}
                x2="800"
                y2={vpY}
                stroke="#64748B"
                strokeWidth="1.5"
              />
              <text
                x="14"
                y={vpY - 6}
                fill="#64748B"
                fontSize="10"
                fontFamily="monospace"
              >
                HL ({panel.cameraAngle.toUpperCase()})
              </text>

              {/* Radial Perspective Rays from Vanishing Point (VP) */}
              <g stroke="#333946" strokeWidth="1">
                <line x1={vpX} y1={vpY} x2="0" y2="0" />
                <line x1={vpX} y1={vpY} x2="266" y2="0" />
                <line x1={vpX} y1={vpY} x2="533" y2="0" />
                <line x1={vpX} y1={vpY} x2="800" y2="0" />
                <line x1={vpX} y1={vpY} x2="0" y2="450" />
                <line x1={vpX} y1={vpY} x2="180" y2="450" />
                <line x1={vpX} y1={vpY} x2="380" y2="450" />
                <line x1={vpX} y1={vpY} x2="600" y2="450" />
                <line x1={vpX} y1={vpY} x2="800" y2="450" />
                <line x1={vpX} y1={vpY} x2="0" y2={vpY + 110} />
                <line x1={vpX} y1={vpY} x2="800" y2={vpY + 110} />
              </g>

              {/* Transverse Depth Ground Grid Lines */}
              <g stroke="#2C323E" strokeWidth="1">
                <line x1="0" y1={vpY + 25} x2="800" y2={vpY + 25} />
                <line x1="0" y1={vpY + 60} x2="800" y2={vpY + 60} />
                <line x1="0" y1={vpY + 110} x2="800" y2={vpY + 110} />
                <line x1="0" y1={vpY + 175} x2="800" y2={vpY + 175} />
              </g>

              {/* Architectural Room / Corridor Bounding Planes */}
              <g stroke="#64748B" strokeWidth="1.5" fill="none">
                {/* Back Focal Wall / Depth Plane */}
                <rect
                  x={vpX - 130}
                  y={vpY - 85}
                  width="260"
                  height="155"
                  strokeOpacity="0.65"
                  fill="#12151B"
                  fillOpacity="0.5"
                />
                {/* Left & Right Architectural Verticals (Walls, Doorways, Columns) */}
                <line x1="115" y1="22" x2="115" y2="412" strokeOpacity="0.55" />
                <line x1="685" y1="22" x2="685" y2="412" strokeOpacity="0.55" />
                <line x1="115" y1="22" x2={vpX - 130} y2={vpY - 85} strokeOpacity="0.55" />
                <line x1="685" y1="22" x2={vpX + 130} y2={vpY - 85} strokeOpacity="0.55" />
                <line x1="115" y1="412" x2={vpX - 130} y2={vpY + 70} strokeOpacity="0.55" />
                <line x1="685" y1="412" x2={vpX + 130} y2={vpY + 70} strokeOpacity="0.55" />
              </g>

              {/* Vanishing Point Marker */}
              <circle cx={vpX} cy={vpY} r="3.5" fill="#F2B705" />
              <text
                x={vpX + 7}
                y={vpY - 6}
                fill="#F2B705"
                fontSize="9"
                fontFamily="monospace"
              >
                VP
              </text>
            </g>
          )}

          {/* 2. BASIC CHARACTER MANNEQUIN & BLOCKING OUTLINES (SCALED BY SHOT SIZE) */}
          {!isOverhead && (
            <g>
              {/* Over-the-Shoulder Foreground Anchor Silhouette if OTS */}
              {isOTS && (
                <g stroke="#94A3B8" strokeWidth="2" fill="#181C23">
                  <path d="M -20,450 C 10,310 70,275 155,275 C 225,275 265,330 280,450 Z" />
                  <ellipse cx="145" cy="175" rx="68" ry="86" />
                </g>
              )}

              {isExtremeCloseUp ? (
                /* Extreme Close-Up: Facial Feature Cross-Planes & Focal Detail Box */
                <g transform={`translate(${subjectX}, 225)`} stroke="#F4F4F5" strokeWidth="2.5" fill="#181C24">
                  <ellipse cx="0" cy="0" rx="195" ry="230" />
                  {/* Anatomical Head Construction Crosshairs */}
                  <line x1="-195" y1="-15" x2="195" y2="-15" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="6 4" />
                  <line x1="0" y1="-230" x2="0" y2="230" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="6 4" />
                  {/* Simplified Eye / Brow Contours */}
                  <rect x="-110" y="-42" width="75" height="28" rx="4" stroke="#E2E8F0" strokeWidth="2" fill="none" />
                  <rect x="35" y="-42" width="75" height="28" rx="4" stroke="#E2E8F0" strokeWidth="2" fill="none" />
                  <circle cx="-72" cy="-28" r="7" fill="#F4F4F5" />
                  <circle cx="72" cy="-28" r="7" fill="#F4F4F5" />
                </g>
              ) : isCloseUp ? (
                /* Close-Up / Medium Close-Up: Head, Neck, and Upper Torso Mannequin */
                <g transform={`translate(${subjectX}, 240)`} stroke="#F4F4F5" strokeWidth="2.2" fill="#181C24">
                  {/* Shoulders & Chest Block */}
                  <path d="M -145,210 C -135,95 -80,62 0,62 C 80,62 135,95 145,210 Z" />
                  {/* Neck Cylinder */}
                  <rect x="-24" y="20" width="48" height="48" />
                  {/* Mannequin Head Egg with Centerline & Brow Line */}
                  <ellipse cx="0" cy="-45" rx="64" ry="82" />
                  <path d="M -64,-45 Q 0,-35 64,-45" fill="none" stroke="#94A3B8" strokeWidth="1.5" />
                  <path d="M 0,-127 Q 14,-45 0,37" fill="none" stroke="#94A3B8" strokeWidth="1.5" />
                  {/* Sightline Vector Arrow */}
                  <line
                    x1="15"
                    y1="-45"
                    x2={comp.subjectMotionDirection === 'right_to_left' ? -155 : 155}
                    y2="-45"
                    stroke="#F2B705"
                    strokeWidth="2"
                    strokeDasharray="5 4"
                    markerEnd={`url(#act-arrow-${panel.id})`}
                  />
                </g>
              ) : isMedium ? (
                /* Medium Shot: Waist-Up Anatomical Mannequin */
                <g transform={`translate(${subjectX}, 220)`} stroke="#F4F4F5" strokeWidth="2.2" fill="#181C24">
                  {/* Torso Trapezoid */}
                  <polygon points="-68,-10 68,-10 52,145 -52,145" />
                  {/* Pelvis / Waist Block */}
                  <polygon points="-52,145 52,145 60,220 -60,220" />
                  {/* Center Sternum Line */}
                  <line x1="0" y1="-10" x2="0" y2="220" stroke="#64748B" strokeWidth="1.2" />
                  {/* Shoulder Ball Joints & Articulated Arms */}
                  <circle cx="-74" cy="4" r="12" />
                  <circle cx="74" cy="4" r="12" />
                  <path d="M -78,16 L -98,110 L -65,175" fill="none" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M 78,16 L 105,95 L 55,140" fill="none" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
                  {/* Head & Neck */}
                  <rect x="-14" y="-32" width="28" height="24" />
                  <ellipse cx="0" cy="-72" rx="36" ry="46" />
                  <line x1="-36" y1="-72" x2="36" y2="-72" stroke="#94A3B8" strokeWidth="1.2" />
                  <line x1="0" y1="-118" x2="0" y2="-26" stroke="#94A3B8" strokeWidth="1.2" />
                </g>
              ) : (
                /* Wide / Extreme Wide Shot: Full-Body Standing or Moving Mannequin Figure + Ground Footprint */
                <g transform={`translate(${subjectX}, ${Math.min(vpY + 125, 360)})`}>
                  {/* Ground Contact Ellipse (Spatial Anchor) */}
                  <ellipse
                    cx="0"
                    cy="38"
                    rx="52"
                    ry="14"
                    fill="#1E2430"
                    stroke="#38BDF8"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                  {/* Full Mannequin Outline */}
                  <g stroke="#F4F4F5" strokeWidth="2" fill="#181C24">
                    {/* Legs */}
                    <line x1="-18" y1="-42" x2="-24" y2="35" strokeWidth="12" strokeLinecap="round" />
                    <line x1="18" y1="-42" x2="26" y2="35" strokeWidth="12" strokeLinecap="round" />
                    {/* Pelvis & Torso */}
                    <polygon points="-26,-68 26,-68 22,-40 -22,-40" />
                    <polygon points="-34,-145 34,-145 26,-68 -26,-68" />
                    {/* Arms */}
                    <path d="M -36,-140 L -52,-85 L -38,-45" fill="none" strokeWidth="9" strokeLinecap="round" />
                    <path d="M 36,-140 L 52,-85 L 42,-45" fill="none" strokeWidth="9" strokeLinecap="round" />
                    {/* Head */}
                    <ellipse cx="0" cy="-174" rx="18" ry="23" />
                    {/* Mannequin Centerline */}
                    <line x1="0" y1="-197" x2="0" y2="-40" stroke="#94A3B8" strokeWidth="1" />
                  </g>

                  {/* Subject Label Tag */}
                  <text
                    x="0"
                    y="56"
                    textAnchor="middle"
                    fill="#F2B705"
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    SUBJ A
                  </text>

                  {/* Subject Blocking Motion Arrow if moving */}
                  {comp.subjectMotionDirection && comp.subjectMotionDirection !== 'none' && (
                    <g>
                      <line
                        x1="45"
                        y1="-95"
                        x2={comp.subjectMotionDirection === 'right_to_left' ? -150 : 165}
                        y2="-95"
                        stroke="#F2B705"
                        strokeWidth="3"
                        markerEnd={`url(#act-arrow-${panel.id})`}
                      />
                      <text
                        x={comp.subjectMotionDirection === 'right_to_left' ? -95 : 105}
                        y="-104"
                        textAnchor="middle"
                        fill="#F2B705"
                        fontSize="9"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        ACTION PATH
                      </text>
                    </g>
                  )}
                </g>
              )}
            </g>
          )}
        </g>

        {/* 3. COMPOSITION GUIDES (RULE OF THIRDS, ACTION SAFE, CENTER RETICLE) */}
        {showGuides && (
          <g pointerEvents="none">
            {/* 90% Action Safe Area Frame */}
            <rect
              x="40"
              y="22.5"
              width="720"
              height="405"
              fill="none"
              stroke="#64748B"
              strokeOpacity="0.35"
              strokeWidth="1"
            />

            {/* Rule of Thirds Grid */}
            <g stroke="#94A3B8" strokeOpacity="0.28" strokeWidth="1" strokeDasharray="5 5">
              <line x1="266.6" y1="22.5" x2="266.6" y2="427.5" />
              <line x1="533.3" y1="22.5" x2="533.3" y2="427.5" />
              <line x1="40" y1="157.5" x2="760" y2="157.5" />
              <line x1="40" y1="292.5" x2="760" y2="292.5" />
            </g>

            {/* Optical Center Crosshair */}
            <g stroke="#38BDF8" strokeOpacity="0.65" strokeWidth="1.2">
              <line x1="388" y1="225" x2="412" y2="225" />
              <line x1="400" y1="213" x2="400" y2="237" />
              <circle cx="400" cy="225" r="8" fill="none" strokeOpacity="0.4" />
            </g>
          </g>
        )}

        {/* 4. EXPLICIT CAMERA MOVEMENT VECTORS (CYAN #38BDF8) */}
        {camMove === 'push_in' && (
          <g stroke="#38BDF8" strokeWidth="2.5" fill="none">
            {/* Inner Target Framing Box + 4 Inward Corner Arrows */}
            <rect x="135" y="75" width="530" height="300" strokeDasharray="6 4" strokeOpacity="0.7" />
            <line x1="55" y1="35" x2="125" y2="70" markerEnd={`url(#cam-arrow-${panel.id})`} />
            <line x1="745" y1="35" x2="675" y2="70" markerEnd={`url(#cam-arrow-${panel.id})`} />
            <line x1="55" y1="415" x2="125" y2="380" markerEnd={`url(#cam-arrow-${panel.id})`} />
            <line x1="745" y1="415" x2="675" y2="380" markerEnd={`url(#cam-arrow-${panel.id})`} />
            <text x="400" y="66" textAnchor="middle" fill="#38BDF8" fontSize="10" fontFamily="monospace" fontWeight="bold">
              CAM: PUSH IN (Z+)
            </text>
          </g>
        )}

        {camMove === 'pull_out' && (
          <g stroke="#38BDF8" strokeWidth="2.5" fill="none">
            {/* Start Framing Box + 4 Outward Corner Arrows */}
            <rect x="155" y="88" width="490" height="274" strokeDasharray="6 4" strokeOpacity="0.7" />
            <line x1="150" y1="84" x2="70" y2="42" markerEnd={`url(#cam-arrow-${panel.id})`} />
            <line x1="650" y1="84" x2="730" y2="42" markerEnd={`url(#cam-arrow-${panel.id})`} />
            <line x1="150" y1="366" x2="70" y2="408" markerEnd={`url(#cam-arrow-${panel.id})`} />
            <line x1="650" y1="366" x2="730" y2="408" markerEnd={`url(#cam-arrow-${panel.id})`} />
            <text x="400" y="80" textAnchor="middle" fill="#38BDF8" fontSize="10" fontFamily="monospace" fontWeight="bold">
              CAM: PULL BACK / CRANE OUT (Z-)
            </text>
          </g>
        )}

        {(camMove === 'pan_right' || camMove === 'pan_left' || camMove === 'track_lateral') && (
          <g stroke="#38BDF8" strokeWidth="3" fill="none">
            <line
              x1={camMove === 'pan_left' ? 680 : 120}
              y1="48"
              x2={camMove === 'pan_left' ? 120 : 680}
              y2="48"
              markerEnd={`url(#cam-arrow-${panel.id})`}
            />
            <text x="400" y="38" textAnchor="middle" fill="#38BDF8" fontSize="10" fontFamily="monospace" fontWeight="bold">
              CAM: {panel.cameraMovement.toUpperCase()}
            </text>
          </g>
        )}

        {(camMove === 'tilt_up' || camMove === 'tilt_down') && (
          <g stroke="#38BDF8" strokeWidth="3" fill="none">
            <line
              x1="735"
              y1={camMove === 'tilt_down' ? 75 : 375}
              x2="735"
              y2={camMove === 'tilt_down' ? 375 : 75}
              markerEnd={`url(#cam-arrow-${panel.id})`}
            />
            <text
              x="722"
              y="225"
              textAnchor="end"
              fill="#38BDF8"
              fontSize="10"
              fontFamily="monospace"
              fontWeight="bold"
            >
              {panel.cameraMovement.toUpperCase()}
            </text>
          </g>
        )}
      </svg>

      {/* Bottom Technical Telemetry Strip */}
      <div className="absolute inset-x-0 bottom-0 bg-[#0A0B0E]/90 border-t border-[#222630] px-3.5 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10.5px] font-mono text-[#E2E8F0] truncate">
          <span className="text-[#38BDF8] font-bold">{panel.shotSize.toUpperCase()}</span>
          <span className="text-zinc-600">·</span>
          <span>{panel.cameraAngle.toUpperCase()}</span>
          <span className="text-zinc-600">·</span>
          <span className="text-[#F2B705]">{panel.cameraMovement.toUpperCase()}</span>
        </div>
        <span className="text-[10.5px] font-mono text-zinc-400 tabular-nums shrink-0">
          {panel.lensFocalLength}
        </span>
      </div>
    </div>
  );
};
