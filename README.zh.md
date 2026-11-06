# Afterlight BBS · 余烬公告板

[English](README.md) · [在线演示](https://xujinhui2015.github.io/afterlight-bbs/) · [GitHub 仓库](https://github.com/xujinhui2015/afterlight-bbs)

让拨号时代的社区公告板，在断网的今天继续发光。

Afterlight BBS 是为 **Kiroween 2026 / Resurrection** 新建的开源项目：用复古终端的阅读体验，重新组织邻里求助与资源信息。初版完全在浏览器本地运行，无需账户、API Key 或远程服务。

## 初版功能

- 发布求助或可提供的资源，记录分类、区域与详细说明。
- 按类型、处理状态和关键词查找公告。
- 根据分类、区域与文本相似信息寻找相关公告，并解释匹配理由。
- 标记已解决、重新开启公告。
- 浏览器本地保存，JSON 导出备份与导入合并；导入时展示冲突预览，支持逐条选择保留本地或采用导入版本。
- PWA 离线缓存：已实现首次在线加载后的资源缓存；完整断网刷新能力仍待进一步浏览器验收。
- 响应式界面与键盘操作。

这是本地交互原型：不同设备之间不会自动同步，匹配是可解释的规则计算，也没有人员响应或信息核验保证。请勿将其当作实时救援服务；示例数据仅用于演示。

## 本地运行

依赖：Node.js 22.12 或更新版本，以及 npm。

```powershell
npm ci
npm run dev
```

访问终端输出的本地地址。开发服务器主要用于调试；离线能力请用生产构建验证。

```powershell
npm test
npm run build
npm run preview
```

构建产物位于 `dist/`，可发布到支持 HTTPS 的静态托管服务。构建使用相对资源路径，以支持 GitHub Pages 的仓库子路径。`localhost` 也支持 Service Worker；普通 HTTP 公网地址不支持。

当前验证：核心测试与生产构建通过，发布、搜索、状态切换和刷新保存已在内置浏览器中操作验证。离线缓存提示就绪后，关闭本地服务器再刷新未能恢复完整界面；离线浏览器验收尚未完成，需要在常用浏览器中继续排查和验证。

## 演示流程

1. 浏览示例公告，搜索关键词（如 `lanterns` 或 `Lighthouse`）。
2. 发布一条求助，打开详情并查看匹配理由。
3. 将公告标记为已解决，再重新开启。
4. 导出 JSON；导入同一文件，查看冲突预览对话框；取消后确认数据不变；再次导入确认没有重复公告。
5. 在线打开生产预览，等待离线缓存完成；刷新后断网访问并继续操作。

## Kiro 与参赛状态

本项目于 **2026 年 11 月 6 日** 开始创建，于 **2026 年 11 月 7 日** 使用 **Kiro CLI**（`kiro-cli chat`）完成导入冲突预览功能，并将界面改为英文。

`.kiro/specs/import-conflict-review/` 规格驱动了本轮开发。详细记录见 [Kiro 工作记录](docs/kiro-worklog.md) 和 [提交草稿](docs/submission.md)。

[比赛官方页面](https://kiroween.devpost.com/)提交截止为北京时间 **2026 年 12 月 5 日 06:00**。

## 目录

```text
.kiro/   Kiro 规格与项目约束
docs/    架构、实际开发记录及参赛草稿
public/  离线缓存及应用图标
src/     界面与领域逻辑
tests/   自动化测试
```

技术边界与数据流见 [架构说明](docs/architecture.md)。本项目采用 [MIT License](LICENSE)。
