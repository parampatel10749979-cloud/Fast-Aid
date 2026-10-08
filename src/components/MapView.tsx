import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Hospital, TrafficSignal, DispatchRoutes, Coordinates, GeoJSONLineString, GeoJSONFeatureCollection } from '../types';
import { AmbulanceMarkerElement } from './AmbulanceMarker';
import workerCode from 'maplibre-gl/dist/maplibre-gl-worker.mjs?raw';

// Configure MapLibre Web Worker globally before any map instance initializes
if (typeof window !== 'undefined') {
  try {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    maplibregl.config.WORKER_URL = URL.createObjectURL(blob);
  } catch {
    maplibregl.config.WORKER_URL = '/maplibre-gl-worker.mjs';
  }
}

interface MapViewProps {
  currentLat: number;
  currentLng: number;
  currentHeading: number;
  currentSpeedKmh: number;
  routes: DispatchRoutes | null;
  hospitals: Hospital[];
  signals: TrafficSignal[];
  destinationHospital?: Hospital | null;
  activeSignalId?: string | null;
  showBaseline?: boolean;
  showTraffic?: boolean;
  showSmart?: boolean;
  showTrafficHeatmap?: boolean;
  currentTimeSeconds?: number;
  onMapClick?: (coords: Coordinates) => void;
  startCoords?: Coordinates | null;
  followAmbulance?: boolean;
  onToggleFollow?: () => void;
  onSelectHospital?: (id: string) => void;
}

const CARTO_API_KEY =
  (import.meta.env.VITE_CARTO_API_KEY as string) || 'cb1_4eb7_1_2094774261c7bd455d1d84d9';

