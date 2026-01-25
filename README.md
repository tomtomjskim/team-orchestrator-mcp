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
| **팀 템플릿** | 웹개발, 디자인, 데이터, MES 등 다양한 팀 프리셋 |
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
      "args": ["-y", "@jsnwcorp/team-orchestrator-mcp"]
    }
  }
}
```

또는 로컬 설치:

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

**Coming Soon:**
- `design-team` - 디자인 프로젝트
- `data-team` - 데이터/ML 프로젝트
- `mes-team` - 제조 시스템
- `content-team` - 콘텐츠 제작
- `devops-team` - 인프라 관리

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

### Monitoring
| Tool | 설명 |
|------|------|
| `monitor_register` | 모니터링 엔드포인트 등록 |
| `monitor_emit` | 커스텀 이벤트 발행 |
| `monitor_get_events` | 이벤트 로그 조회 |

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

## 모니터링 연동

### Agent Orchestra Monitor

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
│   │   └── TemplateLoader.ts # 템플릿 로더
│   └── tools/                # MCP 도구
│       ├── teamTools.ts      # 팀 관련 도구
│       ├── agentTools.ts     # 에이전트 관련 도구
│       ├── workflowTools.ts  # 워크플로우 관련 도구
│       └── monitorTools.ts   # 모니터링 관련 도구
├── templates/                # 팀 템플릿
│   ├── web-dev/              # 웹 개발팀
│   └── general/              # 범용팀
├── docs/                     # 설계 문서
└── dist/                     # 빌드 결과물
```

---

## 문서

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
- [ ] 워크플로우 엔진 고도화
- [ ] 이벤트 발행 고도화
- [ ] 추가 템플릿 (design, data, devops)
- [ ] 템플릿 레지스트리
- [ ] npm 배포

---

## 관련 프로젝트

- [Agent Orchestra Monitor](https://github.com/tomtomjskim/agent-orchestra-monitor) - 실시간 모니터링 대시보드

---

## License

MIT
