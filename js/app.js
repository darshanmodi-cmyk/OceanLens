import * as maplibregl from "https://unpkg.com/maplibre-gl@6.7.0/dist/maplibre-gl.mjs";

const DOMAIN = { minLon: 45, maxLon: 105, minLat: 5, maxLat: 30 };
const DEPTHS = Array.from({ length: 2001 }, (_, i) => i);

// ======================================
// REAL-TIME 4-YEAR DATE RANGE
// ======================================

const TODAY = new Date();

const DATE_END = new Date(
  Date.UTC(
    TODAY.getUTCFullYear(),
    TODAY.getUTCMonth(),
    TODAY.getUTCDate()
  )
);

const DATE_START = new Date(DATE_END);

DATE_START.setUTCFullYear(
  DATE_START.getUTCFullYear() - 4
);

const DAY_MS = 24 * 60 * 60 * 1000;

const TOTAL_DAYS = Math.floor(
  (DATE_END - DATE_START) / DAY_MS
);

let selectedDepth = 0;
let dayIndex = TOTAL_DAYS;
let selectedPoint = null;

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function dateAt(i) {
  const d = new Date(DATE_START);

  d.setUTCDate(
    d.getUTCDate() + i
  );

  return d;
}
function fmtDate(d) { return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).toUpperCase() }
function buildDateTimeline() {

  const slider = $("dateSlider");
  const ticks = document.querySelector(".date-ticks");
  const months = document.querySelector(".date-months");

  if (!slider || !ticks || !months) return;

  // Configure slider
  slider.min = 0;
  slider.max = TOTAL_DAYS;
  slider.step = 1;
  slider.value = TOTAL_DAYS;

  // Clear existing labels
  ticks.innerHTML = "";
  months.innerHTML = "";

  // ==================================
  // YEAR LABELS
  // ==================================

  const startYear = DATE_START.getUTCFullYear();
  const endYear = DATE_END.getUTCFullYear();

  for (
    let year = startYear;
    year <= endYear;
    year++
  ) {

    const date = new Date(
      Date.UTC(year, 0, 1)
    );

    if (
      date < DATE_START ||
      date > DATE_END
    ) {
      continue;
    }

    const index = Math.floor(
      (date - DATE_START) / DAY_MS
    );

    const percentage =
      (index / TOTAL_DAYS) * 100;

    const label =
      document.createElement("span");

    label.textContent = year;

    label.style.position = "absolute";
    label.style.left = `${percentage}%`;
    label.style.transform =
      "translateX(-50%)";

    ticks.appendChild(label);
  }

  // ==================================
  // MONTH LABELS
  // ==================================

  for (
    let date = new Date(DATE_START);
    date <= DATE_END;
    date.setUTCMonth(
      date.getUTCMonth() + 1
    )
  ) {

    // Only show Apr, Jul and Oct
    const month = date.getUTCMonth();

    if (![3, 6, 9].includes(month)) {
      continue;
    }

    const index = Math.floor(
      (date - DATE_START) / DAY_MS
    );

    const percentage =
      (index / TOTAL_DAYS) * 100;

    const label =
      document.createElement("span");

    label.textContent =
      date.toLocaleDateString(
        "en-GB",
        {
          month: "short",
          timeZone: "UTC"
        }
      ).toUpperCase();

    label.style.position = "absolute";
    label.style.left = `${percentage}%`;
    label.style.transform =
      "translateX(-50%)";

    months.appendChild(label);
  }
}
function fieldTemp(lon, lat, depth, day) {
  const seasonal = .9 * Math.sin((day / 365.25) * Math.PI * 2);
  const spatial = 2.4 * Math.sin((lon - 45) / 60 * Math.PI * 1.7) + 1.8 * Math.cos((lat - 5) / 25 * Math.PI * 1.4);
  const thermocline = -.018 * depth - 2.8 * (1 - Math.exp(-depth / 120));
  return clamp(28 + spatial + seasonal + thermocline, 5.5, 32);
}

