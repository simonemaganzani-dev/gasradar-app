import { useState, useEffect, useCallback } from "react";
import { ocmProxy } from "@/functions/ocmProxy";

const CDN_URL = "https://simonemaganzani-dev.github.io/gasradar-data-refresh/gasdata.json";
const LOGO_URL = "https://media.base44.com/images/public/69bc7d91ef710a82d9b2208a/fc0473832_logoGasRadar.jpg";
const TRACK_URL = "https://jarvis-928e73ed.base44.app/functions/trackEvent";

const FUEL_TYPES = [
{ key: "gasoilA", label: "Gasóleo A (Diésel)", short: "Diésel", icon: "🛢️" },
{ key: "gasolina95", label: "Gasolina 95 E5", short: "95 E5", icon: "🟢" },
{ key: "gasolina98", label: "Gasolina 98 E5", short: "98 E5", icon: "🔵" },
{ key: "gasoilPremium", label: "Gasóleo Premium", short: "Diésel+", icon: "⭐" },
{ key: "glp", label: "GLP", short: "GLP", icon: "💨" },
{ key: "electric", label: "Eléctrico", short: "Eléctrico", icon: "⚡" }];


const BRANDS = [
"Repsol", "BP", "Cepsa", "Shell", "Galp", "Avia", "Disa", "Meroil", "Ballenoil",
"Carrefour", "Alcampo", "Eroski", "Plenoil", "Plenergy", "Bonarea", "Campsa",
"Petronor", "Moeve", "Petrocat", "El Corte Inglés"];


const RADIUS_OPTIONS = [2, 5, 10, 20, 50];

const BRAND_COLORS = {
  repsol: "#e30613",
  bp: "#009b4d",
  cepsa: "#f7a600",
  shell: "#fbce07",
  galp: "#ff6600",
  avia: "#005baa",
  disa: "#00529b",
  meroil: "#c8102e",
  ballenoil: "#004b8d",
  carrefour: "#004a97",
  alcampo: "#e2001a",
  eroski: "#e2001a",
  plenoil: "#e63312",
  plenergy: "#e63312",
  bonarea: "#e30613",
  campsa: "#e30613",
  petronor: "#003087",
  moeve: "#005baa",
  petrocat: "#e30613",
  default: "#6b7280"
};

