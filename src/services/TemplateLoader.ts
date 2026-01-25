/**
 * TemplateLoader - Load and validate team templates
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import { TeamTemplate, AgentConfig, WorkflowConfig } from '../types/index.js';

// Built-in templates location
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BUILTIN_TEMPLATES_DIR = path.join(__dirname, '../../templates');

export interface LoadedTemplate {
  meta: TeamTemplate;
  agents: AgentConfig[];
  workflows: WorkflowConfig[];
  prompts: Map<string, string>;
  templatePath: string;
}

export class TemplateLoader {
  private localTemplatesDir: string;
  private builtinTemplatesDir: string;

  constructor(localTemplatesDir?: string) {
    this.localTemplatesDir = localTemplatesDir || path.join(process.cwd(), '.claude/templates');
    this.builtinTemplatesDir = BUILTIN_TEMPLATES_DIR;
  }

  /**
   * List all available templates
   */
  async listTemplates(source: 'local' | 'builtin' | 'all' = 'all'): Promise<TeamTemplate[]> {
    const templates: TeamTemplate[] = [];

    // Load builtin templates
    if (source === 'builtin' || source === 'all') {
      try {
        const builtinTemplates = await this.loadTemplatesFromDir(this.builtinTemplatesDir);
        templates.push(...builtinTemplates);
      } catch {
        // Builtin templates might not exist yet
      }
    }

    // Load local templates
    if (source === 'local' || source === 'all') {
      try {
        const localTemplates = await this.loadTemplatesFromDir(this.localTemplatesDir);
        templates.push(...localTemplates);
      } catch {
        // Local templates directory might not exist
      }
    }

    return templates;
  }

  /**
   * Load templates from a directory
   */
  private async loadTemplatesFromDir(dir: string): Promise<TeamTemplate[]> {
    const templates: TeamTemplate[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          try {
            const metaPath = path.join(dir, entry.name, 'meta.yaml');
            const content = await fs.readFile(metaPath, 'utf-8');
            const meta = YAML.parse(content);

            templates.push({
              id: meta.id || entry.name,
              name: meta.name || entry.name,
              description: meta.description || '',
              version: meta.version || '1.0.0',
              author: meta.author,
              category: meta.category || 'custom',
              tags: meta.tags || [],
              agents: meta.agents || [],
              defaultWorkflow: meta.defaultWorkflow || 'standard',
              requirements: meta.requirements,
            });
          } catch {
            // Skip invalid templates
          }
        }
      }
    } catch {
      // Directory doesn't exist
    }

    return templates;
  }

  /**
   * Get a template by ID
   */
  async getTemplate(templateId: string): Promise<TeamTemplate | null> {
    const templates = await this.listTemplates('all');
    return templates.find(t => t.id === templateId) || null;
  }

  /**
   * Load a complete template
   */
  async loadTemplate(templateId: string): Promise<LoadedTemplate | null> {
    // Find template directory
    let templatePath: string | null = null;

    // Check builtin first
    const builtinPath = path.join(this.builtinTemplatesDir, templateId);
    try {
      await fs.access(builtinPath);
      templatePath = builtinPath;
    } catch {
      // Check local
      const localPath = path.join(this.localTemplatesDir, templateId);
      try {
        await fs.access(localPath);
        templatePath = localPath;
      } catch {
        return null;
      }
    }

    if (!templatePath) return null;

    // Load meta.yaml
    const metaPath = path.join(templatePath, 'meta.yaml');
    const metaContent = await fs.readFile(metaPath, 'utf-8');
    const meta = YAML.parse(metaContent) as TeamTemplate;

    // Load agents.yaml
    const agentsPath = path.join(templatePath, 'agents.yaml');
    let agents: AgentConfig[] = [];
    try {
      const agentsContent = await fs.readFile(agentsPath, 'utf-8');
      const agentsData = YAML.parse(agentsContent);
      agents = this.parseAgents(agentsData);
    } catch {
      // No agents file
    }

    // Load workflows
    const workflows = await this.loadWorkflows(templatePath);

    // Load prompts
    const prompts = await this.loadPrompts(templatePath);

    return {
      meta: {
        id: meta.id || templateId,
        name: meta.name || templateId,
        description: meta.description || '',
        version: meta.version || '1.0.0',
        author: meta.author,
        category: meta.category || 'custom',
        tags: meta.tags || [],
        agents: meta.agents || [],
        defaultWorkflow: meta.defaultWorkflow || 'standard',
        requirements: meta.requirements,
      },
      agents,
      workflows,
      prompts,
      templatePath,
    };
  }

  /**
   * Load workflows from template
   */
  private async loadWorkflows(templatePath: string): Promise<WorkflowConfig[]> {
    const workflowsDir = path.join(templatePath, 'workflows');
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
      // No workflows directory
    }

    return workflows;
  }

  /**
   * Load prompts from template
   */
  private async loadPrompts(templatePath: string): Promise<Map<string, string>> {
    const promptsDir = path.join(templatePath, 'prompts');
    const prompts = new Map<string, string>();

    try {
      const files = await fs.readdir(promptsDir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          const content = await fs.readFile(path.join(promptsDir, file), 'utf-8');
          const role = file.replace('.md', '');
          prompts.set(role, content);
        }
      }
    } catch {
      // No prompts directory
    }

    return prompts;
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
   * Validate a template
   */
  validateTemplate(template: LoadedTemplate): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!template.meta.id) errors.push('Template ID is required');
    if (!template.meta.name) errors.push('Template name is required');

    // Check agents
    if (template.agents.length === 0) {
      errors.push('At least one agent is required');
    }

    // Validate each agent
    for (const agent of template.agents) {
      if (!agent.role) errors.push(`Agent role is required`);
      if (!agent.type) errors.push(`Agent ${agent.role} type is required`);
    }

    // Check workflows
    if (template.workflows.length === 0) {
      errors.push('At least one workflow is required');
    }

    // Validate each workflow
    for (const workflow of template.workflows) {
      if (!workflow.id) errors.push('Workflow ID is required');
      if (!workflow.stages || workflow.stages.length === 0) {
        errors.push(`Workflow ${workflow.id} must have at least one stage`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
