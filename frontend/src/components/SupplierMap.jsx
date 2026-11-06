'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Warehouse position: District 10, HCMC (Cao Thắng / 3 Tháng 2 intersection)
const WAREHOUSE_COORDS = [10.762622, 106.660172];

// Custom icons setup
const createIcon = (color) => {
  if (typeof window === 'undefined') return null;
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

let warehouseIcon;
let supplierIcon;
let selectedIcon;

if (typeof window !== 'undefined') {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });

  supplierIcon = createIcon('red');
  selectedIcon = createIcon('blue');

  // Custom Warehouse SVG Icon
  warehouseIcon = L.divIcon({
    className: 'custom-warehouse-div-icon',
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background-color: #06b6d4;
        color: #ffffff;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.15), 0 2px 4px -1px rgba(0, 0, 0, 0.08);
        border: 2px solid #ffffff;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 21h18"></path>
          <path d="M3 10v11h18V10"></path>
          <path d="M5 21V10l7-5 7 5v11"></path>
          <path d="M12 21V12"></path>
        </svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
  });
}

const fetchDrivingRoute = async (lat, lng) => {
  const res = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${WAREHOUSE_COORDS[1]},${WAREHOUSE_COORDS[0]};${lng},${lat}?overview=full&geometries=geojson`
  );
  const data = await res.json();

  if (!data.routes || data.routes.length === 0) {
    throw new Error('OSRM did not return a driving route');
  }

  return {
    distance: Number((data.routes[0].distance / 1000).toFixed(1)),
    routeCoords: data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]),
  };
};

// Map click handler for select mode with OSRM routing
function MapClickHandler({ onMapClick, active, onRouteError }) {
  useMapEvents({
    async click(e) {
      if (!active) return;
      const { lat, lng } = e.latlng;
      
      try {
        const { distance, routeCoords } = await fetchDrivingRoute(lat, lng);
        onRouteError('');
        onMapClick(lat, lng, distance, routeCoords);
      } catch (err) {
        console.error('OSRM API error:', err);
        onRouteError('Không tìm được tuyến đường bộ thực tế từ kho đến vị trí này. Vui lòng chọn vị trí khác hoặc thử lại sau.');
        onMapClick(lat, lng, 0, []);
      }
    },
  });
  return null;
}

export default function SupplierMap({ 
  mode = 'view', 
  suppliers = [], 
  selectedSupplier = null, 
  selectedLat = null, 
  selectedLng = null,
  onPositionSelected = null 
}) {
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [activeRoute, setActiveRoute] = useState([]);
  const [routeError, setRouteError] = useState('');

  // Fetch OSRM route for active supplier in view mode
  useEffect(() => {
    if (mode === 'view' && selectedSupplier && selectedSupplier.latitude && selectedSupplier.longitude) {
      const fetchRoute = async () => {
        try {
          const { routeCoords } = await fetchDrivingRoute(selectedSupplier.latitude, selectedSupplier.longitude);
          setRouteError('');
          setActiveRoute(routeCoords);
        } catch (e) {
          console.warn('OSRM routing fetch failed:', e);
          setRouteError('Không tải được tuyến đường bộ thực tế cho nhà cung cấp này.');
          setActiveRoute([]);
        }
      };
      fetchRoute();
    } else {
      setActiveRoute([]);
      setRouteError('');
    }
  }, [selectedSupplier, mode]);

  // Handle auto centering of the map view
  useEffect(() => {
    if (mapRef.current && mapReady) {
      const map = mapRef.current;
      if (mode === 'select' && selectedLat && selectedLng) {
        map.setView([selectedLat, selectedLng], 13);
      } else if (selectedSupplier && selectedSupplier.latitude && selectedSupplier.longitude) {
        map.setView([selectedSupplier.latitude, selectedSupplier.longitude], 12);
      } else {
        map.setView(WAREHOUSE_COORDS, 11);
      }
    }
  }, [selectedSupplier, selectedLat, selectedLng, mode, mapReady]);

  // Recalculate route for select mode when coordinates change (e.g. from address search)
  useEffect(() => {
    if (mode === 'select' && selectedLat && selectedLng) {
      const fetchSelectRoute = async () => {
        try {
          const { routeCoords } = await fetchDrivingRoute(selectedLat, selectedLng);
          setRouteError('');
          setActiveRoute(routeCoords);
        } catch (e) {
          console.warn('OSRM routing fetch failed:', e);
          setRouteError('Không tìm được tuyến đường bộ thực tế đến vị trí đang chọn.');
          setActiveRoute([]);
        }
      };
      fetchSelectRoute();
    }
  }, [selectedLat, selectedLng, mode]);

  return (
    <div className="h-full w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/20 relative z-10">
      <MapContainer 
        center={WAREHOUSE_COORDS} 
        zoom={11} 
        scrollWheelZoom={true}
        className="h-full w-full"
        ref={mapRef}
        whenReady={() => setMapReady(true)}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapClickHandler
          active={mode === 'select'}
          onRouteError={setRouteError}
          onMapClick={(lat, lng, distance, routeCoords) => {
            setActiveRoute(routeCoords);
            if (onPositionSelected) {
              onPositionSelected(lat, lng, distance);
            }
          }}
        />

        {/* Central Warehouse Marker with Warehouse Icon */}
        {warehouseIcon && (
          <Marker position={WAREHOUSE_COORDS} icon={warehouseIcon}>
            <Popup>
              <div className="text-slate-900 font-sans p-1">
                <p className="font-bold text-xs">🏢 Tổng kho Bách Hóa Xanh</p>
                <p className="text-[10px] text-slate-500">Quận 10, Thành phố Hồ Chí Minh</p>
                <p className="text-[9px] text-slate-400 font-mono">10.762622, 106.660172</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* View Mode: Render multiple markers and routing polylines */}
        {mode === 'view' && suppliers.map(sup => {
          if (!sup.latitude || !sup.longitude) return null;
          const isSelected = selectedSupplier && selectedSupplier.id === sup.id;
          const position = [sup.latitude, sup.longitude];
          
          return (
            <div key={sup.id}>
              {supplierIcon && selectedIcon && (
                <Marker 
                  position={position} 
                  icon={isSelected ? selectedIcon : supplierIcon}
                >
                  <Popup>
                    <div className="text-slate-900 font-sans p-1">
                      <p className="font-bold text-xs">{sup.name}</p>
                      <p className="text-[10px] text-slate-600">Đại diện: {sup.contact_person || '—'}</p>
                      <p className="text-[10px] text-indigo-600 font-semibold">Cự ly thực tế: {sup.distance_km || 0} km</p>
                    </div>
                  </Popup>
                </Marker>
              )}
            </div>
          );
        })}

        {/* Render active route if available */}
        {activeRoute.length > 0 && (
          <Polyline 
            positions={activeRoute} 
            color="#06b6d4" 
            weight={4}
            opacity={0.8}
            dashArray="1, 8"
            lineCap="round"
          />
        )}

        {/* Selection/Edit Mode: Renders placement marker */}
        {mode === 'select' && selectedLat && selectedLng && selectedIcon && (
          <Marker position={[selectedLat, selectedLng]} icon={selectedIcon}>
            <Popup>
              <div className="text-slate-900 font-sans text-xs">
                <p className="font-semibold">Vị trí đối tác</p>
                <p className="text-[9px] text-slate-500 font-mono">{selectedLat.toFixed(5)}, {selectedLng.toFixed(5)}</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
      
      <div className="absolute top-4 left-12 z-[400] rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 text-[10px] text-slate-600 dark:text-slate-400 shadow">
        🏢 Kho: Q.10, TP.HCM
      </div>

      {routeError && (
        <div className="absolute top-14 left-12 right-4 z-[400] rounded-lg border border-amber-200 bg-amber-50 p-2 text-[10px] font-medium text-amber-700 shadow dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          {routeError}
        </div>
      )}

      {mode === 'select' && (
        <div className="absolute bottom-4 left-4 z-[400] rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 text-xs text-slate-600 dark:text-slate-300 max-w-[240px] shadow-lg">
          <p className="font-semibold text-indigo-600 dark:text-indigo-400 mb-1">📍 Cách ghim tọa độ:</p>
          <p className="text-slate-500 dark:text-slate-400 leading-4">
            Click vào bản đồ hoặc điền địa chỉ rồi bấm <b>"Định vị"</b>. Tuyến đường thực tế và khoảng cách đường đi (km) sẽ được tính toán qua OSRM.
          </p>
        </div>
      )}
    </div>
  );
}