function getBrandColor(name) {
  if (!name) return BRAND_COLORS.default;
  const lower = name.toLowerCase();
  for (const [key, color] of Object.entries(BRAND_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return BRAND_COLORS.default;
}

function BrandAvatar({ name }) {
  const color = getBrandColor(name);
  const initial = (name || "?")[0].toUpperCase();
  return (
    <div style={{
      width: 42, height: 42, borderRadius: "50%",
      background: color, color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 800, fontSize: 18, flexShrink: 0,
      boxShadow: `0 2px 8px ${color}55`
    }}>
      {initial}
    </div>);

}

function isStationOpen(schedule) {
  if (!schedule) return null;
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const currentMin = h * 60 + m;
  if (/L-D.*00:00-00:00|24H|24 H/i.test(schedule)) return true;
  const parseTime = (t) => {
    const [hh, mm] = t.trim().split(":").map(Number);
    return hh * 60 + (mm || 0);
  };
  const segments = schedule.split(";");
  for (const seg of segments) {
    const timeMatch = seg.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if (!timeMatch) continue;
    const open = parseTime(timeMatch[1]);
    const close = parseTime(timeMatch[2]);
    const inTime = close > open ?
    currentMin >= open && currentMin < close :
    currentMin >= open || currentMin < close;
    if (inTime) return true;
  }
  return false;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
  Math.sin(dLat / 2) ** 2 +
  Math.cos(lat1 * Math.PI / 180) *
  Math.cos(lat2 * Math.PI / 180) *
  Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const C = {
  bg: "#1a1f2e",
  surface: "#161b25",
  surfaceAlt: "#1e2535",
  border: "#2a3348",
  text: "#e8eaf0",
  textMid: "#a8b0c8",
  textMuted: "#5a6480",
  accent: "#f0c30f",
  accentHover: "#d4a900",
  accentLight: "#2a2400",
  danger: "#e74c3c",
  dangerLight: "#2a0f0d",
  blue: "#f0c30f",
  blueLight: "#2a2400",
  highlight: "#1e1c08",
  highlightBorder: "#f0c30f",
  gold: "#f0c30f",
  shadow: "0 1px 4px rgba(0,0,0,0.4), 0 2px 12px rgba(0,0,0,0.3)",
  shadowMd: "0 4px 16px rgba(0,0,0,0.5)"
};

const isAppleDevice = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) && !window.MSStream;

function StationCard({ station, fuelKey, rank, index }) {
  const price = station.prices[fuelKey];
  const highlight = rank === 1;
  const rankLabel = rank === 1 ? "🥇 Mejor precio" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  const open = isStationOpen(station.schedule);
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lon}`;
  const appleMapsUrl = `maps://maps.apple.com/?daddr=${station.lat},${station.lon}&dirflg=d`;

  return (
    <div style={{
      background: highlight ? C.highlight : C.surface,
      border: `1.5px solid ${highlight ? C.highlightBorder : C.border}`,
      borderRadius: 14,
      padding: "12px 14px",
      marginBottom: 10,
      display: "flex",
      alignItems: "center",
      gap: 12,
      boxShadow: highlight ? `0 4px 16px rgba(240,195,15,0.2)` : C.shadow,
      animation: `fadeInUp 0.3s ease both`,
      animationDelay: `${index * 0.05}s`
    }}>
      <BrandAvatar name={station.name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
            {station.name}
          </span>
          {rankLabel &&
          <span style={{
            background: rank === 1 ? C.accentLight : C.surfaceAlt,
            color: rank === 1 ? C.accent : C.textMid,
            fontSize: 11, fontWeight: 700,
            borderRadius: 20, padding: "2px 8px"
          }}>
              {rankLabel}
            </span>
          }
          {open !== null &&
          <span style={{
            background: open ? "#dcfce7" : "#fee2e2",
            color: open ? "#16a34a" : "#dc2626",
            fontSize: 10, fontWeight: 700,
            borderRadius: 20, padding: "2px 7px"
          }}>
              {open ? "Abierto" : "Cerrado"}
            </span>
          }
        </div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} className="text-slate-50">
          {station.address}, {station.locality || station.municipality}
        </div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>
          📍 {station.dist.toFixed(1)} km
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0, alignSelf: "flex-start" }}>
        {price ?
        <div style={{ fontWeight: 800, fontSize: 20, color: highlight ? C.accent : C.text }}>
            {price.toFixed(3)}<span style={{ fontSize: 13, fontWeight: 500 }}> €</span>
          </div> :

        <span style={{ color: C.textMuted, fontSize: 13 }}>N/D</span>
        }
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 5 }}>
          {isAppleDevice &&
          <a href={appleMapsUrl}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
            background: C.blue, color: "#fff",
            padding: "4px 10px", borderRadius: 8,
            fontSize: 11, textDecoration: "none", fontWeight: 600
          }}>
              <svg width="11" height="11" viewBox="0 0 814 1000" fill="white" xmlns="http://www.w3.org/2000/svg">
                <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105.5-57.8-155.5-127.4C46 523 0 443.7 0 368.8c0-170.2 111.4-260.1 220.9-260.1 75.5 0 138.4 50 185.3 50 44.9 0 115.1-52.5 199.1-52.5zM480.3 49.4c18.4-21.4 32.1-51.6 32.1-81.9 0-4.2-.3-8.4-.9-11.7-30.3 1.2-66.1 20.2-87.8 44.4-16.5 18.4-31.8 48.9-31.8 79.6 0 4.5.6 9 1 10.5 1.9.3 5.2.6 8.4.6 27.4 0 60.1-18.1 79-41.5z" />
              </svg>
              Apple Maps
            </a>
          }
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
          onClick={() => fetch(TRACK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "maps_click" }) }).catch(() => {})}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
            background: C.blue, color: "#fff",
            padding: "4px 10px", borderRadius: 8,
            fontSize: 11, textDecoration: "none", fontWeight: 600
          }}>
            <svg width="11" height="11" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path fill="#4285F4" d="M24 4C13 4 4 13 4 24s9 20 20 20 20-9 20-20S35 4 24 4z" />
              <path fill="#34A853" d="M15 24c0-5 4-9 9-9s9 4 9 9-4 9-9 9-9-4-9-9z" />
              <path fill="#FBBC05" d="M24 15c-5 0-9 4-9 9h18c0-5-4-9-9-9z" />
              <path fill="#EA4335" d="M24 33c5 0 9-4 9-9H15c0 5 4 9 9 9z" />
            </svg>
            Google Maps
          </a>
        </div>
      </div>
    </div>);

}

