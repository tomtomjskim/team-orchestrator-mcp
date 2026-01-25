/**
 * MCP Tools Index
 */

export * from './schemas.js';
export * from './teamTools.js';
export * from './agentTools.js';
export * from './workflowTools.js';
export * from './monitorTools.js';
export * from './registryTools.js';

import { teamToolDefinitions, handleTeamTool } from './teamTools.js';
import { agentToolDefinitions, handleAgentTool } from './agentTools.js';
import { workflowToolDefinitions, handleWorkflowTool } from './workflowTools.js';
import { monitorToolDefinitions, handleMonitorTool } from './monitorTools.js';
import { registryToolDefinitions, handleRegistryTool } from './registryTools.js';
import { TeamManager } from '../services/TeamManager.js';

// All tool definitions
export const allToolDefinitions = [
  ...teamToolDefinitions,
  ...agentToolDefinitions,
  ...workflowToolDefinitions,
  ...monitorToolDefinitions,
  ...registryToolDefinitions,
];

// Unified tool handler
export async function handleTool(
  toolName: string,
  args: Record<string, unknown>,
  teamManager: TeamManager
): Promise<any> {
  // Team tools
  if (toolName.startsWith('team_')) {
    return handleTeamTool(toolName, args, teamManager);
  }

  // Agent tools
  if (toolName.startsWith('agent_')) {
    return handleAgentTool(toolName, args, teamManager);
  }

  // Workflow tools
  if (toolName.startsWith('workflow_')) {
    return handleWorkflowTool(toolName, args, teamManager);
  }

  // Monitor tools
  if (toolName.startsWith('monitor_')) {
    return handleMonitorTool(toolName, args, teamManager);
  }

  // Registry tools
  if (toolName.startsWith('registry_')) {
    return handleRegistryTool(toolName, args);
  }

  throw new Error(`Unknown tool: ${toolName}`);
}
