const { test, expect } = require("@playwright/test");
const path = require("path");

const prototypeUrl = `file://${path.resolve(__dirname, "../familytree-visual-wow.html")}`;

test("loads the eastern archive prototype shell", async ({ page }) => {
  await page.goto(prototypeUrl);
  await expect(page.getByRole("banner")).toContainText("云谱档案");
  await expect(page.getByRole("main")).toHaveAttribute("data-view", "archive-tree");
  await expect(page.locator("#family-canvas")).toBeVisible();
  await expect(page.locator("#person-dossier")).toBeVisible();
  await expect(page.locator("#timeline")).toBeVisible();
});

test("renders genealogy nodes and relationship lines", async ({ page }) => {
  await page.goto(prototypeUrl);
  await expect(page.locator(".person-node")).toHaveCount(12);
  await expect(page.locator(".relationship-line[data-type='parent']")).toHaveCount(10);
  await expect(page.locator(".relationship-line[data-type='spouse']")).toHaveCount(3);
  await expect(page.getByText("沈怀远")).toBeVisible();
  await expect(page.getByText("长房")).toBeVisible();
});

test("keeps mock genealogy relationships structurally coherent", async ({ page }) => {
  await page.goto(prototypeUrl);
  const integrity = await page.evaluate(() => window.__familytreeDebug.validateMockGenealogy());

  expect(integrity.missingEndpoints).toEqual([]);
  expect(integrity.orphanPersonIds).toEqual([]);
  expect(integrity.crossGenerationSpouses).toEqual([]);
});

test("selects a person and updates the dossier", async ({ page }) => {
  await page.goto(prototypeUrl);
  await page.getByText("沈云章").click();
  await expect(page.locator(".person-node.is-selected")).toHaveAttribute("data-person-id", "p7");
  await expect(page.locator(".person-node[data-person-id='p3']")).toHaveClass(/is-related/);
  await expect(page.locator("#person-dossier")).toContainText("沈云章");
  await expect(page.locator("#person-dossier")).toContainText("长辈：沈承礼");
  await expect(page.locator("#person-dossier")).toContainText("关系链");
  await expect(page.locator("#person-dossier")).toContainText("关键事件");
});

test("allows keyboard selection of person nodes", async ({ page }) => {
  await page.goto(prototypeUrl);
  await page.locator(".person-node[data-person-id='p7']").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".person-node.is-selected")).toHaveAttribute("data-person-id", "p7");
  await expect(page.locator(".person-node[data-person-id='p7']")).toHaveAttribute("aria-pressed", "true");
});

test("searches and focuses a person", async ({ page }) => {
  await page.goto(prototypeUrl);
  await page.getByPlaceholder("搜索姓名、字辈或房支").fill("静姝");
  await page.keyboard.press("Enter");
  await expect(page.locator(".person-node.is-selected")).toContainText("沈静姝");
  await expect(page.locator("#person-dossier")).toContainText("沈静姝");
  await expect(page.locator("#search-status")).toContainText("找到 2 位");
});

test("zoom and reset controls update the canvas transform", async ({ page }) => {
  await page.goto(prototypeUrl);
  const viewport = page.locator("#tree-viewport");
  await page.getByRole("button", { name: "放大" }).click();
  await expect(viewport).toHaveAttribute("data-zoom", "1.15");
  await expect(viewport).toHaveAttribute("transform", /translate\(480 280\) scale\(1\.15\) translate\(-480 -280\)/);
  await page.getByRole("button", { name: "缩小" }).click();
  await expect(viewport).toHaveAttribute("data-zoom", "1");
  await page.getByRole("button", { name: "归位" }).click();
  await expect(viewport).toHaveAttribute("data-zoom", "1");
});

test("limits repeated zoom-in actions", async ({ page }) => {
  await page.goto(prototypeUrl);
  const viewport = page.locator("#tree-viewport");

  for (let index = 0; index < 12; index += 1) {
    await page.getByRole("button", { name: "放大" }).click();
  }

  await expect(viewport).toHaveAttribute("data-zoom", "1.3");
});

test("timeline highlights people alive in the selected year", async ({ page }) => {
  await page.goto(prototypeUrl);
  await page.locator("#timeline-year").fill("1910");
  await page.locator("#timeline-year").dispatchEvent("input");
  await expect(page.locator("#timeline-current-year")).toContainText("1910");
  await expect(page.locator(".person-node.is-in-year")).toHaveCount(10);
  await expect(page.locator(".person-node[data-person-id='p10']")).toHaveClass(/is-in-year/);
  await expect(page.locator(".person-node[data-person-id='p11']")).not.toHaveClass(/is-in-year/);
  await expect(page.locator(".person-node[data-person-id='p12']")).not.toHaveClass(/is-in-year/);
  await expect(page.locator("#timeline-events")).toContainText("家族纪事");
  await expect(page.locator("#timeline-events")).toContainText("1909 年 二房添丁");
});

test("adapts to mobile layout without hiding the main canvas", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(prototypeUrl);
  await expect(page.locator("#family-canvas")).toBeVisible();
  await expect(page.locator("#person-dossier")).toBeVisible();
  await expect(page.locator("body")).toHaveClass(/is-mobile-ready/);
});

test("presents a fuller genealogy management workspace", async ({ page }) => {
  await page.goto(prototypeUrl);
  await expect(page.locator("#family-registry")).toContainText("家谱库");
  await expect(page.locator("#management-panel")).toContainText("管理台");
  await expect(page.getByRole("button", { name: "人物", exact: true })).toHaveClass(/is-active/);
  await expect(page.locator("#selected-management-name")).toContainText("未选择");

  await page.getByText("沈云章").click();
  await expect(page.locator("#selected-management-name")).toContainText("沈云章");

  await page.getByRole("button", { name: "关系" }).click();
  await expect(page.locator("#relationship-editor")).toBeVisible();
  await expect(page.locator("#management-status")).toContainText("关系编辑");

  await page.getByRole("button", { name: "保存草稿" }).click();
  await expect(page.locator("#management-status")).toContainText("草稿已保存");
});
