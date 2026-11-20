const DATASETS = {
  region: {
    label: "Regional",
    url: "./data/region.geojson?v=20260821-6",
    center: [121.774, 12.8797],
    zoom: 5.2,
    fitMaxZoom: 5.1,
  },
  province: {
    label: "Provincial",
    url: "./data/province.geojson?v=20260821-6",
    center: [121.774, 12.8797],
    zoom: 5.5,
    fitMaxZoom: 5.35,
  },
  municipality: {
    label: "Municipalities / Cities",
    url: "./data/municipality.geojson?v=20260821-6",
    center: [121.774, 12.8797],
    zoom: 5.5,
    fitMaxZoom: 5.5,
  },
};

const COLOR_RAMP = ["#fff4cc", "#f8d98b", "#e9ad59", "#ca7138", "#8d2b20"];
const DIM_FILL = "#e8e3d8";
const DIM_LINE = "#b8b0a2";
const ACTIVE_LINE = "#645441";
const STORAGE_KEY = "religion-atlas-mapbox-token";
const METADATA_URL = "./data/metadata.json";
const IS_FILE_PROTOCOL = window.location.protocol === "file:";
const MAX_BOUNDS = [
  [104.0, -2.0],
  [133.5, 27.5],
];
const PHILIPPINES_VIEW_BOUNDS = [
  [114.5, 3.5],
  [127.8, 21.8],
];

const statusBanner = document.getElementById("status-banner");
const tokenInput = document.getElementById("token-input");
const loadMapBtn = document.getElementById("load-map-btn");
const copyLinkBtn = document.getElementById("copy-link-btn");
const geographySelect = document.getElementById("geography-select");
const religionSelect = document.getElementById("religion-select");
const legend = document.getElementById("legend");
const legendValueType = document.getElementById("legend-value-type");
const legendNote = document.getElementById("legend-note");
const summary = document.getElementById("summary");
const quickKpis = document.getElementById("quick-kpis");
const quickNarrative = document.getElementById("quick-narrative");
const donutChart = document.getElementById("donut-chart");
const donutLegend = document.getElementById("donut-legend");
const top5RegionNote = document.getElementById("top5-region-note");
const top5RegionChart = document.getElementById("top5-region-chart");
const top15Chart = document.getElementById("top15-chart");
const filteredNarrative = document.getElementById("filtered-narrative");
const filteredCurrent = document.getElementById("filtered-current");
const filteredShareBlock = document.getElementById("filtered-share-block");
const filteredKpis = document.getElementById("filtered-kpis");
const filteredChartLabel = document.getElementById("filtered-chart-label");
const filteredRankChart = document.getElementById("filtered-rank-chart");
const sidebar = document.querySelector(".sidebar");
const accordionSections = [...document.querySelectorAll(".accordion")];
const accordionShortcuts = [...document.querySelectorAll(".accordion-shortcut")];

const QUICK_COLORS = ["#8d2b20", "#c45e34", "#d7a159", "#e7c67d", "#8f9b77"];

let map;
let popup;
let metadata;
let loadedData = {};
let currentGeography = "region";
let currentReligion = "";
let currentMeasure = "count";
let resizeTimer;
let regionTooltip;

bootstrap().catch((error) => {
  console.error(error);
  setStatus("The atlas controls did not load correctly.");
});

async function bootstrap() {
  metadata = await fetchJson(METADATA_URL);
  await ensureDatasetLoaded("region");
  const params = new URLSearchParams(window.location.search);

  currentGeography = params.get("geography") || metadata.geographies[0] || "region";
  currentReligion = params.get("religion") || metadata.defaultReligion;
  currentMeasure = "count";

  tokenInput.value = localStorage.getItem(STORAGE_KEY) || metadata.defaultToken || "";

  populateReligionSelect();
  geographySelect.value = currentGeography;
  religionSelect.value = currentReligion;
  renderSummary();
  renderQuickNumbers();

  bindEvents();

  if (tokenInput.value) {
    await loadMap();
  } else {
    setStatus("Paste your Mapbox token, then click Load map.");
  }
}

function bindEvents() {
  loadMapBtn.addEventListener("click", () => {
    loadMap().catch((error) => {
      console.error(error);
      setStatus("The map did not load. Double-check the token and try again.");
    });
  });

  copyLinkBtn.addEventListener("click", async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("geography", currentGeography);
    url.searchParams.set("religion", currentReligion);
    url.searchParams.set("measure", currentMeasure);
    try {
      await navigator.clipboard.writeText(url.toString());
      setStatus("Share link copied. Once the site is hosted online, that link is ready to send.");
    } catch (error) {
      console.error(error);
      setStatus("The link could not be copied automatically.");
    }
  });

  geographySelect.addEventListener("change", async (event) => {
    currentGeography = event.target.value;
    if (map) {
      await ensureDatasetLoaded(currentGeography);
      updateMapData();
    }
    updateUrlState();
  });

  religionSelect.addEventListener("change", () => {
    currentReligion = religionSelect.value;
    updateMapData();
    updateUrlState();
  });

  for (const section of accordionSections) {
    const toggle = section.querySelector(".accordion-toggle");
    if (!toggle) {
      continue;
    }
    toggle.addEventListener("click", () => {
      openAccordion(section.dataset.accordion);
    });
  }

  for (const shortcut of accordionShortcuts) {
    shortcut.addEventListener("click", () => {
      openAccordion(shortcut.dataset.accordionTarget, true);
    });
  }

  window.addEventListener("resize", () => {
    if (!map || !loadedData[currentGeography]) {
      return;
    }
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      map.resize();
      fitMapToWindow();
    }, 120);
  });
}

