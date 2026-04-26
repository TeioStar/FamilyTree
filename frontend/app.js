const familyList = document.querySelector("#familyList");
const treeViewport = document.querySelector("#treeViewport");
const dossierPanel = document.querySelector("#dossierPanel");
const timelineYear = document.querySelector("#timelineYear");
const timelineCurrentYear = document.querySelector("#timelineCurrentYear");
const timelineEvents = document.querySelector("#timelineEvents");
const searchInput = document.querySelector("#searchInput");
const searchButton = document.querySelector("#searchButton");
const zoomInButton = document.querySelector("#zoomInButton");
const zoomOutButton = document.querySelector("#zoomOutButton");
const resetButton = document.querySelector("#resetButton");
const selectedName = document.querySelector("#selectedName");
const systemStatus = document.querySelector("#systemStatus");
const personForm = document.querySelector("#personForm");
const newPersonButton = document.querySelector("#newPersonButton");
const tabButtons = document.querySelectorAll("[data-tab]");
const personName = document.querySelector("#personName");
const personGeneration = document.querySelector("#personGeneration");
const personBranch = document.querySelector("#personBranch");
const personYears = document.querySelector("#personYears");
const personSummary = document.querySelector("#personSummary");

const svgNamespace = "http://www.w3.org/2000/svg";
const nodeWidth = 112;
const nodeHeight = 78;
const familyId = "shen-wuxian";
let graph = { persons: [], relationships: [], events: [] };
let personById = new Map();
let selectedPersonId = null;
let zoom = 1;

function createSvgElement(tagName, attributes = {}) {
  const element = document.createElementNS(svgNamespace, tagName);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

function renderFamilies(families) {
  familyList.innerHTML = families.map((family) => `
    <div class="family-card">
      <strong>${family.name}</strong>
      <span>当前角色 ${family.role} · 状态 ${family.status}</span>
      <div class="metric-grid">
        <div class="metric-card"><b>${family.stats.persons}</b><span>人物</span></div>
        <div class="metric-card"><b>${family.stats.relationships}</b><span>关系</span></div>
        <div class="metric-card"><b>${family.stats.events}</b><span>纪事</span></div>
        <div class="metric-card"><b>${family.stats.completeness}%</b><span>完整度</span></div>
      </div>
    </div>
  `).join("");
}

function getAnchor(person, side) {
  const centerX = person.x + nodeWidth / 2;
  const centerY = person.y + nodeHeight / 2;

  if (side === "top") return { x: centerX, y: person.y };
  if (side === "bottom") return { x: centerX, y: person.y + nodeHeight };
  if (side === "left") return { x: person.x, y: centerY };
  return { x: person.x + nodeWidth, y: centerY };
}

function renderRelationship(relationship) {
  const from = personById.get(relationship.source);
  const to = personById.get(relationship.target);
  const path = createSvgElement("path", {
    class: "relationship-line",
    "data-type": relationship.type,
  });

  if (!from || !to) return path;

  if (relationship.type === "spouse") {
    const direction = from.x < to.x ? 1 : -1;
    const fromAnchor = getAnchor(from, direction === 1 ? "right" : "left");
    const toAnchor = getAnchor(to, direction === 1 ? "left" : "right");
    path.setAttribute("d", `M ${fromAnchor.x} ${fromAnchor.y} C ${fromAnchor.x + 32 * direction} ${fromAnchor.y}, ${toAnchor.x - 32 * direction} ${toAnchor.y}, ${toAnchor.x} ${toAnchor.y}`);
    return path;
  }

  const fromAnchor = getAnchor(from, "bottom");
  const toAnchor = getAnchor(to, "top");
  const middleY = (fromAnchor.y + toAnchor.y) / 2;
  path.setAttribute("d", `M ${fromAnchor.x} ${fromAnchor.y} C ${fromAnchor.x} ${middleY}, ${toAnchor.x} ${middleY}, ${toAnchor.x} ${toAnchor.y}`);
  return path;
}

function renderPerson(person) {
  const group = createSvgElement("g", {
    class: "person-node",
    transform: `translate(${person.x} ${person.y})`,
    "data-person-id": person.id,
    role: "button",
    tabindex: "0",
    "aria-label": `${person.name}，${person.branch}，${person.years}`,
  });
  const plaque = createSvgElement("rect", { class: "person-plaque", width: nodeWidth, height: nodeHeight, rx: 6 });
  const seal = createSvgElement("rect", { class: "branch-seal", x: 72, y: 12, width: 30, height: 30, rx: 3 });
  const branch = createSvgElement("text", { class: "branch-label", x: 87, y: 31, "text-anchor": "middle" });
  const name = createSvgElement("text", { class: "person-name", x: 14, y: 31 });
  const years = createSvgElement("text", { class: "person-years", x: 14, y: 56 });
  branch.textContent = person.branch;
  name.textContent = person.name;
  years.textContent = person.years;
  group.append(plaque, seal, branch, name, years);
  group.addEventListener("click", () => selectPerson(person.id));
  group.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectPerson(person.id);
    }
  });
  return group;
}

function renderTree() {
  personById = new Map(graph.persons.map((person) => [person.id, person]));
  treeViewport.innerHTML = "";
  const lineLayer = createSvgElement("g");
  const nodeLayer = createSvgElement("g");
  graph.relationships.forEach((relationship) => lineLayer.append(renderRelationship(relationship)));
  graph.persons.forEach((person) => nodeLayer.append(renderPerson(person)));
  treeViewport.append(lineLayer, nodeLayer);
  applyZoom();
  updateTimeline();
}

function parseLifeYears(yearRange) {
  const [birthYear, deathYear] = yearRange.split("-").map((year) => Number(year));
  return { birthYear, deathYear };
}

