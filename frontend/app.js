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
const relationshipForm = document.querySelector("#relationshipForm");
const eventForm = document.querySelector("#eventForm");
const newPersonButton = document.querySelector("#newPersonButton");
const personRecords = document.querySelector("#personRecords");
const relationshipRecords = document.querySelector("#relationshipRecords");
const eventRecords = document.querySelector("#eventRecords");
const tabButtons = document.querySelectorAll("[data-tab]");
const panes = document.querySelectorAll("[data-pane]");
const personName = document.querySelector("#personName");
const personGeneration = document.querySelector("#personGeneration");
const personBranch = document.querySelector("#personBranch");
const personYears = document.querySelector("#personYears");
const personSummary = document.querySelector("#personSummary");
const relationshipSource = document.querySelector("#relationshipSource");
const relationshipType = document.querySelector("#relationshipType");
const relationshipTarget = document.querySelector("#relationshipTarget");
const eventPerson = document.querySelector("#eventPerson");
const eventYear = document.querySelector("#eventYear");
const eventTitle = document.querySelector("#eventTitle");

const svgNamespace = "http://www.w3.org/2000/svg";
const nodeWidth = 112;
const nodeHeight = 78;
const familyId = "shen-wuxian";
const relationshipTypeLabels = {
  parent: "父母/子女",
  spouse: "配偶",
  adoptive: "收养",
  collateral: "旁系",
};
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

  if (response.status === 204) {
    return null;
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

function renderPersonOptions() {
  const options = graph.persons
    .map((person) => `<option value="${person.id}">${person.name} · ${person.branch}</option>`)
    .join("");

  relationshipSource.innerHTML = options;
  relationshipTarget.innerHTML = options;
  eventPerson.innerHTML = options;

  if (selectedPersonId && personById.has(selectedPersonId)) {
    relationshipSource.value = selectedPersonId;
    eventPerson.value = selectedPersonId;
  }
}

function renderTree() {
  personById = new Map(graph.persons.map((person) => [person.id, person]));
  treeViewport.innerHTML = "";
  const lineLayer = createSvgElement("g");
  const nodeLayer = createSvgElement("g");
  graph.relationships.forEach((relationship) => lineLayer.append(renderRelationship(relationship)));
  graph.persons.forEach((person) => nodeLayer.append(renderPerson(person)));
  treeViewport.append(lineLayer, nodeLayer);
  renderPersonOptions();
  applyZoom();
  updateTimeline();
  renderRecords();
}

function appendRecord(container, { title, meta, actions }) {
  const item = document.createElement("article");
  item.className = "record-item";

  const body = document.createElement("div");
  const name = document.createElement("strong");
  const detail = document.createElement("span");
  name.textContent = title;
  detail.textContent = meta;
  body.append(name, detail);

  const actionGroup = document.createElement("div");
  actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    button.dataset.action = action.action;
    button.dataset.id = action.id;
    actionGroup.append(button);
  });

  item.append(body, actionGroup);
  container.append(item);
}

function renderRecords() {
  personRecords.innerHTML = "";
  relationshipRecords.innerHTML = "";
  eventRecords.innerHTML = "";

  graph.persons.forEach((person) => {
    appendRecord(personRecords, {
      title: person.name,
      meta: `${person.branch} · ${person.generation} · ${person.years}`,
      actions: [
        { label: "选择", action: "select-person", id: person.id },
        { label: "删除", action: "delete-person", id: person.id },
      ],
    });
  });

  graph.relationships.forEach((relationship) => {
    const source = personById.get(relationship.source);
    const target = personById.get(relationship.target);
    appendRecord(relationshipRecords, {
      title: relationshipTypeLabels[relationship.type] || relationship.type,
      meta: `${source?.name || "未知人物"} → ${target?.name || "未知人物"}`,
      actions: [{ label: "删除", action: "delete-relationship", id: relationship.id }],
    });
  });

  graph.events.forEach((event) => {
    const person = personById.get(event.personId);
    appendRecord(eventRecords, {
      title: `${event.year} 年 · ${event.title}`,
      meta: person ? person.name : "未关联人物",
      actions: [{ label: "删除", action: "delete-event", id: event.id }],
    });
  });
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
  relationshipSource.value = person.id;
  eventPerson.value = person.id;
  eventYear.value = personEvents[0]?.year || timelineYear.value;
  eventTitle.value = personEvents[0]?.title || "家族纪事待补录";
  systemStatus.textContent = `已载入 ${person.name} 的人物档案`;
}

