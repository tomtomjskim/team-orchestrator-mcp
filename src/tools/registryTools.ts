/**
 * Registry MCP Tools
 *
 * Tools for template registry operations
 */

import { z } from 'zod';
import {
  TemplateRegistry,
  RegistryConfig,
  TemplateSearchOptions,
} from '../services/TemplateRegistry.js';

// Singleton registry instance
let registryInstance: TemplateRegistry | null = null;

function getRegistry(): TemplateRegistry {
  if (!registryInstance) {
    registryInstance = new TemplateRegistry();
  }
  return registryInstance;
}

// Tool definitions
export const registryToolDefinitions = [
  {
    name: 'registry_search',
    description: '템플릿 레지스트리에서 템플릿 검색',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: '검색어 (이름, 설명에서 검색)',
        },
        category: {
          type: 'string',
          description: '카테고리 필터 (development, design, data, devops, content)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: '태그 필터',
        },
        sortBy: {
          type: 'string',
          enum: ['name', 'downloads', 'rating'],
          description: '정렬 기준',
        },
        limit: {
          type: 'number',
          description: '결과 제한 (기본: 20)',
        },
      },
    },
  },
  {
    name: 'registry_info',
    description: '특정 템플릿의 상세 정보 조회',
    inputSchema: {
      type: 'object' as const,
      properties: {
        templateId: {
          type: 'string',
          description: '템플릿 ID',
        },
      },
      required: ['templateId'],
    },
  },
  {
    name: 'registry_download',
    description: '레지스트리에서 템플릿 다운로드',
    inputSchema: {
      type: 'object' as const,
      properties: {
        templateId: {
          type: 'string',
          description: '다운로드할 템플릿 ID',
        },
        targetDir: {
          type: 'string',
          description: '다운로드 대상 디렉토리 (선택)',
        },
      },
      required: ['templateId'],
    },
  },
  {
    name: 'registry_list',
    description: '등록된 레지스트리 목록 조회',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'registry_add',
    description: '커스텀 레지스트리 추가',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: '레지스트리 이름',
        },
        url: {
          type: 'string',
          description: '레지스트리 인덱스 URL',
        },
        priority: {
          type: 'number',
          description: '우선순위 (낮을수록 높음)',
        },
      },
      required: ['name', 'url'],
    },
  },
  {
    name: 'registry_remove',
    description: '레지스트리 제거',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: '제거할 레지스트리 이름',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'registry_cached',
    description: '로컬에 캐시된 템플릿 목록 조회',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'registry_clear_cache',
    description: '캐시된 템플릿 삭제',
    inputSchema: {
      type: 'object' as const,
      properties: {
        templateId: {
          type: 'string',
          description: '삭제할 템플릿 ID (미지정 시 전체 삭제)',
        },
      },
    },
  },
  {
    name: 'registry_categories',
    description: '사용 가능한 카테고리 목록 조회',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'registry_tags',
    description: '사용 가능한 태그 목록 조회',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
];

// Tool handlers
export async function handleRegistryTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<any> {
  const registry = getRegistry();

  switch (toolName) {
    case 'registry_search': {
      const options: TemplateSearchOptions = {
        query: args.query as string | undefined,
        category: args.category as string | undefined,
        tags: args.tags as string[] | undefined,
        sortBy: args.sortBy as 'name' | 'downloads' | 'rating' | undefined,
        limit: (args.limit as number) || 20,
      };

      const results = await registry.searchTemplates(options);

      return {
        count: results.length,
        templates: results.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          version: t.version,
          author: t.author,
          category: t.category,
          tags: t.tags,
          downloads: t.downloads,
          rating: t.rating,
        })),
      };
    }

    case 'registry_info': {
      const templateId = args.templateId as string;
      const template = await registry.getTemplateInfo(templateId);

      if (!template) {
        return {
          success: false,
          error: `Template not found: ${templateId}`,
        };
      }

      return {
        success: true,
        template: {
          ...template,
          cached: registry.isTemplateCached(templateId),
          cachedPath: registry.getCachedTemplatePath(templateId),
        },
      };
    }

    case 'registry_download': {
      const templateId = args.templateId as string;
      const targetDir = args.targetDir as string | undefined;

      const result = await registry.downloadTemplate(templateId, targetDir);

      return result;
    }

    case 'registry_list': {
      const registries = registry.listRegistries();

      return {
        count: registries.length,
        registries: registries.map(r => ({
          name: r.name,
          url: r.url,
          enabled: r.enabled,
          priority: r.priority,
        })),
      };
    }

    case 'registry_add': {
      const config: RegistryConfig = {
        name: args.name as string,
        url: args.url as string,
        enabled: true,
        priority: (args.priority as number) || 10,
      };

      registry.addRegistry(config);

      return {
        success: true,
        message: `Registry added: ${config.name}`,
        registry: config,
      };
    }

    case 'registry_remove': {
      const name = args.name as string;

      if (name === 'official') {
        return {
          success: false,
          error: 'Cannot remove official registry',
        };
      }

      const removed = registry.removeRegistry(name);

      return {
        success: removed,
        message: removed ? `Registry removed: ${name}` : `Registry not found: ${name}`,
      };
    }

    case 'registry_cached': {
      const cached = registry.listCachedTemplates();

      return {
        count: cached.length,
        templates: cached,
      };
    }

    case 'registry_clear_cache': {
      const templateId = args.templateId as string | undefined;

      registry.clearCache(templateId);

      return {
        success: true,
        message: templateId
          ? `Cache cleared for: ${templateId}`
          : 'All cache cleared',
      };
    }

    case 'registry_categories': {
      const categories = await registry.getCategories();

      return {
        count: categories.length,
        categories,
      };
    }

    case 'registry_tags': {
      const tags = await registry.getTags();

      return {
        count: tags.length,
        tags,
      };
    }

    default:
      throw new Error(`Unknown registry tool: ${toolName}`);
  }
}