function isAlive(person, year) {
  const { birthYear, deathYear } = parseLifeYears(person.years);
  return birthYear <= year && year <= deathYear;
}

function updateTimeline() {
  const year = Number(timelineYear.value);
  timelineCurrentYear.textContent = String(year);
  document.querySelectorAll(".person-node").forEach((node) => {
    const person = personById.get(node.dataset.personId);
    node.classList.toggle("is-in-year", person ? isAlive(person, year) : false);
  });
  const nearbyEvents = graph.events.filter((event) => Math.abs(event.year - year) <= 8);
  timelineEvents.innerHTML = nearbyEvents.length
    ? nearbyEvents.map((event) => `<div><strong>家族纪事</strong>：${event.year} 年 ${event.title}</div>`).join("")
    : `<div><strong>家族纪事</strong>：${year} 年附近暂无入档纪事</div>`;
}

function describeRelation(relationship, personId) {
  const otherId = relationship.source === personId ? relationship.target : relationship.source;
  const other = personById.get(otherId);
  if (!other) return "未知关系";
  if (relationship.type === "spouse") return `姻亲：${other.name}`;
  return relationship.source === personId ? `后辈：${other.name}` : `长辈：${other.name}`;
}

function selectPerson(personId) {
  selectedPersonId = personId;
  const person = personById.get(personId);
  const relatedIds = new Set(
    graph.relationships
      .filter((relationship) => relationship.source === personId || relationship.target === personId)
      .map((relationship) => relationship.source === personId ? relationship.target : relationship.source)
  );

  document.querySelectorAll(".person-node").forEach((node) => {
    node.classList.toggle("is-selected", node.dataset.personId === personId);
  });

  const personEvents = graph.events.filter((event) => event.personId === personId);
  const relationItems = graph.relationships
    .filter((relationship) => relationship.source === personId || relationship.target === personId)
    .map((relationship) => `<li>${describeRelation(relationship, personId)}</li>`)
    .join("");

  dossierPanel.innerHTML = `
    <h2>${person.name}</h2>
    <p>${person.summary}</p>
    <dl>
      <dt>房支</dt><dd>${person.branch}</dd>
      <dt>字辈</dt><dd>${person.generation}</dd>
      <dt>生卒</dt><dd>${person.years}</dd>
    </dl>
    <h3>关系链</h3>
    <ul>${relationItems || "<li>暂无关系</li>"}</ul>
    <h3>关键事件</h3>
    <ul>${personEvents.map((event) => `<li>${event.year} 年 ${event.title}</li>`).join("") || "<li>暂无事件</li>"}</ul>
  `;

  selectedName.textContent = person.name;
  personName.value = person.name;
  personGeneration.value = person.generation;
  personBranch.value = person.branch;
  personYears.value = person.years;
  personSummary.value = person.summary;
  systemStatus.textContent = `已载入 ${person.name} 的人物档案`;
}

function applyZoom() {
  treeViewport.setAttribute("transform", `translate(480 300) scale(${zoom.toFixed(2)}) translate(-480 -300)`);
}

function searchPerson() {
  const keyword = searchInput.value.trim();
  if (!keyword) return;
  const person = graph.persons.find((item) =>
    item.name.includes(keyword) || item.generation.includes(keyword) || item.branch.includes(keyword)
  );
  if (person) {
    selectPerson(person.id);
    document.querySelector(`.person-node[data-person-id="${person.id}"]`)?.focus();
  }
}

async function savePerson(event) {
  event.preventDefault();
  const payload = {
    name: personName.value.trim(),
    generation: personGeneration.value.trim(),
    branch: personBranch.value.trim(),
    years: personYears.value.trim(),
    summary: personSummary.value.trim(),
  };

  if (selectedPersonId) {
    await api(`/api/families/${familyId}/persons/${selectedPersonId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    systemStatus.textContent = "人物已保存到当前家谱文件";
  } else {
    const created = await api(`/api/families/${familyId}/persons`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    selectedPersonId = created.id;
    systemStatus.textContent = "新增人物已写入当前家谱文件";
  }

  await loadGraph();
  if (selectedPersonId) selectPerson(selectedPersonId);
}

async function loadGraph() {
  graph = await api(`/api/families/${familyId}/graph`);
  renderTree();
}

async function boot() {
  const families = await api("/api/families");
  renderFamilies(families);
  await loadGraph();
  systemStatus.textContent = "系统已连接后端 API，可读写 SQLite 家谱文件。";
}

searchButton.addEventListener("click", searchPerson);
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    searchPerson();
  }
});
zoomInButton.addEventListener("click", () => {
  zoom = Math.min(1.3, zoom + 0.15);
  applyZoom();
});
zoomOutButton.addEventListener("click", () => {
  zoom = Math.max(0.7, zoom - 0.15);
  applyZoom();
});
resetButton.addEventListener("click", () => {
  zoom = 1;
  applyZoom();
});
timelineYear.addEventListener("input", updateTimeline);
personForm.addEventListener("submit", savePerson);
newPersonButton.addEventListener("click", () => {
  selectedPersonId = null;
  selectedName.textContent = "新人物";
  personName.value = "";
  personGeneration.value = "";
  personBranch.value = "";
  personYears.value = "2000-2026";
  personSummary.value = "";
  personName.focus();
});
tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    tabButtons.forEach((tab) => tab.classList.toggle("is-active", tab === button));
    systemStatus.textContent = `${button.textContent}管理已切换，后续会接入完整编辑表单。`;
  });
});

boot().catch((error) => {
  systemStatus.textContent = "系统启动失败，请检查后端服务。";
  console.error(error);
});
