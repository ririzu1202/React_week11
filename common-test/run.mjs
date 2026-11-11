// 공통 인수 테스트(Phase 1)를 이 프로젝트에 연결해 돌린다. 사용: npm run test:common
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const cwd = fileURLToPath(new URL('.', import.meta.url))
const files = ['tests/module.test.js', 'tests/page.test.js', 'selfcheck/ia-judge.test.js', 'selfcheck/inspection.test.js']
const result = spawnSync(process.execPath, ['--test', ...files], {
  cwd,
  stdio: 'inherit',
  env: { ...process.env, ADAPTER: process.env.ADAPTER || 'adapters/jeonghyeok.js' },
})
process.exit(result.status ?? 1)
