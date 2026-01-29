import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis 服务
 * 提供 Redis 连接管理和基本操作功能
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redisClient: Redis;
  private pubClient: Redis;
  private subClient: Redis;

  constructor(private readonly configService: ConfigService) {}

  /**
   * 模块初始化时建立 Redis 连接
   */
  async onModuleInit() {
    await this.connect();
  }

  /**
   * 模块销毁时关闭 Redis 连接
   */
  async onModuleDestroy() {
    await this.disconnect();
  }

  /**
   * 建立 Redis 连接
   * @param retryCount 重试次数
   */
  private async connect(retryCount = 0): Promise<void> {
    try {
      const host = this.configService.get<string>('REDIS_HOST', 'localhost');
      const port = this.configService.get<number>('REDIS_PORT', 6379);
      const password = this.configService.get<string>('REDIS_PASSWORD');
      const db = this.configService.get<number>('REDIS_DB', 0);

      // 创建主 Redis 客户端
      this.redisClient = new Redis({
        host,
        port,
        password,
        db,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        enableOfflineQueue: true,
      });

      // 创建发布客户端
      this.pubClient = new Redis({
        host,
        port,
        password,
        db,
      });

      // 创建订阅客户端
      this.subClient = new Redis({
        host,
        port,
        password,
        db,
      });

      // 监听连接事件
      this.redisClient.on('connect', () => {
        this.logger.log('Redis 主客户端已连接');
      });

      this.redisClient.on('ready', () => {
        this.logger.log('Redis 主客户端就绪');
      });

      this.redisClient.on('error', (err) => {
        this.logger.error('Redis 主客户端错误:', err);
      });

      this.redisClient.on('close', () => {
        this.logger.warn('Redis 主客户端连接关闭');
      });

      this.redisClient.on('reconnecting', () => {
        this.logger.log('Redis 主客户端正在重连...');
      });

      // 测试连接
      await this.redisClient.ping();
      this.logger.log(`Redis 连接成功: ${host}:${port}/${db}`);
    } catch (error) {
      this.logger.error(`Redis 连接失败 (尝试 ${retryCount + 1}):`, error);
      
      if (retryCount < 5) {
        this.logger.log(`5秒后重试连接 Redis...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        await this.connect(retryCount + 1);
      } else {
        this.logger.error('Redis 连接重试次数已达上限，请检查 Redis 服务是否启动');
        throw error;
      }
    }
  }

  /**
   * 关闭 Redis 连接
   */
  private async disconnect(): Promise<void> {
    try {
      if (this.redisClient) {
        await this.redisClient.quit();
        this.logger.log('Redis 主客户端已断开连接');
      }
      if (this.pubClient) {
        await this.pubClient.quit();
      }
      if (this.subClient) {
        await this.subClient.quit();
      }
    } catch (error) {
      this.logger.error('Redis 断开连接时出错:', error);
    }
  }

  /**
   * 获取 Redis 客户端实例
   * @returns Redis 客户端实例
   */
  getClient(): Redis {
    if (!this.redisClient) {
      throw new Error('Redis 客户端未初始化');
    }
    return this.redisClient;
  }

  /**
   * 获取发布客户端实例
   * @returns 发布客户端实例
   */
  getPubClient(): Redis {
    if (!this.pubClient) {
      throw new Error('Redis 发布客户端未初始化');
    }
    return this.pubClient;
  }

  /**
   * 获取订阅客户端实例
   * @returns 订阅客户端实例
   */
  getSubClient(): Redis {
    if (!this.subClient) {
      throw new Error('Redis 订阅客户端未初始化');
    }
    return this.subClient;
  }

  /**
   * 检查 Redis 连接状态
   * @returns 连接状态
   */
  async isConnected(): Promise<boolean> {
    try {
      const result = await this.redisClient.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  /**
   * 设置键值对
   * @param key 键名
   * @param value 键值
   * @param ttl 过期时间（秒），可选
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.redisClient.set(key, value, 'EX', ttl);
    } else {
      await this.redisClient.set(key, value);
    }
  }

  /**
   * 获取键值
   * @param key 键名
   * @returns 键值
   */
  async get(key: string): Promise<string | null> {
    return await this.redisClient.get(key);
  }

  /**
   * 删除键
   * @param key 键名
   * @returns 删除的键数量
   */
  async del(key: string): Promise<number> {
    return await this.redisClient.del(key);
  }

  /**
   * 检查键是否存在
   * @param key 键名
   * @returns 是否存在
   */
  async exists(key: string): Promise<number> {
    return await this.redisClient.exists(key);
  }

  /**
   * 设置键的过期时间
   * @param key 键名
   * @param ttl 过期时间（秒）
   * @returns 是否设置成功
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    const result = await this.redisClient.expire(key, ttl);
    return result === 1;
  }

  /**
   * 获取键的剩余过期时间
   * @param key 键名
   * @returns 剩余时间（秒），-1表示永不过期，-2表示键不存在
   */
  async ttl(key: string): Promise<number> {
    return await this.redisClient.ttl(key);
  }

  /**
   * 将值推入列表左侧
   * @param key 列表键名
   * @param values 要推入的值
   * @returns 列表长度
   */
  async lpush(key: string, ...values: string[]): Promise<number> {
    return await this.redisClient.lpush(key, ...values);
  }

  /**
   * 从列表右侧弹出值
   * @param key 列表键名
   * @returns 弹出的值
   */
  async rpop(key: string): Promise<string | null> {
    return await this.redisClient.rpop(key);
  }

  /**
   * 获取列表长度
   * @param key 列表键名
   * @returns 列表长度
   */
  async llen(key: string): Promise<number> {
    return await this.redisClient.llen(key);
  }

  /**
   * 获取列表范围内的元素
   * @param key 列表键名
   * @param start 起始索引
   * @param stop 结束索引
   * @returns 元素数组
   */
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return await this.redisClient.lrange(key, start, stop);
  }

  /**
   * 将成员添加到有序集合
   * @param key 有序集合键名
   * @param score 分数
   * @param member 成员
   * @returns 添加的成员数量
   */
  async zadd(key: string, score: number, member: string): Promise<number> {
    return await this.redisClient.zadd(key, score, member);
  }

  /**
   * 从有序集合中移除成员
   * @param key 有序集合键名
   * @param members 要移除的成员
   * @returns 移除的成员数量
   */
  async zrem(key: string, ...members: string[]): Promise<number> {
    return await this.redisClient.zrem(key, ...members);
  }

  /**
   * 获取有序集合中指定范围的成员（按分数从低到高）
   * @param key 有序集合键名
   * @param start 起始索引
   * @param stop 结束索引
   * @returns 成员数组
   */
  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return await this.redisClient.zrange(key, start, stop);
  }

  /**
   * 获取有序集合中指定范围的成员（按分数从高到低）
   * @param key 有序集合键名
   * @param start 起始索引
   * @param stop 结束索引
   * @returns 成员数组
   */
  async zrevrange(key: string, start: number, stop: number): Promise<string[]> {
    return await this.redisClient.zrevrange(key, start, stop);
  }

  /**
   * 获取有序集合的成员数量
   * @param key 有序集合键名
   * @returns 成员数量
   */
  async zcard(key: string): Promise<number> {
    return await this.redisClient.zcard(key);
  }

  /**
   * 获取成员在有序集合中的分数
   * @param key 有序集合键名
   * @param member 成员
   * @returns 分数
   */
  async zscore(key: string, member: string): Promise<number | null> {
    const score = await this.redisClient.zscore(key, member);
    return score ? parseFloat(score) : null;
  }

  /**
   * 发布消息到频道
   * @param channel 频道名
   * @param message 消息内容
   * @returns 接收消息的客户端数量
   */
  async publish(channel: string, message: string): Promise<number> {
    return await this.pubClient.publish(channel, message);
  }

  /**
   * 订阅频道
   * @param channel 频道名
   * @param callback 消息回调函数
   */
  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    await this.subClient.subscribe(channel);
    this.subClient.on('message', (receivedChannel, message) => {
      if (receivedChannel === channel) {
        callback(message);
      }
    });
  }

  /**
   * 取消订阅频道
   * @param channel 频道名
   */
  async unsubscribe(channel: string): Promise<void> {
    await this.subClient.unsubscribe(channel);
  }

  /**
   * 执行 Redis 命令
   * @param command 命令名称
   * @param args 命令参数
   * @returns 命令执行结果
   */
  async executeCommand(command: string, ...args: any[]): Promise<any> {
    return await this.redisClient.call(command, ...args);
  }

  /**
   * 清空当前数据库
   * @returns 是否成功
   */
  async flushDb(): Promise<string> {
    return await this.redisClient.flushdb();
  }

  /**
   * 获取数据库信息
   * @param section 信息部分（可选）
   * @returns 数据库信息
   */
  async getInfo(section?: string): Promise<string> {
    if (section) {
      return await this.redisClient.info(section);
    }
    return await this.redisClient.info();
  }

  /**
   * 获取数据库键的数量
   * @returns 键的数量
   */
  async dbSize(): Promise<number> {
    return await this.redisClient.dbsize();
  }
}
