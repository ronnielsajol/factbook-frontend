/* global mapboxgl */

const DATA_URLS = {
  region: "./data/region-manifest.json",
  province: "./data/province-manifest.json",
  lgu: "./data/top_lgus.geojson",
};

const CLASS_ORDER = ["Very Low", "Low", "Medium", "High", "Very High", "No data"];
const WHO_RANGES = {
  "Very Low": "<2.5%",
  Low: "2.5-<10%",
  Medium: "10-<20%",
  High: "20-<30%",
  "Very High": ">=30%",
  "No data": "",
};
const REGIONAL_DATA_CORRECTIONS = {
  "Cordillera Administrative Region (CAR)": {
    prevalence_2023: 22.2,
    prevalence_2025: 23.2,
    change_2023_2025: 1,
    level: "High",
  },
  "Region VII (Central Visayas)": {
    prevalence_2023: 22.1,
    prevalence_2025: 22.7,
    change_2023_2025: 0.6,
    ci_2025: "19.5-26.2",
    level: "High",
  },
  "Region XIII (CARAGA)": {
    prevalence_2023: 24.4,
    prevalence_2025: 24.4,
    change_2023_2025: 0,
    ci_2025: "20.4-29.0",
    level: "High",
  },
};
const PPAN_ORDER = ["< 18.49", "18.49-20.98", "20.98-25.89", "25.89-30.67", ">= 30.67"];
const PPAN_RANGES = Object.fromEntries(PPAN_ORDER.map((level) => [level, "Need score"]));
const PPAN_COLORS = {
  "< 18.49": "#fff7ed",
  "18.49-20.98": "#fed7aa",
  "20.98-25.89": "#fd9f7a",
  "25.89-30.67": "#d94b3d",
  ">= 30.67": "#6f2d1c",
  "No data": "#d6dce2",
};
const PH_BOUNDS = [
  [114.2, 4.0],
  [128.5, 21.5],
];

let metadata;
let datasets = {};
let map;
let currentLayer = "region";
let activeClass = null;
let activeCategory = "All";
let activeProfile = "age";
let popup;
let currentRankingFeatures = [];

const statusEl = document.getElementById("status");
const layerNote = document.getElementById("layer-note");
const layerSource = document.getElementById("layer-source");
const whoFilter = document.getElementById("who-filter");
const clearFilter = document.getElementById("clear-filter");
const legendStatus = document.getElementById("legend-status");
const classBars = document.getElementById("class-bars");
const distributionTitle = document.getElementById("distribution-title");
const distributionNote = document.getElementById("distribution-note");
const distributionSummary = document.getElementById("distribution-summary");
const distributionSource = document.getElementById("distribution-source");
const distributionPreview = document.getElementById("distribution-preview");
const activeFilterLabel = document.getElementById("active-filter-label");
const currentLayerLabel = document.getElementById("current-layer-label");
const rankingTitle = document.getElementById("ranking-title");
const rankingNote = document.getElementById("ranking-note");
const rankingList = document.getElementById("ranking-list");
const rankingSource = document.getElementById("ranking-source");
const rankingPreview = document.getElementById("ranking-preview");
const profileNote = document.getElementById("profile-note");
const profileSummary = document.getElementById("profile-summary");
const profileBars = document.getElementById("profile-bars");
const profileSource = document.getElementById("profile-source");
const profilePreview = document.getElementById("profile-preview");
const selectedArea = document.getElementById("selected-area");
const selectedPreview = document.getElementById("selected-preview");
const lguControls = document.getElementById("lgu-controls");
const mapSearchForm = document.getElementById("map-search-form");
const mapSearchInput = document.getElementById("map-search-input");
const mapSearchOptions = document.getElementById("map-search-options");
const mapSearchStatus = document.getElementById("map-search-status");
let searchIndex = [];

const PROFILE_CONTENT = {
  age: {
    note: "Among children under five, prevalence is highest at 24-35 months.",
    kicker: "Highest age group",
    title: "24-35 months",
    detail: "31.5% stunting prevalence in 2025",
    highlight: "24-35 months",
    color: "#22577a",
    source: "Source: DOST-FNRI 2025 Updating Survey - Anthropometry, p. 11.",
  },
  residence: {
    note: "Children in rural areas have higher stunting prevalence than children in urban areas.",
    kicker: "Place of residence",
    title: "Rural residence is higher",
    detail: "27.8% compared with 23.2% in urban areas",
    highlight: "Rural residence",
    color: "#2f7d64",
    source: "Source: DOST-FNRI 2025 Updating Survey - Anthropometry, p. 12.",
  },
  wealth: {
    note: "The largest profile gap is by household wealth.",
    kicker: "Largest gap",
    title: "Poorest vs. richest households",
    detail: "37.8% compared with 11.9% in 2025",
    highlight: "Poorest",
    color: "#2f7d64",
    source: "Source: DOST-FNRI 2025 Updating Survey - Anthropometry, p. 12.",
  },
  gender: {
    note: "Boys have slightly higher stunting prevalence than girls.",
    kicker: "Sex",
    title: "Boys have higher prevalence",
    detail: "26.7% compared with 23.8% among girls",
    highlight: "Boys",
    color: "#2f7d64",
    source: "Source: DOST-FNRI 2025 Updating Survey - Anthropometry, p. 12.",
  },
};

