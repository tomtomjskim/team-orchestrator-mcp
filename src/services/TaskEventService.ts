/**
 * TaskEventService - Manages active tasks and emits events
 */

import { getEventEmitter, EventEmitterService } from './EventEmitter.js';
import {
  OrchestrationEvent,
  TaskEventStatus,
  TaskStartPayload,
  TaskProgressPayload,
  TaskCompletePayload,
  TaskFailPayload,
  ActiveTask,
  TaskListActiveOutput,
} from '../types/index.js';

// Helper functions for ID generation
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
}

function generateSpanId(): string {
  return Math.random().toString(16).substring(2, 18).padStart(16, '0');
}

function generateTraceId(): string {
  return (Math.random().toString(16).substring(2) + Math.random().toString(16).substring(2)).substring(0, 32);
}

export class TaskEventService {
  private activeTasks: Map<string, ActiveTask> = new Map();
  private eventEmitter: EventEmitterService;
  private sessionId: string;
  private traceId: string;

  constructor() {
    this.eventEmitter = getEventEmitter();
    this.sessionId = generateId();
    this.traceId = generateTraceId();
  }

  /**
   * Start a new task
   */
  async startTask(payload: TaskStartPayload): Promise<{ taskId: string; event: OrchestrationEvent }> {
    const taskId = payload.taskId || `task-${generateId()}`;
    const now = new Date().toISOString();

    const task: ActiveTask = {
      taskId,
      agentId: payload.agentId,
      agentType: payload.agentType,
      description: payload.description,
      status: 'running',
      parentTaskId: payload.parentTaskId,
      sessionId: payload.sessionId || this.sessionId,
      cwd: payload.cwd,
      startTime: now,
      lastActivity: now,
      metadata: payload.metadata,
    };

    this.activeTasks.set(taskId, task);

    const event = this.createEvent('task.started', {
      taskId,
      agentId: payload.agentId,
      agentType: payload.agentType,
      description: payload.description,
      parentTaskId: payload.parentTaskId,
      sessionId: task.sessionId,
      cwd: payload.cwd,
      status: 'running',
      startTime: now,
    }, payload.parentTaskId ? this.getParentSpanId(payload.parentTaskId) : undefined);

    await this.eventEmitter.emitEvent(event);

    return { taskId, event };
  }

  /**
   * Update task progress
   */
  async updateProgress(payload: TaskProgressPayload): Promise<OrchestrationEvent | null> {
    const task = this.activeTasks.get(payload.taskId);
    if (!task) {
      console.error(`[TaskEventService] Task not found: ${payload.taskId}`);
      return null;
    }

    // Update task state
    task.lastActivity = new Date().toISOString();
    if (payload.progress !== undefined) {
      task.progress = payload.progress;
    }
    if (payload.phase) {
      task.phase = payload.phase;
    }

    const event = this.createEvent('task.progress', {
      taskId: payload.taskId,
      agentId: task.agentId,
      agentType: task.agentType,
      progress: payload.progress,
      message: payload.message,
      phase: payload.phase,
      details: payload.details,
      status: task.status,
    }, this.getParentSpanId(task.parentTaskId));

    await this.eventEmitter.emitEvent(event);

    return event;
  }

  /**
   * Complete a task
   */
  async completeTask(payload: TaskCompletePayload): Promise<OrchestrationEvent | null> {
    const task = this.activeTasks.get(payload.taskId);
    if (!task) {
      console.error(`[TaskEventService] Task not found: ${payload.taskId}`);
      return null;
    }

    const now = new Date().toISOString();
    task.status = 'completed';
    task.lastActivity = now;

    const event = this.createEvent('task.completed', {
      taskId: payload.taskId,
      agentId: task.agentId,
      agentType: task.agentType,
      description: task.description,
      status: 'completed',
      startTime: task.startTime,
      endTime: now,
      result: payload.result,
      summary: payload.summary,
      filesModified: payload.filesModified,
      tokensUsed: payload.tokensUsed,
    }, this.getParentSpanId(task.parentTaskId));

    await this.eventEmitter.emitEvent(event);

    // Move to history (keep for a while for queries)
    setTimeout(() => {
      this.activeTasks.delete(payload.taskId);
    }, 60000); // Keep for 1 minute after completion

    return event;
  }