function openAccordion(targetName, shouldScroll = false) {
  for (const section of accordionSections) {
    const isTarget = section.dataset.accordion === targetName;
    section.classList.toggle("is-open", isTarget);
    const toggle = section.querySelector(".accordion-toggle");
    if (toggle) {
      toggle.setAttribute("aria-expanded", isTarget ? "true" : "false");
    }
  }

  for (const shortcut of accordionShortcuts) {
    shortcut.classList.toggle("is-active", shortcut.dataset.accordionTarget === targetName);
  }

  if (shouldScroll && sidebar) {
    const targetSection = accordionSections.find((section) => section.dataset.accordion === targetName);
    if (targetSection) {
      const offsetTop = targetSection.offsetTop - 72;
      sidebar.scrollTo({
        top: Math.max(0, offsetTop),
        behavior: "smooth",
      });
    }
  }
}

function populateReligionSelect() {
  religionSelect.innerHTML = "";
  const featuredLabels = [
    "Roman Catholic, excluding Catholic Charismatics",
    "Islam",
    "Iglesia ni Cristo",
  ];
  const religions = [...metadata.religions];
  const featured = [];
  const remaining = [];

  for (const religion of religions) {
    if (featuredLabels.includes(religion.label)) {
      featured.push(religion);
    } else {
      remaining.push(religion);
    }
  }

  featured.sort(
    (a, b) => featuredLabels.indexOf(a.label) - featuredLabels.indexOf(b.label)
  );
  remaining.sort((a, b) => a.label.localeCompare(b.label));

  for (const religion of featured) {
    const option = document.createElement("option");
    option.value = religion.key;
    option.textContent = religion.label;
    religionSelect.append(option);
  }

  if (featured.length && remaining.length) {
    const separator = document.createElement("option");
    separator.disabled = true;
    separator.textContent = "-------------";
    religionSelect.append(separator);
  }

  for (const religion of remaining) {
    const option = document.createElement("option");
    option.value = religion.key;
    option.textContent = religion.label;
    religionSelect.append(option);
  }
}

async function loadMap() {
  const token = tokenInput.value.trim();
  if (!token) {
    setStatus("Paste your public Mapbox token first.");
    return;
  }

  loadMapBtn.disabled = true;
  localStorage.setItem(STORAGE_KEY, token);
  setStatus("Loading Mapbox and your religion atlas...");

  await ensureDatasetLoaded(currentGeography);

  if (!map) {
    mapboxgl.accessToken = token;
    map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/light-v11",
      center: DATASETS[currentGeography].center,
      zoom: DATASETS[currentGeography].zoom,
      minZoom: 2.15,
      projection: "mercator",
      renderWorldCopies: false,
      maxBounds: MAX_BOUNDS,
      attributionControl: true,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.addControl(createFitControl(), "top-right");
    popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: "360px",
    });

    map.on("load", () => {
      addMapLayers();
      finalizeLoadedState();
      updateMapData();
    });
  } else {
    mapboxgl.accessToken = token;
    finalizeLoadedState();
    updateMapData();
  }
}

function finalizeLoadedState() {
  geographySelect.disabled = false;
  religionSelect.disabled = false;
  loadMapBtn.disabled = false;
}

async function ensureDatasetLoaded(geography) {
  if (!loadedData[geography]) {
    loadedData[geography] = await fetchJson(DATASETS[geography].url);
  }
  return loadedData[geography];
}

function addMapLayers() {
  if (map.getSource("religion-source")) {
    return;
  }

  map.addSource("religion-source", {
    type: "geojson",
    data: loadedData[currentGeography],
  });

  map.addLayer({
    id: "religion-fill",
    type: "fill",
    source: "religion-source",
    paint: {
      "fill-color": DIM_FILL,
      "fill-opacity": 0.86,
    },
  });

  map.addLayer({
    id: "religion-outline",
    type: "line",
    source: "religion-source",
    paint: {
      "line-color": ACTIVE_LINE,
      "line-width": [
        "case",
        ["==", ["get", "join_status"], "matched"],
        0.95,
        0.4,
      ],
      "line-opacity": 0.7,
    },
  });

  map.on("mousemove", "religion-fill", (event) => {
    const feature = event.features && event.features[0];
    if (!feature) {
      return;
    }
    map.getCanvas().style.cursor = "pointer";
    popup
      .setLngLat(event.lngLat)
      .setHTML(buildPopupHtml(feature.properties))
      .addTo(map);
  });

  map.on("mouseleave", "religion-fill", () => {
    map.getCanvas().style.cursor = "";
    popup.remove();
  });
}