init();

async function init() {
  try {
    const [metadataRecord, regions, provinces, lgus] = await Promise.all([
      fetchJson("./data/metadata.json"),
      fetchGeoJsonParts(DATA_URLS.region),
      fetchGeoJsonParts(DATA_URLS.province),
      fetchJson(DATA_URLS.lgu),
    ]);
    metadata = metadataRecord;
    datasets.region = regions;
    datasets.region.features.forEach((feature) => {
      const correction = REGIONAL_DATA_CORRECTIONS[feature.properties.name];
      if (correction) Object.assign(feature.properties, correction);
    });
    datasets.province = provinces;
    datasets.lgu = lgus;
    buildSearchIndex();
    bindEvents();
    renderStaticWidgets();
    renderDynamicWidgets();
    renderLayerNote();
    initMap();
  } catch (error) {
    statusEl.textContent = "Unable to load map data.";
    console.error(error);
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  if (!url.endsWith(".gz")) return response.json();

  // Some servers automatically decode gzip responses while keeping the .gz URL.
  // Inspect the payload before decompressing so the map works in both cases.
  const bytes = new Uint8Array(await response.arrayBuffer());
  const isGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!isGzip) return JSON.parse(new TextDecoder().decode(bytes));

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).json();
}

async function fetchGeoJsonParts(manifestUrl) {
  const manifest = await fetchJson(manifestUrl);
  const baseUrl = manifestUrl.slice(0, manifestUrl.lastIndexOf("/") + 1);
  const parts = await Promise.all(manifest.files.map((file) => fetchJson(`${baseUrl}${file}`)));
  return { ...parts[0], features: parts.flatMap((part) => part.features) };
}

function initMap() {
  mapboxgl.accessToken = metadata.defaultToken;
  map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/light-v11",
    center: [122.1, 12.2],
    zoom: 4.3,
    maxBounds: PH_BOUNDS,
  });
  popup = new mapboxgl.Popup({ closeButton: true, closeOnClick: true, maxWidth: "320px" });
  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
  map.addControl(new ResetMapControl(), "bottom-right");
  map.on("load", () => {
    addSourcesAndLayers();
    bindMapEvents();
    updateView();
    fitInitialMapView();
    statusEl.classList.add("is-hidden");
  });
}

class ResetMapControl {
  onAdd() {
    this.container = document.createElement("div");
    this.container.className = "mapboxgl-ctrl mapboxgl-ctrl-group";
    this.button = document.createElement("button");
    this.button.className = "map-reset-control";
    this.button.type = "button";
    this.button.title = "Reset map";
    this.button.setAttribute("aria-label", "Reset map to the regional overview");
    this.button.innerHTML = '<span aria-hidden="true">↺</span>';
    this.button.addEventListener("click", resetMap);
    this.container.appendChild(this.button);
    return this.container;
  }

  onRemove() {
    this.button.removeEventListener("click", resetMap);
    this.container.remove();
  }
}

function resetMap() {
  currentLayer = "region";
  activeClass = null;
  activeCategory = "All";
  popup?.remove();
  mapSearchInput.value = "";
  mapSearchStatus.textContent = "";

  document.querySelectorAll(".layer-tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.layer === "region");
  });
  document.querySelectorAll(".category-chip").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.category === "All");
  });

  updateView();
  fitInitialMapView();
}

function buildSearchIndex() {
  const groups = new Map();
  const addFeatures = (features, layer, type) => {
    features.forEach((feature) => {
      const name = feature.properties?.name;
      if (!name) return;
      const key = `${layer}:${name}`;
      if (!groups.has(key)) groups.set(key, { name, layer, type, features: [] });
      groups.get(key).features.push(feature);
    });
  };

  addFeatures(datasets.region.features, "region", "Region");
  addFeatures(datasets.province.features, "province", "Province/HUC");
  addFeatures(datasets.lgu.features, "lgu", "Top LGU");
  searchIndex = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
  mapSearchOptions.innerHTML = searchIndex
    .map((entry) => `<option value="${entry.name}">${entry.type}</option>`)
    .join("");
}

