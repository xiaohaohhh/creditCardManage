# 信用卡管家 (Credit Card Manager)

这是一个基于 React 19 + TypeScript + Vite 7 构建的渐进式 Web 应用 (PWA)，旨在帮助用户轻松管理多张信用卡的账单日和还款日，确保按时还款并优化额度使用。

## ✨ 功能特性

- **多卡片管理**：记录不同银行信用卡的额度、账单日、还款日等信息。
- **账单周期追踪**：自动计算距离下一个账单日和还款日的天数。
- **紧急程度提醒**：根据还款日临近程度（安全、预警、紧急）自动进行颜色标记。
- **本地存储**：使用 IndexedDB (Dexie) 在浏览器本地存储数据，保护隐私。
- **端到端加密**：支持使用主密码对敏感卡片信息（卡号、CVV、照片）进行 AES-256-GCM 加密。
- **PWA 支持**：支持离线运行，可作为桌面或移动端应用安装。
- **响应式设计**：基于 Tailwind CSS 4 构建，适配各种屏幕尺寸。

## 🛠️ 技术栈

- **前端框架**：React 19
- **构建工具**：Vite 7
- **编程语言**：TypeScript 5.9
- **样式处理**：Tailwind CSS 4
- **本地数据库**：Dexie (IndexedDB)
- **日期处理**：date-fns
- **图标库**：Lucide React
- **PWA 插件**：vite-plugin-pwa

## 🚀 快速开始

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
```

### 预览生产版本
```bash
npm run preview
```

## 📁 项目结构

```
src/
├── components/     # 可复用 UI 组件 (CardForm, CardItem)
├── pages/          # 路由页面 (首页、添加卡片、设置等)
├── hooks/          # 自定义 React hooks (useCards)
├── utils/          # 工具函数 (加密、账单计算、同步逻辑)
├── db/             # 数据库定义与迁移 (Dexie)
├── types/          # TypeScript 类型定义
├── main.tsx        # 入口文件
└── App.tsx         # 路由配置
```

## 🔐 安全说明

- **隐私第一**：本项目默认将所有数据存储在用户的本地设备上。
- **加密机制**：启用加密后，应用会通过 PBKDF2 算法从用户密码派生密钥，并使用 Web Crypto API 进行 AES-GCM 加密。
- **敏感数据保护**：卡号、CVV 和卡片照片在存储前都会经过加密处理。

## 📝 贡献指南

1. 所有的代码逻辑请遵循 `AGENTS.md` 中的规范。
2. 保持 UI 的简洁与响应式设计。
3. 提交 PR 前请确保 `npm run lint` 通过。。。
