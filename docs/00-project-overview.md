# Team Orchestrator MCP

**Claude Code용 멀티 에이전트 팀 오케스트레이션 MCP 서버**

---

## 비전

어떤 프로젝트에서든 GitHub을 통해 설치하고, 팀 템플릿을 선택하여 즉시 멀티 에이전트 오케스트레이션을 사용할 수 있는 범용 MCP 서버.

---

## 핵심 가치

| 가치 | 설명 |
|------|------|
| **Portable** | npm/GitHub으로 어디서든 설치 |
| **Reusable** | 팀 템플릿 공유 및 재사용 |
| **Extensible** | 커스텀 에이전트/워크플로우 추가 |
| **Observable** | 표준 인터페이스로 모니터링 연동 |
| **Composable** | 팀 템플릿 조합 및 상속 |

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        Team Orchestrator MCP 아키텍처                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                           MCP Server Core                                 │  │
│  │                                                                           │  │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │  │
│  │   │   Team      │  │  Workflow   │  │   Agent     │  │   Event     │     │  │
│  │   │  Manager    │  │   Engine    │  │   Runner    │  │   Emitter   │     │  │
│  │   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │  │
│  │          │                │                │                │            │  │
│  │          └────────────────┴────────────────┴────────────────┘            │  │
│  │                                    │                                      │  │
│  └────────────────────────────────────│──────────────────────────────────────┘  │
│                                       │                                         │
│       ┌───────────────────────────────┼───────────────────────────────┐         │
│       │                               │                               │         │
│       ▼                               ▼                               ▼         │
│  ┌─────────────┐               ┌─────────────┐               ┌─────────────┐   │
│  │   MCP       │               │   Event     │               │  Template   │   │
│  │   Tools     │               │   Stream    │               │   Store     │   │
│  │             │               │             │               │             │   │
│  │ - team_*    │               │ - SSE       │               │ - Local     │   │
│  │ - workflow_*│               │ - Webhook   │               │ - GitHub    │   │
│  │ - agent_*   │               │ - OTLP      │               │ - Registry  │   │
│  │ - monitor_* │               │             │               │             │   │
│  └─────────────┘               └─────────────┘               └─────────────┘   │
│       │                               │                               │         │
│       ▼                               ▼                               ▼         │
│  ┌─────────────┐               ┌─────────────┐               ┌─────────────┐   │
│  │ Claude Code │               │  Monitors   │               │   GitHub    │   │
│  │   Client    │               │             │               │  Templates  │   │
│  │             │               │ - Orchestra │               │             │   │
│  │             │               │ - Grafana   │               │ - web-dev   │   │
│  │             │               │ - Custom    │               │ - design    │   │
│  │             │               │             │               │ - mes       │   │
│  └─────────────┘               └─────────────┘               └─────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 모듈 구성

### 1. Team Manager
- 팀 템플릿 초기화/로드
- 프로젝트별 팀 설정 관리
- 팀 목표/컨텍스트 설정

### 2. Workflow Engine
- DAG 기반 워크플로우 실행
- 병렬/순차 실행 스케줄링
- 체크포인트 및 Resume

### 3. Agent Runner
- Task 도구로 서브에이전트 스폰
- 에이전트 컨텍스트 주입
- 결과 수집 및 통합

### 4. Event Emitter
- 표준 이벤트 포맷 (OpenTelemetry 호환)
- 다중 출력 지원 (SSE, Webhook, File)
- 실시간 스트리밍

---

## MCP Tools 분류

### Team Management
| Tool | 설명 |
|------|------|
| `team_list_templates` | 사용 가능한 팀 템플릿 목록 |
| `team_init` | 프로젝트에 팀 설정 초기화 |
| `team_get_config` | 현재 팀 설정 조회 |
| `team_set_goal` | 프로젝트 목표 설정 |
| `team_import` | 외부 팀 설정 가져오기 |
| `team_export` | 현재 팀 설정 내보내기 |

### Agent Management
| Tool | 설명 |
|------|------|
| `agent_list` | 팀 에이전트 목록 |
| `agent_add` | 커스텀 에이전트 추가 |
| `agent_modify` | 에이전트 프롬프트 수정 |
| `agent_remove` | 에이전트 제거 |
| `agent_get_prompt` | 에이전트 프롬프트 조회 |

### Workflow Management
| Tool | 설명 |
|------|------|
| `workflow_list` | 워크플로우 목록 |
| `workflow_run` | 워크플로우 실행 (PM 모드) |
| `workflow_status` | 실행 중인 워크플로우 상태 |
| `workflow_resume` | 중단된 워크플로우 재개 |
| `workflow_abort` | 워크플로우 중단 |

### Monitoring Integration
| Tool | 설명 |
|------|------|
| `monitor_register` | 모니터링 엔드포인트 등록 |
| `monitor_emit` | 커스텀 이벤트 발행 |
| `monitor_get_events` | 이벤트 로그 조회 |
| `monitor_set_webhook` | Webhook URL 설정 |