function normalizeSearch(value) {
  const romanNumbers = { "1": "i", "2": "ii", "3": "iii", "4": "iv", "5": "v", "6": "vi", "7": "vii", "8": "viii", "9": "ix", "10": "x", "11": "xi", "12": "xii", "13": "xiii" };
  return value
    .toLowerCase()
    .replace(/\bregion\s+(\d{1,2})\b/g, (_, number) => `region ${romanNumbers[number] || number}`)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function searchMap(value) {
  const query = normalizeSearch(value);
  if (!query) {
    mapSearchStatus.textContent = "Enter a region, province, city, or mapped LGU.";
    return;
  }

  const layerPriority = { region: 0, province: 1, lgu: 2 };
  const result = searchIndex
    .filter((entry) => normalizeSearch(entry.name).includes(query))
    .sort((a, b) => {
      const aName = normalizeSearch(a.name);
      const bName = normalizeSearch(b.name);
      const aPosition = aName === query || aName.startsWith(`${query} `) ? 0 : 1;
      const bPosition = bName === query || bName.startsWith(`${query} `) ? 0 : 1;
      return aPosition - bPosition || layerPriority[a.layer] - layerPriority[b.layer] || aName.length - bName.length;
    })[0];
  if (!result) {
    mapSearchStatus.textContent = `No mapped area found for “${value.trim()}”.`;
    return;
  }

  currentLayer = result.layer;
  activeClass = null;
  activeCategory = "All";
  document.querySelectorAll(".layer-tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.layer === currentLayer);
  });
  document.querySelectorAll(".category-chip").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.category === "All");
  });
  updateView();
  focusSearchResult(result);
  mapSearchInput.value = result.name;
  mapSearchStatus.textContent = `${result.type}: ${result.name}`;
}

function focusSearchResult(result) {
  const bounds = combinedFeatureBounds(result.features);
  if (!bounds) return;
  const center = [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
  map.fitBounds(bounds, { padding: 90, maxZoom: currentLayer === "region" ? 7 : 8.5, duration: 900 });
  showPopup(result.features[0], center, layerIdForCurrentLayer());
}

function combinedFeatureBounds(features) {
  const bounds = features.map(featureBounds).filter(Boolean);
  if (!bounds.length) return null;
  return [
    [Math.min(...bounds.map((item) => item[0][0])), Math.min(...bounds.map((item) => item[0][1]))],
    [Math.max(...bounds.map((item) => item[1][0])), Math.max(...bounds.map((item) => item[1][1]))],
  ];
}

function fitInitialMapView() {
  const isMobile = window.matchMedia("(max-width: 760px)").matches;
  const mapHeight = map.getCanvas().clientHeight;
  const targetLatSpan = PH_BOUNDS[1][1] - PH_BOUNDS[0][1];
  const verticalMargin = isMobile ? 1.48 : 1.42;
  const fittedZoom = Math.log2((360 * mapHeight) / (512 * targetLatSpan * verticalMargin));
  const minZoom = isMobile ? 4.05 : 4.25;
  const maxZoom = isMobile ? 4.65 : 5.05;
  const zoom = Math.max(minZoom, Math.min(maxZoom, fittedZoom));

  map.jumpTo({
    center: isMobile ? [122.15, 12.0] : [122.35, 12.25],
    zoom,
  });
}

function addSourcesAndLayers() {
  map.addSource("regions", { type: "geojson", data: datasets.region });
  map.addSource("provinces", { type: "geojson", data: datasets.province });
  map.addSource("lgus", { type: "geojson", data: datasets.lgu });

  map.addLayer({
    id: "region-fill",
    type: "fill",
    source: "regions",
    paint: {
      "fill-color": colorExpression("level", metadata.whoColors),
      "fill-opacity": 0.72,
    },
  });
  map.addLayer({
    id: "region-line",
    type: "line",
    source: "regions",
    paint: { "line-color": "#ffffff", "line-width": 1.2 },
  });
  map.addLayer({
    id: "province-fill",
    type: "fill",
    source: "provinces",
    layout: { visibility: "none" },
    paint: {
      "fill-color": colorExpression("level", metadata.whoColors),
      "fill-opacity": 0.7,
    },
  });
  map.addLayer({
    id: "province-line",
    type: "line",
    source: "provinces",
    layout: { visibility: "none" },
    paint: { "line-color": "#ffffff", "line-width": 0.8 },
  });
  map.addLayer({
    id: "ppan-fill",
    type: "fill",
    source: "provinces",
    layout: { visibility: "none" },
    paint: {
      "fill-color": colorExpression("ppan_level", PPAN_COLORS),
      "fill-opacity": ["case", ["==", ["get", "ppan_level"], "No data"], 0, 0.76],
    },
  });
  map.addLayer({
    id: "ppan-line",
    type: "line",
    source: "provinces",
    layout: { visibility: "none" },
    paint: { "line-color": "#ffffff", "line-width": 0.8 },
  });
  map.addLayer({
    id: "lgu-circle",
    type: "circle",
    source: "lgus",
    layout: { visibility: "none" },
    paint: {
      "circle-radius": 8,
      "circle-color": colorExpression("level", metadata.whoColors),
      "circle-stroke-color": "#202833",
      "circle-stroke-width": 1.2,
      "circle-opacity": 0.92,
    },
  });
  map.addLayer({
    id: "lgu-label",
    type: "symbol",
    source: "lgus",
    layout: {
      visibility: "none",
      "text-field": ["to-string", ["get", "rank"]],
      "text-size": 10,
      "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
    },
    paint: { "text-color": "#ffffff" },
  });
}

function colorExpression(property, colors) {
  const expression = ["match", ["get", property]];
  for (const [key, color] of Object.entries(colors)) expression.push(key, color);
  expression.push("#d6dce2");
  return expression;
}

function bindEvents() {
  mapSearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    searchMap(mapSearchInput.value);
  });
  document.querySelectorAll(".layer-tab").forEach((button) => {
    button.addEventListener("click", () => {
      currentLayer = button.dataset.layer;
      activeClass = null;
      document.querySelectorAll(".layer-tab").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      updateView();
    });
  });
  clearFilter.addEventListener("click", () => {
    activeClass = null;
    updateView();
  });
  classBars.addEventListener("click", (event) => {
    const button = event.target.closest("[data-level]");
    if (!button) return;
    activeClass = activeClass === button.dataset.level ? null : button.dataset.level;
    updateView();
  });
  rankingList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-rank-index]");
    if (!button) return;
    const feature = currentRankingFeatures[Number(button.dataset.rankIndex)];
    if (feature) focusFeature(feature);
  });
  document.querySelectorAll(".category-chip").forEach((button) => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.category;
      document.querySelectorAll(".category-chip").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      updateView();
    });
  });
  document.querySelectorAll(".profile-tab").forEach((button) => {
    button.addEventListener("click", () => {
      activeProfile = button.dataset.profile;
      document.querySelectorAll(".profile-tab").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      renderProfileWidget();
    });
  });
}

