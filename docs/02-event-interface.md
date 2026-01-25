# Event Interface Design

모니터링 시스템 연동을 위한 표준 이벤트 인터페이스

---

## 설계 원칙

1. **표준 호환**: OpenTelemetry 스펙과 호환
2. **확장 가능**: 커스텀 이벤트 타입 지원
3. **다중 출력**: 여러 모니터링 시스템 동시 지원
4. **경량**: 필수 필드만 포함, 선택적 확장

---

## Event Schema

### Base Event

```typescript
interface OrchestrationEvent {
  // === 필수 필드 ===

  // 고유 식별
  id: string;                    // UUID v4
  timestamp: string;             // ISO 8601 (2026-01-25T12:34:56.789Z)
  type: EventType;               // 이벤트 타입

  // 추적 컨텍스트 (OpenTelemetry Trace Context)
  traceId: string;               // 워크플로우 전체 추적 ID (32 hex)
  spanId: string;                // 현재 작업 ID (16 hex)
  parentSpanId?: string;         // 부모 작업 ID

  // 소스 정보
  source: {
    service: string;             // "team-orchestrator"
    version: string;             // "1.0.0"
    instanceId?: string;         // 멀티 인스턴스 구분
  };

  // === 컨텍스트 필드 ===

  // 프로젝트/세션
  project: {
    id: string;                  // 프로젝트 해시 또는 이름
    path?: string;               // 프로젝트 경로
    name?: string;               // 프로젝트 이름
  };

  session: {
    id: string;                  // 세션 UUID
    startTime: string;           // 세션 시작 시간
  };

  team: {
    id: string;                  // 팀 템플릿 ID
    name: string;                // 팀 이름
  };

  // === 페이로드 ===
  payload: EventPayload;         // 이벤트 타입별 데이터

  // === 선택 필드 ===
  metadata?: Record<string, any>; // 커스텀 메타데이터
  tags?: string[];               // 태그
  severity?: 'debug' | 'info' | 'warn' | 'error';
}
```

### Event Types

```typescript
type EventType =
  // === Workflow Lifecycle ===
  | 'workflow.started'           // 워크플로우 시작
  | 'workflow.planning'          // 계획 수립 중
  | 'workflow.planned'           // 계획 완료
  | 'workflow.stage.started'     // 단계 시작
  | 'workflow.stage.completed'   // 단계 완료
  | 'workflow.checkpoint'        // 체크포인트 저장
  | 'workflow.completed'         // 워크플로우 완료
  | 'workflow.failed'            // 워크플로우 실패
  | 'workflow.aborted'           // 워크플로우 중단

  // === Agent Lifecycle ===
  | 'agent.spawning'             // 에이전트 생성 중
  | 'agent.spawned'              // 에이전트 생성 완료
  | 'agent.progress'             // 진행 상황 업데이트
  | 'agent.tool.called'          // 도구 호출
  | 'agent.tool.result'          // 도구 결과
  | 'agent.completed'            // 에이전트 완료
  | 'agent.failed'               // 에이전트 실패

  // === Task Lifecycle ===
  | 'task.created'               // 태스크 생성
  | 'task.assigned'              // 태스크 할당
  | 'task.started'               // 태스크 시작
  | 'task.progress'              // 태스크 진행
  | 'task.completed'             // 태스크 완료
  | 'task.failed'                // 태스크 실패

  // === Approval Gate ===
  | 'approval.requested'         // 승인 요청
  | 'approval.waiting'           // 승인 대기
  | 'approval.granted'           // 승인 완료
  | 'approval.rejected'          // 승인 거부
  | 'approval.timeout'           // 승인 타임아웃

  // === System ===
  | 'system.heartbeat'           // 헬스체크
  | 'system.error'               // 시스템 에러
  | 'system.warning'             // 경고

  // === Custom ===
  | `custom.${string}`;          // 커스텀 이벤트
```

---

## Event Payloads

### Workflow Events

