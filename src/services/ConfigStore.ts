/**
 * ConfigStore - Team configuration persistence
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import YAML from 'yaml';
import { TeamConfig, AgentConfig, WorkflowConfig, MonitorConfig } from '../types/index.js';

export const TEAM_CONFIG_DIR = '.claude/team';
export const CONFIG_FILE = 'config.yaml';
export const AGENTS_FILE = 'agents.yaml';

export class ConfigStore {
  private projectPath: string;
  private configPath: string;

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath;
    this.configPath = path.join(projectPath, TEAM_CONFIG_DIR);
  }

  /**
   * Check if team is initialized
   */
  async isInitialized(): Promise<boolean> {
    try {
      await fs.access(path.join(this.configPath, CONFIG_FILE));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the team config directory path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Load team configuration
   */
  async loadConfig(): Promise<TeamConfig | null> {
    try {
      const configFile = path.join(this.configPath, CONFIG_FILE);
      const content = await fs.readFile(configFile, 'utf-8');
      const config = YAML.parse(content) as TeamConfig;

      // Load agents if separate file exists
      const agentsFile = path.join(this.configPath, AGENTS_FILE);
      try {
        const agentsContent = await fs.readFile(agentsFile, 'utf-8');
        const agentsData = YAML.parse(agentsContent);
        config.agents = this.parseAgents(agentsData);
      } catch {
        // Agents might be inline in config
      }

      // Load workflows
      config.workflows = await this.loadWorkflows();

      return config;
    } catch {
      return null;
    }
  }

  /**
   * Save team configuration
   */
  async saveConfig(config: TeamConfig): Promise<void> {
    // Ensure directory exists
    await fs.mkdir(this.configPath, { recursive: true });

    // Save main config
    const configFile = path.join(this.configPath, CONFIG_FILE);
    const configData = {
      initialized: config.initialized,
      template: config.template,
      projectName: config.projectName,
      projectPath: config.projectPath,
      projectGoal: config.projectGoal,
      context: config.context,
      constraints: config.constraints,
      techStack: config.techStack,
      monitors: config.monitors,
    };
    await fs.writeFile(configFile, YAML.stringify(configData), 'utf-8');

    // Save agents separately
    if (config.agents.length > 0) {
      await this.saveAgents(config.agents);
    }
  }

  /**
   * Save agents configuration
   */
  async saveAgents(agents: AgentConfig[]): Promise<void> {
    const agentsFile = path.join(this.configPath, AGENTS_FILE);
    const agentsData = {
      version: '1.0',
      agents: agents.reduce((acc, agent) => {
        acc[agent.role] = {
          name: agent.name,
          type: agent.type,
          description: agent.description,
          enabled: agent.enabled,
          prompt: agent.promptPath,
          expertise: agent.expertise,
          tools: agent.tools,
          outputs: agent.outputs,
          canSpawn: agent.canSpawn,
        };
        return acc;
      }, {} as Record<string, any>),
    };
    await fs.writeFile(agentsFile, YAML.stringify(agentsData), 'utf-8');
  }

  /**
   * Load workflows from directory
   */
  async loadWorkflows(): Promise<WorkflowConfig[]> {
    const workflowsDir = path.join(this.configPath, 'workflows');
    const workflows: WorkflowConfig[] = [];

    try {
      const files = await fs.readdir(workflowsDir);
      for (const file of files) {
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          const content = await fs.readFile(path.join(workflowsDir, file), 'utf-8');
          const workflow = YAML.parse(content) as WorkflowConfig;
          workflows.push(workflow);
        }
      }
    } catch {
      // Workflows directory might not exist
    }

    return workflows;
  }

  /**
   * Save a workflow
   */
  async saveWorkflow(workflow: WorkflowConfig): Promise<void> {
    const workflowsDir = path.join(this.configPath, 'workflows');
    await fs.mkdir(workflowsDir, { recursive: true });

    const workflowFile = path.join(workflowsDir, `${workflow.id}.yaml`);
    await fs.writeFile(workflowFile, YAML.stringify(workflow), 'utf-8');
  }

  /**
   * Save a prompt file
   */
  async savePrompt(role: string, content: string): Promise<string> {
    const promptsDir = path.join(this.configPath, 'prompts');
    await fs.mkdir(promptsDir, { recursive: true });

    const promptFile = path.join(promptsDir, `${role}.md`);
    await fs.writeFile(promptFile, content, 'utf-8');

    return `prompts/${role}.md`;
  }

  /**
   * Load a prompt file
   */
  async loadPrompt(promptPath: string): Promise<string | null> {
    try {
      const fullPath = path.join(this.configPath, promptPath);
      return await fs.readFile(fullPath, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Update project goal and context
   */
  async updateGoal(
    goal: string,
    context?: string,
    constraints?: string[],
    techStack?: string[]
  ): Promise<void> {
    const config = await this.loadConfig();
    if (!config) {
      throw new Error('Team not initialized');
    }

    config.projectGoal = goal;
    if (context !== undefined) config.context = context;
    if (constraints !== undefined) config.constraints = constraints;
    if (techStack !== undefined) config.techStack = techStack;

    await this.saveConfig(config);
  }

  /**
   * Add or update a monitor
   */
  async updateMonitor(monitor: MonitorConfig): Promise<void> {
    const config = await this.loadConfig();
    if (!config) {
      throw new Error('Team not initialized');
    }

    const existingIndex = config.monitors.findIndex(m => m.id === monitor.id);
    if (existingIndex >= 0) {
      config.monitors[existingIndex] = monitor;
    } else {
      config.monitors.push(monitor);
    }

    await this.saveConfig(config);
  }

  /**
   * Parse agents from YAML structure
   */
  private parseAgents(data: any): AgentConfig[] {
    if (!data?.agents) return [];

    return Object.entries(data.agents).map(([role, config]: [string, any]) => ({
      role,
      name: config.name || role,
      type: config.type || 'general-purpose',
      description: config.description || '',
      enabled: config.enabled !== false,
      promptPath: config.prompt || `prompts/${role}.md`,
      expertise: config.expertise || [],
      tools: config.tools || [],
      outputs: config.outputs || [],
      canSpawn: config.canSpawn || [],
    }));
  }

  /**
   * Copy directory recursively
   */
  async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }
}
