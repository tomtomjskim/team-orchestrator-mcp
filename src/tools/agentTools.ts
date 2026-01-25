/**
 * Agent Management MCP Tools
 */

import { TeamManager } from '../services/TeamManager.js';
import {
  AgentListInputSchema,
  AgentAddInputSchema,
  AgentModifyInputSchema,
} from './schemas.js';
import { AgentConfig, AgentType } from '../types/index.js';

export const agentToolDefinitions = [
  {
    name: 'agent_list',
    description: 'List all agents in the team',
    inputSchema: {
      type: 'object',
      properties: {
        includePrompts: {
          type: 'boolean',
          description: 'Include prompt content in response',
        },
        filter: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            enabled: { type: 'boolean' },
          },
        },
      },
    },
  },
  {
    name: 'agent_add',
    description: 'Add a new custom agent to the team',
    inputSchema: {
      type: 'object',
      required: ['role', 'name', 'type', 'description', 'prompt'],
      properties: {
        role: {
          type: 'string',
          description: 'Agent role ID (e.g., "security-auditor")',
        },
        name: {
          type: 'string',
          description: 'Display name',
        },
        type: {
          type: 'string',
          enum: ['Explore', 'Plan', 'general-purpose', 'Bash'],
          description: 'Agent type',
        },
        description: {
          type: 'string',
          description: 'Agent description',
        },
        prompt: {
          type: 'string',
          description: 'System prompt content',
        },
        tools: {
          type: 'array',
          items: { type: 'string' },
          description: 'Allowed tools',
        },
        outputs: {
          type: 'array',
          items: { type: 'string' },
          description: 'Output formats',
        },
      },
    },
  },
  {
    name: 'agent_modify',
    description: 'Modify an existing agent configuration',
    inputSchema: {
      type: 'object',
      required: ['role', 'updates'],
      properties: {
        role: {
          type: 'string',
          description: 'Agent role ID to modify',
        },
        updates: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            prompt: { type: 'string' },
            enabled: { type: 'boolean' },
            tools: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
  },
];

export async function handleAgentTool(
  toolName: string,
  args: Record<string, unknown>,
  teamManager: TeamManager
): Promise<any> {
  switch (toolName) {
    case 'agent_list': {
      const input = AgentListInputSchema.parse(args);
      const agents = await teamManager.listAgents(input.filter);

      const result: Array<{
        role: string;
        name: string;
        type: AgentType;
        enabled: boolean;
        description: string;
        tools: string[];
        prompt?: string;
      }> = [];

      for (const agent of agents) {
        const agentData: any = {
          role: agent.role,
          name: agent.name,
          type: agent.type,
          enabled: agent.enabled,
          description: agent.description,
          tools: agent.tools || [],
        };

        if (input.includePrompts) {
          const prompt = await teamManager.getAgentPrompt(agent.role);
          if (prompt) {
            agentData.prompt = prompt;
          }
        }

        result.push(agentData);
      }

      return { agents: result };
    }

    case 'agent_add': {
      const input = AgentAddInputSchema.parse(args);

      const agentConfig: AgentConfig = {
        role: input.role,
        name: input.name,
        type: input.type as AgentType,
        description: input.description,
        enabled: true,
        promptPath: `prompts/${input.role}.md`,
        tools: input.tools,
        outputs: input.outputs,
      };

      return teamManager.addAgent(agentConfig, input.prompt);
    }

    case 'agent_modify': {
      const input = AgentModifyInputSchema.parse(args);
      return teamManager.modifyAgent(input.role, input.updates);
    }

    default:
      throw new Error(`Unknown agent tool: ${toolName}`);
  }
}