function updateMapData() {
  const geojson = loadedData[currentGeography];
  if (!map || !geojson || !map.getSource("religion-source")) {
    return;
  }

  map.getSource("religion-source").setData(geojson);

  const breaks = computeBreaks(geojson.features);
  const fillExpression = buildFillExpression(breaks);
  map.setPaintProperty("religion-fill", "fill-color", fillExpression);
  updateFillOpacity();
  renderLegend(breaks);
  renderSummary(geojson);
  renderQuickNumbers();
  fitMapToWindow();

  setStatus(
    `
      <p class="status-banner-label">Current Filters Applied</p>
      <p class="status-banner-value">${currentReligionLabel()}</p>
      <p class="status-banner-sub">${DATASETS[currentGeography].label} view</p>
    `
  );
}

function computeBreaks(features) {
  const values = features
    .filter((feature) => feature.properties.join_status === "matched")
    .map((feature) => featureMetricValue(feature.properties))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (values.length === 0) {
    return [0, 0, 0, 0];
  }

  return [0.2, 0.4, 0.6, 0.8].map((step) => quantile(values, step));
}

function featureMetricValue(properties) {
  const count = Number(properties[currentReligion]);
  const population = Number(properties.household_population);

  if (!Number.isFinite(count)) {
    return NaN;
  }

  if (currentMeasure === "share") {
    if (!Number.isFinite(population) || population <= 0) {
      return NaN;
    }
    return (count / population) * 100;
  }

  return count;
}

function quantile(values, q) {
  if (values.length === 1) {
    return values[0];
  }
  const index = (values.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return values[lower];
  }
  const weight = index - lower;
  return values[lower] * (1 - weight) + values[upper] * weight;
}

function buildFillExpression(breaks) {
  const selected = currentReligion;
  const valueExpression =
    currentMeasure === "share"
      ? [
          "*",
          [
            "/",
            ["to-number", ["coalesce", ["get", selected], 0]],
            ["max", ["to-number", ["coalesce", ["get", "household_population"], 0]], 1],
          ],
          100,
        ]
      : ["to-number", ["coalesce", ["get", selected], 0]];

  return [
    "case",
    ["!=", ["get", "join_status"], "matched"],
    DIM_FILL,
    ["step", valueExpression, COLOR_RAMP[0], breaks[0], COLOR_RAMP[1], breaks[1], COLOR_RAMP[2], breaks[2], COLOR_RAMP[3], breaks[3], COLOR_RAMP[4]],
  ];
}

function updateFillOpacity() {
  const opacity = [
    "case",
    ["==", ["get", "join_status"], "matched"],
    0.86,
    0.12,
  ];

  map.setPaintProperty("religion-fill", "fill-opacity", opacity);
  map.setPaintProperty("religion-outline", "line-color", [
    "case",
    ["==", ["get", "join_status"], "matched"],
    ACTIVE_LINE,
    DIM_LINE,
  ]);
}

function renderLegend(breaks) {
  legend.innerHTML = "";
  legendValueType.textContent = currentMeasure === "share" ? "Share" : "Count";
  legendNote.textContent =
    "For the selected religious affiliation, the legend automatically groups household population counts into five ranges, from highest to lowest.";

  const labels = [
    `Below ${formatMetricValue(breaks[0])}`,
    `${formatMetricValue(breaks[0])} to ${formatMetricValue(breaks[1])}`,
    `${formatMetricValue(breaks[1])} to ${formatMetricValue(breaks[2])}`,
    `${formatMetricValue(breaks[2])} to ${formatMetricValue(breaks[3])}`,
    `Above ${formatMetricValue(breaks[3])}`,
  ];

  [...COLOR_RAMP]
    .map((color, index) => ({
      color,
      label: labels[index],
    }))
    .reverse()
    .forEach(({ color, label }) => {
    const row = document.createElement("div");
    row.className = "legend-row";
    row.innerHTML = `
      <span class="legend-swatch" style="background:${color}"></span>
      <span>${label}</span>
    `;
    legend.append(row);
  });

  const dimRow = document.createElement("div");
  dimRow.className = "legend-row";
  dimRow.innerHTML = `
    <span class="legend-swatch" style="background:${DIM_FILL}"></span>
    <span>No matched data</span>
  `;
  legend.append(dimRow);
}

