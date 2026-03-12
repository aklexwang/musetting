@echo off
cd /d "%~dp0"
call npx prisma migrate dev %*
