import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { RuleConfigController } from './rule-config.controller';
import { ConfigurationManagerService } from './services/rule-engine/configuration-manager.service';
import { RuleConfiguration, ValidationResult } from './common/types/rule-engine.types';

describe('RuleConfigController', () => {
    let controller: RuleConfigController;
    let configurationManager: jest.Mocked<ConfigurationManagerService>;

    const mockConfiguration: RuleConfiguration = {
        metadata: {
            name: 'test-config',
            description: 'Test configuration',
            version: '1.0.0',
            priority: 100
        },
        fieldRules: {
            phone: [
                {
                    name: 'phone-validation',
                    strategy: 'regex',
                    params: { pattern: '^1[3-9]\\d{9}$' },
                    required: true
                }
            ]
        },
        globalSettings: {
            strictMode: false,
            continueOnError: true,
            maxErrors: 10
        }
    };

    beforeEach(async () => {
        const mockConfigurationManager = {
            initialize: jest.fn().mockResolvedValue(undefined),
            getCurrentConfiguration: jest.fn().mockReturnValue(mockConfiguration),
            updateConfiguration: jest.fn(),
            reloadConfiguration: jest.fn().mockResolvedValue(undefined),
            getConfigurationHistory: jest.fn().mockReturnValue([mockConfiguration]),
            rollbackConfiguration: jest.fn(),
            getConfigurationStats: jest.fn().mockReturnValue({
                currentVersion: '1.0.0',
                historySize: 1,
                totalFields: 1,
                totalRules: 1,
                lastUpdated: new Date(),
                isInitialized: true
            })
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [RuleConfigController],
            providers: [
                {
                    provide: ConfigurationManagerService,
                    useValue: mockConfigurationManager
                }
            ]
        }).compile();

        controller = module.get<RuleConfigController>(RuleConfigController);
        configurationManager = module.get(ConfigurationManagerService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getCurrentConfiguration', () => {
        it('should return current configuration successfully', async () => {
            const result = await controller.getCurrentConfiguration();

            expect(configurationManager.initialize).toHaveBeenCalled();
            expect(configurationManager.getCurrentConfiguration).toHaveBeenCalled();
            expect(result).toEqual({
                success: true,
                configuration: mockConfiguration,
                message: '成功获取当前配置',
                metadata: {
                    timestamp: expect.any(String),
                    version: '1.0.0'
                }
            });
        });

        it('should handle errors when getting current configuration', async () => {
            configurationManager.initialize.mockRejectedValue(new Error('Initialization failed'));

            await expect(controller.getCurrentConfiguration()).rejects.toThrow(HttpException);
        });
    });

    describe('updateConfiguration', () => {
        it('should update configuration successfully', async () => {
            const updateRequest = {
                configuration: mockConfiguration,
                description: 'Test update'
            };

            const mockResult: ValidationResult = {
                success: true,
                value: mockConfiguration,
                metadata: { timestamp: new Date().toISOString() }
            };

            configurationManager.updateConfiguration.mockResolvedValue(mockResult);

            const result = await controller.updateConfiguration(updateRequest);

            expect(configurationManager.initialize).toHaveBeenCalled();
            expect(configurationManager.updateConfiguration).toHaveBeenCalledWith(mockConfiguration);
            expect(result).toEqual({
                success: true,
                configuration: mockConfiguration,
                message: '配置更新成功',
                metadata: expect.objectContaining({
                    description: 'Test update',
                    timestamp: expect.any(String)
                })
            });
        });

        it('should handle validation failure during update', async () => {
            const updateRequest = {
                configuration: mockConfiguration
            };

            const mockResult: ValidationResult = {
                success: false,
                error: 'Validation failed'
            };

            configurationManager.updateConfiguration.mockResolvedValue(mockResult);

            await expect(controller.updateConfiguration(updateRequest)).rejects.toThrow(HttpException);
        });
    });

    describe('reloadConfiguration', () => {
        it('should reload configuration successfully', async () => {
            const result = await controller.reloadConfiguration();

            expect(configurationManager.initialize).toHaveBeenCalled();
            expect(configurationManager.reloadConfiguration).toHaveBeenCalled();
            expect(configurationManager.getCurrentConfiguration).toHaveBeenCalled();
            expect(result).toEqual({
                success: true,
                configuration: mockConfiguration,
                message: '配置重载成功',
                metadata: {
                    timestamp: expect.any(String),
                    version: '1.0.0',
                    source: 'reload'
                }
            });
        });
    });

    describe('getConfigurationHistory', () => {
        it('should return configuration history successfully', async () => {
            const result = await controller.getConfigurationHistory();

            expect(configurationManager.initialize).toHaveBeenCalled();
            expect(configurationManager.getConfigurationHistory).toHaveBeenCalled();
            expect(result).toEqual({
                history: [mockConfiguration],
                total: 1
            });
        });

        it('should return limited configuration history', async () => {
            const result = await controller.getConfigurationHistory('1');

            expect(result).toEqual({
                history: [mockConfiguration],
                total: 1
            });
        });
    });

    describe('rollbackConfiguration', () => {
        it('should rollback configuration successfully', async () => {
            const rollbackRequest = {
                version: '0.9.0',
                reason: 'Test rollback'
            };

            const mockResult: ValidationResult = {
                success: true,
                value: mockConfiguration,
                metadata: { rolledBackTo: '0.9.0' }
            };

            configurationManager.rollbackConfiguration.mockResolvedValue(mockResult);

            const result = await controller.rollbackConfiguration(rollbackRequest);

            expect(configurationManager.initialize).toHaveBeenCalled();
            expect(configurationManager.rollbackConfiguration).toHaveBeenCalledWith('0.9.0');
            expect(result).toEqual({
                success: true,
                configuration: mockConfiguration,
                message: '配置回滚成功',
                metadata: expect.objectContaining({
                    reason: 'Test rollback',
                    timestamp: expect.any(String)
                })
            });
        });

        it('should handle rollback failure', async () => {
            const rollbackRequest = { version: '0.9.0' };

            const mockResult: ValidationResult = {
                success: false,
                error: 'Version not found'
            };

            configurationManager.rollbackConfiguration.mockResolvedValue(mockResult);

            await expect(controller.rollbackConfiguration(rollbackRequest)).rejects.toThrow(HttpException);
        });
    });

    describe('getConfigurationStats', () => {
        it('should return configuration stats successfully', async () => {
            const result = await controller.getConfigurationStats();

            expect(configurationManager.initialize).toHaveBeenCalled();
            expect(configurationManager.getConfigurationStats).toHaveBeenCalled();
            expect(result).toEqual({
                currentVersion: '1.0.0',
                historySize: 1,
                totalFields: 1,
                totalRules: 1,
                lastUpdated: expect.any(String),
                isInitialized: true
            });
        });
    });
});