function tempColor(t) {
  const stops = [[8, [18, 42, 140]], [12, [29, 139, 210]], [16, [47, 210, 202]], [20, [164, 223, 101]], [24, [245, 211, 78]], [28, [237, 141, 57]], [32, [215, 68, 50]]];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t <= stops[i + 1][0]) {
      const [a, ca] = stops[i], [b, cb] = stops[i + 1], f = (t - a) / (b - a);
      return ca.map((x, j) => Math.round(x + (cb[j] - x) * f));
    }
  }
  return [215, 68, 50];
}

/*
  IMPORTANT STABILITY CHANGE:
  The temperature field is rendered to a tiny 240 x 100 canvas
  instead of creating ~24,000 GeoJSON polygons. This keeps the
  browser responsive and avoids a long "BUILDING OCEAN FIELD" phase.
*/
function makeTemperatureCanvas() {

  const w = 240;
  const h = 100;

  const canvas = document.createElement("canvas");

  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");

  const img = ctx.createImageData(w, h);

  for (let y = 0; y < h; y++) {

    const lat =
      DOMAIN.maxLat -
      (y + 0.5) *
      (DOMAIN.maxLat - DOMAIN.minLat) /
      h;

    for (let x = 0; x < w; x++) {

      const lon =
        DOMAIN.minLon +
        (x + 0.5) *
        (DOMAIN.maxLon - DOMAIN.minLon) /
        w;

      const p = (y * w + x) * 4;

      const [r, g, b] =
        tempColor(
          fieldTemp(
            lon,
            lat,
            selectedDepth,
            dayIndex
          )
        );

      img.data[p] = r;
      img.data[p + 1] = g;
      img.data[p + 2] = b;

      // Fully visible temperature
      img.data[p + 3] = 214;
    }
  }

  ctx.putImageData(img, 0, 0);

  return canvas;
}
function fieldImage() { return makeTemperatureCanvas().toDataURL("image/png") }

function addTemperature() {

  const coordinates = [
    [DOMAIN.minLon, DOMAIN.maxLat],
    [DOMAIN.maxLon, DOMAIN.maxLat],
    [DOMAIN.maxLon, DOMAIN.minLat],
    [DOMAIN.minLon, DOMAIN.minLat]
  ];

  // If temperature layer already exists,
  // DO NOT remove/recreate it.
  if (map.getSource("temperature")) {

    const source = map.getSource("temperature");

    source.updateImage({
      url: fieldImage(),
      coordinates
    });

    return;
  }

  // Create the temperature source only once.
  map.addSource("temperature", {
    type: "image",
    url: fieldImage(),
    coordinates
  });

  // Create the layer only once.
  map.addLayer({
    id: "temperature",
    type: "raster",
    source: "temperature",

    paint: {
      "raster-opacity": 0.82,
      "raster-fade-duration": 0
    }
  });
}
function addLandMask() {

  // Remove old land mask if it exists
  if (map.getLayer("land-mask")) {
    map.removeLayer("land-mask");
  }

  if (map.getSource("land-mask")) {
    map.removeSource("land-mask");
  }

  // Real geographic land geometry
  map.addSource("land-mask", {
    type: "geojson",
    data: "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@ca96624a/geojson/ne_50m_land.geojson"
  });

  // Add land AFTER temperature.
  // Therefore land will sit ABOVE the temperature raster.
  map.addLayer({
    id: "land-mask",
    type: "fill",
    source: "land-mask",

    paint: {
      "fill-color": "#101a1f",
      "fill-opacity": 1
    }
  });

  /*
   * The land mask is now above temperature.
   *
   * Move map roads and labels above the land mask
   * so they remain visible.
   */
  const layers = map.getStyle().layers || [];

  for (const layer of layers) {

    if (
      layer.id !== "land-mask" &&
      (
        layer.type === "line" ||
        layer.type === "symbol"
      )
    ) {
      try {
        map.moveLayer(layer.id);
      } catch (err) {
        console.warn("Could not move layer:", layer.id);
      }
    }
  }
}


function addDomainFrame() {
  const frame = {
    type: "Feature", geometry: {
      type: "Polygon", coordinates: [[
        [45, 5], [105, 5], [105, 30], [45, 30], [45, 5]
      ]]
    }
  };
  map.addSource("domain-frame", { type: "geojson", data: frame });
  map.addLayer({
    id: "domain-frame", type: "line", source: "domain-frame", paint: {
      "line-color": "#56cbd2", "line-opacity": .38, "line-width": 1
    }
  });
}

