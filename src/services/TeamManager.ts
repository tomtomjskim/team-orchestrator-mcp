/**
 * TeamManager - Core team orchestration management
 */

import * as path from 'path';
import { ConfigStore, TEAM_CONFIG_DIR } from './ConfigStore.js';
import { TemplateLoader, LoadedTemplate } from './TemplateLoader.js';
import {
  TeamConfig,
  TeamTemplate,
  AgentConfig,
  WorkflowConfig,
  MonitorConfig,
  TeamListTemplatesInput,
  TeamListTemplatesOutput,
  TeamInitInput,
  TeamInitOutput,
} from '../types/index.js';

export interface TeamGetConfigOutput {
  initialized: boolean;
  template?: string;
  projectName?: string;
  projectPath?: string;
  projectGoal?: string;
  context?: string;
  constraints?: string[];
  techStack?: string[];
  agents: AgentConfig[];
  workflows: Array<{
    id: string;
    name: string;
    description: string;
    stages: number;
  }>;
  monitors: MonitorConfig[];
}

export interface TeamSetGoalInput {
  goal: string;
  context?: string;
  constraints?: string[];
  techStack?: string[];
}

export interface TeamSetGoalOutput {
  success: boolean;
  updatedConfig: {
    goal: string;
    context?: string;
    constraints: string[];
    techStack: string[];
  };
}

export class TeamManager {
  private configStore: ConfigStore;
  private templateLoader: TemplateLoader;

  constructor(projectPath?: string) {
    this.configStore = new ConfigStore(projectPath);
    this.templateLoader = new TemplateLoader();
  }

  /**
   * List available templates
   */
  async listTemplates(input: TeamListTemplatesInput = {}): Promise<TeamListTemplatesOutput> {
    const source = input.source === 'local' ? 'local' :
                   input.source === 'registry' ? 'builtin' : 'all';

    let templates = await this.templateLoader.listTemplates(source);

    // Filter by tags if provided
    if (input.tags && input.tags.length > 0) {
      templates = templates.filter(t =>
        input.tags!.some(tag => t.tags.includes(tag))
      );
    }

    return { templates };
  }

  /**
   * Initialize team from template
   */
  async initTeam(input: TeamInitInput): Promise<TeamInitOutput> {
    const projectPath = input.projectPath || process.cwd();

    // Load template
    const template = await this.templateLoader.loadTemplate(input.template);
    if (!template) {
      throw new Error(`Template '${input.template}' not found`);
    }

    // Validate template
    const validation = this.templateLoader.validateTemplate(template);
    if (!validation.valid) {
      throw new Error(`Invalid template: ${validation.errors.join(', ')}`);
    }

    // Apply customizations
    let agents = [...template.agents];
    if (input.customizations?.agents) {
      for (const customization of input.customizations.agents) {
        const agentIndex = agents.findIndex(a => a.role === customization.role);
        if (agentIndex >= 0) {
          if (customization.enabled !== undefined) {
            agents[agentIndex].enabled = customization.enabled;
          }
          if (customization.promptOverride) {
            // Will save custom prompt later
            agents[agentIndex].promptPath = `prompts/${customization.role}.md`;
          }
        }
      }
    }

    // Filter workflows if specified
    let workflows = [...template.workflows];
    if (input.customizations?.workflows && input.customizations.workflows.length > 0) {
      workflows = workflows.filter(w =>
        input.customizations!.workflows!.includes(w.id)
      );
    }

    // Create config
    const config: TeamConfig = {
      initialized: true,
      template: input.template,
      projectName: input.projectName || path.basename(projectPath),
      projectPath,
      agents,
      workflows,
      monitors: [],
    };

    // Update ConfigStore with new project path
    const store = new ConfigStore(projectPath);

    // Save config
    await store.saveConfig(config);

    // Save workflows
    for (const workflow of workflows) {
      await store.saveWorkflow(workflow);
    }

    // Save prompts
    for (const agent of agents) {
      const promptContent = template.prompts.get(agent.role);
      if (promptContent) {
        await store.savePrompt(agent.role, promptContent);
      }
    }

    // Save custom prompt overrides
    if (input.customizations?.agents) {
      for (const customization of input.customizations.agents) {
        if (customization.promptOverride) {
          await store.savePrompt(customization.role, customization.promptOverride);
        }
      }
    }

    return {
      success: true,
      teamConfigPath: path.join(projectPath, TEAM_CONFIG_DIR),
      agents: agents.filter(a => a.enabled).map(a => a.role),
      workflows: workflows.map(w => w.id),
    };
  }

  /**
   * Get current team configuration
   */
  async getConfig(): Promise<TeamGetConfigOutput> {
    const config = await this.configStore.loadConfig();

    if (!config || !config.initialized) {
      return {
        initialized: false,
        agents: [],
        workflows: [],
        monitors: [],
      };
    }

    return {
      initialized: true,
      template: config.template,
      projectName: config.projectName,
      projectPath: config.projectPath,
      projectGoal: config.projectGoal,
      context: config.context,
      constraints: config.constraints,
      techStack: config.techStack,
      agents: config.agents,
      workflows: config.workflows.map(w => ({
        id: w.id,
        name: w.name,
        description: w.description,
        stages: w.stages.length,
      })),
      monitors: config.monitors,
    };
  }

