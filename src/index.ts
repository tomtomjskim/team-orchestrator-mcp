#!/usr/bin/env node
/**
 * Team Orchestrator MCP Server
 *
 * Multi-agent team orchestration MCP server for Claude Code
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { TeamManager } from './services/TeamManager.js';
import { allToolDefinitions, handleTool } from './tools/index.js';

// Server metadata
const SERVER_NAME = 'team-orchestrator';
const SERVER_VERSION = '0.1.0';

async function main() {
  console.error(`[${SERVER_NAME}] Starting MCP server v${SERVER_VERSION}...`);

  // Initialize TeamManager
  const teamManager = new TeamManager();

  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  // ============================================
  // Tools Registration
  // ============================================

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: allToolDefinitions,
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const result = await handleTool(name, args as Record<string, unknown>, teamManager);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: errorMessage }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  // ============================================
  // Resources Registration
  // ============================================

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const config = await teamManager.getConfig();

    const resources = [
      {
        uri: 'team://config',
        name: 'Team Configuration',
        description: 'Current team configuration',
        mimeType: 'application/json',
      },
      {
        uri: 'team://agents',
        name: 'Agent List',
        description: 'List of team agents',
        mimeType: 'application/json',
      },
      {
        uri: 'team://workflows',
        name: 'Workflow List',
        description: 'Available workflows',
        mimeType: 'application/json',
      },
    ];

    // Add individual agent resources
    for (const agent of config.agents) {
      resources.push({
        uri: `team://agents/${agent.role}`,
        name: `Agent: ${agent.name}`,
        description: agent.description,
        mimeType: 'application/json',
      });
    }

    // Add individual workflow resources
    for (const workflow of config.workflows) {
      resources.push({
        uri: `team://workflows/${workflow.id}`,
        name: `Workflow: ${workflow.name}`,
        description: workflow.description,
        mimeType: 'application/json',
      });
    }

    return { resources };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    // Parse URI
    const url = new URL(uri);
    const path = url.pathname;

    let content: any;

    if (uri === 'team://config') {
      content = await teamManager.getConfig();
    } else if (uri === 'team://agents') {
      content = { agents: await teamManager.listAgents() };
    } else if (uri === 'team://workflows') {
      content = { workflows: await teamManager.listWorkflows() };
    } else if (path.startsWith('//agents/')) {
      const role = path.replace('//agents/', '');
      const agent = await teamManager.getAgent(role);
      if (!agent) {
        throw new Error(`Agent '${role}' not found`);
      }
      const prompt = await teamManager.getAgentPrompt(role);
      content = { ...agent, prompt };
    } else if (path.startsWith('//workflows/')) {
      const workflowId = path.replace('//workflows/', '');
      const workflow = await teamManager.getWorkflow(workflowId);
      if (!workflow) {
        throw new Error(`Workflow '${workflowId}' not found`);
      }
      content = workflow;
    } else {
      throw new Error(`Unknown resource: ${uri}`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(content, null, 2),
        },
      ],
    };
  });

  // ============================================
  // Prompts Registration
  // ============================================

  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: 'pm-analyze',
          description: 'PM agent prompt for analyzing a task',
          arguments: [
            {
              name: 'task',
              description: 'Task to analyze',
              required: true,
            },
          ],
        },
        {
          name: 'pm-plan',
          description: 'PM agent prompt for creating an execution plan',
          arguments: [
            {
              name: 'task',
              description: 'Task to plan',
              required: true,
            },
            {
              name: 'workflow',
              description: 'Workflow to use',
              required: false,
            },
          ],
        },
        {
          name: 'agent-context',
          description: 'Context prompt for spawning an agent',
          arguments: [
            {
              name: 'role',
              description: 'Agent role',
              required: true,
            },
            {
              name: 'task',
              description: 'Task description',
              required: true,
            },
            {
              name: 'previousOutput',
              description: 'Output from previous stage',
              required: false,
            },
          ],
        },
      ],
    };
  });

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const config = await teamManager.getConfig();

    switch (name) {
      case 'pm-analyze': {
        const task = args?.task || 'No task specified';
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `# Task Analysis Request

## Project
- Name: ${config.projectName || 'Not set'}
- Goal: ${config.projectGoal || 'Not set'}

## Available Agents
${config.agents.filter(a => a.enabled).map(a => `- ${a.name} (${a.role}): ${a.description}`).join('\n')}

## Available Workflows
${config.workflows.map(w => `- ${w.name} (${w.id}): ${w.description}`).join('\n')}

## Task to Analyze
${task}

Please analyze this task and provide:
1. Task decomposition
2. Recommended workflow
3. Agent assignments
4. Dependencies between subtasks
5. Estimated complexity`,
              },
            },
          ],
        };
      }

      case 'pm-plan': {
        const task = args?.task || 'No task specified';
        const workflow = args?.workflow;

        let workflowInfo = '';
        if (workflow) {
          const wf = await teamManager.getWorkflow(workflow);
          if (wf) {
            workflowInfo = `\n## Selected Workflow: ${wf.name}\n${wf.stages.map(s => `- ${s.name}: ${s.agent}`).join('\n')}`;
          }
        }

        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `# Execution Plan Request

## Project
- Name: ${config.projectName || 'Not set'}
- Goal: ${config.projectGoal || 'Not set'}
- Tech Stack: ${config.techStack?.join(', ') || 'Not specified'}
- Constraints: ${config.constraints?.join(', ') || 'None'}
${workflowInfo}

## Task
${task}

Please create a detailed execution plan:
1. Step-by-step actions
2. Agent for each step
3. Expected outputs
4. Checkpoints for recovery
5. Success criteria`,
              },
            },
          ],
        };
      }

      case 'agent-context': {
        const role = args?.role as string;
        const task = args?.task || 'No task specified';
        const previousOutput = args?.previousOutput || '';

        const agent = await teamManager.getAgent(role);
        const prompt = agent ? await teamManager.getAgentPrompt(role) : null;

        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `# Agent Context

## Project
- Name: ${config.projectName || 'Not set'}
- Goal: ${config.projectGoal || 'Not set'}

## Your Role
${agent?.name || role}
${agent?.description || ''}

## System Prompt
${prompt || 'No system prompt configured'}

## Your Task
${task}

${previousOutput ? `## Previous Stage Output\n${previousOutput}` : ''}

Please complete this task according to your role and expertise.`,
              },
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  });

  // ============================================
  // Server Startup
  // ============================================

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`[${SERVER_NAME}] Server started successfully`);
  console.error(`[${SERVER_NAME}] Registered ${allToolDefinitions.length} tools`);
}

main().catch((error) => {
  console.error(`[${SERVER_NAME}] Fatal error:`, error);
  process.exit(1);
});