function addArgo() {
  const pts = [[67, 13], [72, 19], [78, 10], [84, 16], [88, 22], [61, 20], [94, 14], [73, 26], [56, 16], [82, 27]];
  const features = pts.map(([lon, lat], i) => ({
    type: "Feature", properties: { id: `ARGO-${2400 + i}` },
    geometry: { type: "Point", coordinates: [lon, lat] }
  }));
  map.addSource("argo", { type: "geojson", data: { type: "FeatureCollection", features } });
  map.addLayer({
    id: "argo", type: "circle", source: "argo",
    paint: { "circle-radius": 5, "circle-color": "#f4bd63", "circle-stroke-color": "#071016", "circle-stroke-width": 1.5 }
  });
}

function addVectors() {
  const feats = [];
  for (let lat = 8; lat <= 27; lat += 3)for (let lon = 50; lon <= 100; lon += 4) {
    const u = Math.cos(lat * .3), v = Math.sin(lon * .2);
    feats.push({ type: "Feature", geometry: { type: "LineString", coordinates: [[lon, lat], [lon + u * .9, lat + v * .7]] } });
  }
  map.addSource("currents", { type: "geojson", data: { type: "FeatureCollection", features: feats } });
  map.addLayer({ id: "currents", type: "line", source: "currents", layout: { visibility: "none" }, paint: { "line-color": "#63d6a6", "line-width": 1.5 } });
  map.addSource("winds", {
    type: "geojson", data: {
      type: "FeatureCollection", features: feats.map(f => ({
        type: "Feature", geometry: { type: "LineString", coordinates: f.geometry.coordinates.map(([x, y]) => [x + .3, y + .3]) }
      }))
    }
  });
  map.addLayer({ id: "winds", type: "line", source: "winds", layout: { visibility: "none" }, paint: { "line-color": "#b58df1", "line-width": 1 } });
}

function addGrid() {
  const fs = [];
  for (let lon = DOMAIN.minLon; lon <= DOMAIN.maxLon; lon += .25)
    fs.push({ type: "Feature", geometry: { type: "LineString", coordinates: [[lon, DOMAIN.minLat], [lon, DOMAIN.maxLat]] } });
  for (let lat = DOMAIN.minLat; lat <= DOMAIN.maxLat; lat += .25)
    fs.push({ type: "Feature", geometry: { type: "LineString", coordinates: [[DOMAIN.minLon, lat], [DOMAIN.maxLon, lat]] } });
  map.addSource("grid", { type: "geojson", data: { type: "FeatureCollection", features: fs } });
  map.addLayer({
    id: "grid",
    type: "line",
    source: "grid",
    layout: {
      visibility: "visible"
    },
    paint: {
      "line-color": "#8aa0a6",
      "line-opacity": 0.25,
      "line-width": 0.5
    }
  });
}

