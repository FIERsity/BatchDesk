# AGENTS.md

## 作用域与上级规则

本文件适用于 BatchDesk 仓库。跨项目策略、Git/main 规则和默认设备范围由 `../070315-site/AGENTS.md` 统一管理。开始跨项目工作或修改本文件前，先读取主文件。

本文件中的 `OWNER-MAINTAINED` 内容只有在用户明确改变产品策略时才能修改。`AGENT-MAINTAINED` 内容是项目事实；代码、配置或工作流改变后，执行变更的代理应同步更新。

## OWNER-MAINTAINED: 产品边界

- BatchDesk 是本地优先的浏览器批量文件工作台。
- 用户文件、文件名、预览、报告和处理结果不得上传到服务器，也不得加入遥测或分析。
- 原文件永不覆盖；所有改名和内容替换先预览，再导出副本及报告。
- 当前内容处理范围是 `.docx` 和 `.xlsx`。`.doc`、`.xls`、`.xlsm` 及其他格式只参与检查和改名。
- PDF、OCR、AI、云上传、Word 合并和 Excel 合并拆分不属于当前默认范围，新增这些能力属于大改动。
- 默认面向桌面横屏开发。不主动进行竖屏专项设计，但保持已有基础响应式和触摸能力不被明显破坏。
- 小改动通过最低验证后可直接提交并推送 `main`；大改动先按主 AGENTS 的标准询问用户。

## 工作方式

1. 检查 `git status --short --branch`，保留已有修改和未跟踪内容。
2. 使用 Node 24 或更高版本、npm 和已提交的 `package-lock.json`。
3. 文件处理行为或安全边界变化必须增加合成 OOXML 回归测试。
4. 使用明确路径暂存，提交前检查 `git diff --cached`。
5. 推送 `main` 会自动发布 GitHub Pages，推送前运行 `npm run check`。

主站的 `../070315-site/tmp_batchdesk_fixtures/` 是本地 DOCX 测试集生成器，包含机器相关输出路径。它不属于本仓库源码；除非任务明确负责迁移或整理该测试集，不得删除、复制或提交。

## AGENT-MAINTAINED: 项目事实

<!-- AGENT-MAINTAINED:START project-facts -->

### 架构

- `src/App.tsx`：内存会话、工作区流转、Worker 生命周期、进度和导出。
- `src/components/`：收件箱、改名、替换、进度和结果界面。
- `src/lib/`：文件审计、改名、OOXML、DOCX、XLSX、报告和下载。
- `src/worker/`：类型化消息协议及批量处理 Worker。
- `src/test/`：合成 Office 测试夹具。
- `public/`：受版本控制的静态资源。
- `dist/`、`dist-ssr/`：构建产物，不编辑、不提交。
- `node_modules/`、TypeScript build-info、`.playwright-cli/`：本地生成内容，不提交。

技术栈为 React、TypeScript、Vite、Vitest、Oxlint、JSZip、xmldom、Tailwind 和 vite-plugin-pwa。解析、扫描、应用和打包在 Web Worker 中进行，当前并发上限为两个文件并支持取消。

### 命令

- 安装：`npm ci`
- 开发：`npm run dev`
- 测试：`npm test`
- 监听测试：`npm run test:watch`
- lint：`npm run lint`
- 构建：`npm run build`
- 完整检查：`npm run check`
- 构建预览：`npm run preview`

最低验证为 `npm run check`。文件导入、目录写入、下载或复杂视觉交互变化还需桌面浏览器检查。

### 发布

Checks workflow 在 push 和 PR 上分别运行测试、lint 和构建。`main` 推送另行构建并发布 `dist/` 到 GitHub Pages；Pages workflow 本身不依赖 Checks workflow，除非 GitHub 外部保护规则强制要求。

公开地址为 `https://FIERsity.github.io/BatchDesk/`。Vite `base: "./"` 保证 GitHub Pages 子路径兼容，不得在部署方式未改变时移除。PWA 只缓存应用资源，不得缓存导入的用户文件。

<!-- AGENT-MAINTAINED:END project-facts -->

## 文件安全不变量

- 用户导入内容只存在于 React/Worker 内存；刷新后会话清空。
- 只允许持久化语言和不含文件内容的规则预设。
- 原始 `File` 不被修改；Office 操作生成新的 Blob。
- 内容替换必须先扫描预览；设置改变后旧预览必须失效并重新扫描。
- 取消操作不得返回或打包部分结果。
- 输出目录必须创建新的任务文件夹；不得写入或覆盖已有任务目录和文件。
- ZIP 路径必须去除空段、`.` 和 `..`，并防止路径穿越。
- 文件名检查保持非法字符、保留名、尾随点/空格、长度和碰撞检测。
- 路径碰撞比较保持 Unicode NFC 归一化和不区分大小写。
- 扩展名默认锁定；改扩展名不等于格式转换。
- 碰撞解决必须可预测且不覆盖文件。

## OOXML 安全不变量

- 只有通过包结构验证的 `.docx` 和 `.xlsx` 才能做内容处理。
- 数字签名的 DOCX/XLSX 必须拒绝内容处理，避免输出签名失效但看似正常的副本。
- DOCX 匹配不得跨段落，但可以跨格式 run；保持正文、表格、文本框、页眉页脚、脚注和尾注范围选择。
- 任一 story part 中存在修订标记时阻止整个 DOCX；不要修改域代码、删除/移动文本或批注范围。
- XLSX 只处理 shared string 和 inline string 文本单元格；包含公式 `<f>` 的单元格始终跳过。
- 修改共享字符串时必须克隆并只重定向目标单元格，不能改变其他单元格或未选择工作表。
- 保留拼音注释、未知 ZIP member、图表和所有无关 XML 结构。
- 替换结果含首尾空白时设置 `xml:space="preserve"`。
- 任何新的 Office 处理行为都应使用最小合成 fixture 覆盖正常、安全拒绝和未选择内容不变三类情况。

## 文案与视觉

中文和 English 文案必须同步维护。保持进度、错误、安全拒绝和报告描述准确，不得把“改扩展名”描述为格式转换。默认重点验收桌面横屏；修改拖放、目录导入、文件系统访问或响应式代码时再增加相应专项测试。

## 文档维护

代理可以更新 `project-facts` 中经过验证的架构、命令、依赖和发布事实。以下变化还必须同步更新 `../070315-site/AGENTS.md`：

- 项目目录、GitHub 仓库或公开 URL 改变。
- 最低验证命令、Node 版本或发布方式改变。
- 隐私边界、支持格式、主要定位或主站工具入口需要改变。

公开功能、支持范围、安装方式或文件安全行为变化时同步更新 README。不要在本文件记录临时进度、提交号、部署版本或秘密信息。
