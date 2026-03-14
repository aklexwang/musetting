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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type UserStatus = "PENDING" | "APPROVED" | "REJECTED";
type AdminMenu = "현황판" | "회원목록" | "구매" | "판매" | "계좌 변경";

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
  terminated?: boolean;
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

interface AccountChangeRequestItem {
  id: string;
  userId: string;
  beforeHolder: string;
  beforeBank: string;
  beforeAccount: string;
  afterHolder: string;
  afterBank: string;
  afterAccount: string;
  status: string;
  createdAt: string;
  processedAt: string | null;
  user: { id: string; username: string };
}

const STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: "PENDING", label: "대기" },
  { value: "APPROVED", label: "승인" },
  { value: "REJECTED", label: "거절" },
];

type AccountStatusValue = "NORMAL" | "SUSPENDED" | "TERMINATED";
const ACCOUNT_STATUS_OPTIONS: { value: AccountStatusValue; label: string }[] = [
  { value: "NORMAL", label: "정상" },
  { value: "SUSPENDED", label: "정지" },
  { value: "TERMINATED", label: "해지" },
];

const MENU_ITEMS: { id: AdminMenu; label: string }[] = [
  { id: "현황판", label: "현황판" },
  { id: "회원목록", label: "회원목록" },
  { id: "구매", label: "구매" },
  { id: "판매", label: "판매" },
  { id: "계좌 변경", label: "계좌 변경" },
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
  const [accountChanges, setAccountChanges] = useState<AccountChangeRequestItem[]>([]);
  const [accountChangesLoading, setAccountChangesLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  /** 회원 설정 모달: 선택된 회원 (열면 폼 초기화) */
  const [settingsUser, setSettingsUser] = useState<AdminUser | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsForm, setSettingsForm] = useState<{
    status: UserStatus;
    accountStatus: AccountStatusValue;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  }>({ status: "APPROVED", accountStatus: "NORMAL", bankName: "", accountNumber: "", accountHolder: "" });

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
      if (!res.ok) return;
      await fetchUsers();
    } catch {
      // 요청 중 오류 시 조용히 처리
    } finally {
      setDeletingPending(false);
    }
  };

  const fetchAccountChanges = async () => {
    setAccountChangesLoading(true);
    try {
      const res = await fetch("/api/admin/account-change-requests", { cache: "no-store" });
      const data = await res.json().catch(() => []);
      if (Array.isArray(data)) setAccountChanges(data);
      else setAccountChanges([]);
    } catch {
      setAccountChanges([]);
    } finally {
      setAccountChangesLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchTransactions();
  }, []);

  useEffect(() => {
    if (menu === "계좌 변경") fetchAccountChanges();
  }, [menu]);

  useEffect(() => {
    if (!settingsUser) return;
    const accountStatus: AccountStatusValue = settingsUser.terminated ? "TERMINATED" : settingsUser.suspended ? "SUSPENDED" : "NORMAL";
    setSettingsForm({
      status: settingsUser.status,
      accountStatus,
      bankName: settingsUser.bankName ?? "",
      accountNumber: settingsUser.accountNumber ?? "",
      accountHolder: settingsUser.accountHolder ?? "",
    });
  }, [settingsUser]);

  const updateUser = async (
    id: string,
    payload: {
      status?: UserStatus;
      canBuy?: boolean;
      canSell?: boolean;
      suspended?: boolean;
      terminated?: boolean;
      bankName?: string;
      accountNumber?: string;
      accountHolder?: string;
    }
  ) => {
    setUpdatingId(id);
    try {
      const res = await fetch("/api/admin/users/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...payload }),
      });
      if (!res.ok) return;
      const updated = await res.json().catch(() => ({}));
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, ...updated } : u))
      );
      return updated;
    } catch {
      // 네트워크 오류 시 조용히 처리
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSettingsSave = async () => {
    if (!settingsUser) return;
    setSettingsSaving(true);
    try {
      const suspended = settingsForm.accountStatus === "SUSPENDED" || settingsForm.accountStatus === "TERMINATED";
      const terminated = settingsForm.accountStatus === "TERMINATED";
      await updateUser(settingsUser.id, {
        status: settingsForm.status,
        suspended,
        terminated,
        bankName: settingsForm.bankName.trim(),
        accountNumber: settingsForm.accountNumber.trim(),
        accountHolder: settingsForm.accountHolder.trim(),
      });
      setSettingsUser(null);
    } finally {
      setSettingsSaving(false);
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
    <Card className="rounded-2xl border border-slate-700/50 bg-slate-950/40 overflow-hidden">
      <CardHeader className="border-b border-slate-700/50 px-6 py-5 text-center">
        <CardTitle className="text-slate-100 font-semibold text-base">{title}</CardTitle>
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
                <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4 text-center">아이디</TableHead>
                <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4 text-center">금액</TableHead>
                <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4 text-center">상태</TableHead>
                <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4 text-center">신청일시</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((txn, i) => (
                <TableRow key={txn.id} className={`border-slate-700/40 hover:bg-slate-800/40 transition-colors ${i % 2 === 1 ? "bg-slate-800/20" : ""}`}>
                  <TableCell className="text-slate-200 font-medium px-6 py-4 text-center">{txn.user?.username ?? "-"}</TableCell>
                  <TableCell className="text-slate-300 font-mono text-sm px-6 py-4 text-center">{txn.amount.toLocaleString("ko-KR")}원</TableCell>
                  <TableCell className="px-6 py-4 text-center">
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
                  <TableCell className="text-slate-500 text-sm px-6 py-4 tabular-nums text-center">
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
    <div className="min-h-screen w-full bg-[#020617] text-[#f1f5f9] antialiased">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-30%,rgba(56,189,248,0.06),transparent_50%)] pointer-events-none" aria-hidden />
      <div className="container relative max-w-[72rem] mx-auto px-4 py-8 sm:py-10 text-center">
        <header className="mb-10">
          <h1 className="text-[1.875rem] font-semibold tracking-tight text-white">
            Admin Dashboard
          </h1>
          <p className="mt-1 text-slate-400 text-sm">가맹점 벳이스트 관리</p>
        </header>

        <nav className="flex flex-wrap justify-center gap-1 p-1 rounded-2xl bg-slate-800/40 border border-slate-700/50 w-fit mx-auto mb-10" role="tablist">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
              {kpiCards.map((card) => {
                const content = (
                  <>
                    <p className="text-[2.25rem] font-bold tabular-nums text-white leading-none">{card.value}</p>
                    <p className="text-white text-sm font-medium mt-2">{card.label}</p>
                    {card.hint && <p className="text-white/70 text-xs mt-1.5">{card.hint}</p>}
                  </>
                );
                const style = `rounded-2xl border-0 bg-gradient-to-br ${card.gradient} p-6 text-center transition-transform duration-200 hover:scale-[1.02] active:scale-[0.99] shadow-[0_10px_15px_-3px_rgba(0,0,0,0.2)] cursor-pointer`;
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

            <Card className="rounded-2xl border border-slate-700/50 bg-slate-950/40 overflow-hidden mb-4">
              <CardHeader className="border-b border-slate-700/50 px-6 py-5 text-center">
                <CardTitle className="text-slate-100 font-semibold text-base">실시간 최근 활동</CardTitle>
                <CardDescription className="text-slate-400 text-sm mt-0.5">최근 회원가입·구매·판매 최대 10건</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {recentActivities.length === 0 ? (
                  <p className="text-slate-500 text-sm py-8 text-center">최근 활동이 없습니다.</p>
                ) : (
                  <ul className="p-6 space-y-3 list-none">
                    {recentActivities.map((item) => (
                      <li
                        key={`${item.kind}-${item.id}-${item.createdAt}`}
                        className="rounded-xl bg-slate-800/50 border border-slate-700/40 overflow-hidden"
                      >
                        <div className="flex items-center justify-center gap-3 py-2 px-4 border-b border-slate-700/40">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-md ${item.kind === "회원가입" ? "bg-amber-500/20 text-amber-300" : item.kind === "구매" ? "bg-violet-500/20 text-violet-300" : "bg-pink-500/20 text-pink-300"}`}>
                            {item.kind}
                          </span>
                          <span className="text-slate-500 text-xs tabular-nums">
                            {new Date(item.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 py-3 px-4 text-sm">
                          <div className="flex flex-col items-center text-center">
                            <span className="text-xs text-slate-500">아이디</span>
                            <span className="text-slate-200 font-medium mt-0.5">{item.username}</span>
                          </div>
                          <div className="flex flex-col items-center text-center">
                            <span className="text-xs text-slate-500">은행</span>
                            <span className="text-slate-200 font-medium mt-0.5">{item.bankName}</span>
                          </div>
                          <div className="flex flex-col items-center text-center">
                            <span className="text-xs text-slate-500">계좌번호</span>
                            <span className="text-slate-200 font-mono text-xs mt-0.5">{item.accountNumber}</span>
                          </div>
                          <div className="flex flex-col items-center text-center">
                            <span className="text-xs text-slate-500">예금주</span>
                            <span className="text-slate-200 font-medium mt-0.5">{item.accountHolder}</span>
                          </div>
                          {item.amount != null && (
                            <div className="flex flex-col items-center text-center sm:col-span-2">
                              <span className="text-xs text-slate-500">금액</span>
                              <span className="text-slate-200 font-medium tabular-nums mt-0.5">{item.amount.toLocaleString("ko-KR")}원</span>
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-700/50 bg-slate-950/40 overflow-hidden">
              <CardHeader className="border-b border-slate-700/50 px-6 py-5 text-center">
                <CardTitle className="text-slate-100 font-semibold text-base">주요 지표</CardTitle>
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
                    <span className="text-slate-400 text-sm w-24 shrink-0 text-center">{item.label}</span>
                    <div className="flex-1 h-3 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.bar} transition-all duration-700 ease-out min-w-[4px]`}
                        style={{ width: `${(item.value / maxBar) * 100}%` }}
                      />
                    </div>
                    <span className="text-slate-200 font-mono text-sm w-10 text-center tabular-nums">{item.value}</span>
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
          <Card className="rounded-2xl border border-slate-700/50 bg-slate-950/40 overflow-hidden">
            <CardHeader className="border-b border-slate-700/50 px-6 py-5 text-center">
              <CardTitle className="text-slate-100 font-semibold text-base">회원목록</CardTitle>
              <div className="mt-4 flex justify-center">
                <Input
                  type="text"
                  placeholder="아이디·예금주·은행명으로 회원 검색"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="max-w-[20rem] h-10 rounded-lg border border-slate-600 bg-slate-800/60 text-slate-200 placeholder:text-slate-500 text-center focus:border-slate-500 focus:ring-2 focus:ring-slate-500/30"
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
                        <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4 text-center">아이디</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4 text-center">은행</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4 text-center">계좌번호</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4 text-center">예금주</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4 text-center">가입상태</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4 text-center">상태</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4 text-center">가입일</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4 text-center">정지</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4 text-center">설정</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user, i) => (
                        <TableRow key={user.id} className={`border-slate-700/40 hover:bg-slate-800/40 transition-colors ${i % 2 === 1 ? "bg-slate-800/20" : ""}`}>
                          <TableCell className="text-slate-200 font-medium px-6 py-4 text-center">{user.username}</TableCell>
                          <TableCell className="text-slate-400 text-sm px-6 py-4 text-center">{user.bankName}</TableCell>
                          <TableCell className="text-slate-400 text-sm px-6 py-4 tabular-nums text-center">{user.accountNumber}</TableCell>
                          <TableCell className="text-slate-400 text-sm px-6 py-4 text-center">{user.accountHolder}</TableCell>
                          <TableCell className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium ${user.status === "PENDING" ? "bg-amber-500/20 text-amber-300" : user.status === "APPROVED" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                              {STATUS_OPTIONS.find((o) => o.value === user.status)?.label ?? user.status}
                            </span>
                          </TableCell>
                          <TableCell className="px-6 py-4 text-center text-sm text-slate-400">
                            {user.terminated ? "해지" : user.suspended ? "이용정지" : "정상"}
                          </TableCell>
                          <TableCell className="text-slate-500 text-sm px-6 py-4 tabular-nums text-center">
                            {new Date(user.createdAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit", year: "numeric" })}
                          </TableCell>
                          <TableCell className="px-6 py-4 text-center">
                            <button
                              type="button"
                              disabled={updatingId === user.id}
                              className={`h-7 px-2.5 text-sm font-medium rounded-lg ${user.suspended ? "text-slate-400 bg-slate-600/50 hover:bg-slate-600" : "text-red-400 bg-red-500/10 hover:bg-red-500/20"}`}
                              onClick={() => updateUser(user.id, { suspended: !user.suspended })}
                            >
                              {user.suspended ? "해제" : "정지"}
                            </button>
                          </TableCell>
                          <TableCell className="px-6 py-4 text-center">
                            <button
                              type="button"
                              className="h-7 px-2.5 text-sm font-medium text-slate-400 bg-slate-600/30 border border-slate-500/50 rounded-lg hover:bg-slate-600/60 hover:text-slate-200"
                              onClick={() => setSettingsUser(user)}
                            >
                              설정
                            </button>
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

        <Dialog open={!!settingsUser} onOpenChange={(open) => !open && setSettingsUser(null)}>
          <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 rounded-xl shadow-2xl max-w-[400px]">
            <DialogHeader className="pb-4 border-b border-slate-700">
              <DialogTitle className="text-slate-50 text-lg font-semibold">회원 설정</DialogTitle>
            </DialogHeader>
            {settingsUser && (
              <div className="space-y-5 pt-4">
                <div>
                  <label className="block text-slate-400 text-sm font-medium mb-1.5">가입 상태</label>
                  <Select
                    value={settingsForm.status}
                    onValueChange={(v) => setSettingsForm((f) => ({ ...f, status: v as UserStatus }))}
                  >
                    <SelectTrigger className="w-full h-10 rounded-lg border-slate-600 bg-slate-800 text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      {STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="text-slate-200 focus:bg-slate-700">
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-slate-400 text-sm font-medium mb-1.5">상태</label>
                  <Select
                    value={settingsForm.accountStatus}
                    onValueChange={(v) => setSettingsForm((f) => ({ ...f, accountStatus: v as AccountStatusValue }))}
                  >
                    <SelectTrigger className="w-full h-10 rounded-lg border-slate-600 bg-slate-800 text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700">
                      {ACCOUNT_STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="text-slate-200 focus:bg-slate-700">
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="border-t border-slate-700 pt-4">
                  <p className="text-slate-400 text-sm font-medium mb-3">계좌번호 변경</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-slate-500 text-xs mb-1">은행명</label>
                      <Input
                        value={settingsForm.bankName}
                        onChange={(e) => setSettingsForm((f) => ({ ...f, bankName: e.target.value }))}
                        className="h-10 rounded-lg border-slate-600 bg-slate-800 text-slate-200"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 text-xs mb-1">계좌번호</label>
                      <Input
                        value={settingsForm.accountNumber}
                        onChange={(e) => setSettingsForm((f) => ({ ...f, accountNumber: e.target.value }))}
                        className="h-10 rounded-lg border-slate-600 bg-slate-800 text-slate-200"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 text-xs mb-1">예금주</label>
                      <Input
                        value={settingsForm.accountHolder}
                        onChange={(e) => setSettingsForm((f) => ({ ...f, accountHolder: e.target.value }))}
                        className="h-10 rounded-lg border-slate-600 bg-slate-800 text-slate-200"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 border-slate-500 bg-slate-700/80 text-slate-200 hover:bg-slate-600"
                    onClick={() => setSettingsUser(null)}
                  >
                    취소
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
                    onClick={handleSettingsSave}
                    disabled={settingsSaving}
                  >
                    {settingsSaving ? "저장 중..." : "저장"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {menu === "구매" && (
          <>
            <div className="mb-4 flex justify-center">
              <Input
                type="text"
                placeholder="아이디로 회원 검색"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="max-w-[20rem] h-10 rounded-lg border border-slate-600 bg-slate-800/60 text-slate-200 placeholder:text-slate-500 text-center focus:border-slate-500 focus:ring-2 focus:ring-slate-500/30"
              />
            </div>
            {renderTxnTable(filteredBuyTxns, "구매 신청 내역")}
          </>
        )}
        {menu === "판매" && (
          <>
            <div className="mb-4 flex justify-center">
              <Input
                type="text"
                placeholder="아이디로 회원 검색"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="max-w-[20rem] h-10 rounded-lg border border-slate-600 bg-slate-800/60 text-slate-200 placeholder:text-slate-500 text-center focus:border-slate-500 focus:ring-2 focus:ring-slate-500/30"
              />
            </div>
            {renderTxnTable(filteredSellTxns, "판매 신청 내역")}
          </>
        )}

        {menu === "계좌 변경" && (
          <Card className="rounded-2xl border border-slate-700/50 bg-slate-950/40 overflow-hidden">
            <CardHeader className="border-b border-slate-700/50 px-6 py-5 text-center">
              <CardTitle className="text-slate-100 font-semibold text-base">계좌 변경</CardTitle>
              <CardDescription className="text-slate-400 text-sm mt-0.5">회원 계좌 변경 신청 및 처리 내역</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {accountChangesLoading ? (
                <div className="flex justify-center py-16 text-slate-400 text-sm">로딩 중...</div>
              ) : accountChanges.length === 0 ? (
                <p className="py-12 text-center text-slate-500 text-sm">계좌 변경 신청 내역이 없습니다.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700/50 hover:bg-transparent">
                        <TableHead colSpan={5} className="text-slate-400 font-medium text-xs uppercase tracking-wider px-4 py-3 text-center border-r border-slate-700/50">
                          변경 전 계좌
                        </TableHead>
                        <TableHead colSpan={5} className="text-slate-400 font-medium text-xs uppercase tracking-wider px-4 py-3 text-center">
                          변경 후 계좌
                        </TableHead>
                      </TableRow>
                      <TableRow className="border-slate-700/50 hover:bg-transparent">
                        <TableHead className="text-slate-400 font-medium text-xs uppercase px-3 py-2 text-center">아이디</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase px-3 py-2 text-center">신청 일시</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase px-3 py-2 text-center">이름</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase px-3 py-2 text-center">은행명</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase px-3 py-2 text-center border-r border-slate-700/50">계좌번호</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase px-3 py-2 text-center">이름</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase px-3 py-2 text-center">은행명</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase px-3 py-2 text-center">계좌번호</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase px-3 py-2 text-center">변경 일시</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase px-3 py-2 text-center">상태</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accountChanges.map((r) => {
                        const appliedAt = r.processedAt ? new Date(r.processedAt) : null;
                        const dateStr = (d: Date) =>
                          `${String(d.getMonth() + 1).padStart(2, "0")}. ${String(d.getDate()).padStart(2, "0")}. ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                        const statusLabel = r.status === "APPROVED" ? "완료" : r.status === "REJECTED" ? "거부" : "대기";
                        const statusClass =
                          r.status === "APPROVED"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : r.status === "REJECTED"
                              ? "bg-red-500/20 text-red-300 border-red-500/40"
                              : "bg-amber-500/20 text-amber-300 border-amber-500/40";
                        return (
                          <TableRow key={r.id} className="border-slate-700/40 hover:bg-slate-800/40">
                            <TableCell className="text-slate-200 text-sm px-3 py-2 text-center">{r.user?.username ?? "-"}</TableCell>
                            <TableCell className="text-slate-400 text-sm px-3 py-2 text-center tabular-nums">{dateStr(new Date(r.createdAt))}</TableCell>
                            <TableCell className="text-slate-400 text-sm px-3 py-2 text-center">{r.beforeHolder}</TableCell>
                            <TableCell className="text-slate-400 text-sm px-3 py-2 text-center">{r.beforeBank}</TableCell>
                            <TableCell className="text-slate-400 text-sm px-3 py-2 text-center font-mono border-r border-slate-700/40">{r.beforeAccount}</TableCell>
                            <TableCell className="text-slate-400 text-sm px-3 py-2 text-center">{r.afterHolder}</TableCell>
                            <TableCell className="text-slate-400 text-sm px-3 py-2 text-center">{r.afterBank}</TableCell>
                            <TableCell className="text-slate-400 text-sm px-3 py-2 text-center font-mono">{r.afterAccount}</TableCell>
                            <TableCell className="text-slate-400 text-sm px-3 py-2 text-center tabular-nums">
                              {appliedAt ? dateStr(appliedAt) : "-"}
                            </TableCell>
                            <TableCell className="px-3 py-2 text-center">
                              {r.status === "PENDING" ? (
                                <span className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    disabled={processingId === r.id}
                                    className="h-7 px-2 text-xs font-medium rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                                    onClick={async () => {
                                      setProcessingId(r.id);
                                      try {
                                        const res = await fetch(`/api/admin/account-change-requests/${r.id}`, {
                                          method: "PATCH",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ status: "APPROVED" }),
                                        });
                                        if (res.ok) await fetchAccountChanges();
                                      } finally {
                                        setProcessingId(null);
                                      }
                                    }}
                                  >
                                    승인
                                  </button>
                                  <button
                                    type="button"
                                    disabled={processingId === r.id}
                                    className="h-7 px-2 text-xs font-medium rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30"
                                    onClick={async () => {
                                      setProcessingId(r.id);
                                      try {
                                        const res = await fetch(`/api/admin/account-change-requests/${r.id}`, {
                                          method: "PATCH",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ status: "REJECTED" }),
                                        });
                                        if (res.ok) await fetchAccountChanges();
                                      } finally {
                                        setProcessingId(null);
                                      }
                                    }}
                                  >
                                    거부
                                  </button>
                                </span>
                              ) : (
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${statusClass}`}>
                                  {statusLabel}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