function StatsRow({ stations, fuelKey }) {
  const prices = stations.map((s) => s.prices[fuelKey]).filter(Boolean);
  if (prices.length === 0) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      {[
      { label: "Mínimo", value: min, bg: "#dcfce7", color: "#16a34a" },
      { label: "Medio", value: avg, bg: "#fef9c3", color: "#ca8a04" },
      { label: "Máximo", value: max, bg: "#fee2e2", color: "#dc2626" }].
      map(({ label, value, bg, color }) =>
      <div key={label} style={{
        flex: 1, background: bg, borderRadius: 12,
        padding: "8px 0", textAlign: "center",
        boxShadow: C.shadow
      }}>
          <div style={{ fontSize: 10, fontWeight: 600, color, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
          <div style={{ fontSize: 17, fontWeight: 800, color }}>{value.toFixed(3)} €</div>
        </div>
      )}
    </div>);

}

export default function GasRadar() {
  const [tab, setTab] = useState("cheap");
  const [fuelKey, setFuelKey] = useState("gasoilA");
  const [radius, setRadius] = useState(5);
  const [preferredBrands, setPreferredBrands] = useState([]);
  const [location, setLocation] = useState(null);
  const [allStations, setAllStations] = useState([]);
  const [nearbyStations, setNearbyStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [error, setError] = useState("");
  const [showBrandPicker, setShowBrandPicker] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  const [pulse, setPulse] = useState(false);
  const [totalVisits, setTotalVisits] = useState(null);
  const [chargers, setChargers] = useState([]);
  const [chargersLoading, setChargersLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("gasradar_brands");
    if (saved) {try {setPreferredBrands(JSON.parse(saved));} catch {}}
    const savedFuel = localStorage.getItem("gasradar_fuel");
    if (savedFuel) setFuelKey(savedFuel);
    const savedRadius = localStorage.getItem("gasradar_radius");
    if (savedRadius) setRadius(parseInt(savedRadius));
    const interval = setInterval(() => setPulse((p) => !p), 1500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch(TRACK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "visit" })
    }).
    then((r) => r.json()).
    then((d) => {if (d.total_visits_ever) setTotalVisits(d.total_visits_ever);}).
    catch(() => {});
  }, []);

  const saveBrands = (brands) => {setPreferredBrands(brands);localStorage.setItem("gasradar_brands", JSON.stringify(brands));};
  const saveFuel = (key) => {
    setFuelKey(key);
    localStorage.setItem("gasradar_fuel", key);
    if (tab === "electric") setTab("cheap");
  };
  const saveRadius = (r) => {setRadius(r);localStorage.setItem("gasradar_radius", r.toString());};

  const fetchData = useCallback(async () => {
    setLoading(true);setError("");setStatus("📡 Cargando precios...");
    try {
      const res = await fetch(CDN_URL);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = await res.json();
      setAllStations(json.stations || []);
      setUpdatedAt(json.updated || "");
      setDataLoaded(true);
      setStatus("✅ Datos cargados. Buscando posición...");
      return json.stations || [];
    } catch (e) {
      setError("❌ Error cargando datos: " + e.message);
      setStatus("");return [];
    } finally {setLoading(false);}
  }, []);

  const locate = useCallback((stations) => {
    if (!navigator.geolocation) {setError("❌ Geolocalización no soportada");return;}
    setStatus("📍 Detectando posición...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });setStatus("");},
      () => {setError("❌ Permiso de ubicación denegado");setStatus("");},
      { timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const start = async () => {
    const stations = allStations.length > 0 ? allStations : await fetchData();
    if (stations.length > 0 && !location) locate(stations);
  };

  useEffect(() => {
    if (!location || allStations.length === 0) return;
    const nearby = allStations.
    map((s) => ({ ...s, dist: haversineDistance(location.lat, location.lon, s.lat, s.lon) })).
    filter((s) => s.dist <= radius && s.prices[fuelKey] !== null).
    sort((a, b) => a.dist - b.dist);
    setNearbyStations(nearby);
  }, [location, allStations, radius, fuelKey]);

  // Fetch chargers when fuelKey=electric and location available
  useEffect(() => {
    if (fuelKey !== "electric" || !location) return;
    if (chargers.length > 0) return; // already loaded
    setChargersLoading(true);
    ocmProxy({ lat: location.lat, lon: location.lon, radius }).
    then((r) => setChargers(r.data || [])).
    catch(() => setChargers([])).
    finally(() => setChargersLoading(false));
  }, [tab, location, radius]);

  // Reset chargers when location/radius changes
  useEffect(() => {setChargers([]);}, [location, radius]);

  const cheapStations = [...nearbyStations].filter((s) => s.prices[fuelKey] !== null).sort((a, b) => a.prices[fuelKey] - b.prices[fuelKey]).slice(0, 10);
  const expensiveStations = [...nearbyStations].filter((s) => s.prices[fuelKey] !== null).sort((a, b) => b.prices[fuelKey] - a.prices[fuelKey]).slice(0, 10);
  const brandStations = preferredBrands.length === 0 ? [] : nearbyStations.filter((s) => preferredBrands.some((b) => s.name.toUpperCase().includes(b.toUpperCase()))).sort((a, b) => a.prices[fuelKey] - b.prices[fuelKey]).slice(0, 10);

  const activeList = tab === "cheap" ? cheapStations : tab === "expensive" ? expensiveStations : brandStations;

  // Helpers per colonnine elettriche
  const parseUsageCost = (str) => {if (!str) return Infinity;const m = str.match(/[\d,.]+/);return m ? parseFloat(m[0].replace(",", ".")) : Infinity;};
  const chargersWithCost = chargers.map((c) => ({ ...c, _cost: parseUsageCost(c.UsageCost), _power: c.Connections?.[0]?.PowerKW || 0 }));
  const getActiveChargers = () => {
    if (fuelKey !== "electric") return [];
    if (tab === "cheap") return [...chargersWithCost].sort((a, b) => a._cost - b._cost).slice(0, 10);
    if (tab === "expensive") return [...chargersWithCost].sort((a, b) => b._power - a._power).slice(0, 10);
    if (tab === "brands") return chargersWithCost.filter((c) => preferredBrands.some((b) => (c.OperatorInfo?.Title || "").toUpperCase().includes(b.toUpperCase()))).sort((a, b) => b._power - a._power).slice(0, 10);
    return chargersWithCost;
  };
  const activeChargers = getActiveChargers();

  const filteredBrands = BRANDS.filter((b) => b.toLowerCase().includes(brandSearch.toLowerCase()));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: ${C.bg}; color-scheme: dark; }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(240,195,15,0.5); }
          50%       { box-shadow: 0 0 0 8px rgba(240,195,15,0); }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes slideOutRight {
          from { transform: translateX(0); }
          to { transform: translateX(100%); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Inter', sans-serif", maxWidth: 480, margin: "0 auto", paddingBottom: 32, position: "relative" }}>
        
        {/* Settings Panel */}
        {showSettings &&
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.4)", zIndex: 200,
          animation: "fadeIn 0.3s ease"
        }} onClick={() => setShowSettings(false)} />
        }
        <div style={{
          position: "fixed", top: 0, right: 0, width: "100%", maxWidth: 480,
          height: "100vh", background: "#3a4556", zIndex: 201,
          animation: showSettings ? "slideInRight 0.3s ease" : "slideOutRight 0.3s ease",
          transform: showSettings ? "translateX(0)" : "translateX(100%)",
          display: "flex", flexDirection: "column"
        }}>
          <div style={{ padding: "16px 16px", display: "flex", justifyContent: "flex-start" }}>
            <button
              onClick={() => setShowSettings(false)}
              style={{
                background: "transparent", border: "none",
                color: "#fff", cursor: "pointer", fontSize: 24,
                padding: "4px 8px", fontWeight: 700
              }}>
              ✕
            </button>
          </div>
          <div style={{ flex: 1, padding: "16px", overflowY: "auto" }}>
            {/* Login Section */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 10 }}>Accedi</h3>
              <div style={{
                background: "#2a3340", borderRadius: 12, padding: 12,
                display: "flex", gap: 8, opacity: 0.6, pointerEvents: "none"
              }}>
                <div style={{
                  flex: 1, background: "#1a2332", borderRadius: 8, padding: 10,
                  textAlign: "center", fontSize: 12, color: "#a8b0c8"
                }}>📧 Email</div>
                <div style={{
                  flex: 1, background: "#1a2332", borderRadius: 8, padding: 10,
                  textAlign: "center", fontSize: 12, color: "#a8b0c8"
                }}>🔑 Password</div>
              </div>
            </div>

            {/* Mi Vehiculo Section */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 10 }}>Mi Vehículo</h3>
              <div style={{
                background: "#2a3340", borderRadius: 12, padding: 12,
                opacity: 0.6, pointerEvents: "none"
              }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: "#a8b0c8", marginBottom: 6 }}>Tipo de motor</div>
                  <div style={{
                    background: "#1a2332", borderRadius: 8, padding: 10,
                    display: "flex", gap: 4, flexWrap: "wrap"
                  }}>
                    {["Diésel", "Gasolina", "GLP", "Eléctrico"].map((type) => (
                      <div key={type} style={{
                        flex: 1, minWidth: 70, background: "#2a3340", borderRadius: 6,
                        padding: "6px 8px", textAlign: "center", fontSize: 11, color: "#a8b0c8"
                      }}>{type}</div>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#a8b0c8", marginBottom: 6 }}>Capacidad depósito</div>
                  <div style={{
                    background: "#1a2332", borderRadius: 8, padding: 10,
                    fontSize: 12, color: "#a8b0c8"
                  }}>📦 40L / 60kWh</div>
                </div>
              </div>
            </div>

            {/* Price Alerts Section */}
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 10 }}>Alertas de Precio</h3>
              <div style={{
                background: "#2a3340", borderRadius: 12, padding: 12,
                opacity: 0.6, pointerEvents: "none"
              }}>
                {[
                  { label: "Gasolina 95", price: "€1.50" },
                  { label: "Diésel", price: "€1.35" },
                  { label: "Cargar Eléctrico", price: "€0.30/kWh" }
                ].map((alert) => (
                  <div key={alert.label} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 0", borderBottom: "1px solid #1a2332"
                  }}>
                    <span style={{ fontSize: 12, color: "#a8b0c8" }}>{alert.label}</span>
                    <div style={{
                      background: "#1a2332", borderRadius: 6, padding: "6px 12px",
                      fontSize: 11, color: "#a8b0c8"
                    }}>🔔 {alert.price}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      

        {/* STICKY HEADER */}
        <div style={{
          position: "sticky", top: 0, zIndex: 100,
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
          padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 12,
          boxShadow: "0 4px 20px rgba(26,26,46,0.45)"
        }}>
          <img src={LOGO_URL} alt="GasRadar" style={{ width: 48, height: 48, borderRadius: 12, objectFit: "cover", boxShadow: "0 2px 10px rgba(0,0,0,0.25)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 20, color: "#fff", letterSpacing: -0.5, lineHeight: 1.1 }}>GasRadar</div>
            {updatedAt &&
            <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.7)", fontWeight: 500, marginTop: 1, lineHeight: 1.2 }}>
                <div>Última actualización MINETUR</div>
                <div>{updatedAt}</div>
              </div>
            }
          </div>
          <button
            onClick={() => {setAllStations([]);setNearbyStations([]);setDataLoaded(false);setLocation(null);}}
            style={{
              background: "transparent", border: "none",
              color: "#fff", cursor: "pointer", fontSize: 28, display: "flex", alignItems: "center", justifyContent: "center",
              transition: "transform 0.2s",
              textShadow: "0 3px 6px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.3)",
              padding: 0
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"}
            onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
            title="Actualizar">
            
            🔄
          </button>
          <button
            onClick={() => setShowSettings(true)}
            style={{
              background: "transparent", border: "none",
              color: "#fff", cursor: "pointer", fontSize: 28, display: "flex", alignItems: "center", justifyContent: "center",
              transition: "transform 0.2s",
              textShadow: "0 3px 6px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.3)",
              padding: 0
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"}
            onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
            title="Impostazioni">
            
            ⚙️
          </button>
        </div>

        <div style={{ padding: "16px 14px" }} className="bg-stone-200">

          {/* FUEL SELECTOR — griglia 3x2 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
            {FUEL_TYPES.map((f) => {
              const isElec = f.key === "electric";
              const active = fuelKey === f.key;
              return (
                <button key={f.key} onClick={() => saveFuel(f.key)} style={{
                  background: active ? isElec ? "#22c55e" : C.accent : C.surface,
                  color: active ? "#111" : C.textMid,
                  border: `1.5px solid ${active ? isElec ? "#22c55e" : C.accent : C.border}`,
                  borderRadius: 10, padding: "8px 4px",
                  cursor: "pointer", fontSize: 12, fontWeight: 600,
                  boxShadow: active ? `0 4px 12px ${isElec ? "rgba(34,197,94,0.35)" : "rgba(240,195,15,0.35)"}` : "none",
                  transition: "all 0.15s",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2
                }}>
                  <span style={{ fontSize: 16 }}>{f.icon}</span>
                  <span>{f.short}</span>
                </button>);

            })}
          </div>

          {/* RADIUS SLIDER */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, whiteSpace: "nowrap" }}>Radio:</span>
              <div style={{ flex: 1, position: "relative", height: 28, display: "flex", alignItems: "center" }}>
                {/* Track */}
                <div style={{ position: "absolute", left: 0, right: 0, height: 4, background: C.border, borderRadius: 2 }} />
                {/* Fill */}
                <div style={{
                  position: "absolute", left: 0, height: 4, borderRadius: 2,
                  background: C.blue,
                  width: `${RADIUS_OPTIONS.indexOf(radius) / (RADIUS_OPTIONS.length - 1) * 100}%`
                }} />
                {/* Tick marks */}
                {RADIUS_OPTIONS.map((r, i) =>
                <div
                  key={r}
                  onClick={() => saveRadius(r)}
                  style={{
                    position: "absolute",
                    left: `${i / (RADIUS_OPTIONS.length - 1) * 100}%`,
                    transform: "translateX(-50%)",
                    width: 12, height: 12,
                    borderRadius: "50%",
                    background: RADIUS_OPTIONS.indexOf(r) <= RADIUS_OPTIONS.indexOf(radius) ? C.blue : C.surface,
                    border: `2px solid ${RADIUS_OPTIONS.indexOf(r) <= RADIUS_OPTIONS.indexOf(radius) ? C.blue : C.border}`,
                    cursor: "pointer",
                    zIndex: 1
                  }} />

                )}
                {/* Invisible range input for dragging */}
                <input
                  type="range"
                  min={0} max={RADIUS_OPTIONS.length - 1}
                  value={RADIUS_OPTIONS.indexOf(radius)}
                  onChange={(e) => saveRadius(RADIUS_OPTIONS[+e.target.value])}
                  style={{
                    position: "absolute", left: 0, right: 0, width: "100%",
                    opacity: 0, cursor: "pointer", height: 28, margin: 0
                  }} />
                
              </div>
              <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, minWidth: 36, textAlign: "right" }}>{radius} km</span>
            </div>
            {/* Labels */}
            <div style={{ display: "flex", justifyContent: "space-between", paddingLeft: 52, paddingRight: 44, marginTop: 2 }}>
              {RADIUS_OPTIONS.map((r) =>
              <span key={r} style={{ fontSize: 10, color: radius === r ? C.blue : C.textMuted, fontWeight: radius === r ? 700 : 500 }}>{r}</span>
              )}
            </div>
          </div>

          {/* START BUTTON */}
          {!location &&
          <button onClick={start} disabled={loading} style={{
            width: "100%", padding: "14px",
            background: loading ? C.textMuted : C.accent,
            color: "#fff", border: "none", borderRadius: 14,
            fontSize: 16, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
            marginBottom: 14,
            animation: !loading ? "pulse 1.5s infinite" : "none",
            boxShadow: `0 4px 16px rgba(240,195,15,0.4)`
          }}>
              {loading ? "⏳ Cargando..." : "📍 Buscar gasolineras cercanas"}
            </button>
          }

          {status && <div style={{ background: C.blueLight, color: C.blue, borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13, fontWeight: 500 }}>{status}</div>}
          {error && <div style={{ background: C.dangerLight, color: C.danger, borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13, fontWeight: 500 }}>{error}</div>}

          {nearbyStations.length > 0 && <StatsRow stations={nearbyStations} fuelKey={fuelKey} />}

          {location &&
          <>
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                {[
              { key: "cheap", label: fuelKey === "electric" ? "💚 Más baratas" : "💚 Más baratas" },
              { key: "expensive", label: fuelKey === "electric" ? "⚡ Más rápida" : "🔴 Más caras" },
              { key: "brands", label: `⭐ Marcas${preferredBrands.length ? ` (${preferredBrands.length})` : ""}` }].
              map((t) =>
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                flex: 1, padding: "8px 4px",
                background: tab === t.key ? fuelKey === "electric" ? "#22c55e" : C.accent : C.surface,
                color: tab === t.key ? "#111" : C.textMid,
                border: `1.5px solid ${tab === t.key ? fuelKey === "electric" ? "#22c55e" : C.accent : C.border}`,
                borderRadius: 10, cursor: "pointer",
                fontSize: 11, fontWeight: 600
              }}>
                    {t.label}
                  </button>
              )}
              </div>

              {tab === "brands" &&
            <div style={{ marginBottom: 14 }}>
                  <button onClick={() => setShowBrandPicker((p) => !p)} style={{
                width: "100%", padding: "10px",
                background: C.surfaceAlt, border: `1px solid ${C.border}`,
                borderRadius: 10, cursor: "pointer",
                fontSize: 13, fontWeight: 600, color: C.textMid,
                marginBottom: showBrandPicker ? 8 : 0
              }}>
                    {showBrandPicker ? "▲ Cerrar selector" : "⚙️ Seleccionar marcas favoritas"}
                  </button>
                  {showBrandPicker &&
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12 }}>
                      <input
                  placeholder="Buscar marca..."
                  value={brandSearch}
                  onChange={(e) => setBrandSearch(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 10, fontSize: 13, outline: "none", fontFamily: "Inter, sans-serif", background: C.surfaceAlt, color: C.text }} />
                
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {filteredBrands.map((b) =>
                  <button key={b} onClick={() => saveBrands(preferredBrands.includes(b) ? preferredBrands.filter((x) => x !== b) : [...preferredBrands, b])} style={{
                    background: preferredBrands.includes(b) ? C.accent : C.surfaceAlt,
                    color: preferredBrands.includes(b) ? "#fff" : C.textMid,
                    border: `1.5px solid ${preferredBrands.includes(b) ? C.accent : C.border}`,
                    borderRadius: 20, padding: "5px 12px",
                    cursor: "pointer", fontSize: 12, fontWeight: 600
                  }}>
                            {b}
                          </button>
                  )}
                      </div>
                    </div>
              }
                </div>
            }

              {fuelKey === "electric" ?
            <div>
                  {chargersLoading &&
              <div style={{ textAlign: "center", color: C.textMuted, padding: "32px 0", fontSize: 14 }}>⏳ Buscando cargadores...</div>
              }
                  {!chargersLoading && chargers.length === 0 &&
              <div style={{ textAlign: "center", color: C.textMuted, padding: "32px 0", fontSize: 14 }}>No hay cargadores en este radio ⚡</div>
              }
                  {!chargersLoading && tab === "brands" && preferredBrands.length === 0 && chargers.length > 0 &&
              <div style={{ textAlign: "center", color: C.textMuted, padding: "32px 0", fontSize: 14 }}>Selecciona tus marcas favoritas arriba ⭐</div>
              }
                  {!chargersLoading && activeChargers.map((c, i) => {
                const conn = c.Connections?.[0];
                const power = conn?.PowerKW ? `${conn.PowerKW} kW` : null;
                const connType = conn?.ConnectionType?.Title || null;
                const operator = c.OperatorInfo?.Title || c.AddressInfo?.Title || "Operador desconocido";
                const stationName = c.AddressInfo?.Title || "";
                const address = c.AddressInfo?.AddressLine1 || "";
                const town = c.AddressInfo?.Town || "";
                const dist = c.AddressInfo?.Distance;
                const usageCost = c.UsageCost ? c.UsageCost.split("/")[0].trim() : null;
                const statusId = c.StatusType?.ID;
                const isOk = statusId === 50 || statusId === 0 || statusId == null;
                const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${c.AddressInfo?.Latitude},${c.AddressInfo?.Longitude}`;
                const appleMapsUrl = `maps://maps.apple.com/?daddr=${c.AddressInfo?.Latitude},${c.AddressInfo?.Longitude}&dirflg=d`;
                return (
                  <div key={c.ID || i} style={{
                   background: fuelKey === "electric" && tab === "cheap" && i === 0 ? C.highlight : C.surface, 
                   border: `1.5px solid ${fuelKey === "electric" && tab === "cheap" && i === 0 ? C.highlightBorder : C.border}`,
                   borderRadius: 14, padding: "12px 14px", marginBottom: 10,
                   display: "flex", alignItems: "center", gap: 12,
                   boxShadow: fuelKey === "electric" && tab === "cheap" && i === 0 ? `0 4px 16px rgba(240,195,15,0.2)` : C.shadow,
                   animation: `fadeInUp 0.3s ease both`,
                   animationDelay: `${i * 0.05}s`
                  }}>
                        {/* Avatar — stesso stile di BrandAvatar ma verde ⚡ */}
                        <div style={{
                      width: 42, height: 42, borderRadius: "50%",
                      background: "#22c55e", color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 800, fontSize: 18, flexShrink: 0,
                      boxShadow: "0 2px 8px rgba(34,197,94,0.4)"
                    }}>⚡</div>

                        {/* Contenuto centrale */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 700, fontSize: 14, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                              {operator}
                            </span>
                            {fuelKey === "electric" && tab === "cheap" && i < 3 &&
                            <span style={{
                          background: i === 0 ? C.accentLight : C.surfaceAlt,
                          color: i === 0 ? C.accent : C.textMid,
                          fontSize: 11, fontWeight: 700,
                          borderRadius: 20, padding: "2px 8px"
                        }}>
                              {i === 0 ? "🥇 Más barata" : i === 1 ? "🥈" : "🥉"}
                            </span>
                            }
                            <span style={{
                          background: isOk ? "#dcfce7" : "#fee2e2",
                          color: isOk ? "#16a34a" : "#dc2626",
                          fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "2px 7px"
                        }}>{isOk ? "Operativa" : "Fuera servicio"}</span>
                          </div>
                          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {address}{town ? `, ${town}` : ""}
                          </div>
                          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>
                            📍 {dist != null ? `${dist.toFixed(1)} km` : "—"}
                          </div>
                          <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap", maxWidth: "100%" }}>
                            {connType && <span style={{ background: C.surfaceAlt, color: C.textMid, fontSize: 10, fontWeight: 600, borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>{connType}</span>}
                            {power && <span style={{ background: "#1a3a2a", color: "#22c55e", fontSize: 10, fontWeight: 700, borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>{power}</span>}
                          </div>
                        </div>

                        {/* Destra: usageCost (come prezzo) + pulsanti mappa */}
                         <div style={{ textAlign: "right", flexShrink: 0, alignSelf: "flex-start", minWidth: 110 }}>
                           {usageCost ?
                        <div style={{ fontWeight: 800, fontSize: 20, color: C.accent, marginBottom: 5, textAlign: "right" }}>
                               {usageCost}
                             </div> :

                        <span style={{ color: C.textMuted, fontSize: 13, display: "block", marginBottom: 5, textAlign: "right" }}>N/D</span>
                        }
                           <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
                           {isAppleDevice &&
                          <a href={appleMapsUrl} style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                          background: C.blue, color: "#fff",
                          padding: "4px 8px", borderRadius: 8,
                          fontSize: 10, textDecoration: "none", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                          }}>
                               <svg width="10" height="10" viewBox="0 0 814 1000" fill="white" xmlns="http://www.w3.org/2000/svg">
                                 <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105.5-57.8-155.5-127.4C46 523 0 443.7 0 368.8c0-170.2 111.4-260.1 220.9-260.1 75.5 0 138.4 50 185.3 50 44.9 0 115.1-52.5 199.1-52.5zM480.3 49.4c18.4-21.4 32.1-51.6 32.1-81.9 0-4.2-.3-8.4-.9-11.7-30.3 1.2-66.1 20.2-87.8 44.4-16.5 18.4-31.8 48.9-31.8 79.6 0 4.5.6 9 1 10.5 1.9.3 5.2.6 8.4.6 27.4 0 60.1-18.1 79-41.5z" />
                               </svg>
                               Maps
                             </a>
                          }
                           <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                          background: C.blue, color: "#fff",
                          padding: "4px 8px", borderRadius: 8,
                          fontSize: 10, textDecoration: "none", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                          }}>
                             <svg width="10" height="10" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                               <path fill="#4285F4" d="M24 4C13 4 4 13 4 24s9 20 20 20 20-9 20-20S35 4 24 4z" />
                               <path fill="#34A853" d="M15 24c0-5 4-9 9-9s9 4 9 9-4 9-9 9-9-4-9-9z" />
                               <path fill="#FBBC05" d="M24 15c-5 0-9 4-9 9h18c0-5-4-9-9-9z" />
                               <path fill="#EA4335" d="M24 33c5 0 9-4 9-9H15c0 5 4 9 9 9z" />
                             </svg>
                             Maps
                           </a>
                          </div>
                        </div>
                      </div>);

              })}
                </div> :
            activeList.length === 0 ?
            <div style={{ textAlign: "center", color: C.textMuted, padding: "32px 0", fontSize: 14 }}>
                  {tab === "brands" && preferredBrands.length === 0 ?
              "Selecciona tus marcas favoritas arriba ⭐" :
              "No hay gasolineras en este radio 📍"}
                </div> :

            activeList.map((s, i) =>
            <StationCard key={s.id || i} station={s} fuelKey={fuelKey} rank={i + 1} index={i} />
            )
            }

              {(fuelKey === "electric" ? activeChargers.length > 0 && !chargersLoading : activeList.length > 0) &&
            <div style={{ marginTop: 24, marginBottom: 8, textAlign: "center" }}>
                  <a
                href="mailto:simone@peekhuboo.com"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  color: "#6b7280", fontSize: 13, fontWeight: 500,
                  textDecoration: "none", borderBottom: "1px solid #d1d5db", paddingBottom: 2
                }}>
                
                    💬 Deja tu opinión
                  </a>
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10, fontWeight: 500 }}>
                      ¿Has ahorrado hoy con GasRadar?
                    </div>
                    <a
                  href="https://ko-fi.com/gasradar"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    background: "#FF5E5B", color: "#ffffff",
                    fontWeight: 700, fontSize: 14, borderRadius: 12,
                    padding: "10px 22px", textDecoration: "none",
                    boxShadow: "0 2px 12px rgba(255,94,91,0.35)"
                  }}>
                  
                      <img src="https://storage.ko-fi.com/cdn/cup-border.png" alt="Ko-fi" style={{ width: 20, height: 20 }} />
                      Invítame un café
                    </a>
                  </div>
                  {totalVisits !== null &&
              <div style={{ marginTop: 20, fontSize: 11, color: "#9ca3af", fontWeight: 400 }}>
                      ⛽ GasRadar ha sido usado {totalVisits.toLocaleString("es-ES")} veces
                    </div>
              }
                </div>
            }
            </>
          }

        </div>
      </div>
    </>);

}