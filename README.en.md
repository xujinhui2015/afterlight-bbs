# Afterlight BBS

[中文说明](README.md) · [Live demo](https://xujinhui2015.github.io/afterlight-bbs/) · [GitHub repository](https://github.com/xujinhui2015/afterlight-bbs)

Bring the community bulletin board of the dial-up era back to life, with local tools for neighbors to organize requests and available resources.

Afterlight BBS is a new open-source project intended for **Kiroween 2026 / Resurrection**. The prototype runs entirely in the browser, without an account, API key, or application backend.

## Prototype features

- Publish a request or offer with a category, neighborhood, and description.
- Search posts and filter by type and completion status.
- Find related posts using transparent category, neighborhood, and keyword rules.
- Mark posts as completed and reopen them.
- Save locally in the browser and export or merge JSON backups.
- Cache production assets with a Service Worker; complete offline reload verification remains pending.
- Responsive Chinese interface with keyboard controls. This document provides English testing instructions.

This is a local prototype. Devices do not synchronize automatically, matching does not use an online AI service, and no human response or information verification is guaranteed. It is not an emergency response service. All example posts are fictional.

## Run locally

Requirements: **Node.js 22.12 or later** and npm.

```powershell
npm ci
npm run dev
```

Open the local URL printed in the terminal. The development server is for development; use a production build to investigate offline behavior.

```powershell
npm test
npm run build
npm run preview
```

Production files are written to `dist/`. The application uses relative asset paths to support GitHub Pages repository subpaths. Service Workers require HTTPS or localhost.

## Verification status

The core tests and production build pass. Publishing, search, status changes, and persistence across refresh were exercised in the in-app browser. The public demo has been deployed.

**Offline verification is incomplete.** Although the application reports that its cache is ready, refreshing after stopping the local preview server did not restore the complete interface in the in-app browser. This behavior needs further investigation and testing in a regular browser. The repository does not claim that offline browser acceptance has passed.

## Testing the Chinese interface

1. The initial board contains fictional example posts. Use the search field labeled **搜索公告** to search for `露营灯` (camping light) or `灯塔街区` (Lighthouse neighborhood).
2. Click **发布公告** (Publish post). Choose **我需要帮助** (Request) or **我可以提供** (Offer). Fill in **公告标题** (Title), **资源分类** (Category), **所在街区** (Neighborhood), and **详细说明** (Description). Submit with **发布到本地节点** (Publish locally).
3. Click **查看详情** (View details). Related posts display explanations such as matching category, neighborhood, or keywords. They are suggestions, not confirmed arrangements.
4. Click **标记为已完成** (Mark completed), then **重新开启这条公告** (Reopen). Refresh and confirm that the post remains saved.
5. Click **导出节点数据** (Export node data), then **导入邻居的数据** (Import data) and select that JSON file. A preview dialog appears showing new, conflicting, and duplicate posts. For conflicts, choose **保留本地版本** (Keep local) or **采用导入版本** (Use imported) for each entry. Click **确认导入** (Confirm import) to apply, or **取消** to discard — cancelling never changes local data. Importing the same backup again will report that all posts already exist locally.
6. The **恢复示例公告** (Restore examples) action requires confirmation and replaces local posts. Export a backup first if the data matters.
7. For pending offline acceptance, load the production preview online and wait for the cache-ready message. Then test refresh and read/write operations without the server or network. Record the browser and actual results.

## Kiro and submission status

This project started on **November 6, 2026**. The initial prototype was created by Codex. On **November 7, 2026**, **Kiro CLI** (`kiro-cli chat`) was used to implement the import conflict preview feature, driven by the spec in `.kiro/specs/import-conflict-review/`.

Kiro read the requirements, design, and tasks documents, then implemented `analyzeImport` and `applyImportPlan` pure functions in `src/domain.js`, added the preview dialog in `index.html`, `src/app.js`, and `src/styles.css`, and added 4 test cases. All 14 tests pass and the production build succeeds.

The steering file `.kiro/steering/product.md` was active throughout the session, enforcing language, safe text rendering, and offline compatibility rules.

See the [Kiro work log](docs/kiro-worklog.md) and [submission draft](docs/submission.md) for details.

The [official event page](https://kiroween.devpost.com/) lists the deadline as **December 4, 2026, 2:00 PM PST**. Official rules govern eligibility and requirements. Preparing a GitHub repository does not complete a Devpost submission.

## Structure and license

```text
.kiro/   Prepared Kiro specifications and project guidance
docs/    Architecture, development records, and submission drafts
public/  Service Worker, manifest, and application icon
src/     Interface and domain logic
tests/   Automated checks
```

The project is available under the [MIT License](LICENSE). Chinese architecture notes are in [docs/architecture.md](docs/architecture.md).
