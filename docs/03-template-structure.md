# Team Template Structure

팀 템플릿의 구조와 작성 가이드

---

## 템플릿 디렉토리 구조

```
{template-id}/
├── meta.yaml                    # 템플릿 메타정보
├── agents.yaml                  # 에이전트 정의
├── prompts/                     # 에이전트 프롬프트
│   ├── pm.md
│   ├── {role-1}.md
│   ├── {role-2}.md
│   └── ...
├── workflows/                   # 워크플로우 정의
│   ├── default.yaml
│   ├── quick.yaml
│   └── ...
├── context/                     # 공유 컨텍스트 (선택)
│   └── tech-stack.md
└── README.md                    # 템플릿 설명
```

---

## 파일 상세

### meta.yaml

```yaml
# 템플릿 메타정보
id: web-dev-team                 # 고유 ID (영문, 하이픈)
name: Web Development Team       # 표시 이름
description: |
  풀스택 웹 개발팀.
  프론트엔드(React/Next.js), 백엔드(Node/Python),
  DevOps, QA 역할 포함.
version: 1.0.0
author: jsnwcorp
license: MIT

# 분류
category: development            # development, design, data, devops, custom
tags:
  - web
  - fullstack
  - typescript
  - react

# 에이전트 목록 (간략)
agents:
  - pm
  - frontend
  - backend
  - devops
  - qa
  - documenter

# 기본 워크플로우
defaultWorkflow: standard

# 사용 요건
requirements:
  tools:
    - node >= 18
    - npm >= 9
  optional:
    - docker
    - git

# 권장 프로젝트 유형
recommendedFor:
  - SPA/PWA 개발
  - API 서버 개발
  - 풀스택 웹 서비스

# 호환성
compatibility:
  claudeCode: ">=1.0.0"
  teamOrchestrator: ">=1.0.0"
```

### agents.yaml

```yaml
# 에이전트 정의
version: "1.0"

# 공통 설정
defaults:
  outputFormat: markdown
  contextInheritance: true       # PM 컨텍스트 상속

# 에이전트 목록
agents:
  pm:
    name: "Project Manager"
    type: orchestrator           # 특별 타입: PM 전용
    description: |
      프로젝트 매니저. 요청 분석, 태스크 분배,
      진행 관리, 결과 통합을 담당합니다.
    prompt: prompts/pm.md
    capabilities:
      - task-decomposition
      - agent-coordination
      - progress-reporting
    canSpawn:                    # 스폰 가능한 에이전트
      - frontend
      - backend
      - devops
      - qa
      - documenter

  frontend:
    name: "Frontend Developer"
    type: general-purpose
    description: |
      프론트엔드 개발자. UI 컴포넌트, 클라이언트 로직,
      상태 관리를 담당합니다.
    prompt: prompts/frontend.md
    expertise:
      - React
      - Next.js
      - TypeScript
      - Tailwind CSS
      - Zustand/Redux
    tools:                       # 허용 도구
      - Read
      - Edit
      - Write
      - Glob
      - Grep
      - mcp__serena__*
    outputs:
      - source-code
      - component-docs

  backend:
    name: "Backend Developer"
    type: general-purpose
    description: |
      백엔드 개발자. API, 비즈니스 로직,
      데이터 처리를 담당합니다.
    prompt: prompts/backend.md
    expertise:
      - Node.js
      - Express
      - Python
      - FastAPI
      - PostgreSQL
    tools:
      - Read
      - Edit
      - Write
      - Glob
      - Grep
      - Bash
      - mcp__serena__*
    outputs:
      - source-code
      - api-docs

  devops:
    name: "DevOps Engineer"
    type: Bash
    description: |
      DevOps 엔지니어. 빌드, 배포, 인프라 관리를 담당합니다.
    prompt: prompts/devops.md
    expertise:
      - Docker
      - Docker Compose
      - Nginx
      - CI/CD
      - Linux
    tools:
      - Bash
      - Read
      - Edit
      - Write
    outputs:
      - deployment-log
      - infra-docs

  qa:
    name: "QA Engineer"
    type: general-purpose
    description: |
      QA 엔지니어. 테스트, 버그 검증, 품질 관리를 담당합니다.
    prompt: prompts/qa.md
    expertise:
      - Jest
      - Playwright
      - Testing Library
      - API Testing
    tools:
      - Read
      - Glob
      - Grep
      - Bash
      - mcp__serena__find_referencing_symbols
    outputs:
      - test-report
      - bug-report

  documenter:
    name: "Technical Writer"
    type: general-purpose
    description: |
      테크니컬 라이터. 문서화, README, API 문서를 담당합니다.
    prompt: prompts/documenter.md
    tools:
      - Read
      - Edit
      - Write
      - mcp__serena__get_symbols_overview
    outputs:
      - documentation
```

