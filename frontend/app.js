const familyList = document.querySelector("#familyList");
const familyForm = document.querySelector("#familyForm");
const familyName = document.querySelector("#familyName");
const familySlug = document.querySelector("#familySlug");
const familyCanvas = document.querySelector("#familyCanvas");
const treeViewport = document.querySelector("#treeViewport");
const dossierPanel = document.querySelector("#dossierPanel");
const timelineYear = document.querySelector("#timelineYear");
const timelineCurrentYear = document.querySelector("#timelineCurrentYear");
const timelineEvents = document.querySelector("#timelineEvents");
const searchInput = document.querySelector("#searchInput");
const searchButton = document.querySelector("#searchButton");
const searchResults = document.querySelector("#searchResults");
const branchFilter = document.querySelector("#branchFilter");
const zoomInButton = document.querySelector("#zoomInButton");
const zoomOutButton = document.querySelector("#zoomOutButton");
const resetButton = document.querySelector("#resetButton");
const exportButton = document.querySelector("#exportButton");
const importButton = document.querySelector("#importButton");
const importFileInput = document.querySelector("#importFileInput");
const selectedName = document.querySelector("#selectedName");
const systemStatus = document.querySelector("#systemStatus");
const personForm = document.querySelector("#personForm");
const relationshipForm = document.querySelector("#relationshipForm");
const eventForm = document.querySelector("#eventForm");
const archiveForm = document.querySelector("#archiveForm");
const newPersonButton = document.querySelector("#newPersonButton");
const personRecords = document.querySelector("#personRecords");
const relationshipRecords = document.querySelector("#relationshipRecords");
const eventRecords = document.querySelector("#eventRecords");
const archiveRecords = document.querySelector("#archiveRecords");
const auditRecords = document.querySelector("#auditRecords");
const tabButtons = document.querySelectorAll("[data-tab]");
const panes = document.querySelectorAll("[data-pane]");
const personName = document.querySelector("#personName");
const personGeneration = document.querySelector("#personGeneration");
const personBranch = document.querySelector("#personBranch");
const personYears = document.querySelector("#personYears");
const personGender = document.querySelector("#personGender");
const personRank = document.querySelector("#personRank");
const personBirthPlace = document.querySelector("#personBirthPlace");
const personDeathPlace = document.querySelector("#personDeathPlace");
const personBurialPlace = document.querySelector("#personBurialPlace");
const personConfidence = document.querySelector("#personConfidence");
const personSummary = document.querySelector("#personSummary");
const relationshipSource = document.querySelector("#relationshipSource");
const relationshipType = document.querySelector("#relationshipType");
const relationshipTarget = document.querySelector("#relationshipTarget");
const eventPerson = document.querySelector("#eventPerson");
const eventYear = document.querySelector("#eventYear");
const eventTitle = document.querySelector("#eventTitle");
const archivePerson = document.querySelector("#archivePerson");
const archiveType = document.querySelector("#archiveType");
const archiveTitle = document.querySelector("#archiveTitle");
const archiveSource = document.querySelector("#archiveSource");
const archiveFile = document.querySelector("#archiveFile");

const svgNamespace = "http://www.w3.org/2000/svg";
const nodeWidth = 112;
const nodeHeight = 78;
let familyId = "shen-wuxian";
const relationshipTypeLabels = {
  parent: "父母/子女",
  spouse: "配偶",
  adoptive: "收养",
  collateral: "旁系",
};
const archiveTypeLabels = {
  manuscript: "族谱手稿",
  photo: "照片",
  epitaph: "墓志",
  oral: "口述记录",
  contract: "契据",
  other: "其他",
};
const searchTypeLabels = {
  person: "人物",
  event: "纪事",
  archive: "资料",
};
const genderLabels = {
  male: "男",
  female: "女",
  unknown: "未详",
};
let graph = { persons: [], relationships: [], events: [], archives: [], auditLogs: [] };
const auditActionLabels = {
  create: "新增",
  update: "更新",
  delete: "删除",
  seed: "初始化",
};
const auditEntityLabels = {
  family: "家谱",
  person: "人物",
  relationship: "关系",
  event: "事件",
  archive: "资料",
};
let personById = new Map();
let selectedPersonId = null;
let zoom = 1;
let pan = { x: 0, y: 0 };
let dragState = null;

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
    <div class="family-card ${family.id === familyId ? "is-active" : ""}">
      <strong>${family.name}</strong>
      <span>${family.id} · 当前角色 ${family.role} · 状态 ${family.status}</span>
      <div class="metric-grid">
        <div class="metric-card"><b>${family.stats.persons}</b><span>人物</span></div>
        <div class="metric-card"><b>${family.stats.relationships}</b><span>关系</span></div>
        <div class="metric-card"><b>${family.stats.events}</b><span>纪事</span></div>
        <div class="metric-card"><b>${family.stats.archives}</b><span>资料</span></div>
        <div class="metric-card"><b>${family.stats.completeness}%</b><span>完整度</span></div>
      </div>
      <button type="button" data-family-id="${family.id}">${family.id === familyId ? "当前家谱" : "进入家谱"}</button>
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
    "data-source": relationship.source,
    "data-target": relationship.target,
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
  archivePerson.innerHTML = options;

  if (selectedPersonId && personById.has(selectedPersonId)) {
    relationshipSource.value = selectedPersonId;
    eventPerson.value = selectedPersonId;
    archivePerson.value = selectedPersonId;
  }
}

