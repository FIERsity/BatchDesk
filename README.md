# BatchDesk

[![Checks](https://github.com/FIERsity/BatchDesk/actions/workflows/checks.yml/badge.svg)](https://github.com/FIERsity/BatchDesk/actions/workflows/checks.yml)
[![Deploy Pages](https://github.com/FIERsity/BatchDesk/actions/workflows/pages.yml/badge.svg)](https://github.com/FIERsity/BatchDesk/actions/workflows/pages.yml)

本地优先的批量文件处理工作台。批量检查和重命名文件，在 DOCX 与 XLSX 中查找替换文字，全程在浏览器中完成。

在线使用：[FIERsity.github.io/BatchDesk](https://FIERsity.github.io/BatchDesk/)

## 功能

- 文件收件箱：导入文件或文件夹，搜索、筛选并检查名称风险
- 文件体检：空文件、非法字符、保留名称、路径冲突、过长名称及损坏的 Office 文件
- 批量改名：结构化组装表固定左侧原始标题和右侧预览标题，中间的序号、分隔符/固定文字、原始标题、扩展名和手动输入字段由用户自行添加、配置和左右移动；支持表头直接编辑、逐行校对、扩展名锁定、冲突预览和安全输出。另保留查找替换、前后缀、大小写、日期和高级正则规则模式
- Word 替换：精确或宽松空白匹配，可跨格式片段，支持正文、表格、文本框、页眉页脚、脚注和尾注
- Excel 替换：选择工作表、整格或子串匹配，公式始终跳过
- 安全输出：先预览再运行，生成副本及 ZIP、CSV、JSON 报告；目录输出使用独立任务文件夹，不覆盖已有文件
- PWA：首次加载后可安装并离线使用；中英文界面

## 隐私

BatchDesk 没有账户、后端、分析脚本或云端存储。用户文件不会上传，也不会写入浏览器缓存。刷新页面后，当前文件会话即被清除；本地只保存语言和不含文件内容的改名规则预设。

## 支持范围

内容处理支持 `.docx` 和 `.xlsx`。其他文件可参与检查与改名。

- DOCX 不跨段落匹配，不修改域代码、批注或删除修订。含未接受修订、数字签名、加密或损坏的文档会被阻止。
- XLSX 只修改文本单元格并跳过公式。共享字符串会按单元格克隆，避免影响未选择的工作表或单元格。
- 带数字签名的 DOCX/XLSX 会被跳过，避免生成签名失效但看似正常的副本。
- `.doc`、`.xls` 和 `.xlsm` 第一版仅支持改名。
- 第一版不包含 Word 合并、Excel 合并拆分、PDF、OCR、AI 或内容哈希去重。

## 本地开发

需要 Node.js 24 或更高版本。

```bash
npm install
npm run dev
```

完整检查：

```bash
npm run check
```

## 架构

```text
src/
├── components/       # 文件收件箱与任务界面
├── lib/              # 文件审计、改名、OOXML、DOCX、XLSX、报告
├── worker/           # Worker 协议、客户端与批处理执行器
├── test/             # 合成 Office 测试夹具
├── App.tsx
└── types.ts
```

DOCX 与 XLSX 都是 ZIP 封装的 OOXML。BatchDesk 使用 JSZip 读取包，精确修改目标 XML 文本节点，再将原有包内容重新打包。解析、扫描、替换与打包都在 Web Worker 中执行，主线程只负责交互和进度。

## Roadmap

- Excel 清洗、合并与拆分
- 精确重复文件检测和文件整理规则
- Word 文档安全合并
- PDF 表格提取与可选本地 OCR

## License

[MIT](LICENSE)

---

## English

BatchDesk is a local-first batch file workspace for auditing and renaming files and replacing text in DOCX and XLSX documents. Files stay in the browser, originals are never modified, and every operation is previewed before export.
