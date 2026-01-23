# Citadel POW

**Proof of Work: Life of Satoshi**

당신의 노력이 곧 작업증명입니다.

## POW Citadel이란?

POW Citadel은 비트코인의 작업증명(Proof of Work) 철학을 일상에 적용한 앱입니다.

비트코인 채굴기가 연산력으로 작업을 증명하듯, 우리는 **시간과 노력**으로 자신의 성장을 증명합니다. 공부, 운동, 창작 활동 등 어떤 분야든 목표를 세우고 실행한 시간만큼 sats(비트코인의 최소 단위)로 환산하여 기부합니다.

## 왜 만들었나?

Citadel 커뮤니티는 비트코인을 단순한 투자 자산이 아닌, **삶의 철학**으로 받아들입니다.

- 낮은 시간선호: 즉각적인 만족보다 장기적 성장을 추구
- 작업증명: 노력 없이 얻는 것은 없다
- 선순환: 내가 기부한 sats가 열심히 노력한 사람에게 돌아간다

기부금은 Citadel에 누적되어, 리더보드 상위권 멤버에게 **장학금**처럼 돌아가는 선순환 구조입니다. 스스로 기부했지만, 꾸준히 노력한 자에게 보상이 돌아옵니다.

## 사용 흐름

### 1. 로그인
- Citadel 디스코드 계정으로 로그인
- 디스코드 역할(비트코이너/풀노더)에 따라 접근 권한 부여

### 2. POW 시작
- 분야 선택 (공부, 운동, 독서, 글쓰기, 음악, 영상제작, 봉사)
- 목표 내용과 목표 시간 설정
- 타이머 시작

### 3. POW 완료
- 실제 수행 시간 기록
- 달성률(%) 계산
- 달성률에 비례하여 sats 산정

### 4. 인증 & 공유
- 사진/동영상으로 인증
- 인증카드 자동 생성
- 디스코드 채널에 자동 공유

### 5. 기부
- Lightning Network로 즉시 기부
- 또는 sats 적립 후 나중에 일괄 기부

## 주요 기능

- **개인 POW**: 혼자서 목표를 세우고 실행
- **그룹 POW**: 함께 모여서 POW 진행
- **리더보드**: 주간/월간 POW 랭킹
- **Discord 연동**: 인증카드 자동 공유, 리액션 추적
- **Lightning 결제**: Blink API를 통한 즉시 기부

## 기술 스택

- Next.js 16 (App Router)
- TypeScript
- Supabase (Database & Storage)
- Discord OAuth & Bot API
- Blink Lightning API
- Zustand (State Management)
- PWA Support

## 앱 사용하기

**웹 브라우저**
- [pow-citadel.vercel.app](https://pow-citadel.vercel.app) 접속

**PWA 설치 (모바일)**
1. 브라우저에서 앱 접속
2. "홈 화면에 추가" 선택
3. 앱처럼 사용

---

*Citadel 커뮤니티 전용 앱입니다.*
