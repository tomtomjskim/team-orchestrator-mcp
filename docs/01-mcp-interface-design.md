# MCP Interface Design

Team Orchestrator MCP 서버의 도구 및 리소스 인터페이스 상세 설계

---

## MCP 서버 기본 정보

```typescript
// Server Metadata
{
  name: "team-orchestrator",
  version: "1.0.0",
  description: "Multi-agent team orchestration for Claude Code",
  capabilities: {
    tools: true,
    resources: true,
    prompts: true
  }
}
```

---

## Tools 상세 설계

### 1. Team Management Tools

#### `team_list_templates`
사용 가능한 팀 템플릿 목록 조회

```typescript
// Input
interface TeamListTemplatesInput {
  source?: 'local' | 'registry' | 'all';  // 기본: all
  tags?: string[];                         // 태그 필터
}

// Output
interface TeamListTemplatesOutput {
  templates: Array<{
    id: string;
    name: string;
    description: string;
    version: string;
    source: 'local' | 'registry';
    agents: string[];
    tags: string[];
  }>;
}

// Example
// Input: { tags: ["web"] }
// Output: {
//   templates: [
//     { id: "web-dev", name: "Web Development Team", ... },
//     { id: "web-design", name: "Web Design Team", ... }
//   ]
// }
```

#### `team_init`
프로젝트에 팀 설정 초기화

```typescript
// Input
interface TeamInitInput {
  template: string;              // 템플릿 ID
  projectPath?: string;          // 프로젝트 경로 (기본: 현재)
  projectName?: string;          // 프로젝트 이름
  customizations?: {
    agents?: AgentCustomization[];
    workflows?: string[];
  };
}

interface AgentCustomization {
  role: string;
  enabled?: boolean;
  promptOverride?: string;
}

// Output
interface TeamInitOutput {
  success: boolean;
  teamConfigPath: string;        // 생성된 설정 경로
  agents: string[];              // 초기화된 에이전트 목록
  workflows: string[];           // 사용 가능한 워크플로우
}

// Example
// Input: { template: "web-dev", projectName: "my-app" }
// Output: {
//   success: true,
//   teamConfigPath: ".claude/team/",
//   agents: ["pm", "frontend", "backend", "devops", "qa"],
//   workflows: ["standard", "quick-fix", "hotfix"]
// }
```

#### `team_get_config`
현재 팀 설정 조회

```typescript
// Input
interface TeamGetConfigInput {
  projectPath?: string;
}

// Output
interface TeamGetConfigOutput {
  initialized: boolean;
  template?: string;
  projectName?: string;
  projectGoal?: string;
  agents: AgentInfo[];
  workflows: WorkflowInfo[];
  monitors: MonitorConfig[];
}

interface AgentInfo {
  role: string;
  name: string;
  type: 'Explore' | 'Plan' | 'general-purpose' | 'Bash';
  enabled: boolean;
  promptPath: string;
}

interface WorkflowInfo {
  id: string;
  name: string;
  stages: number;
}

interface MonitorConfig {
  type: 'sse' | 'webhook' | 'file' | 'otlp';
  endpoint: string;
  enabled: boolean;
}
```

#### `team_set_goal`
프로젝트 목표 설정

```typescript
// Input
interface TeamSetGoalInput {
  goal: string;                  // 프로젝트 목표
  context?: string;              // 추가 컨텍스트
  constraints?: string[];        // 제약 조건
  techStack?: string[];          // 기술 스택
}

// Output
interface TeamSetGoalOutput {
  success: boolean;
  updatedConfig: {
    goal: string;
    context?: string;
    constraints: string[];
    techStack: string[];
  };
}

// Example
// Input: {
//   goal: "실시간 채팅 서비스 개발",
//   techStack: ["Next.js", "WebSocket", "PostgreSQL"],
//   constraints: ["모바일 반응형 필수", "3주 내 MVP"]
// }
```

#### `team_import` / `team_export`
팀 설정 가져오기/내보내기

```typescript
// Import Input
interface TeamImportInput {
  source: string;                // GitHub URL 또는 로컬 경로
  targetPath?: string;
}

// Export Input
interface TeamExportInput {
  format: 'yaml' | 'json' | 'tar';
  outputPath?: string;
  includePrompts: boolean;
}
```

---

### 2. Agent Management Tools