  /**
   * Fail a task
   */
  async failTask(payload: TaskFailPayload): Promise<OrchestrationEvent | null> {
    const task = this.activeTasks.get(payload.taskId);
    if (!task) {
      console.error(`[TaskEventService] Task not found: ${payload.taskId}`);
      return null;
    }

    const now = new Date().toISOString();
    task.status = 'failed';
    task.lastActivity = now;

    const event = this.createEvent('task.failed', {
      taskId: payload.taskId,
      agentId: task.agentId,
      agentType: task.agentType,
      description: task.description,
      status: 'failed',
      startTime: task.startTime,
      endTime: now,
      error: payload.error,
      errorCode: payload.errorCode,
      recoverable: payload.recoverable,
    }, this.getParentSpanId(task.parentTaskId), 'error');

    await this.eventEmitter.emitEvent(event);

    // Keep failed tasks for longer for debugging
    setTimeout(() => {
      this.activeTasks.delete(payload.taskId);
    }, 300000); // Keep for 5 minutes after failure

    return event;
  }

  /**
   * List active tasks
   */
  listActiveTasks(options?: {
    status?: TaskEventStatus;
    agentType?: string;
    parentTaskId?: string;
  }): TaskListActiveOutput {
    let tasks = Array.from(this.activeTasks.values());

    // Apply filters
    if (options?.status) {
      tasks = tasks.filter(t => t.status === options.status);
    }
    if (options?.agentType) {
      tasks = tasks.filter(t => t.agentType === options.agentType);
    }
    if (options?.parentTaskId) {
      tasks = tasks.filter(t => t.parentTaskId === options.parentTaskId);
    }

    // Calculate stats by status
    const byStatus: Record<TaskEventStatus, number> = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const task of this.activeTasks.values()) {
      byStatus[task.status]++;
    }

    return {
      tasks: tasks.sort((a, b) => 
        new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      ),
      total: tasks.length,
      byStatus,
    };
  }

  /**
   * Get a specific task
   */
  getTask(taskId: string): ActiveTask | undefined {
    return this.activeTasks.get(taskId);
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Create an OrchestrationEvent
   */
  private createEvent(
    type: 'task.started' | 'task.progress' | 'task.completed' | 'task.failed',
    payload: Record<string, any>,
    parentSpanId?: string,
    severity: 'debug' | 'info' | 'warn' | 'error' = 'info'
  ): OrchestrationEvent {
    return {
      id: generateId(),
      timestamp: new Date().toISOString(),
      type,
      traceId: this.traceId,
      spanId: generateSpanId(),
      parentSpanId,
      source: {
        service: 'team-orchestrator',
        version: '0.2.0',
      },
      project: {
        id: 'default',
        path: payload.cwd,
      },
      session: {
        id: this.sessionId,
        startTime: new Date().toISOString(),
      },
      team: {
        id: 'default',
        name: 'Team',
      },
      payload,
      severity,
      tags: ['task', payload.agentType],
    };
  }

  /**
   * Get parent span ID from parent task
   */
  private getParentSpanId(parentTaskId?: string): string | undefined {
    if (!parentTaskId) return undefined;
    const parentTask = this.activeTasks.get(parentTaskId);
    return parentTask ? parentTask.taskId : undefined;
  }
}

// Singleton instance
let taskEventServiceInstance: TaskEventService | null = null;

export function getTaskEventService(): TaskEventService {
  if (!taskEventServiceInstance) {
    taskEventServiceInstance = new TaskEventService();
  }
  return taskEventServiceInstance;
}
