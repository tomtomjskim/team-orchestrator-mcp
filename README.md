# Team Orchestrator MCP

**Claude Code용 범용 멀티 에이전트 팀 오케스트레이션 MCP 서버**

---

## 개요

어떤 프로젝트에서든 팀 템플릿을 선택하여 즉시 멀티 에이전트 오케스트레이션을 사용할 수 있는 MCP 서버입니다.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   GitHub에서 설치 → 팀 템플릿 선택 → 프로젝트에 적용 → PM 모드로 작업       │
│                                                                             │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│   │  Install    │───▶│   Select    │───▶│   Init      │───▶│    Run      │ │
│   │  MCP Server │    │  Template   │    │   Team      │    │  Workflow   │ │
│   └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 핵심 기능

| 기능 | 설명 |
|------|------|
| **팀 템플릿** | 웹개발, 디자인, 데이터, DevOps, 콘텐츠 등 다양한 팀 프리셋 |
| **템플릿 레지스트리** | 원격 템플릿 검색, 다운로드, 캐싱 |
| **워크플로우 엔진** | DAG 기반 태스크 스케줄링, 병렬 실행 |
| **표준 이벤트** | OpenTelemetry 호환, 다중 모니터링 연동 |
| **확장 가능** | 커스텀 에이전트, 워크플로우, 템플릿 |

---

## 빠른 시작

### 1. MCP 서버 설치

```json
// .claude/settings.json 또는 프로젝트 mcp 설정
{
  "mcpServers": {
    "team-orchestrator": {
      "command": "npx",
      "args": ["-y", "team-orchestrator-mcp"]
    }
  }
}
```

또는 로컬 설치 (npm 배포 전):

```bash
# Clone and build
git clone https://github.com/tomtomjskim/team-orchestrator-mcp.git
cd team-orchestrator-mcp
npm install
npm run build

# MCP 설정에 추가
{
  "mcpServers": {
    "team-orchestrator": {
      "command": "node",
      "args": ["/path/to/team-orchestrator-mcp/dist/index.js"]
    }
  }
}
```

### 2. 팀 초기화

```
사용자: "이 프로젝트에 web-dev 팀 템플릿으로 설정해줘"

Claude: team_init 도구를 사용하여 팀을 초기화합니다.
→ .claude/team/ 디렉토리에 설정 생성
→ PM, Explorer, Architect, Frontend, Backend, DevOps, QA, Documenter 에이전트 준비
```

### 3. PM 모드로 작업

```
사용자: "로그인 기능 구현해줘"

Claude (PM 역할):
1. 요청 분석 및 태스크 분해
2. Explorer로 코드 분석
3. Architect로 설계 수립
4. Frontend/Backend 에이전트 병렬 스폰
5. QA 검증
6. 결과 통합 및 보고
```

---

## 제공 템플릿

| 템플릿 | 에이전트 | 용도 |
|--------|---------|------|
| `web-dev` | PM, Explorer, Architect, Frontend, Backend, DevOps, QA, Documenter | 웹 서비스 개발 |
| `general` | PM, Explorer, Developer, Tester | 범용 프로젝트 |
| `data-team` | PM, Explorer, Data Engineer, ML Engineer, Analyst, DBA | 데이터/ML 프로젝트 |
| `devops-team` | PM, Explorer, Infra Engineer, CI/CD Engineer, Security Engineer, SRE | 인프라 관리 |
| `design-team` | PM, Explorer, UI Designer, UX Researcher, Design System, Prototyper | 디자인/UX 프로젝트 |
| `content-team` | PM, Explorer, Strategist, Writer, Editor, SEO Specialist | 콘텐츠/마케팅 |

---

## MCP Tools

### Team Management
| Tool | 설명 |
|------|------|
| `team_list_templates` | 사용 가능한 템플릿 목록 조회 |
| `team_init` | 프로젝트에 팀 설정 초기화 |
| `team_get_config` | 현재 팀 설정 조회 |
| `team_set_goal` | 프로젝트 목표 및 컨텍스트 설정 |

