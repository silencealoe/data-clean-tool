# 数据清洗服务 - 项目结构

## 目录结构

```
data-cleaning-service/
├── src/
│   ├── main.ts                 # 应用入口
│   ├── app.module.ts           # 根模块
│   ├── app.controller.ts       # 根控制器
│   ├── app.service.ts          # 根服务
│   ├── common/                 # 共享代码
│   │   ├── constants/          # 常量定义
│   │   ├── dto/                # 数据传输对象
│   │   ├── types/              # TypeScript类型定义
│   │   ├── exceptions/         # 自定义异常（待创建）
│   │   └── filters/            # 异常过滤器（待创建）
│   └── modules/                # 功能模块
│       ├── file-record/        # 文件记录模块（待创建）
│       ├── file/               # 文件处理模块（待创建）
│       ├── parser/             # Excel解析模块（待创建）
│       ├── cleaner/            # 数据清洗模块（待创建）
│       └── export/             # 文件导出模块（待创建）
├── test/                       # 测试文件
├── uploads/                    # 上传文件存储（运行时创建）
├── temp/                       # 临时文件存储（运行时创建）
├── .env                        # 环境变量配置
├── .env.example                # 环境变量示例
├── .gitignore                  # Git忽略文件
├── nest-cli.json               # Nest CLI配置
├── package.json                # 项目依赖
├── tsconfig.json               # TypeScript配置
└── README.md                   # 项目说明

## 模块说明

### Common模块
包含整个应用共享的代码：
- **constants**: 应用常量（文件类型、错误码等）
- **dto**: 数据传输对象（请求/响应格式）
- **types**: TypeScript类型定义
- **exceptions**: 自定义异常类
- **filters**: 全局异常过滤器

### File Record模块
管理文件记录的数据库操作：
- 文件元数据存储
- 处理状态跟踪
- 文件列表查询

### File模块
处理文件上传和验证：
- 文件类型验证
- 文件大小检查
- 临时文件管理

### Parser模块
解析Excel文件：
- Excel文件读取
- 工作表解析
- 字段类型识别

### Cleaner模块
数据清洗核心逻辑：
- 手机号清洗
- 日期格式化
- 地址解析
- 数据验证

### Export模块
生成导出文件：
- 清洁数据导出
- 异常数据导出
- Excel文件生成

## 环境配置

复制 `.env.example` 到 `.env` 并配置相应的环境变量：

```bash
cp .env.example .env
```

主要配置项：
- `PORT`: 应用端口（默认3000）
- `DB_*`: 数据库连接配置
- `MAX_FILE_SIZE`: 最大文件大小
- `UPLOAD_DIR`: 上传文件目录
- `TEMP_DIR`: 临时文件目录

## 开发指南

### 安装依赖
```bash
npm install
```

### 运行开发服务器
```bash
npm run start:dev
```

### 运行测试
```bash
npm run test
```

### 构建生产版本
```bash
npm run build
```

## 技术栈

- **NestJS**: 后端框架
- **TypeORM**: ORM框架
- **MySQL**: 数据库
- **Multer**: 文件上传
- **xlsx**: Excel处理
- **class-validator**: 数据验证
- **class-transformer**: 数据转换
