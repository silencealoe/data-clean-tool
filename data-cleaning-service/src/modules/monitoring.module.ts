import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MetricsService } from '../services/monitoring/metrics.service';
import { HealthCheckService } from '../services/monitoring/health-check.service';
import { MonitoringController } from '../controllers/monitoring.controller';
import { ConfigManagementModule } from '../config/config-management.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([]), // Add entities if needed
    EventEmitterModule,
    ConfigManagementModule,
  ],
  controllers: [MonitoringController],
  providers: [
    MetricsService,
    HealthCheckService,
  ],
  exports: [
    MetricsService,
    HealthCheckService,
  ],
})
export class MonitoringModule {}