### Agent Management
| Tool | 설명 |
|------|------|
| `agent_list` | 팀 에이전트 목록 조회 |
| `agent_add` | 커스텀 에이전트 추가 |
| `agent_modify` | 에이전트 설정 수정 |

### Workflow Management
| Tool | 설명 |
|------|------|
| `workflow_list` | 워크플로우 목록 조회 |
| `workflow_run` | 워크플로우 실행 |
| `workflow_status` | 실행 상태 조회 |
| `workflow_resume` | 중단된 워크플로우 재개 |
| `workflow_abort` | 워크플로우 중단 |

### Task Events (Agent Monitor 연동)
| Tool | 설명 |
|------|------|
| `task_start` | 태스크 시작 이벤트 발행 |
| `task_progress` | 태스크 진행 상황 업데이트 |
| `task_complete` | 태스크 완료 처리 |
| `task_fail` | 태스크 실패 처리 |
| `task_list_active` | 활성 태스크 목록 조회 |
| `task_get` | 특정 태스크 상세 조회 |

### Monitoring
| Tool | 설명 |
|------|------|
| `monitor_register` | 모니터링 엔드포인트 등록 |
| `monitor_emit` | 커스텀 이벤트 발행 |
| `monitor_get_events` | 이벤트 로그 조회 |
| `monitor_list_channels` | 등록된 채널 목록 |
| `monitor_unregister` | 모니터링 채널 해제 |

### Template Registry
| Tool | 설명 |
|------|------|
| `registry_search` | 템플릿 검색 |
| `registry_info` | 템플릿 상세 정보 |
| `registry_download` | 템플릿 다운로드 |
| `registry_list` | 등록된 레지스트리 목록 |
| `registry_add` | 커스텀 레지스트리 추가 |
| `registry_remove` | 레지스트리 제거 |
| `registry_cached` | 캐시된 템플릿 목록 |
| `registry_clear_cache` | 캐시 삭제 |
| `registry_categories` | 카테고리 목록 |
| `registry_tags` | 태그 목록 |

---

## MCP Resources

| URI | 설명 |
|-----|------|
| `team://config` | 현재 팀 설정 |
| `team://agents` | 에이전트 목록 |
| `team://agents/{role}` | 특정 에이전트 상세 |
| `team://workflows` | 워크플로우 목록 |
| `team://workflows/{id}` | 특정 워크플로우 상세 |

---

## MCP Prompts

| Prompt | 설명 |
|--------|------|
| `pm-analyze` | PM의 태스크 분석 프롬프트 |
| `pm-plan` | PM의 실행 계획 수립 프롬프트 |
| `agent-context` | 에이전트 스폰 시 컨텍스트 프롬프트 |

---

## 템플릿 레지스트리

### 템플릿 검색

```
사용자: "디자인 관련 템플릿 검색해줘"

Claude: registry_search 도구로 검색합니다.
→ design-team: 디자인 및 UX 팀
```

### 커스텀 레지스트리 추가

```typescript
// 사내 레지스트리 추가
registry_add({
  name: 'internal',
  url: 'https://internal.company.com/templates/index.json',
  priority: 5
})
```

---

## 모니터링 연동

### Agent Orchestra Monitor

**Webhook 연동 (권장)**

```typescript
// Webhook 연동 - 파일 감시 없이 직접 이벤트 전달
monitor_register({
  type: 'webhook',
  config: { 
    url: 'http://localhost:4500/api/webhook/events'
  }
})

// 또는 도커 환경
monitor_register({
  type: 'webhook',
  config: { 
    url: 'http://agent-monitor:4500/api/webhook/events'
  }
})
```

**Task 이벤트 사용 예시**

```typescript
// 1. 태스크 시작
const result = await task_start({
  agentId: 'agent-123',
  agentType: 'Developer',
  description: '로그인 기능 구현',
  sessionId: 'session-abc'
});

// 2. 진행 상황 업데이트
await task_progress({
  taskId: result.taskId,
  progress: 50,
  message: 'API 엔드포인트 구현 완료',
  phase: 'implementing'
});

// 3. 완료
await task_complete({
  taskId: result.taskId,
  summary: '로그인/로그아웃 API 구현 완료',
  filesModified: ['src/auth/login.ts', 'src/auth/logout.ts']
});
```

