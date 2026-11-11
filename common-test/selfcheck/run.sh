#!/usr/bin/env bash
# 일부러 틀린 구현마다 공통 테스트를 돌려, 어떤 테스트가 결함을 잡는지 보여 준다 (바탕 : 종휘 구현)
# 아래 grep 은 TAP 형식('# fail', 'not ok')을 읽는다. Node 23 부터 기본 출력이 spec 이라 --test-reporter=tap 으로 고정한다
# 이 스크립트는 결과를 보여 주기만 한다 (판정 없음). 자동 판정은 selfcheck/inspection.test.js (IA) 가 한다
set -u
cd "$(dirname "$0")/.."
SRC="${JONGHWI_ROOT:-D:/KraftonJungle/sw-ai-week11-12}"
TMP="$(mktemp -d)"
for m in travel-actual-only no-history full-mount travel-no-baseline; do mkdir -p "$TMP/$m"; cp -r "$SRC"/{index.html,app.js,style.css,src} "$TMP/$m/"; done
sed -i 's/^\(    \)showInTestArea(shown);\(.*\)$/&/' "$TMP/travel-actual-only/app.js"
# travel 안의 showInTestArea 만 지운다 (travel 함수 블록 안 첫 번째)
awk '/function travel/{t=1} t&&/showInTestArea\(shown\);/{sub(/showInTestArea\(shown\);/,"/* mutant */");t=0} {print}' "$SRC/app.js" > "$TMP/travel-actual-only/app.js"
sed -i 's/shown = history.push(next);/shown = next;/' "$TMP/no-history/app.js"
sed -i 's/const mutations = apply(patches, next);/M.mount(actualEl, next); const mutations = 0;/' "$TMP/full-mount/app.js"
# Patch 의 비교 기준을 따로 들고 뒤로 · 앞으로 때 안 옮김 (v2 P-15 용)
node selfcheck/make-baseline-mutant.js "$SRC/app.js" "$TMP/travel-no-baseline/app.js"
for m in full-rerender noop no-remove no-props no-text innerhtml-text; do
  r=$(MUTANT=$m ADAPTER=selfcheck/mutant-adapter.js node --test --test-reporter=tap tests/module.test.js 2>&1)
  echo "module $m : $(echo "$r" | grep -E '^# fail') : $(echo "$r" | grep -E '^not ok' | grep -oE '\[M-[0-9]+\]' | tr '\n' ' ')"
done
for m in travel-actual-only no-history full-mount travel-no-baseline; do
  r=$(MUTANT=page-$m MUTANT_PAGE_ROOT="$TMP/$m" ADAPTER=selfcheck/mutant-adapter.js node --test --test-reporter=tap tests/page.test.js 2>&1)
  echo "page $m : $(echo "$r" | grep -E '^# fail') : $(echo "$r" | grep -E '^not ok' | grep -oE '\[P-[0-9]+\]' | tr '\n' ' ')"
done
rm -rf "$TMP"
