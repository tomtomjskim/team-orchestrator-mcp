/**
 * Workflow Management MCP Tools
 */

import { TeamManager } from '../services/TeamManager.js';
import { getWorkflowEngine, WorkflowEngine } from '../services/WorkflowEngine.js';
import { getEventEmitter, EventEmitterService } from '../services/EventEmitter.js';
import { WorkflowRun, OrchestrationEvent } from '../types/index.js';
import {
  WorkflowRunInputSchema,
  WorkflowStatusInputSchema,
  WorkflowResumeInputSchema,
  WorkflowAbortInputSchema,
} from './schemas.js';

// Get service instances
let workflowEngine: WorkflowEngine;
let eventEmitter: EventEmitterService;

function initServices() {
  if (!workflowEngine) {
    workflowEngine = getWorkflowEngine();
    eventEmitter = getEventEmitter();

    // Connect workflow events to event emitter
    workflowEngine.on('event', (event: OrchestrationEvent) => {
      eventEmitter.emitEvent(event).catch(console.error);
    });
  }
}

export const workflowToolDefinitions = [
  {
    name: 'workflow_list',
    description: 'List available workflows',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'workflow_run',
    description: 'Start a workflow execution',
    inputSchema: {
      type: 'object',
      required: ['task'],
      properties: {
        workflow: {
          type: 'string',
          description: 'Workflow ID (default: auto-select based on task)',
        },
        task: {
          type: 'string',
          description: 'Task description to execute',
        },
        options: {
          type: 'object',
          properties: {
            dryRun: {
              type: 'boolean',
              description: 'Plan only, do not execute',
            },
            parallel: {
              type: 'boolean',
              description: 'Allow parallel stage execution',
            },
            checkpoints: {
              type: 'boolean',
              description: 'Enable checkpoints for recovery',
            },
            approvalRequired: {
              type: 'boolean',
              description: 'Require approval at gates',
            },
          },
        },
      },
    },
  },
  {
    name: 'workflow_status',
    description: 'Get status of a workflow run',
    inputSchema: {
      type: 'object',
      required: ['runId'],
      properties: {
        runId: {
          type: 'string',
          description: 'Workflow run ID',
        },
      },
    },
  },
  {
    name: 'workflow_resume',
    description: 'Resume a paused or failed workflow',
    inputSchema: {
      type: 'object',
      required: ['runId'],
      properties: {
        runId: {
          type: 'string',
          description: 'Workflow run ID',
        },
        fromCheckpoint: {
          type: 'string',
          description: 'Checkpoint stage ID to resume from',
        },
      },
    },
  },
  {
    name: 'workflow_abort',
    description: 'Abort a running workflow',
    inputSchema: {
      type: 'object',
      required: ['runId'],
      properties: {
        runId: {
          type: 'string',
          description: 'Workflow run ID',
        },
        reason: {
          type: 'string',
          description: 'Abort reason',
        },
      },
    },
  },
];