function renderSummary(geojson = loadedData[currentGeography]) {
  if (!geojson) {
    summary.innerHTML = `
      <p>Choose a geography level and religion to color the map.</p>
      <p>The hover popup will show the selected religion, its local share, and the total household population.</p>
    `;
    return;
  }

  const matched = geojson.features.filter(
    (feature) => feature.properties.join_status === "matched"
  );
  const values = matched
    .map((feature) => featureMetricValue(feature.properties))
    .filter((value) => Number.isFinite(value));
  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : 0;

  const note =
    currentGeography === "region"
      ? "Regional view is aggregated from province boundaries so you can still compare regions cleanly."
      : currentGeography === "province"
        ? "Province boundaries are shown on a flat map projection, with NCR displayed as a single comparable unit for easier comparison with provinces."
        : "Municipal and city-level data are not available nationwide. This view highlights only the highly urbanized cities and NCR local government units reported separately in the PSA source table.";

  summary.innerHTML = `
    <p>${note}</p>
    <p><strong>${matched.length}</strong> matched areas are currently shown for <strong>${currentReligionLabel()}</strong>.</p>
    <p>Value range: <strong>${formatMetricValue(minValue)}</strong> to <strong>${formatMetricValue(maxValue)}</strong>.</p>
  `;
}

function fitToDatasetBounds(features) {
  const bounds = new mapboxgl.LngLatBounds();
  let hasFeature = false;

  for (const feature of features) {
    extendBounds(bounds, feature.geometry.coordinates, feature.geometry.type);
    hasFeature = true;
  }

  if (hasFeature) {
    const padding = window.innerWidth <= 640 ? 28 : window.innerWidth <= 1080 ? 36 : 52;
    map.fitBounds(bounds, {
      padding,
      duration: 700,
      maxZoom: DATASETS[currentGeography].fitMaxZoom,
    });
  }
}

function fitMapToWindow() {
  if (!map) {
    return;
  }

  const viewportWidth = window.innerWidth;
  const isMobile = viewportWidth <= 640;
  const isTablet = viewportWidth <= 1080;
  const sidebarWidth = !isTablet && sidebar ? sidebar.getBoundingClientRect().width : 0;
  const leftPadding = isMobile ? 20 : isTablet ? 28 : Math.max(48, Math.round(sidebarWidth * 0.22));
  const rightPadding = isMobile ? 20 : isTablet ? 28 : 68;
  const topPadding = isMobile ? 32 : isTablet ? 34 : 42;
  const bottomPadding = isMobile ? 28 : isTablet ? 30 : 40;

  map.fitBounds(PHILIPPINES_VIEW_BOUNDS, {
    padding: {
      top: topPadding,
      right: rightPadding,
      bottom: bottomPadding,
      left: leftPadding,
    },
    duration: 700,
    bearing: 0,
    pitch: 0,
    maxZoom: isMobile ? 4.7 : isTablet ? 4.35 : 3.95,
  });
}

function createFitControl() {
  class FitControl {
    onAdd() {
      this._outer = document.createElement("div");
      this._outer.className = "mapboxgl-ctrl mapboxgl-ctrl-group";
      this._button = document.createElement("button");
      this._button.className = "atlas-fit-btn";
      this._button.type = "button";
      this._button.title = "Reset to Philippines view";
      this._button.setAttribute("aria-label", "Reset to Philippines view");
      this._button.textContent = "⌂";
      this._button.addEventListener("click", () => fitMapToWindow());
      this._outer.appendChild(this._button);
      return this._outer;
    }

    onRemove() {
      this._outer.remove();
    }
  }

  return new FitControl();
}

function buildPopupHtml(properties) {
  const areaName = properties.area_name || properties.psgc_geo_name || properties.name || "Area";
  const count = Number(properties[currentReligion]);
  const population = Number(properties.household_population);
  const religionLabel = currentReligionLabel();
  const share =
    Number.isFinite(count) && Number.isFinite(population) && population > 0
      ? (count / population) * 100
      : NaN;
  const affiliationShare = Number.isFinite(share) ? Math.min(Math.max(share, 0), 100) : 0;
  const otherShare = Number.isFinite(share) ? Math.max(100 - affiliationShare, 0) : 0;
  const isMatched = properties.join_status === "matched";
  const showBoundaryNote =
    properties.legacy_note &&
    (properties.display_level === "Province" || areaName === "Maguindanao");
  const legacyNote = showBoundaryNote
    ? `<span>Boundary note</span><strong>${properties.legacy_note}</strong>`
    : "";
  const unmatchedNote = !isMatched
    ? `<p class="popup-note">No data match is available for this area in the current map layer.</p>`
    : "";
  const donutGradient = Number.isFinite(share)
    ? `conic-gradient(var(--accent) 0 ${affiliationShare}%, #e8e8ed ${affiliationShare}% 100%)`
    : "conic-gradient(#e8e8ed 0 100%)";

  return `
    <p class="popup-kicker">${properties.display_level || "Geography"}</p>
    <h3 class="popup-title">${areaName}</h3>
    ${unmatchedNote}
    <div class="popup-table">
      <span>Religious Affiliation</span><strong>${religionLabel}</strong>
      <span>Household Population Affiliated<br>with ${religionLabel}</span><strong>${formatCount(count)}</strong>
      <span>Total Household Population</span><strong>${formatCount(population)}</strong>
      ${legacyNote}
    </div>
    <div class="popup-donut-block" aria-label="Selected religious affiliation share">
      <div class="popup-donut" style="background:${donutGradient}">
        <div class="popup-donut-center">
          <strong>${formatPercent(share)}</strong>
          <span>affiliated</span>
        </div>
      </div>
      <div class="popup-donut-legend">
        <div>
          <span class="popup-dot popup-dot-affiliated"></span>
          <span>Household Population with<br>${religionLabel}</span>
          <strong>${Number.isFinite(share) ? formatPercent(affiliationShare) : "N/A"}</strong>
        </div>
        <div>
          <span class="popup-dot popup-dot-other"></span>
          <span>Total Household Population</span>
          <strong>${Number.isFinite(share) ? formatPercent(otherShare) : "N/A"}</strong>
        </div>
      </div>
    </div>
  `;
}

