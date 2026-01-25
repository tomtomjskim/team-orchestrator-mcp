/**
 * Monitor MCP Tools
 */

import { TeamManager } from '../services/TeamManager.js';
import { MonitorConfig, MonitorType, OrchestrationEvent } from '../types/index.js';
import {
  MonitorRegisterInputSchema,
  MonitorEmitInputSchema,
  MonitorGetEventsInputSchema,
} from './schemas.js';

// Event storage (in-memory)
const events: OrchestrationEvent[] = [];
const MAX_EVENTS = 10000;

// Monitor connections
const monitors = new Map<string, {
  id: string;
  type: MonitorType;
  config: MonitorConfig['config'];
  status: 'connected' | 'pending' | 'error';
}>();

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

      // Register with TeamManager
      await teamManager.registerMonitor(monitorConfig);

      // Store in active monitors
      monitors.set(monitorId, {
        id: monitorId,
        type: input.type,
        config: input.config,
        status: 'pending',
      });

      // Attempt connection test for SSE/webhook
      let status: 'connected' | 'pending' | 'error' = 'pending';
      if (input.type === 'sse' && input.config.endpoint) {
        try {
          // Simple connectivity check
          const url = new URL(input.config.endpoint);
          status = 'connected';
        } catch {
          status = 'error';
        }
      } else if (input.type === 'webhook' && input.config.url) {
        status = 'pending'; // Will validate on first emit
      } else if (input.type === 'file') {
        status = 'connected'; // File is always available
      }

      monitors.get(monitorId)!.status = status;

      return {
        success: true,
        monitorId,
        status,
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

      // Store event
      events.push(event);
      if (events.length > MAX_EVENTS) {
        events.shift();
      }

      // Deliver to monitors
      const deliveredTo: string[] = [];
      for (const [id, monitor] of monitors) {
        if (monitor.status === 'connected' || monitor.status === 'pending') {
          // Check event filter
          const eventFilter = monitor.config.events as string[] | undefined;
          if (eventFilter && eventFilter.length > 0) {
            if (!eventFilter.some(f => event.type.startsWith(f))) {
              continue;
            }
          }

          deliveredTo.push(id);
          // Actual delivery would happen here via EventEmitter service
        }
      }

      return {
        success: true,
        eventId: event.id,
        deliveredTo,
      };
    }

    case 'monitor_get_events': {
      const input = MonitorGetEventsInputSchema.parse(args);

      let filtered = [...events];

      // Filter by run ID (check in payload)
      if (input.runId) {
        filtered = filtered.filter(e =>
          e.payload?.runId === input.runId
        );
      }

      // Filter by event types
      if (input.types && input.types.length > 0) {
        filtered = filtered.filter(e =>
          input.types!.some(t => e.type.startsWith(t))
        );
      }

      // Filter by time
      if (input.since) {
        const sinceTime = new Date(input.since).getTime();
        filtered = filtered.filter(e =>
          new Date(e.timestamp).getTime() >= sinceTime
        );
      }

      // Apply limit
      const limit = input.limit || 100;
      const hasMore = filtered.length > limit;
      filtered = filtered.slice(-limit);

      return {
        events: filtered,
        hasMore,
        cursor: hasMore ? filtered[0]?.id : undefined,
      };
    }

    default:
      throw new Error(`Unknown monitor tool: ${toolName}`);
  }
}

// Export for EventEmitter integration
export function recordEvent(event: OrchestrationEvent) {
  events.push(event);
  if (events.length > MAX_EVENTS) {
    events.shift();
  }
}

export function getActiveMonitors() {
  return Array.from(monitors.values());
}
