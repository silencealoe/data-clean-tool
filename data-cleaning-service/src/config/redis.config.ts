import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '5000', 10),
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '3000', 10),
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
}));