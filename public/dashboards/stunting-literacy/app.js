const MAPBOX_TOKEN =
  "pk.eyJ1IjoibWFyZ2FyaXRhcml2ZXJhIiwiYSI6IndwLWwtM3cifQ.gj37oGPLjnfI2-zr-b3P5w";

const PH_BOUNDS = [
  [114.2, 4.0],
  [128.5, 21.5],
];

const INITIAL_MAP_VIEW = {
  center: [122.2, 12.3],
  zoom: 4.35,
  bearing: 0,
  pitch: 0,
};

const CSV_URLS = {
  stunting: "./data/stunting_2008_regional.csv",
  literacy: "./data/literacy_2024_regional.csv",
  education: "./data/completion_2023_regional.csv",
};

const PANELS = {
  stunting: {
    container: "map-stunting",
    sourceId: "regions-stunting",
    layerId: "regions-stunting-fill",
    lineId: "regions-stunting-line",
    metric: "total_stunted_pct",
    label: "Under-five stunting",
    suffix: "%",
    direction: "high",
    sourceMetric: "total_stunted_pct",
    rankingTitle: "Top 5 highest stunting rates",
    colors: ["#ffd7d7", "#ff8f8f", "#ff3b30", "#c90000", "#660000"],
    stops: [24, 30, 36, 40],
    legend: ["<24", "24-<30", "30-<36", "36-<40", ">=40"],
  },
  education: {
    container: "map-education",
    sourceId: "regions-education",
    layerId: "regions-education-fill",
    lineId: "regions-education-line",
    metric: "senior_high_completion_rate",
    label: "Senior high completion",
    suffix: "%",
    direction: "low",
    sourceMetric: "senior_high_completion_rate",
    rankingTitle: "Lowest 5 senior high completion rates",
    colors: ["#6b2d00", "#c44a00", "#ff9d00", "#ffd45c", "#fff3b0"],
    stops: [62, 68, 74, 78],
    legend: ["<62", "62-<68", "68-<74", "74-<78", ">=78"],
  },
  literacy: {
    container: "map-literacy",
    sourceId: "regions-literacy",
    layerId: "regions-literacy-fill",
    lineId: "regions-literacy-line",
    metric: "functional_literacy_rate",
    label: "Functional literacy",
    suffix: "%",
    direction: "low",
    sourceMetric: "functional_literacy_rate",
    rankingTitle: "Lowest 5 functional literacy rates",
    colors: ["#061a5b", "#0050a8", "#1f9bd1", "#9bd7ef", "#edf8ff"],
    stops: [64, 68, 72, 76],
    legend: ["<64", "64-<68", "68-<72", "72-<76", ">=76"],
  },
};

const OLD_REGION_BY_NIR_PROVINCE = {
  "Negros Occidental": "Western Visayas",
  "Negros Oriental": "Central Visayas",
  Siquijor: "Central Visayas",
};

const CONCERN_LABELS = {
  1: "All regions",
  2: "Slight concern and above",
  3: "Moderate concern and above",
  4: "High concern and above",
  5: "Highest concern",
};

let maps = {};
let dataByPanel = {};
let indicatorConcernScores = new Map();
let concernThreshold = 1;
let selectedRegion = null;
let selectedRegionKey = null;
let regionalProfileOrder = "sequence";
let regionalProfilePattern = "all";

bootstrap().catch((error) => {
  console.error(error);
  document.querySelectorAll(".loading").forEach((el) => {
    el.textContent = "Map could not load.";
  });
});

async function bootstrap() {
  mapboxgl.accessToken = MAPBOX_TOKEN;
  const [regions, ...csvResults] = await Promise.all([
    fetchJson("./data/regional_simplified.geojson"),
    ...Object.entries(CSV_URLS).map(async ([key, url]) => [key, await fetchCsv(url)]),
  ]);

  dataByPanel = Object.fromEntries(csvResults);
  indicatorConcernScores = buildConcernScores();
  bindConcernControl();
  bindClearSelection();
  Object.entries(PANELS).forEach(([key, panel]) => {
    const enriched = enrichRegions(regions, key);
    renderLegend(key);
    renderRanking(key);
    createMap(key, panel, enriched);
  });
  renderRegionalProfileChart();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not fetch ${url}`);
  return response.json();
}

async function fetchCsv(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not fetch ${url}`);
  const text = await response.text();
  return parseCsv(text).map((row) => {
    const normalized = {};
    Object.entries(row).forEach(([key, value]) => {
      const numberValue = Number(value);
      normalized[key] = value !== "" && Number.isFinite(numberValue) ? numberValue : value;
    });
    normalized.region_key = normalizeRegion(row.region);
    return normalized;
  });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (cell || row.length) {
        row.push(cell);
        rows.push(row);
      }
      row = [];
      cell = "";
      if (char === "\r" && next === "\n") index += 1;
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [headers, ...dataRows] = rows;
  return dataRows.map((dataRow) =>
    Object.fromEntries(headers.map((header, index) => [header, dataRow[index] ?? ""]))
  );
}

