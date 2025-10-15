import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Ensure default marker icons load in Vite/CRA without asset loader tweaks
// (Use Leaflet's CDN copies for simplicity)
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ---- Types ----
/** @typedef {{ id:string, lat:number, lng:number, title:string, notes:string, createdAt:number, meta?: {displayName?: string, city?: string, country?: string} }} Location */

const STORAGE_KEY = "cs465-places-v1";

export default function App() {
  const [locations, setLocations] = useState(/** @type {Location[]} */([]));
  const [isCollecting, setIsCollecting] = useState(true);
  const [showList, setShowList] = useState(true); // can reopen after Done
  const [draft, setDraft] = useState(null); // {lat, lng, title, notes}
  const [loadingMeta, setLoadingMeta] = useState(false);

  // Load from localStorage on first render
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.locations)) {
          setLocations(parsed.locations);
          setIsCollecting(parsed.isCollecting ?? false);
          setShowList(parsed.showList ?? false);
        }
      } catch {}
    }
  }, []);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ locations, isCollecting, showList })
    );
  }, [locations, isCollecting, showList]);

  const center = useMemo(() => ({ lat: 39.8283, lng: -98.5795 }), []); // USA centroid

  function MapClickCatcher() {
    useMapEvents({
      click: (e) => {
        if (!isCollecting) return; // only capture in collecting mode
        const { lat, lng } = e.latlng;
        setDraft({ lat, lng, title: "", notes: "" });
      },
    });
    return null;
  }

  async function enrichWithReverseGeocode(lat, lng) {
    try {
      setLoadingMeta(true);
      const url = new URL("https://nominatim.openstreetmap.org/reverse");
      url.searchParams.set("format", "json");
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lng));
      url.searchParams.set("zoom", "10");
      url.searchParams.set("addressdetails", "1");
      const res = await fetch(url.toString(), {
        headers: { "Accept-Language": "en", "User-Agent": "cs465-lab2-demo" },
      });
      const data = await res.json();
      const city = data?.address?.city || data?.address?.town || data?.address?.village || data?.address?.county;
      const country = data?.address?.country;
      return { displayName: data?.display_name, city, country };
    } catch (e) {
      console.warn("Reverse geocode failed", e);
      return {};
    } finally {
      setLoadingMeta(false);
    }
  }

  async function addDraftToLocations() {
    if (!draft) return;
    const meta = await enrichWithReverseGeocode(draft.lat, draft.lng);
    const newLoc = {
      id: crypto.randomUUID(),
      lat: draft.lat,
      lng: draft.lng,
      title: draft.title?.trim() || meta.city || "Untitled place",
      notes: draft.notes?.trim() || "",
      createdAt: Date.now(),
      meta,
    };
    setLocations((prev) => [newLoc, ...prev]);
    setDraft(null);
  }

  function deleteLocation(id) {
    setLocations((prev) => prev.filter((l) => l.id !== id));
  }

  function startEdit(id) {
    const loc = locations.find((l) => l.id === id);
    if (!loc) return;
    setDraft({ lat: loc.lat, lng: loc.lng, title: loc.title, notes: loc.notes, id: loc.id });
  }

  async function saveEdit() {
    if (!draft?.id) return;
    const meta = await enrichWithReverseGeocode(draft.lat, draft.lng);
    setLocations((prev) =>
      prev.map((l) =>
        l.id === draft.id
          ? { ...l, lat: draft.lat, lng: draft.lng, title: draft.title, notes: draft.notes, meta }
          : l
      )
    );
    setDraft(null);
  }

  function handleDone() {
    setIsCollecting(false);
    setShowList(false);
  }

  function handleReset() {
    if (!confirm("Clear the map and start over?")) return;
    setLocations([]);
    setIsCollecting(true);
    setShowList(true);
    setDraft(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  function downloadJSON() {
    const blob = new Blob([JSON.stringify(locations, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "places.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function onUploadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (Array.isArray(parsed)) {
          setLocations(parsed);
          setIsCollecting(false);
          setShowList(false);
        } else {
          alert("Invalid file format.");
        }
      } catch {
        alert("Could not parse JSON.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-4 py-3 border-b flex items-center justify-between">
        <h1 className="text-xl font-bold">Lab 2: Oh, the places you've been!</h1>
        <div className="flex gap-2 items-center">
          {isCollecting ? (
            <button className="px-3 py-1 rounded bg-black text-white" onClick={handleDone}>
              Done
            </button>
          ) : (
            <button
              className="px-3 py-1 rounded border"
              onClick={() => setShowList((s) => !s)}
              title="Reopen or hide the list"
            >
              {showList ? "Hide List" : "Show List"}
            </button>
          )}
          <button className="px-3 py-1 rounded border" onClick={handleReset}>Reset</button>
          <button className="px-3 py-1 rounded border" onClick={downloadJSON} title="Save places to a JSON file">
            Export JSON
          </button>
          <label className="px-3 py-1 rounded border cursor-pointer">
            Import JSON
            <input type="file" accept="application/json" className="hidden" onChange={onUploadFile} />
          </label>
        </div>
      </header>

      <main className="flex-1 grid md:grid-cols-3">
        {/* Map */}
        <section className="md:col-span-2 relative">
          <MapContainer
            center={[center.lat, center.lng]}
            zoom={4}
            style={{ height: "70vh", width: "100%" }}
            scrollWheelZoom
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            <MapClickCatcher />

            {locations.map((loc) => (
              <Marker key={loc.id} position={[loc.lat, loc.lng]}>
                <Popup>
                  <div className="space-y-1">
                    <h3 className="font-semibold">{loc.title}</h3>
                    {loc.meta?.city || loc.meta?.country ? (
                      <p className="text-sm opacity-80">
                        {loc.meta?.city ? `${loc.meta.city}, ` : ""}
                        {loc.meta?.country || ""}
                      </p>
                    ) : null}
                    {loc.notes && <p className="text-sm whitespace-pre-wrap">{loc.notes}</p>}
                    {loc.meta?.displayName && (
                      <details className="text-xs opacity-70">
                        <summary>OSM details</summary>
                        <p className="break-words">{loc.meta.displayName}</p>
                      </details>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button className="text-blue-600 text-sm underline" onClick={() => startEdit(loc.id)}>
                        Edit
                      </button>
                      <button className="text-red-600 text-sm underline" onClick={() => deleteLocation(loc.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Draft panel */}
          {draft && (
            <div className="absolute left-2 right-2 bottom-2 md:left-4 md:bottom-4 md:right-auto max-w-md bg-white/95 backdrop-blur p-3 rounded-2xl shadow-lg border">
              <h2 className="font-semibold mb-2 text-sm">{draft.id ? "Edit location" : "Add a location"}</h2>
              <p className="text-xs opacity-70 mb-2">
                {draft.lat.toFixed(4)}, {draft.lng.toFixed(4)} {loadingMeta ? " • looking up place…" : ""}
              </p>
              <div className="space-y-2">
                <input
                  className="w-full border rounded px-2 py-1"
                  placeholder="Title (e.g., Lived here 2019–2021)"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
                <textarea
                  className="w-full border rounded px-2 py-1"
                  placeholder="Notes (favorite restaurant, memory, etc.)"
                  rows={3}
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
                <div className="flex gap-2 justify-end">
                  <button className="px-3 py-1 rounded border" onClick={() => setDraft(null)}>
                    Cancel
                  </button>
                  {draft.id ? (
                    <button className="px-3 py-1 rounded bg-black text-white" onClick={saveEdit}>
                      Save
                    </button>
                  ) : (
                    <button className="px-3 py-1 rounded bg-black text-white" onClick={addDraftToLocations}>
                      Add
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* List */}
        {showList && (
          <aside className="border-l p-3 overflow-auto">
            <h2 className="font-semibold mb-2">{isCollecting ? "Places (click map to add)" : "Places"}</h2>
            {locations.length === 0 ? (
              <p className="text-sm opacity-70">No places yet. {isCollecting ? "Click on the map to start." : "Use Import JSON to load some."}</p>
            ) : (
              <ul className="space-y-2">
                {locations.map((loc) => (
                  <li key={loc.id} className="border rounded-lg p-2 flex justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm">{loc.title}</div>
                      <div className="text-xs opacity-70">
                        {loc.meta?.city ? `${loc.meta.city}, ` : ""}
                        {loc.meta?.country || ""}
                      </div>
                      {loc.notes && <div className="text-xs mt-1 line-clamp-2">{loc.notes}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="text-blue-600 text-xs underline" onClick={() => startEdit(loc.id)}>
                        Edit
                      </button>
                      <button className="text-red-600 text-xs underline" onClick={() => deleteLocation(loc.id)}>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}
      </main>

      <footer className="px-4 py-3 border-t text-xs opacity-70">
        Tiles © OpenStreetMap contributors • Built with React + Leaflet • No API keys required
      </footer>
    </div>
  );
}