export async function handleWorkflowTool(
  toolName: string,
  args: Record<string, unknown>,
  teamManager: TeamManager
): Promise<any> {
  // Initialize services on first call
  initServices();

  switch (toolName) {
    case 'workflow_list': {
      const workflows = await teamManager.listWorkflows();
      return {
        workflows: workflows.map(w => ({
          id: w.id,
          name: w.name,
          description: w.description,
          stages: w.stages.map(s => ({
            id: s.id,
            name: s.name,
            agent: s.agent,
            dependsOn: s.dependsOn || [],
            parallel: s.parallel,
            optional: s.optional,
          })),
          estimatedAgents: new Set(w.stages.map(s => s.agent)).size,
          checkpoints: w.checkpoints,
        })),
      };
    }

    case 'workflow_run': {
      const input = WorkflowRunInputSchema.parse(args);

      // Get workflows
      const workflows = await teamManager.listWorkflows();
      if (workflows.length === 0) {
        throw new Error('No workflows configured. Please initialize a team first.');
      }

      // Select workflow
      let workflow = input.workflow
        ? workflows.find(w => w.id === input.workflow)
        : workflows[0]; // Default to first workflow

      if (!workflow) {
        throw new Error(`Workflow '${input.workflow}' not found`);
      }

      const options = {
        dryRun: input.options?.dryRun ?? false,
        parallel: input.options?.parallel ?? true,
        checkpoints: input.options?.checkpoints ?? true,
        approvalRequired: input.options?.approvalRequired ?? false,
      };

      // Execute workflow using engine
      const run = await workflowEngine.executeWorkflow(workflow, input.task, options);

      // Build response
      const response: any = {
        runId: run.runId,
        workflow: workflow.id,
        status: run.status,
        startTime: run.startTime,
      };

      if (options.dryRun) {
        response.plan = {
          stages: workflow.stages.map(s => ({
            id: s.id,
            name: s.name,
            agent: s.agent,
            task: s.task || `Execute ${s.name} for: ${input.task}`,
            dependsOn: s.dependsOn || [],
            parallel: s.parallel,
            optional: s.optional,
            condition: s.condition,
          })),
          estimatedSteps: workflow.stages.length,
        };
        response.message = 'Dry run - execution plan generated but not started';
      } else {
        response.stages = run.stages;
        response.message = run.status === 'completed'
          ? 'Workflow completed successfully'
          : run.status === 'failed' || run.status === 'paused'
            ? `Workflow ${run.status}. Use workflow_resume to continue.`
            : 'Workflow started. Use workflow_status to monitor progress.';
      }

      if (run.result) {
        response.result = run.result;
      }

      return response;
    }

    case 'workflow_status': {
      const input = WorkflowStatusInputSchema.parse(args);
      const run = workflowEngine.getRunStatus(input.runId);

      if (!run) {
        throw new Error(`Workflow run '${input.runId}' not found`);
      }

      const completedStages = run.stages.filter(s => s.status === 'completed').length;
      const totalStages = run.stages.length;

      return {
        runId: run.runId,
        workflowId: run.workflowId,
        task: run.task,
        status: run.status,
        currentStage: run.currentStage,
        progress: {
          completed: completedStages,
          total: totalStages,
          percentage: Math.round((completedStages / totalStages) * 100),
        },
        stages: run.stages,
        startTime: run.startTime,
        endTime: run.endTime,
        checkpoints: run.checkpoints,
        lastCheckpoint: run.checkpoints.length > 0
          ? run.checkpoints[run.checkpoints.length - 1]
          : undefined,
        result: run.result,
      };
    }

    case 'workflow_resume': {
      const input = WorkflowResumeInputSchema.parse(args);

      // Get workflow config
      const run = workflowEngine.getRunStatus(input.runId);
      if (!run) {
        throw new Error(`Workflow run '${input.runId}' not found`);
      }

      const workflows = await teamManager.listWorkflows();
      const workflow = workflows.find(w => w.id === run.workflowId);
      if (!workflow) {
        throw new Error(`Workflow '${run.workflowId}' not found`);
      }

      // Resume workflow
      const resumedRun = await workflowEngine.resumeWorkflow(
        input.runId,
        workflow,
        input.fromCheckpoint
      );

      return {
        runId: resumedRun.runId,
        status: resumedRun.status,
        resumedFrom: input.fromCheckpoint || 'last-failure',
        stages: resumedRun.stages,
        message: resumedRun.status === 'completed'
          ? 'Workflow completed successfully'
          : 'Workflow resumed',
        result: resumedRun.result,
      };
    }

    case 'workflow_abort': {
      const input = WorkflowAbortInputSchema.parse(args);
      const run = workflowEngine.abortWorkflow(input.runId, input.reason);

      return {
        runId: run.runId,
        status: 'aborted',
        reason: input.reason || 'Aborted by user',
        endTime: run.endTime,
        message: 'Workflow aborted',
      };
    }

    default:
      throw new Error(`Unknown workflow tool: ${toolName}`);
  }
}

// Export workflow engine for external use
export { getWorkflowEngine };
