# 미니 React Phase 1 공통 테스트

세 구현에 똑같이 적용하는 블랙박스 인수 테스트. 11-09 스크럼에서 정한 리뷰 방식 ①단계 산출물.

- **v2 (11-09 오후 4시 회의 반영)** : P-15 추가 (뒤로가기 뒤 Patch), 처음 화면 저장 · 입력은 `input` 만 결정 기록 → 테스트 55 개 (필수 50 + 선택 5). 바뀐 내용은 [REVIEW.md](REVIEW.md) 맨 위
- **v3 (v2 + updated 합침)** : v2 를 바탕으로 검사 정확도 테스트(IA-01 ~ IA-08)와 선택 테스트 M-41(J9)을 더했다. 선택 테스트는 todo 가 아니라 pass/fail 로 센다 → 기능 테스트 56 개 (필수 50 + 선택 6) + 검사 정확도 8 개
- **v3.1 (IA 판정 보강)** : 목표 Assertion 에 고정 표식(`[IA:M-29:value]` 등)을 붙여 문구가 바뀌어도 판정이 안 깨지게 함 · 판정 함수를 `selfcheck/ia-judge.js` 로 분리하고 판정기 자체 검사(IJ-01 ~ IJ-14) 추가 · 건너뜀 · todo · 중복 · 미실행 · 신호 종료는 "판정 불가" 로 따로 분류 · IA-07 을 `IA_ADAPTERS` 의 Adapter 마다 실행 → 기능 56 + 판정기 14 + 검사 정확도 8 = 78 개. Phase 2 테스트는 이 묶음에 넣지 않는다

| 문서 | 내용 |
| --- | --- |
| [SPEC.md](SPEC.md) | 요구사항 목록 · 매핑표 · 테스트 명세 · 판단 필요 항목 |
| [ADAPTER.md](ADAPTER.md) | 내 구현을 연결하는 법 |
| [REVIEW.md](REVIEW.md) | 자체 검토 · 미검증 사항 · 잔여 위험 |
| [ASSERTION_REVIEW.md](ASSERTION_REVIEW.md) | IA 검사 독립 검토와 후속 수정 |
| [ASSERTION_REVIEW_FULL.md](ASSERTION_REVIEW_FULL.md) | 독립 검증 B · 전체 테스트 Assertion 정확성 |
| [PROMPTS.md](PROMPTS.md) | 만들 때 쓴 프롬프트 · 연결 프롬프트 · 교차 검증(A · B · C) 프롬프트 |

## 실행

```bash
npm install
```

```bash
ADAPTER=adapters/내이름.js npm test
```

- Windows PowerShell : `$env:ADAPTER='adapters/내이름.js'; npm test`
- 검사 정확도 테스트만 : `ADAPTER=adapters/내이름.js npm run test:inspection`
- 정혁 구현 : `.\run-tests.ps1 "<구현 폴더>"` (또는 `run-tests.bat`) — `1` 전체, `2` 검사 정확도만
- 결과 읽기 : `fail 0` 이면 필수 테스트와 검사 정확도 테스트 통과. 선택 테스트도 pass/fail 에 들어간다 (실패하면 fail)
- 테스트 하나만 : `ADAPTER=… node --test --test-name-pattern "P-08" tests/page.test.js`

## 구성

```
lib/harness.js        정규화 비교 · 페이지 열기 · 읽기 쓰기 도구
tests/module.test.js  M-01 ~ M-41 (변환 · Diff · Patch)
tests/page.test.js    P-01 ~ P-15 (검증 페이지)
adapters/template.js  Adapter 틀
adapters/jonghwi.js   종휘 구현 Adapter
adapters/jeonghyeok.js 정혁 구현 Adapter
selfcheck/            테스트가 결함을 잡는지 보는 "일부러 틀린 구현" · 검사 정확도 테스트(IA)
```

- 필요 : Node 18.15 이상 (`node:test` 내장 · 검사 정확도 테스트가 전용 reporter 를 쓴다), `jsdom` (개발 의존성 하나)
- 현재 구성 : 기능 테스트 56개 (필수 50개 · 선택 6개, 모두 pass/fail 집계), 판정기 자체 검사 14개 (IJ-01 ~ IJ-14), 검사 정확도 테스트 8개 (IA-01 ~ IA-08)
  - IA-01 ~ 05 : 결함 다섯 개를 미리 정한 기능 테스트 하나씩(M-02 · M-29 · M-34 · P-03 · P-08)에 넣는다. 원래 구현은 그 테스트를 통과하고, 결함을 넣으면 그 테스트의 바로 그 Assertion 이 실패해야 "잡았다" 로 센다
  - IA-06 · IA-08 : 초기화 오류, 원래 구현이 이미 실패하는 테스트를 결함 탐지로 세지 않는지 본다
  - IA-07 : 폼 값을 프로퍼티로만 반영하는 정상 변형 하나가 모듈 필수 테스트에서 원래 구현보다 더 실패하지 않는지 본다 (선택 테스트 차이는 진단 메시지로만 표시). `IA_ADAPTERS` 에 Adapter 경로를 구분자(Windows `;`)로 이어 적으면 Adapter 마다 따로 검사한다. 없으면 `ADAPTER` 하나
  - 판정은 사람이 읽는 출력 글자가 아니라 `selfcheck/ia-reporter.js` 가 내보내는 구조화된 결과로 한다. "기대한 그 Assertion" 은 메시지 맨 앞의 고정 표식(`[IA:M-29:value]`) + 비교 연산으로 알아본다. 표식 뒤 설명 문구는 고쳐도 되지만 표식은 지우면 안 된다
  - 목표 테스트가 안 돌았거나 · 두 번 돌았거나 · 건너뛰었거나 · todo 이거나 · 자식 프로세스가 신호로 끝났으면(종료 코드 null) "못 잡음" 이 아니라 "판정 불가" 로 따로 표시한다
  - IJ-01 ~ 14 (`selfcheck/ia-judge.test.js`) : 가짜 결과로 판정 함수가 맞게 분류하는지 본다 (구현 · Adapter 불필요, `npm run test:judge`). IJ 통과는 판정 규칙이 맞다는 뜻이고, 실제 Adapter · Reporter 통합은 `npm run test:inspection` 으로 확인한다
  - 범위 : 결함 다섯 개 · 기능 테스트 다섯 개 · 정상 변형 하나 · 지금 연결한 Adapter 에 한정된다. 통과해도 다른 결함 · 다른 구현 · 다른 Adapter 에서 테스트가 맞다는 뜻은 아니다