#### `agent_list`
팀 에이전트 목록 조회

```typescript
// Input
interface AgentListInput {
  includePrompts?: boolean;      // 프롬프트 내용 포함
  filter?: {
    type?: string;
    enabled?: boolean;
  };
}

// Output
interface AgentListOutput {
  agents: Array<{
    role: string;
    name: string;
    type: string;
    enabled: boolean;
    description: string;
    prompt?: string;             // includePrompts=true일 때
    tools: string[];             // 사용 가능 도구
  }>;
}
```

#### `agent_add`
커스텀 에이전트 추가

```typescript
// Input
interface AgentAddInput {
  role: string;                  // 역할 ID (예: "security-auditor")
  name: string;                  // 표시 이름
  type: 'Explore' | 'Plan' | 'general-purpose' | 'Bash';
  description: string;
  prompt: string;                // 시스템 프롬프트
  tools?: string[];              // 허용 도구
  outputs?: string[];            // 산출물 형식
}

// Output
interface AgentAddOutput {
  success: boolean;
  agentId: string;
  promptPath: string;
}

// Example
// Input: {
//   role: "security-auditor",
//   name: "Security Auditor",
//   type: "general-purpose",
//   description: "보안 취약점 분석 전문가",
//   prompt: "당신은 보안 전문가입니다..."
// }
```

#### `agent_modify`
에이전트 프롬프트 수정

```typescript
// Input
interface AgentModifyInput {
  role: string;
  updates: {
    name?: string;
    prompt?: string;
    enabled?: boolean;
    tools?: string[];
  };
}

// Output
interface AgentModifyOutput {
  success: boolean;
  agent: AgentInfo;
}
```

---

### 3. Workflow Management Tools

#### `workflow_list`
워크플로우 목록 조회

```typescript
// Output
interface WorkflowListOutput {
  workflows: Array<{
    id: string;
    name: string;
    description: string;
    stages: Array<{
      name: string;
      agent: string;
      dependsOn: string[];
    }>;
    estimatedAgents: number;
  }>;
}
```

#### `workflow_run`
워크플로우 실행 (핵심 도구)

```typescript
// Input
interface WorkflowRunInput {
  workflow?: string;             // 워크플로우 ID (기본: 자동 선택)
  task: string;                  // 수행할 태스크 설명
  options?: {
    dryRun?: boolean;            // 실제 실행 없이 계획만
    parallel?: boolean;          // 병렬 실행 허용
    checkpoints?: boolean;       // 체크포인트 활성화
    approvalRequired?: boolean;  // 승인 게이트 활성화
  };
}

// Output
interface WorkflowRunOutput {
  runId: string;                 // 실행 추적 ID
  workflow: string;
  status: 'started' | 'planning' | 'running' | 'completed' | 'failed';
  plan?: {
    stages: Array<{
      id: string;
      name: string;
      agent: string;
      task: string;
      dependsOn: string[];
    }>;
    estimatedSteps: number;
  };
  // 실행 완료 시
  result?: {
    summary: string;
    filesModified: string[];
    agentReports: Record<string, string>;
  };
}

// Example
// Input: {
//   task: "사용자 인증 기능 추가",
//   options: { checkpoints: true }
// }
// Output: {
//   runId: "run-abc123",
//   workflow: "standard",
//   status: "started",
//   plan: { ... }
// }
```

#### `workflow_status`
실행 중인 워크플로우 상태

```typescript
// Input
interface WorkflowStatusInput {
  runId: string;
}

// Output
interface WorkflowStatusOutput {
  runId: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  currentStage: string;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  stages: Array<{
    id: string;
    name: string;
    agent: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    startTime?: string;
    endTime?: string;
    output?: string;
  }>;
  lastCheckpoint?: {
    stageId: string;
    timestamp: string;
    data: any;
  };
}
```

#### `workflow_resume` / `workflow_abort`

```typescript
// Resume Input
interface WorkflowResumeInput {
  runId: string;
  fromCheckpoint?: string;       // 특정 체크포인트부터
}

// Abort Input
interface WorkflowAbortInput {
  runId: string;
  reason?: string;
}
```

---

### 4. Monitoring Integration Tools

#### `monitor_register`
모니터링 엔드포인트 등록

