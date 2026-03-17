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
import { useLocale } from "@/contexts/LocaleContext";
import { getTranslations } from "@/lib/translations";

type User = { userId: string; username: string; canBuy?: boolean; canSell?: boolean } | null;
type Profile = { username: string; bankName: string; accountNumber: string; accountHolder: string } | null;
type TxnItem = { id: string; type: string; amount: number; status: string; createdAt: string };

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
  /** 거래 거절 시 표시: 구매/판매 구분 + 금액 (금액란 위치에 표시) */
  const [rejectedTxnInfo, setRejectedTxnInfo] = useState<{ type: "BUY" | "SELL"; amount: number } | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [scanTime, setScanTime] = useState("");
  /** 거래내역 모달 */
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTab, setHistoryTab] = useState<"BUY" | "SELL">("BUY");
  const [historyTxns, setHistoryTxns] = useState<TxnItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  /** 계좌 입력(변경요청) 모달 - 사진1 */
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountHolder, setAccountHolder] = useState("");
  const [accountBankName, setAccountBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountSubmitLoading, setAccountSubmitLoading] = useState(false);
  /** 계좌 변경 신청 대기 중이면 true → "관리자가 승인중입니다." 표시 */
  const [pendingAccountChange, setPendingAccountChange] = useState(false);
  /** 텔레그램에서 승인된 직후 → "계좌번호 변경이 승인되었습니다." + 승인된 계좌 표시 */
  const [showAccountChangeApproved, setShowAccountChangeApproved] = useState(false);
  /** 텔레그램에서 거부된 직후 → "승인 거부되었습니다." 표시 후 확인 시 일반 화면 */
  const [showAccountChangeRejected, setShowAccountChangeRejected] = useState(false);
  /** 어드민에서 해지 처리된 경우 회원 페이지에 안내 표시 */
  const [userTerminated, setUserTerminated] = useState(false);

  const locale = useLocale();
  const t = getTranslations(locale).home;
  const numFmt = locale === "zh" ? "zh-CN" : "ko-KR";
  const currencySuffix = locale === "zh" ? "元" : "원";

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
      setPendingAccountChange(false);
      setShowAccountChangeApproved(false);
      setShowAccountChangeRejected(false);
      setUserTerminated(false);
      return;
    }
    fetch("/api/me", { credentials: "include" })
      .then((res) =>
        res.json().then((data: Profile & { terminated?: boolean } | { error?: string; terminated?: boolean }) => {
          if (!res.ok && res.status === 403 && (data as { terminated?: boolean }).terminated) {
            setUserTerminated(true);
            setProfile(null);
          } else if (res.ok) {
            setUserTerminated(false);
            setProfile((data as Profile) ?? null);
          } else {
            setProfile(null);
          }
        })
      )
      .catch(() => setProfile(null));
    fetch("/api/account-change-request", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { hasPending: false }))
      .then((data) => setPendingAccountChange(!!data?.hasPending))
      .catch(() => setPendingAccountChange(false));
  }, [user]);

  /** 대기 중일 때 폴링: 텔레그램에서 승인되면 "계좌번호 변경이 승인되었습니다." 표시 */
  useEffect(() => {
    if (!user || !pendingAccountChange) return;
    const t = setInterval(() => {
      fetch("/api/account-change-request", { credentials: "include" })
        .then((res) => (res.ok ? res.json() : Promise.resolve({ hasPending: false } as { hasPending: boolean; lastRequest?: { status: string } })))
        .then((data: { hasPending?: boolean; lastRequest?: { status: string } }) => {
          if (data?.hasPending === false && data?.lastRequest?.status === "APPROVED") {
            setPendingAccountChange(false);
            setShowAccountChangeApproved(true);
            fetch("/api/me", { credentials: "include" }).then((r) => (r.ok ? r.json() : null)).then((d) => d && setProfile(d));
          } else if (data?.hasPending === false && data?.lastRequest?.status === "REJECTED") {
            setPendingAccountChange(false);
            setShowAccountChangeRejected(true);
          }
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(t);
  }, [user, pendingAccountChange]);

  /** 거래내역 모달 열릴 때 목록 조회 */
  useEffect(() => {
    if (!historyOpen || !user) {
      setHistoryTxns([]);
      return;
    }
    setHistoryLoading(true);
    fetch("/api/transactions", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { transactions: [] }))
      .then((data) => setHistoryTxns(data.transactions ?? []))
      .catch(() => setHistoryTxns([]))
      .finally(() => setHistoryLoading(false));
  }, [historyOpen, user]);

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
        setError(data?.error ?? t.loginFailed);
        return;
      }

      window.location.href = locale === "zh" ? "/zh" : "/";
    } catch {
      setError(t.networkError);
    } finally {
      setLoginLoading(false);
    }
  };

  const parsedAmount = amount.trim() === "" ? 0 : parseInt(amount.replace(/\D/g, ""), 10) || 0;
  const amountValid = parsedAmount >= 10000 && parsedAmount % 10000 === 0;

  const handleBuyClick = () => {
    if (pendingAccountChange) return;
    if (parsedAmount < 10000) return;
    if (parsedAmount % 10000 !== 0) return;
    setConfirmMode("buy");
    setConfirmChecked(false);
    setConfirmOpen(true);
  };

  const handleSellClick = () => {
    if (pendingAccountChange) return;
    if (parsedAmount < 10000) return;
    if (parsedAmount % 10000 !== 0) return;
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
      if (!res.ok) return;
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
      // 네트워크 오류 시 조용히 처리
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
          setRejectedTxnInfo({
            type: (txn.type === "SELL" ? "SELL" : "BUY") as "BUY" | "SELL",
            amount: Number(txn.amount) || 0,
          });
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
        <p className="text-slate-400">{t.loading}</p>
      </div>
    );
  }

  // 승인 후 검색 중 화면 (사진2 스타일)
  if (user && showScanning) {
    const isSell = pendingTxnType === "sell";
    const searchLabel = isSell ? t.searchSeller : t.searchBuyer;
    const timeStr = scanTime || "0:00";
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4 text-slate-100">
        <div className="w-full max-w-sm rounded-2xl bg-slate-900/80 border border-slate-700 p-6 space-y-6">
          <p className="text-slate-400 text-sm">{t.memberId} {user.username}</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-800/80 border border-slate-600 p-4">
              <p className="text-slate-400 text-xs mb-1">{isSell ? t.sellAmount : t.buyAmount}</p>
              <p className="text-cyan-400 font-mono text-lg font-semibold drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">
                {pendingTxnAmount.toLocaleString(numFmt)}{currencySuffix}
              </p>
            </div>
            <div className="rounded-xl bg-slate-800/80 border border-slate-600 p-4">
              <p className="text-slate-400 text-xs mb-1">{t.remainingAmount}</p>
              <p className="text-cyan-400 font-mono text-lg font-semibold drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">
                {pendingTxnAmount.toLocaleString(numFmt)}{currencySuffix}
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
            {t.testVersion}
          </Button>
        </div>
      </div>
    );
  }

  if (user) {
    if (userTerminated) {
      return (
        <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-6 p-4">
          <p className="text-red-400 font-medium text-center">
            {t.terminated}
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="px-5 py-2.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-slate-200 text-sm font-medium"
          >
            {t.logout}
          </button>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-8 p-4 relative">
        <button
          type="button"
          onClick={handleLogout}
          className="absolute top-4 right-4 h-7 px-2.5 text-sm font-medium text-slate-400 bg-slate-800/50 border border-slate-600 rounded-md hover:text-slate-200 hover:border-slate-500 hover:bg-slate-700/80 transition-colors"
        >
          {t.logout}
        </button>
        <div className="w-full max-w-[20rem] py-2.5 flex justify-center">
          <img src="/axpay-logo.png" alt="AXPAY" className="h-10 w-auto max-w-full object-contain" />
        </div>
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="w-full max-w-[20rem] py-2.5 px-4 text-[0.9375rem] font-semibold text-white text-center rounded-xl border border-blue-400/45 bg-gradient-to-b from-[#1e3a5f] via-[#152238] to-[#1a2840] shadow-[0_1px_0_rgba(96,165,250,0.2)_inset,-1px_-1px_0_rgba(0,0,0,0.25),0_2px_8px_rgba(0,0,0,0.2)] hover:from-[#234872] hover:via-[#1a3050] hover:to-[#1e3a5f] hover:border-blue-300/50 transition-all"
        >
          {t.history}
        </button>
        <div className="w-full max-w-[20rem] text-sm text-slate-400">
          <p className="text-center text-lg font-bold text-white bg-gradient-to-br from-blue-500/25 to-emerald-500/20 border border-blue-500/40 rounded-[10px] py-2.5 px-4 mb-3 tracking-wide">
            {t.memberId} : {user?.username ?? ""}
          </p>
          <p className="text-center font-medium text-slate-400 mb-2">{t.registeredAccount}</p>
          {showAccountChangeApproved ? (
            <div className="border border-emerald-500/40 rounded-xl bg-slate-800/60 overflow-hidden">
              <p className="text-center text-emerald-400 font-medium py-3 px-4">{t.accountChangeApproved}</p>
              <div className="border-t border-slate-700 px-0">
                <table className="w-full border-collapse">
                  <tbody className="text-slate-200">
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 px-3 text-slate-400 font-medium w-[5.5rem]">{t.accountHolder} :</th>
                      <td className="py-2 px-3">{profile?.accountHolder ?? "-"}</td>
                    </tr>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 px-3 text-slate-400 font-medium w-[5.5rem]">{t.bankName} :</th>
                      <td className="py-2 px-3">{profile?.bankName ?? "-"}</td>
                    </tr>
                    <tr>
                      <th className="text-left py-2 px-3 text-slate-400 font-medium w-[5.5rem]">{t.accountNumber} :</th>
                      <td className="py-2 px-3 font-mono">{profile?.accountNumber ?? "-"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-3">
                <button
                  type="button"
                  onClick={() => setShowAccountChangeApproved(false)}
                  className="w-full py-2.5 px-4 text-[0.9375rem] font-semibold text-white text-center rounded-xl bg-emerald-600 hover:bg-emerald-500 transition-colors"
                >
                  {t.confirm}
                </button>
              </div>
            </div>
          ) : showAccountChangeRejected ? (
            <div className="border border-red-500/40 rounded-xl bg-slate-800/60 overflow-hidden">
              <p className="text-center text-red-400 font-medium py-4 px-4">{t.accountChangeRejected}</p>
              <div className="px-3 pb-3">
                <button
                  type="button"
                  onClick={() => setShowAccountChangeRejected(false)}
                  className="w-full py-2.5 px-4 text-[0.9375rem] font-semibold text-white text-center rounded-xl bg-slate-600 hover:bg-slate-500 transition-colors"
                >
                  {t.confirm}
                </button>
              </div>
            </div>
          ) : pendingAccountChange ? (
            <div className="border border-blue-500/40 rounded-xl bg-gradient-to-b from-[#1e3a5f] via-[#152238] to-[#1a2840] py-5 px-4 text-center">
              <p className="text-white font-medium">{t.adminApproving}</p>
            </div>
          ) : (
            <div className="border border-slate-700 rounded-lg bg-slate-800/50 overflow-hidden p-0">
              <table className="w-full border-collapse">
                <tbody className="text-slate-200">
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 px-3 text-slate-400 font-medium w-[5.5rem]">{t.accountHolder} :</th>
                    <td className="py-2 px-3">{profile?.accountHolder ?? "-"}</td>
                  </tr>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 px-3 text-slate-400 font-medium w-[5.5rem]">{t.bankName} :</th>
                    <td className="py-2 px-3">{profile?.bankName ?? "-"}</td>
                  </tr>
                  <tr>
                    <th className="text-left py-2 px-3 text-slate-400 font-medium w-[5.5rem]">{t.accountNumber} :</th>
                    <td className="py-2 px-3 font-mono">{profile?.accountNumber ?? "-"}</td>
                  </tr>
                </tbody>
              </table>
              <div className="px-3 pb-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setAccountHolder("");
                    setAccountBankName("");
                    setAccountNumber("");
                    setAccountModalOpen(true);
                  }}
                  className="w-full py-2.5 px-4 text-[0.9375rem] font-semibold text-white text-center rounded-xl border border-slate-500/50 bg-slate-600/80 hover:bg-slate-600 transition-colors"
                >
                  {t.accountChangeRequest}
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col items-center gap-6 w-full max-w-[20rem]">
          {rejectedTxnInfo ? (
            <div className="w-full rounded-xl border border-red-500/50 bg-red-900/30 px-4 py-4 text-center">
              <p className="text-red-200 font-medium mb-1">
                {rejectedTxnInfo.type === "BUY" ? t.buyRejected : t.sellRejected}
              </p>
              <p className="text-slate-300 text-sm mb-3">
                {t.amount}: {rejectedTxnInfo.amount.toLocaleString(numFmt)}{currencySuffix}
              </p>
              <button
                type="button"
                onClick={() => setRejectedTxnInfo(null)}
                className="py-2 px-4 rounded-lg bg-slate-600 hover:bg-slate-500 text-white text-sm font-medium"
              >
                {t.close}
              </button>
            </div>
          ) : (
            <>
          <div className="w-full flex items-center justify-center">
            <div className="flex items-center w-full max-w-[20rem] rounded-md border border-slate-700 bg-slate-800/50 py-2.5 px-4 focus-within:outline-2 focus-within:outline-slate-500 focus-within:outline-offset-0">
              <input
                id="amount"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder={t.amountPlaceholder}
                value={amount ? Number(amount).toLocaleString(numFmt) : ""}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  setAmount(v);
                }}
                className="flex-1 min-w-0 bg-transparent text-slate-100 placeholder:text-slate-500 text-center text-sm outline-none"
              />
              <span className="text-slate-400 text-sm shrink-0 ml-1.5">{currencySuffix}</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
            <button
              type="button"
              onClick={handleBuyClick}
              disabled={pendingAccountChange}
              className={`w-44 h-12 rounded-lg text-white text-base font-medium transition-opacity ${pendingAccountChange ? "bg-emerald-600/50 cursor-not-allowed opacity-60" : "bg-emerald-600 hover:bg-emerald-500"}`}
            >
              {t.buy}
            </button>
            <button
              type="button"
              onClick={handleSellClick}
              disabled={pendingAccountChange}
              className={`w-44 h-12 rounded-lg text-white text-base font-medium transition-opacity ${pendingAccountChange ? "bg-sky-600/50 cursor-not-allowed opacity-60" : "bg-sky-600 hover:bg-sky-500"}`}
            >
              {t.sell}
            </button>
          </div>
            </>
          )}
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
                {confirmMode === "buy" ? t.buyConfirm : t.sellConfirm}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-slate-200 text-base">
                {confirmMode === "buy"
                  ? `${parsedAmount.toLocaleString(numFmt)}${currencySuffix}${locale === "zh" ? " " : ""}${t.buyConfirmQuestion}`
                  : `${parsedAmount.toLocaleString(numFmt)}${currencySuffix}${locale === "zh" ? " " : ""}${t.sellConfirmQuestion}`}
              </p>
              <label className="flex items-center gap-3 cursor-pointer select-none group">
                <Checkbox
                  checked={confirmChecked}
                  onCheckedChange={(v) => setConfirmChecked(Boolean(v))}
                  className="border-slate-500 data-[checked]:bg-emerald-600 data-[checked]:border-emerald-600 dark:data-[checked]:bg-emerald-600 dark:data-[checked]:border-emerald-600"
                />
                <span className="text-slate-300 text-sm group-hover:text-slate-200">
                  {t.confirmAmount}
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
                {t.cancel}
              </Button>
              <Button
                type="button"
                className={`flex-1 text-white border ${confirmChecked ? "bg-emerald-600 hover:bg-emerald-500 border-emerald-600" : "bg-slate-600 hover:bg-slate-500 border-slate-500"}`}
                onClick={handleConfirmSubmit}
                disabled={confirmLoading || !confirmChecked || !!pendingTxnId}
              >
                {confirmLoading ? t.applying : pendingTxnId ? t.approvalPending : t.confirm}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent showCloseButton={false} className="max-w-[min(90vw,72rem)] rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl text-slate-100 p-0 gap-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-700/50 px-6 py-4 bg-slate-800/50">
              <h2 className="text-lg font-semibold text-white">{t.history}</h2>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
                aria-label={t.close}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-5 pt-4 pb-3 flex gap-2">
              <button
                type="button"
                onClick={() => setHistoryTab("BUY")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${historyTab === "BUY" ? "bg-emerald-600 text-white shadow-sm" : "bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-600/50"}`}
              >
                {t.buy}
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab("SELL")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${historyTab === "SELL" ? "bg-sky-600 text-white shadow-sm" : "bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-600/50"}`}
              >
                {t.sell}
              </button>
            </div>
            <div className="px-5 pb-6">
              {historyLoading ? (
                <div className="py-12 flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-slate-500 border-t-sky-500 rounded-full animate-spin" />
                  <p className="text-slate-500 text-sm">{t.loading}</p>
                </div>
              ) : historyTxns.filter((t) => t.type === historyTab).length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-slate-500 text-sm">{t.noHistoryForType}</p>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-700/60 bg-slate-800/30 overflow-hidden max-h-[min(60vh,24rem)] overflow-y-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 bg-slate-800/95 backdrop-blur z-10">
                      <tr className="border-b border-slate-600/60">
                        <th className="text-left py-3.5 px-4 text-slate-400 font-medium text-xs uppercase tracking-wider">{t.requestTime}</th>
                        <th className="text-right py-3.5 px-4 text-slate-400 font-medium text-xs uppercase tracking-wider">{t.requestAmount}</th>
                        <th className="text-right py-3.5 px-4 text-slate-400 font-medium text-xs uppercase tracking-wider">{t.completeAmount}</th>
                        <th className="text-left py-3.5 px-4 text-slate-400 font-medium text-xs uppercase tracking-wider">{t.completeTime}</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-200 divide-y divide-slate-700/50">
                      {historyTxns
                        .filter((row) => row.type === historyTab)
                        .map((row, i) => {
                          const d = new Date(row.createdAt);
                          const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                          return (
                            <tr key={row.id} className={`hover:bg-slate-700/30 transition-colors ${i % 2 === 1 ? "bg-slate-800/20" : ""}`}>
                              <td className="py-3.5 px-4 tabular-nums text-slate-300 text-xs">{dateStr}</td>
                              <td className="py-3.5 px-4 text-right tabular-nums font-medium text-slate-100">{row.amount.toLocaleString(numFmt)}{currencySuffix}</td>
                              <td className="py-3.5 px-4 text-right tabular-nums text-slate-300">
                                {row.status === "APPROVED" ? <span className="text-emerald-400 font-medium">{row.amount.toLocaleString(numFmt)}{currencySuffix}</span> : row.status === "REJECTED" ? <span className="text-slate-400">{t.adminReject}</span> : <span className="text-slate-500">—</span>}
                              </td>
                              <td className="py-3.5 px-4 tabular-nums text-slate-300 text-xs">
                                {row.status === "APPROVED" ? dateStr : row.status === "REJECTED" ? <span className="text-slate-400">{t.adminReject}</span> : <span className="text-slate-500">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={accountModalOpen} onOpenChange={setAccountModalOpen}>
          <DialogContent showCloseButton={false} className="max-w-[min(90vw,24rem)] rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl text-slate-100 p-0 gap-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-700/50 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">{t.accountInput}</h2>
              <button
                type="button"
                onClick={() => setAccountModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
                aria-label={t.close}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="acc-holder" className="text-slate-200">{t.accountHolderLabel}</Label>
                <Input
                  id="acc-holder"
                  type="text"
                  autoComplete="off"
                  placeholder={t.accountHolderLabel}
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  className="bg-slate-800/60 border-slate-600 text-slate-100 placeholder:text-slate-500 rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acc-bank" className="text-slate-200">{t.bankNameLabel}</Label>
                <Input
                  id="acc-bank"
                  type="text"
                  autoComplete="off"
                  placeholder={t.bankNameLabel}
                  value={accountBankName}
                  onChange={(e) => setAccountBankName(e.target.value)}
                  className="bg-slate-800/60 border-slate-600 text-slate-100 placeholder:text-slate-500 rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acc-number" className="text-slate-200">{t.accountNumberLabel}</Label>
                <Input
                  id="acc-number"
                  type="text"
                  autoComplete="off"
                  placeholder={t.accountNumberLabel}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="bg-slate-800/60 border-slate-600 text-slate-100 placeholder:text-slate-500 rounded-lg"
                />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6 pt-2 border-t border-slate-700/50">
              <Button
                type="button"
                variant="outline"
                className="flex-1 bg-slate-700/80 border-slate-600 text-slate-200 hover:bg-slate-600 hover:text-white"
                onClick={() => setAccountModalOpen(false)}
              >
                {t.cancel}
              </Button>
              <Button
                type="button"
                className="flex-1 bg-sky-600 hover:bg-sky-500 text-white border-0"
                disabled={accountSubmitLoading || !accountHolder.trim() || !accountBankName.trim() || !accountNumber.trim()}
                onClick={async () => {
                  setAccountSubmitLoading(true);
                  try {
                    const res = await fetch("/api/account-change-request", {
                      method: "POST",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        accountHolder: accountHolder.trim(),
                        bankName: accountBankName.trim(),
                        accountNumber: accountNumber.trim(),
                      }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) return;
                    setAccountModalOpen(false);
                    setAccountHolder("");
                    setAccountBankName("");
                    setAccountNumber("");
                    setPendingAccountChange(true);
                    fetch("/api/me", { credentials: "include" }).then((r) => r.ok ? r.json() : null).then((d) => d && setProfile(d));
                  } catch {
                    // 네트워크 오류 시 조용히 처리
                  } finally {
                    setAccountSubmitLoading(false);
                  }
                }}
              >
                {accountSubmitLoading ? t.processing : t.submit}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-900/95 border-slate-800 ring-1 ring-slate-800 shadow-2xl">
        <CardHeader className="space-y-1.5 pb-6">
          <CardTitle
            className="text-3xl font-bold tracking-tight text-white text-center"
            style={{
              textShadow:
                "0 2px 4px rgba(0,0,0,0.5), 0 4px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.08), 0 1px 0 rgba(255,255,255,0.15)",
            }}
          >
            AXPAY LOGIN
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-200">
                {t.username}
              </Label>
              <Input
                id="username"
                type="text"
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t.username}
                className="bg-slate-800/50 border-slate-700 text-slate-100"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200">
                {t.password}
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.password}
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
              {loginLoading ? t.loginLoading : t.login}
            </Button>
          </form>
          <p className="mt-4 text-center text-slate-500 text-sm">
            {t.noAccountYet}{" "}
            <Link href={locale === "zh" ? "/zh/signup" : "/signup"} className="text-sky-400 hover:underline">
              {t.signupLink}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
