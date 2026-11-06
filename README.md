#[미니 리액트 개발 환경 명령어 정리]

■ 0. Node.js 설치 (컴퓨터에 한 번만)
- 방법 A: 공식 설치 파일 (Windows / macOS 공통)
  - nodejs.org 접속 → LTS 버전 다운로드
  - Windows: .msi 실행 → 기본값으로 Next 진행
  - "Automatically install the necessary tools" 체크박스는 체크 안 해도 됨
  - macOS: .pkg 실행 → 기본값으로 진행
- 방법 B: 명령어로 설치 (Windows)
  - winget install OpenJS.NodeJS.LTS
- 설치 후 열려 있던 터미널과 VS Code는 완전히 껐다가 다시 열기

■ 1. Node 설치 확인 (nodejs.org에서 LTS 설치 후)
- node -v
- npm -v
- 버전이 안 나오면 터미널 또는 VS Code 재시작

■ 2. 프로젝트 생성 (Vite + TypeScript)
- npm create vite@latest mini-react -- --template vanilla-ts
- cd mini-react
- npm install
- 중간에 질문이 나오면 기본값 선택해도 됨

■ 3. 테스트 도구 설치
- npm install -D vitest jsdom
- npm pkg set "scripts.test=vitest"
- npm pkg set "scripts.test:run=vitest run"
- 프로젝트 루트에 vite.config.ts 파일 생성 (아래 코드)

■ 4. 개발 중 자주 쓰는 명령어
- npm run dev          → 개발 서버 실행 (localhost:5173)
- npm test             → 테스트 감시 모드 (저장할 때마다 자동 실행)
- npm run test:run     → 테스트 한 번만 실행
- npx tsc --noEmit     → 타입 에러만 검사
- npm run build        → 배포용 빌드 (dist 폴더 생성)
- npm run preview      → 빌드 결과 미리보기

■ 5. 팀원이 저장소 받았을 때
- git clone <저장소 주소>
- cd mini-react
- npm install
- npm run dev
- node_modules, dist는 .gitignore에 이미 포함되어 있음

■ 6. 문제 해결
- PowerShell에서 "스크립트를 실행할 수 없습니다" 에러 발생 시
  → Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
- 포트 충돌 시 → npm run dev -- --port 3000
