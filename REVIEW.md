# mini-react 리뷰

> 대상: `feat-Jeonghyeok` 브랜치, 커밋 `665bc1b` 기준. 2026-11-10 작성.
> 작성 기준: 실제로 돌린 테스트 결과와 코드를 직접 읽은 내용만 적었습니다. 돌리지 않은 것은 "안 함"으로 표시했습니다.
>
> **이해 충돌**: 작성자가 이 구현을 직접 만들었습니다. 자기 코드를 보고 쓴 리뷰이므로, 교차 검증이 필요합니다.

---

## 1. 실제로 돌린 결과

| 대상 | 명령 | 결과 |
|---|---|---|
| 프로젝트 테스트 | `npm run test:run` | 350개 실행 · 통과 350 · 실패 0 · 건너뜀 0 · todo 0 |
| 공통 인수 테스트 (Phase 1) | `npm run test:common` | 78개 실행 · 통과 78 · 실패 0 · 건너뜀 0 · todo 0 |
| 전체 | `npm run test:all` | 위 두 개를 이어서 실행, 428개 통과 |

- 파일별 `it(` 호출 수는 312개입니다. 실행 수 350과 맞지 않습니다. 차이의 원인은 확인하지 않았습니다.
- 공통 인수 테스트는 `adapters/jeonghyeok.js`로 연결했습니다. 다른 팀 구현에서는 돌리지 않았습니다.

**돌리지 않은 것**
- 브라우저에서 직접 열어 본 확인 (레이아웃, 다크 모드, 타이머 알림)
- 일부러 틀린 구현을 넣어 테스트가 잡는지 보는 검사 (1장 3절 참고)
- 다른 구현(민기·정혁)과의 대조

---

## 2. 필수 요구사항 충족표

| 요구사항 | 구현 위치 | 테스트 위치 | 상태 |
|---|---|---|---|
| Virtual DOM 변환 | `src/phase1/dom-to-vdom.ts` (`domToVdom`, `htmlToVdom`), `vdom-to-html.ts` | `phase1/dom-to-vdom.test.ts` (18), `phase1/vdom-to-html.test.ts` (6) | 통과 |
| Diff (추가·삭제·교체·속성·글자) | `src/phase1/diff.ts` (`diffNode`, `diffProps`, `diffChildren`) | `phase1/diff.test.ts` (31) | 통과 |
| Patch로 실제 DOM 반영 | `src/phase1/patch.ts` (`applyPatches`, `createDom`) | `phase1/patch.test.ts` (27) | 통과 |
| 히스토리 (뒤로·앞으로·버전 이동) | `src/phase1/history.ts` (`VdomHistory`), `src/app/controls.ts` | `phase1/history.test.ts` (7), `app/controls.test.ts` (8) | 통과 |
| FunctionComponent | `src/phase2/function-component.ts` | `phase2/function-component.test.ts` (27) | 통과 |
| Hook은 루트 컴포넌트에서만 | `function-component.ts` (`getHookOwner`, `renderStateless`) | `phase2/function-component.test.ts`, `phase2/h.test.ts` (19) | 통과 |
| useState · useEffect · useMemo | `src/phase2/hooks/` 세 파일 | `phase2/hooks/` 세 테스트 (11 · 15 · 7) | 통과 |
| 두 페이지 (Diff 실험실, 집중 보드) | `src/app/lab-page.ts`, `src/app/test-page.ts` | `app/lab-page.test.ts` (30), `app/test-page.test.ts` (96) | 통과 |
| 프레임워크 미사용 | `package.json`에 `dependencies` 없음, `devDependencies`는 `jsdom`·`typescript`·`vite` | — | 확인 |

**주의**: "통과"는 테스트가 있고 돌려서 성공했다는 뜻입니다. 테스트가 결함을 잡는지는 3장을 보세요.

---

## 3. 테스트가 결함을 잡는지

**아직 확인하지 않았습니다.** 일부러 틀린 구현(예: 결과는 맞지만 매번 통째로 다시 그리는 Diff, 속성 변경을 빠뜨린 Patch)을 넣고 실패하는지 본 적이 없습니다.

확인할 후보:

| 일부러 넣을 결함 | 기대하는 실패 테스트 |
|---|---|
| Diff가 자식 목록을 항상 통째로 교체 | `diff.test.ts`의 "바뀐 부분만" 계열 |
| `applyPatches`가 `PROPS`의 `remove`를 무시 | `patch.test.ts` |
| `VdomHistory.push`가 미래 기록을 지우지 않음 | `history.test.ts` |
| `useEffect`가 deps를 무시하고 매번 실행 | `use-effect.test.ts` |

이 표는 계획입니다. 실행 결과는 아직 없습니다.

---

## 4. 설계 선택과 근거