function show(id, on) { if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none") }

function updateLabels() {
  $("depthLabel").textContent = `${selectedDepth} m`;

  $("depthReadout").textContent = `${selectedDepth} m`;

  const d = fmtDate(dateAt(dayIndex));

  $("dateLabel").textContent = d;


  $("dateStart").textContent =
    fmtDate(DATE_START);
}
function updateDepthKnob() {

  const slider = $("depthSlider");
  const knob = $("depthKnob");
  const track = document.querySelector(".depth-track-wrap");

  if (!slider || !knob || !track) return;

  const min = Number(slider.min);
  const max = Number(slider.max);
  const value = Number(slider.value);

  const rect = track.getBoundingClientRect();

  // Same usable area used by the depth selector
  const BOTTOM_GAP = 16;

  const usableHeight =
    rect.height - BOTTOM_GAP;

  // Convert actual depth to position
  const percentage =
    (value - min) / (max - min);

  const y =
    percentage * usableHeight;

  knob.style.top = `${y}px`;

  updateDepthLabels();
}
function updateDepthLabels() {

  const track =
    document.querySelector(".depth-track-wrap");

  const labels =
    document.querySelectorAll(".depth-values span");

  if (!track || !labels.length) return;

  const rect =
    track.getBoundingClientRect();

  const BOTTOM_GAP = 16;

  const usableHeight =
    rect.height - BOTTOM_GAP;

  labels.forEach(label => {

    const depth =
      Number(label.textContent);

    const percentage =
      depth / 2000;

    const y =
      percentage * usableHeight;

    label.style.position = "absolute";
    label.style.top = `${y}px`;
    label.style.transform =
      "translateY(-50%)";
  });
}
function updateField() {

  // Rebuild the temperature layer
  addTemperature();

  updateLabels();

  if (selectedPoint) {
    updateInspector(selectedPoint.lng, selectedPoint.lat);
  }
}

async function updateInspector(lon, lat) {
  try {
    const res = await fetch(`/api/profile?lat=${lat}&lon=${lon}&depth=${selectedDepth}`);
    const data = await res.json();
    
    // Stop if the user clicked on land and close the panel
    if (data.detail || data.error) {
      console.warn("No valid ocean data:", data);
      $("inspector").classList.remove("open");
      return;
    }

    // Ensure the panel slides up when valid ocean is clicked
    $("inspector").classList.add("open");

    // Update Sidebar Metrics
    $("pLat").textContent = data.lat.toFixed(3) + "°";
    $("pLon").textContent = data.lon.toFixed(3) + "°";
    $("pGrid").textContent = data.gridCell;
    $("pTemp").textContent = data.aiTemp.toFixed(2) + " °C";
    $("pArgo").textContent = data.argoTemp.toFixed(2) + " °C";
    $("pDiff").textContent = (data.diff >= 0 ? "+" : "") + data.diff.toFixed(2) + " °C";

    // Tactical Anomaly Flag / Title Update
    if (data.anomaly) {
      $("pointTitle").textContent = `${data.lat.toFixed(3)}°N · ${data.lon.toFixed(3)}°E ⚠️ [ANOMALY DETECTED]`;
      $("pointTitle").style.color = "#ff4d4d";
    } else {
      $("pointTitle").textContent = `${data.lat.toFixed(3)}°N · ${data.lon.toFixed(3)}°E`;
      $("pointTitle").style.color = "#fff";
    }

    // Update INCOIS Validation Scores
    $("pRmse").textContent = data.rmse.toFixed(2) + " °C";
    $("pBias").textContent = (data.bias >= 0 ? "+" : "") + data.bias.toFixed(2) + " °C";
    $("pCorrelation").textContent = data.correlation.toFixed(3);

    // Render Real 14-Depth Profile Chart
    if (window.Plotly) {
      Plotly.react(
        "profileChart",
        [
          {
            x: data.aiProfile,
            y: data.depths,
            name: "AI reconstruction",
            mode: "lines",
            line: { width: 2, color: "#61d9df" }
          },
          {
            x: data.argoProfile,
            y: data.depths,
            name: "ARGO",
            mode: "lines+markers",
            line: { width: 1.5, dash: "dot", color: "#f4bd63" }
          }
        ],
        {
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
          font: { color: "#8faab1", size: 9 },
          margin: { l: 45, r: 15, t: 5, b: 30 },
          xaxis: { title: "Temperature °C", gridcolor: "#1b343b" },
          yaxis: { title: "Depth m", autorange: "reversed", gridcolor: "#1b343b" },
          legend: { orientation: "h", y: 1.12, x: 0 },
          hovermode: "closest"
        },
        { displayModeBar: false, responsive: true }
      );
    }
  } catch (err) {
    console.error("Profile query failed:", err);
  }
}

/* No remote basemap style is used here.
   The MapLibre style is entirely inline, so the map can initialize
   even if a tile/style provider is unavailable. */
const MAP_STYLE = "https://tiles.openfreemap.org/styles/dark";

let mapReady = false;
const map = new maplibregl.Map({
  container: "map",
  style: MAP_STYLE,

  // Center of the North Indian Ocean study area
  center: [75, 17.5],

  // Start already zoomed into the study region
  zoom: 3.4,

  // Prevent zooming too far out
  minZoom: 3.0,

  // Allow closer inspection
  maxZoom: 8,

  attributionControl: true,

  // Restrict map movement to the problem-statement region
  maxBounds: [
    [45, 5],    // Southwest: 45°E, 5°N
    [105, 30]   // Northeast: 105°E, 30°N
  ]
});
map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");

map.on("load", () => {
  try {

    // Ocean temperature field
    addTemperature();
    addLandMask()
    // Study-area boundary
    addDomainFrame();

    // ARGO observations
    addArgo();

    // Current and wind layers
    addVectors();

    // 0.25° scientific grid
    addGrid();

    // Focus on North Indian Ocean
    map.fitBounds(
      [
        [DOMAIN.minLon, DOMAIN.minLat],
        [DOMAIN.maxLon, DOMAIN.maxLat]
      ],
      {
        padding: {
          top: 70,
          bottom: 100,
          left: 90,
          right: 80
        },
        duration: 0,
        maxZoom: 5
      }
    );

    mapReady = true;

    $("loading").style.display = "none";

  } catch (err) {

    console.error("OceanEmbed map error:", err);

    $("loading").innerHTML = `
      <div class="load-error">
        <strong>OCEAN FIELD ERROR</strong>
        <span>${err.message}</span>
      </div>
    `;
  }
});

map.on("mousemove", e => $("cursorReadout").textContent = `LAT ${e.lngLat.lat.toFixed(3)} · LON ${e.lngLat.lng.toFixed(3)}`);

function selectPoint(lng, lat) {

    if (
        lng < DOMAIN.minLon ||
        lng > DOMAIN.maxLon ||
        lat < DOMAIN.minLat ||
        lat > DOMAIN.maxLat
    ) {
        return;
    }

    selectedPoint = {
        lng,
        lat
    };

    const data = {
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: [lng, lat]
        }
    };

    if (map.getSource("selected")) {

        map.getSource("selected").setData(data);

    } else {

        map.addSource("selected", {
            type: "geojson",
            data
        });

        map.addLayer({
            id: "selected",
            type: "circle",
            source: "selected",

            paint: {
                "circle-radius": 7,
                "circle-color": "transparent",
                "circle-stroke-color": "#fff",
                "circle-stroke-width": 2
            }
        });
    }

    updateInspector(lng, lat);

    $("inspector").classList.add("open");
}