// Dull white / light basemap style with dark black road visibility (CARTO Positron)
const DULL_WHITE_MAP_STYLE = {
  version: 8,
  sources: {
    'carto-light': {
      type: 'raster',
      tiles: [
        `https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`,
        `https://a.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`,
        `https://b.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`,
        `https://c.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`,
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
    },
  },
  layers: [
    {
      id: 'carto-light-layer',
      type: 'raster',
      source: 'carto-light',
      minzoom: 0,
      maxzoom: 20,
      paint: {
        'raster-opacity': 1.0,
        'raster-contrast': 0.15,
      },
    },
  ],
};

export const MapView: React.FC<MapViewProps> = ({
  currentLat,
  currentLng,
  currentHeading,
  currentSpeedKmh,
  routes,
  hospitals,
  signals,
  destinationHospital,
  showBaseline = true,
  showTraffic = true,
  showSmart = true,
  showTrafficHeatmap = true,
  currentTimeSeconds = 0,
  onMapClick,
  startCoords,
  followAmbulance = true,
  onToggleFollow,
  onSelectHospital,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const ambulanceMarkerRef = useRef<MapLibreMarker | null>(null);
  const ambulanceDomNodeRef = useRef<HTMLDivElement | null>(null);
  const hospitalMarkersRef = useRef<MapLibreMarker[]>([]);
  const signalMarkersRef = useRef<MapLibreMarker[]>([]);
  const startMarkerRef = useRef<MapLibreMarker | null>(null);

  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: DULL_WHITE_MAP_STYLE as unknown as maplibregl.StyleSpecification,
      center: [currentLng, currentLat],
      zoom: 14.3,
      pitch: 30,
      bearing: -10,
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-right'
    );

    map.on('load', () => {
      setMapLoaded(true);
    });

    map.on('error', (e: any) => {
      // Gracefully silence transient network tile errors (aborted / status 0)
      if (
        e?.error?.message?.includes('AJAXError') ||
        e?.error?.message?.includes('Failed to fetch') ||
        e?.error?.status === 0
      ) {
        return;
      }
    });

    map.on('click', (e) => {
      if (onMapClick) {
        onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    });

    map.on('dragstart', () => {
      if (onToggleFollow && followAmbulance) {
        onToggleFollow();
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Initialize ambulance marker
  useEffect(() => {
    if (!mapRef.current) return;

    if (!ambulanceMarkerRef.current) {
      const el = document.createElement('div');
      ambulanceDomNodeRef.current = el;

      const marker = new maplibregl.Marker({
        element: el,
        rotationAlignment: 'map',
      })
        .setLngLat([currentLng, currentLat])
        .addTo(mapRef.current);

      ambulanceMarkerRef.current = marker;
    }
  }, [mapLoaded]);

  // Update ambulance marker position & heading
  useEffect(() => {
    if (ambulanceMarkerRef.current) {
      ambulanceMarkerRef.current.setLngLat([currentLng, currentLat]);
    }

    if (followAmbulance && mapRef.current) {
      mapRef.current.easeTo({
        center: [currentLng, currentLat],
        duration: 300,
        easing: (t) => t,
      });
    }
  }, [currentLat, currentLng, followAmbulance]);

  // Update start origin marker in solid black
  useEffect(() => {
    if (!mapRef.current || !startCoords) return;

    if (startMarkerRef.current) {
      startMarkerRef.current.remove();
      startMarkerRef.current = null;
    }

    const startEl = document.createElement('div');
    startEl.className = 'w-5 h-5 rounded-full bg-white border-2 border-black flex items-center justify-center shadow-lg';
    startEl.innerHTML = '<div class="w-2 h-2 rounded-full bg-black"></div>';

    startMarkerRef.current = new maplibregl.Marker({ element: startEl })
      .setLngLat([startCoords.lng, startCoords.lat])
      .addTo(mapRef.current);

    return () => {
      startMarkerRef.current?.remove();
    };
  }, [startCoords, mapLoaded]);

  // Render hospitals markers in bold black & white
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    hospitalMarkersRef.current.forEach((m) => m.remove());
    hospitalMarkersRef.current = [];

    hospitals.forEach((hosp) => {
      const isTarget = destinationHospital?.id === hosp.id;
      const el = document.createElement('div');
      el.className = `cursor-pointer transition-transform duration-200 hover:scale-110 ${
        isTarget ? 'z-30' : 'z-20'
      }`;

      el.innerHTML = `
        <div class="flex flex-col items-center">
          <div class="px-2 py-0.5 rounded bg-black border ${
            isTarget ? 'border-black text-white ring-2 ring-black/20' : 'border-neutral-700 text-neutral-300'
          } text-[10px] font-sans font-medium mb-1 shadow-xl whitespace-nowrap">
            ${hosp.name} · <span class="text-white font-bold font-mono">${hosp.availableBeds ?? 28} beds</span>
          </div>
          <div class="w-8 h-8 rounded-full ${
            isTarget
              ? 'bg-black text-white border-2 border-white ring-4 ring-black/25'
              : 'bg-white text-black border-2 border-black'
          } flex items-center justify-center shadow-xl font-black text-sm font-mono">
            +
          </div>
        </div>
      `;

      if (onSelectHospital) {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectHospital(hosp.id);
        });
      }

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([hosp.lng, hosp.lat])
        .addTo(mapRef.current!);

      hospitalMarkersRef.current.push(marker);
    });

    return () => {
      hospitalMarkersRef.current.forEach((m) => m.remove());
      hospitalMarkersRef.current = [];
    };
  }, [hospitals, destinationHospital, mapLoaded]);

  // Render signals in dark black
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    signalMarkersRef.current.forEach((m) => m.remove());
    signalMarkersRef.current = [];

    signals.forEach((sig) => {
      const el = document.createElement('div');
      el.className = 'w-4 h-4 rounded-full flex items-center justify-center pointer-events-none';
      el.innerHTML = `
        <div class="w-3.5 h-3.5 rounded-full bg-black/15 border border-black flex items-center justify-center animate-pulse">
          <div class="w-1.5 h-1.5 rounded-full bg-black"></div>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([sig.lng, sig.lat])
        .addTo(mapRef.current!);

      signalMarkersRef.current.push(marker);
    });

    return () => {
      signalMarkersRef.current.forEach((m) => m.remove());
      signalMarkersRef.current = [];
    };
  }, [signals, mapLoaded]);

  // Add / Update Traffic Density Heatmap Layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const heatmapSourceId = 'traffic-density-heatmap-source';
    const heatmapLayerId = 'traffic-density-heatmap-layer';

    // Build features from signals and congested road corridors
    const congestionPoints: Array<{
      coordinates: [number, number];
      intensity: number;
    }> = [];

    // Signals with live congestion (reduced if preempted by ambulance)
    signals.forEach((sig) => {
      const isCleared = sig.state === 'preempted';
      congestionPoints.push({
        coordinates: [sig.lng, sig.lat],
        intensity: isCleared ? 0.3 : 0.85,
      });
    });

    // Samples along the traffic-aware alternative route to show why it is congested
    if (routes?.traffic?.coordinates) {
      routes.traffic.coordinates.forEach((coord, i) => {
        if (i % 2 === 0) {
          congestionPoints.push({
            coordinates: coord,
            intensity: 0.82,
          });
        }
      });
    }

    // Samples along the baseline route
    if (routes?.baseline?.coordinates) {
      routes.baseline.coordinates.forEach((coord, i) => {
        if (i % 2 === 0) {
          congestionPoints.push({
            coordinates: coord,
            intensity: 0.88,
          });
        }
      });
    }

    const geojson: GeoJSONFeatureCollection = {
      type: 'FeatureCollection',
      features: congestionPoints.map((pt, i) => ({
        type: 'Feature',
        id: i,
        properties: {
          intensity: pt.intensity,
        },
        geometry: {
          type: 'Point',
          coordinates: pt.coordinates,
        },
      })),
    };

    const source = map.getSource(heatmapSourceId) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(geojson);
    } else {
      map.addSource(heatmapSourceId, {
        type: 'geojson',
        data: geojson,
      });

      // Insert heatmap before the first route line layer so routes stay on top
      const beforeId = map.getLayer('casing-smart')
        ? 'casing-smart'
        : map.getLayer('layer-smart')
        ? 'layer-smart'
        : map.getLayer('layer-baseline')
        ? 'layer-baseline'
        : undefined;

      map.addLayer(
        {
          id: heatmapLayerId,
          type: 'heatmap',
          source: heatmapSourceId,
          maxzoom: 18,
          paint: {
            'heatmap-weight': [
              'interpolate',
              ['linear'],
              ['get', 'intensity'],
              0, 0,
              1, 1,
            ],
            'heatmap-intensity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              11, 1.2,
              14, 2.2,
              16, 3.5,
            ],
            // Color ramp: amber -> vibrant orange -> crimson -> deep gridlock red
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(0, 0, 0, 0)',
              0.15, 'rgba(234, 179, 8, 0.45)', // amber
              0.45, 'rgba(249, 115, 22, 0.70)', // orange
              0.75, 'rgba(239, 68, 68, 0.85)', // crimson
              1.0, 'rgba(153, 27, 27, 0.95)', // deep gridlock red
            ],
            'heatmap-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              11, 22,
              13, 38,
              15, 60,
              17, 85,
            ],
            'heatmap-opacity': 0.82,
          },
        },
        beforeId
      );
    }

    if (map.getLayer(heatmapLayerId)) {
      map.setLayoutProperty(
        heatmapLayerId,
        'visibility',
        showTrafficHeatmap ? 'visible' : 'none'
      );
    }
  }, [signals, routes, showTrafficHeatmap, mapLoaded]);

  // Add / Update GeoJSON Routes on Map (Dark Black Lines on Dull White Map)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !routes) return;

    const updateRoute = (
      id: string,
      geojson: GeoJSONLineString,
      color: string,
      width: number,
      dash?: number[],
      opacity = 1.0
    ) => {
      const sourceId = `source-${id}`;
      const layerId = `layer-${id}`;
      const casingLayerId = `casing-${id}`;

      const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData(geojson);
      } else {
        map.addSource(sourceId, {
          type: 'geojson',
          data: geojson,
        });

        // Add casing underlay for maximum crispness on smart route
        if (id === 'smart') {
          map.addLayer({
            id: casingLayerId,
            type: 'line',
            source: sourceId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#000000',
              'line-width': 10,
              'line-opacity': 0.25,
              'line-blur': 2,
            },
          });
        }

        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': color,
            'line-width': width,
            'line-opacity': opacity,
            ...(dash ? { 'line-dasharray': dash } : {}),
          },
        });
      }

      const isVisible =
        id === 'smart' ? showSmart : id === 'traffic' ? showTraffic : showBaseline;
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', isVisible ? 'visible' : 'none');
      }
      if (map.getLayer(casingLayerId)) {
        map.setLayoutProperty(casingLayerId, 'visibility', isVisible ? 'visible' : 'none');
      }
    };

    // Baseline route: Medium gray dashed
    if (routes.baseline) {
      updateRoute('baseline', routes.baseline, '#6B7280', 3.5, [2, 2], 0.7);
    }
    // Traffic route: Dark charcoal dashed
    if (routes.traffic) {
      updateRoute('traffic', routes.traffic, '#374151', 4, [3, 2], 0.85);
    }
    // Smart route: Solid bold dark black line
    if (routes.smart) {
      updateRoute('smart', routes.smart, '#000000', 5.5, undefined, 1.0);
    }
  }, [routes, showBaseline, showTraffic, showSmart, mapLoaded]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#E7EAEB]">
      {/* MapLibre Container */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

      {/* Ambulance Marker attached portal */}
      {ambulanceDomNodeRef.current && (
        <ReactMarkerPortal targetNode={ambulanceDomNodeRef.current}>
          <AmbulanceMarkerElement
            heading={currentHeading}
            speedKmh={currentSpeedKmh}
            unitCode="108 Unit 42"
            isMoving={currentSpeedKmh > 0}
          />
        </ReactMarkerPortal>
      )}
    </div>
  );
};

// Portal helper
import { createPortal } from 'react-dom';
function ReactMarkerPortal({
  targetNode,
  children,
}: {
  targetNode: HTMLElement;
  children: React.ReactNode;
}) {
  return createPortal(children, targetNode);
}

export default MapView;
