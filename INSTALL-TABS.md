# 安装 Tabs 组件依赖

## 需要安装的依赖

```bash
cd data-cleaning-frontend
pnpm add @radix-ui/react-tabs
```

## 已创建的文件

1. ✅ `src/components/ui/tabs.tsx` - Tabs UI 组件
2. ✅ `src/components/data-viewer.tsx` - 数据查看器组件（支持Tab切换）
3. ✅ 修改了 `src/components/file-detail.tsx` - 集成了DataViewer组件

## 功能说明

### DataViewer 组件特性

- **Tab切换**: 在清洁数据和异常数据之间切换
- **分页支持**: 每页显示50条数据，支持翻页
- **实时统计**: 显示每个Tab的数据总数
- **下载功能**: 每个Tab都有对应的下载按钮
- **刷新功能**: 可以刷新当前Tab的数据
- **美观UI**: 
  - 清洁数据使用绿色主题
  - 异常数据使用橙色/红色主题
  - 异常数据显示详细的错误信息
  - 响应式设计，支持横向滚动

### 使用方式

在文件详情页面，当文件处理完成后，会自动显示数据查看器。用户可以：

1. 点击"清洁数据"或"异常数据"Tab切换视图
2. 使用分页控件浏览数据
3. 点击下载按钮下载对应的数据
4. 点击刷新按钮重新加载数据

## 安装后启动

```bash
cd data-cleaning-frontend
pnpm install
pnpm dev
```

前端将在 http://localhost:5173 启动