map.on("click", e => {

    const { lng, lat } = e.lngLat;

    selectPoint(lng, lat);

});

// ===============================
// CUSTOM DEPTH CONTROL
// ===============================

const depthTrack = document.querySelector(".depth-track-wrap");
const depthSlider = $("depthSlider");

let draggingDepth = false;

function setDepthFromMouse(event) {

  if (!depthTrack || !depthSlider) return;

  const rect =
    depthTrack.getBoundingClientRect();

  const BOTTOM_GAP = 16;

  // Usable part of the depth slider
  const usableHeight =
    Math.max(1, rect.height - BOTTOM_GAP);

  // Mouse position inside the track
  let y =
    event.clientY - rect.top;

  // Keep mouse inside usable range
  y = Math.max(
    0,
    Math.min(y, usableHeight)
  );

  // Convert position to 0–1
  const percentage =
    y / usableHeight;

  // Convert to depth
  const depth =
    Math.round(percentage * 2000);

  // Update slider
  depthSlider.value = depth;

  // Update selected depth
  selectedDepth = depth;

  // Move visible knob
  updateDepthKnob();

  // Update temperature
  updateField();
}


// Click anywhere on the vertical depth bar
depthTrack.addEventListener("mousedown", event => {

  draggingDepth = true;

  setDepthFromMouse(event);

  document.body.style.userSelect = "none";
});


// Drag the depth knob
document.addEventListener("mousemove", event => {

  if (!draggingDepth) return;

  setDepthFromMouse(event);
});


// Release mouse
document.addEventListener("mouseup", () => {

  draggingDepth = false;

  document.body.style.userSelect = "";
});


// Initial position
// Initial depth position
updateDepthKnob();

// Build the 4-year date timeline
buildDateTimeline();

// Start the date slider at today
dayIndex = TOTAL_DAYS;
$("dateSlider").value = dayIndex;