function renderBranchFilter() {
  const currentValue = branchFilter.value || "all";
  const branches = [...new Set(graph.persons.map((person) => person.branch))].sort((left, right) =>
    left.localeCompare(right, "zh-Hans-CN")
  );
  branchFilter.innerHTML = [
    `<option value="all">全部房支</option>`,
    ...branches.map((branch) => `<option value="${branch}">${branch}</option>`),
  ].join("");
  branchFilter.value = branches.includes(currentValue) ? currentValue : "all";
}

function getVisiblePersons() {
  if (branchFilter.value === "all") return graph.persons;
  return graph.persons.filter((person) => person.branch === branchFilter.value);
}

function renderTree() {
  personById = new Map(graph.persons.map((person) => [person.id, person]));
  renderBranchFilter();
  const visiblePersons = getVisiblePersons();
  const visiblePersonIds = new Set(visiblePersons.map((person) => person.id));
  treeViewport.innerHTML = "";
  const lineLayer = createSvgElement("g");
  const nodeLayer = createSvgElement("g");
  graph.relationships
    .filter((relationship) => visiblePersonIds.has(relationship.source) && visiblePersonIds.has(relationship.target))
    .forEach((relationship) => lineLayer.append(renderRelationship(relationship)));
  visiblePersons.forEach((person) => nodeLayer.append(renderPerson(person)));
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
  archiveRecords.innerHTML = "";
  auditRecords.innerHTML = "";

  graph.persons.forEach((person) => {
    appendRecord(personRecords, {
      title: person.name,
      meta: `${person.branch} · ${person.generation} · ${person.years} · ${person.confidence || "待校"}`,
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

  graph.archives.forEach((archive) => {
    const person = personById.get(archive.personId);
    const fileMeta = archive.fileName ? ` · ${archive.fileName}` : "";
    appendRecord(archiveRecords, {
      title: archive.title,
      meta: `${archiveTypeLabels[archive.type] || archive.type} · ${archive.source}${fileMeta} · ${person ? person.name : "未关联人物"}`,
      actions: [
        ...(archive.fileUrl ? [{ label: "查看", action: "open-archive", id: archive.id }] : []),
        { label: "删除", action: "delete-archive", id: archive.id },
      ],
    });
  });

  graph.auditLogs.forEach((log) => {
    appendRecord(auditRecords, {
      title: `${auditActionLabels[log.action] || log.action} · ${auditEntityLabels[log.entityType] || log.entityType}`,
      meta: `${log.summary} · ${log.actor} · ${log.createdAt}`,
      actions: [],
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
  const relatedPersonIds = new Set([personId]);
  graph.relationships.forEach((relationship) => {
    if (relationship.source === personId) relatedPersonIds.add(relationship.target);
    if (relationship.target === personId) relatedPersonIds.add(relationship.source);
  });

  document.querySelectorAll(".person-node").forEach((node) => {
    node.classList.toggle("is-selected", node.dataset.personId === personId);
    node.classList.toggle("is-related", relatedPersonIds.has(node.dataset.personId));
    node.classList.toggle("is-dimmed", !relatedPersonIds.has(node.dataset.personId));
  });
  document.querySelectorAll(".relationship-line").forEach((line) => {
    const isRelated = line.dataset.source === personId || line.dataset.target === personId;
    line.classList.toggle("is-related", isRelated);
    line.classList.toggle("is-dimmed", !isRelated);
  });

  const personEvents = graph.events.filter((event) => event.personId === personId);
  const personArchives = graph.archives.filter((archive) => archive.personId === personId);
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
      <dt>性别</dt><dd>${genderLabels[person.gender] || genderLabels.unknown}</dd>
      <dt>排行</dt><dd>${person.rank || "未详"}</dd>
      <dt>出生地</dt><dd>${person.birth_place || "未详"}</dd>
      <dt>卒地</dt><dd>${person.death_place || "未详"}</dd>
      <dt>墓葬地</dt><dd>${person.burial_place || "未详"}</dd>
      <dt>考据状态</dt><dd>${person.confidence || "待校"}</dd>
    </dl>
    <h3>关系链</h3>
    <ul>${relationItems || "<li>暂无关系</li>"}</ul>
    <h3>关键事件</h3>
    <ul>${personEvents.map((event) => `<li>${event.year} 年 ${event.title}</li>`).join("") || "<li>暂无事件</li>"}</ul>
    <h3>归档资料</h3>
    <ul>${personArchives.map((archive) => {
      const fileLink = archive.fileUrl ? ` · <a href="${archive.fileUrl}" target="_blank" rel="noreferrer">${archive.fileName}</a>` : "";
      return `<li>${archiveTypeLabels[archive.type] || archive.type} · ${archive.title}${fileLink}</li>`;
    }).join("") || "<li>暂无资料</li>"}</ul>
  `;

  selectedName.textContent = person.name;
  personName.value = person.name;
  personGeneration.value = person.generation;
  personBranch.value = person.branch;
  personYears.value = person.years;
  personGender.value = person.gender || "unknown";
  personRank.value = person.rank || "";
  personBirthPlace.value = person.birth_place || "";
  personDeathPlace.value = person.death_place || "";
  personBurialPlace.value = person.burial_place || "";
  personConfidence.value = person.confidence || "待校";
  personSummary.value = person.summary;
  relationshipSource.value = person.id;
  eventPerson.value = person.id;
  archivePerson.value = person.id;
  eventYear.value = personEvents[0]?.year || timelineYear.value;
  eventTitle.value = personEvents[0]?.title || "家族纪事待补录";
  archiveTitle.value = personArchives[0]?.title || "资料待归档";
  archiveSource.value = personArchives[0]?.source || "家族整理";
  archiveFile.value = "";
  systemStatus.textContent = `已载入 ${person.name} 的人物档案`;
}

function resetPersonEditor() {
  selectedPersonId = null;
  selectedName.textContent = "未选择";
  personName.value = "";
  personGeneration.value = "";
  personBranch.value = "";
  personYears.value = "2000-2026";
  personGender.value = "unknown";
  personRank.value = "";
  personBirthPlace.value = "";
  personDeathPlace.value = "";
  personBurialPlace.value = "";
  personConfidence.value = "待校";
  personSummary.value = "";
  archiveTitle.value = "资料待归档";
  archiveSource.value = "家族整理";
  archiveFile.value = "";
  document.querySelectorAll(".person-node").forEach((node) => node.classList.remove("is-selected", "is-related", "is-dimmed"));
  document.querySelectorAll(".relationship-line").forEach((line) => line.classList.remove("is-related", "is-dimmed"));
  dossierPanel.innerHTML = `
    <h2>人物档案</h2>
    <p>选择族谱节点后，此处显示人物生平、关系链与关键事件。</p>
  `;
}

function applyZoom() {
  treeViewport.setAttribute("data-zoom", zoom.toFixed(2).replace(/\.00$/, ""));
  treeViewport.setAttribute("data-pan", `${Math.round(pan.x)},${Math.round(pan.y)}`);
  treeViewport.setAttribute(
    "transform",
    `translate(${480 + pan.x} ${300 + pan.y}) scale(${zoom.toFixed(2)}) translate(-480 -300)`
  );
}

function renderSearchResults(results, keyword) {
  if (!keyword) {
    searchResults.innerHTML = "";
    return;
  }

  searchResults.innerHTML = `
    <strong>搜索索引</strong>
    <span>${results.length ? `找到 ${results.length} 条结果` : "暂无匹配结果"}</span>
    <div class="search-result-list">
      ${results.map((result) => `
        <button type="button" data-person-id="${result.personId}">
          <b>${searchTypeLabels[result.type] || result.type} · ${result.title}</b>
          <span>${result.subtitle}</span>
        </button>
      `).join("")}
    </div>
  `;
}

async function searchPerson() {
  const keyword = searchInput.value.trim();
  if (!keyword) return;
  const data = await api(`/api/families/${familyId}/search?q=${encodeURIComponent(keyword)}`);
  renderSearchResults(data.results, keyword);
  systemStatus.textContent = `搜索完成：找到 ${data.results.length} 条索引结果`;
  const firstResult = data.results[0];
  if (firstResult?.personId) {
    const person = personById.get(firstResult.personId);
    if (person && branchFilter.value !== "all" && person.branch !== branchFilter.value) {
      branchFilter.value = "all";
      renderTree();
    }
    selectPerson(firstResult.personId);
    document.querySelector(`.person-node[data-person-id="${firstResult.personId}"]`)?.focus();
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
    gender: personGender.value,
    birth_place: personBirthPlace.value.trim(),
    death_place: personDeathPlace.value.trim(),
    rank: personRank.value.trim(),
    burial_place: personBurialPlace.value.trim(),
    confidence: personConfidence.value,
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

async function saveArchive(event) {
  event.preventDefault();
  const [file] = archiveFile.files;
  if (file) {
    const formData = new FormData();
    formData.append("person_id", archivePerson.value);
    formData.append("type", archiveType.value);
    formData.append("title", archiveTitle.value.trim());
    formData.append("source", archiveSource.value.trim());
    formData.append("file", file);

    const response = await fetch(`/api/families/${familyId}/archives/upload`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    systemStatus.textContent = "资料文件已上传并归档，档案清单已刷新。";
    archiveFile.value = "";
    await loadGraph();
    selectPerson(archivePerson.value);
    return;
  }

  const payload = {
    person_id: archivePerson.value,
    type: archiveType.value,
    title: archiveTitle.value.trim(),
    source: archiveSource.value.trim(),
  };

  await api(`/api/families/${familyId}/archives`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  systemStatus.textContent = "资料已归档，档案清单已刷新。";
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

async function deleteArchive(archiveId) {
  if (!window.confirm("确认删除这条资料？")) return;

  await api(`/api/families/${familyId}/archives/${archiveId}`, { method: "DELETE" });
  await loadGraph();
  if (selectedPersonId && personById.has(selectedPersonId)) selectPerson(selectedPersonId);
  systemStatus.textContent = "资料已删除，档案清单已刷新";
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
    return;
  }

  if (action === "delete-archive") {
    await deleteArchive(id);
    return;
  }

  if (action === "open-archive") {
    const archive = graph.archives.find((item) => item.id === id);
    if (archive?.fileUrl) window.open(archive.fileUrl, "_blank", "noreferrer");
  }
}

async function loadGraph() {
  graph = await api(`/api/families/${familyId}/graph`);
  renderTree();
}

async function refreshFamilies() {
  const families = await api("/api/families");
  renderFamilies(families);
}

async function selectFamily(nextFamilyId) {
  if (familyId === nextFamilyId) return;
  familyId = nextFamilyId;
  selectedPersonId = null;
  resetPersonEditor();
  await refreshFamilies();
  await loadGraph();
  systemStatus.textContent = `已切换到家谱库 ${nextFamilyId}`;
}

async function createFamily(event) {
  event.preventDefault();
  const payload = {
    id: familySlug.value.trim(),
    name: familyName.value.trim(),
    role: "creator",
    status: "draft",
  };

  await api("/api/families", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  familyId = payload.id;
  familyForm.reset();
  selectedPersonId = null;
  resetPersonEditor();
  await refreshFamilies();
  await loadGraph();
  systemStatus.textContent = `已创建并进入 ${payload.name}`;
}

async function exportFamily() {
  const response = await fetch(`/api/families/${familyId}/export`);
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const blob = await response.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = `${familyId}-familytree-export.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(downloadUrl);
  systemStatus.textContent = "家谱 JSON 备份已生成，可用于迁移与归档。";
}

async function importFamily(file) {
  const text = await file.text();
  const payload = JSON.parse(text);
  if (!window.confirm("导入会覆盖当前家谱数据，确认继续？")) return;

  const result = await api(`/api/families/${familyId}/import`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  selectedPersonId = null;
  resetPersonEditor();
  await refreshFamilies();
  await loadGraph();
  systemStatus.textContent = `导入完成：${result.persons} 位人物、${result.relationships} 条关系、${result.events} 条事件、${result.archives} 条资料。`;
}

function setZoom(nextZoom) {
  zoom = Math.min(1.6, Math.max(0.65, nextZoom));
  applyZoom();
}

function beginCanvasDrag(event) {
  if (event.button !== 0 || event.target.closest(".person-node")) return;
  dragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    panX: pan.x,
    panY: pan.y,
  };
  familyCanvas.setPointerCapture(event.pointerId);
  familyCanvas.classList.add("is-dragging");
}

function moveCanvasDrag(event) {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  pan = {
    x: dragState.panX + event.clientX - dragState.startX,
    y: dragState.panY + event.clientY - dragState.startY,
  };
  applyZoom();
}

function endCanvasDrag(event) {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  dragState = null;
  familyCanvas.classList.remove("is-dragging");
  if (familyCanvas.hasPointerCapture(event.pointerId)) {
    familyCanvas.releasePointerCapture(event.pointerId);
  }
}

async function boot() {
  await refreshFamilies();
  await loadGraph();
  systemStatus.textContent = "系统已连接后端 API，可读写 SQLite 家谱文件。";
}

searchButton.addEventListener("click", () => {
  searchPerson().catch((error) => {
    systemStatus.textContent = "搜索失败，请检查后端服务。";
    console.error(error);
  });
});
searchResults.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-person-id]");
  if (!button) return;

  if (branchFilter.value !== "all") {
    branchFilter.value = "all";
    renderTree();
  }
  selectPerson(button.dataset.personId);
  document.querySelector(`.person-node[data-person-id="${button.dataset.personId}"]`)?.focus();
});
familyForm.addEventListener("submit", (event) => {
  createFamily(event).catch((error) => {
    systemStatus.textContent = "创建家谱失败，请确认英文标识未重复。";
    console.error(error);
  });
});
familyList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-family-id]");
  if (!button) return;

  selectFamily(button.dataset.familyId).catch((error) => {
    systemStatus.textContent = "切换家谱失败，请检查后端服务。";
    console.error(error);
  });
});
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    searchPerson().catch((error) => {
      systemStatus.textContent = "搜索失败，请检查后端服务。";
      console.error(error);
    });
  }
});
branchFilter.addEventListener("change", () => {
  if (selectedPersonId) resetPersonEditor();
  renderTree();
  systemStatus.textContent =
    branchFilter.value === "all" ? "已显示全部房支" : `已筛选 ${branchFilter.value} 房支`;
});
zoomInButton.addEventListener("click", () => {
  setZoom(zoom + 0.15);
});
zoomOutButton.addEventListener("click", () => {
  setZoom(zoom - 0.15);
});
resetButton.addEventListener("click", () => {
  zoom = 1;
  pan = { x: 0, y: 0 };
  applyZoom();
});
familyCanvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  setZoom(zoom + (event.deltaY < 0 ? 0.08 : -0.08));
});
familyCanvas.addEventListener("pointerdown", beginCanvasDrag);
familyCanvas.addEventListener("pointermove", moveCanvasDrag);
familyCanvas.addEventListener("pointerup", endCanvasDrag);
familyCanvas.addEventListener("pointercancel", endCanvasDrag);
exportButton.addEventListener("click", () => {
  exportFamily().catch((error) => {
    systemStatus.textContent = "导出失败，请检查后端服务。";
    console.error(error);
  });
});
importButton.addEventListener("click", () => {
  importFileInput.click();
});
importFileInput.addEventListener("change", () => {
  const [file] = importFileInput.files;
  importFileInput.value = "";
  if (!file) return;

  importFamily(file).catch((error) => {
    systemStatus.textContent = "导入失败，请确认备份文件格式正确。";
    console.error(error);
  });
});
timelineYear.addEventListener("input", updateTimeline);
personForm.addEventListener("submit", savePerson);
relationshipForm.addEventListener("submit", saveRelationship);
eventForm.addEventListener("submit", saveEvent);
archiveForm.addEventListener("submit", saveArchive);
personRecords.addEventListener("click", handleRecordAction);
relationshipRecords.addEventListener("click", handleRecordAction);
eventRecords.addEventListener("click", handleRecordAction);
archiveRecords.addEventListener("click", handleRecordAction);
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
