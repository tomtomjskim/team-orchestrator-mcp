/**
 * EventEmitter - Multi-channel event emission service
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter as NodeEventEmitter } from 'events';
import { OrchestrationEvent, MonitorConfig, MonitorType } from '../types/index.js';

export interface EventChannel {
  id: string;
  type: MonitorType;
  config: MonitorConfig['config'];
  enabled: boolean;
  status: 'connected' | 'pending' | 'error' | 'disconnected';
  lastError?: string;
  eventCount: number;
}

export interface SSEConnection {
  endpoint: string;
  connected: boolean;
  retryCount: number;
  lastEventTime?: string;
}

export interface WebhookConfig {
  url: string;
  secret?: string;
  events?: string[];
  headers?: Record<string, string>;
}

export interface FileLogConfig {
  path: string;
  format: 'json' | 'jsonl';
  maxSize?: number;
  rotate?: boolean;
}

const MAX_RETRY_COUNT = 3;
const RETRY_DELAY_MS = 1000;
const MAX_BUFFER_SIZE = 1000;

export class EventEmitterService extends NodeEventEmitter {
  private channels: Map<string, EventChannel> = new Map();
  private eventBuffer: OrchestrationEvent[] = [];
  private sseConnections: Map<string, SSEConnection> = new Map();
  private fileHandles: Map<string, fs.FileHandle> = new Map();

  constructor() {
    super();
  }

  /**
   * Register a new event channel
   */
  async registerChannel(config: MonitorConfig): Promise<EventChannel> {
    const channel: EventChannel = {
      id: config.id,
      type: config.type,
      config: config.config,
      enabled: config.enabled,
      status: 'pending',
      eventCount: 0,
    };

    // Initialize channel based on type
    try {
      switch (config.type) {
        case 'sse':
          await this.initSSEChannel(channel);
          break;
        case 'webhook':
          await this.initWebhookChannel(channel);
          break;
        case 'file':
          await this.initFileChannel(channel);
          break;
        case 'otlp':
          await this.initOTLPChannel(channel);
          break;
        case 'prometheus':
          await this.initPrometheusChannel(channel);
          break;
      }
      channel.status = 'connected';
    } catch (error) {
      channel.status = 'error';
      channel.lastError = error instanceof Error ? error.message : String(error);
    }

    this.channels.set(config.id, channel);
    return channel;
  }

  /**
   * Unregister a channel
   */
  async unregisterChannel(channelId: string): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) return;

    // Cleanup based on type
    if (channel.type === 'file') {
      const handle = this.fileHandles.get(channelId);
      if (handle) {
        await handle.close();
        this.fileHandles.delete(channelId);
      }
    }

    this.channels.delete(channelId);
  }

  /**
   * Emit an event to all registered channels
   */
  async emitEvent(event: OrchestrationEvent): Promise<{ delivered: string[]; failed: string[] }> {
    const delivered: string[] = [];
    const failed: string[] = [];

    // Add to buffer
    this.eventBuffer.push(event);
    if (this.eventBuffer.length > MAX_BUFFER_SIZE) {
      this.eventBuffer.shift();
    }

    // Emit to local listeners
    this.emit('event', event);

    // Send to all channels
    const promises = Array.from(this.channels.values())
      .filter(ch => ch.enabled && ch.status !== 'disconnected')
      .map(async (channel) => {
        // Check event filter
        const eventFilter = channel.config.events as string[] | undefined;
        if (eventFilter && eventFilter.length > 0) {
          const eventType = event.type;
          if (!eventFilter.some((f: string) => eventType.startsWith(f))) {
            return; // Skip this channel
          }
        }

        try {
          await this.sendToChannel(channel, event);
          channel.eventCount++;
          delivered.push(channel.id);
        } catch (error) {
          channel.lastError = error instanceof Error ? error.message : String(error);
          failed.push(channel.id);
        }
      });

    await Promise.allSettled(promises);

    return { delivered, failed };
  }

  /**
   * Get channel status
   */
  getChannelStatus(channelId: string): EventChannel | null {
    return this.channels.get(channelId) || null;
  }

  /**
   * Get all channels
   */
  getAllChannels(): EventChannel[] {
    return Array.from(this.channels.values());
  }

  /**
   * Get buffered events
   */
  getBufferedEvents(options?: {
    since?: string;
    types?: string[];
    limit?: number;
  }): OrchestrationEvent[] {
    let events = [...this.eventBuffer];

    if (options?.since) {
      const sinceTime = new Date(options.since).getTime();
      events = events.filter(e => new Date(e.timestamp).getTime() >= sinceTime);
    }

    if (options?.types && options.types.length > 0) {
      events = events.filter(e =>
        options.types!.some(t => e.type.startsWith(t))
      );
    }

    if (options?.limit) {
      events = events.slice(-options.limit);
    }

    return events;
  }

  // ============================================
  // Channel-specific implementations
  // ============================================

  /**
   * Initialize SSE channel
   */
  private async initSSEChannel(channel: EventChannel): Promise<void> {
    const endpoint = channel.config.endpoint as string;
    if (!endpoint) {
      throw new Error('SSE endpoint is required');
    }

    // Validate URL
    new URL(endpoint);

    this.sseConnections.set(channel.id, {
      endpoint,
      connected: true,
      retryCount: 0,
    });
  }

  /**
   * Initialize Webhook channel
   */
  private async initWebhookChannel(channel: EventChannel): Promise<void> {
    const url = channel.config.url as string;
    if (!url) {
      throw new Error('Webhook URL is required');
    }

    // Validate URL
    new URL(url);
  }

  /**
   * Initialize File channel
   */
  private async initFileChannel(channel: EventChannel): Promise<void> {
    const filePath = channel.config.path as string;
    if (!filePath) {
      throw new Error('File path is required');
    }

    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Open file for append
    const handle = await fs.open(filePath, 'a');
    this.fileHandles.set(channel.id, handle);
  }

  /**
   * Initialize OTLP channel
   */
  private async initOTLPChannel(channel: EventChannel): Promise<void> {
    const endpoint = channel.config.otlpEndpoint as string;
    if (!endpoint) {
      throw new Error('OTLP endpoint is required');
    }

    // Validate URL
    new URL(endpoint);
  }

  /**
   * Initialize Prometheus channel
   */
  private async initPrometheusChannel(channel: EventChannel): Promise<void> {
    // Prometheus channel is passive - metrics are exposed via HTTP endpoint
    // Just validate config
    const port = channel.config.port as number;
    if (!port) {
      throw new Error('Prometheus port is required');
    }
  }

  /**
   * Send event to a specific channel
   */
  private async sendToChannel(channel: EventChannel, event: OrchestrationEvent): Promise<void> {
    switch (channel.type) {
      case 'sse':
        await this.sendSSE(channel, event);
        break;
      case 'webhook':
        await this.sendWebhook(channel, event);
        break;
      case 'file':
        await this.sendFile(channel, event);
        break;
      case 'otlp':
        await this.sendOTLP(channel, event);
        break;
      case 'prometheus':
        // Prometheus is pull-based, no push needed
        break;
    }
  }

  /**
   * Send event via SSE
   */
  private async sendSSE(channel: EventChannel, event: OrchestrationEvent): Promise<void> {
    const connection = this.sseConnections.get(channel.id);
    if (!connection) {
      throw new Error('SSE connection not found');
    }

    const endpoint = connection.endpoint;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        throw new Error(`SSE endpoint returned ${response.status}`);
      }

      connection.lastEventTime = event.timestamp;
      connection.retryCount = 0;
    } catch (error) {
      connection.retryCount++;
      if (connection.retryCount >= MAX_RETRY_COUNT) {
        channel.status = 'error';
      }
      throw error;
    }
  }

  /**
   * Send event via Webhook
   */
  private async sendWebhook(channel: EventChannel, event: OrchestrationEvent): Promise<void> {
    const url = channel.config.url as string;
    const secret = channel.config.secret as string | undefined;
    const customHeaders = channel.config.headers as Record<string, string> | undefined;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };

    // Add signature if secret is provided
    if (secret) {
      const payload = JSON.stringify(event);
      // In production, use crypto.createHmac for proper HMAC signature
      const signature = `sha256=${Buffer.from(payload + secret).toString('base64')}`;
      headers['X-Signature'] = signature;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}: ${await response.text()}`);
    }
  }

  /**
   * Send event to file
   */
  private async sendFile(channel: EventChannel, event: OrchestrationEvent): Promise<void> {
    const handle = this.fileHandles.get(channel.id);
    if (!handle) {
      throw new Error('File handle not found');
    }

    const format = (channel.config.format as string) || 'jsonl';

    let content: string;
    if (format === 'jsonl') {
      content = JSON.stringify(event) + '\n';
    } else {
      content = JSON.stringify(event, null, 2) + '\n';
    }

    await handle.write(content);
  }

  /**
   * Send event via OTLP
   */
  private async sendOTLP(channel: EventChannel, event: OrchestrationEvent): Promise<void> {
    const endpoint = channel.config.otlpEndpoint as string;
    const headers = channel.config.headers as Record<string, string> | undefined;

    // Convert to OTLP log format
    const otlpPayload = {
      resourceLogs: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: event.source.service } },
              { key: 'service.version', value: { stringValue: event.source.version } },
            ],
          },
          scopeLogs: [
            {
              scope: { name: 'team-orchestrator' },
              logRecords: [
                {
                  timeUnixNano: new Date(event.timestamp).getTime() * 1000000,
                  severityNumber: this.getSeverityNumber(event.severity),
                  severityText: event.severity || 'INFO',
                  body: { stringValue: JSON.stringify(event.payload) },
                  attributes: [
                    { key: 'event.type', value: { stringValue: event.type } },
                    { key: 'trace.id', value: { stringValue: event.traceId } },
                    { key: 'span.id', value: { stringValue: event.spanId } },
                  ],
                  traceId: this.hexToBytes(event.traceId),
                  spanId: this.hexToBytes(event.spanId),
                },
              ],
            },
          ],
        },
      ],
    };

    const response = await fetch(`${endpoint}/v1/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(otlpPayload),
    });

    if (!response.ok) {
      throw new Error(`OTLP endpoint returned ${response.status}`);
    }
  }

  /**
   * Get OTLP severity number
   */
  private getSeverityNumber(severity?: string): number {
    switch (severity) {
      case 'debug': return 5;
      case 'info': return 9;
      case 'warn': return 13;
      case 'error': return 17;
      default: return 9;
    }
  }

  /**
   * Convert hex string to base64 bytes (for OTLP)
   */
  private hexToBytes(hex: string): string {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substring(i, i + 2), 16));
    }
    return Buffer.from(bytes).toString('base64');
  }

  /**
   * Retry failed event
   */
  async retryEvent(event: OrchestrationEvent, channelId?: string): Promise<void> {
    if (channelId) {
      const channel = this.channels.get(channelId);
      if (channel) {
        await this.sendToChannel(channel, event);
      }
    } else {
      await this.emitEvent(event);
    }
  }

  /**
   * Flush all pending events
   */
  async flush(): Promise<void> {
    // Flush file handles
    for (const handle of this.fileHandles.values()) {
      await handle.sync();
    }
  }

  /**
   * Close all channels
   */
  async close(): Promise<void> {
    for (const [id] of this.channels) {
      await this.unregisterChannel(id);
    }
  }
}

// Singleton instance
let emitterInstance: EventEmitterService | null = null;

export function getEventEmitter(): EventEmitterService {
  if (!emitterInstance) {
    emitterInstance = new EventEmitterService();
  }
  return emitterInstance;
}
