import { useState, useEffect, useRef, useCallback } from 'react';
import { TrajectoryPoint } from '../types';

export interface TrajectoryState {
  currentLat: number;
  currentLng: number;
  currentHeading: number;
  currentSpeedKmh: number;
  currentTimeSeconds: number;
  totalDurationSeconds: number;
  progressFraction: number; // 0 to 1
  isComplete: boolean;
  activeEvents: Array<{ t: number; event: string; id: string }>;
  latestEvent: string | null;
}

/**
 * Shortest angular distance interpolation for smooth vehicle heading rotation
 */
function lerpAngle(a: number, b: number, t: number): number {
  let diff = (b - a) % 360;
  if (diff < -180) diff += 360;
  if (diff > 180) diff -= 360;
  return (a + diff * t + 360) % 360;
}

export function useTrajectoryAnimation(
  trajectory: TrajectoryPoint[],
  isPlaying: boolean,
  playbackSpeed: number = 1.0,
  onArrival?: () => void
) {
  const [time, setTime] = useState(0);
  const animFrameRef = useRef<number | null>(null);
  const lastWallTimeRef = useRef<number | null>(null);
  const onArrivalFiredRef = useRef(false);

  const totalDuration = trajectory.length > 0 ? trajectory[trajectory.length - 1].t : 0;

  // Reset or initialize when trajectory changes
  useEffect(() => {
    setTime(0);
    lastWallTimeRef.current = null;
    onArrivalFiredRef.current = false;
  }, [trajectory]);

  // Main animation loop using requestAnimationFrame
  useEffect(() => {
    if (!isPlaying || trajectory.length === 0 || totalDuration === 0) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      lastWallTimeRef.current = null;
      return;
    }

    const animate = (now: number) => {
      if (lastWallTimeRef.current === null) {
        lastWallTimeRef.current = now;
      }

      const deltaMs = now - lastWallTimeRef.current;
      lastWallTimeRef.current = now;

      // Real time step scaled by playbackSpeed (e.g., 2x, 4x)
      // Standard trajectory duration is ~165 seconds; we can also apply a base demo multiplier
      // so a full run takes ~30-40 seconds at 1x speed, or realtime
      const demoPaceMultiplier = 4.0; // allows the demo to be visually engaging without waiting 3 minutes
      const deltaSec = (deltaMs / 1000) * playbackSpeed * demoPaceMultiplier;

      setTime((prevTime) => {
        const nextTime = prevTime + deltaSec;
        if (nextTime >= totalDuration) {
          if (!onArrivalFiredRef.current) {
            onArrivalFiredRef.current = true;
            if (onArrival) onArrival();
          }
          return totalDuration;
        }
        return nextTime;
      });

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [isPlaying, trajectory, totalDuration, playbackSpeed, onArrival]);

  // Interpolate current position and state based on current time
  const getStateAtTime = useCallback(
    (curTime: number): TrajectoryState => {
      if (trajectory.length === 0) {
        return {
          currentLat: 23.0225,
          currentLng: 72.5335,
          currentHeading: 85,
          currentSpeedKmh: 0,
          currentTimeSeconds: 0,
          totalDurationSeconds: 0,
          progressFraction: 0,
          isComplete: false,
          activeEvents: [],
          latestEvent: null,
        };
      }

      // Find bounding segments
      let prevPoint = trajectory[0];
      let nextPoint = trajectory[trajectory.length - 1];

      for (let i = 0; i < trajectory.length - 1; i++) {
        if (trajectory[i].t <= curTime && trajectory[i + 1].t >= curTime) {
          prevPoint = trajectory[i];
          nextPoint = trajectory[i + 1];
          break;
        }
      }

      let segmentProgress = 0;
      const segSpan = nextPoint.t - prevPoint.t;
      if (segSpan > 0) {
        segmentProgress = Math.min(1, Math.max(0, (curTime - prevPoint.t) / segSpan));
      }

      // Smooth cubic ease for segment interpolation
      const smoothT = segmentProgress * segmentProgress * (3 - 2 * segmentProgress);

      const lat = prevPoint.lat + (nextPoint.lat - prevPoint.lat) * smoothT;
      const lng = prevPoint.lng + (nextPoint.lng - prevPoint.lng) * smoothT;

      const headingA = prevPoint.heading ?? 0;
      const headingB = nextPoint.heading ?? headingA;
      const heading = lerpAngle(headingA, headingB, smoothT);

      const speedA = prevPoint.speedKmh ?? 40;
      const speedB = nextPoint.speedKmh ?? speedA;
      const speedKmh = Math.round(speedA + (speedB - speedA) * smoothT);

      // Collect revealed events up to curTime
      const activeEvents: Array<{ t: number; event: string; id: string }> = [];
      let latestEvent: string | null = null;

      trajectory.forEach((pt, idx) => {
        if (pt.t <= curTime && pt.event) {
          activeEvents.push({
            t: pt.t,
            event: pt.event,
            id: `ev-${idx}-${pt.t}`,
          });
          latestEvent = pt.event;
        }
      });

      const progressFraction = totalDuration > 0 ? Math.min(1, curTime / totalDuration) : 0;
      const isComplete = curTime >= totalDuration;

      return {
        currentLat: lat,
        currentLng: lng,
        currentHeading: heading,
        currentSpeedKmh: isComplete ? 0 : speedKmh,
        currentTimeSeconds: Math.round(curTime),
        totalDurationSeconds: totalDuration,
        progressFraction,
        isComplete,
        activeEvents,
        latestEvent,
      };
    },
    [trajectory, totalDuration]
  );

  const seek = useCallback((progressFraction: number) => {
    const target = Math.min(1, Math.max(0, progressFraction)) * totalDuration;
    setTime(target);
    onArrivalFiredRef.current = target >= totalDuration;
    lastWallTimeRef.current = null;
  }, [totalDuration]);

  const reset = useCallback(() => {
    setTime(0);
    onArrivalFiredRef.current = false;
    lastWallTimeRef.current = null;
  }, []);

  const currentState = getStateAtTime(time);

  return {
    ...currentState,
    time,
    seek,
    reset,
  };
}