**SSE 연동 (레거시)**

```typescript
// SSE 연동
monitor_register({
  type: 'sse',
  config: { endpoint: 'http://localhost:3006/api/ingest' }
})
```

### 지원 시스템

| 시스템 | 연동 방식 |
|--------|----------|
| Agent Orchestra Monitor | SSE |
| Grafana | OTLP |
| Slack | Webhook |
| Discord | Webhook |
| Prometheus | /metrics |
| 파일 로그 | JSON/JSONL |

---

## 프로젝트 구조

```
team-orchestrator-mcp/
├── src/
│   ├── index.ts              # MCP 서버 진입점
│   ├── types/                # TypeScript 타입 정의
│   ├── services/             # 핵심 서비스
│   │   ├── TeamManager.ts    # 팀 관리
│   │   ├── ConfigStore.ts    # 설정 저장소
│   │   ├── TemplateLoader.ts # 템플릿 로더
│   │   ├── TemplateRegistry.ts # 템플릿 레지스트리
│   │   ├── WorkflowEngine.ts # 워크플로우 엔진
│   │   └── EventEmitter.ts   # 이벤트 발행
│   └── tools/                # MCP 도구
│       ├── teamTools.ts      # 팀 관련 도구
│       ├── agentTools.ts     # 에이전트 관련 도구
│       ├── workflowTools.ts  # 워크플로우 관련 도구
│       ├── monitorTools.ts   # 모니터링 관련 도구
│       ├── registryTools.ts  # 레지스트리 관련 도구
│       └── taskEventTools.ts # Task 이벤트 도구 (Agent Monitor 연동)
├── templates/                # 팀 템플릿
│   ├── web-dev/              # 웹 개발팀
│   ├── general/              # 범용팀
│   ├── data-team/            # 데이터/ML팀
│   ├── devops-team/          # DevOps팀
│   ├── design-team/          # 디자인팀
│   └── content-team/         # 콘텐츠팀
├── registry/                 # 템플릿 레지스트리 인덱스
│   └── index.json
├── docs/                     # 설계 문서
└── dist/                     # 빌드 결과물
```

---

## 문서

### Claude Code 셋업 가이드
👉 **[claude-code-guide](https://github.com/tomtomjskim/claude-code-guide)** - 별도 레포지토리로 분리됨

### 설계 문서
- [프로젝트 개요](docs/00-project-overview.md)
- [MCP 인터페이스 설계](docs/01-mcp-interface-design.md)
- [이벤트 인터페이스](docs/02-event-interface.md)
- [템플릿 구조](docs/03-template-structure.md)
- [확장 아이디어](docs/04-additional-features.md)

---

## 개발

```bash
# 설치
npm install

# 빌드
npm run build

# 개발 서버 (ts-node)
npm run dev

# 빌드 후 실행
npm start
```

---

## 로드맵

- [x] 설계 문서
- [x] MCP 서버 코어
- [x] 팀 관리 도구 (team_*)
- [x] 에이전트 관리 도구 (agent_*)
- [x] 워크플로우 도구 (workflow_*)
- [x] 모니터링 도구 (monitor_*)
- [x] 기본 템플릿 (web-dev, general)
- [x] 워크플로우 엔진 (DAG 기반 실행, 병렬 처리, 체크포인트)
- [x] 이벤트 발행 (SSE, Webhook, File, OTLP)
- [x] 추가 템플릿 (data-team, devops-team, design-team, content-team)
- [x] 템플릿 레지스트리
- [ ] npm 배포

---

## 관련 프로젝트

- [Agent Orchestra Monitor](https://github.com/tomtomjskim/agent-orchestra-monitor) - 실시간 모니터링 대시보드

---

## License

MIT