updateLabels();

// ==================================
// DATE POINTER + TRIANGLE POSITION
// ==================================

const dateSlider = $("dateSlider");
const dateHoverDate = $("dateHoverDate");
const dateTrack = document.querySelector(".date-track");


// ----------------------------------
// Position date box exactly under
// the triangle slider pointer
// ----------------------------------

function updateDateBoxFromValue() {

  if (!dateSlider || !dateHoverDate || !dateTrack) return;

  const sliderRect =
    dateSlider.getBoundingClientRect();

  const trackRect =
    dateTrack.getBoundingClientRect();

  const min =
    Number(dateSlider.min);

  const max =
    Number(dateSlider.max);

  const value =
    Number(dateSlider.value);

  const percentage =
    (value - min) / (max - min);


  // Triangle is 16px wide
  // because it has 8px + 8px borders.
  const thumbWidth = 16;

  // Real usable slider width
  const usableWidth =
    sliderRect.width - thumbWidth;


  // Exact center of the triangle
  const thumbX =
    (thumbWidth / 2) +
    percentage * usableWidth;


  // Convert slider position
  // into .date-track coordinates
  const relativeX =
    (sliderRect.left - trackRect.left) +
    thumbX;


  dateHoverDate.style.left =
    `${relativeX}px`;


  // Show the date represented by the triangle
  dateHoverDate.textContent =
    fmtDate(dateAt(value));

  dateHoverDate.classList.add("visible");
}


// ----------------------------------
// When slider moves
// ----------------------------------

dateSlider.addEventListener(
  "input",
  event => {

    dayIndex =
      Number(event.target.value);

    updateField();

    updateDateBoxFromValue();
  }
);


// ----------------------------------
// Show box when pointer enters
// ----------------------------------

dateSlider.addEventListener(
  "pointerenter",
  () => {

    updateDateBoxFromValue();
  }
);


// ----------------------------------
// Hide box when pointer leaves
// ----------------------------------

dateSlider.addEventListener(
  "pointerleave",
  () => {

    dateHoverDate.classList.remove("visible");
  }
);


// ----------------------------------
// Show while dragging
// ----------------------------------

dateSlider.addEventListener(
  "pointerdown",
  () => {

    updateDateBoxFromValue();
  }
);


// ----------------------------------
// Hide after releasing
// ----------------------------------

dateSlider.addEventListener(
  "pointerup",
  () => {

    dateHoverDate.classList.remove("visible");
  }
);

dateSlider.addEventListener(
  "pointercancel",
  () => {

    dateHoverDate.classList.remove("visible");
  }
);


// ----------------------------------



$("prevDay").onclick = () => {

  dayIndex = clamp(
    dayIndex - 1,
    0,
    TOTAL_DAYS
  );

  $("dateSlider").value = dayIndex;

  updateField();
};


$("nextDay").onclick = () => {

  dayIndex = clamp(
    dayIndex + 1,
    0,
    TOTAL_DAYS
  );

  $("dateSlider").value = dayIndex;

  updateField();
};
$("opacity").oninput = e => {
  $("opacityValue").textContent = e.target.value + "%";
  if (map.getLayer("temperature")) map.setPaintProperty("temperature", "raster-opacity", +e.target.value / 100);
};
$("tempToggle").onchange = e => show("temperature", e.target.checked);
$("argoToggle").onchange = e => show("argo", e.target.checked);
$("currentToggle").onchange = e => show("currents", e.target.checked);
$("windToggle").onchange = e => show("winds", e.target.checked);
$("gridToggle").onchange = e => show("grid", e.target.checked);
$("closeInspector").onclick = () => $("inspector").classList.remove("open");
$("infoBtn").onclick = () => $("infoModal").classList.remove("hidden");
$("modalClose").onclick = () => $("infoModal").classList.add("hidden");
$("fullscreenBtn").onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
$("panelToggle").onclick = () => {

  const panel = document.querySelector(".left-panel");
  const button = $("panelToggle");

  panel.classList.toggle("collapsed");

  button.textContent =
    panel.classList.contains("collapsed") ? "+" : "−";
};
// ==========================================
// POINT QUERY
// ==========================================