function bindMapEvents() {
  ["region-fill", "province-fill", "ppan-fill", "lgu-circle"].forEach((layerId) => {
    map.on("click", layerId, (event) => {
      const feature = event.features?.[0];
      if (feature) showPopup(feature, event.lngLat, layerId);
    });
    map.on("mouseenter", layerId, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layerId, () => {
      map.getCanvas().style.cursor = "";
    });
  });
}

function updateView() {
  if (map && map.getLayer("region-fill")) {
    setLayerVisibility();
    applyFilters();
  }
  renderWhoFilter();
  renderDynamicWidgets();
  renderLayerNote();
  renderLegendStatus();
  lguControls.hidden = currentLayer !== "lgu";
}

function renderLegendStatus() {
  if (!legendStatus) return;
  const layerLabel = {
    region: "regions",
    province: "province/HUC areas",
    lgu: activeCategory === "All" ? "LGU markers" : activeCategory.toLowerCase(),
    ppan: "PPAN priority provinces",
  }[currentLayer];
  legendStatus.textContent = activeClass
    ? `Showing ${activeClass} ${layerLabel} only.`
    : `Showing all ${layerLabel}.`;
}

function setLayerVisibility() {
  const visibility = {
    "region-fill": currentLayer === "region" ? "visible" : "none",
    "region-line": currentLayer === "region" ? "visible" : "none",
    "province-fill": currentLayer === "province" ? "visible" : "none",
    "province-line": currentLayer === "province" ? "visible" : "none",
    "ppan-fill": currentLayer === "ppan" ? "visible" : "none",
    "ppan-line": currentLayer === "ppan" ? "visible" : "none",
    "lgu-circle": currentLayer === "lgu" ? "visible" : "none",
    "lgu-label": currentLayer === "lgu" ? "visible" : "none",
  };
  for (const [layerId, value] of Object.entries(visibility)) {
    map.setLayoutProperty(layerId, "visibility", value);
  }
}

function applyFilters() {
  const classFilter = activeClass ? ["==", ["get", "level"], activeClass] : true;
  const ppanFilter = activeClass ? ["==", ["get", "ppan_level"], activeClass] : ["!=", ["get", "ppan_level"], "No data"];
  const lguFilter = ["all"];
  if (activeClass) lguFilter.push(classFilter);
  if (activeCategory !== "All") lguFilter.push(["==", ["get", "type"], activeCategory]);

  map.setFilter("region-fill", currentLayer === "region" && activeClass ? classFilter : null);
  map.setFilter("region-line", currentLayer === "region" && activeClass ? classFilter : null);
  map.setFilter("province-fill", currentLayer === "province" && activeClass ? classFilter : null);
  map.setFilter("province-line", currentLayer === "province" && activeClass ? classFilter : null);
  map.setFilter("ppan-fill", ppanFilter);
  map.setFilter("ppan-line", ppanFilter);
  map.setFilter("lgu-circle", lguFilter.length > 1 ? lguFilter : null);
  map.setFilter("lgu-label", lguFilter.length > 1 ? lguFilter : null);
}

function renderLayerNote() {
  const notes = {
    region: {
      description: "Shows 2025 stunting prevalence by region.",
      source: "Source: DOST-FNRI 2025 Updating Survey - Anthropometry.",
    },
    province: {
      description: "Shows province/HUC stunting prevalence from available ENNS survey years. Compare areas cautiously because collection year varies.",
      source: "Source: DOST-FNRI ENNS 2018, 2019, and 2021; Operation Timbang Plus 2025.",
    },
    lgu: {
      description: "Shows 40 markers: the top 10 highest 2024 stunting values in each LGU category.",
      source: "Source: 2024 Operation Timbang Plus / DOH-NNC.",
    },
    ppan: {
      description: "Shows PPAN priority provinces by need score, separate from WHO stunting levels.",
      source: "Source: Philippine Plan of Action for Nutrition 2023-2028.",
    },
  };
  layerNote.textContent = notes[currentLayer].description;
  layerSource.textContent = notes[currentLayer].source;
  currentLayerLabel.textContent = getLayerDisplayName();
}

