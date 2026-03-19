# PRD — SyncSketch: Arduino 协作代码编辑器

## 1. 为什么做这个

6 个人做 Arduino 小组作业，代码通过 Discord 传来传去：
- 下载 → 改 → 重新上传 → 对方再下载 → 不知道改了哪里
- 多个 assignment 文件混在聊天记录里找不到
- 有人改错了没法回退
- 不知道谁改了什么

**SyncSketch 就是 "note.ms + 代码高亮 + 多人协作"。**

---

## 2. 核心理念

**打开链接就能用。零登录、零安装、零学习成本。**

你的队友不需要懂 Git、不需要注册账号、不需要安装任何东西。
发一个链接，打开就能一起改代码。

---

## 3. 目标用户

- 大学工程课小组（2-8 人）
- 不会用 Git 的同学
- Arduino / 嵌入式课程
- 任何需要快速共享代码片段的场景

---

## 4. 核心功能

### 4.1 📂 项目空间（URL 即房间）

**访问 `syncsketch.com/engr290-lab3` → 直接进入项目**

- 打开首页 `syncsketch.com` → 自动跳转到随机 slug（如 `/a3x7k`）
- 也可以自定义 URL（如 `/engr290-lab3`）
- URL 路径就是项目名，不需要创建账号
- 任何人有链接就能进
- 左侧文件树，支持文件夹：
  ```
  engr290-lab3/
  ├── main.ino
  ├── sensor.h
  ├── motor.cpp
  └── docs/
      └── pinout.md
  ```
- 新建文件 / 新建文件夹 / 重命名 / 删除
- 支持 .ino / .h / .cpp / .c / .md / .txt
- **拖拽/点击上传**：直接拖文件到文件树区域，或点击上传按钮，自动创建文件并填入内容

### 4.2 ✏️ 实时协同编辑

**多人同时编辑同一个文件，不冲突。**

- 基于 CodeMirror 6 编辑器
- CRDT 算法（Yjs）解决多人编辑冲突
- WebSocket 实时同步
- Arduino/C++ 语法高亮
- 行号 + 自动缩进

### 4.3 👥 光标共现

**看到队友在改哪里。**

- 每个在线用户分配一个颜色
- 能看到其他人的光标位置 + 选中区域
- 光标旁显示用户名标签
- 用户名：进入时随便输个名字就行（不是注册）

### 4.4 💬 行内评论

**选中代码 → 留评论。**

- 选中一行或多行代码 → 右键或按钮 → 添加评论
- 评论显示在代码右侧（类似 GitHub PR review）
- 其他人可以回复
- 可标记为"已解决"（收起）
- 评论带用户名 + 时间戳

### 4.5 📸 版本快照

**改错了？一键回退。**

- **自动快照**：每 5 分钟自动保存一个版本
- **手动快照**：点"Save Checkpoint" → 输入描述（如 "传感器部分完成"）
- 版本列表：时间 + 描述 + 谁触发的
- 点击任何版本 → 预览差异（diff 高亮）
- 一键恢复到那个版本
- 不是 Git 那么复杂 — 就是"存档 / 读档"

### 4.6 📦 一键导出 .zip

- 点击 "Export" → 按文件夹结构打包下载 .zip
- 直接解压丢进 Arduino IDE 就能用
- 单个文件右键 → "Download" 单独下载

### 4.7 📊 贡献记录

**证明每个人都干了活。**

- 简单的改动日志：谁 → 什么时间 → 改了哪个文件
- 不需要复杂的统计，就是一个时间线列表
- 交作业时截图就能证明贡献

---

## 5. 信息架构

```
┌───────────────────────────────────────────────────┐
│  SyncSketch          engr290-lab3     👥 3 online  │
├──────────┬────────────────────────────┬───────────┤
│          │                            │           │
│ 📂 Files │     Code Editor            │ 💬 Comments│
│          │                            │           │
│ main.ino │  1 │ #include <Servo.h>    │ @Ming:    │
│ sensor.h │  2 │                       │ 这行要改   │
│ motor.cpp│  3 │ Servo myServo;        │           │
│ docs/    │  4 │ int sensorPin = A0;   │ @Li:      │
│          │  5 │                       │ 改好了 ✅  │
│          │  6 │ void setup() {        │           │
│          │  7 │   myServo.attach(9);  │           │
│          │    │                       │           │
│ [+ File] │   │ 🔵Ming  🟢Li  🟡Wang  │           │
├──────────┴────────────────────────────┴───────────┤
│ [💾 Save Checkpoint]  [📦 Export .zip]  [📜 History]│
└───────────────────────────────────────────────────┘
```