const pointQueryBtn = $("pointQueryBtn");
const pointQueryPanel = $("pointQueryPanel");
const closePointQuery = $("closePointQuery");

const queryLat = $("queryLat");
const queryLon = $("queryLon");
const queryDate = $("queryDate");
const queryDepth = $("queryDepth");

const goToPoint = $("goToPoint");
const queryError = $("queryError");


// ------------------------------------------
// OPEN QUERY PANEL
// ------------------------------------------

pointQueryBtn.addEventListener("click", () => {

    pointQueryPanel.classList.add("open");

});


// ------------------------------------------
// CLOSE QUERY PANEL
// ------------------------------------------

closePointQuery.addEventListener("click", () => {

    pointQueryPanel.classList.remove("open");

});


// ------------------------------------------
// SET DEFAULT DATE
// ------------------------------------------

function setDefaultQueryDate() {

    const year = DATE_END.getUTCFullYear();
    const month = String(DATE_END.getUTCMonth() + 1).padStart(2, "0");
    const day = String(DATE_END.getUTCDate()).padStart(2, "0");

    queryDate.value = `${year}-${month}-${day}`;

}

setDefaultQueryDate();


// ------------------------------------------
// GO TO POINT
// ------------------------------------------

goToPoint.addEventListener("click", () => {

    queryError.textContent = "";

    const lat = Number(queryLat.value);
    const lon = Number(queryLon.value);
    const depth = Number(queryDepth.value);
    const dateValue = queryDate.value;


    // ==============================
    // VALIDATE LATITUDE
    // ==============================

    if (
        !Number.isFinite(lat) ||
        lat < DOMAIN.minLat ||
        lat > DOMAIN.maxLat
    ) {

        queryError.textContent =
            "Latitude must be between 5°N and 30°N.";

        return;
    }


    // ==============================
    // VALIDATE LONGITUDE
    // ==============================

    if (
        !Number.isFinite(lon) ||
        lon < DOMAIN.minLon ||
        lon > DOMAIN.maxLon
    ) {

        queryError.textContent =
            "Longitude must be between 45°E and 105°E.";

        return;
    }


    // ==============================
    // VALIDATE DATE
    // ==============================

    if (!dateValue) {

        queryError.textContent =
            "Please select a date.";

        return;
    }


    // ==============================
    // VALIDATE DEPTH
    // ==============================

if (
    queryDepth.value !== "" &&
    (
        !Number.isFinite(depth) ||
        depth < 0 ||
        depth > 2000
    )
) {

    queryError.textContent =
        "Depth must be between 0 and 2000 m.";

    return;
}


    // ==============================
    // CONVERT DATE
    // ==============================

    const selectedDate = new Date(
        dateValue + "T00:00:00Z"
    );


    if (
        selectedDate < DATE_START ||
        selectedDate > DATE_END
    ) {

        queryError.textContent =
            "Date must be within the available 4-year range.";

        return;
    }


    // ==============================
    // CALCULATE DAY INDEX
    // ==============================

    const newDayIndex = Math.round(
        (selectedDate - DATE_START) / DAY_MS
    );


    // ==============================
    // UPDATE DATE SLIDER
    // ==============================

    dayIndex = clamp(
        newDayIndex,
        0,
        TOTAL_DAYS
    );

    const dateSlider = $("dateSlider");

    if (dateSlider) {

        dateSlider.value = dayIndex;

    }


    // ==============================
    // UPDATE DEPTH
    // ==============================

if (queryDepth.value !== "") {

    selectedDepth = depth;

    if (depthSlider) {

        depthSlider.value = depth;

        updateDepthKnob();

    }

}


    // ==============================
    // UPDATE MAP
    // ==============================

    map.flyTo({

        center: [lon, lat],

        zoom: Math.max(
            map.getZoom(),
            4
        ),

        duration: 1200

    });


    // ==============================
    // SELECT POINT
    // ==============================

    selectPoint(lon, lat);


    // ==============================
    // UPDATE OCEAN FIELD
    // ==============================

    updateField();


    // ==============================
    // CLOSE QUERY PANEL
    // ==============================

    pointQueryPanel.classList.remove("open");

});