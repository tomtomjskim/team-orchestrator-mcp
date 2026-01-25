/**
 * Monitor MCP Tools
 */

import { TeamManager } from '../services/TeamManager.js';
import { getEventEmitter, EventEmitterService } from '../services/EventEmitter.js';
import { MonitorConfig, MonitorType, OrchestrationEvent } from '../types/index.js';
import {
  MonitorRegisterInputSchema,
  MonitorEmitInputSchema,
  MonitorGetEventsInputSchema,
} from './schemas.js';

// Get event emitter instance
let eventEmitter: EventEmitterService;

function initEventEmitter() {
  if (!eventEmitter) {
    eventEmitter = getEventEmitter();
  }
}

export const monitorToolDefinitions = [
  {
    name: 'monitor_register',
    description: 'Register a monitoring endpoint',
    inputSchema: {
      type: 'object',
      required: ['type', 'config'],
      properties: {
        type: {
          type: 'string',
          enum: ['sse', 'webhook', 'file', 'otlp', 'prometheus'],
          description: 'Monitor type',
        },
        config: {
          type: 'object',
          properties: {
            endpoint: {
              type: 'string',
              description: 'SSE/OTLP endpoint URL',
            },
            url: {
              type: 'string',
              description: 'Webhook URL',
            },
            secret: {
              type: 'string',
              description: 'Webhook secret',
            },
            events: {
              type: 'array',
              items: { type: 'string' },
              description: 'Event type filter',
            },
            path: {
              type: 'string',
              description: 'File path or Prometheus path',
            },
            format: {
              type: 'string',
              enum: ['json', 'jsonl'],
              description: 'File format',
            },
            port: {
              type: 'number',
              description: 'Prometheus port',
            },
            headers: {
              type: 'object',
              description: 'OTLP headers',
            },
          },
        },
      },
    },
  },
  {
    name: 'monitor_emit',
    description: 'Emit a custom event to registered monitors',
    inputSchema: {
      type: 'object',
      required: ['type', 'payload'],
      properties: {
        type: {
          type: 'string',
          description: 'Custom event type (will be prefixed with "custom.")',
        },
        payload: {
          description: 'Event payload',
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata',
        },
      },
    },
  },
  {
    name: 'monitor_get_events',
    description: 'Retrieve recorded events',
    inputSchema: {
      type: 'object',
      properties: {
        runId: {
          type: 'string',
          description: 'Filter by workflow run ID',
        },
        types: {
          type: 'array',
          items: { type: 'string' },
          description: 'Event type filter',
        },
        since: {
          type: 'string',
          description: 'Start time (ISO 8601)',
        },
        limit: {
          type: 'number',
          description: 'Maximum events to return (default: 100)',
        },
      },
    },
  },
  {
    name: 'monitor_list_channels',
    description: 'List all registered monitoring channels',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'monitor_unregister',
    description: 'Unregister a monitoring channel',
    inputSchema: {
      type: 'object',
      required: ['channelId'],
      properties: {
        channelId: {
          type: 'string',
          description: 'Channel ID to unregister',
        },
      },
    },
  },
];

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
}

function generateSpanId(): string {
  return Math.random().toString(16).substring(2, 18).padStart(16, '0');
}

function generateTraceId(): string {
  return (Math.random().toString(16).substring(2) + Math.random().toString(16).substring(2)).substring(0, 32);
}

export async function handleMonitorTool(
  toolName: string,
  args: Record<string, unknown>,
  teamManager: TeamManager
): Promise<any> {
  // Initialize event emitter on first call
  initEventEmitter();

  switch (toolName) {
    case 'monitor_register': {
      const input = MonitorRegisterInputSchema.parse(args);
      const monitorId = `mon-${generateId()}`;

      // Create monitor config
      const monitorConfig: MonitorConfig = {
        id: monitorId,
        type: input.type,
        enabled: true,
        endpoint: input.config.endpoint || input.config.url,
        config: input.config,
      };

      // Register with TeamManager for persistence
      await teamManager.registerMonitor(monitorConfig);

      // Register with EventEmitter for actual delivery
      const channel = await eventEmitter.registerChannel(monitorConfig);

      return {
        success: true,
        monitorId,
        status: channel.status,
        message: channel.status === 'connected'
          ? 'Monitor registered and connected successfully'
          : channel.status === 'error'
            ? `Monitor registered but connection failed: ${channel.lastError}`
            : 'Monitor registered, connection pending',
      };
    }

    case 'monitor_emit': {
      const input = MonitorEmitInputSchema.parse(args);

      // Create event
      const event: OrchestrationEvent = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        type: input.type.startsWith('custom.') ? input.type as any : `custom.${input.type}` as any,
        traceId: generateTraceId(),
        spanId: generateSpanId(),
        source: {
          service: 'team-orchestrator',
          version: '0.1.0',
        },
        project: {
          id: 'default',
        },
        session: {
          id: 'current',
          startTime: new Date().toISOString(),
        },
        team: {
          id: 'default',
          name: 'Team',
        },
        payload: input.payload,
        metadata: input.metadata,
      };

      // Emit to all channels
      const result = await eventEmitter.emitEvent(event);

      return {
        success: true,
        eventId: event.id,
        deliveredTo: result.delivered,
        failed: result.failed,
        message: result.failed.length === 0
          ? `Event delivered to ${result.delivered.length} channel(s)`
          : `Event delivered to ${result.delivered.length} channel(s), failed on ${result.failed.length}`,
      };
    }

    case 'monitor_get_events': {
      const input = MonitorGetEventsInputSchema.parse(args);

      // Get events from buffer
      let events = eventEmitter.getBufferedEvents({
        since: input.since,
        types: input.types,
        limit: input.limit || 100,
      });

      // Filter by runId if specified
      if (input.runId) {
        events = events.filter(e =>
          e.payload?.runId === input.runId
        );
      }

      return {
        events,
        count: events.length,
        hasMore: events.length >= (input.limit || 100),
      };
    }

    case 'monitor_list_channels': {
      const channels = eventEmitter.getAllChannels();

      return {
        channels: channels.map(ch => ({
          id: ch.id,
          type: ch.type,
          enabled: ch.enabled,
          status: ch.status,
          eventCount: ch.eventCount,
          lastError: ch.lastError,
        })),
        total: channels.length,
        connected: channels.filter(ch => ch.status === 'connected').length,
      };
    }

    case 'monitor_unregister': {
      const { channelId } = args as { channelId: string };

      await eventEmitter.unregisterChannel(channelId);

      return {
        success: true,
        channelId,
        message: 'Monitor channel unregistered',
      };
    }

    default:
      throw new Error(`Unknown monitor tool: ${toolName}`);
  }
}

// Export event emitter for external use
export { getEventEmitter };
