/**
 * Team Orchestrator Types
 */

// ============================================
// Team & Template Types
// ============================================

export interface TeamTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  category: 'development' | 'design' | 'data' | 'devops' | 'custom';
  tags: string[];
  agents: string[];
  defaultWorkflow: string;
  requirements?: {
    tools?: string[];
    optional?: string[];
  };
}

export interface TeamConfig {
  initialized: boolean;
  template?: string;
  projectName?: string;
  projectPath?: string;
  projectGoal?: string;
  context?: string;
  constraints?: string[];
  techStack?: string[];
  agents: AgentConfig[];
  workflows: WorkflowConfig[];
  monitors: MonitorConfig[];
}

// ============================================
// Agent Types
// ============================================

export type AgentType = 'orchestrator' | 'Explore' | 'Plan' | 'general-purpose' | 'Bash';

export interface AgentConfig {
  role: string;
  name: string;
  type: AgentType;
  description: string;
  enabled: boolean;
  promptPath: string;
  expertise?: string[];
  tools?: string[];
  outputs?: string[];
  canSpawn?: string[];
}

// ============================================
// Workflow Types
// ============================================

export interface WorkflowConfig {
  id: string;
  name: string;
  description: string;
  stages: WorkflowStage[];
  checkpoints?: {
    enabled: boolean;
    stages?: string[];
  };
  onFailure?: {
    strategy: 'pause' | 'rollback' | 'continue';
    notify?: string[];
  };
}

export interface WorkflowStage {
  id: string;
  name: string;
  description?: string;
  agent: string;
  type?: AgentType;
  dependsOn?: string[];
  parallel?: boolean;
  optional?: boolean;
  condition?: string;
  task?: string;
  outputs?: string[];
  gate?: {
    type: string;
    criteria?: string[];
  };
}

export interface WorkflowRun {
  runId: string;
  workflowId: string;
  status: 'planning' | 'running' | 'paused' | 'completed' | 'failed' | 'aborted';
  task: string;
  startTime: string;
  endTime?: string;
  currentStage?: string;
  stages: WorkflowStageRun[];
  checkpoints: WorkflowCheckpoint[];
  result?: WorkflowResult;
}

export interface WorkflowStageRun {
  id: string;
  name: string;
  agent: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: string;
  endTime?: string;
  output?: string;
  error?: string;
}

export interface WorkflowCheckpoint {
  stageId: string;
  timestamp: string;
  data: any;
}

export interface WorkflowResult {
  summary: string;
  filesModified: string[];
  agentReports: Record<string, string>;
  tokensUsed?: number;
  cost?: number;
}

// ============================================
// Monitor Types
// ============================================

export type MonitorType = 'sse' | 'webhook' | 'file' | 'otlp' | 'prometheus';

export interface MonitorConfig {
  id: string;
  type: MonitorType;
  enabled: boolean;
  endpoint?: string;
  config: Record<string, any>;
}

// ============================================
// Event Types (OpenTelemetry Compatible)
// ============================================

export type EventType =
  // Workflow Events
  | 'workflow.started'
  | 'workflow.planning'
  | 'workflow.planned'
  | 'workflow.stage.started'
  | 'workflow.stage.completed'
  | 'workflow.checkpoint'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'workflow.aborted'
  // Agent Events
  | 'agent.spawning'
  | 'agent.spawned'
  | 'agent.progress'
  | 'agent.tool.called'
  | 'agent.tool.result'
  | 'agent.completed'
  | 'agent.failed'
  // Task Events
  | 'task.created'
  | 'task.assigned'
  | 'task.started'
  | 'task.progress'
  | 'task.completed'
  | 'task.failed'
  // Approval Events
  | 'approval.requested'
  | 'approval.waiting'
  | 'approval.granted'
  | 'approval.rejected'
  | 'approval.timeout'
  // System Events
  | 'system.heartbeat'
  | 'system.error'
  | 'system.warning'
  // Custom Events
  | `custom.${string}`;

export interface OrchestrationEvent {
  id: string;
  timestamp: string;
  type: EventType;

  // Trace Context
  traceId: string;
  spanId: string;
  parentSpanId?: string;

  // Source
  source: {
    service: string;
    version: string;
    instanceId?: string;
  };

  // Context
  project: {
    id: string;
    path?: string;
    name?: string;
  };

  session: {
    id: string;
    startTime: string;
  };

  team: {
    id: string;
    name: string;
  };

  // Payload
  payload: Record<string, any>;

  // Optional
  metadata?: Record<string, any>;
  tags?: string[];
  severity?: 'debug' | 'info' | 'warn' | 'error';
}

// ============================================
// Tool Input/Output Types
// ============================================

export interface TeamListTemplatesInput {
  source?: 'local' | 'registry' | 'all';
  tags?: string[];
}

export interface TeamListTemplatesOutput {
  templates: TeamTemplate[];
}

export interface TeamInitInput {
  template: string;
  projectPath?: string;
  projectName?: string;
  customizations?: {
    agents?: Array<{
      role: string;
      enabled?: boolean;
      promptOverride?: string;
    }>;
    workflows?: string[];
  };
}

export interface TeamInitOutput {
  success: boolean;
  teamConfigPath: string;
  agents: string[];
  workflows: string[];
}

export interface WorkflowRunInput {
  workflow?: string;
  task: string;
  options?: {
    dryRun?: boolean;
    parallel?: boolean;
    checkpoints?: boolean;
    approvalRequired?: boolean;
  };
}

export interface WorkflowRunOutput {
  runId: string;
  workflow: string;
  status: string;
  plan?: {
    stages: Array<{
      id: string;
      name: string;
      agent: string;
      task: string;
      dependsOn: string[];
    }>;
    estimatedSteps: number;
  };
  result?: WorkflowResult;
}


// ============================================
// Task Event Types (for Agent Monitor Integration)
// ============================================

export type TaskEventType =
  | 'task.started'
  | 'task.progress'
  | 'task.completed'
  | 'task.failed';

export type TaskEventStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TaskStartPayload {
  taskId?: string; // Optional - will be auto-generated if not provided
  agentId: string;
  agentType: string;
  description: string;
  parentTaskId?: string;
  sessionId?: string; // Optional - will use current session if not provided
  cwd?: string;
  metadata?: Record<string, any>;
}

export interface TaskProgressPayload {
  taskId: string;
  progress?: number; // 0-100
  message?: string;
  phase?: string;
  details?: Record<string, any>;
}

export interface TaskCompletePayload {
  taskId: string;
  result?: string;
  summary?: string;
  filesModified?: string[];
  tokensUsed?: number;
}

export interface TaskFailPayload {
  taskId: string;
  error: string;
  errorCode?: string;
  recoverable?: boolean;
}

export interface ActiveTask {
  taskId: string;
  agentId: string;
  agentType: string;
  description: string;
  status: TaskEventStatus;
  parentTaskId?: string;
  sessionId: string;
  cwd?: string;
  startTime: string;
  lastActivity: string;
  progress?: number;
  phase?: string;
  metadata?: Record<string, any>;
}

export interface TaskListActiveOutput {
  tasks: ActiveTask[];
  total: number;
  byStatus: Record<TaskEventStatus, number>;
}
