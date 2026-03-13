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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type User = { userId: string; username: string } | null;

export default function Home() {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<"buy" | "sell" | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        setUser(data?.user ?? null);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/";
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoginLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error ?? "로그인에 실패했습니다.");
        return;
      }

      alert("승인되었습니다. 로그인되었습니다.");
      window.location.href = "/";
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoginLoading(false);
    }
  };

  const parsedAmount = amount.trim() === "" ? 0 : parseInt(amount.replace(/\D/g, ""), 10) || 0;
  const amountValid = parsedAmount >= 10000 && parsedAmount % 10000 === 0;

  const handleBuyClick = () => {
    if (parsedAmount < 10000) {
      alert("금액을 입력해 주세요. (1만 원 이상)");
      return;
    }
    if (parsedAmount % 10000 !== 0) {
      alert("금액은 만 원 단위로만 입력 가능합니다. (예: 10000, 20000)");
      return;
    }
    setConfirmMode("buy");
    setConfirmChecked(false);
    setConfirmOpen(true);
  };

  const handleSellClick = () => {
    if (parsedAmount < 10000) {
      alert("금액을 입력해 주세요. (1만 원 이상)");
      return;
    }
    if (parsedAmount % 10000 !== 0) {
      alert("금액은 만 원 단위로만 입력 가능합니다. (예: 10000, 20000)");
      return;
    }
    setConfirmMode("sell");
    setConfirmChecked(false);
    setConfirmOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (!confirmMode || !amountValid) return;
    setConfirmLoading(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: confirmMode === "buy" ? "BUY" : "SELL",
          amount: parsedAmount,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const raw = data?.error ?? "거래 신청에 실패했습니다.";
        const msg =
          res.status === 401
            ? "로그인이 필요합니다. 다시 로그인한 뒤 시도해 주세요."
            : raw === "usage_exceeded"
              ? "호스팅 사용량 한도를 초과했습니다. 잠시 후 다시 시도하거나 관리자에게 문의하세요."
              : raw;
        alert(msg);
        return;
      }
      const formatted = parsedAmount.toLocaleString("ko-KR");
      const msg =
        confirmMode === "buy"
          ? `${formatted}원 구매 요청이 완료되었습니다. 가맹점 승인 후 대시보드에서 확인하세요.`
          : `${formatted}원 판매 요청이 완료되었습니다. 가맹점 승인 후 대시보드에서 확인하세요.`;
      if (data?.telegramSent === false) {
        alert(`${msg}\n\n(텔레그램 알림이 전송되지 않았을 수 있습니다. 관리자는 어드민 페이지에서 확인하세요.)`);
      } else {
        alert(msg);
      }
      setConfirmOpen(false);
      setConfirmMode(null);
      setAmount("");
      window.location.href = "/dashboard";
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setConfirmLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">로딩 중...</p>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-8 p-4">
        <div className="absolute top-4 right-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 border border-red-500 hover:text-red-400 hover:border-red-400 hover:bg-red-500/10"
            onClick={handleLogout}
          >
            로그아웃
          </Button>
        </div>
        <img
          src="https://static.wixstatic.com/media/1b77f2_0566328b0df64e8a8d85c7ec47ed2aa1~mv2.png/v1/fill/w_200,h_42,al_c,lg_1,q_85,enc_avif,quality_auto/1b77f2_0566328b0df64e8a8d85c7ec47ed2aa1~mv2.png"
          srcSet="https://static.wixstatic.com/media/1b77f2_0566328b0df64e8a8d85c7ec47ed2aa1~mv2.png/v1/fill/w_200,h_42,al_c,lg_1,q_85,enc_avif,quality_auto/1b77f2_0566328b0df64e8a8d85c7ec47ed2aa1~mv2.png 1x, https://static.wixstatic.com/media/1b77f2_0566328b0df64e8a8d85c7ec47ed2aa1~mv2.png/v1/fill/w_274,h_58,al_c,lg_1,q_85,enc_avif,quality_auto/1b77f2_0566328b0df64e8a8d85c7ec47ed2aa1~mv2.png 2x"
          alt="BETEAST"
          className="h-[42px] w-auto"
        />
        <p className="text-slate-400 text-sm">회원아이디 {user?.username ?? ""}</p>
        <div className="flex flex-col items-center gap-6 w-full max-w-xs">
          <div className="w-full flex items-center justify-center">
            <div className="flex items-center w-full max-w-[240px] rounded-md border border-slate-700 bg-slate-800/50 px-4 py-2.5 focus-within:ring-2 focus-within:ring-slate-500 focus-within:ring-offset-0 focus-within:ring-offset-slate-950">
              <input
                id="amount"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="금액을 입력하세요"
                value={amount ? Number(amount).toLocaleString("ko-KR") : ""}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  setAmount(v);
                }}
                className="flex-1 min-w-0 bg-transparent text-slate-100 placeholder:text-slate-500 text-center text-sm outline-none"
              />
              <span className="text-slate-400 text-sm shrink-0 ml-1.5">원</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              type="button"
              onClick={handleBuyClick}
              className="bg-emerald-600 hover:bg-emerald-500 text-white w-44 h-12 text-base"
            >
              구매
            </Button>
            <Button
              type="button"
              onClick={handleSellClick}
              className="bg-sky-600 hover:bg-sky-500 text-white w-44 h-12 text-base"
            >
              판매
            </Button>
          </div>
        </div>

        <Dialog open={confirmOpen} onOpenChange={(open) => !open && setConfirmOpen(false)}>
          <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 rounded-xl shadow-2xl max-w-[340px]">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-slate-50 text-lg font-semibold">
                {confirmMode === "buy" ? "구매 확인" : "판매 확인"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-slate-200 text-base">
                {confirmMode === "buy"
                  ? `${parsedAmount.toLocaleString("ko-KR")}원을 구매하시겠습니까?`
                  : `${parsedAmount.toLocaleString("ko-KR")}원을 판매하시겠습니까?`}
              </p>
              <label className="flex items-center gap-3 cursor-pointer select-none group">
                <Checkbox
                  checked={confirmChecked}
                  onCheckedChange={(v) => setConfirmChecked(Boolean(v))}
                  className="border-slate-500 data-[checked]:bg-emerald-600 data-[checked]:border-emerald-600 dark:data-[checked]:bg-emerald-600 dark:data-[checked]:border-emerald-600"
                />
                <span className="text-slate-300 text-sm group-hover:text-slate-200">
                  금액 및 거래 내용을 확인하였습니다.
                </span>
              </label>
            </div>
            <DialogFooter className="flex gap-3 pt-4 border-t border-slate-600 bg-slate-800/60 -mx-6 -mb-6 px-6 pb-6 rounded-b-xl">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-slate-500 bg-slate-700/80 text-slate-100 hover:bg-slate-600 hover:text-white hover:border-slate-400"
                onClick={() => setConfirmOpen(false)}
              >
                취소
              </Button>
              <Button
                type="button"
                className="flex-1 bg-slate-600 hover:bg-slate-500 text-white border border-slate-500"
                onClick={handleConfirmSubmit}
                disabled={confirmLoading || !confirmChecked}
              >
                {confirmLoading ? "신청 중..." : "확인"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-900/95 border-slate-800 ring-1 ring-slate-800 shadow-2xl">
        <CardHeader className="space-y-1.5 pb-6">
          <CardTitle className="text-2xl font-semibold tracking-tight text-slate-50">
            회원 로그인
          </CardTitle>
          <CardDescription className="text-slate-400 text-sm">
            승인된 계정으로 로그인하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-200">
                아이디
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="아이디"
                className="bg-slate-800/50 border-slate-700 text-slate-100"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200">
                비밀번호
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                className="bg-slate-800/50 border-slate-700 text-slate-100"
                required
              />
            </div>
            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}
            <Button
              type="submit"
              className="w-full h-10 bg-slate-700 hover:bg-slate-600 text-slate-100"
              disabled={loginLoading}
            >
              {loginLoading ? "로그인 중..." : "로그인"}
            </Button>
          </form>
          <p className="mt-4 text-center text-slate-500 text-sm">
            아직 계정이 없으신가요?{" "}
            <Link href="/signup" className="text-sky-400 hover:underline">
              회원가입
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
