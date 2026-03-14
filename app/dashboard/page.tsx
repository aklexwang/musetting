"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type User = { userId: string; username: string; canBuy?: boolean; canSell?: boolean } | null;
type Transaction = {
  id: string;
  type: string;
  amount: number;
  status: string;
  apiStatus: string;
  axpayUrl?: string | null;
  axpayOrderId?: string | null;
  createdAt: string;
};

const POLL_INTERVAL_MS = 3000;

export default function DashboardPage() {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [type, setType] = useState<"BUY" | "SELL">("BUY");
  const [amount, setAmount] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState("");

  const hasPending = transactions.some((t) => t.status === "PENDING");
  const approvedWithUrl = transactions.find(
    (t) => t.status === "APPROVED" && t.axpayUrl
  );

  const fetchSession = () =>
    fetch("/api/auth/session", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setUser(data?.user ?? null);
        return data?.user;
      })
      .catch(() => {
        setUser(null);
        return null;
      });

  const fetchTransactions = () =>
    fetch("/api/transactions", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { transactions: [] }))
      .then((data) => setTransactions(data.transactions ?? []))
      .catch(() => setTransactions([]));

  useEffect(() => {
    fetchSession().then((u) => {
      if (!u) {
        window.location.href = "/";
        return;
      }
      fetchTransactions();
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user || !hasPending) return;
    const id = setInterval(fetchTransactions, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [user, hasPending]);

  const SUSPENDED_MSG = "이용정지중입니다. BETEAST 관리자에게 문의하세요.";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const num = amount.replace(/\D/g, "");
    const value = parseInt(num, 10);
    if (!num || value < 10000) {
      setError("금액은 1만 원 이상 입력하세요.");
      return;
    }
    if (value % 10000 !== 0) {
      setError("금액은 만 원 단위로만 입력 가능합니다. (예: 10000, 20000)");
      return;
    }
    try {
      const sessionRes = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" });
      const sessionData = await sessionRes.json().catch(() => ({}));
      const me = sessionData?.user;
      if (me) {
        if (type === "BUY" && me.canBuy === false) {
          setError(SUSPENDED_MSG);
          return;
        }
        if (type === "SELL" && me.canSell === false) {
          setError(SUSPENDED_MSG);
          return;
        }
      }
    } catch {
      setError(SUSPENDED_MSG);
      return;
    }
    setSubmitLoading(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, amount: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const raw = data?.error ?? "신청에 실패했습니다.";
        setError(raw === "usage_exceeded" ? "호스팅 사용량 한도를 초과했습니다. 잠시 후 다시 시도하거나 관리자에게 문의하세요." : raw);
        return;
      }
      setAmount("");
      await fetchTransactions();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">로딩 중...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6 p-4">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <span className="text-slate-400 text-sm">{user.username}</span>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md text-sm font-medium text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 h-9 px-3"
        >
          홈
        </Link>
      </div>

      {approvedWithUrl?.axpayUrl && (
        <Card className="w-full max-w-2xl bg-slate-900 border-slate-800 flex flex-col items-center justify-center">
          <CardHeader className="w-full">
            <CardTitle className="text-slate-50">AxPay 결제</CardTitle>
            <CardDescription className="text-slate-400">
              승인된 거래 화면입니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="w-full flex justify-center">
            <iframe
              src={approvedWithUrl.axpayUrl}
              title="AxPay 결제"
              className="w-full min-h-[480px] rounded-lg border border-slate-700 bg-slate-800 max-w-xl mx-auto"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </CardContent>
        </Card>
      )}

      <Card className="w-full max-w-md bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-slate-50">거래 신청</CardTitle>
          <CardDescription className="text-slate-400">
            구매 또는 판매 금액을 입력하고 신청하세요. 가맹점 승인 후 처리됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasPending && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm py-3 px-4">
              처리 중 — 승인 대기 중입니다.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-200">유형</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={type === "BUY" ? "default" : "outline"}
                  className={type === "BUY" ? "bg-emerald-600 hover:bg-emerald-500" : "border-slate-600 text-slate-300"}
                  onClick={() => setType("BUY")}
                >
                  구매
                </Button>
                <Button
                  type="button"
                  variant={type === "SELL" ? "default" : "outline"}
                  className={type === "SELL" ? "bg-sky-600 hover:bg-sky-500" : "border-slate-600 text-slate-300"}
                  onClick={() => setType("SELL")}
                >
                  판매
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-slate-200">
                금액 (원)
              </Label>
              <Input
                id="amount"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="만 원 단위 (예: 10000, 20000)"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                className="bg-slate-800/50 border-slate-700 text-slate-100 placeholder:text-slate-500"
                disabled={hasPending}
              />
              <p className="text-slate-500 text-xs">
                만 원 단위로만 입력 가능합니다.
              </p>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button
              type="submit"
              disabled={hasPending || submitLoading}
              className={
                type === "BUY"
                  ? "bg-emerald-600 hover:bg-emerald-500 w-full"
                  : "bg-sky-600 hover:bg-sky-500 w-full"
              }
            >
              {submitLoading ? "신청 중..." : "신청하기"}
            </Button>
          </form>

          {transactions.length > 0 && (
            <div className="pt-4 border-t border-slate-800">
              <Label className="text-slate-400 text-xs">최근 신청 내역</Label>
              <ul className="mt-2 space-y-1 text-sm text-slate-300">
                {transactions.slice(0, 5).map((t) => (
                  <li key={t.id} className="flex justify-between">
                    <span>
                      {t.type === "BUY" ? "구매" : "판매"} {t.amount.toLocaleString("ko-KR")}원
                    </span>
                    <span
                      className={
                        t.status === "PENDING"
                          ? "text-amber-400"
                          : t.status === "APPROVED"
                            ? "text-emerald-400"
                            : "text-red-400"
                      }
                    >
                      {t.status === "PENDING"
                        ? "처리 중"
                        : t.status === "APPROVED"
                          ? "승인"
                          : "거절"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
