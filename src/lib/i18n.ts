import type { Language } from '../types'

const zh: Record<string, string> = {
  appTagline: '本地文件批处理工作台', privacy: '文件仅在本机处理', inbox: '文件收件箱', addFiles: '添加文件', addFolder: '添加文件夹',
  dropTitle: '拖入文件或文件夹', dropHint: 'DOCX 与 XLSX 可处理内容，其他文件可批量改名', totalFiles: '文件', wordFiles: 'Word', excelFiles: 'Excel', issues: '问题',
  searchFiles: '搜索文件', allTypes: '全部类型', selectedCount: '已选 {count} 项', selectAll: '全选', name: '名称', path: '目录', type: '类型', size: '大小', status: '状态',
  healthy: '正常', warning: '警告', blocked: '阻止', remove: '移除', clear: '清空', rename: '批量改名', wordReplace: 'Word 替换', excelReplace: 'Excel 替换',
  backInbox: '返回收件箱', rules: '改名规则', addRule: '添加规则', ruleType: '规则类型', replace: '查找替换', prefix: '添加前缀', suffix: '添加后缀', sequence: '添加序号',
  letterCase: '大小写', normalize: '规范名称', date: '添加日期', find: '查找内容', replacement: '替换为', regex: '正则表达式', caseSensitive: '区分大小写', value: '内容',
  start: '起始值', digits: '位数', separator: '分隔符', lower: '小写', upper: '大写', titleCase: '首字母大写', unicodeNfc: 'Unicode NFC', cleanWhitespace: '清理空白',
  dateFormat: '日期格式', beforeName: '名称前', afterName: '名称后', lockExtension: '锁定扩展名', resolveCollisions: '自动解决冲突', savePreset: '保存规则预设', loadPreset: '载入预设',
  before: '原名称', after: '新名称', preview: '预览', run: '生成副本', previewRequired: '请先完成预览', outputCollision: '输出名称冲突', noChange: '无变化',
  exact: '精确匹配', flexibleWhitespace: '宽松空白', matchMode: '匹配方式', scope: '查找范围', bodyTables: '正文、表格与文本框', headersFooters: '页眉与页脚', notes: '脚注与尾注',
  scan: '扫描匹配', matches: '匹配项', noMatches: '没有找到匹配内容', location: '位置', context: '上下文', file: '文件', selectedMatches: '将替换 {count} 处',
  wholeCell: '匹配整个单元格', substring: '匹配单元格中的文字', sheets: '工作表', allSheets: '全部工作表', formulasSafe: '公式始终跳过', rescanAfterSheets: '工作表选择变化后请重新扫描',
  processing: '正在处理', cancel: '取消任务', audit: '正在体检文件', packaging: '正在打包结果', complete: '处理完成', success: '成功', skipped: '跳过', failed: '失败', applied: '已应用',
  downloadZip: '下载全部 ZIP', downloadCsv: '下载 CSV 报告', downloadJson: '下载 JSON 报告', saveFolder: '保存到文件夹', startAnother: '返回收件箱', resultSummary: '{success} 成功 · {skipped} 跳过 · {failed} 失败',
  installDesktop: '可安装为桌面应用并离线使用', mobileNotice: '批量处理建议在宽度至少 1024px 的桌面浏览器中使用。', emptyFile: '空文件', illegalName: '名称含非法字符', reservedName: 'Windows 保留名称',
  longName: '名称可能过长', duplicatePath: '文件路径重复', invalidOoxml: 'Office 文件结构无效', invalidRegex: '正则表达式无效', emptyPattern: '查找规则不能为空', invalidRename: '改名规则无效',
  trackedChanges: '包含未接受的修订，请先在 Word 中接受或拒绝修订', invalidOrEncryptedDocx: 'DOCX 损坏、加密或无法读取', notDocx: '扩展名与 DOCX 内容不符', invalidXlsx: 'XLSX 损坏或无法读取',
  notXlsx: '扩展名与 XLSX 内容不符', invalidXlsxRelationships: 'XLSX 工作表关系损坏', formulasSkipped: '已跳过公式单元格', fileNotReady: '文件尚未准备好', processingFailed: '处理失败',
  largeBatch: '本批文件较大，处理时间和内存占用可能增加。', unsupported: '仅支持改名', legacy: '旧版 Office 格式，仅支持改名', close: '关闭', enabled: '启用', deleteRule: '删除规则',
  report: '报告', progressOf: '{done} / {total}', noSelectedFiles: '请先选择文件', unsupportedSelection: '当前选择中没有可处理的文件', runNeedsMatches: '没有选中的匹配项',
  workerLoadFailed: '后台处理模块加载失败，请刷新页面重试', workerMessageFailed: '后台处理消息无法读取',
}

