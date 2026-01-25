/**
 * Template Registry Service
 *
 * Manages remote template discovery, download, and caching
 */

import * as fs from 'fs';
import * as path from 'path';
import { TeamTemplate } from '../types/index.js';

// Registry index format
export interface RegistryIndex {
  version: string;
  updated: string;
  templates: RegistryTemplateEntry[];
}

export interface RegistryTemplateEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  tags: string[];
  downloadUrl: string;
  checksum?: string;
  size?: number;
  downloads?: number;
  rating?: number;
}

export interface RegistryConfig {
  url: string;
  name: string;
  enabled: boolean;
  priority?: number;
}

export interface TemplateSearchOptions {
  query?: string;
  category?: string;
  tags?: string[];
  author?: string;
  sortBy?: 'name' | 'downloads' | 'rating' | 'updated';
  limit?: number;
}

export interface DownloadResult {
  success: boolean;
  templateId: string;
  path?: string;
  error?: string;
}

export class TemplateRegistry {
  private registries: Map<string, RegistryConfig> = new Map();
  private cache: Map<string, RegistryIndex> = new Map();
  private cacheDir: string;
  private cacheTTL: number = 3600000; // 1 hour
  private lastFetch: Map<string, number> = new Map();

  // Default registries
  private static readonly DEFAULT_REGISTRIES: RegistryConfig[] = [
    {
      url: 'https://raw.githubusercontent.com/tomtomjskim/team-orchestrator-mcp/main/registry/index.json',
      name: 'official',
      enabled: true,
      priority: 1,
    },
  ];

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || path.join(process.cwd(), '.team-orchestrator', 'templates');
    this.initDefaultRegistries();
  }

  private initDefaultRegistries(): void {
    for (const registry of TemplateRegistry.DEFAULT_REGISTRIES) {
      this.registries.set(registry.name, registry);
    }
  }

  /**
   * Add a custom registry
   */
  addRegistry(config: RegistryConfig): void {
    this.registries.set(config.name, config);
  }

  /**
   * Remove a registry
   */
  removeRegistry(name: string): boolean {
    return this.registries.delete(name);
  }

  /**
   * List all configured registries
   */
  listRegistries(): RegistryConfig[] {
    return Array.from(this.registries.values())
      .sort((a, b) => (a.priority || 99) - (b.priority || 99));
  }

  /**
   * Fetch registry index
   */
  async fetchIndex(registryName?: string): Promise<RegistryIndex[]> {
    const indices: RegistryIndex[] = [];
    const registriesToFetch = registryName
      ? [this.registries.get(registryName)].filter(Boolean) as RegistryConfig[]
      : this.listRegistries().filter(r => r.enabled);

    for (const registry of registriesToFetch) {
      try {
        // Check cache
        const lastFetch = this.lastFetch.get(registry.name) || 0;
        if (Date.now() - lastFetch < this.cacheTTL && this.cache.has(registry.name)) {
          indices.push(this.cache.get(registry.name)!);
          continue;
        }

        // Fetch from remote
        const index = await this.fetchRemoteIndex(registry);
        if (index) {
          this.cache.set(registry.name, index);
          this.lastFetch.set(registry.name, Date.now());
          indices.push(index);
        }
      } catch (error) {
        console.error(`[TemplateRegistry] Failed to fetch ${registry.name}:`, error);
      }
    }

    return indices;
  }

  private async fetchRemoteIndex(registry: RegistryConfig): Promise<RegistryIndex | null> {
    try {
      const response = await fetch(registry.url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'team-orchestrator-mcp/0.2.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const index = await response.json() as RegistryIndex;
      return index;
    } catch (error) {
      console.error(`[TemplateRegistry] Fetch error for ${registry.name}:`, error);
      return null;
    }
  }

  /**
   * Search templates across all registries
   */
  async searchTemplates(options: TemplateSearchOptions = {}): Promise<RegistryTemplateEntry[]> {
    const indices = await this.fetchIndex();
    let results: RegistryTemplateEntry[] = [];

    for (const index of indices) {
      results = results.concat(index.templates);
    }

    // Apply filters
    if (options.query) {
      const query = options.query.toLowerCase();
      results = results.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.id.toLowerCase().includes(query)
      );
    }

    if (options.category) {
      results = results.filter(t => t.category === options.category);
    }

    if (options.tags && options.tags.length > 0) {
      results = results.filter(t =>
        options.tags!.some(tag => t.tags.includes(tag))
      );
    }

    if (options.author) {
      results = results.filter(t => t.author === options.author);
    }

    // Sort
    if (options.sortBy) {
      results.sort((a, b) => {
        switch (options.sortBy) {
          case 'name':
            return a.name.localeCompare(b.name);
          case 'downloads':
            return (b.downloads || 0) - (a.downloads || 0);
          case 'rating':
            return (b.rating || 0) - (a.rating || 0);
          default:
            return 0;
        }
      });
    }

    // Limit
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Get template details
   */
  async getTemplateInfo(templateId: string): Promise<RegistryTemplateEntry | null> {
    const indices = await this.fetchIndex();

    for (const index of indices) {
      const template = index.templates.find(t => t.id === templateId);
      if (template) {
        return template;
      }
    }

    return null;
  }

  /**
   * Download a template from registry
   */
  async downloadTemplate(templateId: string, targetDir?: string): Promise<DownloadResult> {
    const template = await this.getTemplateInfo(templateId);

    if (!template) {
      return {
        success: false,
        templateId,
        error: `Template not found: ${templateId}`,
      };
    }

    const downloadDir = targetDir || path.join(this.cacheDir, templateId);

    try {
      // Create directory
      if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
      }

      // Download template archive
      const response = await fetch(template.downloadUrl, {
        headers: {
          'User-Agent': 'team-orchestrator-mcp/0.2.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        // Single JSON file (for simple templates)
        const data = await response.text();
        fs.writeFileSync(path.join(downloadDir, 'template.json'), data);
      } else if (contentType.includes('application/zip') || contentType.includes('application/x-tar')) {
        // Archive file - needs extraction
        const buffer = await response.arrayBuffer();
        const archivePath = path.join(downloadDir, `${templateId}.zip`);
        fs.writeFileSync(archivePath, Buffer.from(buffer));

        // Note: In production, we'd extract the archive here
        // For now, we just save the archive
      } else {
        // Assume it's a directory listing or manifest
        const data = await response.text();
        fs.writeFileSync(path.join(downloadDir, 'manifest.txt'), data);
      }

      // Create metadata file
      const metadata = {
        id: template.id,
        name: template.name,
        version: template.version,
        downloadedAt: new Date().toISOString(),
        source: template.downloadUrl,
      };
      fs.writeFileSync(
        path.join(downloadDir, '.template-meta.json'),
        JSON.stringify(metadata, null, 2)
      );

      return {
        success: true,
        templateId,
        path: downloadDir,
      };
    } catch (error) {
      return {
        success: false,
        templateId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if a template is cached locally
   */
  isTemplateCached(templateId: string): boolean {
    const templateDir = path.join(this.cacheDir, templateId);
    const metaPath = path.join(templateDir, '.template-meta.json');
    return fs.existsSync(metaPath);
  }

  /**
   * Get cached template path
   */
  getCachedTemplatePath(templateId: string): string | null {
    const templateDir = path.join(this.cacheDir, templateId);
    if (this.isTemplateCached(templateId)) {
      return templateDir;
    }
    return null;
  }

  /**
   * List cached templates
   */
  listCachedTemplates(): Array<{ id: string; name: string; version: string; downloadedAt: string }> {
    const cached: Array<{ id: string; name: string; version: string; downloadedAt: string }> = [];

    if (!fs.existsSync(this.cacheDir)) {
      return cached;
    }

    const dirs = fs.readdirSync(this.cacheDir, { withFileTypes: true });

    for (const dir of dirs) {
      if (dir.isDirectory()) {
        const metaPath = path.join(this.cacheDir, dir.name, '.template-meta.json');
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            cached.push({
              id: meta.id,
              name: meta.name,
              version: meta.version,
              downloadedAt: meta.downloadedAt,
            });
          } catch {
            // Skip invalid metadata
          }
        }
      }
    }

    return cached;
  }

  /**
   * Clear cached templates
   */
  clearCache(templateId?: string): void {
    if (templateId) {
      const templateDir = path.join(this.cacheDir, templateId);
      if (fs.existsSync(templateDir)) {
        fs.rmSync(templateDir, { recursive: true });
      }
    } else {
      if (fs.existsSync(this.cacheDir)) {
        fs.rmSync(this.cacheDir, { recursive: true });
      }
    }

    // Also clear memory cache
    if (templateId) {
      this.cache.delete(templateId);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get categories from all templates
   */
  async getCategories(): Promise<string[]> {
    const indices = await this.fetchIndex();
    const categories = new Set<string>();

    for (const index of indices) {
      for (const template of index.templates) {
        categories.add(template.category);
      }
    }

    return Array.from(categories).sort();
  }

  /**
   * Get all tags from all templates
   */
  async getTags(): Promise<string[]> {
    const indices = await this.fetchIndex();
    const tags = new Set<string>();

    for (const index of indices) {
      for (const template of index.templates) {
        template.tags.forEach(tag => tags.add(tag));
      }
    }

    return Array.from(tags).sort();
  }
}
