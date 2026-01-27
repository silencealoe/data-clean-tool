# 设计文档

## 概述

本设计文档描述了数据清洗服务前端规则配置功能的技术实现方案。该功能提供简洁易用的PC端界面，让用户能够查看和编辑规则配置，操作简单直观。

## 技术栈

- **前端框架**: React 18 + TypeScript
- **UI组件库**: 基于现有的shadcn/ui组件
- **状态管理**: React Query (TanStack Query) 用于服务器状态管理
- **HTTP客户端**: 扩展现有的axios客户端
- **样式**: Tailwind CSS
- **表单处理**: React Hook Form + Zod验证

## 架构设计

### 组件架构

```
RuleConfigPage (页面组件)
├── RuleConfigHeader (页面头部)
├── RuleConfigViewer (配置查看器)
│   ├── ConfigMetadata (配置元数据显示)
│   ├── FieldRulesDisplay (字段规则展示)
│   └── GlobalSettingsDisplay (全局设置展示)
├── RuleConfigEditor (配置编辑器)
│   ├── ConfigMetadataForm (元数据编辑表单)
│   ├── FieldRulesForm (字段规则编辑表单)
│   └── GlobalSettingsForm (全局设置编辑表单)
└── ActionButtons (操作按钮组)
```

### 数据流

1. **加载配置**: 页面加载时调用 `/api/rule-config/current` 获取当前配置
2. **编辑模式**: 用户点击编辑按钮切换到编辑模式
3. **保存配置**: 用户保存时调用 `/api/rule-config/update` 更新配置
4. **重载配置**: 用户点击重载按钮调用 `/api/rule-config/reload` 重新加载

## 详细设计

### 1. 页面布局设计

#### 主页面结构
- **顶部区域**: 页面标题、当前配置基本信息、操作按钮
- **内容区域**: 配置详情展示/编辑区域
- **底部区域**: 保存/取消按钮（编辑模式时显示）

#### 响应式考虑
- 专为PC端设计，最小宽度1200px
- 使用固定布局，不考虑移动端适配

### 2. 组件设计

#### RuleConfigPage (主页面组件)
```typescript
interface RuleConfigPageProps {}

interface RuleConfigPageState {
  isEditing: boolean;
  currentConfig: RuleConfiguration | null;
  editingConfig: RuleConfiguration | null;
}
```

**功能**:
- 管理页面状态（查看/编辑模式）
- 协调子组件交互
- 处理数据加载和保存

#### RuleConfigViewer (配置查看器)
```typescript
interface RuleConfigViewerProps {
  config: RuleConfiguration;
  onEdit: () => void;
}
```

**功能**:
- 以只读方式展示配置信息
- 提供清晰的数据结构展示
- 支持展开/折叠详细信息

#### RuleConfigEditor (配置编辑器)
```typescript
interface RuleConfigEditorProps {
  config: RuleConfiguration;
  onSave: (config: RuleConfiguration) => void;
  onCancel: () => void;
}
```

**功能**:
- 提供表单化的配置编辑界面
- 实时验证用户输入
- 支持字段规则的增删改

### 3. API集成设计

#### 扩展API客户端
```typescript
// 在现有 api-client.ts 中添加规则配置相关方法
class ApiClientImpl implements ApiClient {
  // 获取当前配置
  async getCurrentRuleConfig(): Promise<RuleConfigResponse> {
    const response = await this.client.get<RuleConfigResponse>('/api/rule-config/current');
    return response.data;
  }

  // 更新配置
  async updateRuleConfig(config: RuleConfiguration, description?: string): Promise<RuleConfigResponse> {
    const response = await this.client.put<RuleConfigResponse>('/api/rule-config/update', {
      configuration: config,
      description
    });
    return response.data;
  }

  // 重载配置
  async reloadRuleConfig(): Promise<RuleConfigResponse> {
    const response = await this.client.post<RuleConfigResponse>('/api/rule-config/reload');
    return response.data;
  }
}
```

