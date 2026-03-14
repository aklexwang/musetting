"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type UserStatus = "PENDING" | "APPROVED" | "REJECTED";
type AdminMenu = "현황판" | "회원목록" | "구매" | "판매";

interface AdminUser {
  id: string;
  username: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  role: string;
  status: UserStatus;
  canBuy: boolean;
  canSell: boolean;
  suspended: boolean;
  createdAt: string;
}

interface AdminTransaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  apiStatus: string;
  createdAt: string;
  user: { username: string };
}

const STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: "PENDING", label: "대기" },
  { value: "APPROVED", label: "승인" },
  { value: "REJECTED", label: "거절" },
];

const MENU_ITEMS: { id: AdminMenu; label: string }[] = [
  { id: "현황판", label: "현황판" },
  { id: "회원목록", label: "회원목록" },
  { id: "구매", label: "구매" },
  { id: "판매", label: "판매" },
];

export default function AdminPage() {
  const [menu, setMenu] = useState<AdminMenu>("현황판");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [txnLoading, setTxnLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showPendingSignups, setShowPendingSignups] = useState(false);
  const [showPendingTxns, setShowPendingTxns] = useState(false);
  const [deletingPending, setDeletingPending] = useState(false);
  const [listModal, setListModal] = useState<"approved_rejected" | "buy" | "sell" | null>(null);
  const [memberSearch, setMemberSearch] = useState("");

  const pendingUsers = users.filter((u) => u.status === "PENDING");
  const approvedAndRejectedUsers = users.filter((u) => u.status === "APPROVED" || u.status === "REJECTED");
  const pendingCount = pendingUsers.length;
  const pendingTxns = transactions.filter((t) => t.status === "PENDING");
  const buyTxns = transactions.filter((t) => t.type === "BUY");
  const sellTxns = transactions.filter((t) => t.type === "SELL");
  const approvedCount = users.filter((u) => u.status === "APPROVED").length;
  const buyCount = buyTxns.length;
  const sellCount = sellTxns.length;
  const maxBar = Math.max(pendingCount, pendingTxns.length, approvedCount, buyCount, sellCount, 1);

  const memberSearchLower = memberSearch.trim().toLowerCase();
  const filteredUsers =
    !memberSearchLower ? users : users.filter((u) => u.username.toLowerCase().includes(memberSearchLower) || (u.accountHolder ?? "").toLowerCase().includes(memberSearchLower) || (u.bankName ?? "").toLowerCase().includes(memberSearchLower));
  const filteredBuyTxns = !memberSearchLower ? buyTxns : buyTxns.filter((t) => (t.user?.username ?? "").toLowerCase().includes(memberSearchLower));
  const filteredSellTxns = !memberSearchLower ? sellTxns : sellTxns.filter((t) => (t.user?.username ?? "").toLowerCase().includes(memberSearchLower));

  type RecentItem = {
    kind: "회원가입" | "구매" | "판매";
    id: string;
    createdAt: string;
    username: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    amount?: number;
  };
  const recentActivities: RecentItem[] = [
    ...users.map((u): RecentItem => ({
      kind: "회원가입",
      id: u.id,
      createdAt: u.createdAt,
      username: u.username,
      bankName: u.bankName ?? "-",
      accountNumber: u.accountNumber ?? "-",
      accountHolder: u.accountHolder ?? "-",
    })),
    ...transactions.map((t): RecentItem => {
      const u = users.find((x) => x.username === (t.user?.username ?? ""));
      return {
        kind: t.type === "BUY" ? "구매" : "판매",
        id: t.id,
        createdAt: t.createdAt,
        username: t.user?.username ?? "-",
        bankName: u?.bankName ?? "-",
        accountNumber: u?.accountNumber ?? "-",
        accountHolder: u?.accountHolder ?? "-",
        amount: t.amount,
      };
    }),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  const fetchUsers = async () => {
    setFetchError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (!res.ok) {
        setFetchError(data?.error ?? "유저 목록을 불러오지 못했습니다.");
        setUsers([]);
        return;
      }
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setFetchError("네트워크 오류. DB(prisma dev)가 켜져 있는지 확인하세요.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setTxnLoading(true);
    try {
      const res = await fetch("/api/admin/transactions");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setTransactions(data);
      else setTransactions([]);
    } catch {
      setTransactions([]);
    } finally {
      setTxnLoading(false);
    }
  };

  const deletePendingUsers = async () => {
    if (pendingCount === 0 || deletingPending) return;
    if (!confirm(`가입 대기 ${pendingCount}건을 삭제할까요?`)) return;
    setDeletingPending(true);
    try {
      const res = await fetch("/api/admin/users?status=PENDING", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error ?? "삭제에 실패했습니다.");
        return;
      }
      alert(`가입 대기 ${data.deleted ?? 0}건이 삭제되었습니다.`);
      await fetchUsers();
    } catch {
      alert("요청 중 오류가 발생했습니다.");
    } finally {
      setDeletingPending(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchTransactions();
  }, []);

  const updateUser = async (
    id: string,
    payload: { status?: UserStatus; canBuy?: boolean; canSell?: boolean; suspended?: boolean }
  ) => {
    setUpdatingId(id);
    try {
      const res = await fetch("/api/admin/users/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...payload }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? "저장에 실패했습니다.");
        return;
      }
      const updated = await res.json();
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, ...updated } : u))
      );
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setUpdatingId(null);
    }
  };

  const kpiCards: { label: string; value: number; hint?: string; onClick?: () => void; gradient: string }[] = [
    { label: "가입 대기", value: pendingCount, hint: pendingCount > 0 ? "클릭 시 목록" : undefined, onClick: () => setShowPendingSignups(true), gradient: "from-amber-500/90 to-orange-600/90" },
    { label: "거래 대기", value: pendingTxns.length, hint: pendingTxns.length > 0 ? "클릭 시 목록" : undefined, onClick: () => setShowPendingTxns(true), gradient: "from-sky-500/90 to-cyan-600/90" },
    { label: "회원목록", value: approvedCount, hint: "클릭 시 목록", onClick: () => setListModal("approved_rejected"), gradient: "from-green-700 to-green-500" },
    { label: "구매", value: buyCount, hint: "클릭 시 목록", onClick: () => setListModal("buy"), gradient: "from-violet-600 to-violet-500" },
    { label: "판매", value: sellCount, hint: "클릭 시 목록", onClick: () => setListModal("sell"), gradient: "from-red-600 to-pink-500" },
  ];

  const renderTxnTable = (list: AdminTransaction[], title: string) => (
    <Card className="rounded-2xl border border-slate-700/60 bg-slate-900/50 backdrop-blur-sm overflow-hidden">
      <CardHeader className="border-b border-slate-700/50 px-6 py-5">
        <CardTitle className="text-slate-100 font-semibold tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {txnLoading ? (
          <div className="flex justify-center py-16 text-slate-400 text-sm">로딩 중...</div>
        ) : list.length === 0 ? (
          <div className="flex justify-center py-16 text-slate-500 text-sm">내역이 없습니다.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700/50 hover:bg-transparent">
                <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4">아이디</TableHead>
                <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4">금액</TableHead>
                <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4">상태</TableHead>
                <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4">신청일시</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((txn, i) => (
                <TableRow key={txn.id} className={`border-slate-700/40 hover:bg-slate-800/40 transition-colors ${i % 2 === 1 ? "bg-slate-800/20" : ""}`}>
                  <TableCell className="text-slate-200 font-medium px-6 py-4">{txn.user?.username ?? "-"}</TableCell>
                  <TableCell className="text-slate-300 font-mono text-sm px-6 py-4">{txn.amount.toLocaleString("ko-KR")}원</TableCell>
                  <TableCell className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        txn.status === "PENDING"
                          ? "bg-amber-500/20 text-amber-300"
                          : txn.status === "APPROVED"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-red-500/20 text-red-300"
                      }`}
                    >
                      {txn.status === "PENDING" ? "대기" : txn.status === "APPROVED" ? "승인" : "거절"}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm px-6 py-4 tabular-nums">
                    {new Date(txn.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 antialiased">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-30%,rgba(56,189,248,0.06),transparent_50%)] pointer-events-none" aria-hidden />
      <div className="container relative max-w-6xl mx-auto px-4 py-8 sm:py-10">
        <header className="mb-10">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Admin Dashboard
          </h1>
          <p className="mt-1 text-slate-400 text-sm">가맹점 벳이스트 관리</p>
        </header>

        <nav className="flex flex-wrap gap-1 p-1 rounded-2xl bg-slate-800/40 border border-slate-700/50 w-fit mb-10" role="tablist">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={menu === item.id}
              onClick={() => setMenu(item.id)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                menu === item.id
                  ? "bg-slate-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {menu === "현황판" && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {kpiCards.map((card) => {
                const content = (
                  <>
                    <p className="text-4xl sm:text-5xl font-bold tabular-nums text-white leading-none">{card.value}</p>
                    <p className="text-white text-sm mt-2 font-medium">{card.label}</p>
                    {card.hint && <p className="text-white/70 text-xs mt-1.5">{card.hint}</p>}
                  </>
                );
                const style = `rounded-2xl border-0 bg-gradient-to-br ${card.gradient} p-6 sm:p-7 text-left transition-transform duration-200 hover:scale-[1.02] active:scale-[0.99] shadow-lg`;
                return card.onClick ? (
                  <button key={card.label} type="button" onClick={card.onClick} className={style}>
                    {content}
                  </button>
                ) : (
                  <div key={card.label} className={style}>
                    {content}
                  </div>
                );
              })}
            </div>

            <Card className="rounded-2xl border border-slate-700/50 bg-slate-900/40 overflow-hidden">
              <CardHeader className="border-b border-slate-700/50 px-6 py-4">
                <CardTitle className="text-slate-100 font-semibold tracking-tight text-base">실시간 최근 활동</CardTitle>
                <CardDescription className="text-slate-400 text-sm mt-0.5">최근 회원가입·구매·판매 최대 10건</CardDescription>
              </CardHeader>
              <CardContent className="px-6 py-4">
                {recentActivities.length === 0 ? (
                  <p className="text-slate-500 text-sm py-6 text-center">최근 활동이 없습니다.</p>
                ) : (
                  <ul className="space-y-2">
                    {recentActivities.map((item) => (
                      <li
                        key={`${item.kind}-${item.id}-${item.createdAt}`}
                        className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/40 text-sm"
                      >
                        <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${item.kind === "회원가입" ? "bg-amber-500/20 text-amber-300" : item.kind === "구매" ? "bg-violet-500/20 text-violet-300" : "bg-pink-500/20 text-pink-300"}`}>
                          {item.kind}
                        </span>
                        <span className="text-slate-500 shrink-0">{new Date(item.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                        <span className="text-slate-400">아이디 <span className="text-slate-200">{item.username}</span></span>
                        <span className="text-slate-400">은행 <span className="text-slate-200">{item.bankName}</span></span>
                        <span className="text-slate-400">계좌번호 <span className="text-slate-200 font-mono">{item.accountNumber}</span></span>
                        <span className="text-slate-400">예금주 <span className="text-slate-200">{item.accountHolder}</span></span>
                        {item.amount != null && (
                          <span className="text-slate-400">금액 <span className="text-slate-200 font-semibold tabular-nums">{item.amount.toLocaleString("ko-KR")}원</span></span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-700/50 bg-slate-900/40 overflow-hidden">
              <CardHeader className="border-b border-slate-700/50 px-6 py-5">
                <CardTitle className="text-slate-100 font-semibold tracking-tight">주요 지표</CardTitle>
                <CardDescription className="text-slate-400 text-sm mt-0.5">지표별 비교</CardDescription>
              </CardHeader>
              <CardContent className="px-6 py-5 space-y-4">
                {[
                  { label: "가입 대기", value: pendingCount, bar: "bg-amber-500" },
                  { label: "거래 대기", value: pendingTxns.length, bar: "bg-sky-500" },
                  { label: "회원목록", value: approvedCount, bar: "bg-green-500" },
                  { label: "구매", value: buyCount, bar: "bg-violet-500" },
                  { label: "판매", value: sellCount, bar: "bg-pink-500" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-4">
                    <span className="text-slate-400 text-sm w-24 shrink-0">{item.label}</span>
                    <div className="flex-1 h-3 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.bar} transition-all duration-700 ease-out min-w-[4px]`}
                        style={{ width: `${(item.value / maxBar) * 100}%` }}
                      />
                    </div>
                    <span className="text-slate-200 font-mono text-sm w-10 text-right tabular-nums">{item.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {pendingCount > 0 && !loading && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-amber-200/95 text-sm flex flex-wrap items-center justify-between gap-3">
                <span className="flex items-center gap-3">
                  <span className="text-amber-400">가입 요청 {pendingCount}건</span>
                  <span className="text-slate-400">·</span>
                  <span>텔레그램에서 [승인]/[거절] 처리해 주세요.</span>
                </span>
                <button
                  type="button"
                  onClick={deletePendingUsers}
                  disabled={deletingPending}
                  className="shrink-0 rounded-lg bg-red-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {deletingPending ? "삭제 중..." : "가입 대기 데이터 삭제"}
                </button>
              </div>
            )}
            {pendingTxns.length > 0 && !txnLoading && (
              <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-5 py-4 text-sky-200/95 text-sm flex items-center gap-3">
                <span className="text-sky-400">거래 대기 {pendingTxns.length}건</span>
                <span className="text-slate-400">·</span>
                <span>텔레그램에서 [승인]/[거절] 처리하세요.</span>
              </div>
            )}
          </div>
        )}

        <Dialog open={showPendingSignups} onOpenChange={setShowPendingSignups}>
          <DialogContent className="max-w-md rounded-2xl border-slate-700/60 bg-slate-900 shadow-2xl text-slate-100 p-0 gap-0 overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-700/50">
              <DialogTitle className="text-slate-100 font-semibold">가입 대기 목록</DialogTitle>
              <p className="text-slate-400 text-sm mt-1">텔레그램에서 승인/거절 처리해 주세요.</p>
            </DialogHeader>
            <div className="max-h-[50vh] overflow-y-auto px-6 py-4">
              {pendingUsers.length === 0 ? (
                <p className="text-slate-500 text-sm py-6 text-center">대기 중인 가입 요청이 없습니다.</p>
              ) : (
                <ul className="space-y-2">
                  {pendingUsers.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-800/60 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium text-slate-200 block truncate">{u.username}</span>
                        <span className="text-slate-500 text-xs">{u.accountHolder}</span>
                      </div>
                      <span className="text-slate-500 text-xs tabular-nums shrink-0">
                        {new Date(u.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showPendingTxns} onOpenChange={setShowPendingTxns}>
          <DialogContent className="max-w-md rounded-2xl border-slate-700/60 bg-slate-900 shadow-2xl text-slate-100 p-0 gap-0 overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-700/50">
              <DialogTitle className="text-slate-100 font-semibold">거래 대기 목록</DialogTitle>
              <p className="text-slate-400 text-sm mt-1">텔레그램에서 승인/거절 처리해 주세요.</p>
            </DialogHeader>
            <div className="max-h-[50vh] overflow-y-auto px-6 py-4">
              {pendingTxns.length === 0 ? (
                <p className="text-slate-500 text-sm py-6 text-center">대기 중인 거래가 없습니다.</p>
              ) : (
                <ul className="space-y-2">
                  {pendingTxns.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-800/60 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium text-slate-200 block truncate">{t.user?.username ?? "-"}</span>
                        <span className="text-slate-500 text-xs">{t.type === "BUY" ? "구매" : "판매"} · {t.amount.toLocaleString("ko-KR")}원</span>
                      </div>
                      <span className="text-slate-500 text-xs tabular-nums shrink-0">
                        {new Date(t.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={listModal !== null} onOpenChange={(open) => !open && setListModal(null)}>
          <DialogContent className="max-w-lg rounded-2xl border-slate-700/60 bg-slate-900 shadow-2xl text-slate-100 p-0 gap-0 overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-700/50">
              <DialogTitle className="text-slate-100 font-semibold">
                {listModal === "approved_rejected" && "회원목록"}
                {listModal === "buy" && "구매 신청 회원 목록"}
                {listModal === "sell" && "판매 신청 회원 목록"}
              </DialogTitle>
              <p className="text-slate-400 text-sm mt-1">
                {listModal === "approved_rejected" && "승인된 회원과 거부된 회원 데이터입니다."}
                {listModal === "buy" && "구매를 신청한 회원 데이터입니다."}
                {listModal === "sell" && "판매를 신청한 회원 데이터입니다."}
              </p>
            </DialogHeader>
            <div className="max-h-[55vh] overflow-y-auto px-6 py-4">
              {listModal === "approved_rejected" && (
                approvedAndRejectedUsers.length === 0 ? (
                  <p className="text-slate-500 text-sm py-6 text-center">승인/거부된 회원이 없습니다.</p>
                ) : (
                  <ul className="space-y-2">
                    {approvedAndRejectedUsers.map((u) => (
                      <li key={u.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-800/60 px-4 py-3 text-sm">
                        <div className="min-w-0">
                          <span className="font-medium text-slate-200 block truncate">{u.username}</span>
                          <span className="text-slate-500 text-xs">{u.accountHolder}</span>
                        </div>
                        <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${u.status === "APPROVED" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                          {u.status === "APPROVED" ? "승인" : "거절"}
                        </span>
                        <span className="text-slate-500 text-xs tabular-nums shrink-0">
                          {new Date(u.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )
              )}
              {listModal === "buy" && (
                buyTxns.length === 0 ? (
                  <p className="text-slate-500 text-sm py-6 text-center">구매 신청 내역이 없습니다.</p>
                ) : (
                  <ul className="space-y-2">
                    {buyTxns.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-800/60 px-4 py-3 text-sm">
                        <div className="min-w-0">
                          <span className="font-medium text-slate-200 block truncate">{t.user?.username ?? "-"}</span>
                          <span className="text-slate-400 text-xs">{t.amount.toLocaleString("ko-KR")}원</span>
                        </div>
                        <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${
                          t.status === "PENDING" ? "bg-amber-500/20 text-amber-300" : t.status === "APPROVED" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
                        }`}>
                          {t.status === "PENDING" ? "대기" : t.status === "APPROVED" ? "승인" : "거절"}
                        </span>
                        <span className="text-slate-500 text-xs tabular-nums shrink-0">
                          {new Date(t.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )
              )}
              {listModal === "sell" && (
                sellTxns.length === 0 ? (
                  <p className="text-slate-500 text-sm py-6 text-center">판매 신청 내역이 없습니다.</p>
                ) : (
                  <ul className="space-y-2">
                    {sellTxns.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-800/60 px-4 py-3 text-sm">
                        <div className="min-w-0">
                          <span className="font-medium text-slate-200 block truncate">{t.user?.username ?? "-"}</span>
                          <span className="text-slate-400 text-xs">{t.amount.toLocaleString("ko-KR")}원</span>
                        </div>
                        <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${
                          t.status === "PENDING" ? "bg-amber-500/20 text-amber-300" : t.status === "APPROVED" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
                        }`}>
                          {t.status === "PENDING" ? "대기" : t.status === "APPROVED" ? "승인" : "거절"}
                        </span>
                        <span className="text-slate-500 text-xs tabular-nums shrink-0">
                          {new Date(t.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </div>
          </DialogContent>
        </Dialog>

        {menu === "회원목록" && (
          <Card className="rounded-2xl border border-slate-700/50 bg-slate-900/40 overflow-hidden">
            <CardHeader className="border-b border-slate-700/50 px-6 py-5">
              <CardTitle className="text-slate-100 font-semibold tracking-tight">회원목록</CardTitle>
              <div className="mt-4">
                <Input
                  type="text"
                  placeholder="아이디·예금주·은행명으로 회원 검색"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="max-w-xs h-10 rounded-lg border-slate-600 bg-slate-800/60 text-slate-200 placeholder:text-slate-500"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-20 text-slate-400 text-sm">로딩 중...</div>
              ) : fetchError ? (
                <div className="flex flex-col items-center py-20 gap-4 px-6">
                  <p className="text-red-400/90 text-sm text-center max-w-md">{fetchError}</p>
                  <button type="button" onClick={() => fetchUsers()} className="px-4 py-2.5 rounded-xl bg-slate-700 text-slate-200 hover:bg-slate-600 text-sm font-medium transition-colors">
                    다시 불러오기
                  </button>
                </div>
              ) : users.length === 0 ? (
                <div className="flex flex-col items-center py-20 gap-3 px-6">
                  <p className="text-slate-400 text-sm">등록된 회원이 없습니다.</p>
                  <button type="button" onClick={() => fetchUsers()} className="px-4 py-2.5 rounded-xl bg-slate-700 text-slate-200 hover:bg-slate-600 text-sm font-medium transition-colors">새로고침</button>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center py-20 gap-3 px-6">
                  <p className="text-slate-400 text-sm">검색 결과가 없습니다.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700/50 hover:bg-transparent">
                        <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4">아이디</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4">은행</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4">계좌번호</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4">예금주</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4">가입상태</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4">가입일</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4 text-right">정지</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user, i) => (
                        <TableRow key={user.id} className={`border-slate-700/40 hover:bg-slate-800/40 transition-colors ${i % 2 === 1 ? "bg-slate-800/20" : ""}`}>
                          <TableCell className="text-slate-200 font-medium px-6 py-4">{user.username}</TableCell>
                          <TableCell className="text-slate-400 text-sm px-6 py-4">{user.bankName}</TableCell>
                          <TableCell className="text-slate-400 text-sm px-6 py-4 tabular-nums">{user.accountNumber}</TableCell>
                          <TableCell className="text-slate-400 text-sm px-6 py-4">{user.accountHolder}</TableCell>
                          <TableCell className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium ${user.status === "PENDING" ? "bg-amber-500/20 text-amber-300" : user.status === "APPROVED" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                              {STATUS_OPTIONS.find((o) => o.value === user.status)?.label ?? user.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-slate-500 text-sm px-6 py-4 tabular-nums">
                            {new Date(user.createdAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit", year: "numeric" })}
                          </TableCell>
                          <TableCell className="px-6 py-4 text-right">
                            <Button
                              type="button"
                              variant={user.suspended ? "secondary" : "destructive"}
                              size="sm"
                              disabled={updatingId === user.id}
                              className={user.suspended ? "bg-slate-600 hover:bg-slate-500 text-slate-200" : ""}
                              onClick={() => updateUser(user.id, { suspended: !user.suspended })}
                            >
                              {user.suspended ? "해제" : "정지"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {menu === "구매" && (
          <>
            <div className="mb-4">
              <Input
                type="text"
                placeholder="아이디로 회원 검색"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="max-w-xs h-10 rounded-lg border-slate-600 bg-slate-800/60 text-slate-200 placeholder:text-slate-500"
              />
            </div>
            {renderTxnTable(filteredBuyTxns, "구매 신청 내역")}
          </>
        )}
        {menu === "판매" && (
          <>
            <div className="mb-4">
              <Input
                type="text"
                placeholder="아이디로 회원 검색"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="max-w-xs h-10 rounded-lg border-slate-600 bg-slate-800/60 text-slate-200 placeholder:text-slate-500"
              />
            </div>
            {renderTxnTable(filteredSellTxns, "판매 신청 내역")}
          </>
        )}
      </div>
    </div>
  );
}
