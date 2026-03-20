# NOA 소설 스튜디오 코드 리뷰

## 프로젝트 개요
Google Gemini API 기반 AI 소설 집필 도구. React + TypeScript + Vite 스택, 자체 "EH(Human Error)" 서사 엔진 내장. 4개 국어(KO/EN/JP/CN) 지원을 목표로 함.

---

## 1. 아키텍처 (구조)

**장점:**
- `engine/`, `services/`, `components/`로 레이어가 명확히 분리됨
- 엔진 레이어(tensionCurve, scoring, validation, serialization)가 서비스와 독립적으로 동작
- 타입 정의가 별도 파일로 잘 분리됨

**문제점:**
- **상태 관리가 분산됨**: `App.tsx`에 모든 상태가 집중(God Component 패턴). sessions, config, UI state, generation state가 한 컴포넌트에 혼재. Context API나 상태관리 라이브러리 도입 필요
- **localStorage 직접 접근이 여러 곳에 산재**: `App.tsx`, `SettingsView.tsx`, `geminiService.ts`, `PlanningView.tsx` 등에서 각각 독립적으로 localStorage를 읽고 씀 → 동기화 버그 위험
- **설정값 이중 관리**: temperature, platform, defaultEpisodes가 `StoryConfig`와 localStorage에 별도로 저장됨

## 2. 심각한 버그 / 잠재적 문제

| 위치 | 문제 | 심각도 |
|------|------|--------|
| `scoring.ts:11-20` | 감정/감각 키워드가 **한국어만** 지원. EN/JP/CN 소설 분석 시 EOS 점수가 항상 0에 가까움 | **높음** |
| `validator.ts` 전체 | AI 톤 감지, 오타 수정, 반복 검출 모두 **한국어 전용**. 다국어 지원이 사실상 무효 | **높음** |
| `constants.ts:7` | `ENGINE_VERSION = "10.0"`이지만 시스템 프롬프트에는 `ANS 9.5 (BETA)`로 표기 — 버전 불일치 | 중간 |
| `geminiService.ts:29` | 히스토리 `.slice(-20)` 주석은 "last 10 exchanges"라 적혀있으나 실제 20개 메시지 | 낮음 |
| `RulebookView.tsx:63,67` | `dangerouslySetInnerHTML` 사용 — 번역 데이터가 오염되면 XSS 취약점 | 중간 |
| `PlanningView.tsx:22-34` | 데모 데이터가 언어 설정과 무관하게 **항상 한국어**로 삽입됨 | 중간 |
| `PlanningView.tsx` | min/max guardrails에 `min > max` 검증 없음 | 중간 |
| `ResourceView.tsx` | 캐릭터 삭제에 확인 다이얼로그 없음 — 실수로 삭제 위험 | 낮음 |

## 3. 코드 품질

**매직 넘버 과다:**
- `models.ts`: `omega = 2 * Math.PI * 2.5`, `0.80`, `0.05`, `2.0` 등 설명 없는 상수
- `scoring.ts`: EOS 가중치 `35, 25, 25, 15` 근거 불명
- `serialization.ts`: 바이트 범위 `9500~15500` 하드코딩

**성능:**
- `EngineDashboard.tsx`: `generateTensionCurveData()`가 매 렌더마다 재계산 — `useMemo` 필요
- `EngineStatusBar.tsx`: `getActFromEpisode()`도 매 렌더마다 재계산
- `App.tsx:81`: sessions 배열 전체를 JSON으로 직렬화하여 localStorage에 저장 — 대화가 길어지면 성능 저하

**중복 코드:**
- `handleSend`와 `handleRegenerate`가 거의 동일한 스트리밍/상태 업데이트 로직을 중복 구현 (App.tsx:154-290)
- 각 언어별 확인 메시지가 인라인 객체로 반복 생성 (`deleteSession`, `clearAllSessions`)

## 4. 타입 안정성

- `constants.ts:70`: `TRANSLATIONS`가 `Record<AppLanguage, any>` — 타입 검사 무력화. 번역 키 누락을 컴파일 타임에 잡지 못함
- `App.tsx:141`: `setConfig`의 파라미터가 `any` — StoryConfig 타입 보장 없음
- `geminiService.ts`: API 응답 파싱에서 타입 가드 없이 직접 캐스팅

## 5. 보안

- **API 키가 localStorage에 평문 저장** — 브라우저 XSS 공격 시 탈취 가능
- `dangerouslySetInnerHTML` 사용 (RulebookView) — 번역 데이터가 외부 입력이 아니므로 현재는 안전하나, 향후 사용자 정의 번역 시 위험
- `validator.ts:158-164`의 IP 방화벽(저작권 단어 검출)은 정규식 기반으로 쉽게 우회 가능

## 6. UX / 기능적 문제

- **Sidebar.tsx, InputArea.tsx가 사용되지 않음**: `App.tsx`에서 import하지 않고 인라인으로 구현됨 — 데드 코드
- `localService.ts`: 로컬 모드 서비스가 존재하나 App에서 사용하는 진입점 없음
- **SettingsView.tsx**: "프리미엄 멤버십: ACTIVE" 하드코딩, 알림 토글 기능 미구현, 엔진 레이턴시 "OPTIMAL" 하드코딩
- 모바일 반응형: `EngineDashboard`가 고정 너비(w-80) — 작은 화면에서 오버플로우

## 7. 개선 권장사항 (우선순위순)

1. **다국어 지원 보완**: `scoring.ts`와 `validator.ts`에 EN/JP/CN 키워드 사전 추가
2. **상태 관리 리팩터링**: React Context 또는 Zustand 등으로 전역 상태 분리, localStorage 접근을 단일 서비스로 통합
3. **TRANSLATIONS 타입 강화**: `any` 대신 인터페이스 정의하여 번역 키 누락 방지
4. **중복 로직 추출**: `handleSend`/`handleRegenerate` 공통 로직을 커스텀 훅으로 추출
5. **미사용 코드 정리**: `Sidebar.tsx`, `InputArea.tsx`, `localService.ts` 정리 또는 통합
6. **성능 최적화**: 대시보드/상태바에 `useMemo` 적용, sessions 저장에 debounce 적용
7. **입력 검증 추가**: guardrails min/max, 캐릭터 필수값, 에피소드 범위 등

## 종합 평가

| 항목 | 점수 (10점 만점) |
|------|:---:|
| 코드 구조 | 6 |
| 타입 안전성 | 4 |
| 다국어 지원 | 3 |
| 버그/안정성 | 5 |
| 성능 | 5 |
| 보안 | 5 |
| 코드 중복 | 4 |
| UX 완성도 | 6 |

전체적으로 프로토타입/MVP 단계의 코드입니다. 엔진 레이어의 설계(tension curve, EOS scoring, 5-act 구조)는 흥미로운 접근이지만, **다국어 지원이 한국어에만 실질적으로 작동**하는 것이 가장 큰 문제입니다.
