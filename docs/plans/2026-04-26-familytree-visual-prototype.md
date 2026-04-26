# FamilyTree Visual Prototype Implementation Plan

> **For implementer:** Use TDD throughout. Write failing test first. Watch it fail. Then implement.

**Goal:** Build a direct-open, interactive Eastern genealogy archive visual prototype.

**Architecture:** Create one standalone HTML prototype under `prototype/` with embedded CSS, SVG, JavaScript, and mock genealogy data. Add lightweight Playwright checks under `prototype/tests/` to verify that core controls and visual states exist before implementation is considered complete.

**Tech Stack:** HTML, CSS, vanilla JavaScript, SVG, Playwright test runner through `npx playwright`.

---

## Task 1: Prototype Shell And Visual Foundation

**Files:**
- Create: `prototype/familytree-visual-wow.html`
- Create: `prototype/tests/familytree-visual-wow.spec.js`

**Step 1: Write the failing test**

Create `prototype/tests/familytree-visual-wow.spec.js`:

```js
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
```

**Step 2: Run test and confirm it fails**

Command: `npx playwright test prototype/tests/familytree-visual-wow.spec.js`

Expected: FAIL because `prototype/familytree-visual-wow.html` does not exist yet.

**Step 3: Write minimal implementation**

Create the HTML file with:

- A `header` toolbar named `云谱档案`.
- A `main` element with `data-view="archive-tree"`.
- An SVG container with id `family-canvas`.
- An aside with id `person-dossier`.
- A bottom timeline region with id `timeline`.
- CSS variables for ink, cinnabar, rice paper, gold, and wood tones.
- Responsive layout foundations.

**Step 4: Run test and confirm it passes**

Command: `npx playwright test prototype/tests/familytree-visual-wow.spec.js`

Expected: PASS.

**Step 5: Commit**

If this directory is a git repository:

`git add prototype/familytree-visual-wow.html prototype/tests/familytree-visual-wow.spec.js && git commit -m "feat: 新增东方族谱可视化原型外壳"`

If git is not initialized, record the changed files in the final report.

---

## Task 2: Mock Data And SVG Genealogy Rendering

**Files:**
- Modify: `prototype/familytree-visual-wow.html`
- Modify: `prototype/tests/familytree-visual-wow.spec.js`

**Step 1: Write the failing test**

Append:

```js
test("renders genealogy nodes and relationship lines", async ({ page }) => {
  await page.goto(prototypeUrl);
  await expect(page.locator(".person-node")).toHaveCount(12);
  await expect(page.locator(".relationship-line[data-type='parent']")).toHaveCount(10);
  await expect(page.locator(".relationship-line[data-type='spouse']")).toHaveCount(3);
  await expect(page.getByText("沈怀远")).toBeVisible();
  await expect(page.getByText("长房")).toBeVisible();
});
```

**Step 2: Run test and confirm it fails**

Command: `npx playwright test prototype/tests/familytree-visual-wow.spec.js`

Expected: FAIL because rendered person nodes and relationship lines are missing.

**Step 3: Write minimal implementation**

In `prototype/familytree-visual-wow.html`:

- Add mock `persons`, `relationships`, and `events`.
- Add deterministic `x` and `y` coordinates for the first visual prototype.
- Render SVG relationship paths first.
- Render 12 person nodes as SVG groups with `.person-node`.
- Style nodes as rice-paper family plaques with cinnabar branch seals.

**Step 4: Run test and confirm it passes**

Command: `npx playwright test prototype/tests/familytree-visual-wow.spec.js`

Expected: PASS.

**Step 5: Commit**

`git add prototype/familytree-visual-wow.html prototype/tests/familytree-visual-wow.spec.js && git commit -m "feat: 渲染家谱人物与关系线"`

---

## Task 3: Person Selection And Dossier Panel

**Files:**
- Modify: `prototype/familytree-visual-wow.html`
- Modify: `prototype/tests/familytree-visual-wow.spec.js`

**Step 1: Write the failing test**

Append:

```js
test("selects a person and updates the dossier", async ({ page }) => {
  await page.goto(prototypeUrl);
  await page.getByText("沈云章").click();
  await expect(page.locator(".person-node.is-selected")).toHaveCount(1);
  await expect(page.locator(".person-node.is-related")).not.toHaveCount(0);
  await expect(page.locator("#person-dossier")).toContainText("沈云章");
  await expect(page.locator("#person-dossier")).toContainText("关系链");
  await expect(page.locator("#person-dossier")).toContainText("关键事件");
});
```

**Step 2: Run test and confirm it fails**

Command: `npx playwright test prototype/tests/familytree-visual-wow.spec.js`

Expected: FAIL because selection and dossier updates are not implemented.

**Step 3: Write minimal implementation**

- Add click handlers to `.person-node`.
- Track `selectedPersonId`.
- Add `.is-selected` and `.is-related` classes.
- Render selected person details, relation summary, event list, and archive completeness.

**Step 4: Run test and confirm it passes**

Command: `npx playwright test prototype/tests/familytree-visual-wow.spec.js`

Expected: PASS.

**Step 5: Commit**

`git add prototype/familytree-visual-wow.html prototype/tests/familytree-visual-wow.spec.js && git commit -m "feat: 增加人物选择与档案面板"`

---

