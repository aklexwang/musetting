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
import { useLocale } from "@/contexts/LocaleContext";
import { getTranslations } from "@/lib/translations";

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

const STATUS_OPTIONS_KEYS: { value: UserStatus; key: "pending" | "approved" | "rejected" }[] = [
  { value: "PENDING", key: "pending" },
  { value: "APPROVED", key: "approved" },
  { value: "REJECTED", key: "rejected" },
];

type AccountStatusValue = "NORMAL" | "SUSPENDED" | "TERMINATED";
const ACCOUNT_STATUS_OPTIONS_KEYS: { value: AccountStatusValue; key: "normal" | "suspended" | "terminated" }[] = [
  { value: "NORMAL", key: "normal" },
  { value: "SUSPENDED", key: "suspended" },
  { value: "TERMINATED", key: "terminated" },
];

const MENU_IDS: AdminMenu[] = ["현황판", "회원목록", "구매", "판매", "계좌 변경"];

export default function AdminPage() {
  const locale = useLocale();
  const t = getTranslations(locale).admin;
  const numFmt = locale === "zh" ? "zh-CN" : "ko-KR";
  const currencySuffix = locale === "zh" ? "元" : "원";
  const getMenuLabel = (menuId: AdminMenu): string => {
    const map: Record<AdminMenu, string> = { "현황판": t.overview, "회원목록": t.memberList, "구매": t.buy, "판매": t.sell, "계좌 변경": t.accountChange };
    return map[menuId];
  };
  const STATUS_OPTIONS = STATUS_OPTIONS_KEYS.map((o) => ({ value: o.value, label: t[o.key] }));
  const ACCOUNT_STATUS_OPTIONS = ACCOUNT_STATUS_OPTIONS_KEYS.map((o) => ({ value: o.value, label: t[o.key] }));

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
        setFetchError(data?.error ?? (locale === "zh" ? "无法加载用户列表。" : "유저 목록을 불러오지 못했습니다."));
        setUsers([]);
        return;
      }
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setFetchError(locale === "zh" ? "网络错误，请确认数据库已启动。" : "네트워크 오류. DB(prisma dev)가 켜져 있는지 확인하세요.");
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
    if (!confirm(locale === "zh" ? `确定删除 ${pendingCount} 条待审核注册？` : `가입 대기 ${pendingCount}건을 삭제할까요?`)) return;
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
    { label: t.pendingSignup, value: pendingCount, hint: pendingCount > 0 ? t.clickForList : undefined, onClick: () => setShowPendingSignups(true), gradient: "from-amber-500/90 to-orange-600/90" },
    { label: t.pendingTxn, value: pendingTxns.length, hint: pendingTxns.length > 0 ? t.clickForList : undefined, onClick: () => setShowPendingTxns(true), gradient: "from-sky-500/90 to-cyan-600/90" },
    { label: t.memberList, value: approvedCount, hint: t.clickForList, onClick: () => setListModal("approved_rejected"), gradient: "from-green-700 to-green-500" },
    { label: t.buy, value: buyCount, hint: t.clickForList, onClick: () => setListModal("buy"), gradient: "from-violet-600 to-violet-500" },
    { label: t.sell, value: sellCount, hint: t.clickForList, onClick: () => setListModal("sell"), gradient: "from-red-600 to-pink-500" },
  ];

  const renderTxnTable = (list: AdminTransaction[], title: string) => (
    <Card className="rounded-2xl border border-slate-700/50 bg-slate-950/40 overflow-hidden">
      <CardHeader className="border-b border-slate-700/50 px-6 py-5 text-center">
        <CardTitle className="text-slate-100 font-semibold text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {txnLoading ? (
          <div className="flex justify-center py-16 text-slate-400 text-sm">{t.loading}</div>
        ) : list.length === 0 ? (
          <div className="flex justify-center py-16 text-slate-500 text-sm">{t.noList}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700/50 hover:bg-transparent">
                <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4 text-center">{t.id}</TableHead>
                <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4 text-center">{t.amount}</TableHead>
                <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4 text-center">{t.status}</TableHead>
                <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4 text-center">{t.appliedAt}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((txn, i) => (
                <TableRow key={txn.id} className={`border-slate-700/40 hover:bg-slate-800/40 transition-colors ${i % 2 === 1 ? "bg-slate-800/20" : ""}`}>
                  <TableCell className="text-slate-200 font-medium px-6 py-4 text-center">{txn.user?.username ?? "-"}</TableCell>
                  <TableCell className="text-slate-300 font-mono text-sm px-6 py-4 text-center">{txn.amount.toLocaleString(numFmt)}{currencySuffix}</TableCell>
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
                      {txn.status === "PENDING" ? t.pending : txn.status === "APPROVED" ? t.approved : t.rejected}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm px-6 py-4 tabular-nums text-center">
                    {new Date(txn.createdAt).toLocaleString(numFmt, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
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
            {t.title}
          </h1>
          <p className="mt-1 text-slate-400 text-sm">{t.subtitle}</p>
        </header>

        <nav className="flex flex-wrap justify-center gap-1 p-1 rounded-2xl bg-slate-800/40 border border-slate-700/50 w-fit mx-auto mb-10" role="tablist">
          {MENU_IDS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={menu === item}
              onClick={() => setMenu(item)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                menu === item
                  ? "bg-slate-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
              }`}
            >
              {getMenuLabel(item)}
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
                <CardTitle className="text-slate-100 font-semibold text-base">{t.recentActivity}</CardTitle>
                <CardDescription className="text-slate-400 text-sm mt-0.5">{t.recentActivityDesc}</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {recentActivities.length === 0 ? (
                  <p className="text-slate-500 text-sm py-8 text-center">{t.noActivity}</p>
                ) : (
                  <ul className="p-6 space-y-3 list-none">
                    {recentActivities.map((item) => (
                      <li
                        key={`${item.kind}-${item.id}-${item.createdAt}`}
                        className="rounded-xl bg-slate-800/50 border border-slate-700/40 overflow-hidden"
                      >
                        <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-4 gap-y-1 py-3 px-4 text-sm min-w-0">
                          <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-md ${item.kind === "회원가입" ? "bg-amber-500/20 text-amber-300" : item.kind === "구매" ? "bg-violet-500/20 text-violet-300" : "bg-pink-500/20 text-pink-300"}`}>
                            {item.kind === "회원가입" ? t.memberReg : item.kind === "구매" ? t.buy : t.sell}
                          </span>
                          <div className="flex flex-col items-center text-center min-w-0">
                            <span className="text-xs text-slate-500">{t.id}</span>
                            <span className="text-slate-200 font-medium mt-0.5 truncate max-w-full">{item.username}</span>
                          </div>
                          <div className="flex flex-col items-center text-center min-w-0">
                            <span className="text-xs text-slate-500">{t.bank}</span>
                            <span className="text-slate-200 font-medium mt-0.5 truncate max-w-full">{item.bankName}</span>
                          </div>
                          <div className="flex flex-col items-center text-center min-w-0">
                            <span className="text-xs text-slate-500">{t.accountNumber}</span>
                            <span className="text-slate-200 font-mono text-xs mt-0.5 truncate max-w-full">{item.accountNumber}</span>
                          </div>
                          <div className="flex flex-col items-center text-center min-w-0">
                            <span className="text-xs text-slate-500">{t.accountHolder}</span>
                            <span className="text-slate-200 font-medium mt-0.5 truncate max-w-full">{item.accountHolder}</span>
                          </div>
                          {item.amount != null ? (
                            <div className="flex flex-col items-center text-center min-w-0">
                              <span className="text-xs text-slate-500">{t.amount}</span>
                              <span className="text-slate-200 font-medium tabular-nums mt-0.5">{item.amount.toLocaleString(numFmt)}{currencySuffix}</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center text-center min-w-0" />
                          )}
                        </div>
                        <div className="px-4 pb-3 pt-0">
                          <span className="text-slate-500 text-xs tabular-nums">
                            {new Date(item.createdAt).toLocaleString(numFmt, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-700/50 bg-slate-950/40 overflow-hidden">
              <CardHeader className="border-b border-slate-700/50 px-6 py-5 text-center">
                <CardTitle className="text-slate-100 font-semibold text-base">{t.keyMetrics}</CardTitle>
                <CardDescription className="text-slate-400 text-sm mt-0.5">{t.metricsDesc}</CardDescription>
              </CardHeader>
              <CardContent className="px-6 py-5 space-y-4">
                {[
                  { key: "pendingSignup", label: t.pendingSignup, value: pendingCount, bar: "bg-amber-500" },
                  { key: "pendingTxn", label: t.pendingTxn, value: pendingTxns.length, bar: "bg-sky-500" },
                  { key: "memberList", label: t.memberList, value: approvedCount, bar: "bg-green-500" },
                  { key: "buy", label: t.buy, value: buyCount, bar: "bg-violet-500" },
                  { key: "sell", label: t.sell, value: sellCount, bar: "bg-pink-500" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center gap-4">
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
                  <span className="text-amber-400">{t.pendingSignup} {pendingCount}{locale === "zh" ? " 条" : "건"}</span>
                  <span className="text-slate-400">·</span>
                  <span>{t.telegramNotice}</span>
                </span>
                <button
                  type="button"
                  onClick={deletePendingUsers}
                  disabled={deletingPending}
                  className="shrink-0 rounded-lg bg-red-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {deletingPending ? t.deletePendingLoading : t.deletePending}
                </button>
              </div>
            )}
            {pendingTxns.length > 0 && !txnLoading && (
              <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-5 py-4 text-sky-200/95 text-sm flex items-center gap-3">
                <span className="text-sky-400">{t.pendingTxn} {pendingTxns.length}{locale === "zh" ? " 条" : "건"}</span>
                <span className="text-slate-400">·</span>
                <span>{t.telegramNoticeShort}</span>
              </div>
            )}
          </div>
        )}

        <Dialog open={showPendingSignups} onOpenChange={setShowPendingSignups}>
          <DialogContent className="max-w-md rounded-2xl border-slate-700/60 bg-slate-900 shadow-2xl text-slate-100 p-0 gap-0 overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-700/50">
              <DialogTitle className="text-slate-100 font-semibold">{t.signupPendingList}</DialogTitle>
              <p className="text-slate-400 text-sm mt-1">{t.telegramNoticeShort}</p>
            </DialogHeader>
            <div className="max-h-[50vh] overflow-y-auto px-6 py-4">
              {pendingUsers.length === 0 ? (
                <p className="text-slate-500 text-sm py-6 text-center">{t.noPendingSignup}</p>
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
              <DialogTitle className="text-slate-100 font-semibold">{t.txnPendingList}</DialogTitle>
              <p className="text-slate-400 text-sm mt-1">{t.telegramNoticeShort}</p>
            </DialogHeader>
            <div className="max-h-[50vh] overflow-y-auto px-6 py-4">
              {pendingTxns.length === 0 ? (
                <p className="text-slate-500 text-sm py-6 text-center">{t.noPendingTxn}</p>
              ) : (
                <ul className="space-y-2">
                  {pendingTxns.map((txn) => (
                    <li key={txn.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-800/60 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium text-slate-200 block truncate">{txn.user?.username ?? "-"}</span>
                        <span className="text-slate-500 text-xs">{txn.type === "BUY" ? t.buy : t.sell} · {txn.amount.toLocaleString(numFmt)}{currencySuffix}</span>
                      </div>
                      <span className="text-slate-500 text-xs tabular-nums shrink-0">
                        {new Date(txn.createdAt).toLocaleString(numFmt, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
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
                {listModal === "approved_rejected" && t.listModalTitleMembers}
                {listModal === "buy" && t.listModalTitleBuy}
                {listModal === "sell" && t.listModalTitleSell}
              </DialogTitle>
              <p className="text-slate-400 text-sm mt-1">
                {listModal === "approved_rejected" && t.listModalDescApproved}
                {listModal === "buy" && t.listModalDescBuy}
                {listModal === "sell" && t.listModalDescSell}
              </p>
            </DialogHeader>
            <div className="max-h-[55vh] overflow-y-auto px-6 py-4">
              {listModal === "approved_rejected" && (
                approvedAndRejectedUsers.length === 0 ? (
                  <p className="text-slate-500 text-sm py-6 text-center">{t.noApprovedRejectedMembers}</p>
                ) : (
                  <ul className="space-y-2">
                    {approvedAndRejectedUsers.map((u) => (
                      <li key={u.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-800/60 px-4 py-3 text-sm">
                        <div className="min-w-0">
                          <span className="font-medium text-slate-200 block truncate">{u.username}</span>
                          <span className="text-slate-500 text-xs">{u.accountHolder}</span>
                        </div>
                        <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${u.status === "APPROVED" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                          {u.status === "APPROVED" ? t.approved : t.rejected}
                        </span>
                        <span className="text-slate-500 text-xs tabular-nums shrink-0">
                          {new Date(u.createdAt).toLocaleString(numFmt, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )
              )}
              {listModal === "buy" && (
                buyTxns.length === 0 ? (
                  <p className="text-slate-500 text-sm py-6 text-center">{t.noBuyList}</p>
                ) : (
                  <ul className="space-y-2">
                    {buyTxns.map((txn) => (
                      <li key={txn.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-800/60 px-4 py-3 text-sm">
                        <div className="min-w-0">
                          <span className="font-medium text-slate-200 block truncate">{txn.user?.username ?? "-"}</span>
                          <span className="text-slate-400 text-xs">{txn.amount.toLocaleString(numFmt)}{currencySuffix}</span>
                        </div>
                        <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${
                          txn.status === "PENDING" ? "bg-amber-500/20 text-amber-300" : txn.status === "APPROVED" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
                        }`}>
                          {txn.status === "PENDING" ? t.pending : txn.status === "APPROVED" ? t.approved : t.rejected}
                        </span>
                        <span className="text-slate-500 text-xs tabular-nums shrink-0">
                          {new Date(txn.createdAt).toLocaleString(numFmt, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )
              )}
              {listModal === "sell" && (
                sellTxns.length === 0 ? (
                  <p className="text-slate-500 text-sm py-6 text-center">{t.noSellList}</p>
                ) : (
                  <ul className="space-y-2">
                    {sellTxns.map((txn) => (
                      <li key={txn.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-800/60 px-4 py-3 text-sm">
                        <div className="min-w-0">
                          <span className="font-medium text-slate-200 block truncate">{txn.user?.username ?? "-"}</span>
                          <span className="text-slate-400 text-xs">{txn.amount.toLocaleString(numFmt)}{currencySuffix}</span>
                        </div>
                        <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded ${
                          txn.status === "PENDING" ? "bg-amber-500/20 text-amber-300" : txn.status === "APPROVED" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
                        }`}>
                          {txn.status === "PENDING" ? t.pending : txn.status === "APPROVED" ? t.approved : t.rejected}
                        </span>
                        <span className="text-slate-500 text-xs tabular-nums shrink-0">
                          {new Date(txn.createdAt).toLocaleString(numFmt, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
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
              <CardTitle className="text-slate-100 font-semibold text-base">{t.memberList}</CardTitle>
              <div className="mt-4 flex justify-center">
                <Input
                  type="text"
                  placeholder={t.memberSearchPlaceholder}
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="max-w-[20rem] h-10 rounded-lg border border-slate-600 bg-slate-800/60 text-slate-200 placeholder:text-slate-500 text-center focus:border-slate-500 focus:ring-2 focus:ring-slate-500/30"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-20 text-slate-400 text-sm">{t.loading}</div>
              ) : fetchError ? (
                <div className="flex flex-col items-center py-20 gap-4 px-6">
                  <p className="text-red-400/90 text-sm text-center max-w-md">{fetchError}</p>
                  <button type="button" onClick={() => fetchUsers()} className="px-4 py-2.5 rounded-xl bg-slate-700 text-slate-200 hover:bg-slate-600 text-sm font-medium transition-colors">
                    {t.retryLoad}
                  </button>
                </div>
              ) : users.length === 0 ? (
                <div className="flex flex-col items-center py-20 gap-3 px-6">
                  <p className="text-slate-400 text-sm">{t.noMembers}</p>
                  <button type="button" onClick={() => fetchUsers()} className="px-4 py-2.5 rounded-xl bg-slate-700 text-slate-200 hover:bg-slate-600 text-sm font-medium transition-colors">{t.refresh}</button>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center py-20 gap-3 px-6">
                  <p className="text-slate-400 text-sm">{t.noSearchResults}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700/50 hover:bg-transparent">
                        <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4 text-center">{t.id}</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4 text-center">{t.bank}</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4 text-center">{t.accountNumber}</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4 text-center">{t.accountHolder}</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4 text-center">{t.signupStatus}</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4 text-center">{t.status}</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4 text-center">{t.date}</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase tracking-wider px-6 py-4 text-center">{t.setting}</TableHead>
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
                            {user.terminated ? t.terminated : user.suspended ? t.suspended : t.normal}
                          </TableCell>
                          <TableCell className="text-slate-500 text-sm px-6 py-4 tabular-nums text-center">
                            {new Date(user.createdAt).toLocaleDateString(numFmt, { month: "2-digit", day: "2-digit", year: "numeric" })}
                          </TableCell>
                          <TableCell className="px-6 py-4 text-center">
                            <button
                              type="button"
                              className="h-7 px-2.5 text-sm font-medium text-slate-400 bg-slate-600/30 border border-slate-500/50 rounded-lg hover:bg-slate-600/60 hover:text-slate-200"
                              onClick={() => setSettingsUser(user)}
                            >
                              {t.setting}
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
              <DialogTitle className="text-slate-50 text-lg font-semibold">{t.memberSetting}</DialogTitle>
            </DialogHeader>
            {settingsUser && (
              <div className="space-y-5 pt-4">
                <div>
                  <label className="block text-slate-400 text-sm font-medium mb-1.5">{t.signupStatusLabel}</label>
                  <Select
                    value={settingsForm.status}
                    onValueChange={(v) => setSettingsForm((f) => ({ ...f, status: v as UserStatus }))}
                  >
                    <SelectTrigger className="w-full h-10 rounded-lg border-slate-600 bg-slate-800 text-slate-200">
                      <span>{STATUS_OPTIONS.find((o) => o.value === settingsForm.status)?.label ?? settingsForm.status}</span>
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
                  <label className="block text-slate-400 text-sm font-medium mb-1.5">{t.statusLabel}</label>
                  <Select
                    value={settingsForm.accountStatus}
                    onValueChange={(v) => setSettingsForm((f) => ({ ...f, accountStatus: v as AccountStatusValue }))}
                  >
                    <SelectTrigger className="w-full h-10 rounded-lg border-slate-600 bg-slate-800 text-slate-200">
                      <span>{ACCOUNT_STATUS_OPTIONS.find((o) => o.value === settingsForm.accountStatus)?.label ?? settingsForm.accountStatus}</span>
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
                  <p className="text-slate-400 text-sm font-medium mb-3">{t.accountChangeSection}</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-slate-500 text-xs mb-1">{t.bankNameLabel}</label>
                      <Input
                        value={settingsForm.bankName}
                        onChange={(e) => setSettingsForm((f) => ({ ...f, bankName: e.target.value }))}
                        className="h-10 rounded-lg border-slate-600 bg-slate-800 text-slate-200"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 text-xs mb-1">{t.accountNumberLabel}</label>
                      <Input
                        value={settingsForm.accountNumber}
                        onChange={(e) => setSettingsForm((f) => ({ ...f, accountNumber: e.target.value }))}
                        className="h-10 rounded-lg border-slate-600 bg-slate-800 text-slate-200"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 text-xs mb-1">{t.accountHolderLabel}</label>
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
                    {t.cancel}
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
                    onClick={handleSettingsSave}
                    disabled={settingsSaving}
                  >
                    {settingsSaving ? t.saving : t.save}
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
                placeholder={t.searchByIdPlaceholder}
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="max-w-[20rem] h-10 rounded-lg border border-slate-600 bg-slate-800/60 text-slate-200 placeholder:text-slate-500 text-center focus:border-slate-500 focus:ring-2 focus:ring-slate-500/30"
              />
            </div>
            {renderTxnTable(filteredBuyTxns, t.buyListTitle)}
          </>
        )}
        {menu === "판매" && (
          <>
            <div className="mb-4 flex justify-center">
              <Input
                type="text"
                placeholder={t.searchByIdPlaceholder}
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="max-w-[20rem] h-10 rounded-lg border border-slate-600 bg-slate-800/60 text-slate-200 placeholder:text-slate-500 text-center focus:border-slate-500 focus:ring-2 focus:ring-slate-500/30"
              />
            </div>
            {renderTxnTable(filteredSellTxns, t.sellListTitle)}
          </>
        )}

        {menu === "계좌 변경" && (
          <Card className="rounded-2xl border border-slate-700/50 bg-slate-950/40 overflow-hidden">
            <CardHeader className="border-b border-slate-700/50 px-6 py-5 text-center">
              <CardTitle className="text-slate-100 font-semibold text-base">{t.accountChange}</CardTitle>
              <CardDescription className="text-slate-400 text-sm mt-0.5">{t.accountChangeList}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {accountChangesLoading ? (
                <div className="flex justify-center py-16 text-slate-400 text-sm">{t.loading}</div>
              ) : accountChanges.length === 0 ? (
                <p className="py-12 text-center text-slate-500 text-sm">{t.noAccountChangeRequests}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700/50 hover:bg-transparent">
                        <TableHead colSpan={5} className="text-slate-400 font-medium text-xs uppercase tracking-wider px-4 py-3 text-center border-r border-slate-700/50">
                          {t.beforeAccount}
                        </TableHead>
                        <TableHead colSpan={5} className="text-slate-400 font-medium text-xs uppercase tracking-wider px-4 py-3 text-center">
                          {t.afterAccount}
                        </TableHead>
                      </TableRow>
                      <TableRow className="border-slate-700/50 hover:bg-transparent">
                        <TableHead className="text-slate-400 font-medium text-xs uppercase px-3 py-2 text-center">{t.id}</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase px-3 py-2 text-center">{t.appliedAtShort}</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase px-3 py-2 text-center">{t.name}</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase px-3 py-2 text-center">{t.bankNameLabel}</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase px-3 py-2 text-center border-r border-slate-700/50">{t.accountNumberLabel}</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase px-3 py-2 text-center">{t.name}</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase px-3 py-2 text-center">{t.bankNameLabel}</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase px-3 py-2 text-center">{t.accountNumberLabel}</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase px-3 py-2 text-center">{t.changeTime}</TableHead>
                        <TableHead className="text-slate-400 font-medium text-xs uppercase px-3 py-2 text-center">{t.status}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accountChanges.map((r) => {
                        const appliedAt = r.processedAt ? new Date(r.processedAt) : null;
                        const dateStr = (d: Date) =>
                          `${String(d.getMonth() + 1).padStart(2, "0")}. ${String(d.getDate()).padStart(2, "0")}. ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
                        const statusLabel = r.status === "APPROVED" ? t.complete : r.status === "REJECTED" ? t.denied : t.pending;
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