function currentReligionLabel() {
  const match = metadata.religions.find((item) => item.key === currentReligion);
  return match ? match.label : currentReligion;
}

function formatCompactCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "N/A";
  }
  if (Math.abs(number) >= 1_000_000_000) {
    return `${(number / 1_000_000_000).toFixed(2)}B`;
  }
  if (Math.abs(number) >= 1_000_000) {
    return `${(number / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(number) >= 1_000) {
    return `${(number / 1_000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat().format(Math.round(number));
}

function renderQuickNumbers() {
  const national = metadata.national || {};
  const totalPopulation = Number(national.household_population) || 0;
  const top15 = national.top_religions || [];
  const top5 = national.top5_religions || [];
  const narrativeTop3 = national.top3_narrative || [];
  const geojson = loadedData[currentGeography];
  const filteredFeatures = (geojson?.features || [])
    .filter((feature) => feature?.properties?.join_status === "matched")
    .map((feature) => {
      const props = feature.properties;
      const areaLabel = props.area_name || props.psgc_geo_name || props.name || "Area";
      const groupKey =
        currentGeography === "region"
          ? props.psgc_region_name || areaLabel
          : props.psgc_code || areaLabel;
      return {
        groupKey,
        areaName:
          currentGeography === "region" && (props.psgc_region_name === "NCR" || areaLabel === "NCR")
            ? "National Capital Region"
            : areaLabel,
        count: Number(props[currentReligion]),
        population: Number(props.household_population),
      };
    })
    .filter((item) => Number.isFinite(item.count) && Number.isFinite(item.population));
  const selectedNational = (metadata.national.top_religions || []).find(
    (item) => item.key === currentReligion
  );

  if (quickNarrative) {
    if (narrativeTop3.length >= 3) {
      quickNarrative.innerHTML = `
        Of the ${formatCount(totalPopulation)} household population in 2020,
        ${formatCount(narrativeTop3[0].count)} persons (${narrativeTop3[0].share.toFixed(1)}%)
        reported ${narrativeTop3[0].label}. This was followed by
        ${narrativeTop3[1].label} with ${formatCount(narrativeTop3[1].count)}
        (${narrativeTop3[1].share.toFixed(1)}%), and
        ${narrativeTop3[2].label} with ${formatCount(narrativeTop3[2].count)}
        (${narrativeTop3[2].share.toFixed(1)}%).
      `;
    } else {
      quickNarrative.textContent = "";
    }
  }

  quickKpis.innerHTML = `
    <div class="kpi-card">
      <strong title="${formatCount(totalPopulation)}">${formatCompactCount(totalPopulation)}</strong>
      <span>Household population</span>
    </div>
    <div class="kpi-card">
      <strong>${formatCount((metadata.religions || []).length)}</strong>
      <span>Religious affiliations</span>
    </div>
  `;

  const top5Total = top5.reduce((sum, item) => sum + item.count, 0);
  let start = 0;
  const segments = top5.map((item, index) => {
    const portion = top5Total ? (item.count / top5Total) * 100 : 0;
    const end = start + portion;
    const segment = `${QUICK_COLORS[index % QUICK_COLORS.length]} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
    start = end;
    return segment;
  });
  donutChart.style.background = `conic-gradient(${segments.join(", ")})`;
  donutChart.innerHTML = `
    <div class="donut-center">
      <div>
        <strong title="${formatCount(top5Total)}">${formatCompactCount(top5Total)}</strong>
        <span>Top 5 combined</span>
      </div>
    </div>
  `;

  donutLegend.innerHTML = top5
    .map(
      (item, index) => `
        <div class="donut-row">
          <span class="dot" style="background:${QUICK_COLORS[index % QUICK_COLORS.length]}"></span>
          <span>${item.label}</span>
          <strong>${item.share.toFixed(1)}%</strong>
        </div>
      `
    )
    .join("");

  const top5Share = totalPopulation > 0 ? (top5Total / totalPopulation) * 100 : NaN;
  if (donutLegend) {
    donutLegend.insertAdjacentHTML(
      "beforeend",
      `
        <p class="donut-note">
          The five largest religious affiliation categories together account for
          <strong>${formatCount(top5Total)}</strong> people, or about
          <strong>${Number.isFinite(top5Share) ? formatPercent(top5Share) : "N/A"}</strong>
          of the household population nationwide. Roman Catholic, excluding Catholic Charismatics
          is the largest category with <strong>${formatCount(narrativeTop3[0]?.count || 0)}</strong>
          people (<strong>${narrativeTop3[0] ? narrativeTop3[0].share.toFixed(1) : "0.0"}%</strong>),
          followed by Islam with <strong>${formatCount(narrativeTop3[1]?.count || 0)}</strong>
          people (<strong>${narrativeTop3[1] ? narrativeTop3[1].share.toFixed(1) : "0.0"}%</strong>)
          and Iglesia ni Cristo with <strong>${formatCount(narrativeTop3[2]?.count || 0)}</strong>
          people (<strong>${narrativeTop3[2] ? narrativeTop3[2].share.toFixed(1) : "0.0"}%</strong>).
        </p>
      `
    );
  }

  renderTop5RegionChart(top5);

  const maxTop = top15.length ? top15[0].count : 0;
  top15Chart.innerHTML = top15
    .map(
      (item) => `
        <div class="rank-row">
          <div class="rank-meta">
            <span>${item.label}</span>
            <strong>${formatCount(item.count)}</strong>
          </div>
          <div class="rank-bar">
            <div class="rank-fill" style="width:${maxTop ? (item.count / maxTop) * 100 : 0}%"></div>
          </div>
        </div>
      `
    )
    .join("");

  renderFilteredView(filteredFeatures, selectedNational);
}

function renderTop5RegionChart(top5) {
  if (!top5RegionChart) {
    return;
  }

  if (top5RegionNote) {
    top5RegionNote.innerHTML = `
      Regions are ranked by the combined household population represented by the five largest religious affiliation categories. Within each bar, colored segments show how those top five categories make up the regional total.
    `;
  }

  const regionGeojson = loadedData.region;
  if (!regionGeojson?.features?.length || !top5.length) {
    top5RegionChart.innerHTML = `<p class="hint">Regional breakdown is not available yet.</p>`;
    return;
  }

  const aggregates = new Map();
  for (const feature of regionGeojson.features) {
    const props = feature.properties || {};
    if (props.join_status !== "matched") {
      continue;
    }
    const groupKey = props.psgc_region_name || props.area_name || props.psgc_geo_name || "Area";
    const areaName = groupKey === "NCR"
      ? "National Capital Region"
      : props.area_name || props.psgc_geo_name || "Area";
    const existing = aggregates.get(groupKey) || {
      key: groupKey,
      areaName,
      values: {},
      total: 0,
    };
    for (const religion of top5) {
      const count = Number(props[religion.key]);
      if (Number.isFinite(count)) {
        existing.values[religion.key] = Math.max(existing.values[religion.key] || 0, count);
      }
    }
    existing.total = top5.reduce((sum, religion) => sum + (existing.values[religion.key] || 0), 0);
    aggregates.set(groupKey, existing);
  }

  const rows = [...aggregates.values()].sort((a, b) => b.total - a.total);
  const maxTotal = rows.length ? rows[0].total : 0;

  top5RegionChart.innerHTML = rows
    .map((row) => {
      const widthPercent = maxTotal ? (row.total / maxTotal) * 100 : 0;
      const segments = top5
        .map((religion, index) => {
          const value = row.values[religion.key] || 0;
          const segmentWidth = row.total ? (value / row.total) * 100 : 0;
          return `
            <span
              class="stacked-region-segment"
              style="width:${segmentWidth}%;background:${QUICK_COLORS[index % QUICK_COLORS.length]}"
              data-region="${escapeHtml(row.areaName)}"
              data-religion="${escapeHtml(religion.label)}"
              data-count="${formatCount(value)}"
            ></span>
          `;
        })
        .join("");

      return `
        <div class="stacked-region-row">
          <span class="stacked-region-label">${row.areaName}</span>
          <div class="stacked-region-track">
            <div class="stacked-region-stack" style="width:${widthPercent}%">
              ${segments}
            </div>
          </div>
          <strong class="stacked-region-total">${formatCount(row.total)}</strong>
        </div>
      `;
    })
    .join("");

  bindTop5RegionTooltip();
}

function bindTop5RegionTooltip() {
  if (!top5RegionChart) {
    return;
  }
  top5RegionChart.querySelectorAll(".stacked-region-segment").forEach((segment) => {
    segment.addEventListener("mouseenter", (event) => {
      const target = event.currentTarget;
      showRegionTooltip(
        `<strong>${target.dataset.religion}</strong>${target.dataset.region}: ${target.dataset.count}`,
        event.clientX,
        event.clientY
      );
    });
    segment.addEventListener("mousemove", (event) => {
      moveRegionTooltip(event.clientX, event.clientY);
    });
    segment.addEventListener("mouseleave", () => {
      hideRegionTooltip();
    });
  });
}

function ensureRegionTooltip() {
  if (regionTooltip) {
    return regionTooltip;
  }
  regionTooltip = document.createElement("div");
  regionTooltip.className = "stacked-region-tooltip";
  regionTooltip.hidden = true;
  document.body.appendChild(regionTooltip);
  return regionTooltip;
}

function showRegionTooltip(html, x, y) {
  const tooltip = ensureRegionTooltip();
  tooltip.innerHTML = html;
  tooltip.hidden = false;
  moveRegionTooltip(x, y);
}

function moveRegionTooltip(x, y) {
  const tooltip = ensureRegionTooltip();
  const offset = 14;
  const viewportPadding = 12;
  const tooltipWidth = tooltip.offsetWidth || 220;
  const tooltipHeight = tooltip.offsetHeight || 56;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = x + offset;
  let top = y + offset;

  if (left + tooltipWidth + viewportPadding > viewportWidth) {
    left = x - tooltipWidth - offset;
  }

  if (top + tooltipHeight + viewportPadding > viewportHeight) {
    top = y - tooltipHeight - offset;
  }

  left = Math.max(viewportPadding, Math.min(left, viewportWidth - tooltipWidth - viewportPadding));
  top = Math.max(viewportPadding, Math.min(top, viewportHeight - tooltipHeight - viewportPadding));

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideRegionTooltip() {
  if (regionTooltip) {
    regionTooltip.hidden = true;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderFilteredView(filteredFeatures, selectedNational) {
  const aggregatedMap = new Map();
  for (const item of filteredFeatures) {
    const existing = aggregatedMap.get(item.groupKey);
    if (!existing) {
      aggregatedMap.set(item.groupKey, { ...item });
      continue;
    }

    const existingCount = Number(existing.count);
    const existingPopulation = Number(existing.population);
    if (item.count > existingCount || item.population > existingPopulation) {
      aggregatedMap.set(item.groupKey, {
        groupKey: item.groupKey,
        areaName: item.areaName,
        count: Math.max(existingCount, item.count),
        population: Math.max(existingPopulation, item.population),
      });
    }
  }

  const uniqueAreas = [...aggregatedMap.values()];
  const limits = {
    region: 18,
    province: 35,
    municipality: 25,
  };
  const sortedByCount = [...uniqueAreas].sort((a, b) => b.count - a.count);
  const ranked = sortedByCount.slice(0, limits[currentGeography] || 18);
  const totalCount = uniqueAreas.reduce((sum, item) => sum + item.count, 0);
  const totalPopulation = uniqueAreas.reduce((sum, item) => sum + item.population, 0);
  const topArea = sortedByCount[0];
  const geographyCopy =
    currentGeography === "region"
      ? "regions"
      : currentGeography === "province"
        ? "provinces"
        : "municipalities and cities";
  const geographyCountLabel =
    currentGeography === "region"
      ? "Regions"
      : currentGeography === "province"
        ? "Provinces"
        : "Municipalities / cities";
  const topAreaLabel =
    currentGeography === "region"
      ? `Top region for <b>${currentReligionLabel()}</b>`
      : currentGeography === "province"
        ? `Top province for <b>${currentReligionLabel()}</b>`
        : `Top city/municipality for <b>${currentReligionLabel()}</b>`;
  const chartTitle =
    currentGeography === "region"
      ? "Rank by Household Population Across Regions"
      : currentGeography === "province"
        ? "Top 35 Provinces by Household Population"
        : "Top 25 Municipalities and Cities by Household Population";
  const geographyTitle =
    currentGeography === "region"
      ? "Regional"
      : currentGeography === "province"
        ? "Provincial"
        : "Municipality / City";

  if (filteredCurrent) {
    filteredCurrent.innerHTML = `
      <p class="filtered-current-label">Current Filters Applied</p>
      <p class="filtered-current-value">${currentReligionLabel()}</p>
      <p class="filtered-current-sub">${geographyTitle} view</p>
    `;
  }

  if (filteredNarrative) {
    if (selectedNational && uniqueAreas.length) {
      filteredNarrative.innerHTML = `
        This view shows how <strong>${currentReligionLabel()}</strong> is distributed across
        ${geographyCopy}. <strong>${formatCount(totalCount)}</strong> people in the currently shown
        ${geographyCopy} reported this religion, across
        <strong>${formatCount(uniqueAreas.length)}</strong> matched areas. The total household population
        across those same areas is <strong>${formatCount(totalPopulation)}</strong>, so
        <strong>${currentReligionLabel()}</strong> accounts for
        <strong>${totalPopulation > 0 ? formatPercent((totalCount / totalPopulation) * 100) : "N/A"}</strong>
        of the total household population shown here.
      `;
    } else {
      filteredNarrative.textContent = `No matched ${geographyCopy} are available for the current selection.`;
    }
  }

  if (filteredShareBlock) {
    const share = totalPopulation > 0 ? (totalCount / totalPopulation) * 100 : NaN;
    const affiliatedShare = Number.isFinite(share) ? Math.min(Math.max(share, 0), 100) : 0;
    const otherShare = Number.isFinite(share) ? Math.max(100 - affiliatedShare, 0) : 0;
    const donutGradient = Number.isFinite(share)
      ? `conic-gradient(var(--accent) 0 ${affiliatedShare}%, #e8e8ed ${affiliatedShare}% 100%)`
      : "conic-gradient(#e8e8ed 0 100%)";

    filteredShareBlock.innerHTML = uniqueAreas.length
      ? `
        <p class="mini-label">Share of Household Population in This View</p>
        <div class="filtered-share-chart">
          <div class="filtered-share-donut" style="background:${donutGradient}">
            <div class="filtered-share-center">
              <strong>${formatPercent(share)}</strong>
              <span>affiliated</span>
            </div>
          </div>
          <div class="filtered-share-legend">
            <div>
              <span class="popup-dot popup-dot-affiliated"></span>
              <span>Household Population affiliated with<br>${currentReligionLabel()}</span>
              <strong>${formatPercent(affiliatedShare)}</strong>
            </div>
            <div>
              <span class="popup-dot popup-dot-other"></span>
              <span>Total Household Population</span>
              <strong>${formatPercent(otherShare)}</strong>
            </div>
          </div>
        </div>
      `
      : "";
  }

  filteredKpis.innerHTML = `
    <div class="kpi-card">
      <strong title="${formatCount(totalCount)}">${formatCompactCount(totalCount)}</strong>
      <span>${currentReligionLabel()} count in this view</span>
    </div>
    <div class="kpi-card">
      <strong>${formatCount(uniqueAreas.length)}</strong>
      <span>${geographyCountLabel}</span>
    </div>
    <div class="kpi-card">
      <strong title="${formatCount(totalPopulation)}">${formatCompactCount(totalPopulation)}</strong>
      <span>Total household population in this view</span>
    </div>
    <div class="kpi-card">
      <strong title="${topArea ? formatCount(topArea.count) : "N/A"}">${topArea ? formatCompactCount(topArea.count) : "N/A"}</strong>
      <span>${topAreaLabel}</span>
      <span><b>${topArea ? topArea.areaName : "Top area unavailable"}</b></span>
    </div>
  `;

  filteredChartLabel.textContent = chartTitle;
  const maxRanked = ranked.length ? ranked[0].count : 0;
  filteredRankChart.innerHTML = ranked.length
    ? ranked
        .map(
          (item) => `
            <div class="rank-row">
              <div class="rank-meta">
                <span>${item.areaName}</span>
                <strong>${formatCount(item.count)}</strong>
              </div>
              <div class="rank-bar">
                <div class="rank-fill" style="width:${maxRanked ? (item.count / maxRanked) * 100 : 0}%"></div>
              </div>
            </div>
          `
        )
        .join("")
    : `<p class="hint">No matched data is available for the current selection.</p>`;
}

function formatMetricValue(value) {
  return currentMeasure === "share" ? formatPercent(value) : formatCount(value);
}

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "N/A";
  }
  return `${number.toFixed(2)}%`;
}

function formatCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "N/A";
  }
  return new Intl.NumberFormat().format(Math.round(number));
}

