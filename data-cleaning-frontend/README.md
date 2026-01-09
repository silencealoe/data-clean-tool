# 数据清洗服务前端

专业的Excel数据清洗和标准化服务前端应用。

## 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite (Rolldown)
- **UI组件库**: shadcn/ui (基于 Radix UI 和 Tailwind CSS)
- **状态管理**: Zustand
- **数据获取**: React Query (TanStack Query)
- **HTTP客户端**: Axios
- **路由**: React Router
- **样式**: Tailwind CSS
- **图标**: Lucide React
- **测试**: Vitest + React Testing Library + fast-check

## 开发环境设置

### 安装依赖

```bash
pnpm install
```

### 环境配置

复制 `.env.example` 到 `.env` 并根据需要修改配置：

```bash
cp .env.example .env
```

### 启动开发服务器

```bash
pnpm dev
```

### 构建生产版本

```bash
pnpm build
```

### 运行测试

```bash
# 运行所有测试
pnpm test

# 运行测试一次（CI模式）
pnpm test:run

# 运行测试UI
pnpm test:ui
```

### 代码检查

```bash
pnpm lint
```

## 项目结构

```
src/
├── components/     # React组件
├── hooks/         # 自定义React hooks
├── lib/           # 工具函数和配置
├── pages/         # 页面组件
├── services/      # API服务
├── store/         # 状态管理
├── types/         # TypeScript类型定义
└── test/          # 测试配置
```

## API配置

默认API地址为 `http://localhost:3000`，可通过环境变量 `VITE_API_BASE_URL` 修改。

## 开发指南

1. 使用 shadcn/ui 组件构建界面
2. 使用 Zustand 管理应用状态
3. 使用 React Query 处理数据获取和缓存
4. 使用 Axios 进行HTTP请求
5. 编写单元测试和属性测试确保代码质量