---

## 6. 技术架构

```
┌──────────────┐     WebSocket      ┌──────────────┐     ┌──────────┐
│   React      │◄──────────────────▶│   Express    │────▶│  MongoDB  │
│   前端       │                    │   后端       │     │           │
│              │                    │              │     │ - 项目     │
│ - CodeMirror │  Yjs CRDT sync     │ - WS server  │     │ - 文件     │
│ - Yjs client │◄──────────────────▶│ - Yjs server │     │ - 快照     │
│ - 文件树     │                    │ - REST API   │     │ - 评论     │
│ - 评论面板   │                    │              │     │ - 改动日志 │
│ - 版本面板   │                    │              │     │           │
└──────────────┘                    └──────────────┘     └──────────┘
```

### 关键技术选型

| 需求 | 方案 | 为什么 |
|------|------|--------|
| 代码编辑器 | CodeMirror 6 | 最专业的 Web 编辑器，原生支持协作 |
| 实时协同 | Yjs (CRDT) | 成熟的 CRDT 库，和 CodeMirror 6 有官方绑定 |
| 实时通信 | WebSocket (ws) | 双向低延迟 |
| 语法高亮 | @codemirror/lang-cpp | Arduino 就是 C++ |
| 后端 | Express + ws | 轻量 |
| 数据库 | MongoDB | 文档型，适合存文件内容和版本 |

### API 端点

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/projects/:slug` | 获取项目信息 + 文件列表 |
| POST | `/api/projects/:slug` | 创建项目（首次访问自动创建） |
| GET | `/api/projects/:slug/files/:path` | 获取文件内容 |
| POST | `/api/projects/:slug/files` | 创建文件/文件夹 |
| DELETE | `/api/projects/:slug/files/:path` | 删除文件 |
| PUT | `/api/projects/:slug/files/:path/rename` | 重命名 |
| POST | `/api/projects/:slug/snapshots` | 创建手动快照 |
| GET | `/api/projects/:slug/snapshots` | 获取快照列表 |
| GET | `/api/projects/:slug/snapshots/:id` | 获取快照内容 |
| POST | `/api/projects/:slug/snapshots/:id/restore` | 恢复到快照 |
| GET | `/api/projects/:slug/comments` | 获取评论 |
| POST | `/api/projects/:slug/comments` | 创建评论 |
| PATCH | `/api/projects/:slug/comments/:id` | 更新评论（标记已解决） |
| GET | `/api/projects/:slug/export` | 导出 .zip |
| GET | `/api/projects/:slug/activity` | 获取改动日志 |
| WebSocket | `/ws/:slug` | Yjs CRDT 同步 + 光标同步 |

### MongoDB Schema

```javascript
// Project
{
  slug: "engr290-lab3",       // URL 路径
  createdAt: Date,
  lastActiveAt: Date
}

// File
{
  projectSlug: "engr290-lab3",
  path: "main.ino",           // 支持 "docs/pinout.md"
  content: "...",
  language: "cpp",
  updatedAt: Date,
  updatedBy: "Ming"
}

// Snapshot
{
  projectSlug: "engr290-lab3",
  description: "传感器部分完成",
  files: [{ path, content }],  // 全量快照
  createdAt: Date,
  createdBy: "Ming"
}

// Comment
{
  projectSlug: "engr290-lab3",
  filePath: "main.ino",
  lineStart: 4,
  lineEnd: 4,
  text: "这行的引脚要改成 A1",
  author: "Li",
  resolved: false,
  replies: [{ text, author, createdAt }],
  createdAt: Date
}