#### React Query集成
```typescript
// hooks/use-rule-config.ts
export function useRuleConfig() {
  return useQuery({
    queryKey: ['rule-config', 'current'],
    queryFn: () => apiClient.getCurrentRuleConfig(),
    staleTime: 5 * 60 * 1000, // 5分钟
  });
}

export function useUpdateRuleConfig() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ config, description }: { config: RuleConfiguration; description?: string }) =>
      apiClient.updateRuleConfig(config, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-config'] });
    },
  });
}

export function useReloadRuleConfig() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => apiClient.reloadRuleConfig(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-config'] });
    },
  });
}
```

### 4. 类型定义

#### 规则配置类型
```typescript
// types/rule-config.ts
export interface RuleConfiguration {
  metadata: RuleMetadata;
  fieldRules: Record<string, FieldRule[]>;
  globalSettings: GlobalSettings;
}

export interface RuleMetadata {
  name: string;
  description: string;
  version: string;
  priority: number;
}

export interface FieldRule {
  name: string;
  strategy: string;
  params: ValidationParams;
  required: boolean;
  priority?: number;
  errorMessage?: string;
}

export interface GlobalSettings {
  strictMode: boolean;
  continueOnError: boolean;
  maxErrors: number;
  enableCaching?: boolean;
  cacheTimeout?: number;
  parallelProcessing?: boolean;
  maxParallelTasks?: number;
  logLevel?: string;
  enablePerformanceMonitoring?: boolean;
}

export interface RuleConfigResponse {
  success: boolean;
  configuration?: RuleConfiguration;
  message?: string;
  error?: string;
  metadata?: Record<string, any>;
}
```

### 5. 用户界面设计

#### 配置查看界面
- **配置概览卡片**: 显示配置名称、版本、描述、最后修改时间
- **字段规则列表**: 以表格形式展示各字段的验证规则
- **全局设置面板**: 显示全局配置选项

#### 配置编辑界面
- **元数据编辑**: 配置名称、描述、版本号编辑
- **字段规则编辑**: 
  - 字段列表，支持添加/删除字段
  - 每个字段的规则列表，支持添加/删除/编辑规则
  - 规则参数的表单化编辑
- **全局设置编辑**: 各项全局配置的开关和数值设置

#### 交互设计
- **编辑模式切换**: 点击"编辑"按钮进入编辑模式
- **保存确认**: 保存前显示确认对话框
- **错误提示**: 验证失败时高亮错误字段并显示提示信息
- **加载状态**: 数据加载和保存时显示加载指示器

### 6. 错误处理

#### 客户端错误处理
- **网络错误**: 显示网络连接失败提示，提供重试按钮
- **验证错误**: 实时显示表单验证错误，阻止无效提交
- **服务器错误**: 解析服务器返回的错误信息，显示用户友好的提示

#### 错误恢复机制
- **自动重试**: 网络请求失败时提供重试选项
- **数据恢复**: 编辑过程中意外刷新页面时提示用户是否恢复未保存的更改
- **回退机制**: 保存失败时保持编辑状态，允许用户修正后重新保存

### 7. 性能优化

#### 渲染优化
- **组件懒加载**: 大型配置编辑器组件按需加载
- **虚拟化**: 字段规则列表较长时使用虚拟滚动
- **防抖处理**: 表单输入验证使用防抖，避免频繁验证

#### 数据优化
- **缓存策略**: 使用React Query缓存配置数据
- **增量更新**: 只提交变更的配置部分
- **压缩传输**: 大型配置数据启用gzip压缩

## 实现计划

### 阶段1: 基础架构
1. 创建基础组件结构
2. 集成API客户端
3. 设置React Query

### 阶段2: 查看功能
1. 实现配置查看器组件
2. 添加数据展示逻辑
3. 完善UI样式

### 阶段3: 编辑功能
1. 实现配置编辑器组件
2. 添加表单验证
3. 集成保存和重载功能

### 阶段4: 优化完善
1. 错误处理完善
2. 性能优化
3. 用户体验优化

## 测试策略

### 单元测试
- 组件渲染测试
- 用户交互测试
- API调用测试

### 集成测试
- 端到端用户流程测试
- API集成测试
- 错误场景测试

### 用户测试
- 可用性测试
- 性能测试
- 兼容性测试