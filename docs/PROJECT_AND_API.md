# MUSETTING 프로젝트 및 AxPay API 정리

이 문서는 프로젝트 맥락과 AxPay API(가이드 Rev 12.10)를 한곳에 정리한 것입니다. 새 채팅이나 다른 개발자가 참고할 수 있습니다.

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 이름 | MUSETTING (가맹점 "벳이스트" 전용) |
| 스택 | Next.js 14 (App Router), TailwindCSS, Shadcn UI, Prisma, PostgreSQL(Neon), Telegram Bot, Netlify, AxPay |
| 인증 | bcrypt + 쿠키 세션 (`AUTH_SECRET`), API 호출 시 `credentials: "include"` 필수 |
| 저장소 | GitHub `aklexwang/musetting`, Netlify 예: `papaya-sorbet-3708f7.netlify.app` |

**환경 변수**: `AUTH_SECRET`, `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`, `AXPAY_TOKEN`, `AXPAY_BASE_URL`, (선택) `SYNC_SECRET`

---

## 2. 사용자/거래 흐름

- **첫 화면 (/)**  
  로그인 폼 + 회원가입 링크. 로그인 후: 금액 입력 + 구매/판매 버튼 → 2차 확인 → `POST /api/transactions` → 성공 시 `/dashboard` 이동.

- **회원가입**  
  은행명 드롭다운(한국 은행 리스트). 가입 후 "가입승인 대기중". 텔레그램에서 관리자 승인 시 "승인되었습니다." 후 로그인 화면으로.

- **텔레그램 /start**  
  `이 채팅방은 가맹점 "벳이스트" 전용방입니다.\n궁금하신점은 본사로 문의주세여`

- **거래**  
  금액: 만 원 단위만 (최소 1만). `POST /api/transactions` → DB PENDING + 관리자 텔레그램 알림(승인/거절).

- **관리자 승인**  
  텔레그램 [승인] → `lib/axpay.ts` `login()` 호출 → 성공 시 Transaction에 `axpayUrl`, `axpayOrderId`, apiStatus IDLE. 실패 시 APPROVED + apiStatus FAILED. 메시지에 구매/판매 구분.

- **대시보드**  
  거래 신청 폼, 처리 중 표시, 승인 건 중 `axpayUrl` 있으면 **iframe**으로 AxPay 매칭 화면 표시.

- **동기화**  
  `GET /api/transactions/sync` 20초 주기. order_query → status 1 또는 2이면 order_callback 후 apiStatus SUCCESS/FAILED.

---

## 3. 주요 파일

| 경로 | 역할 |
|------|------|
| `app/page.tsx` | 로그인 + 구매/판매 금액 입력 및 신청 |
| `app/dashboard/page.tsx` | 거래 신청 폼, iframe(AxPay), 거래 목록 |
| `app/api/transactions/route.ts` | GET(목록), POST(생성+텔레그램) |
| `app/api/telegram/webhook/route.ts` | 회원/거래 승인·거절, 거래 승인 시 axpay.login() |
| `app/api/transactions/sync/route.ts` | order_query → order_callback, DB 업데이트 |
| `lib/axpay.ts` | 로그인(3.1), order_query(3.3), order_callback(3.4) |
| `prisma/schema.prisma` | User, Transaction |

**에러**: Netlify `usage_exceeded` 시 "호스팅 사용량 한도를 초과했습니다. 잠시 후 다시 시도하거나 관리자에게 문의하세요." 표시.

---

## 4. AxPay API (가이드 Rev 12.10)

- 인증: **form 필드 `token`** (Authorization 헤더 사용 안 함).
- 연동 서버: `https://api.game.x.xehs8qjfwk.vip` (로그인: `/api/index/login`).

### 3.1 로그인(구매/판매 등록)

- **POST** `/api/index/login`, **multipart/form-data**
- **요청**:  
  `token`, `user_id`, `type`(1=구매, 2=판매), `money`, `wallet_car_number`, `wallet_bank`, `wallet_name`, `transaction_amount`(만원단위)
- **응답**:  
  - `code` 0: `data.url`, `data.order_id`, `data.user_id` (url은 iframe 표시)
  - `code` 1: `data` null, `msg`에 에러 (tokenabsent!, 잔액 부족, 만원 단위 아님 등)

### 3.2 콜백(가맹점 거래번호 연동)

- **POST** `/api/index/callback`  
- **요청**: `token`, `order_id`, `order_play_id`(가맹점 거래번호)

### 3.3 구매/판매 진행상태 조회

- **POST** `/api/index/order_query`  
- **요청**: `token`, `order_id`  
- **응답**: `data` 배열. 항목에 `status`: 1=성공, 2=실패, 3=진행중. 1 또는 2이면 3.4 호출. 권장 주기 20초.

### 3.4 주문 핸들링

- **POST** `/api/index/order_callback`  
- **요청**: `token`, `order_id` 만 (status 파라미터 없음)

### 3.6 로그인 정보 재조회

- **POST** `/api/index/order_info`  
- **요청**: `token`, `user_id`  
- **응답**: code 0 시 `data.url`, `data.user_id` (미완료 거래 URL 재발급)

---

## 5. 구현 시 유의

- AxPay: token은 **form body에만**.
- type: 문자열 `"1"`(구매), `"2"`(판매).
- 금액: 프론트/백엔드 모두 만 원 단위(최소 10000) 검증.
- 세션 필요 API: fetch 시 `credentials: "include"`.
- AxPay 실패 시 `rawResponse`를 텔레그램에 붙이므로, 응답 구조 확인 후 파싱 보강 가능.
