import React from 'react';

interface AmbulanceMarkerProps {
  heading: number; // in degrees (0 = North)
  speedKmh: number;
  unitCode?: string;
  isMoving?: boolean;
}

/**
 * Visual DOM representation for the Fast-Aid Ambulance.
 * High-contrast on dull white map:
 * - Solid pitch-black chassis with sharp white roof beacons
 * - Concentric dark radar ping rings
 * - Upright high-contrast black & white telemetry pill
 */
export const AmbulanceMarkerElement: React.FC<AmbulanceMarkerProps> = ({
  heading,
  speedKmh,
  unitCode = '108 Unit 42',
  isMoving = true,
}) => {
  return (
    <div className="relative flex items-center justify-center select-none pointer-events-none group">
      {/* Precision Radar / Accuracy ring in dark high-contrast tone */}
      <div className="absolute w-20 h-20 -top-10 -left-10 flex items-center justify-center pointer-events-none">
        <div className="absolute w-16 h-16 rounded-full bg-black/15 animate-ping opacity-60" />
        <div className="absolute w-12 h-12 rounded-full bg-black/20 border border-black/40" />
      </div>

      {/* Rotating Vehicle Container */}
      <div
        className="relative z-10 transition-transform duration-75 ease-linear will-change-transform"
        style={{
          transform: `rotate(${heading}deg)`,
        }}
      >
        {/* Forward directional light beam cone */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-8 h-10 bg-gradient-to-t from-black/25 via-black/10 to-transparent pointer-events-none clip-cone" />

        {/* Vehicle Body Chassis - Solid Pitch Black */}
        <div className="relative w-8 h-12 bg-black border-2 border-white rounded-lg shadow-2xl shadow-black/40 flex flex-col items-center justify-between p-0.5 overflow-hidden ring-1 ring-black/40">
          {/* Front windshield */}
          <div className="w-5 h-2 bg-neutral-800 border-b border-white/40 rounded-t-sm" />

          {/* Roof Lightbar (High-contrast alternating white strobe) */}
          <div className="flex items-center justify-center gap-1 w-full px-1">
            <div
              className={`w-2 h-1.5 rounded-xs bg-white ${
                isMoving ? 'animate-pulse shadow-[0_0_8px_#ffffff]' : 'bg-neutral-300'
              }`}
            />
            <div
              className={`w-2 h-1.5 rounded-xs bg-neutral-400 ${
                isMoving ? 'animate-pulse shadow-[0_0_8px_#ffffff]' : 'bg-neutral-500'
              }`}
            />
          </div>

          {/* Medical Cross Graphic on Roof */}
          <div className="relative w-3 h-3 flex items-center justify-center">
            <div className="absolute w-3 h-1 bg-white rounded-xs" />
            <div className="absolute w-1 h-3 bg-white rounded-xs" />
          </div>

          {/* Rear bumper indicators */}
          <div className="flex justify-between w-full px-1">
            <div className="w-1 h-0.5 bg-neutral-500" />
            <div className="w-1 h-0.5 bg-neutral-500" />
          </div>
        </div>
      </div>

      {/* Telemetry Tag - Always oriented upright */}
      <div className="absolute top-7 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap pointer-events-auto">
        <div className="px-2 py-0.5 bg-black/95 backdrop-blur-md border border-neutral-700 rounded text-[11px] font-mono text-white shadow-xl flex items-center gap-1.5 tabular-nums">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping inline-block" />
          <span className="font-semibold text-white">{unitCode}</span>
          <span className="text-neutral-500">·</span>
          <span className="text-white font-bold">{speedKmh} km/h</span>
        </div>
      </div>
    </div>
  );
};

export default AmbulanceMarkerElement;