---

## 이벤트 인터페이스 (표준화)

### Event Schema (OpenTelemetry 호환)

```typescript
interface OrchestrationEvent {
  // 기본 필드
  id: string;                    // 이벤트 고유 ID
  timestamp: string;             // ISO 8601
  type: EventType;               // 이벤트 타입

  // 컨텍스트
  traceId: string;               // 워크플로우 추적 ID
  spanId: string;                // 현재 태스크 ID
  parentSpanId?: string;         // 부모 태스크 ID

  // 프로젝트/세션
  projectId: string;             // 프로젝트 식별자
  sessionId: string;             // 세션 ID
  teamId: string;                // 팀 템플릿 ID

  // 페이로드
  payload: EventPayload;         // 이벤트별 데이터

  // 메타데이터
  metadata?: Record<string, any>;
}

type EventType =
  // Workflow Events
  | 'workflow:started'
  | 'workflow:completed'
  | 'workflow:failed'
  | 'workflow:checkpoint'

  // Agent Events
  | 'agent:spawned'
  | 'agent:progress'
  | 'agent:completed'
  | 'agent:failed'

  // Task Events
  | 'task:created'
  | 'task:started'
  | 'task:completed'
  | 'task:failed'

  // Approval Events
  | 'approval:requested'
  | 'approval:granted'
  | 'approval:rejected';
```

### 출력 채널

| 채널 | 용도 | 설정 |
|------|------|------|
| **SSE** | Agent Orchestra Monitor | `http://localhost:4500/api/events` |
| **Webhook** | Slack, Discord, Custom | URL + Secret |
| **File** | 로컬 로깅 | `.claude/team/events.jsonl` |
| **OTLP** | Grafana, Jaeger | OTLP Endpoint |
| **Prometheus** | 메트릭 수집 | `/metrics` 엔드포인트 |

---

## 템플릿 레지스트리

### 로컬 템플릿
```
~/.team-orchestrator/templates/
├── web-dev/
├── design/
└── custom/
```

### GitHub 레지스트리
```yaml
# 템플릿 소스 설정
registries:
  - name: official
    url: github.com/team-orchestrator/templates
  - name: community
    url: github.com/awesome-team-templates
  - name: private
    url: github.com/my-org/team-templates
    token: ${GITHUB_TOKEN}
```

### 템플릿 메타데이터
```yaml
# meta.yaml
name: web-dev-team
version: 1.0.0
description: 웹 개발팀 (풀스택)
author: jsnwcorp
tags: [web, fullstack, typescript]

agents:
  - pm
  - frontend
  - backend
  - devops
  - qa

workflows:
  - standard
  - quick-fix
  - feature-flag

requirements:
  - node >= 18
  - docker
```

---

## 확장 기능 아이디어

### 1. 팀 마켓플레이스
- 커뮤니티 팀 템플릿 공유
- 별점/리뷰 시스템
- 버전 관리 및 업데이트

### 2. AI 기반 최적화
- 에이전트 성능 분석
- 프롬프트 자동 개선 제안
- 워크플로우 병목 감지

### 3. 비용 추적
- 토큰 사용량 추적
- 에이전트별 비용 분석
- 예산 알림

### 4. 협업 기능
- 승인 게이트 외부 연동 (Slack, Teams)
- 실시간 진행 공유
- 코멘트/피드백 수집

### 5. CI/CD 연동
- GitHub Actions 트리거
- 자동 테스트/배포 연계
- PR 자동 생성

### 6. 멀티 LLM 지원
- Claude 외 다른 LLM 에이전트
- 모델별 특화 역할 배정
- 비용/성능 밸런싱

---

## 로드맵

### Phase 1: Core (MVP)
- [ ] MCP 서버 기본 구조
- [ ] Team Manager (init, config)
- [ ] 기본 팀 템플릿 3종 (web-dev, design, general)
- [ ] SSE 이벤트 출력
- [ ] Agent Orchestra Monitor 연동

### Phase 2: Workflow
- [ ] Workflow Engine
- [ ] DAG 실행 스케줄러
- [ ] 체크포인트/Resume
- [ ] 병렬 실행 최적화

### Phase 3: Integration
- [ ] Webhook 지원
- [ ] GitHub Actions 연동
- [ ] Slack/Discord 알림
- [ ] OTLP 메트릭

### Phase 4: Marketplace
- [ ] 템플릿 레지스트리
- [ ] 버전 관리
- [ ] 커뮤니티 공유

---

## 기대 효과

| 항목 | Before (v1) | After (v2) |
|------|-------------|------------|
| 설치 | 수동 파일 복사 | `npm install` 또는 MCP 설정 |
| 팀 설정 | 하드코딩 | 템플릿 선택 |
| 프로젝트 적용 | 서버 종속 | 프로젝트별 독립 |
| 모니터링 | Agent Monitor만 | 표준 인터페이스 |
| 확장 | 직접 수정 | 플러그인 방식 |
| 공유 | 불가 | GitHub 템플릿 |
