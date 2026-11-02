# 设计质量检测

本地单用户版本，Node.js 22。

1. 执行 `npm install`。
2. 复制 `.env.example` 为 `.env`，填写 `DEEPSEEK_API_KEY`。
3. 执行 `npm start`，访问 http://127.0.0.1:3000 。

发起检测只需导入文档，或选择系统内已有设计文档。支持 HTML/HTM、Word DOCX/DOC、Markdown、UTF-8 TXT。最大10MB，提取后正文最多50000字；不支持图片OCR。项目、版本、负责人无需手填：关联记录有元数据时自动沿用，否则显示未关联项目、V1.0、待分配。

上传文档会保存为可复用记录。每次检测独立保存输入快照。正文发送到 DeepSeek，报告可下载为 JSON。采纳后支持整改与人工复检。

## 模块联动接口

- `GET /api/documents`：文档记录列表，含 id、name、version、owner、project、characters。
- `POST /api/documents`：登记文档，JSON `{name, contentBase64}`（文件）或 `{name, text}`（已提取正文）。可选 project、version、owner、requirements、standards、components。返回 id。
- `POST /api/tasks`：JSON `{documentId}`，使用服务端文档记录及关联资料创建独立检测快照。
- 原有完整输入任务接口保留兼容性。

记录按版本分别登记，返回的文档ID作为模块间引用；当前无外部模块同步、身份认证或权限控制，仅监听本机。上传原始二进制不保留，持久化提取后的正文及元数据。

任务和文档保存在被 Git 忽略的 data 目录。仅运行一个实例；重启时未完成任务转为失败。并发最多3个分析任务。`npm test` 运行解析与接口回归测试。
