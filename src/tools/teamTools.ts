/**
 * Team Management MCP Tools
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { TeamManager } from '../services/TeamManager.js';
import {
  TeamListTemplatesInputSchema,
  TeamInitInputSchema,
  TeamGetConfigInputSchema,
  TeamSetGoalInputSchema,
} from './schemas.js';

export function registerTeamTools(server: Server, teamManager: TeamManager): void {
  // Tool definitions are registered via ListToolsRequest handler
  // Individual tool handlers are registered via CallToolRequest handler
}

export const teamToolDefinitions = [
  {
    name: 'team_list_templates',
    description: 'List available team templates',
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          enum: ['local', 'registry', 'all'],
          description: 'Template source (default: all)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags',
        },
      },
    },
  },
  {
    name: 'team_init',
    description: 'Initialize a team configuration from a template',
    inputSchema: {
      type: 'object',
      required: ['template'],
      properties: {
        template: {
          type: 'string',
          description: 'Template ID to use',
        },
        projectPath: {
          type: 'string',
          description: 'Project path (default: current directory)',
        },
        projectName: {
          type: 'string',
          description: 'Project name',
        },
        customizations: {
          type: 'object',
          properties: {
            agents: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  role: { type: 'string' },
                  enabled: { type: 'boolean' },
                  promptOverride: { type: 'string' },
                },
              },
            },
            workflows: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
  },
  {
    name: 'team_get_config',
    description: 'Get current team configuration',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Project path (default: current directory)',
        },
      },
    },
  },
  {
    name: 'team_set_goal',
    description: 'Set or update project goal and context',
    inputSchema: {
      type: 'object',
      required: ['goal'],
      properties: {
        goal: {
          type: 'string',
          description: 'Project goal description',
        },
        context: {
          type: 'string',
          description: 'Additional context',
        },
        constraints: {
          type: 'array',
          items: { type: 'string' },
          description: 'Project constraints',
        },
        techStack: {
          type: 'array',
          items: { type: 'string' },
          description: 'Technology stack',
        },
      },
    },
  },
];

export async function handleTeamTool(
  toolName: string,
  args: Record<string, unknown>,
  teamManager: TeamManager
): Promise<any> {
  switch (toolName) {
    case 'team_list_templates': {
      const input = TeamListTemplatesInputSchema.parse(args);
      return teamManager.listTemplates(input);
    }

    case 'team_init': {
      const input = TeamInitInputSchema.parse(args);
      return teamManager.initTeam(input);
    }

    case 'team_get_config': {
      TeamGetConfigInputSchema.parse(args);
      return teamManager.getConfig();
    }

    case 'team_set_goal': {
      const input = TeamSetGoalInputSchema.parse(args);
      return teamManager.setGoal(input);
    }

    default:
      throw new Error(`Unknown team tool: ${toolName}`);
  }
}
