# SyncSketch — Current Status

## 状态：✅ MVP 完成，本地运行中

## 运行中的服务
- 前端：http://localhost:5173 (Vite dev server)
- 后端：http://localhost:3001 (Express + WebSocket)
- 数据库：MongoDB localhost:27017/syncsketch

## 已完成
- 全部 10 个核心功能已实现
- Yjs + CodeMirror 6 实时协同编辑
- 光标共现（6色 + 用户名）
- 文件树（文件夹支持、CRUD、拖拽上传）
- 行内评论系统（创建/回复/标记已解决）
- 版本快照（自动5min + 手动、恢复）
- 导出 .zip
- 改动日志
- Catppuccin Mocha 主题
- JetBrains Mono + Nunito 字体

## 下一步
- 等弄玉确认后部署 Vercel
- WebSocket 服务需要独立部署（Railway/VPS）

## 技术栈
React 18 + Vite + Tailwind v4 + CodeMirror 6 + Yjs + Express + MongoDB