function renderWhoFilter() {
  const counts = getClassCounts();
  const order = currentLayer === "ppan" ? PPAN_ORDER : CLASS_ORDER.filter((item) => item !== "No data");
  const colors = currentLayer === "ppan" ? PPAN_COLORS : metadata.whoColors;
  whoFilter.innerHTML = order
    .map((level) => {
      const color = colors[level] || metadata.whoColors["No data"];
      const range = currentLayer === "ppan" ? "" : ` <span class="legend-range">${WHO_RANGES[level]}</span>`;
      return `
        <button class="who-button${activeClass === level ? " is-active" : ""}" type="button" data-level="${level}" style="background:${hexToRgba(color, 0.13)};border-color:${hexToRgba(color, 0.32)}">
          <span class="swatch" style="background:${color}"></span>
          <strong>${level}${range}</strong>
          <span>${counts[level] || 0}</span>
        </button>
      `;
    })
    .join("");
  whoFilter.querySelectorAll("[data-level]").forEach((button) => {
    button.addEventListener("click", () => {
      activeClass = activeClass === button.dataset.level ? null : button.dataset.level;
      updateView();
    });
  });
}

function renderStaticWidgets() {
  renderProfileWidget();
}

function renderProfileWidget() {
  const content = PROFILE_CONTENT[activeProfile];
  const rows = metadata.profiles?.[activeProfile] || [];
  profileNote.textContent = content.note;
  profileSummary.innerHTML = `
    <span class="summary-kicker">${content.kicker}</span>
    <strong>${content.title}</strong>
    <span>${content.detail}</span>
  `;
  profilePreview.textContent = content.detail;
  profileSource.textContent = content.source;
  renderMiniBars(profileBars, rows, content.color, content.highlight);
}

function renderDynamicWidgets() {
  const filtered = filterFeatures(getCurrentFeatures());
  activeFilterLabel.textContent = activeClass || "All";
  distributionTitle.textContent = getDistributionTitle();
  distributionNote.textContent = getDistributionNote();
  distributionSource.textContent = getLayerSource();
  rankingSource.textContent = getLayerSource();
  renderDistribution();
  renderRanking(filtered);
}

function getDistributionTitle() {
  if (currentLayer === "region") return "Distribution of Stunting Levels by Region";
  if (currentLayer === "province") return "Distribution of Stunting Levels by Province/HUC";
  if (currentLayer === "lgu") return "Distribution of Top 10 per Category";
  return "Distribution of PPAN Need Scores";
}

function getDistributionNote() {
  if (currentLayer === "region") return "WHO levels classify prevalence using public-health cut-off values. Bars show how many regions fall in each level.";
  if (currentLayer === "province") return "Bars show DOST-FNRI ENNS province/HUC classifications. These values are not from one uniform year.";
  if (currentLayer === "lgu") return "Bars classify the top 10 entries within each 2024 LGU category: provinces, HUCs/ICCs, cities, and municipalities.";
  return "Bars show PPAN priority provinces grouped by need-score band.";
}

function getLayerDisplayName() {
  if (currentLayer === "region") return "Region";
  if (currentLayer === "province") return "Province/HUC";
  if (currentLayer === "lgu") return activeCategory === "All" ? "Top 10 by Category" : `Top 10: ${activeCategory}`;
  return "PPAN";
}

function getLayerSource() {
  if (currentLayer === "region") return "Source: DOST-FNRI 2025 Updating Survey - Anthropometry, p. 10; WHO-UNICEF TEAM 2019 cut-off values on p. 6.";
  if (currentLayer === "province") return "Source: DOST-FNRI Expanded National Nutrition Survey 2018, 2019, and 2021.";
  if (currentLayer === "lgu") return "Source: 2024 Operation Timbang Plus Report / DOH and National Nutrition Council.";
  return "Source: Philippine Plan of Action for Nutrition 2023-2028.";
}

function getCurrentFeatures() {
  if (currentLayer === "region") return uniqueBy(datasets.region.features, (feature) => feature.properties.name);
  if (currentLayer === "province" || currentLayer === "ppan") return datasets.province.features;
  return datasets.lgu.features;
}

function filterFeatures(features) {
  return features.filter((feature) => {
    const props = feature.properties;
    if (currentLayer === "ppan") return props.ppan_level !== "No data" && (!activeClass || props.ppan_level === activeClass);
    if (activeClass && props.level !== activeClass) return false;
    if (currentLayer === "lgu" && activeCategory !== "All" && props.type !== activeCategory) return false;
    return true;
  });
}