function enrichRegions(regions, panelKey) {
  const panel = PANELS[panelKey];
  const dataLookup = new Map(dataByPanel[panelKey].map((row) => [row.region_key, row]));

  return {
    ...regions,
    features: regions.features.map((feature) => {
      const name = feature.properties.name || "";
      const provincePiece = feature.properties.province_piece;
      const lookupName = getLookupRegion(name, provincePiece, panelKey, feature);
      const row = dataLookup.get(normalizeRegion(lookupName));
      const value = row ? row[panel.sourceMetric] : null;
      const concern = Number.isFinite(value) ? scoreValue(value, panel.stops, panel.direction) : null;
      return {
        ...feature,
        properties: {
          ...feature.properties,
          panel_region: lookupName || name || "No region label",
          panel_region_key: normalizeRegion(lookupName),
          panel_value: Number.isFinite(value) ? value : null,
          panel_label: panel.label,
          panel_year: row?.year || row?.school_year || "",
          concern_level: Number.isFinite(concern) ? concern : null,
        },
      };
    }),
  };
}

function buildConcernScores() {
  const lookups = Object.fromEntries(
    Object.entries(PANELS).map(([key, panel]) => [
      key,
      new Map(dataByPanel[key].map((row) => [row.region_key, row])),
    ])
  );
  const scores = new Map();
  lookups.stunting.forEach((stuntingRow, regionKey) => {
    if (stuntingRow.region === "Philippines") return;
    const literacyRow = lookups.literacy.get(regionKey);
    const educationRow = lookups.education.get(regionKey);
    if (!literacyRow || !educationRow) return;

    const stuntingConcern = scoreValue(
      stuntingRow[PANELS.stunting.sourceMetric],
      PANELS.stunting.stops,
      "high"
    );
    const literacyConcern = scoreValue(
      literacyRow[PANELS.literacy.sourceMetric],
      PANELS.literacy.stops,
      "low"
    );
    const educationConcern = scoreValue(
      educationRow[PANELS.education.sourceMetric],
      PANELS.education.stops,
      "low"
    );
    scores.set(regionKey, {
      stunting: stuntingConcern,
      literacy: literacyConcern,
      education: educationConcern,
    });
  });
  return scores;
}

function scoreValue(value, stops, concernDirection) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const bin = 1 + stops.filter((stop) => numeric >= stop).length;
  return concernDirection === "high" ? bin : 6 - bin;
}

function getLookupRegion(name, provincePiece, panelKey, feature) {
  if (!name) {
    return isSuluArchipelagoFeature(feature) ? (panelKey === "stunting" ? "ARMM" : "BARMM") : "";
  }
  if ((panelKey === "stunting" || panelKey === "education") && name.includes("Negros Island")) {
    return OLD_REGION_BY_NIR_PROVINCE[provincePiece] || "";
  }
  if (name.includes("NCR")) return "National Capital Region";
  if (name.includes("CAR)") || name.includes("Cordillera")) return "CAR";
  if (name.includes("Ilocos")) return "Ilocos Region";
  if (name.includes("Cagayan Valley")) return "Cagayan Valley";
  if (name.includes("Central Luzon")) return "Central Luzon";
  if (name.includes("CALABARZON")) return "CALABARZON";
  if (name.includes("MIMAROPA")) return "MIMAROPA";
  if (name.includes("Bicol")) return "Bicol Region";
  if (name.includes("Western Visayas")) return "Western Visayas";
  if (name.includes("Negros Island")) return "Negros Island Region";
  if (name.includes("Central Visayas")) return "Central Visayas";
  if (name.includes("Eastern Visayas")) return "Eastern Visayas";
  if (name.includes("Zamboanga")) return "Zamboanga Peninsula";
  if (name.includes("Northern Mindanao")) return "Northern Mindanao";
  if (name.includes("Davao")) return panelKey === "stunting" ? "Davao" : "Davao Region";
  if (name.includes("SOCCSKSARGEN")) return "SOCCSKSARGEN";
  if (name.includes("CARAGA") || name.includes("Caraga")) return panelKey === "stunting" ? "CARAGA" : "Caraga";
  if (name.includes("BARMM") || name.includes("Muslim Mindanao")) return panelKey === "stunting" ? "ARMM" : "BARMM";
  return name;
}

function isSuluArchipelagoFeature(feature) {
  const bbox = getFeatureBbox(feature);
  if (!bbox) return false;
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return minLng > 119 && maxLng < 123 && minLat > 5 && maxLat < 7;
}

function getFeatureBbox(feature) {
  const coordinates = [];
  collectCoordinates(feature?.geometry?.coordinates, coordinates);
  if (!coordinates.length) return null;
  const lngs = coordinates.map((point) => point[0]);
  const lats = coordinates.map((point) => point[1]);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}

function collectCoordinates(value, coordinates) {
  if (!Array.isArray(value)) return;
  if (typeof value[0] === "number") {
    coordinates.push(value);
    return;
  }
  value.forEach((item) => collectCoordinates(item, coordinates));
}