function resetPersonEditor() {
  selectedPersonId = null;
  selectedName.textContent = "未选择";
  personName.value = "";
  personGeneration.value = "";
  personBranch.value = "";
  personYears.value = "2000-2026";
  personSummary.value = "";
  document.querySelectorAll(".person-node").forEach((node) => node.classList.remove("is-selected"));
  dossierPanel.innerHTML = `
    <h2>人物档案</h2>
    <p>选择族谱节点后，此处显示人物生平、关系链与关键事件。</p>
  `;
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

async function saveRelationship(event) {
  event.preventDefault();
  const payload = {
    type: relationshipType.value,
    source: relationshipSource.value,
    target: relationshipTarget.value,
  };

  if (payload.source === payload.target) {
    systemStatus.textContent = "关系两端不能是同一人物。";
    return;
  }

  await api(`/api/families/${familyId}/relationships`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  systemStatus.textContent = "关系已保存，图谱已刷新。";
  await loadGraph();
  selectPerson(payload.source);
}

async function saveEvent(event) {
  event.preventDefault();
  const payload = {
    person_id: eventPerson.value,
    year: Number(eventYear.value),
    title: eventTitle.value.trim(),
  };

  await api(`/api/families/${familyId}/events`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  systemStatus.textContent = "事件已保存，时间轴已刷新。";
  await loadGraph();
  selectPerson(payload.person_id);
}

async function deletePerson(personId) {
  const person = personById.get(personId);
  const personNameText = person ? person.name : "该人物";
  if (!window.confirm(`确认删除 ${personNameText}？相关关系与事件也会一并移除。`)) return;

  await api(`/api/families/${familyId}/persons/${personId}`, { method: "DELETE" });
  if (selectedPersonId === personId) resetPersonEditor();
  await loadGraph();
  systemStatus.textContent = `${personNameText} 已从当前家谱中删除`;
}

async function deleteRelationship(relationshipId) {
  if (!window.confirm("确认删除这条关系？")) return;

  await api(`/api/families/${familyId}/relationships/${relationshipId}`, { method: "DELETE" });
  await loadGraph();
  systemStatus.textContent = "关系已删除，家谱图已刷新";
}

async function deleteEvent(eventId) {
  if (!window.confirm("确认删除这条事件？")) return;

  await api(`/api/families/${familyId}/events/${eventId}`, { method: "DELETE" });
  await loadGraph();
  if (selectedPersonId && personById.has(selectedPersonId)) selectPerson(selectedPersonId);
  systemStatus.textContent = "事件已删除，时间轴已刷新";
}

async function handleRecordAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;
  if (action === "select-person") {
    selectPerson(id);
    return;
  }

  if (action === "delete-person") {
    await deletePerson(id);
    return;
  }

  if (action === "delete-relationship") {
    await deleteRelationship(id);
    return;
  }

  if (action === "delete-event") {
    await deleteEvent(id);
  }
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
relationshipForm.addEventListener("submit", saveRelationship);
eventForm.addEventListener("submit", saveEvent);
personRecords.addEventListener("click", handleRecordAction);
relationshipRecords.addEventListener("click", handleRecordAction);
eventRecords.addEventListener("click", handleRecordAction);
newPersonButton.addEventListener("click", () => {
  resetPersonEditor();
  selectedName.textContent = "新人物";
  personName.focus();
});
tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const tabName = button.dataset.tab;
    tabButtons.forEach((tab) => tab.classList.toggle("is-active", tab === button));
    panes.forEach((pane) => pane.classList.toggle("is-active", pane.dataset.pane === tabName));
    systemStatus.textContent = `${button.textContent}管理已切换。`;
  });
});

boot().catch((error) => {
  systemStatus.textContent = "系统启动失败，请检查后端服务。";
  console.error(error);
});
