"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const BANK_LIST = [
  "국민은행",
  "기업은행",
  "농협은행",
  "신한은행",
  "우리은행",
  "하나은행",
  "SC제일은행",
  "씨티은행",
  "카카오뱅크",
  "케이뱅크",
  "토스뱅크",
  "경남은행",
  "광주은행",
  "대구은행",
  "부산은행",
  "전북은행",
  "제주은행",
  "새마을금고",
  "신협",
  "우체국",
  "산업은행",
  "수협은행",
  "기타",
];

const signupSchema = z.object({
  username: z
    .string()
    .min(1, "아이디를 입력해 주세요.")
    .min(2, "아이디는 2자 이상이어야 합니다."),
  password: z
    .string()
    .min(1, "비밀번호를 입력해 주세요.")
    .min(6, "비밀번호는 6자 이상이어야 합니다."),
  bankName: z.string().min(1, "은행명을 입력해 주세요."),
  accountNumber: z
    .string()
    .min(1, "계좌번호를 입력해 주세요.")
    .regex(/^[0-9-]+$/, "계좌번호는 숫자만 입력 가능합니다."),
  accountHolder: z.string().min(1, "예금주를 입력해 주세요."),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: "",
      password: "",
      bankName: "",
      accountNumber: "",
      accountHolder: "",
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [rejected, setRejected] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!pendingApproval || !pendingUsername) return;

    const checkApproval = async () => {
      try {
        const res = await fetch(
          `/api/signup/approval-status?username=${encodeURIComponent(pendingUsername)}`
        );
        const data = await res.json().catch(() => ({}));
        if (data.status === "APPROVED") {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          setApproved(true);
        } else if (data.status === "REJECTED") {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          setRejected(true);
        }
      } catch {
        // ignore
      }
    };

    checkApproval();
    pollRef.current = setInterval(checkApproval, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pendingApproval, pendingUsername, router]);

  const onSubmit = async (data: SignupFormValues) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) return;

      setPendingUsername(data.username);
      setPendingApproval(true);
      reset({
        username: "",
        password: "",
        bankName: "",
        accountNumber: "",
        accountHolder: "",
      });
    } catch {
      // 네트워크 오류 시 조용히 처리
    } finally {
      setIsSubmitting(false);
    }
  };

  if (pendingApproval) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-900/50 to-slate-950 flex items-center justify-center p-4">
        <Card className="w-full max-w-md overflow-hidden bg-slate-900/90 border-slate-700/80 shadow-2xl shadow-slate-950/50 ring-1 ring-slate-700/50 backdrop-blur-sm">
          <CardHeader className="space-y-4 pb-4 pt-8 px-8 text-center">
            <div
              className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
                rejected ? "bg-red-500/20 text-red-400" : approved ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
              }`}
            >
              {rejected ? (
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : approved ? (
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-7 w-7 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <CardTitle className="text-xl font-semibold tracking-tight text-slate-50">
              {rejected ? "가입이 거부되었습니다." : approved ? "가입이 승인되었습니다." : "가입승인 대기중"}
            </CardTitle>
            <CardDescription className="text-slate-400 leading-relaxed">
              {rejected ? (
                "관리자에 의해 가입 요청이 거절되었습니다."
              ) : approved ? (
                "로그인 화면에서 로그인하실 수 있습니다."
              ) : (
                <span className="block text-center space-y-2 mt-2">
                  <span className="block">가입 요청이 완료되었습니다. 관리자 검토 후 승인되면 로그인하실 수 있습니다.</span>
                  <span className="block">승인 후 이 화면에서 자동으로 로그인 페이지로 이동합니다.</span>
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8 pt-0">
            {rejected ? (
              <Button
                type="button"
                className="w-full bg-slate-600 hover:bg-slate-500 text-slate-100"
                onClick={() => router.replace("/")}
              >
                확인
              </Button>
            ) : approved ? (
              <Button
                type="button"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
                onClick={() => router.replace("/")}
              >
                확인
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-900/95 border-slate-800 ring-1 ring-slate-800 shadow-2xl shadow-black/30">
        <CardHeader className="space-y-1.5 pb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <img
              src="https://static.wixstatic.com/media/1b77f2_0566328b0df64e8a8d85c7ec47ed2aa1~mv2.png/v1/fill/w_200,h_42,al_c,lg_1,q_85,enc_avif,quality_auto/1b77f2_0566328b0df64e8a8d85c7ec47ed2aa1~mv2.png"
              srcSet="https://static.wixstatic.com/media/1b77f2_0566328b0df64e8a8d85c7ec47ed2aa1~mv2.png/v1/fill/w_200,h_42,al_c,lg_1,q_85,enc_avif,quality_auto/1b77f2_0566328b0df64e8a8d85c7ec47ed2aa1~mv2.png 1x, https://static.wixstatic.com/media/1b77f2_0566328b0df64e8a8d85c7ec47ed2aa1~mv2.png/v1/fill/w_274,h_58,al_c,lg_1,q_85,enc_avif,quality_auto/1b77f2_0566328b0df64e8a8d85c7ec47ed2aa1~mv2.png 2x"
              alt="BETEAST"
              className="h-10 w-auto"
            />
            <CardTitle className="text-2xl font-semibold tracking-tight text-slate-50 font-[var(--font-geist-sans),system-ui,sans-serif]">
              AXPAY 회원가입
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5"
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Label htmlFor="username" className="text-slate-200">
                  아이디
                </Label>
                <span className="text-red-500 text-sm">BETEAST와 같은 회원아이디를 입력하세요.</span>
              </div>
              <Controller
                name="username"
                control={control}
                render={({ field }) => (
                  <Input
                    id="username"
                    type="text"
                    autoComplete="off"
                    placeholder="아이디를 입력하세요"
                    className="bg-slate-800/50 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:ring-slate-500"
                    aria-invalid={!!errors.username}
                    {...field}
                  />
                )}
              />
              {errors.username && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200">
                비밀번호
              </Label>
              <Controller
                name="password"
                control={control}
                render={({ field }) => (
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="6자 이상 입력하세요"
                    className="bg-slate-800/50 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:ring-slate-500"
                    aria-invalid={!!errors.password}
                    {...field}
                  />
                )}
              />
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bankName" className="text-slate-200">
                은행명
              </Label>
              <Controller
                name="bankName"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    aria-invalid={!!errors.bankName}
                  >
                    <SelectTrigger
                      id="bankName"
                      className="w-full border-slate-700 bg-slate-800/50 text-slate-100 focus:ring-slate-500 data-[placeholder]:text-slate-500"
                    >
                      <SelectValue placeholder="은행을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700 max-h-60">
                      <SelectItem
                        value=""
                        className="text-slate-500 focus:bg-slate-800 focus:text-slate-200"
                      >
                        은행을 선택하세요
                      </SelectItem>
                      {BANK_LIST.map((bank) => (
                        <SelectItem
                          key={bank}
                          value={bank}
                          className="text-slate-200 focus:bg-slate-800 focus:text-slate-100"
                        >
                          {bank}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.bankName && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.bankName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountNumber" className="text-slate-200">
                계좌번호
              </Label>
              <Controller
                name="accountNumber"
                control={control}
                render={({ field }) => (
                  <Input
                    id="accountNumber"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="숫자만 입력하세요"
                    className="bg-slate-800/50 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:ring-slate-500"
                    aria-invalid={!!errors.accountNumber}
                    {...field}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9-]/g, "");
                      field.onChange(v);
                    }}
                  />
                )}
              />
              {errors.accountNumber && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.accountNumber.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountHolder" className="text-slate-200">
                예금주
              </Label>
              <Controller
                name="accountHolder"
                control={control}
                render={({ field }) => (
                  <Input
                    id="accountHolder"
                    type="text"
                    autoComplete="off"
                    placeholder="예금주명을 입력하세요"
                    className="bg-slate-800/50 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:ring-slate-500"
                    aria-invalid={!!errors.accountHolder}
                    {...field}
                  />
                )}
              />
              {errors.accountHolder && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.accountHolder.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-10 bg-slate-700 hover:bg-slate-600 text-slate-100 transition-colors duration-200 font-medium"
              disabled={isSubmitting}
            >
              {isSubmitting ? "처리 중..." : "가입 요청"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