| 주제 | 선택 | 이유 |
|---|---|---|
| 리스트 이동 | LIS 기반 (`longestIncreasingSubsequence`) | 가만히 둘 노드를 최대로 골라 이동 횟수를 줄이기 위해 |
| 자식 짝짓기 | 신분(`identityOf`)별 대기열 + 2차 짝짓기 | key가 중복되어도 결과가 틀어지지 않게 하기 위해 |
| 연산 순서 | 내부 연산 → 삭제(뒤에서) → 삽입·이동(뒤에서) | 연산의 `path`가 옛 트리 번호 그대로 맞게 하기 위해 |
| 상태 변경 | 마이크로태스크 배칭 (`scheduleUpdate`) | 한 이벤트 안의 변경을 렌더 1번으로 합치기 위해 |
| 이벤트 핸들러 | 요소마다 핸들러 표, `addEventListener`는 종류별 1번 | 렌더마다 새 함수가 와도 DOM 작업이 생기지 않게 하기 위해 |
| Hook 규칙 | 개수·종류가 바뀌면 오류 (`claimSlot`, `render`) | 틀린 상태로 조용히 돌지 않게 하기 위해 |
| effect의 deps | 렌더가 아니라 실행 시점에 저장 | 렌더가 도중에 실패하면 실행하지 않은 것으로 보기 위해 |
| 무한 렌더 | 한 틱에 50번 넘으면 멈추고 경고 | 브라우저가 멈추지 않게 하기 위해 |

---

## 5. 정상 구현이 실패할 수 있는 경우 / 결함이 통과할 수 있는 경우

### 결함이 통과할 수 있는 경우 (코드를 읽고 찾은 것, 재현 안 함)

| 위치 | 내용 | 테스트 확인 |
|---|---|---|
| `diff.ts`의 `diffProps` | 같은 이름이 글자 값에서 함수로 바뀌면 옛 속성이 지워지지 않을 수 있음 | 안 함 |
| `patch.ts`의 `eventTypeOf` | `on` 접두사를 확인하지 않고 앞 두 글자를 자름 | 안 함 |
| `dom-to-vdom.ts`의 `isAllowedAttribute` | `iframe`의 `srcdoc` 속성을 막지 않음 | 안 함 |
| `function-component.ts`의 `flushEffects` | effect 안에서 `unmount()`를 부르면 남은 effect가 그 뒤에도 실행됨 | 안 함 |
| `diff.ts`의 `diffChildren` | 목록을 통째로 뒤집으면 이동 단계가 O(n²). 할 일 한도(20개)에서는 문제없음 | 성능은 안 함 |

### 정상 구현이 실패할 수 있는 경우

- 이 테스트는 우리 API(`h`, `diff`, `applyPatches`, `FunctionComponent`)에 맞춰 쓰였습니다. 다른 방식으로 짠 구현은 모듈 테스트에서 실패할 수 있습니다. 공통 인수 테스트는 DOM 기준으로 비교하도록 만들어서 이 문제를 줄였지만, 다른 구현에서는 아직 확인하지 않았습니다.
- 실제 브라우저의 레이아웃, 이미지 로드, 포커스는 jsdom에서 확인할 수 없습니다.

---

## 6. 검토 항목별

| 항목 | 결과 |
|---|---|
| 요구사항 누락 | 필수 요구사항은 모두 테스트 위치가 있습니다. 히스토리 30개 한도와 타이머 종료는 화면에서만 확인했습니다. |
| 잘못된 기대값 | 확인 안 함. 기대값을 손으로 쓴 곳이 있는지 전수 검토하지 않았습니다. |
| 불필요하게 엄격한 조건 | 확인 안 함 |
| 테스트 간 상태 간섭 | 확인 안 함. 페이지 테스트가 매번 새 DOM을 쓰는지만 코드에서 봤습니다. |
| 문서와 저장소 상태 | `docs/` 파일 3개가 지워진 상태이고, README가 세 곳에서 그 파일을 링크합니다. 삭제를 커밋하면 링크가 끊깁니다. |

---

## 7. 아직 안 한 것

- 결함 주입 검사 (3장 표)
- 브라우저 수동 확인
- 다른 구현(민기·정혁)과의 공통 테스트 대조
- 공통 인수 테스트 Phase 2 (내일 받을 예정)
- 5장에서 찾은 4개 문제의 재현과 수정 (지난번 수정은 되돌렸습니다)
- README의 "테스트" 절과 "구조" 그림에 `common-test/` 추가

---

## 8. 리뷰어에게 묻고 싶은 것

- [ ] `matchChildren`의 2차 짝짓기(key 없는 노드끼리)가 적절한가요?
- [ ] 무한 렌더를 "한 틱에 50번" 카운터로 판정하는 방식에서 놓치는 경우가 있을까요?
- [ ] 5장의 4개 문제 중 우선순위가 높은 것은 무엇인가요?

---

## 9. 읽는 순서와 실행

| 순서 | 파일 | 읽을 이유 |
|---|---|---|
| 1 | `src/phase1/types.ts` | `VNode`와 `Patch`의 모양 |
| 2 | `src/phase1/diff.ts` | 연산 7종이 만들어지는 곳 |
| 3 | `src/phase1/patch.ts` | 연산을 DOM에 반영하는 곳 |
| 4 | `src/phase2/function-component.ts` | render → claimSlot → scheduleUpdate → flushEffects |
| 5 | `src/phase2/hooks/` | 세 Hook이 칸을 받는 방식 |
| 6 | `src/phase2/h.ts` | 자식 컴포넌트가 펼쳐지는 곳 |
| 7 | `src/app/lab-page.ts`, `src/app/test-page.ts` | 위 모듈을 쓰는 두 페이지 |

| 목적 | 방법 |
|---|---|
| 화면 보기 | `mini-react.html` 더블클릭 (설치 불필요) |
| 전체 테스트 | `npm install` 후 `npm run test:all` |
| 프로젝트 테스트만 | `npm run test:run` |
| 공통 인수 테스트만 | `npm run test:common` |