```typescript
// workflow.started
interface WorkflowStartedPayload {
  runId: string;
  workflowId: string;
  workflowName: string;
  task: string;
  options: {
    parallel: boolean;
    checkpoints: boolean;
    approvalRequired: boolean;
  };
}

// workflow.planned
interface WorkflowPlannedPayload {
  runId: string;
  stages: Array<{
    id: string;
    name: string;
    agent: string;
    task: string;
    dependsOn: string[];
    parallel: boolean;
  }>;
  estimatedDuration?: number;    // seconds
  estimatedTokens?: number;
}

// workflow.stage.started / completed
interface WorkflowStagePayload {
  runId: string;
  stageId: string;
  stageName: string;
  agent: string;
  progress?: {
    current: number;
    total: number;
  };
  output?: string;               // completed일 때
  error?: string;                // failed일 때
}

// workflow.completed
interface WorkflowCompletedPayload {
  runId: string;
  duration: number;              // seconds
  summary: string;
  filesModified: string[];
  tokensUsed?: number;
  cost?: number;
}

// workflow.failed
interface WorkflowFailedPayload {
  runId: string;
  failedStage: string;
  error: string;
  stackTrace?: string;
  canResume: boolean;
  lastCheckpoint?: string;
}
```

### Agent Events

```typescript
// agent.spawned
interface AgentSpawnedPayload {
  agentId: string;
  role: string;
  name: string;
  type: 'Explore' | 'Plan' | 'general-purpose' | 'Bash';
  task: string;
  parentAgentId?: string;        // PM이 스폰한 경우
}

// agent.progress
interface AgentProgressPayload {
  agentId: string;
  role: string;
  message: string;
  progress?: number;             // 0-100
  currentAction?: string;
}

// agent.tool.called
interface AgentToolCalledPayload {
  agentId: string;
  role: string;
  tool: string;
  parameters: Record<string, any>;
}

// agent.tool.result
interface AgentToolResultPayload {
  agentId: string;
  role: string;
  tool: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;              // ms
}

// agent.completed
interface AgentCompletedPayload {
  agentId: string;
  role: string;
  output: string;
  filesModified?: string[];
  duration: number;
  tokensUsed?: number;
}
```

### Approval Events

```typescript
// approval.requested
interface ApprovalRequestedPayload {
  approvalId: string;
  type: 'stage' | 'deploy' | 'schema' | 'custom';
  requester: string;             // agent role
  description: string;
  options?: string[];            // 선택지
  timeout?: number;              // seconds
  channels: string[];            // ['slack', 'dashboard']
}

// approval.granted / rejected
interface ApprovalResultPayload {
  approvalId: string;
  status: 'granted' | 'rejected';
  approver?: string;
  comment?: string;
  selectedOption?: string;
}
```

---

## Output Channels

### 1. SSE (Server-Sent Events)

Agent Orchestra Monitor 및 실시간 대시보드용

```typescript
interface SSEConfig {
  type: 'sse';
  endpoint: string;              // http://localhost:4500/api/ingest
  headers?: Record<string, string>;
  reconnect: {
    enabled: boolean;
    interval: number;            // ms
    maxRetries: number;
  };
  batch?: {
    enabled: boolean;
    size: number;
    interval: number;            // ms
  };
}

// SSE 메시지 포맷
// event: workflow.started
// id: evt-abc123
// data: {"id":"evt-abc123","timestamp":"...","type":"workflow.started",...}
```

### 2. Webhook

Slack, Discord, 외부 시스템 알림용

```typescript
interface WebhookConfig {
  type: 'webhook';
  url: string;
  method: 'POST' | 'PUT';
  headers?: Record<string, string>;
  secret?: string;               // HMAC 서명용
  events?: EventType[];          // 필터 (없으면 전체)
  retry: {
    enabled: boolean;
    maxRetries: number;
    backoff: 'linear' | 'exponential';
  };
  transform?: 'raw' | 'slack' | 'discord' | 'teams';
}

// Slack Transform 예시
// {
//   "blocks": [
//     {
//       "type": "section",
//       "text": { "type": "mrkdwn", "text": "*Workflow Started*\n..." }
//     }
//   ]
// }
```

### 3. File

로컬 로깅 및 디버깅용

```typescript
interface FileConfig {
  type: 'file';
  path: string;                  // .claude/team/events.jsonl
  format: 'json' | 'jsonl';
  rotation?: {
    enabled: boolean;
    maxSize: string;             // '10MB'
    maxFiles: number;
  };
  filter?: {
    types?: EventType[];
    severity?: string[];
  };
}
```