### workflows/standard.yaml

```yaml
# 표준 개발 워크플로우
id: standard
name: Standard Development
description: |
  분석 → 설계 → 구현 → 검증 → 배포 → 문서화
  표준 개발 프로세스

# 단계 정의
stages:
  - id: analysis
    name: Analysis
    description: 요청 분석 및 코드베이스 파악
    agent: explorer              # 또는 pm이 직접
    type: Explore
    task: |
      {{TASK}}에 필요한 코드베이스 분석:
      1. 관련 파일 및 모듈 파악
      2. 의존성 분석
      3. 영향 범위 평가
    outputs:
      - analysis-report

  - id: design
    name: Design
    description: 구현 설계
    agent: pm                    # PM이 직접 또는 Architect 스폰
    type: Plan
    dependsOn: [analysis]
    task: |
      분석 결과를 바탕으로 구현 계획 수립:
      1. 아키텍처 결정
      2. 태스크 분해
      3. 인터페이스 정의
    outputs:
      - design-doc

  - id: implementation
    name: Implementation
    description: 코드 구현
    parallel: true               # 병렬 실행 그룹
    dependsOn: [design]
    tasks:
      - id: impl-frontend
        agent: frontend
        condition: "{{HAS_FRONTEND}}"
        task: |
          프론트엔드 구현:
          {{FRONTEND_TASKS}}

      - id: impl-backend
        agent: backend
        condition: "{{HAS_BACKEND}}"
        task: |
          백엔드 구현:
          {{BACKEND_TASKS}}

  - id: verification
    name: Verification
    description: 테스트 및 검증
    agent: qa
    dependsOn: [implementation]
    task: |
      구현 결과 검증:
      1. 단위 테스트 실행
      2. 통합 테스트
      3. 버그 리포트
    outputs:
      - test-report
    gate:                        # 승인 게이트
      type: quality
      criteria:
        - all-tests-pass
        - no-critical-bugs

  - id: deployment
    name: Deployment
    description: 빌드 및 배포
    agent: devops
    dependsOn: [verification]
    optional: true               # 선택적 단계
    condition: "{{DEPLOY_ENABLED}}"
    task: |
      배포 실행:
      1. 빌드
      2. 컨테이너 배포
      3. 헬스체크
    outputs:
      - deployment-log

  - id: documentation
    name: Documentation
    description: 문서 업데이트
    agent: documenter
    dependsOn: [implementation]
    parallel: true               # deployment와 병렬 가능
    task: |
      문서 업데이트:
      1. README 업데이트
      2. CHANGELOG 추가
      3. API 문서 (필요시)
    outputs:
      - documentation

# 체크포인트 설정
checkpoints:
  enabled: true
  stages: [design, implementation, verification]

# 실패 처리
onFailure:
  strategy: pause                # pause, rollback, continue
  notify: [webhook]
```

### workflows/quick.yaml

```yaml
# 빠른 수정 워크플로우
id: quick
name: Quick Fix
description: |
  분석 → 수정 → 검증
  긴급 버그 수정용 간소화 프로세스

stages:
  - id: investigate
    name: Investigate
    agent: pm                    # PM이 직접 Explorer 역할
    type: Explore
    task: |
      버그 원인 조사:
      {{BUG_DESCRIPTION}}

  - id: fix
    name: Fix
    agent: backend               # 또는 frontend, 자동 판단
    type: general-purpose
    dependsOn: [investigate]
    task: |
      버그 수정:
      {{FIX_PLAN}}

  - id: verify
    name: Verify
    agent: qa
    dependsOn: [fix]
    task: |
      수정 검증:
      1. 버그 재현 불가 확인
      2. 회귀 테스트

checkpoints:
  enabled: false                 # 빠른 처리를 위해 비활성화

onFailure:
  strategy: continue
```

