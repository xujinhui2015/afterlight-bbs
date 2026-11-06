# 实现任务

- [x] 阅读现有领域逻辑、界面和测试，审查需求及设计。
- [x] 实现导入分析与显式冲突决策的纯函数（`analyzeImport`、`applyImportPlan`）。
- [x] 验证文件内部重复 ID、字段顺序、取消与幂等性边界（测试用例覆盖）。
- [x] 实现带本地版/导入版选择的预览对话框（`#import-preview-dialog`）。
- [x] 确认提交前检测本地数据变化，预览期间本地更新时重新分析并提示再次确认。
- [x] 验证键盘操作（焦点恢复到导入按钮）、安全文本渲染（全部使用 textContent）。
- [x] 运行 `npm test`（14/14 通过）、`npm run build`（无报错）。
- [x] 更新 `docs/kiro-worklog.md` 与 `docs/submission.md`。

完成时间：2026-11-07，Kiro CLI 会话 1。