### 4. OTLP (OpenTelemetry Protocol)

Grafana, Jaeger, 분산 추적 시스템용

```typescript
interface OTLPConfig {
  type: 'otlp';
  endpoint: string;              // http://localhost:4317
  protocol: 'grpc' | 'http';
  headers?: Record<string, string>;
  compression?: 'gzip' | 'none';
  resourceAttributes?: Record<string, string>;
}

// OTLP Span 매핑
// - traceId → trace_id
// - spanId → span_id
// - type → span name
// - payload → span attributes
```

### 5. Prometheus

메트릭 수집용

```typescript
interface PrometheusConfig {
  type: 'prometheus';
  port: number;                  // 9090
  path: string;                  // /metrics
  prefix: string;                // team_orchestrator_
}

// 노출 메트릭 예시
// team_orchestrator_workflow_total{status="completed"} 42
// team_orchestrator_workflow_duration_seconds{workflow="standard"} 120.5
// team_orchestrator_agent_spawned_total{role="developer"} 15
// team_orchestrator_tokens_used_total{agent="frontend"} 50000
```

---

## Agent Orchestra Monitor 연동

### 설정

```typescript
// MCP 도구 호출
monitor_register({
  type: 'sse',
  config: {
    endpoint: 'http://141.148.168.113:3006/api/ingest'
  }
});
```

### Monitor 수신 API 추가 (server/routes/ingest.ts)

```typescript
// POST /api/ingest
// Agent Orchestra Monitor에 추가할 이벤트 수신 엔드포인트

router.post('/ingest', (req, res) => {
  const event: OrchestrationEvent = req.body;

  // 이벤트 타입에 따라 처리
  switch (event.type) {
    case 'workflow.started':
      // 새 워크플로우로 표시
      break;

    case 'agent.spawned':
      // 새 태스크로 추가
      taskService.addTask({
        id: event.payload.agentId,
        agentType: event.payload.role,
        status: 'running',
        sessionId: event.session.id,
        ...
      });
      break;

    case 'agent.completed':
      // 태스크 완료 처리
      taskService.updateTask(event.payload.agentId, {
        status: 'completed',
        output: event.payload.output
      });
      break;
  }

  // SSE로 클라이언트에 브로드캐스트
  sseService.broadcast(event.type, event);

  res.json({ success: true });
});
```

---

## 이벤트 흐름 예시

```
사용자: "로그인 기능 구현해줘"

┌─────────────────────────────────────────────────────────────────────────────┐
│ Event Timeline                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ T+0ms    workflow.started                                                   │
│          { runId: "run-001", task: "로그인 기능 구현" }                       │
│                                                                             │
│ T+100ms  workflow.planning                                                  │
│          { runId: "run-001" }                                               │
│                                                                             │
│ T+2000ms workflow.planned                                                   │
│          { runId: "run-001", stages: [Explorer, Architect, ...] }           │
│                                                                             │
│ T+2100ms workflow.stage.started                                             │
│          { stageId: "S1", stageName: "Analysis", agent: "explorer" }        │
│                                                                             │
│ T+2200ms agent.spawned                                                      │
│          { agentId: "agent-001", role: "explorer", type: "Explore" }        │
│                                                                             │
│ T+2500ms agent.tool.called                                                  │
│          { tool: "Glob", parameters: { pattern: "src/auth/**" } }           │
│                                                                             │
│ T+3000ms agent.tool.result                                                  │
│          { tool: "Glob", success: true, result: [...files] }                │
│                                                                             │
│ T+5000ms agent.progress                                                     │
│          { message: "인증 관련 파일 5개 분석 중..." }                         │
│                                                                             │
│ T+10000ms agent.completed                                                   │
│           { output: "분석 결과: src/auth/에 기존 인증 로직 없음..." }         │
│                                                                             │
│ T+10100ms workflow.stage.completed                                          │
│           { stageId: "S1" }                                                 │
│                                                                             │
│ T+10200ms workflow.stage.started                                            │
│           { stageId: "S2", stageName: "Design", agent: "architect" }        │
│                                                                             │
│ ...                                                                         │
│                                                                             │
│ T+60000ms workflow.completed                                                │
│           { summary: "로그인 기능 구현 완료", filesModified: [...] }         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```
