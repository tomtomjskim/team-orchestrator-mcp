# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- Additional templates (design-team, content-team)
- Template registry support
- npm package publishing
- Community contributions
