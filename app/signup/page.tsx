"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
import { useLocale } from "@/contexts/LocaleContext";
import { getTranslations } from "@/lib/translations";

const BANK_LIST = [
  "국민은행", "기업은행", "농협은행", "신한은행", "우리은행", "하나은행",
  "SC제일은행", "씨티은행", "카카오뱅크", "케이뱅크", "토스뱅크",
  "경남은행", "광주은행", "대구은행", "부산은행", "전북은행", "제주은행",
  "새마을금고", "신협", "우체국", "산업은행", "수협은행", "기타",
];

function getSignupSchema(t: {
  errUsernameRequired: string;
  errUsernameMin: string;
  errPasswordRequired: string;
  errPasswordMin: string;
  errPasswordMismatch: string;
  errBankRequired: string;
  errAccountNumberRequired: string;
  errAccountNumberRegex: string;
  errAccountHolderRequired: string;
}) {
  return z
    .object({
      username: z.string().min(1, t.errUsernameRequired).min(2, t.errUsernameMin),
      password: z.string().min(1, t.errPasswordRequired).min(6, t.errPasswordMin),
      passwordConfirm: z.string().min(1, t.errPasswordRequired),
      bankName: z.string().min(1, t.errBankRequired),
      accountNumber: z.string().min(1, t.errAccountNumberRequired).regex(/^[0-9-]+$/, t.errAccountNumberRegex),
      accountHolder: z.string().min(1, t.errAccountHolderRequired),
    })
    .refine((data) => data.password === data.passwordConfirm, {
      message: t.errPasswordMismatch,
      path: ["passwordConfirm"],
    });
}

type SignupFormValues = z.infer<ReturnType<typeof getSignupSchema>>;

export default function SignupPage() {
  const locale = useLocale();
  const t = getTranslations(locale).signup;
  const signupSchema = useMemo(() => getSignupSchema(t), [t]);

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
      passwordConfirm: "",
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
      const { passwordConfirm: _, ...payload } = data;
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) return;

      setPendingUsername(data.username);
      setPendingApproval(true);
      reset({
        username: "",
        password: "",
        passwordConfirm: "",
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
              {rejected ? t.rejectedTitle : approved ? t.approvedTitle : t.pendingTitle}
            </CardTitle>
            <CardDescription className="text-slate-400 leading-relaxed">
              {rejected ? (
                t.rejectedDesc
              ) : approved ? (
                t.approvedDesc
              ) : (
                <div className="flex flex-col items-center justify-center text-center space-y-3 mt-6 py-6">
                  <p className="text-slate-300">{t.pendingLine1}</p>
                  <p className="text-slate-300">{t.pendingLine2}</p>
                  <p className="text-slate-300">{t.pendingLine3}</p>
                </div>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8 pt-0">
            {rejected ? (
              <Button
                type="button"
                className="w-full bg-slate-600 hover:bg-slate-500 text-slate-100"
                onClick={() => router.replace(locale === "zh" ? "/zh" : "/")}
              >
                {t.confirm}
              </Button>
            ) : approved ? (
              <Button
                type="button"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
                onClick={() => router.replace(locale === "zh" ? "/zh" : "/")}
              >
                {t.confirm}
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
          <div className="flex flex-row items-center justify-center gap-2">
            <img src="/axpay-logo.jpg" alt="AXPAY" className="h-[1.875rem] w-auto object-contain" />
            <span className="text-3xl font-bold tracking-tight text-white font-[var(--font-geist-sans),system-ui,sans-serif]">
              {t.title.replace(/^AXPAY\s+/, "")}
            </span>
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
                  {t.username}
                </Label>
                <span className="text-red-500 text-sm">{t.usernameHint}</span>
              </div>
              <Controller
                name="username"
                control={control}
                render={({ field }) => (
                  <Input
                    id="username"
                    type="text"
                    autoComplete="off"
                    placeholder={t.usernamePlaceholder}
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
                {t.password}
              </Label>
              <Controller
                name="password"
                control={control}
                render={({ field }) => (
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder={t.passwordPlaceholder}
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
              <Label htmlFor="passwordConfirm" className="text-slate-200">
                {t.passwordConfirm}
              </Label>
              <Controller
                name="passwordConfirm"
                control={control}
                render={({ field }) => (
                  <Input
                    id="passwordConfirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder={t.passwordConfirmPlaceholder}
                    className="bg-slate-800/50 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:ring-slate-500"
                    aria-invalid={!!errors.passwordConfirm}
                    {...field}
                  />
                )}
              />
              {errors.passwordConfirm && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.passwordConfirm.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bankName" className="text-slate-200">
                {t.bankName}
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
                      <SelectValue placeholder={t.bankPlaceholder} />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700 max-h-60">
                      <SelectItem
                        value=""
                        className="text-slate-500 focus:bg-slate-800 focus:text-slate-200"
                      >
                        {t.bankPlaceholder}
                      </SelectItem>
                      {BANK_LIST.map((bank) => (
                        <SelectItem
                          key={bank}
                          value={bank}
                          className="text-slate-200 focus:bg-slate-800 focus:text-slate-100"
                        >
                          {t.bankLabels[bank] ?? bank}
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
                {t.accountNumber}
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
                    placeholder={t.accountNumberPlaceholder}
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
                {t.accountHolder}
              </Label>
              <Controller
                name="accountHolder"
                control={control}
                render={({ field }) => (
                  <Input
                    id="accountHolder"
                    type="text"
                    autoComplete="off"
                    placeholder={t.accountHolderPlaceholder}
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

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-10 border-slate-600 bg-slate-800/50 text-slate-200 hover:bg-slate-700 hover:text-slate-100 transition-colors duration-200 font-medium"
                onClick={() => router.replace(locale === "zh" ? "/zh" : "/")}
              >
                {t.cancel}
              </Button>
              <Button
                type="submit"
                className="flex-1 h-10 bg-slate-700 hover:bg-slate-600 text-slate-100 transition-colors duration-200 font-medium"
                disabled={isSubmitting}
              >
                {isSubmitting ? t.submitting : t.submitButton}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
