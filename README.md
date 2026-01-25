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

### 2. 팀 초기화

```
사용자: "이 프로젝트에 web-dev-team 으로 팀 설정해줘"

Claude: team_init 도구를 사용하여 팀을 초기화합니다.
→ .claude/team/ 디렉토리에 설정 생성
→ PM, Frontend, Backend, DevOps, QA, Documenter 에이전트 준비
```

### 3. PM 모드로 작업

```
사용자: "로그인 기능 구현해줘"

Claude (PM 역할):
1. 요청 분석 및 태스크 분해
2. Explorer로 코드 분석
3. 설계 수립
4. Frontend/Backend 에이전트 병렬 스폰
5. QA 검증
6. 결과 통합 및 보고
```

---

## 제공 템플릿

| 템플릿 | 에이전트 | 용도 |
|--------|---------|------|
| `web-dev-team` | PM, Frontend, Backend, DevOps, QA, Documenter | 웹 서비스 개발 |
| `design-team` | PM, Art Director, UI/UX, Motion | 디자인 프로젝트 |
| `data-team` | PM, Data Engineer, ML Engineer, Analyst | 데이터/ML 프로젝트 |
| `mes-team` | PM, PLC Dev, SCADA Dev, DBA | 제조 시스템 |
| `content-team` | PM, Writer, Editor, SEO | 콘텐츠 제작 |
| `devops-team` | PM, Infra, Security, SRE | 인프라 관리 |

---

## MCP Tools

### Team Management
- `team_list_templates` - 템플릿 목록
- `team_init` - 팀 초기화
- `team_get_config` - 설정 조회
- `team_set_goal` - 프로젝트 목표 설정

### Workflow
- `workflow_list` - 워크플로우 목록
- `workflow_run` - 워크플로우 실행
- `workflow_status` - 상태 조회
- `workflow_resume` - 재개

### Monitoring
- `monitor_register` - 모니터링 등록
- `monitor_emit` - 이벤트 발행

---

## 모니터링 연동

### Agent Orchestra Monitor

```typescript
// 자동 연동
monitor_register({
  type: 'sse',
  config: { endpoint: 'http://localhost:3006/api/ingest' }
})
```

### 기타 시스템

| 시스템 | 연동 방식 |
|--------|----------|
| Grafana | OTLP |
| Slack | Webhook |
| Discord | Webhook |
| Prometheus | /metrics |
| 커스텀 | Webhook / SSE |

---

## 문서

- [프로젝트 개요](docs/00-project-overview.md)
- [MCP 인터페이스 설계](docs/01-mcp-interface-design.md)
- [이벤트 인터페이스](docs/02-event-interface.md)
- [템플릿 구조](docs/03-template-structure.md)

---

## 로드맵

- [x] 설계 문서
- [ ] MCP 서버 코어
- [ ] 기본 템플릿 (web-dev, design, general)
- [ ] Workflow Engine
- [ ] Agent Orchestra Monitor 연동
- [ ] 템플릿 레지스트리

---

## 관련 프로젝트

- [Agent Orchestra Monitor](https://github.com/tomtomjskim/agent-orchestra-monitor) - 실시간 모니터링 대시보드

---

## License

MIT
