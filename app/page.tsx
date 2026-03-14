"use client";

import { useEffect, useState, useRef } from "react";
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

type User = { userId: string; username: string; canBuy?: boolean; canSell?: boolean } | null;
type Profile = { username: string; bankName: string; accountNumber: string; accountHolder: string } | null;

export default function Home() {
  const [user, setUser] = useState<User>(null);
  const [profile, setProfile] = useState<Profile>(null);
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
  /** 신청 후 텔레그램 승인 대기 중인 거래 id (승인되면 검색 중 화면으로) */
  const [pendingTxnId, setPendingTxnId] = useState<string | null>(null);
  const [pendingTxnAmount, setPendingTxnAmount] = useState(0);
  const [pendingTxnType, setPendingTxnType] = useState<"buy" | "sell" | null>(null);
  /** 승인됨 → 검색 중(스캔) 화면 표시 */
  const [showScanning, setShowScanning] = useState(false);
  const [rejectedMessage, setRejectedMessage] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [scanTime, setScanTime] = useState("");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        setUser(data?.user ?? null);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    fetch("/api/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setProfile(data ?? null))
      .catch(() => setProfile(null));
  }, [user]);

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
    if (pendingTxnId) return;
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
      const txn = data?.transaction;
      if (txn?.id) {
        setPendingTxnId(txn.id);
        setPendingTxnAmount(parsedAmount);
        setPendingTxnType(confirmMode);
      } else {
        setConfirmOpen(false);
        setConfirmMode(null);
        setAmount("");
        window.location.href = "/dashboard";
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setConfirmLoading(false);
    }
  };

  // 텔레그램 승인 대기 폴링: 승인 시 검색 중 화면, 거절 시 메시지
  useEffect(() => {
    if (!pendingTxnId) return;
    const poll = async () => {
      try {
        const res = await fetch("/api/transactions", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        const list = data?.transactions ?? [];
        const txn = list.find((t: { id: string }) => t.id === pendingTxnId);
        if (!txn) return;
        if (txn.status === "APPROVED") {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setPendingTxnId(null);
          setConfirmOpen(false);
          setConfirmMode(null);
          setAmount("");
          setShowScanning(true);
        } else if (txn.status === "REJECTED") {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setPendingTxnId(null);
          setConfirmOpen(false);
          setRejectedMessage("거래가 거절되었습니다.");
        }
      } catch {
        /* ignore */
      }
    };
    poll();
    pollIntervalRef.current = setInterval(poll, 2500);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [pendingTxnId]);

  useEffect(() => {
    if (!showScanning) return;
    const tick = () => {
      const now = new Date();
      setScanTime(`${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [showScanning]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">로딩 중...</p>
      </div>
    );
  }

  // 승인 후 검색 중 화면 (사진2 스타일)
  if (user && showScanning) {
    const isSell = pendingTxnType === "sell";
    const searchLabel = isSell ? "구매자를 검색하는 중입니다..." : "판매자를 검색하는 중입니다...";
    const timeStr = scanTime || "0:00";
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4 text-slate-100">
        <div className="w-full max-w-sm rounded-2xl bg-slate-900/80 border border-slate-700 p-6 space-y-6">
          <p className="text-slate-400 text-sm">회원아이디 {user.username}</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-800/80 border border-slate-600 p-4">
              <p className="text-slate-400 text-xs mb-1">{isSell ? "판매금액" : "구매금액"}</p>
              <p className="text-cyan-400 font-mono text-lg font-semibold drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">
                {pendingTxnAmount.toLocaleString("ko-KR")}원
              </p>
            </div>
            <div className="rounded-xl bg-slate-800/80 border border-slate-600 p-4">
              <p className="text-slate-400 text-xs mb-1">남은금액</p>
              <p className="text-cyan-400 font-mono text-lg font-semibold drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">
                {pendingTxnAmount.toLocaleString("ko-KR")}원
              </p>
            </div>
          </div>
          <p className="text-4xl font-mono text-cyan-400/90 drop-shadow-[0_0_12px_rgba(34,211,238,0.5)] tabular-nums">
            {timeStr}
          </p>
          <p className="text-slate-300 text-center text-sm">{searchLabel}</p>
          {/* 스캔 그리드 애니메이션 */}
          <div className="grid grid-cols-6 grid-rows-4 gap-1">
            {Array.from({ length: 24 }, (_, i) => (
              <div
                key={i}
                className="h-3 rounded-sm bg-gradient-to-b from-cyan-500/30 to-fuchsia-500/30 animate-pulse"
                style={{ animationDelay: `${i * 50}ms` }}
              />
            ))}
          </div>
          <p className="text-center font-mono text-cyan-400/80 text-sm tracking-widest">SCANNING...</p>
          <Button
            type="button"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-medium"
            onClick={() => setShowScanning(false)}
          >
            테스트버젼
          </Button>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-8 p-4 relative">
        <button
          type="button"
          onClick={handleLogout}
          className="absolute top-4 right-4 h-7 px-2.5 text-sm font-medium text-slate-400 bg-slate-800/50 border border-slate-600 rounded-md hover:text-slate-200 hover:border-slate-500 hover:bg-slate-700/80 transition-colors"
        >
          로그아웃
        </button>
        {rejectedMessage && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-red-900/80 text-red-200 text-sm border border-red-700 z-10">
            {rejectedMessage}
            <button type="button" className="ml-2 underline" onClick={() => setRejectedMessage(null)}>
              닫기
            </button>
          </div>
        )}
        <img
          src="https://static.wixstatic.com/media/1b77f2_0566328b0df64e8a8d85c7ec47ed2aa1~mv2.png/v1/fill/w_200,h_42,al_c,lg_1,q_85/1b77f2_0566328b0df64e8a8d85c7ec47ed2aa1~mv2.png"
          alt="BETEAST"
          className="h-[42px] w-auto"
        />
        <Link
          href="/dashboard"
          className="w-full max-w-[20rem] py-2.5 px-4 text-[0.9375rem] font-semibold text-white text-center rounded-xl border border-blue-400/45 bg-gradient-to-b from-[#1e3a5f] via-[#152238] to-[#1a2840] shadow-[0_1px_0_rgba(96,165,250,0.2)_inset,-1px_-1px_0_rgba(0,0,0,0.25),0_2px_8px_rgba(0,0,0,0.2)] hover:from-[#234872] hover:via-[#1a3050] hover:to-[#1e3a5f] hover:border-blue-300/50 transition-all"
        >
          거래내역
        </Link>
        <div className="w-full max-w-[20rem] text-sm text-slate-400">
          <p className="text-center text-lg font-bold text-white bg-gradient-to-br from-blue-500/25 to-emerald-500/20 border border-blue-500/40 rounded-[10px] py-2.5 px-4 mb-3 tracking-wide">
            회원아이디 : {user?.username ?? ""}
          </p>
          <p className="text-center font-medium text-slate-400 mb-2">등록된 계좌</p>
          <div className="border border-slate-700 rounded-lg bg-slate-800/50 overflow-hidden p-0">
            <table className="w-full border-collapse">
              <tbody className="text-slate-200">
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium w-[5.5rem]">예금주 :</th>
                  <td className="py-2 px-3">{profile?.accountHolder ?? "-"}</td>
                </tr>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium w-[5.5rem]">은행명 :</th>
                  <td className="py-2 px-3">{profile?.bankName ?? "-"}</td>
                </tr>
                <tr>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium w-[5.5rem]">계좌번호 :</th>
                  <td className="py-2 px-3 font-mono">{profile?.accountNumber ?? "-"}</td>
                </tr>
              </tbody>
            </table>
            <div className="px-3 pb-3 pt-1">
              <Link
                href="/dashboard"
                className="block w-full py-2.5 px-4 text-[0.9375rem] font-semibold text-white text-center rounded-xl border border-blue-400/45 bg-gradient-to-b from-[#1e3a5f] via-[#152238] to-[#1a2840] hover:from-[#234872] hover:via-[#1a3050] hover:to-[#1e3a5f] hover:border-blue-300/50 transition-all"
              >
                계좌번호 변경요청
              </Link>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-6 w-full max-w-[20rem]">
          <div className="w-full flex items-center justify-center">
            <div className="flex items-center w-full max-w-[20rem] rounded-md border border-slate-700 bg-slate-800/50 py-2.5 px-4 focus-within:outline-2 focus-within:outline-slate-500 focus-within:outline-offset-0">
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
          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
            <button
              type="button"
              onClick={handleBuyClick}
              className="w-44 h-12 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-base font-medium"
            >
              구매
            </button>
            <button
              type="button"
              onClick={handleSellClick}
              className="w-44 h-12 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-base font-medium"
            >
              판매
            </button>
          </div>
        </div>

        <Dialog
          open={confirmOpen}
          onOpenChange={(open) => {
            if (!open && !pendingTxnId) setConfirmOpen(false);
          }}
        >
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
                className={`flex-1 text-white border ${confirmChecked ? "bg-emerald-600 hover:bg-emerald-500 border-emerald-600" : "bg-slate-600 hover:bg-slate-500 border-slate-500"}`}
                onClick={handleConfirmSubmit}
                disabled={confirmLoading || !confirmChecked || !!pendingTxnId}
              >
                {confirmLoading ? "신청 중..." : pendingTxnId ? "승인 대기 중..." : "확인"}
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
          <div className="flex items-center justify-center gap-3 mb-2">
            <img
              src="https://static.wixstatic.com/media/1b77f2_0566328b0df64e8a8d85c7ec47ed2aa1~mv2.png/v1/fill/w_200,h_42,al_c,lg_1,q_85,enc_avif,quality_auto/1b77f2_0566328b0df64e8a8d85c7ec47ed2aa1~mv2.png"
              srcSet="https://static.wixstatic.com/media/1b77f2_0566328b0df64e8a8d85c7ec47ed2aa1~mv2.png/v1/fill/w_200,h_42,al_c,lg_1,q_85,enc_avif,quality_auto/1b77f2_0566328b0df64e8a8d85c7ec47ed2aa1~mv2.png 1x, https://static.wixstatic.com/media/1b77f2_0566328b0df64e8a8d85c7ec47ed2aa1~mv2.png/v1/fill/w_274,h_58,al_c,lg_1,q_85,enc_avif,quality_auto/1b77f2_0566328b0df64e8a8d85c7ec47ed2aa1~mv2.png 2x"
              alt="BETEAST"
              className="h-10 w-auto"
            />
            <CardTitle className="text-2xl font-semibold tracking-tight text-slate-50">
              AXPAY 로그인
            </CardTitle>
          </div>
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
                autoComplete="off"
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
                autoComplete="off"
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