function normalizeRegion(region) {
  const normalized = String(region || "")
    .toLowerCase()
    .replace(/\bnational capital region\b/g, "ncr")
    .replace(/\([^)]*\)/g, "")
    .replace(/\bregion\b/g, "")
    .replace(/\biv-a\b|\biv-b\b|\bviii\b|\bvii\b|\bvi\b|\bv\b|\biii\b|\bii\b|\bi\b|\bxiii\b|\bxii\b|\bxi\b|\bx\b|\bix\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (normalized === "national capital") return "ncr";
  if (["armm", "barmm", "bangsamoro autonomous in muslim mindanao"].includes(normalized)) {
    return "bangsamoro";
  }
  return normalized;
}

function createMap(key, panel, data) {
  const map = new mapboxgl.Map({
    container: panel.container,
    style: "mapbox://styles/mapbox/light-v11",
    center: INITIAL_MAP_VIEW.center,
    zoom: INITIAL_MAP_VIEW.zoom,
    interactive: true,
    attributionControl: false,
    maxBounds: [
      [103.5, -2.0],
      [134.0, 27.5],
    ],
  });
  maps[key] = map;

  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
  map.on("load", () => {
    map.addSource(panel.sourceId, { type: "geojson", data });
    map.addLayer({
      id: panel.layerId,
      type: "fill",
      source: panel.sourceId,
      paint: {
        "fill-color": colorExpression(panel),
        "fill-opacity": opacityExpression(),
      },
    });
    map.addLayer({
      id: panel.lineId,
      type: "line",
      source: panel.sourceId,
      paint: {
        "line-color": [
          "case",
          ["==", ["get", "panel_region_key"], selectedRegionKey || ""],
          "#ffffff",
          "#ffffff",
        ],
        "line-width": lineWidthExpression(),
      },
    });
    map.fitBounds(PH_BOUNDS, { padding: 20, duration: 0 });
    map.getContainer().closest(".map-wrap").querySelector(".loading").classList.add("is-hidden");
  });

  map.on("mousemove", panel.layerId, (event) => {
    map.getCanvas().style.cursor = "pointer";
    const props = event.features[0].properties;
    updateSelection(props.panel_region);
  });
  map.on("mouseleave", panel.layerId, () => {
    map.getCanvas().style.cursor = "";
    clearSelection();
  });
  map.on("click", panel.layerId, (event) => {
    event.originalEvent.stopPropagation();
    const props = event.features[0].properties;
    updateSelection(props.panel_region);
    new mapboxgl.Popup({ closeButton: false })
      .setLngLat(event.lngLat)
      .setHTML(popupHtml(props))
      .addTo(map);
  });
}

function colorExpression(panel) {
  const [a, b, c, d] = panel.stops;
  const [c0, c1, c2, c3, c4] = panel.colors;
  return [
    "case",
    ["!", ["to-boolean", ["get", "panel_value"]]],
    "#d6dce2",
    ["<", ["get", "panel_value"], a],
    c0,
    ["<", ["get", "panel_value"], b],
    c1,
    ["<", ["get", "panel_value"], c],
    c2,
    ["<", ["get", "panel_value"], d],
    c3,
    c4,
  ];
}

function opacityExpression() {
  return [
    "case",
    ["==", ["get", "panel_region_key"], selectedRegionKey || ""],
    0.98,
    ["==", concernThreshold, 1],
    0.78,
    [">=", ["coalesce", ["get", "concern_level"], 0], concernThreshold],
    0.84,
    0.12,
  ];
}

function lineWidthExpression() {
  return [
    "case",
    ["==", ["get", "panel_region_key"], selectedRegionKey || ""],
    1.2,
    ["==", concernThreshold, 1],
    0.75,
    [">=", ["coalesce", ["get", "concern_level"], 0], concernThreshold],
    1.1,
    0.35,
  ];
}

function popupHtml(props) {
  const value = Number(props.panel_value);
  const display = Number.isFinite(value) ? `${value.toFixed(1)}%` : "No data";
  return `<strong>${props.panel_region}</strong><br>${props.panel_label}: ${display}`;
}

function updateSelection(region, showProfilePopup = false) {
  selectedRegion = region;
  selectedRegionKey = normalizeRegion(region);
  document.getElementById("selected-title").textContent = region
    ? displayRegionLabel(region)
    : "No region selected";
  document.getElementById("selected-metrics").innerHTML = ["stunting", "education", "literacy"]
    .map((key) => metricPill(key, region))
    .join("");
  updateHighlightPaint();
  updateScatterSelection();
  if (showProfilePopup) {
    updateRegionalProfilePopup();
  } else {
    const profilePopup = document.getElementById("regional-profile-popup");
    if (profilePopup) profilePopup.hidden = true;
  }
}

function clearSelection() {
  selectedRegion = null;
  selectedRegionKey = null;
  document.getElementById("selected-title").textContent = "Hover or click a region";
  document.getElementById("selected-metrics").innerHTML =
    "<span>Stunting</span><span>Senior high completion</span><span>Functional literacy</span>";
  updateHighlightPaint();
  updateScatterSelection();
  const profilePopup = document.getElementById("regional-profile-popup");
  if (profilePopup) profilePopup.hidden = true;
}

