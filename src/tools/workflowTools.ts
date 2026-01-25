/**
 * Workflow Management MCP Tools
 */

import { TeamManager } from '../services/TeamManager.js';
import {
  WorkflowRunInputSchema,
  WorkflowStatusInputSchema,
  WorkflowResumeInputSchema,
  WorkflowAbortInputSchema,
} from './schemas.js';

// Workflow run storage (in-memory for now)
const workflowRuns = new Map<string, {
  runId: string;
  workflowId: string;
  task: string;
  status: 'planning' | 'running' | 'paused' | 'completed' | 'failed' | 'aborted';
  startTime: string;
  endTime?: string;
  currentStage?: string;
  stages: Array<{
    id: string;
    name: string;
    agent: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startTime?: string;
    endTime?: string;
    output?: string;
    error?: string;
  }>;
  checkpoints: Array<{
    stageId: string;
    timestamp: string;
    data: any;
  }>;
  options: {
    dryRun: boolean;
    parallel: boolean;
    checkpoints: boolean;
    approvalRequired: boolean;
  };
}>();

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

function generateRunId(): string {
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
}

export async function handleWorkflowTool(
  toolName: string,
  args: Record<string, unknown>,
  teamManager: TeamManager
): Promise<any> {
  switch (toolName) {
    case 'workflow_list': {
      const workflows = await teamManager.listWorkflows();
      return {
        workflows: workflows.map(w => ({
          id: w.id,
          name: w.name,
          description: w.description,
          stages: w.stages.map(s => ({
            name: s.name,
            agent: s.agent,
            dependsOn: s.dependsOn || [],
          })),
          estimatedAgents: new Set(w.stages.map(s => s.agent)).size,
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

      const runId = generateRunId();
      const options = {
        dryRun: input.options?.dryRun ?? false,
        parallel: input.options?.parallel ?? true,
        checkpoints: input.options?.checkpoints ?? true,
        approvalRequired: input.options?.approvalRequired ?? false,
      };

      // Create run record
      const run = {
        runId,
        workflowId: workflow.id,
        task: input.task,
        status: options.dryRun ? 'planning' as const : 'running' as const,
        startTime: new Date().toISOString(),
        stages: workflow.stages.map(s => ({
          id: s.id,
          name: s.name,
          agent: s.agent,
          status: 'pending' as const,
        })),
        checkpoints: [],
        options,
      };

      workflowRuns.set(runId, run);

      // Build execution plan
      const plan = {
        stages: workflow.stages.map(s => ({
          id: s.id,
          name: s.name,
          agent: s.agent,
          task: s.task || `Execute ${s.name} for: ${input.task}`,
          dependsOn: s.dependsOn || [],
        })),
        estimatedSteps: workflow.stages.length,
      };

      return {
        runId,
        workflow: workflow.id,
        status: run.status,
        plan,
        message: options.dryRun
          ? 'Dry run - execution plan generated but not started'
          : 'Workflow started. Use workflow_status to monitor progress.',
      };
    }

    case 'workflow_status': {
      const input = WorkflowStatusInputSchema.parse(args);
      const run = workflowRuns.get(input.runId);

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
        lastCheckpoint: run.checkpoints.length > 0
          ? run.checkpoints[run.checkpoints.length - 1]
          : undefined,
      };
    }

    case 'workflow_resume': {
      const input = WorkflowResumeInputSchema.parse(args);
      const run = workflowRuns.get(input.runId);

      if (!run) {
        throw new Error(`Workflow run '${input.runId}' not found`);
      }

      if (run.status !== 'paused' && run.status !== 'failed') {
        throw new Error(`Workflow is not paused or failed (current status: ${run.status})`);
      }

      // Find resume point
      let resumeFromIndex = 0;
      if (input.fromCheckpoint) {
        const checkpointIndex = run.stages.findIndex(s => s.id === input.fromCheckpoint);
        if (checkpointIndex >= 0) {
          resumeFromIndex = checkpointIndex;
        }
      } else {
        // Resume from first non-completed stage
        resumeFromIndex = run.stages.findIndex(s =>
          s.status === 'pending' || s.status === 'failed'
        );
      }

      run.status = 'running';
      run.currentStage = run.stages[resumeFromIndex]?.id;

      return {
        runId: run.runId,
        status: 'running',
        resumedFrom: run.stages[resumeFromIndex]?.id || 'start',
        message: 'Workflow resumed',
      };
    }

    case 'workflow_abort': {
      const input = WorkflowAbortInputSchema.parse(args);
      const run = workflowRuns.get(input.runId);

      if (!run) {
        throw new Error(`Workflow run '${input.runId}' not found`);
      }

      if (run.status === 'completed' || run.status === 'aborted') {
        throw new Error(`Workflow already ${run.status}`);
      }

      run.status = 'aborted';
      run.endTime = new Date().toISOString();

      return {
        runId: run.runId,
        status: 'aborted',
        reason: input.reason || 'Aborted by user',
        message: 'Workflow aborted',
      };
    }

    default:
      throw new Error(`Unknown workflow tool: ${toolName}`);
  }
}

// Export for workflow engine integration
export function getWorkflowRun(runId: string) {
  return workflowRuns.get(runId);
}

export function updateWorkflowRun(runId: string, updates: Partial<typeof workflowRuns extends Map<string, infer V> ? V : never>) {
  const run = workflowRuns.get(runId);
  if (run) {
    Object.assign(run, updates);
  }
}
