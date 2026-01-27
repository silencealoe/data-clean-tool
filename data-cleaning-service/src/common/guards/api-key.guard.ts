import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
    Logger
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * API Key Authentication Guard
 * 
 * Validates API key from Authorization header or X-API-Key header
 * Implements requirement 8.5 for authentication and authorization
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
    private readonly logger = new Logger(ApiKeyGuard.name);
    private readonly validApiKeys: Set<string>;

    constructor(private readonly configService: ConfigService) {
        // Load API keys from environment variables
        const apiKeysString = this.configService.get<string>('API_KEYS', 'default-api-key-change-in-production');
        this.validApiKeys = new Set(apiKeysString.split(',').map(key => key.trim()));

        this.logger.log(`Initialized with ${this.validApiKeys.size} API key(s)`);
    }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();
        const apiKey = this.extractApiKey(request);

        if (!apiKey) {
            this.logger.warn('No API key provided in request');
            throw new UnauthorizedException('API key is required');
        }

        if (!this.validApiKeys.has(apiKey)) {
            this.logger.warn(`Invalid API key provided: ${apiKey.substring(0, 8)}...`);
            throw new UnauthorizedException('Invalid API key');
        }

        this.logger.debug('API key validation successful');
        return true;
    }

    private extractApiKey(request: Request): string | null {
        // Try Authorization header with Bearer token
        const authHeader = request.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }

        // Try X-API-Key header
        const apiKeyHeader = request.headers['x-api-key'];
        if (apiKeyHeader && typeof apiKeyHeader === 'string') {
            return apiKeyHeader;
        }

        return null;
    }
}