```typescript
// Input
interface MonitorRegisterInput {
  type: 'sse' | 'webhook' | 'file' | 'otlp' | 'prometheus';
  config: {
    // SSE
    endpoint?: string;           // http://localhost:4500/api/ingest

    // Webhook
    url?: string;
    secret?: string;
    events?: string[];           // 필터링할 이벤트 타입

    // File
    path?: string;
    format?: 'json' | 'jsonl';

    // OTLP
    otlpEndpoint?: string;
    headers?: Record<string, string>;

    // Prometheus
    port?: number;
    path?: string;
  };
}

// Output
interface MonitorRegisterOutput {
  success: boolean;
  monitorId: string;
  status: 'connected' | 'pending' | 'error';
}

// Example - Agent Orchestra Monitor 연동
// Input: {
//   type: "sse",
//   config: {
//     endpoint: "http://141.148.168.113:3006/api/ingest"
//   }
// }
```

#### `monitor_emit`
커스텀 이벤트 발행

```typescript
// Input
interface MonitorEmitInput {
  type: string;                  // 커스텀 이벤트 타입
  payload: any;
  metadata?: Record<string, any>;
}

// Output
interface MonitorEmitOutput {
  success: boolean;
  eventId: string;
  deliveredTo: string[];         // 전송된 모니터 목록
}
```

#### `monitor_get_events`
이벤트 로그 조회

```typescript
// Input
interface MonitorGetEventsInput {
  runId?: string;                // 특정 워크플로우
  types?: string[];              // 이벤트 타입 필터
  since?: string;                // 시작 시간
  limit?: number;
}

// Output
interface MonitorGetEventsOutput {
  events: OrchestrationEvent[];
  hasMore: boolean;
  cursor?: string;
}
```

---

## Resources

MCP Resources를 통해 팀 설정 정보에 접근

```typescript
// 리소스 목록
const resources = [
  {
    uri: "team://config",
    name: "Team Configuration",
    description: "현재 팀 설정"
  },
  {
    uri: "team://agents",
    name: "Agent List",
    description: "에이전트 목록"
  },
  {
    uri: "team://agents/{role}",
    name: "Agent Detail",
    description: "특정 에이전트 상세"
  },
  {
    uri: "team://workflows",
    name: "Workflow List",
    description: "워크플로우 목록"
  },
  {
    uri: "team://workflows/{id}",
    name: "Workflow Detail",
    description: "특정 워크플로우 상세"
  },
  {
    uri: "team://runs",
    name: "Run History",
    description: "실행 이력"
  },
  {
    uri: "team://runs/{runId}",
    name: "Run Detail",
    description: "특정 실행 상세"
  }
];
```

---

## Prompts

사전 정의된 프롬프트 템플릿

```typescript
// 프롬프트 목록
const prompts = [
  {
    name: "pm-analyze",
    description: "PM이 요청을 분석하는 프롬프트",
    arguments: [
      { name: "task", description: "수행할 태스크", required: true }
    ]
  },
  {
    name: "pm-plan",
    description: "PM이 실행 계획을 수립하는 프롬프트",
    arguments: [
      { name: "task", description: "태스크" },
      { name: "workflow", description: "워크플로우" }
    ]
  },
  {
    name: "agent-context",
    description: "에이전트에게 전달할 컨텍스트 프롬프트",
    arguments: [
      { name: "role", description: "에이전트 역할" },
      { name: "task", description: "태스크" },
      { name: "previousOutput", description: "이전 단계 결과" }
    ]
  }
];
```

---

## Error Codes

```typescript
enum ErrorCode {
  // Team Errors
  TEAM_NOT_INITIALIZED = 'TEAM_001',
  TEMPLATE_NOT_FOUND = 'TEAM_002',
  INVALID_TEMPLATE = 'TEAM_003',

  // Agent Errors
  AGENT_NOT_FOUND = 'AGENT_001',
  AGENT_SPAWN_FAILED = 'AGENT_002',

  // Workflow Errors
  WORKFLOW_NOT_FOUND = 'WORKFLOW_001',
  WORKFLOW_ALREADY_RUNNING = 'WORKFLOW_002',
  WORKFLOW_FAILED = 'WORKFLOW_003',

  // Monitor Errors
  MONITOR_CONNECTION_FAILED = 'MONITOR_001',
  MONITOR_NOT_REGISTERED = 'MONITOR_002'
}
```