## Task 4: Search And View Controls

**Files:**
- Modify: `prototype/familytree-visual-wow.html`
- Modify: `prototype/tests/familytree-visual-wow.spec.js`

**Step 1: Write the failing test**

Append:

```js
test("searches and focuses a person", async ({ page }) => {
  await page.goto(prototypeUrl);
  await page.getByPlaceholder("搜索姓名、字辈或房支").fill("静姝");
  await page.keyboard.press("Enter");
  await expect(page.locator(".person-node.is-selected")).toContainText("沈静姝");
  await expect(page.locator("#person-dossier")).toContainText("沈静姝");
});

test("zoom and reset controls update the canvas transform", async ({ page }) => {
  await page.goto(prototypeUrl);
  const viewport = page.locator("#tree-viewport");
  await page.getByRole("button", { name: "放大" }).click();
  await expect(viewport).toHaveAttribute("data-zoom", "1.15");
  await page.getByRole("button", { name: "归位" }).click();
  await expect(viewport).toHaveAttribute("data-zoom", "1");
});
```

**Step 2: Run test and confirm it fails**

Command: `npx playwright test prototype/tests/familytree-visual-wow.spec.js`

Expected: FAIL because search and zoom controls are not implemented.

**Step 3: Write minimal implementation**

- Add search input with placeholder `搜索姓名、字辈或房支`.
- Search by name, generation, or branch on Enter.
- Add zoom in, zoom out, and reset buttons.
- Apply SVG group transform and store current zoom in `data-zoom`.

**Step 4: Run test and confirm it passes**

Command: `npx playwright test prototype/tests/familytree-visual-wow.spec.js`

Expected: PASS.

**Step 5: Commit**

`git add prototype/familytree-visual-wow.html prototype/tests/familytree-visual-wow.spec.js && git commit -m "feat: 增加搜索与画布控制"`

---

## Task 5: Timeline Highlight Interaction

**Files:**
- Modify: `prototype/familytree-visual-wow.html`
- Modify: `prototype/tests/familytree-visual-wow.spec.js`

**Step 1: Write the failing test**

Append:

```js
test("timeline highlights people alive in the selected year", async ({ page }) => {
  await page.goto(prototypeUrl);
  await page.locator("#timeline-year").fill("1910");
  await page.locator("#timeline-year").dispatchEvent("input");
  await expect(page.locator("#timeline-current-year")).toContainText("1910");
  await expect(page.locator(".person-node.is-in-year")).not.toHaveCount(0);
  await expect(page.locator("#timeline-events")).toContainText("家族纪事");
});
```

**Step 2: Run test and confirm it fails**

Command: `npx playwright test prototype/tests/familytree-visual-wow.spec.js`

Expected: FAIL because the timeline is not interactive.

**Step 3: Write minimal implementation**

- Add range input `#timeline-year`.
- Add current year label `#timeline-current-year`.
- Highlight people whose birth and death years include the selected year.
- Render nearby events into `#timeline-events`.

**Step 4: Run test and confirm it passes**

Command: `npx playwright test prototype/tests/familytree-visual-wow.spec.js`

Expected: PASS.

**Step 5: Commit**

`git add prototype/familytree-visual-wow.html prototype/tests/familytree-visual-wow.spec.js && git commit -m "feat: 增加家族时间轴联动"`

---

## Task 6: Responsive Polish And Visual Verification

**Files:**
- Modify: `prototype/familytree-visual-wow.html`
- Modify: `prototype/tests/familytree-visual-wow.spec.js`

**Step 1: Write the failing test**

Append:

```js
test("adapts to mobile layout without hiding the main canvas", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(prototypeUrl);
  await expect(page.locator("#family-canvas")).toBeVisible();
  await expect(page.locator("#person-dossier")).toBeVisible();
  await expect(page.locator("body")).toHaveClass(/is-mobile-ready/);
});
```

**Step 2: Run test and confirm it fails**

Command: `npx playwright test prototype/tests/familytree-visual-wow.spec.js`

Expected: FAIL because mobile readiness class and layout refinements are missing.

**Step 3: Write minimal implementation**

- Add responsive CSS for widths below 760px.
- Convert dossier into a bottom drawer on mobile.
- Tighten toolbar layout.
- Ensure SVG canvas keeps a useful minimum height.
- Add `is-mobile-ready` class on `body` after initialization.

**Step 4: Run test and confirm it passes**

Command: `npx playwright test prototype/tests/familytree-visual-wow.spec.js`

Expected: PASS.

**Step 5: Commit**

`git add prototype/familytree-visual-wow.html prototype/tests/familytree-visual-wow.spec.js && git commit -m "feat: 优化家谱原型移动端体验"`

---

## Final Verification

Run:

`npx playwright test prototype/tests/familytree-visual-wow.spec.js`

Then manually inspect:

- `prototype/familytree-visual-wow.html` in desktop width.
- `prototype/familytree-visual-wow.html` in mobile width.
- Browser console for runtime errors.

If visual inspection is available through the in-app browser, capture desktop and mobile screenshots and check that:

- The first viewport is the working genealogy visualization.
- Nodes, lines, toolbar, dossier, and timeline do not overlap.
- Chinese text remains readable.
- The style clearly reads as Eastern genealogy archive rather than generic dashboard.
