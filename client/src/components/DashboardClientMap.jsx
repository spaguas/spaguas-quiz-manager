import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const getAccuracyColor = (percentage) => {
  if (percentage >= 80) {
    return '#16a34a';
  }
  if (percentage >= 50) {
    return '#ca8a04';
  }
  return '#dc2626';
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const DashboardClientMap = ({ points }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    mapRef.current = L.map(containerRef.current, {
      scrollWheelZoom: false,
    }).setView([-23.55, -46.63], 7);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 18,
    }).addTo(mapRef.current);

    layerRef.current = L.layerGroup().addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !layerRef.current) {
      return;
    }

    layerRef.current.clearLayers();

    const bounds = [];
    points.forEach((point) => {
      const latLng = [point.geoLatitude, point.geoLongitude];
      bounds.push(latLng);
      const color = getAccuracyColor(point.percentage);
      L.circleMarker(latLng, {
        radius: 7,
        color,
        fillColor: color,
        fillOpacity: 0.75,
        weight: 2,
      })
        .bindPopup(`
          <strong>${escapeHtml(point.userName || 'Participante')}</strong><br />
          ${escapeHtml(point.quizTitle || point.quiz?.title || 'Quiz')}<br />
          ${Number(point.percentage).toFixed(2)}% de acerto<br />
          ${escapeHtml(point.browserName || 'Navegador não identificado')} / ${escapeHtml(point.osName || 'SO não identificado')}<br />
          IP: ${escapeHtml(point.ipAddress || 'não coletado')}
        `)
        .addTo(layerRef.current);
    });

    if (bounds.length) {
      mapRef.current.fitBounds(bounds, {
        padding: [24, 24],
        maxZoom: 13,
      });
    }
  }, [points]);

  return <div ref={containerRef} className="dashboard-client-map" />;
};

export default DashboardClientMap;
