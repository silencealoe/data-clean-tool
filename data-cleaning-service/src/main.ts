import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable validation globally
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Enable CORS if needed
  app.enableCors();

  // Setup Swagger
  const config = new DocumentBuilder()
    .setTitle('数据清洗服务 API')
    .setDescription('数据清洗服务的API文档，用于处理Excel文件中的脏数据，提供数据清洗和标准化功能')
    .setVersion('1.0')
    .addTag('data-cleaning', '数据清洗相关接口')
    .addTag('file-management', '文件管理相关接口')
    .addTag('export', '数据导出相关接口')
    .addServer('http://localhost:3100', '开发环境')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Setup Swagger UI
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
    customSiteTitle: '数据清洗服务 API 文档',
  });

  // Generate swagger.json file
  const outputPath = path.resolve(process.cwd(), 'swagger.json');
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2));
  console.log(`Swagger JSON file generated at: ${outputPath}`);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger documentation available at: http://localhost:${port}/api-docs`);
}
bootstrap();