---

## 프롬프트 템플릿

### prompts/pm.md

```markdown
# Project Manager

## Role
당신은 이 팀의 프로젝트 매니저입니다.

## Team
{{TEAM_NAME}}

## Project Goal
{{PROJECT_GOAL}}

## Available Agents
{{AGENT_LIST}}

## Responsibilities
1. 사용자 요청을 분석하여 구체적인 태스크로 분해
2. 적절한 에이전트에게 태스크 할당
3. 의존성을 고려한 실행 순서 결정
4. 진행 상황 모니터링 및 보고
5. 결과물 통합 및 최종 보고

## Workflow
현재 워크플로우: {{WORKFLOW_NAME}}

### Stages
{{WORKFLOW_STAGES}}

## Context
{{PROJECT_CONTEXT}}

## Output Format
[표준 PM 출력 포맷...]
```

### prompts/frontend.md

```markdown
# Frontend Developer

## Role
당신은 프론트엔드 개발자입니다.

## Team
{{TEAM_NAME}}

## Project
- Name: {{PROJECT_NAME}}
- Goal: {{PROJECT_GOAL}}
- Tech Stack: {{TECH_STACK}}

## Expertise
- React / Next.js
- TypeScript
- Tailwind CSS
- 상태 관리 (Zustand, Redux)

## Available Tools
- 파일 편집: Read, Edit, Write
- 검색: Glob, Grep
- 코드 분석: mcp__serena__* (Serena MCP)

## Task
{{TASK_DESCRIPTION}}

## Previous Stage Output
{{PREVIOUS_OUTPUT}}

## Guidelines
1. 기존 코드 스타일 준수
2. TypeScript strict mode
3. 컴포넌트 재사용성 고려
4. 접근성 준수

## Output
구현 완료 후 다음 형식으로 보고:
[출력 포맷...]
```

---

## 템플릿 예시들

### 1. web-dev-team (웹 개발)
```
agents: pm, frontend, backend, devops, qa, documenter
workflows: standard, quick, feature-flag
```

### 2. design-team (디자인)
```
agents: pm, art-director, ui-designer, ux-researcher, motion-designer
workflows: design-sprint, review-iteration
```

### 3. data-team (데이터)
```
agents: pm, data-engineer, ml-engineer, analyst, dba
workflows: etl-pipeline, model-training, analysis
```

### 4. mes-team (MES/제조)
```
agents: pm, plc-developer, scada-developer, dba, qa
workflows: standard, safety-critical
```

### 5. content-team (콘텐츠)
```
agents: pm, writer, editor, seo-specialist, publisher
workflows: content-creation, review-publish
```

### 6. devops-team (인프라)
```
agents: pm, infra-engineer, security-engineer, sre, dba
workflows: provision, migration, incident-response
```

---

## 커스텀 템플릿 생성

### 1. 기존 템플릿 확장

```yaml
# my-custom-team/meta.yaml
extends: web-dev-team            # 기반 템플릿
version: 1.0.0

# 추가/수정할 에이전트
agents:
  security-auditor:              # 새 에이전트 추가
    name: Security Auditor
    type: general-purpose
    prompt: prompts/security.md

  frontend:                      # 기존 에이전트 수정
    expertise:
      - Vue.js                   # React 대신 Vue
      - Nuxt.js
```

### 2. 완전 새로운 템플릿

```bash
# 템플릿 스캐폴딩 (MCP 도구)
team_create_template({
  id: "my-team",
  name: "My Custom Team",
  baseTemplate: null,            # 처음부터 생성
  agents: ["pm", "developer", "qa"]
})
```

---

## 템플릿 배포

### GitHub 레지스트리 등록

```yaml
# .team-registry.yaml (레포지토리 루트)
templates:
  - path: templates/web-dev
    id: web-dev-team
    public: true

  - path: templates/design
    id: design-team
    public: true

  - path: templates/internal
    id: internal-team
    public: false                # 비공개
```

### 설치

```typescript
// MCP 도구로 설치
team_import({
  source: "github.com/my-org/team-templates/web-dev",
  targetPath: "."
})
```
