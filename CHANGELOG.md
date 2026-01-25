# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-01-25

### Added

#### Task Event Tools (Agent Monitor 연동)
- `task_start` - 태스크 시작 이벤트 발행
- `task_progress` - 태스크 진행 상황 업데이트
- `task_complete` - 태스크 완료 처리
- `task_fail` - 태스크 실패 처리
- `task_list_active` - 활성 태스크 목록 조회
- `task_get` - 특정 태스크 상세 조회

#### New Services
- `TaskEventService` - 활성 태스크 관리 및 이벤트 발생 서비스
- MCP Webhook 채널을 통한 Agent Monitor 직접 연동 지원

#### Type Definitions
- `TaskStartPayload`, `TaskProgressPayload`, `TaskCompletePayload`, `TaskFailPayload`
- `ActiveTask`, `TaskListActiveOutput`, `TaskEventStatus`

---

## [0.2.0] - 2025-01-25

### Added

#### Additional Templates
- **design-team**: Design & UX team (6 agents, 2 workflows)
  - PM, Explorer, UI Designer, UX Researcher, Design System Engineer, Prototyper
  - Workflows: design-sprint, design-review
- **content-team**: Content & Marketing team (6 agents, 2 workflows)
  - PM, Explorer, Content Strategist, Writer, Editor, SEO Specialist
  - Workflows: content-creation, content-review

#### Template Registry
- Template registry service for remote template discovery
- Support for multiple registries with priority ordering
- Template search with filters (query, category, tags)
- Template download and local caching
- Cache management (list, clear)

#### Registry MCP Tools
- `registry_search` - Search templates across registries
- `registry_info` - Get detailed template information
- `registry_download` - Download template from registry
- `registry_list` - List configured registries
- `registry_add` - Add custom registry
- `registry_remove` - Remove registry
- `registry_cached` - List cached templates
- `registry_clear_cache` - Clear template cache
- `registry_categories` - List available categories
- `registry_tags` - List available tags

#### Registry Index
- Official registry index at `/registry/index.json`
- Contains all 6 templates with metadata

## [0.1.0] - 2025-01-25

### Added

#### Core Features
- MCP Server implementation with stdio transport
- Team management service (TeamManager)
- Configuration store (ConfigStore)
- Template loader (TemplateLoader)

#### Workflow Engine
- DAG-based workflow execution
- Topological sort for stage ordering
- Parallel stage execution support
- Checkpoint creation and recovery
- Workflow pause/resume/abort capabilities
- Event emission integration

#### Event Emitter
- Multi-channel event emission service
- Support for SSE, Webhook, File, OTLP, Prometheus
- Event buffering and filtering
- OpenTelemetry compatible event schema

#### MCP Tools
- **Team Management**: `team_list_templates`, `team_init`, `team_get_config`, `team_set_goal`
- **Agent Management**: `agent_list`, `agent_add`, `agent_modify`
- **Workflow Management**: `workflow_list`, `workflow_run`, `workflow_status`, `workflow_resume`, `workflow_abort`
- **Monitoring**: `monitor_register`, `monitor_emit`, `monitor_get_events`, `monitor_list_channels`, `monitor_unregister`

#### MCP Resources
- `team://config` - Current team configuration
- `team://agents` - Agent list
- `team://agents/{role}` - Specific agent details
- `team://workflows` - Workflow list
- `team://workflows/{id}` - Specific workflow details

#### MCP Prompts
- `pm-analyze` - PM task analysis prompt
- `pm-plan` - PM execution planning prompt
- `agent-context` - Agent spawn context prompt

#### Team Templates
- **web-dev**: Web development team (8 agents, 2 workflows)
  - PM, Explorer, Architect, Frontend, Backend, DevOps, QA, Documenter
  - Workflows: standard, quick-fix
- **general**: General purpose team (4 agents, 1 workflow)
  - PM, Explorer, Developer, Tester
  - Workflows: basic
- **data-team**: Data & ML team (6 agents, 1 workflow)
  - PM, Explorer, Data Engineer, ML Engineer, Analyst, DBA
  - Workflows: data-pipeline
- **devops-team**: DevOps & Infrastructure team (6 agents, 2 workflows)
  - PM, Explorer, Infra Engineer, CI/CD Engineer, Security Engineer, SRE
  - Workflows: infra-provision, incident-response

#### Monitoring Integration
- Agent Orchestra Monitor (SSE)
- Grafana (OTLP)
- Slack/Discord (Webhook)
- Prometheus (/metrics endpoint)
- File logging (JSON/JSONL)

### Documentation
- Project overview
- MCP interface design
- Event interface specification
- Template structure guide
- Extension ideas

## [Unreleased]

### Planned
- npm package publishing
- Community template contributions
- Template versioning and updates
