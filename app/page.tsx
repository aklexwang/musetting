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
  const amountValid = parsedAmount > 0;

  const handleBuyClick = () => {
    if (!amountValid) {
      alert("금액을 입력해 주세요.");
      return;
    }
    setConfirmMode("buy");
    setConfirmOpen(true);
  };

  const handleSellClick = () => {
    if (!amountValid) {
      alert("금액을 입력해 주세요.");
      return;
    }
    setConfirmMode("sell");
    setConfirmOpen(true);
  };

  const handleConfirmSubmit = () => {
    if (!confirmMode || !amountValid) return;
    const formatted = parsedAmount.toLocaleString("ko-KR");
    if (confirmMode === "buy") {
      alert(`${formatted}원 구매 요청이 완료되었습니다.`);
    } else {
      alert(`${formatted}원 판매 요청이 완료되었습니다.`);
    }
    setConfirmOpen(false);
    setConfirmMode(null);
    setAmount("");
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
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <span className="text-slate-400 text-sm">{user.username}</span>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-500 hover:text-slate-300"
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
        <p className="text-slate-400 text-sm">승인된 회원입니다.</p>
        <div className="flex flex-col items-center gap-6 w-full max-w-xs">
          <div className="w-full">
            <Input
              id="amount"
              type="text"
              inputMode="numeric"
              placeholder="금액을 입력하세요"
              value={amount}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "");
                setAmount(v);
              }}
              className="bg-slate-800/50 border-slate-700 text-slate-100 placeholder:text-slate-500"
            />
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
          <DialogContent className="bg-slate-900 border-slate-800 text-slate-100">
            <DialogHeader>
              <DialogTitle className="text-slate-50">
                {confirmMode === "buy" ? "구매 확인" : "판매 확인"}
              </DialogTitle>
            </DialogHeader>
            <p className="text-slate-300 text-sm py-2">
              {confirmMode === "buy"
                ? `${parsedAmount.toLocaleString("ko-KR")}원을 구매하시겠습니까?`
                : `${parsedAmount.toLocaleString("ko-KR")}원을 판매하시겠습니까?`}
            </p>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                className="border-slate-600 text-slate-200"
                onClick={() => setConfirmOpen(false)}
              >
                취소
              </Button>
              <Button
                className={confirmMode === "buy" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-sky-600 hover:bg-sky-500"}
                onClick={handleConfirmSubmit}
              >
                2차 확인
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
