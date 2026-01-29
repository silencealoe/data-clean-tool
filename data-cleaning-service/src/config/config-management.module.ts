import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigValidationService } from './config-validation.service';
import { ConfigManagerService } from './config-manager.service';
import redisConfig from './redis.config';
import queueConfig from './queue.config';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [redisConfig, queueConfig],
      cache: true,
      expandVariables: true,
    }),
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),
  ],
  providers: [
    ConfigValidationService,
    ConfigManagerService,
  ],
  exports: [
    ConfigValidationService,
    ConfigManagerService,
    ConfigModule,
  ],
})
export class ConfigManagementModule {}