function updateRegionalProfilePopup() {
  const popup = document.getElementById("regional-profile-popup");
  if (!popup || !selectedRegionKey) return;
  const points = [...document.querySelectorAll(".regional-line-point")].filter(
    (point) => point.dataset.regionKey === selectedRegionKey
  );
  if (!points.length) {
    popup.hidden = true;
    return;
  }
  const rows = Object.fromEntries(
    ["stunting", "education", "literacy"].map((key) => [
      key,
      dataByPanel[key].find((row) => row.region_key === selectedRegionKey),
    ])
  );
  const values = {
    stunting: Number(rows.stunting?.[PANELS.stunting.sourceMetric]),
    completion: Number(rows.education?.[PANELS.education.sourceMetric]),
    literacy: Number(rows.literacy?.[PANELS.literacy.sourceMetric]),
  };
  popup.querySelector("h3").textContent = displayRegionLabel(selectedRegion);
  popup.querySelector("div").innerHTML = `
    <p><i class="stunting"></i><span>Stunting · 2008</span><strong>${values.stunting.toFixed(1)}%</strong></p>
    <p><i class="completion"></i><span>Senior-high completion · 2023</span><strong>${values.completion.toFixed(1)}%</strong></p>
    <p><i class="literacy"></i><span>Functional literacy · 2024</span><strong>${values.literacy.toFixed(1)}%</strong></p>`;
  const x = Number(points[0].getAttribute("cx"));
  popup.style.left = `${Math.max(12, Math.min(88, (x / 1500) * 100))}%`;
  popup.hidden = false;
}

function metricPill(key, region) {
  const panel = PANELS[key];
  const row = dataByPanel[key].find((item) => item.region_key === normalizeRegion(region));
  const value = row ? row[panel.sourceMetric] : null;
  const display = Number.isFinite(value) ? `${value.toFixed(1)}%` : "No comparable data";
  return `<span><strong>${display}</strong>${panel.label}</span>`;
}

function updateHighlightPaint() {
  Object.entries(PANELS).forEach(([key, panel]) => {
    const map = maps[key];
    if (!map || !map.getLayer(panel.layerId)) return;
    map.setPaintProperty(panel.layerId, "fill-opacity", opacityExpression());
    map.setPaintProperty(panel.lineId, "line-width", lineWidthExpression());
    map.setPaintProperty(panel.lineId, "line-color", [
      "case",
      ["==", ["get", "panel_region_key"], selectedRegionKey || ""],
      "#ffffff",
      "#ffffff",
    ]);
  });
}

function bindConcernControl() {
  const slider = document.getElementById("concern-slider");
  if (!slider) return;
  slider.addEventListener("input", () => {
    concernThreshold = Number(slider.value);
    updateConcernCopy();
    updateHighlightPaint();
  });
  document.getElementById("reset-maps")?.addEventListener("click", (event) => {
    event.stopPropagation();
    concernThreshold = 1;
    slider.value = "1";
    updateConcernCopy();
    updateHighlightPaint();
    Object.values(maps).forEach((map) => {
      map.stop();
      map.easeTo({ ...INITIAL_MAP_VIEW, duration: 500 });
    });
  });
  updateConcernCopy();
}

function bindClearSelection() {
  document.addEventListener("click", (event) => {
    if (
      event.target.closest(".mapboxgl-canvas") ||
      event.target.closest(".ranking button") ||
      event.target.closest(".region-chip-list button") ||
      event.target.closest(".regional-pattern-groups button") ||
      event.target.closest(".regional-profile-popup") ||
      event.target.closest("[data-profile-order]") ||
      event.target.closest("[data-profile-pattern]")
    ) {
      return;
    }
    clearSelection();
  });
}

function updateConcernCopy() {
  const label = document.getElementById("concern-label");
  const count = document.getElementById("concern-count");
  const copy = document.getElementById("concern-copy");
  const regionPanel = document.querySelector(".concern-region-panel");
  const regionLabel = document.getElementById("concern-region-label");
  const regionList = document.getElementById("concern-region-list");
  const panelRegions = Object.fromEntries(
    Object.keys(PANELS).map((key) => [key, getPanelConcernRegions(key)])
  );

  label.textContent = CONCERN_LABELS[concernThreshold];
  count.textContent =
    concernThreshold === 1
      ? "All regions shown on each map"
      : `Stunting ${panelRegions.stunting.length} · Completion ${panelRegions.education.length} · Literacy ${panelRegions.literacy.length}`;
  copy.textContent =
    concernThreshold === 1
      ? "Move the slider to focus on regions at or above the selected concern level. Higher stunting and lower completion or literacy indicate greater concern."
      : "Each map highlights regions at or above the selected concern level.";
  if (regionPanel) {
    regionPanel.classList.toggle("is-hidden", concernThreshold === 1);
  }
  if (regionLabel && regionList) {
    regionLabel.textContent =
      concernThreshold === 1 ? "Comparable regions by map" : "Regions highlighted by slider";
    renderPanelRegionGroups(regionList, panelRegions);
  }
}

function getPanelConcernRegions(key) {
  const panel = PANELS[key];
  return dataByPanel[key]
    .filter((row) => row.region !== "Philippines")
    .filter((row) => Number.isFinite(row[panel.sourceMetric]))
    .map((row) => ({
      key: row.region_key,
      label: row.region,
      score: scoreValue(row[panel.sourceMetric], panel.stops, panel.direction),
    }))
    .filter((region) => concernThreshold === 1 || region.score >= concernThreshold)
    .sort(
      (a, b) => b.score - a.score || cleanRegionLabel(a.label).localeCompare(cleanRegionLabel(b.label))
    );
}

