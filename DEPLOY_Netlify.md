# GitHub → Netlify 배포 가이드

## 1. GitHub에 코드 올리기

```bash
cd C:\MUSETTING

# 변경사항 모두 스테이징
git add .

# 커밋 (원하는 메시지로)
git commit -m "feat: 회원가입, 로그인, 어드민, 텔레그램 연동"

# GitHub에서 새 저장소 생성 후 (예: username/musetting)
git remote add origin https://github.com/사용자명/저장소명.git
git branch -M main
git push -u origin main
```

- GitHub에 **새 저장소**를 만들 때 "Add a README" 등은 선택하지 말고 **빈 저장소**로 만드세요.
- `.env`는 `.gitignore`에 있어서 올라가지 않습니다. 비밀은 Netlify에서 따로 설정합니다.

## 2. Netlify에서 GitHub 연결

1. [Netlify](https://app.netlify.com) 로그인
2. **Add new site** → **Import an existing project**
3. **GitHub** 선택 후 권한 허용
4. **저장소 선택** (방금 올린 musetting 저장소)
5. 빌드 설정 (보통 자동 감지됨)
   - **Build command:** `npm run build`
   - **Publish directory:** `.next` (Next.js면 Netlify가 제안)
   - **Base directory:** 비워두기
6. **Environment variables** 에서 다음 변수 추가 (Advanced 설정에서)
   - `DATABASE_URL` — Neon 등 DB 연결 문자열
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_ADMIN_CHAT_ID`
   - `AUTH_SECRET` — `openssl rand -base64 32` 로 생성한 값
7. **Deploy site** 클릭

## 3. 배포 후

- Netlify가 `npm install` → `npm run build` 실행 후 배포합니다.
- 사이트 URL은 `https://랜덤이름.netlify.app` 형태로 부여됩니다.
- 텔레그램 웹훅은 배포된 URL 기준으로 설정:  
  `https://랜덤이름.netlify.app/api/telegram/webhook`