function updateUrlState() {
  const url = new URL(window.location.href);
  url.searchParams.set("geography", currentGeography);
  url.searchParams.set("religion", currentReligion);
  url.searchParams.set("measure", currentMeasure);
  window.history.replaceState({}, "", url);
}

function setStatus(message) {
  statusBanner.innerHTML = message;
}

function extendBounds(bounds, coordinates, geometryType) {
  if (geometryType === "Polygon") {
    for (const ring of coordinates) {
      for (const coord of ring) {
        bounds.extend(coord);
      }
    }
    return;
  }

  if (geometryType === "MultiPolygon") {
    for (const polygon of coordinates) {
      for (const ring of polygon) {
        for (const coord of ring) {
          bounds.extend(coord);
        }
      }
    }
  }
}

async function fetchJson(url) {
  if (IS_FILE_PROTOCOL) {
    return loadEmbeddedJson(url);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}`);
  }
  return response.json();
}

async function loadEmbeddedJson(url) {
  window.MAPBOX_ATLAS_EMBEDDED = window.MAPBOX_ATLAS_EMBEDDED || {};
  if (window.MAPBOX_ATLAS_EMBEDDED[url]) {
    return window.MAPBOX_ATLAS_EMBEDDED[url];
  }

  const scriptUrl = url.replace(/(\.geojson|\.json)$/i, ".js");
  await loadScript(scriptUrl);

  if (!window.MAPBOX_ATLAS_EMBEDDED[url]) {
    throw new Error(`Embedded data was not found for ${url}`);
  }
  return window.MAPBOX_ATLAS_EMBEDDED[url];
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-atlas-src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), {
        once: true,
      });
      if (existing.dataset.loaded === "true") {
        resolve();
      }
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.atlasSrc = src;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    });
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
    document.head.appendChild(script);
  });
}