  /**
   * Set project goal
   */
  async setGoal(input: TeamSetGoalInput): Promise<TeamSetGoalOutput> {
    await this.configStore.updateGoal(
      input.goal,
      input.context,
      input.constraints,
      input.techStack
    );

    return {
      success: true,
      updatedConfig: {
        goal: input.goal,
        context: input.context,
        constraints: input.constraints || [],
        techStack: input.techStack || [],
      },
    };
  }

  /**
   * Check if team is initialized
   */
  async isInitialized(): Promise<boolean> {
    return this.configStore.isInitialized();
  }

  /**
   * Get agent by role
   */
  async getAgent(role: string): Promise<AgentConfig | null> {
    const config = await this.configStore.loadConfig();
    if (!config) return null;
    return config.agents.find(a => a.role === role) || null;
  }

  /**
   * Get agent prompt
   */
  async getAgentPrompt(role: string): Promise<string | null> {
    const agent = await this.getAgent(role);
    if (!agent) return null;
    return this.configStore.loadPrompt(agent.promptPath);
  }

  /**
   * List all agents
   */
  async listAgents(filter?: { type?: string; enabled?: boolean }): Promise<AgentConfig[]> {
    const config = await this.configStore.loadConfig();
    if (!config) return [];

    let agents = config.agents;

    if (filter?.type !== undefined) {
      agents = agents.filter(a => a.type === filter.type);
    }
    if (filter?.enabled !== undefined) {
      agents = agents.filter(a => a.enabled === filter.enabled);
    }

    return agents;
  }

  /**
   * Add a new agent
   */
  async addAgent(agent: AgentConfig, prompt?: string): Promise<{ success: boolean; agentId: string; promptPath: string }> {
    const config = await this.configStore.loadConfig();
    if (!config) {
      throw new Error('Team not initialized');
    }

    // Check for duplicate role
    if (config.agents.some(a => a.role === agent.role)) {
      throw new Error(`Agent with role '${agent.role}' already exists`);
    }

    // Set default prompt path
    agent.promptPath = agent.promptPath || `prompts/${agent.role}.md`;

    // Add agent
    config.agents.push(agent);
    await this.configStore.saveConfig(config);

    // Save prompt if provided
    if (prompt) {
      await this.configStore.savePrompt(agent.role, prompt);
    }

    return {
      success: true,
      agentId: agent.role,
      promptPath: agent.promptPath,
    };
  }

  /**
   * Modify an existing agent
   */
  async modifyAgent(
    role: string,
    updates: Partial<Omit<AgentConfig, 'role'>>
  ): Promise<{ success: boolean; agent: AgentConfig }> {
    const config = await this.configStore.loadConfig();
    if (!config) {
      throw new Error('Team not initialized');
    }

    const agentIndex = config.agents.findIndex(a => a.role === role);
    if (agentIndex < 0) {
      throw new Error(`Agent '${role}' not found`);
    }

    // Apply updates
    const agent = config.agents[agentIndex];
    if (updates.name !== undefined) agent.name = updates.name;
    if (updates.type !== undefined) agent.type = updates.type;
    if (updates.description !== undefined) agent.description = updates.description;
    if (updates.enabled !== undefined) agent.enabled = updates.enabled;
    if (updates.expertise !== undefined) agent.expertise = updates.expertise;
    if (updates.tools !== undefined) agent.tools = updates.tools;
    if (updates.outputs !== undefined) agent.outputs = updates.outputs;
    if (updates.canSpawn !== undefined) agent.canSpawn = updates.canSpawn;

    config.agents[agentIndex] = agent;
    await this.configStore.saveConfig(config);

    return {
      success: true,
      agent,
    };
  }

  /**
   * Get workflow by ID
   */
  async getWorkflow(workflowId: string): Promise<WorkflowConfig | null> {
    const config = await this.configStore.loadConfig();
    if (!config) return null;
    return config.workflows.find(w => w.id === workflowId) || null;
  }

  /**
   * List all workflows
   */
  async listWorkflows(): Promise<WorkflowConfig[]> {
    const config = await this.configStore.loadConfig();
    if (!config) return [];
    return config.workflows;
  }

  /**
   * Register a monitor
   */
  async registerMonitor(monitor: MonitorConfig): Promise<{ success: boolean; monitorId: string }> {
    await this.configStore.updateMonitor(monitor);
    return {
      success: true,
      monitorId: monitor.id,
    };
  }

  /**
   * Get monitors
   */
  async getMonitors(): Promise<MonitorConfig[]> {
    const config = await this.configStore.loadConfig();
    if (!config) return [];
    return config.monitors;
  }
}