function getClassCounts() {
  const counts = {};
  for (const feature of getCurrentFeatures()) {
    const props = feature.properties;
    if (currentLayer === "lgu" && activeCategory !== "All" && props.type !== activeCategory) continue;
    const key = currentLayer === "ppan" ? props.ppan_level : props.level;
    if (currentLayer === "ppan" && key === "No data") continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function renderDistribution() {
  const counts = getClassCounts();
  const max = Math.max(1, ...Object.values(counts));
  const order = currentLayer === "ppan" ? PPAN_ORDER : CLASS_ORDER.filter((item) => item !== "No data");
  const colors = currentLayer === "ppan" ? PPAN_COLORS : metadata.whoColors;
  distributionSummary.innerHTML = distributionSummaryHtml(counts, order);
  distributionPreview.textContent = distributionPreviewText(counts, order);
  classBars.innerHTML = order
    .map((level) => {
      const count = counts[level] || 0;
      const range = currentLayer === "ppan" ? PPAN_RANGES[level] : WHO_RANGES[level];
      return distributionBarHtml(level, count, max, colors[level] || "#d6dce2", String(count), range);
    })
    .join("");
}

function distributionPreviewText(counts, order) {
  const total = order.reduce((sum, level) => sum + (counts[level] || 0), 0);
  const topLevel = order.map((level) => ({ level, count: counts[level] || 0 })).sort((a, b) => b.count - a.count)[0];
  if (!topLevel || !total) return "No areas available";
  const unit = currentLayer === "region" ? "regions" : currentLayer === "province" ? "province/HUC areas" : currentLayer === "ppan" ? "priority provinces" : "LGU markers";
  const verb = topLevel.count === 1 ? "is" : "are";
  return `${topLevel.count} of ${total} ${unit} ${verb} ${topLevel.level}`;
}

function distributionSummaryHtml(counts, order) {
  const total = order.reduce((sum, level) => sum + (counts[level] || 0), 0);
  if (currentLayer === "ppan") {
    const highestBand = order[order.length - 1];
    return `<p><strong>${counts[highestBand] || 0} of ${total}</strong> PPAN priority provinces are in the highest need-score band <strong class="summary-level">${highestBand}</strong>.</p>`;
  }
  const topLevel = order.map((level) => ({ level, count: counts[level] || 0 })).sort((a, b) => b.count - a.count)[0];
  const share = total ? ((topLevel.count / total) * 100).toFixed(1) : "0.0";
  if (currentLayer === "region") {
    return `<p>In 2025, <strong>${topLevel.count} of ${total} regions</strong> are classified <strong class="summary-level">${topLevel.level}</strong> (${share}%). <strong>${counts["Very High"] || 0}</strong> regions are Very High.</p>`;
  }
  return `<p>Most areas fall under <strong class="summary-level">${topLevel.level}</strong>: <strong>${topLevel.count} of ${total}</strong>.</p>`;
}

function distributionBarHtml(label, value, max, color, displayValue, range = "") {
  const width = Math.max(3, Math.round((value / max) * 100));
  return `
    <button class="bar-row distribution-bar${activeClass === label ? " is-active" : ""}" type="button" data-level="${label}" aria-pressed="${activeClass === label}">
      <div class="bar-row-header">
        <span class="bar-label">${label}${range ? `<span class="bar-range">${range}</span>` : ""}</span>
        <span>${displayValue}</span>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${width}%;background:${color}"></div></div>
    </button>
  `;
}

function renderRanking(features) {
  let rows = [...features];
  let title = "Highest Regional Prevalence";
  let getValue = (feature) => feature.properties.prevalence_2025;
  if (currentLayer === "province") {
    title = "Highest Province/HUC Baseline";
    rankingNote.textContent = "DOST-FNRI ENNS values use the available collection year for each province/HUC.";
    getValue = (feature) => feature.properties.enns_prevalence;
  } else if (currentLayer === "lgu") {
    title = "Highest LGU Values by Category";
    rankingNote.textContent = "The layer shows top 10 lists by category, not one combined national top 40 ranking.";
    getValue = (feature) => feature.properties.prevalence;
  } else if (currentLayer === "ppan") {
    title = "Highest PPAN Need Scores";
    rankingNote.textContent = "Need score is a policy-priority measure, not a prevalence class.";
    getValue = (feature) => feature.properties.ppan_need_score;
  } else {
    rankingNote.textContent = "Top regions by 2025 DOST-FNRI prevalence. WHO level is shown for each row.";
  }
  rankingTitle.textContent = title;
  rows = rows.filter((feature) => typeof getValue(feature) === "number").sort((a, b) => getValue(b) - getValue(a)).slice(0, 8);
  currentRankingFeatures = rows;
  if (rows.length) {
    const suffix = currentLayer === "ppan" ? "" : "%";
    const display = rankingName(rows[0].properties.name);
    rankingPreview.textContent = `Highest: ${display.title}, ${formatNumber(getValue(rows[0]))}${suffix}`;
  } else {
    rankingPreview.textContent = "No ranked areas for this selection";
  }
  const maxValue = Math.max(1, ...rows.map((feature) => getValue(feature)));
  rankingList.innerHTML = rows
    .map((feature, index) => {
      const value = getValue(feature);
      const suffix = currentLayer === "ppan" ? "" : "%";
      const display = rankingName(feature.properties.name);
      const level = currentLayer === "ppan" ? feature.properties.ppan_level : feature.properties.level;
      const colors = currentLayer === "ppan" ? PPAN_COLORS : metadata.whoColors;
      const color = colors[level] || metadata.whoColors["No data"];
      const width = Math.max(5, Math.round((value / maxValue) * 100));
      return `
        <button class="rank-item" type="button" data-rank-index="${index}">
          <span class="rank-number">${index + 1}</span>
          <div class="rank-main">
            <span class="rank-name">${display.title}</span>
            ${display.meta ? `<span class="rank-meta">${display.meta}</span>` : ""}
            <span class="rank-track"><span class="rank-fill" style="width:${width}%;background:${color}"></span></span>
          </div>
          <div class="rank-metric">
            <span class="rank-value">${formatNumber(value)}${suffix}</span>
            ${rankingLevelPill(level, color)}
          </div>
        </button>
      `;
    })
    .join("");
}

function rankingName(name) {
  const match = name.match(/^(.*?)\s+\(([^)]+)\)$/);
  if (!match) return { title: name, meta: "" };
  const baseName = match[1];
  const parenthetical = match[2];
  return baseName.startsWith("Region ") ? { title: parenthetical, meta: baseName } : { title: parenthetical, meta: baseName };
}

function rankingLevelPill(level, color) {
  if (!level || level === "No data") return "";
  const lightClass = ["Very Low", "Low", "Medium", "< 18.49", "18.49-20.98", "20.98-25.89"].includes(level) ? " is-light" : "";
  return `<span class="rank-level${lightClass}" style="background:${color}">${level}</span>`;
}

function focusFeature(feature) {
  const layerId = layerIdForCurrentLayer();
  const bounds = featureBounds(feature);
  const center = featureCenter(feature);
  if (bounds) {
    map.fitBounds(bounds, { padding: 90, maxZoom: currentLayer === "region" ? 7 : 8.5, duration: 900 });
  } else if (center) {
    map.flyTo({ center, zoom: Math.max(map.getZoom(), 8), duration: 900 });
  }
  if (center) showPopup(feature, center, layerId);
}

function layerIdForCurrentLayer() {
  if (currentLayer === "province") return "province-fill";
  if (currentLayer === "ppan") return "ppan-fill";
  if (currentLayer === "lgu") return "lgu-circle";
  return "region-fill";
}

function featureCenter(feature) {
  if (feature.geometry?.type === "Point") return feature.geometry.coordinates;
  const bounds = featureBounds(feature);
  if (!bounds) return null;
  return [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
}

function featureBounds(feature) {
  const coords = [];
  collectCoordinates(feature.geometry?.coordinates, coords);
  if (!coords.length) return null;
  const lngs = coords.map((coord) => coord[0]);
  const lats = coords.map((coord) => coord[1]);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

function collectCoordinates(input, output) {
  if (!Array.isArray(input)) return;
  if (typeof input[0] === "number" && typeof input[1] === "number") {
    output.push(input);
    return;
  }
  for (const item of input) collectCoordinates(item, output);
}

function renderMiniBars(container, rows, color, highlightLabel = "") {
  const max = Math.max(...rows.map((row) => row.value));
  container.innerHTML = rows
    .map((row) => {
      const width = Math.max(3, Math.round((row.value / max) * 100));
      return `
        <div class="bar-row${row.label === highlightLabel ? " is-highlighted" : ""}">
          <div class="bar-row-header"><span>${row.label}</span><span>${formatNumber(row.value)}%</span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${width}%;background:${color}"></div></div>
        </div>
      `;
    })
    .join("");
}

function showPopup(feature, lngLat, layerId) {
  const props = feature.properties;
  const html = popupHtml(props, layerId);
  popup.setLngLat(lngLat).setHTML(html).addTo(map);
  selectedArea.innerHTML = detailHtml(props, layerId);
  selectedPreview.textContent = props.name ? `Selected: ${props.name}` : "Area selected";
}

function popupHtml(props, layerId) {
  if (layerId === "region-fill") {
    return `
      <h3 class="popup-title">${props.name}</h3>
      <div class="popup-section">
        <p class="popup-section-title">Latest Data</p>
        <div class="popup-fact"><span>Stunting prevalence (2025)</span><strong>${formatNumber(props.prevalence_2025)}%</strong></div>
        <div class="popup-fact"><span>Level of stunting prevalence</span>${levelPill(props.level)}</div>
      </div>
      <div class="popup-section">
        <p class="popup-section-title">Previous Data</p>
        ${regionPreviousDataHtml(props)}
      </div>
      <div class="popup-section">
        <p class="popup-section-title">Population</p>
        <div class="popup-fact"><span>Total population (2024)</span><strong>${props.population_2024 || "Not available"}</strong></div>
        <div class="popup-fact"><span>Urban population (2020)</span><strong>${props.urban_2020 || "-"}</strong></div>
        <div class="popup-fact"><span>Rural population (2020)</span><strong>${props.rural_2020 || "-"}</strong></div>
      </div>
    `;
  }
  if (layerId === "ppan-fill") {
    return `
      <h3 class="popup-title">${props.name}</h3>
      <p class="popup-line"><strong>Need score:</strong> ${formatNumber(props.ppan_need_score)}</p>
      <p class="popup-line"><strong>Financial support priority:</strong> ${props.ppan_financial_priority || "Not available"}</p>
      <p class="popup-line">Need score is computed as the average of malnutrition and food insecurity indicators.</p>
      <p class="popup-line"><strong>Source:</strong> Philippine Plan of Action for Nutrition 2023-2028</p>
    `;
  }
  if (layerId === "lgu-circle") {
    return `
      <h3 class="popup-title">${props.name}</h3>
      <p class="popup-line"><strong>Rank:</strong> ${props.rank} within ${props.type}</p>
      <p class="popup-line"><strong>Stunting prevalence:</strong> ${formatNumber(props.prevalence)}%</p>
      <p class="popup-line"><strong>Source:</strong> ${props.source}</p>
    `;
  }
  return `
    <h3 class="popup-title">${props.name}</h3>
    <p class="popup-line"><strong>DOST-FNRI ENNS:</strong> ${formatMaybePercent(props.enns_prevalence)} (${props.enns_year || "year unavailable"})</p>
    <p class="popup-line"><strong>2025 OPT+:</strong> ${formatOpt(props.opt_2025_prevalence)}</p>
    <p class="popup-line"><strong>Note:</strong> ENNS and OPT+ values are cross-source context, not a clean trend.</p>
  `;
}

function detailHtml(props, layerId) {
  if (layerId === "region-fill") {
    return `
      <p class="detail-title">${props.name}</p>
      <div class="detail-fact"><span>2025 prevalence</span><strong>${formatNumber(props.prevalence_2025)}%</strong></div>
      <div class="detail-fact"><span>WHO level</span>${levelPill(props.level)}</div>
      ${regionPreviousDetailHtml(props)}
      <div class="detail-fact"><span>Population 2024</span><strong>${props.population_2024 || "-"}</strong></div>
    `;
  }
  if (layerId === "ppan-fill") {
    return `
      <p class="detail-title">${props.name}</p>
      <div class="detail-fact"><span>Need score</span><strong>${formatNumber(props.ppan_need_score)}</strong></div>
      <div class="detail-fact"><span>Financial support priority</span><strong>${props.ppan_financial_priority || "-"}</strong></div>
    `;
  }
  if (layerId === "lgu-circle") {
    return `
      <p class="detail-title">${props.name}</p>
      <div class="detail-fact"><span>Rank</span><strong>${props.rank}</strong></div>
      <div class="detail-fact"><span>Category</span><strong>${props.type}</strong></div>
      <div class="detail-fact"><span>Prevalence</span><strong>${formatNumber(props.prevalence)}%</strong></div>
    `;
  }
  return `
    <p class="detail-title">${props.name}</p>
    <div class="detail-fact"><span>ENNS prevalence</span><strong>${formatMaybePercent(props.enns_prevalence)}</strong></div>
    <div class="detail-fact"><span>ENNS year</span><strong>${props.enns_year || "-"}</strong></div>
    <div class="detail-fact"><span>2025 OPT+</span><strong>${formatOpt(props.opt_2025_prevalence)}</strong></div>
  `;
}

function levelPill(level) {
  const color = metadata.whoColors[level] || metadata.whoColors["No data"];
  const lightClass = ["Very Low", "Low", "Medium", "No data"].includes(level) ? " is-light" : "";
  return `<strong class="level-pill${lightClass}" style="background:${color}">${level}</strong>`;
}

function regionPreviousDataHtml(props) {
  if (typeof props.prevalence_2023 !== "number") {
    return `<p class="popup-line">No 2023 comparison is available for this regional geography.</p>`;
  }
  return `
    <div class="popup-fact"><span>2023 prevalence</span><strong>${formatMaybePercent(props.prevalence_2023)}</strong></div>
    <div class="popup-fact"><span>Change from 2023</span><strong>${formatChange(props.change_2023_2025)}</strong></div>
  `;
}

function regionPreviousDetailHtml(props) {
  if (typeof props.prevalence_2023 !== "number") {
    return `<div class="detail-fact"><span>Previous comparison</span><strong>Not available</strong></div>`;
  }
  return `<div class="detail-fact"><span>2023 prevalence</span><strong>${formatMaybePercent(props.prevalence_2023)}</strong></div>`;
}

function formatMaybePercent(value) {
  return typeof value === "number" ? `${formatNumber(value)}%` : "Not available";
}

function formatOpt(value) {
  return typeof value === "number" ? `${formatNumber(value)}%` : "Not available";
}

function formatChange(value) {
  if (typeof value !== "number") return "Not available";
  return `${value > 0 ? "+" : ""}${formatNumber(value)} pts`;
}

function formatNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return "Not available";
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function uniqueBy(items, getKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hexToRgba(hex, alpha) {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((char) => char + char).join("") : value;
  const number = Number.parseInt(full, 16);
  const red = (number >> 16) & 255;
  const green = (number >> 8) & 255;
  const blue = number & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
