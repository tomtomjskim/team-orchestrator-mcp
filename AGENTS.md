# Repository Guidelines

## Project Structure & Module Organization

TypeScript 기반 MCP 서버다. 소스는 `src/`, 배포 산출물은 `dist/`, 템플릿은 `templates/`, 문서는 `docs/`에 둔다. 배포 대상은 `dist/index.js`이며 CLI 엔트리와 MCP 도구 정의가 이 출력물에 반영된다.

## Build, Test, and Development Commands

- `npm run build`: TypeScript 컴파일
- `npm run dev`: `ts-node src/index.ts` 개발 실행
- `npm run start`: 빌드된 `dist/index.js` 실행
- `npm run lint`: `src/` ESLint
- `npm test`: Jest 실행
- `npm run prepublishOnly`: 배포 전 빌드 검증

## Coding Style & Naming Conventions

ESM TypeScript 기준을 따른다. MCP 도구, 리소스, 워크플로우 로직은 역할별로 분리하고, 타입은 명시적으로 선언한다. 템플릿 이름과 tool 이름은 README에 문서화된 공개 인터페이스를 함부로 깨지 않도록 유지한다.

## Testing Guidelines

테스트는 MCP 도구와 워크플로우 실행 경로를 중심으로 추가한다. 새 도구를 추가하면 입력 검증, 정상 흐름, 실패 응답을 최소 한 번씩 검증한다. 릴리스 전에는 `npm run build`와 `npm test`를 함께 실행한다.

## Commit & Pull Request Guidelines

최근 커밋은 `feat:`, `docs:`, `chore:`를 사용한다. PR에는 추가/변경된 MCP 도구, 템플릿 영향, 공개 설정 포맷 변경 여부를 적는다.

## Release Notes

이 패키지는 npm 배포를 전제로 하므로 `bin`, `files`, `dist/` 출력이 깨지지 않는지 항상 확인한다.

## Codex Project Guide Adoption

- 전역 개인 지침과 skill은 `/home/ubuntu/.codex/`와 `/home/ubuntu/.agents/`를 사용하며, 이 repo에 vendoring하지 않는다.
- MCP/tool contract 변경은 `agent-architecture-readiness`, 보안/권한 표면 변경은 `security-reviewer` 또는 `agent-adversarial-review` 관점으로 검토한다.
- tool schema, provider behavior, subprocess execution, filesystem/network 권한은 backward compatibility와 abuse risk를 함께 확인한다.
- credentials, local server state, raw tool logs with secrets는 읽거나 wiki/문서에 기록하지 않는다.
- 완료 보고에는 변경 요약, 실행한 검증, 생략한 검증과 이유, 남은 리스크를 포함한다.
