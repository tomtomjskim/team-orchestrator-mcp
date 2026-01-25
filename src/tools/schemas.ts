/**
 * MCP Tool Schemas (Zod)
 */

import { z } from 'zod';

// ============================================
// Team Management Tool Schemas
// ============================================

export const TeamListTemplatesInputSchema = z.object({
  source: z.enum(['local', 'registry', 'all']).optional().default('all'),
  tags: z.array(z.string()).optional(),
});

export const TeamInitInputSchema = z.object({
  template: z.string().describe('Template ID to use'),
  projectPath: z.string().optional().describe('Project path (default: current directory)'),
  projectName: z.string().optional().describe('Project name'),
  customizations: z.object({
    agents: z.array(z.object({
      role: z.string(),
      enabled: z.boolean().optional(),
      promptOverride: z.string().optional(),
    })).optional(),
    workflows: z.array(z.string()).optional(),
  }).optional(),
});

export const TeamGetConfigInputSchema = z.object({
  projectPath: z.string().optional(),
});

export const TeamSetGoalInputSchema = z.object({
  goal: z.string().describe('Project goal description'),
  context: z.string().optional().describe('Additional context'),
  constraints: z.array(z.string()).optional().describe('Project constraints'),
  techStack: z.array(z.string()).optional().describe('Technology stack'),
});

// ============================================
// Agent Management Tool Schemas
// ============================================

export const AgentListInputSchema = z.object({
  includePrompts: z.boolean().optional().default(false),
  filter: z.object({
    type: z.string().optional(),
    enabled: z.boolean().optional(),
  }).optional(),
});

export const AgentAddInputSchema = z.object({
  role: z.string().describe('Agent role ID (e.g., "security-auditor")'),
  name: z.string().describe('Display name'),
  type: z.enum(['Explore', 'Plan', 'general-purpose', 'Bash']).describe('Agent type'),
  description: z.string().describe('Agent description'),
  prompt: z.string().describe('System prompt content'),
  tools: z.array(z.string()).optional().describe('Allowed tools'),
  outputs: z.array(z.string()).optional().describe('Output formats'),
});

export const AgentModifyInputSchema = z.object({
  role: z.string().describe('Agent role ID to modify'),
  updates: z.object({
    name: z.string().optional(),
    prompt: z.string().optional(),
    enabled: z.boolean().optional(),
    tools: z.array(z.string()).optional(),
  }),
});

// ============================================
// Workflow Management Tool Schemas
// ============================================

export const WorkflowListInputSchema = z.object({});

export const WorkflowRunInputSchema = z.object({
  workflow: z.string().optional().describe('Workflow ID (default: auto-select)'),
  task: z.string().describe('Task description to execute'),
  options: z.object({
    dryRun: z.boolean().optional().default(false),
    parallel: z.boolean().optional().default(true),
    checkpoints: z.boolean().optional().default(true),
    approvalRequired: z.boolean().optional().default(false),
  }).optional(),
});

export const WorkflowStatusInputSchema = z.object({
  runId: z.string().describe('Workflow run ID'),
});

export const WorkflowResumeInputSchema = z.object({
  runId: z.string().describe('Workflow run ID'),
  fromCheckpoint: z.string().optional().describe('Checkpoint to resume from'),
});

export const WorkflowAbortInputSchema = z.object({
  runId: z.string().describe('Workflow run ID'),
  reason: z.string().optional().describe('Abort reason'),
});

// ============================================
// Monitor Tool Schemas
// ============================================

export const MonitorRegisterInputSchema = z.object({
  type: z.enum(['sse', 'webhook', 'file', 'otlp', 'prometheus']).describe('Monitor type'),
  config: z.object({
    endpoint: z.string().optional().describe('SSE/OTLP endpoint URL'),
    url: z.string().optional().describe('Webhook URL'),
    secret: z.string().optional().describe('Webhook secret'),
    events: z.array(z.string()).optional().describe('Event type filter'),
    path: z.string().optional().describe('File path or Prometheus path'),
    format: z.enum(['json', 'jsonl']).optional().describe('File format'),
    port: z.number().optional().describe('Prometheus port'),
    headers: z.record(z.string()).optional().describe('OTLP headers'),
  }),
});

export const MonitorEmitInputSchema = z.object({
  type: z.string().describe('Custom event type'),
  payload: z.any().describe('Event payload'),
  metadata: z.record(z.any()).optional().describe('Additional metadata'),
});

export const MonitorGetEventsInputSchema = z.object({
  runId: z.string().optional().describe('Filter by run ID'),
  types: z.array(z.string()).optional().describe('Event type filter'),
  since: z.string().optional().describe('Start time (ISO 8601)'),
  limit: z.number().optional().default(100).describe('Maximum events to return'),
});

// ============================================
// Type exports from schemas
// ============================================

export type TeamListTemplatesInput = z.infer<typeof TeamListTemplatesInputSchema>;
export type TeamInitInput = z.infer<typeof TeamInitInputSchema>;
export type TeamGetConfigInput = z.infer<typeof TeamGetConfigInputSchema>;
export type TeamSetGoalInput = z.infer<typeof TeamSetGoalInputSchema>;
export type AgentListInput = z.infer<typeof AgentListInputSchema>;
export type AgentAddInput = z.infer<typeof AgentAddInputSchema>;
export type AgentModifyInput = z.infer<typeof AgentModifyInputSchema>;
export type WorkflowListInput = z.infer<typeof WorkflowListInputSchema>;
export type WorkflowRunInput = z.infer<typeof WorkflowRunInputSchema>;
export type WorkflowStatusInput = z.infer<typeof WorkflowStatusInputSchema>;
export type WorkflowResumeInput = z.infer<typeof WorkflowResumeInputSchema>;
export type WorkflowAbortInput = z.infer<typeof WorkflowAbortInputSchema>;
export type MonitorRegisterInput = z.infer<typeof MonitorRegisterInputSchema>;
export type MonitorEmitInput = z.infer<typeof MonitorEmitInputSchema>;
export type MonitorGetEventsInput = z.infer<typeof MonitorGetEventsInputSchema>;
