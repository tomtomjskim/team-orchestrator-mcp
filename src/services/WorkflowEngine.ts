/**
 * WorkflowEngine - DAG-based workflow execution engine
 */

import { EventEmitter } from 'events';
import {
  WorkflowConfig,
  WorkflowStage,
  WorkflowRun,
  WorkflowStageRun,
  WorkflowCheckpoint,
  WorkflowResult,
  OrchestrationEvent,
  EventType,
} from '../types/index.js';

export interface WorkflowExecutionOptions {
  dryRun?: boolean;
  parallel?: boolean;
  checkpoints?: boolean;
  approvalRequired?: boolean;
  onEvent?: (event: OrchestrationEvent) => void;
}

export interface StageExecutor {
  (stage: WorkflowStage, context: StageContext): Promise<StageResult>;
}

export interface StageContext {
  runId: string;
  workflowId: string;
  task: string;
  previousOutputs: Map<string, string>;
  variables: Record<string, any>;
}

export interface StageResult {
  success: boolean;
  output?: string;
  error?: string;
  data?: any;
}

type RunStatus = 'planning' | 'running' | 'paused' | 'completed' | 'failed' | 'aborted';
type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export class WorkflowEngine extends EventEmitter {
  private runs: Map<string, WorkflowRun> = new Map();
  private stageExecutor?: StageExecutor;
  private traceId: string;
  private sessionId: string;

  constructor() {
    super();
    this.traceId = this.generateTraceId();
    this.sessionId = this.generateId();
  }

  /**
   * Set the stage executor function
   */
  setStageExecutor(executor: StageExecutor): void {
    this.stageExecutor = executor;
  }

  /**
   * Create a new workflow run
   */
  createRun(
    workflow: WorkflowConfig,
    task: string,
    options: WorkflowExecutionOptions = {}
  ): WorkflowRun {
    const runId = this.generateRunId();

    const run: WorkflowRun = {
      runId,
      workflowId: workflow.id,
      status: options.dryRun ? 'planning' : 'running',
      task,
      startTime: new Date().toISOString(),
      stages: workflow.stages.map(s => ({
        id: s.id,
        name: s.name,
        agent: s.agent,
        status: 'pending' as StageStatus,
      })),
      checkpoints: [],
    };

    this.runs.set(runId, run);

    // Emit workflow started event
    this.emitEvent('workflow.started', {
      runId,
      workflowId: workflow.id,
      task,
      options,
    });

    return run;
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflow: WorkflowConfig,
    task: string,
    options: WorkflowExecutionOptions = {}
  ): Promise<WorkflowRun> {
    const run = this.createRun(workflow, task, options);

    if (options.dryRun) {
      this.emitEvent('workflow.planned', {
        runId: run.runId,
        plan: this.buildExecutionPlan(workflow),
      });
      return run;
    }

    try {
      // Build execution order using topological sort
      const executionOrder = this.topologicalSort(workflow.stages);

      // Execute stages
      const context: StageContext = {
        runId: run.runId,
        workflowId: workflow.id,
        task,
        previousOutputs: new Map(),
        variables: this.parseTaskVariables(task),
      };

      // Group stages by dependency level for parallel execution
      const stageLevels = this.groupStagesByLevel(workflow.stages, executionOrder);

      for (const levelStages of stageLevels) {
        // Filter out stages that should be skipped
        const executableStages = levelStages.filter(stageId => {
          const stage = workflow.stages.find(s => s.id === stageId);
          if (!stage) return false;

          // Check condition
          if (stage.condition && !this.evaluateCondition(stage.condition, context.variables)) {
            this.updateStageStatus(run, stageId, 'skipped');
            return false;
          }

          // Check if dependencies are satisfied
          if (stage.dependsOn) {
            for (const depId of stage.dependsOn) {
              const depStage = run.stages.find(s => s.id === depId);
              if (depStage && depStage.status !== 'completed' && depStage.status !== 'skipped') {
                return false;
              }
            }
          }

          return true;
        });

        if (executableStages.length === 0) continue;

        // Execute stages (parallel or sequential)
        if (options.parallel && executableStages.length > 1) {
          await this.executeStagesParallel(workflow, run, executableStages, context, options);
        } else {
          for (const stageId of executableStages) {
            await this.executeStage(workflow, run, stageId, context, options);

            // Check for failure
            const stageRun = run.stages.find(s => s.id === stageId);
            if (stageRun?.status === 'failed') {
              const failureStrategy = workflow.onFailure?.strategy || 'pause';
              if (failureStrategy === 'pause') {
                run.status = 'paused';
                this.emitEvent('workflow.failed', {
                  runId: run.runId,
                  stage: stageId,
                  error: stageRun.error,
                });
                return run;
              }
            }
          }
        }

        // Create checkpoint after level completion if enabled
        if (options.checkpoints && workflow.checkpoints?.enabled) {
          const shouldCheckpoint = !workflow.checkpoints.stages ||
            levelStages.some(id => workflow.checkpoints!.stages!.includes(id));

          if (shouldCheckpoint) {
            this.createCheckpoint(run, levelStages[levelStages.length - 1], context);
          }
        }
      }

      // Complete workflow
      run.status = 'completed';
      run.endTime = new Date().toISOString();
      run.result = this.buildResult(run, context);

      this.emitEvent('workflow.completed', {
        runId: run.runId,
        result: run.result,
      });

    } catch (error) {
      run.status = 'failed';
      run.endTime = new Date().toISOString();

      this.emitEvent('workflow.failed', {
        runId: run.runId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return run;
  }

  /**
   * Execute a single stage
   */
  private async executeStage(
    workflow: WorkflowConfig,
    run: WorkflowRun,
    stageId: string,
    context: StageContext,
    options: WorkflowExecutionOptions
  ): Promise<void> {
    const stage = workflow.stages.find(s => s.id === stageId);
    if (!stage) return;

    const stageRun = run.stages.find(s => s.id === stageId);
    if (!stageRun) return;

    run.currentStage = stageId;
    stageRun.status = 'running';
    stageRun.startTime = new Date().toISOString();

    this.emitEvent('workflow.stage.started', {
      runId: run.runId,
      stageId,
      stageName: stage.name,
      agent: stage.agent,
    });

    try {
      // Check for approval gate
      if (options.approvalRequired && stage.gate) {
        this.emitEvent('approval.requested', {
          runId: run.runId,
          stageId,
          gate: stage.gate,
        });

        // In real implementation, would wait for approval
        // For now, auto-approve
        this.emitEvent('approval.granted', {
          runId: run.runId,
          stageId,
        });
      }

      // Execute stage
      let result: StageResult;

      if (this.stageExecutor) {
        result = await this.stageExecutor(stage, context);
      } else {
        // Default executor - just mark as completed
        result = {
          success: true,
          output: `Stage ${stage.name} completed (no executor configured)`,
        };
      }

      if (result.success) {
        stageRun.status = 'completed';
        stageRun.output = result.output;
        context.previousOutputs.set(stageId, result.output || '');
      } else {
        stageRun.status = 'failed';
        stageRun.error = result.error;
      }

    } catch (error) {
      stageRun.status = 'failed';
      stageRun.error = error instanceof Error ? error.message : String(error);
    }

    stageRun.endTime = new Date().toISOString();

    this.emitEvent('workflow.stage.completed', {
      runId: run.runId,
      stageId,
      status: stageRun.status,
      output: stageRun.output,
      error: stageRun.error,
    });
  }

  /**
   * Execute stages in parallel
   */
  private async executeStagesParallel(
    workflow: WorkflowConfig,
    run: WorkflowRun,
    stageIds: string[],
    context: StageContext,
    options: WorkflowExecutionOptions
  ): Promise<void> {
    const promises = stageIds.map(stageId =>
      this.executeStage(workflow, run, stageId, context, options)
    );

    await Promise.all(promises);
  }

  /**
   * Resume a paused workflow
   */
  async resumeWorkflow(
    runId: string,
    workflow: WorkflowConfig,
    fromCheckpoint?: string
  ): Promise<WorkflowRun> {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Workflow run '${runId}' not found`);
    }

    if (run.status !== 'paused' && run.status !== 'failed') {
      throw new Error(`Workflow is not paused or failed (current status: ${run.status})`);
    }

    // Find resume point
    let resumeFromIndex = 0;
    if (fromCheckpoint) {
      const checkpointIndex = run.stages.findIndex(s => s.id === fromCheckpoint);
      if (checkpointIndex >= 0) {
        resumeFromIndex = checkpointIndex;

        // Reset stages after checkpoint
        for (let i = resumeFromIndex; i < run.stages.length; i++) {
          run.stages[i].status = 'pending';
          run.stages[i].output = undefined;
          run.stages[i].error = undefined;
          run.stages[i].startTime = undefined;
          run.stages[i].endTime = undefined;
        }
      }
    } else {
      // Resume from first non-completed stage
      resumeFromIndex = run.stages.findIndex(s =>
        s.status === 'pending' || s.status === 'failed'
      );

      // Reset failed stage
      if (resumeFromIndex >= 0 && run.stages[resumeFromIndex].status === 'failed') {
        run.stages[resumeFromIndex].status = 'pending';
        run.stages[resumeFromIndex].error = undefined;
      }
    }

    run.status = 'running';

    this.emitEvent('workflow.started', {
      runId,
      resumed: true,
      fromStage: run.stages[resumeFromIndex]?.id,
    });

    // Continue execution from resume point
    const context: StageContext = {
      runId: run.runId,
      workflowId: workflow.id,
      task: run.task,
      previousOutputs: new Map(
        run.stages
          .filter(s => s.status === 'completed' && s.output)
          .map(s => [s.id, s.output!])
      ),
      variables: this.parseTaskVariables(run.task),
    };

    // Execute remaining stages
    for (let i = resumeFromIndex; i < run.stages.length; i++) {
      const stageId = run.stages[i].id;
      const stage = workflow.stages.find(s => s.id === stageId);
      if (!stage) continue;

      if (run.stages[i].status !== 'pending') continue;

      await this.executeStage(workflow, run, stageId, context, { parallel: false });

      if (run.stages[i].status === 'failed') {
        run.status = 'paused';
        return run;
      }
    }

    run.status = 'completed';
    run.endTime = new Date().toISOString();
    run.result = this.buildResult(run, context);

    this.emitEvent('workflow.completed', {
      runId: run.runId,
      result: run.result,
    });

    return run;
  }

  /**
   * Abort a running workflow
   */
  abortWorkflow(runId: string, reason?: string): WorkflowRun {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`Workflow run '${runId}' not found`);
    }

    run.status = 'aborted';
    run.endTime = new Date().toISOString();

    this.emitEvent('workflow.aborted', {
      runId,
      reason: reason || 'Aborted by user',
    });

    return run;
  }

  /**
   * Get workflow run status
   */
  getRunStatus(runId: string): WorkflowRun | null {
    return this.runs.get(runId) || null;
  }

  /**
   * Topological sort of stages based on dependencies
   */
  private topologicalSort(stages: WorkflowStage[]): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (stageId: string) => {
      if (visited.has(stageId)) return;
      if (visiting.has(stageId)) {
        throw new Error(`Circular dependency detected at stage: ${stageId}`);
      }

      visiting.add(stageId);

      const stage = stages.find(s => s.id === stageId);
      if (stage?.dependsOn) {
        for (const depId of stage.dependsOn) {
          visit(depId);
        }
      }

      visiting.delete(stageId);
      visited.add(stageId);
      result.push(stageId);
    };

    for (const stage of stages) {
      visit(stage.id);
    }

    return result;
  }

  /**
   * Group stages by dependency level for parallel execution
   */
  private groupStagesByLevel(stages: WorkflowStage[], order: string[]): string[][] {
    const levels: string[][] = [];
    const stageLevel = new Map<string, number>();

    for (const stageId of order) {
      const stage = stages.find(s => s.id === stageId);
      let level = 0;

      if (stage?.dependsOn) {
        for (const depId of stage.dependsOn) {
          const depLevel = stageLevel.get(depId) || 0;
          level = Math.max(level, depLevel + 1);
        }
      }

      stageLevel.set(stageId, level);

      while (levels.length <= level) {
        levels.push([]);
      }
      levels[level].push(stageId);
    }

    return levels;
  }

  /**
   * Build execution plan for dry run
   */
  private buildExecutionPlan(workflow: WorkflowConfig): any {
    const order = this.topologicalSort(workflow.stages);
    const levels = this.groupStagesByLevel(workflow.stages, order);

    return {
      stages: order.map(stageId => {
        const stage = workflow.stages.find(s => s.id === stageId)!;
        return {
          id: stage.id,
          name: stage.name,
          agent: stage.agent,
          dependsOn: stage.dependsOn || [],
          parallel: stage.parallel,
          optional: stage.optional,
          condition: stage.condition,
        };
      }),
      levels: levels.map((levelStages, index) => ({
        level: index,
        stages: levelStages,
        parallel: levelStages.length > 1,
      })),
      estimatedSteps: workflow.stages.length,
    };
  }

  /**
   * Create a checkpoint
   */
  private createCheckpoint(run: WorkflowRun, stageId: string, context: StageContext): void {
    const checkpoint: WorkflowCheckpoint = {
      stageId,
      timestamp: new Date().toISOString(),
      data: {
        completedStages: run.stages
          .filter(s => s.status === 'completed')
          .map(s => s.id),
        outputs: Object.fromEntries(context.previousOutputs),
        variables: context.variables,
      },
    };

    run.checkpoints.push(checkpoint);

    this.emitEvent('workflow.checkpoint', {
      runId: run.runId,
      checkpoint,
    });
  }

  /**
   * Build workflow result
   */
  private buildResult(run: WorkflowRun, context: StageContext): WorkflowResult {
    return {
      summary: `Workflow ${run.workflowId} completed with ${run.stages.filter(s => s.status === 'completed').length}/${run.stages.length} stages`,
      filesModified: [], // Would be populated by actual execution
      agentReports: Object.fromEntries(
        run.stages
          .filter(s => s.output)
          .map(s => [s.agent, s.output!])
      ),
    };
  }

  /**
   * Update stage status
   */
  private updateStageStatus(run: WorkflowRun, stageId: string, status: StageStatus): void {
    const stage = run.stages.find(s => s.id === stageId);
    if (stage) {
      stage.status = status;
    }
  }

  /**
   * Evaluate a condition expression
   */
  private evaluateCondition(condition: string, variables: Record<string, any>): boolean {
    // Simple variable substitution check
    // {{VAR}} is truthy if VAR is defined and truthy
    const match = condition.match(/\{\{(\w+)\}\}/);
    if (match) {
      const varName = match[1];
      return !!variables[varName];
    }

    // Default to true if no condition pattern matched
    return true;
  }

  /**
   * Parse task variables from task description
   */
  private parseTaskVariables(task: string): Record<string, any> {
    // Extract common variables from task
    const variables: Record<string, any> = {
      TASK: task,
      HAS_FRONTEND: task.toLowerCase().includes('frontend') ||
                    task.toLowerCase().includes('ui') ||
                    task.toLowerCase().includes('컴포넌트'),
      HAS_BACKEND: task.toLowerCase().includes('backend') ||
                   task.toLowerCase().includes('api') ||
                   task.toLowerCase().includes('서버'),
      DEPLOY_ENABLED: task.toLowerCase().includes('deploy') ||
                      task.toLowerCase().includes('배포'),
    };

    return variables;
  }

  /**
   * Emit an orchestration event
   */
  private emitEvent(type: EventType, payload: Record<string, any>): void {
    const event: OrchestrationEvent = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      type,
      traceId: this.traceId,
      spanId: this.generateSpanId(),
      source: {
        service: 'team-orchestrator',
        version: '0.2.0',
      },
      project: {
        id: 'default',
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
    };

    this.emit('event', event);
  }

  // Utility methods
  private generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
  }

  private generateRunId(): string {
    return `run-${this.generateId()}`;
  }

  private generateTraceId(): string {
    return (Math.random().toString(16).substring(2) + Math.random().toString(16).substring(2)).substring(0, 32);
  }

  private generateSpanId(): string {
    return Math.random().toString(16).substring(2, 18).padStart(16, '0');
  }
}

// Singleton instance
let engineInstance: WorkflowEngine | null = null;

export function getWorkflowEngine(): WorkflowEngine {
  if (!engineInstance) {
    engineInstance = new WorkflowEngine();
  }
  return engineInstance;
}
