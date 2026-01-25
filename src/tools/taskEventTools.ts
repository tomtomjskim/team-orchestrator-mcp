/**
 * Task Event MCP Tools
 * 
 * Tools for managing task lifecycle events that integrate with Agent Monitor
 */

import { getTaskEventService, TaskEventService } from '../services/TaskEventService.js';
import {
  TaskStartPayload,
  TaskProgressPayload,
  TaskCompletePayload,
  TaskFailPayload,
  TaskEventStatus,
} from '../types/index.js';

// Get task event service instance
let taskEventService: TaskEventService;

function initTaskEventService() {
  if (!taskEventService) {
    taskEventService = getTaskEventService();
  }
}

export const taskEventToolDefinitions = [
  {
    name: 'task_start',
    description: 'Start a new task and emit task.started event to registered monitors',
    inputSchema: {
      type: 'object',
      required: ['agentId', 'agentType', 'description'],
      properties: {
        taskId: {
          type: 'string',
          description: 'Optional custom task ID. If not provided, one will be generated.',
        },
        agentId: {
          type: 'string',
          description: 'Unique identifier of the agent executing this task',
        },
        agentType: {
          type: 'string',
          enum: ['PM', 'Architect', 'Developer', 'QA', 'DBA', 'Designer', 'Publisher', 'Documenter', 'Explorer', 'Agent'],
          description: 'Type of agent',
        },
        description: {
          type: 'string',
          description: 'Brief description of what the task will do',
        },
        parentTaskId: {
          type: 'string',
          description: 'ID of parent task if this is a subtask',
        },
        sessionId: {
          type: 'string',
          description: 'Session ID to group related tasks',
        },
        cwd: {
          type: 'string',
          description: 'Working directory for the task',
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata for the task',
        },
      },
    },
  },
  {
    name: 'task_progress',
    description: 'Update progress of an active task and emit task.progress event',
    inputSchema: {
      type: 'object',
      required: ['taskId'],
      properties: {
        taskId: {
          type: 'string',
          description: 'ID of the task to update',
        },
        progress: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          description: 'Progress percentage (0-100)',
        },
        message: {
          type: 'string',
          description: 'Status message describing current activity',
        },
        phase: {
          type: 'string',
          description: 'Current phase of the task (e.g., "analyzing", "implementing", "testing")',
        },
        details: {
          type: 'object',
          description: 'Additional progress details',
        },
      },
    },
  },
  {
    name: 'task_complete',
    description: 'Mark a task as completed and emit task.completed event',
    inputSchema: {
      type: 'object',
      required: ['taskId'],
      properties: {
        taskId: {
          type: 'string',
          description: 'ID of the task to complete',
        },
        result: {
          type: 'string',
          description: 'Result or output of the task',
        },
        summary: {
          type: 'string',
          description: 'Brief summary of what was accomplished',
        },
        filesModified: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of files that were modified',
        },
        tokensUsed: {
          type: 'number',
          description: 'Number of tokens used for this task',
        },
      },
    },
  },
  {
    name: 'task_fail',
    description: 'Mark a task as failed and emit task.failed event',
    inputSchema: {
      type: 'object',
      required: ['taskId', 'error'],
      properties: {
        taskId: {
          type: 'string',
          description: 'ID of the task that failed',
        },
        error: {
          type: 'string',
          description: 'Error message describing the failure',
        },
        errorCode: {
          type: 'string',
          description: 'Error code for categorization',
        },
        recoverable: {
          type: 'boolean',
          description: 'Whether the error is recoverable',
        },
      },
    },
  },
  {
    name: 'task_list_active',
    description: 'List all active tasks with optional filtering',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
          description: 'Filter by task status',
        },
        agentType: {
          type: 'string',
          description: 'Filter by agent type',
        },
        parentTaskId: {
          type: 'string',
          description: 'Filter by parent task ID to get subtasks',
        },
      },
    },
  },
  {
    name: 'task_get',
    description: 'Get details of a specific task',
    inputSchema: {
      type: 'object',
      required: ['taskId'],
      properties: {
        taskId: {
          type: 'string',
          description: 'ID of the task to retrieve',
        },
      },
    },
  },
];

export async function handleTaskEventTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<any> {
  // Initialize service on first call
  initTaskEventService();

  switch (toolName) {
    case 'task_start': {
      const payload: TaskStartPayload = {
        taskId: args.taskId as string | undefined,
        agentId: args.agentId as string,
        agentType: args.agentType as string,
        description: args.description as string,
        parentTaskId: args.parentTaskId as string | undefined,
        sessionId: args.sessionId as string | undefined,
        cwd: args.cwd as string | undefined,
        metadata: args.metadata as Record<string, any> | undefined,
      };

      const result = await taskEventService.startTask(payload);

      return {
        success: true,
        taskId: result.taskId,
        eventId: result.event.id,
        sessionId: taskEventService.getSessionId(),
        message: `Task '${payload.description}' started with ID ${result.taskId}`,
      };
    }

    case 'task_progress': {
      const payload: TaskProgressPayload = {
        taskId: args.taskId as string,
        progress: args.progress as number | undefined,
        message: args.message as string | undefined,
        phase: args.phase as string | undefined,
        details: args.details as Record<string, any> | undefined,
      };

      const event = await taskEventService.updateProgress(payload);

      if (!event) {
        return {
          success: false,
          error: `Task not found: ${payload.taskId}`,
        };
      }

      return {
        success: true,
        taskId: payload.taskId,
        eventId: event.id,
        progress: payload.progress,
        message: payload.message || `Task progress updated`,
      };
    }

    case 'task_complete': {
      const payload: TaskCompletePayload = {
        taskId: args.taskId as string,
        result: args.result as string | undefined,
        summary: args.summary as string | undefined,
        filesModified: args.filesModified as string[] | undefined,
        tokensUsed: args.tokensUsed as number | undefined,
      };

      const event = await taskEventService.completeTask(payload);

      if (!event) {
        return {
          success: false,
          error: `Task not found: ${payload.taskId}`,
        };
      }

      return {
        success: true,
        taskId: payload.taskId,
        eventId: event.id,
        summary: payload.summary,
        message: `Task ${payload.taskId} completed successfully`,
      };
    }

    case 'task_fail': {
      const payload: TaskFailPayload = {
        taskId: args.taskId as string,
        error: args.error as string,
        errorCode: args.errorCode as string | undefined,
        recoverable: args.recoverable as boolean | undefined,
      };

      const event = await taskEventService.failTask(payload);

      if (!event) {
        return {
          success: false,
          error: `Task not found: ${payload.taskId}`,
        };
      }

      return {
        success: true,
        taskId: payload.taskId,
        eventId: event.id,
        error: payload.error,
        recoverable: payload.recoverable ?? false,
        message: `Task ${payload.taskId} marked as failed`,
      };
    }

    case 'task_list_active': {
      const options = {
        status: args.status as TaskEventStatus | undefined,
        agentType: args.agentType as string | undefined,
        parentTaskId: args.parentTaskId as string | undefined,
      };

      const result = taskEventService.listActiveTasks(options);

      return {
        success: true,
        ...result,
      };
    }

    case 'task_get': {
      const taskId = args.taskId as string;
      const task = taskEventService.getTask(taskId);

      if (!task) {
        return {
          success: false,
          error: `Task not found: ${taskId}`,
        };
      }

      return {
        success: true,
        task,
      };
    }

    default:
      throw new Error(`Unknown task event tool: ${toolName}`);
  }
}
