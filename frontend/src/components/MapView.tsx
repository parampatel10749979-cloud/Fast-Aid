import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { CityData, DispatchResponse, TrajectoryEvent } from '../types';

interface MapViewProps {
  cityData: CityData | null;
  dispatchResult: DispatchResponse | null;
  currentTime: number;
  selectedStartNode: string;
  onSelectStartNode: (nodeId: string) => void;
  isPickMode: boolean;
  mapTheme: 'dark' | 'light';
  activePreemptedSignals: string[];
}

export const MapView: React.FC<MapViewProps> = ({
  cityData,
  dispatchResult,
  currentTime,
  selectedStartNode,
  onSelectStartNode,
  isPickMode,
  mapTheme,
  activePreemptedSignals,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Layer groups
  const routesLayerRef = useRef<L.LayerGroup | null>(null);
  const hospitalsLayerRef = useRef<L.LayerGroup | null>(null);
  const signalsLayerRef = useRef<L.LayerGroup | null>(null);
  const nodesLayerRef = useRef<L.LayerGroup | null>(null);
  const vehicleLayerRef = useRef<L.LayerGroup | null>(null);
  const vehicleMarkerRef = useRef<L.Marker | null>(null);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter: [number, number] = cityData?.center || [37.7808, -122.4075];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 15,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapInstanceRef.current = map;
    routesLayerRef.current = L.layerGroup().addTo(map);
    signalsLayerRef.current = L.layerGroup().addTo(map);
    nodesLayerRef.current = L.layerGroup().addTo(map);
    hospitalsLayerRef.current = L.layerGroup().addTo(map);
    vehicleLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer on theme change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const tileUrl =
      mapTheme === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    const attribution =
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

    const tiles = L.tileLayer(tileUrl, {
      attribution,
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    tileLayerRef.current = tiles;
  }, [mapTheme]);

  // Fit bounds when cityData loads
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !cityData) return;

    map.fitBounds(cityData.bounds, { padding: [40, 40] });
  }, [cityData]);

  // Render Hospitals and Intersections
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !cityData) return;

    // Hospitals
    if (hospitalsLayerRef.current) {
      hospitalsLayerRef.current.clearLayers();

      cityData.hospitals.forEach((hosp) => {
        const iconHtml = `
          <div class="relative flex items-center justify-center cursor-pointer group">
            <div class="w-9 h-9 rounded-full bg-red-600 border-2 border-white shadow-lg flex items-center justify-center text-white font-bold text-sm transform transition-transform group-hover:scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </div>
            <div class="absolute -top-2 -right-2 bg-emerald-500 text-slate-950 font-black text-xs px-1.5 py-0.5 rounded-full border border-white shadow">
              ${hosp.capacity}
            </div>
            <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-900/90 text-slate-100 text-[11px] font-semibold px-2 py-0.5 rounded shadow pointer-events-none border border-slate-700">
              ${hosp.name.replace('Hospital', '').trim()}
            </div>
          </div>
        `;

        const hospIcon = L.divIcon({
          html: iconHtml,
          className: 'custom-hosp-marker',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const marker = L.marker([hosp.lat, hosp.lon], { icon: hospIcon });
        marker.bindPopup(`
          <div class="p-2 text-slate-900 min-w-[200px]">
            <h3 class="font-bold text-sm text-red-600">${hosp.name}</h3>
            <p class="text-xs text-slate-600 mt-1">Free Bed Capacity: <b>${hosp.capacity}</b></p>
            <div class="mt-2 flex flex-wrap gap-1">
              ${hosp.specialties.map(s => `<span class="bg-red-100 text-red-800 text-[10px] px-1.5 py-0.5 rounded font-medium">${s}</span>`).join('')}
            </div>
          </div>
        `);
        hospitalsLayerRef.current?.addLayer(marker);
      });
    }

    // Intersections / Nodes (Clickable for origin selection)
    if (nodesLayerRef.current) {
      nodesLayerRef.current.clearLayers();

      cityData.nodes.forEach((node) => {
        const isSelected = node.id === selectedStartNode;

        const circleMarker = L.circleMarker([node.lat, node.lon], {
          radius: isSelected ? 8 : 3.5,
          color: isSelected ? '#38bdf8' : '#64748b',
          weight: isSelected ? 3 : 1,
          fillColor: isSelected ? '#0284c7' : '#334155',
          fillOpacity: isSelected ? 0.9 : 0.4,
        });

        circleMarker.on('click', () => {
          onSelectStartNode(node.id);
        });

        circleMarker.bindTooltip(node.label || node.id, {
          direction: 'top',
          offset: [0, -4],
        });

        nodesLayerRef.current?.addLayer(circleMarker);
      });
    }
  }, [cityData, selectedStartNode, onSelectStartNode]);

  // Render Traffic Signals with Green Corridor Halo
  useEffect(() => {
    if (!signalsLayerRef.current || !cityData) return;
    signalsLayerRef.current.clearLayers();

    cityData.signals.forEach((sig) => {
      const isPreempted = activePreemptedSignals.includes(sig.node);

      const signalHtml = `
        <div class="relative flex items-center justify-center">
          <div class="w-3.5 h-3.5 rounded-full border border-slate-900 shadow-sm transition-all duration-300 ${
            isPreempted
              ? 'bg-emerald-400 green-wave-beacon scale-125'
              : 'bg-amber-400/80 scale-100'
          }"></div>
        </div>
      `;

      const sigIcon = L.divIcon({
        html: signalHtml,
        className: 'custom-sig-marker',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const marker = L.marker([sig.lat, sig.lon], { icon: sigIcon, interactive: false });
      signalsLayerRef.current?.addLayer(marker);
    });
  }, [cityData, activePreemptedSignals]);

  // Render 3 Route Polylines
  useEffect(() => {
    if (!routesLayerRef.current) return;
    routesLayerRef.current.clearLayers();

    if (!dispatchResult) return;

    const { routes } = dispatchResult;

    // 1. Baseline Route (Cobalt Blue, translucent)
    if (routes.baseline && routes.baseline.length > 1) {
      const baselinePoly = L.polyline(routes.baseline, {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.65,
        dashArray: '4, 8',
      });
      routesLayerRef.current.addLayer(baselinePoly);
    }

    // 2. Traffic-Aware Route (Amber)
    if (routes.traffic && routes.traffic.length > 1) {
      const trafficPoly = L.polyline(routes.traffic, {
        color: '#f59e0b',
        weight: 5,
        opacity: 0.75,
      });
      routesLayerRef.current.addLayer(trafficPoly);
    }

    // 3. Fast-Aid Smart Route (Glowing Emerald Green Corridor)
    if (routes.smart && routes.smart.length > 1) {
      // Glow background line
      const glowPoly = L.polyline(routes.smart, {
        color: '#00e5a0',
        weight: 10,
        opacity: 0.35,
        lineCap: 'round',
      });
      routesLayerRef.current.addLayer(glowPoly);

      // Core crisp line
      const smartPoly = L.polyline(routes.smart, {
        color: '#00e5a0',
        weight: 6,
        opacity: 0.95,
        className: 'smart-route-glow',
      });
      routesLayerRef.current.addLayer(smartPoly);
    }
  }, [dispatchResult]);

  // Animated Ambulance Vehicle Marker
  useEffect(() => {
    if (!vehicleLayerRef.current || !dispatchResult) return;

    const traj = dispatchResult.active_trip.trajectory;
    if (!traj || traj.length === 0) return;

    // Find current position along trajectory based on currentTime
    let curLat = traj[0].lat;
    let curLon = traj[0].lon;
    let heading = 0;
    let curSpeed = traj[0].speed_kmh;

    // Find interpolation segment
    let p1: TrajectoryEvent = traj[0];
    let p2: TrajectoryEvent = traj[0];

    for (let i = 0; i < traj.length - 1; i++) {
      if (currentTime >= traj[i].t && currentTime <= traj[i + 1].t) {
        p1 = traj[i];
        p2 = traj[i + 1];
        break;
      }
    }

    if (currentTime >= traj[traj.length - 1].t) {
      p1 = traj[traj.length - 1];
      p2 = traj[traj.length - 1];
      curLat = p1.lat;
      curLon = p1.lon;
      curSpeed = 0;
    } else if (p1 !== p2 && p2.t > p1.t) {
      const frac = (currentTime - p1.t) / (p2.t - p1.t);
      curLat = p1.lat + (p2.lat - p1.lat) * frac;
      curLon = p1.lon + (p2.lon - p1.lon) * frac;
      curSpeed = p2.speed_kmh;

      // Calculate bearing angle in degrees
      const dLat = p2.lat - p1.lat;
      const dLon = p2.lon - p1.lon;
      heading = (Math.atan2(dLon, dLat) * 180) / Math.PI;
    }

    const vehicleHtml = `
      <div class="relative flex items-center justify-center cursor-pointer select-none" style="transform: rotate(${heading}deg); transform-origin: center;">
        <!-- Emergency Siren Pulse Aura -->
        <div class="w-11 h-11 rounded-full siren-active flex items-center justify-center bg-slate-900 border-2 border-emerald-400 shadow-2xl">
          <!-- Ambulance Icon SVG -->
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 17h4V5H2v12h3"/>
            <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/>
            <circle cx="7.5" cy="17.5" r="2.5"/>
            <circle cx="17.5" cy="17.5" r="2.5"/>
            <path d="M6 9h4"/>
            <path d="M8 7v4"/>
          </svg>
        </div>
      </div>
      <!-- Speed Tag (Counter-rotated to stay upright) -->
      <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-emerald-950/90 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/50 shadow pointer-events-none">
        ${curSpeed.toFixed(0)} km/h
      </div>
    `;

    const vehicleIcon = L.divIcon({
      html: vehicleHtml,
      className: 'custom-vehicle-marker',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    if (!vehicleMarkerRef.current) {
      vehicleMarkerRef.current = L.marker([curLat, curLon], {
        icon: vehicleIcon,
        zIndexOffset: 1000,
      }).addTo(vehicleLayerRef.current);
    } else {
      vehicleMarkerRef.current.setLatLng([curLat, curLon]);
      vehicleMarkerRef.current.setIcon(vehicleIcon);
    }
  }, [currentTime, dispatchResult]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Map Legend & Layer Controls Overlay */}
      <div className="absolute top-4 right-4 z-[400] bg-slate-900/90 backdrop-blur-md border border-slate-800 p-3 rounded-xl shadow-xl flex flex-col gap-2.5 text-xs">
        <div className="font-semibold text-slate-300 flex items-center justify-between pb-1 border-b border-slate-800">
          <span>Route Legend</span>
          <span className="text-[10px] text-emerald-400 font-mono">LIVE GPS</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]"></div>
          <span className="text-slate-200 font-medium">Fast-Aid (Green Corridor)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-1 rounded-full bg-amber-400"></div>
          <span className="text-slate-400">Traffic-Aware Alternative</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-0.5 rounded-full bg-blue-400"></div>
          <span className="text-slate-500">Baseline Shortest Distance</span>
        </div>
        <div className="pt-1 border-t border-slate-800 flex items-center justify-between gap-3 text-[11px]">
          <span className="flex items-center gap-1 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span> Hospital
          </span>
          <span className="flex items-center gap-1 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span> Preempted
          </span>
        </div>
      </div>

      {isPickMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] bg-sky-500/90 text-white font-semibold text-xs px-4 py-2 rounded-full shadow-lg backdrop-blur animate-pulse">
          📍 Click on any intersection on the map to set starting location
        </div>
      )}
    </div>
  );
};