const en: Record<string, string> = {
  appTagline: 'Local batch file workspace', privacy: 'Files stay on this device', inbox: 'File inbox', addFiles: 'Add files', addFolder: 'Add folder',
  dropTitle: 'Drop files or folders', dropHint: 'Process DOCX and XLSX content; rename any file type', totalFiles: 'Files', wordFiles: 'Word', excelFiles: 'Excel', issues: 'Issues',
  searchFiles: 'Search files', allTypes: 'All types', selectedCount: '{count} selected', selectAll: 'Select all', name: 'Name', path: 'Folder', type: 'Type', size: 'Size', status: 'Status',
  healthy: 'Ready', warning: 'Warning', blocked: 'Blocked', remove: 'Remove', clear: 'Clear', rename: 'Batch rename', wordReplace: 'Replace in Word', excelReplace: 'Replace in Excel',
  backInbox: 'Back to inbox', rules: 'Rename rules', addRule: 'Add rule', ruleType: 'Rule type', replace: 'Find and replace', prefix: 'Add prefix', suffix: 'Add suffix', sequence: 'Add sequence',
  letterCase: 'Change case', normalize: 'Normalize names', date: 'Add date', find: 'Find', replacement: 'Replace with', regex: 'Regular expression', caseSensitive: 'Case sensitive', value: 'Value',
  start: 'Start', digits: 'Digits', separator: 'Separator', lower: 'Lowercase', upper: 'Uppercase', titleCase: 'Title case', unicodeNfc: 'Unicode NFC', cleanWhitespace: 'Clean whitespace',
  dateFormat: 'Date format', beforeName: 'Before name', afterName: 'After name', lockExtension: 'Lock extension', resolveCollisions: 'Resolve collisions', savePreset: 'Save preset', loadPreset: 'Load preset',
  before: 'Before', after: 'After', preview: 'Preview', run: 'Create copies', previewRequired: 'Preview is required first', outputCollision: 'Output name collision', noChange: 'No change',
  exact: 'Exact', flexibleWhitespace: 'Flexible whitespace', matchMode: 'Match mode', scope: 'Search scope', bodyTables: 'Body, tables, and text boxes', headersFooters: 'Headers and footers', notes: 'Footnotes and endnotes',
  scan: 'Scan matches', matches: 'Matches', noMatches: 'No matching content found', location: 'Location', context: 'Context', file: 'File', selectedMatches: '{count} replacements selected',
  wholeCell: 'Match the whole cell', substring: 'Match text within cells', sheets: 'Worksheets', allSheets: 'All worksheets', formulasSafe: 'Formulas are always skipped', rescanAfterSheets: 'Rescan after changing worksheets',
  processing: 'Processing', cancel: 'Cancel job', audit: 'Auditing files', packaging: 'Packaging results', complete: 'Complete', success: 'Success', skipped: 'Skipped', failed: 'Failed', applied: 'Applied',
  downloadZip: 'Download ZIP', downloadCsv: 'Download CSV report', downloadJson: 'Download JSON report', saveFolder: 'Save to folder', startAnother: 'Back to inbox', resultSummary: '{success} succeeded · {skipped} skipped · {failed} failed',
  installDesktop: 'Installable desktop app with offline support', mobileNotice: 'Use a desktop browser at least 1024px wide for batch processing.', emptyFile: 'Empty file', illegalName: 'Name contains invalid characters', reservedName: 'Windows reserved name',
  longName: 'Name may be too long', duplicatePath: 'Duplicate file path', invalidOoxml: 'Invalid Office file structure', invalidRegex: 'Invalid regular expression', emptyPattern: 'Find pattern cannot be empty', invalidRename: 'Invalid rename rule',
  trackedChanges: 'Contains unresolved tracked changes; accept or reject them in Word first', invalidOrEncryptedDocx: 'DOCX is damaged, encrypted, or unreadable', notDocx: 'Extension does not match DOCX content', invalidXlsx: 'XLSX is damaged or unreadable',
  notXlsx: 'Extension does not match XLSX content', invalidXlsxRelationships: 'XLSX worksheet relationships are invalid', formulasSkipped: 'Formula cells were skipped', fileNotReady: 'File is not ready', processingFailed: 'Processing failed',
  largeBatch: 'This batch is large and may use more time and memory.', unsupported: 'Rename only', legacy: 'Legacy Office format; rename only', close: 'Close', enabled: 'Enabled', deleteRule: 'Delete rule',
  report: 'Report', progressOf: '{done} / {total}', noSelectedFiles: 'Select files first', unsupportedSelection: 'No supported files are selected', runNeedsMatches: 'No matches are selected',
  workerLoadFailed: 'The background processor failed to load. Refresh and try again.', workerMessageFailed: 'The background processor could not read the request.',
}

const dictionaries = { zh, en }

export function translate(language: Language, key: string, variables: Record<string, string | number> = {}): string {
  const template = dictionaries[language][key] ?? dictionaries.en[key] ?? key
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(variables[name] ?? `{${name}}`))
}