function renderRegionChips(target, regions, emptyMessage = "No regions match this selection.") {
  target.innerHTML = regions.length
    ? regions
        .map(
          (region) =>
            `<button type="button" data-region="${region.label}">${displayRegionLabel(region.label)}</button>`
        )
        .join("")
    : `<span class="empty-state">${emptyMessage}</span>`;
  target.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => updateSelection(button.dataset.region));
  });
}

function renderPanelRegionGroups(target, panelRegions) {
  target.innerHTML = Object.entries(panelRegions)
    .map(([key, regions]) => {
      const title = {
        stunting: "Stunting",
        education: "Completion",
        literacy: "Literacy",
      }[key];
      const chips = regions.length
        ? regions
            .map(
              (region) =>
                `<button type="button" data-region="${region.label}">${displayRegionLabel(region.label)}</button>`
            )
            .join("")
        : `<span class="empty-state">No regions match.</span>`;
      return `<div class="region-chip-group"><span>${title}</span><div>${chips}</div></div>`;
    })
    .join("");
  target.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => updateSelection(button.dataset.region));
  });
}

function getConcernRegionLabel(regionKey) {
  const row =
    dataByPanel.literacy.find((item) => item.region_key === regionKey) ||
    dataByPanel.education.find((item) => item.region_key === regionKey) ||
    dataByPanel.stunting.find((item) => item.region_key === regionKey);
  return row?.region || regionKey;
}

function renderLegend(key) {
  const panel = PANELS[key];
  const target = document.getElementById(`legend-${key}`);
  target.innerHTML = panel.legend
    .map(
      (label, index) =>
        `<span><i style="background:${panel.colors[index]}"></i>${label}${panel.suffix}</span>`
    )
    .join("");
}

function renderRanking(key) {
  const panel = PANELS[key];
  const target = document.getElementById(`rank-${key}`);
  const label = document.getElementById(`rank-label-${key}`);
  const rows = dataByPanel[key]
    .filter((row) => row.region !== "Philippines")
    .filter((row) => Number.isFinite(row[panel.sourceMetric]))
    .sort((a, b) =>
      panel.direction === "high"
        ? b[panel.sourceMetric] - a[panel.sourceMetric]
        : a[panel.sourceMetric] - b[panel.sourceMetric]
    )
    .slice(0, 5);
  const descriptor = panel.direction === "high" ? "highest" : "lowest";
  if (label) label.textContent = panel.rankingTitle;
  target.setAttribute("aria-label", `${descriptor} ${panel.label} regions`);
  target.innerHTML = rows
    .map(
      (row) =>
        `<li><button type="button" data-region="${row.region}"><span>${displayRegionLabel(
          row.region
        )}</span><strong>${Number(row[panel.sourceMetric]).toFixed(1)}%</strong></button></li>`
    )
    .join("");
  target.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => updateSelection(button.dataset.region));
  });
}

function cleanRegionLabel(region) {
  return String(region)
    .replace("National Capital Region", "NCR")
    .replace("Negros Island Region", "NIR");
}

function displayRegionLabel(region) {
  const key = normalizeRegion(region);
  const labels = {
    ncr: "National Capital Region",
    car: "CAR",
    "cordillera administrative": "CAR",
    ilocos: "Region I · Ilocos",
    "cagayan valley": "Region II · Cagayan Valley",
    "central luzon": "Region III · Central Luzon",
    calabarzon: "Region IV-A · CALABARZON",
    mimaropa: "Region IV-B · MIMAROPA",
    bicol: "Region V · Bicol",
    "western visayas": "Region VI · Western Visayas",
    "central visayas": "Region VII · Central Visayas",
    "eastern visayas": "Region VIII · Eastern Visayas",
    "zamboanga peninsula": "Region IX · Zamboanga Peninsula",
    "northern mindanao": "Region X · Northern Mindanao",
    davao: "Region XI · Davao",
    soccsksargen: "Region XII · SOCCSKSARGEN",
    caraga: "Region XIII · CARAGA",
    bangsamoro: "ARMM / BARMM",
  };
  return labels[key] || cleanRegionLabel(region);
}

function chartRegionLabel(regionKey) {
  return {
    ncr: "NCR",
    car: "CAR",
    "cordillera administrative": "CAR",
    "ilocos": "Region I",
    "cagayan valley": "Region II",
    "central luzon": "Region III",
    calabarzon: "Region IV-A",
    mimaropa: "Region IV-B",
    bicol: "Region V",
    "western visayas": "Region VI",
    "central visayas": "Region VII",
    "eastern visayas": "Region VIII",
    "zamboanga peninsula": "Region IX",
    "northern mindanao": "Region X",
    davao: "Region XI",
    soccsksargen: "Region XII",
    caraga: "CARAGA",
    bangsamoro: "BARMM",
  }[regionKey] || regionKey.toUpperCase();
}