// Activity
{
  projectSlug: "engr290-lab3",
  action: "edit",              // edit / create / delete / snapshot / restore
  filePath: "main.ino",
  author: "Ming",
  summary: "修改了第 4-7 行",
  createdAt: Date
}
```

---

## 7. 设计规范

### 设计原则
- **极简** — 打开就能用，没有多余的按钮
- **代码优先** — 编辑器占最大面积
- **不像 IDE** — 不要吓到不懂代码的同学，更像记事本的感觉

### 配色
| 用途 | 色值 | 说明 |
|------|------|------|
| 背景 | `#1e1e2e` | 深色，护眼 |
| 侧边栏 | `#181825` | 更深，层次感 |
| 编辑器背景 | `#1e1e2e` | 和主背景统一 |
| 文字 | `#cdd6f4` | 柔和白 |
| 强调 | `#89b4fa` | 蓝色，链接/按钮 |
| 成功 | `#a6e3a1` | 绿色，已解决 |
| 警告 | `#f9e2af` | 黄色，未保存 |
| 光标颜色池 | `#f38ba8` `#89b4fa` `#a6e3a1` `#fab387` `#cba6f7` `#94e2d5` | 6 人 6 色 |

### 字体
- **代码：** JetBrains Mono — 等宽，连字符
- **UI：** Nunito — 圆润友好
- **文件名：** JetBrains Mono

### 配色参考
Catppuccin Mocha 色板 — 柔和的深色主题，对眼睛友好

---

## 8. 用户流程

### 创建项目
1. 想一个项目名（如 `engr290-lab3`）
2. 访问 `syncsketch.com/engr290-lab3`
3. 输入你的名字（如 "Ming"）
4. 开始写代码

### 邀请队友
1. 复制 URL 发到 Discord
2. 队友打开 → 输入名字 → 直接进来
3. 能看到彼此的光标

### 日常使用
1. 打开链接
2. 选文件 → 改代码
3. 需要讨论 → 选中代码 → 留评论
4. 觉得差不多了 → Save Checkpoint
5. 要交作业 → Export .zip

---

## 9. MVP 范围

### ✅ V1 包含
- URL 即房间（零登录）
- 文件树（文件 + 文件夹 CRUD）
- CodeMirror 6 编辑器（C++/Arduino 语法高亮）
- Yjs CRDT 实时协同
- 光标共现（颜色 + 名字标签）
- 行内评论（创建 / 回复 / 标记已解决）
- 版本快照（自动 + 手动 + diff + 恢复）
- 一键导出 .zip
- 改动日志
- Express + MongoDB

### 部署
- Vercel（前端 + Serverless API）
- WebSocket 需要独立服务（Vercel 不支持持久 WS，用 Railway 或 VPS 部署 WS server）
- 或者全部用 Express 跑在一台服务器上

### ❌ V2 再做
- 密码保护项目
- 语法检查 / 编译检查
- 接线图可视化
- 移动端适配
- Markdown 预览

---

## 10. 技术亮点（简历价值）

1. **CRDT 实时协同** — 分布式算法，解决多人编辑冲突（Yjs）
2. **WebSocket 双向通信** — 光标同步 + 文档同步
3. **CodeMirror 6 集成** — 专业代码编辑器，协作扩展
4. **版本控制系统** — 自实现快照 + diff + 恢复
5. **零登录架构** — URL routing 即身份
6. **全栈实时应用** — Express + WebSocket + MongoDB

---

## 11. 竞品对比

| 产品 | 缺点 |
|------|------|
| note.ms | 没有语法高亮，没有多文件，没有版本历史 |
| GitHub | 需要注册 + 学 Git，队友不愿意 |
| CodeSandbox | 太重，面向 Web 开发不是 Arduino |
| Google Docs | 不支持代码高亮，格式会乱 |
| **SyncSketch** | **零登录 + 代码高亮 + 实时协同 + 版本快照** |

---

## 12. 面试叙事

> "我在大学做 Arduino 小组项目时，6 个人通过 Discord 传 .ino 文件，每次改完要重新上传下载，不知道谁改了什么，改错了没法回退。我试过让队友用 GitHub，但他们不愿意学。所以我做了 SyncSketch — 一个零登录的实时协作代码编辑器。打开链接就能用，像 Google Docs 一样看到彼此的光标，但支持代码高亮和版本历史。底层用了 Yjs 的 CRDT 算法来解决多人同时编辑的冲突问题。"

---

*这不是练习项目。这是一个你和队友下周就能用的工具。*
