/* IA 검사 전용 reporter : 테스트 하나의 결과를 한 줄짜리 JSON 으로 내보낸다
   사람이 읽는 출력(tap · spec)은 Node 버전마다 기본 형식과 문구가 달라서,
   IA 판정은 이 reporter 가 내보낸 구조화된 결과만 본다 (inspection.test.js 참고) */
'use strict';

const MARK = '@@IA-RESULT@@';

/* 실패 정보에서 판정에 쓰는 값만 꺼내는 함수
   node:test 는 테스트 코드에서 던진 오류를 ERR_TEST_FAILURE 로 감싸고 원래 오류를 cause 에 둔다 */
function errorInfo(error) {
  if (!error || typeof error !== 'object') return null;
  const cause = error.cause && typeof error.cause === 'object' ? error.cause : null;
  const src = cause || error;
  return {
    failureType: error.failureType ?? null,
    code: src.code ?? null,
    name: src.name ?? null,
    message: typeof src.message === 'string' ? src.message : String(src.message ?? ''),
    operator: src.operator ?? null,
    generatedMessage: typeof src.generatedMessage === 'boolean' ? src.generatedMessage : null,
  };
}

async function* iaReporter(source) {
  for await (const event of source) {
    if (event.type !== 'test:pass' && event.type !== 'test:fail') continue;
    const d = event.data || {};
    yield `${MARK}${JSON.stringify({
      result: event.type === 'test:pass' ? 'pass' : 'fail',
      name: d.name,
      nesting: d.nesting,
      skip: d.skip !== undefined && d.skip !== false,
      todo: d.todo !== undefined && d.todo !== false,
      error: event.type === 'test:fail' ? errorInfo(d.details && d.details.error) : null,
    })}\n`;
  }
}

module.exports = iaReporter;
module.exports.MARK = MARK;