function renderRegionalProfileChart() {
  const target = document.getElementById("regional-profile-chart");
  if (!target) return;

  const completion = new Map(dataByPanel.education.map((row) => [row.region_key, row]));
  const literacy = new Map(dataByPanel.literacy.map((row) => [row.region_key, row]));
  const baseRows = dataByPanel.stunting
    .filter((row) => row.region !== "Philippines")
    .map((row) => {
      const completionRow = completion.get(row.region_key);
      const literacyRow = literacy.get(row.region_key);
      const values = {
        stunting: Number(row[PANELS.stunting.sourceMetric]),
        completion: Number(completionRow?.[PANELS.education.sourceMetric]),
        literacy: Number(literacyRow?.[PANELS.literacy.sourceMetric]),
      };
      return Object.values(values).every(Number.isFinite)
        ? { key: row.region_key, label: row.region, ...values }
        : null;
    })
    .filter(Boolean);

  let rows = [...baseRows];
  if (regionalProfileOrder === "descending") rows.sort((a, b) => b.stunting - a.stunting);
  if (regionalProfileOrder === "ascending") rows.sort((a, b) => a.stunting - b.stunting);

  if (!rows.length) {
    target.innerHTML = `<p class="empty-state">No comparable regional data available.</p>`;
    return;
  }

  const highestStunting = [...baseRows].sort((a, b) => b.stunting - a.stunting)[0];
  const lowestCompletion = [...baseRows].sort((a, b) => a.completion - b.completion)[0];
  const lowestLiteracy = [...baseRows].sort((a, b) => a.literacy - b.literacy)[0];
  document.getElementById("profile-high-stunting").textContent = `${displayRegionLabel(highestStunting.label)} · ${highestStunting.stunting.toFixed(1)}%`;
  document.getElementById("profile-low-completion").textContent = `${displayRegionLabel(lowestCompletion.label)} · ${lowestCompletion.completion.toFixed(1)}%`;
  document.getElementById("profile-low-literacy").textContent = `${displayRegionLabel(lowestLiteracy.label)} · ${lowestLiteracy.literacy.toFixed(1)}%`;
  const median = (key) => {
    const values = baseRows.map((row) => row[key]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  };
  const thresholds = {
    stunting: median("stunting"),
    completion: median("completion"),
    literacy: median("literacy"),
  };
  const patternGroups = { favorable: [], concern: [], mixed: [] };
  baseRows.forEach((row) => {
    const favorable =
      row.stunting < thresholds.stunting &&
      row.completion > thresholds.completion &&
      row.literacy > thresholds.literacy;
    const concern =
      row.stunting > thresholds.stunting &&
      row.completion < thresholds.completion &&
      row.literacy < thresholds.literacy;
    patternGroups[favorable ? "favorable" : concern ? "concern" : "mixed"].push(row);
  });
  patternGroups.favorable.sort((a, b) => a.stunting - b.stunting);
  patternGroups.concern.sort((a, b) => b.stunting - a.stunting);
  Object.entries(patternGroups).forEach(([key, groupRows]) => {
    const list = document.getElementById(`pattern-${key}-list`);
    list.innerHTML = groupRows
      .map((row) => `<li><button type="button" data-region="${row.label}">${displayRegionLabel(row.label)}</button></li>`)
      .join("");
    list.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        regionalProfilePattern = key === "mixed" ? "mixed" : "aligned";
        renderRegionalProfileChart();
        updateSelection(button.dataset.region, true);
      });
    });
  });
  document.querySelectorAll("[data-profile-order]").forEach((button) => {
    button.classList.toggle("active", button.dataset.profileOrder === regionalProfileOrder);
    button.onclick = () => {
      regionalProfileOrder = button.dataset.profileOrder;
      renderRegionalProfileChart();
    };
  });
  document.querySelectorAll("[data-profile-pattern]").forEach((button) => {
    button.classList.toggle("active", button.dataset.profilePattern === regionalProfilePattern);
    button.onclick = () => {
      regionalProfilePattern = button.dataset.profilePattern;
      renderRegionalProfileChart();
    };
  });
  const alignedKeys = new Set([...patternGroups.favorable, ...patternGroups.concern].map((row) => row.key));
  const mixedKeys = new Set(patternGroups.mixed.map((row) => row.key));
  if (regionalProfilePattern === "aligned") rows = rows.filter((row) => alignedKeys.has(row.key));
  if (regionalProfilePattern === "mixed") rows = rows.filter((row) => mixedKeys.has(row.key));

  const width = 1500;
  const height = 520;
  const margin = { top: 28, right: 28, bottom: 150, left: 68 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const x = (index) => margin.left + (index * innerWidth) / Math.max(rows.length - 1, 1);
  const y = (value) => margin.top + ((90 - value) / 70) * innerHeight;
  const series = [
    { key: "stunting", label: "Stunting", color: "#df684d" },
    { key: "completion", label: "Senior-high completion", color: "#f2a21b" },
    { key: "literacy", label: "Functional literacy", color: "#48a7d4" },
  ];
  const ticks = [20, 30, 40, 50, 60, 70, 80, 90];

  target.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Line chart comparing stunting, senior-high completion, and functional literacy across regions ordered by stunting prevalence">
      ${ticks.map((tick) => `
        <line class="regional-profile-gridline" x1="${margin.left}" x2="${width - margin.right}" y1="${y(tick)}" y2="${y(tick)}"></line>
        <text class="regional-profile-tick" x="${margin.left - 14}" y="${y(tick) + 4}" text-anchor="end">${tick}%</text>
      `).join("")}
      ${series.map((item) => `
        <polyline class="regional-profile-line ${item.key}" points="${rows.map((row, index) => `${x(index)},${y(row[item.key])}`).join(" ")}" style="stroke:${item.color}"></polyline>
        ${rows.map((row, index) => `
          <circle class="regional-line-point ${item.key}" data-region="${row.label}" data-region-key="${row.key}" cx="${x(index)}" cy="${y(row[item.key])}" r="5" style="fill:${item.color}">
            <title>${cleanRegionLabel(row.label)} · ${item.label}: ${row[item.key].toFixed(1)}%</title>
          </circle>
        `).join("")}
      `).join("")}
      ${rows.map((row, index) => `
        <text class="regional-profile-label" transform="translate(${x(index) - 3} ${height - margin.bottom + 24}) rotate(52)" text-anchor="start">${chartRegionLabel(row.key)}</text>
      `).join("")}
      <text class="regional-profile-axis-label" x="${margin.left}" y="${height - 12}">${
        regionalProfileOrder === "sequence"
          ? "Philippine regional sequence"
          : regionalProfileOrder === "descending"
            ? "Regions ordered by stunting prevalence, highest to lowest →"
            : "Regions ordered by stunting prevalence, lowest to highest →"
      }</text>
    </svg>
    <aside id="regional-profile-popup" class="regional-profile-popup" hidden aria-live="polite">
      <button type="button" aria-label="Close regional values">×</button>
      <span>Selected region</span>
      <h3></h3>
      <div></div>
    </aside>`;

  target.querySelectorAll(".regional-line-point").forEach((point) => {
    point.addEventListener("mouseenter", () => updateSelection(point.dataset.region));
    point.addEventListener("click", (event) => {
      event.stopPropagation();
      updateSelection(point.dataset.region, true);
    });
  });
  target.querySelector("#regional-profile-popup > button").addEventListener("click", () => {
    target.querySelector("#regional-profile-popup").hidden = true;
  });
  if (selectedRegionKey) updateRegionalProfilePopup();
}

function renderScatterplot(targetKey, elementId, dotColor, lineColor) {
  const target = document.getElementById(elementId);
  if (!target) return;

  const rows = getRelationshipRows(targetKey);
  if (!rows.length) {
    target.innerHTML = `<p class="empty-state">No comparable regional data available.</p>`;
    return;
  }

  const width = 560;
  const height = 265;
  const margin = { top: 18, right: 22, bottom: 58, left: 58 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const xDomain = paddedDomain(rows.map((row) => row.stunting), 1);
  const yDomain = paddedDomain(rows.map((row) => row.outcome), 2);
  const xScale = (value) =>
    margin.left + ((value - xDomain[0]) / (xDomain[1] - xDomain[0])) * innerWidth;
  const yScale = (value) =>
    margin.top + innerHeight - ((value - yDomain[0]) / (yDomain[1] - yDomain[0])) * innerHeight;
  const xTicks = makeTicks(xDomain, 4);
  const yTicks = makeTicks(yDomain, 4);
  const trend = linearRegression(rows.map((row) => [row.stunting, row.outcome]));
  const correlation = pearson(rows.map((row) => row.stunting), rows.map((row) => row.outcome));
  const trendStartY = trend ? trend.intercept + trend.slope * xDomain[0] : null;
  const trendEndY = trend ? trend.intercept + trend.slope * xDomain[1] : null;
  const targetPanel = PANELS[targetKey];
  const relationshipText =
    Number.isFinite(correlation) && correlation < -0.35
      ? "Downward pattern"
      : Number.isFinite(correlation) && correlation > 0.35
        ? "Upward pattern"
        : "Mixed pattern";

  target.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Scatterplot comparing 2008 stunting with ${
      targetPanel.label
    }">
      ${yTicks
        .map(
          (tick) => `
            <line class="scatter-gridline" x1="${margin.left}" x2="${width - margin.right}" y1="${yScale(
              tick
            )}" y2="${yScale(tick)}"></line>
            <text class="scatter-tick" x="${margin.left - 10}" y="${yScale(
              tick
            ) + 4}" text-anchor="end">${tick.toFixed(0)}%</text>`
        )
        .join("")}
      <line class="scatter-axis" x1="${margin.left}" x2="${width - margin.right}" y1="${
        height - margin.bottom
      }" y2="${height - margin.bottom}"></line>
      <line class="scatter-axis" x1="${margin.left}" x2="${margin.left}" y1="${margin.top}" y2="${
        height - margin.bottom
      }"></line>
      ${xTicks
        .map(
          (tick) => `
            <line class="scatter-axis" x1="${xScale(tick)}" x2="${xScale(tick)}" y1="${
              height - margin.bottom
            }" y2="${height - margin.bottom + 5}"></line>
            <text class="scatter-tick" x="${xScale(tick)}" y="${
              height - margin.bottom + 22
            }" text-anchor="middle">${tick.toFixed(0)}%</text>`
        )
        .join("")}
      <text class="scatter-axis-label" x="${margin.left + innerWidth / 2}" y="${
        height - 10
      }" text-anchor="middle">2008 stunting rate</text>
      <text class="scatter-axis-label" transform="translate(16 ${
        margin.top + innerHeight / 2
      }) rotate(-90)" text-anchor="middle">${targetPanel.label}</text>
      ${
        trend
          ? `<line class="scatter-trend" x1="${xScale(xDomain[0])}" y1="${yScale(
              trendStartY
            )}" x2="${xScale(xDomain[1])}" y2="${yScale(trendEndY)}" style="stroke:${lineColor}"></line>`
          : ""
      }
      ${rows
        .map(
          (row) => `
            <circle class="scatter-dot" data-region="${row.label}" data-region-key="${
            row.key
          }" cx="${xScale(row.stunting)}" cy="${yScale(row.outcome)}" r="5.5" style="fill:${dotColor}">
              <title>${cleanRegionLabel(row.label)}: stunting ${row.stunting.toFixed(
                1
              )}%, ${targetPanel.label.toLowerCase()} ${row.outcome.toFixed(1)}%</title>
            </circle>`
        )
        .join("")}
      <text class="scatter-note" x="${width - margin.right}" y="${margin.top + 3}" text-anchor="end">${relationshipText}</text>
    </svg>`;
}

function getRelationshipRows(targetKey) {
  const stuntingRows = new Map(
    dataByPanel.stunting
      .filter((row) => row.region !== "Philippines")
      .map((row) => [row.region_key, row])
  );
  return dataByPanel[targetKey]
    .filter((row) => row.region !== "Philippines")
    .map((row) => {
      const stuntingRow = stuntingRows.get(row.region_key);
      if (!stuntingRow) return null;
      const stunting = Number(stuntingRow[PANELS.stunting.sourceMetric]);
      const outcome = Number(row[PANELS[targetKey].sourceMetric]);
      if (!Number.isFinite(stunting) || !Number.isFinite(outcome)) return null;
      return {
        key: row.region_key,
        label: row.region,
        stunting,
        outcome,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.stunting - b.stunting);
}

function paddedDomain(values, padding) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return [Math.floor(min - padding), Math.ceil(max + padding)];
}

function makeTicks(domain, count) {
  const [min, max] = domain;
  const step = (max - min) / count;
  return Array.from({ length: count + 1 }, (_, index) => min + step * index);
}

function linearRegression(points) {
  const valid = points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (valid.length < 2) return null;
  const meanX = valid.reduce((sum, [x]) => sum + x, 0) / valid.length;
  const meanY = valid.reduce((sum, [, y]) => sum + y, 0) / valid.length;
  const numerator = valid.reduce((sum, [x, y]) => sum + (x - meanX) * (y - meanY), 0);
  const denominator = valid.reduce((sum, [x]) => sum + (x - meanX) ** 2, 0);
  if (!denominator) return null;
  const slope = numerator / denominator;
  return { slope, intercept: meanY - slope * meanX };
}

function pearson(xValues, yValues) {
  if (xValues.length !== yValues.length || xValues.length < 2) return null;
  const meanX = xValues.reduce((sum, value) => sum + value, 0) / xValues.length;
  const meanY = yValues.reduce((sum, value) => sum + value, 0) / yValues.length;
  const numerator = xValues.reduce(
    (sum, value, index) => sum + (value - meanX) * (yValues[index] - meanY),
    0
  );
  const xDenominator = xValues.reduce((sum, value) => sum + (value - meanX) ** 2, 0);
  const yDenominator = yValues.reduce((sum, value) => sum + (value - meanY) ** 2, 0);
  const denominator = Math.sqrt(xDenominator * yDenominator);
  return denominator ? numerator / denominator : null;
}

function bindScatterEvents() {
  document.querySelectorAll(".scatter-dot").forEach((dot) => {
    dot.addEventListener("mouseenter", () => updateSelection(dot.dataset.region));
    dot.addEventListener("click", (event) => {
      event.stopPropagation();
      updateSelection(dot.dataset.region);
    });
  });
}

function updateScatterSelection() {
  document.querySelectorAll(".scatter-dot, .regional-line-point").forEach((dot) => {
    dot.classList.toggle("is-selected", dot.dataset.regionKey === selectedRegionKey);
  });
}
const floatingTop = document.querySelector('.floating-top');
if (floatingTop) {
  const updateFloatingTop = () => floatingTop.classList.toggle('is-visible', window.scrollY > 420);
  window.addEventListener('scroll', updateFloatingTop, { passive: true });
  updateFloatingTop();
}

const maintenanceDialog = document.querySelector('.maintenance-dialog');
const maintenanceLogButton = document.querySelector('.maintenance-log-button');
const maintenanceDialogClose = document.querySelector('.maintenance-dialog-close');
if (maintenanceDialog && maintenanceLogButton && maintenanceDialogClose) {
  maintenanceLogButton.addEventListener('click', () => maintenanceDialog.showModal());
  maintenanceDialogClose.addEventListener('click', () => maintenanceDialog.close());
  maintenanceDialog.addEventListener('click', (event) => {
    if (event.target === maintenanceDialog) maintenanceDialog.close();
  });
}
