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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type UserStatus = "PENDING" | "APPROVED" | "REJECTED";
type AdminMenu = "현황판" | "회원가입" | "구매" | "판매";

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
  { id: "회원가입", label: "회원가입" },
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

  const pendingCount = users.filter((u) => u.status === "PENDING").length;
  const pendingTxns = transactions.filter((t) => t.status === "PENDING");
  const buyTxns = transactions.filter((t) => t.type === "BUY");
  const sellTxns = transactions.filter((t) => t.type === "SELL");
  const approvedCount = users.filter((u) => u.status === "APPROVED").length;

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

  useEffect(() => {
    fetchUsers();
    fetchTransactions();
  }, []);

  const updateUser = async (
    id: string,
    payload: { status?: UserStatus; canBuy?: boolean; canSell?: boolean }
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

  const handleStatusChange = (id: string, value: UserStatus) => {
    updateUser(id, { status: value });
  };

  const handleCanBuyChange = (id: string, checked: boolean) => {
    updateUser(id, { canBuy: checked });
  };

  const handleCanSellChange = (id: string, checked: boolean) => {
    updateUser(id, { canSell: checked });
  };

  const renderTxnTable = (list: AdminTransaction[], title: string) => (
    <Card className="bg-slate-900/80 border-slate-700">
      <CardHeader className="border-b border-slate-700 pb-4">
        <CardTitle className="text-lg text-slate-100">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {txnLoading ? (
          <div className="flex justify-center py-8 text-slate-400">로딩 중...</div>
        ) : list.length === 0 ? (
          <div className="flex justify-center py-8 text-slate-500 text-sm">내역이 없습니다.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-transparent">
                <TableHead className="text-slate-300 font-medium">아이디</TableHead>
                <TableHead className="text-slate-300 font-medium">금액</TableHead>
                <TableHead className="text-slate-300 font-medium">상태</TableHead>
                <TableHead className="text-slate-300 font-medium">신청일시</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((txn) => (
                <TableRow key={txn.id} className="border-slate-700 hover:bg-slate-800/50">
                  <TableCell className="text-slate-200 font-medium">{txn.user?.username ?? "-"}</TableCell>
                  <TableCell className="text-slate-300 font-mono">{txn.amount.toLocaleString("ko-KR")}원</TableCell>
                  <TableCell>
                    <span
                      className={
                        txn.status === "PENDING"
                          ? "text-amber-400"
                          : txn.status === "APPROVED"
                            ? "text-emerald-400"
                            : "text-red-400"
                      }
                    >
                      {txn.status === "PENDING" ? "대기" : txn.status === "APPROVED" ? "승인" : "거절"}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {new Date(txn.createdAt).toLocaleString("ko-KR", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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
    <div className="min-h-screen w-full bg-slate-950">
      <div className="container max-w-7xl mx-auto py-6 px-4">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Admin Dashboard
          </h1>
        </header>

        <nav className="flex flex-wrap gap-2 justify-center mb-8 border-b border-slate-700 pb-4">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMenu(item.id)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                menu === item.id
                  ? "bg-slate-600 text-white"
                  : "bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700/80"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {menu === "현황판" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="overflow-hidden border-0 bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg">
                <CardContent className="p-5">
                  <p className="text-3xl font-bold tabular-nums">{pendingCount}</p>
                  <p className="text-white/90 text-sm mt-1">가입 대기</p>
                </CardContent>
              </Card>
              <Card className="overflow-hidden border-0 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
                <CardContent className="p-5">
                  <p className="text-3xl font-bold tabular-nums">{pendingTxns.length}</p>
                  <p className="text-white/90 text-sm mt-1">거래 대기</p>
                </CardContent>
              </Card>
              <Card className="overflow-hidden border-0 bg-gradient-to-br from-red-500 to-orange-600 text-white shadow-lg">
                <CardContent className="p-5">
                  <p className="text-3xl font-bold tabular-nums">{approvedCount}</p>
                  <p className="text-white/90 text-sm mt-1">승인 회원</p>
                </CardContent>
              </Card>
              <Card className="overflow-hidden border-0 bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-lg">
                <CardContent className="p-5">
                  <p className="text-3xl font-bold tabular-nums">{transactions.length}</p>
                  <p className="text-white/90 text-sm mt-1">총 거래</p>
                </CardContent>
              </Card>
            </div>
            {pendingCount > 0 && !loading && (
              <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-amber-200 text-sm">
                가입 요청 <strong>{pendingCount}건</strong> — 텔레그램에서 [승인]/[거절] 처리해 주세요.
              </div>
            )}
            {pendingTxns.length > 0 && !txnLoading && (
              <div className="rounded-lg border border-sky-500/50 bg-sky-500/10 px-4 py-3 text-sky-200 text-sm">
                거래 대기 <strong>{pendingTxns.length}건</strong> — 텔레그램에서 [승인]/[거절] 처리하세요.
              </div>
            )}
          </div>
        )}

        {menu === "회원가입" && (
          <Card className="bg-slate-900/80 border-slate-700">
            <CardHeader className="border-b border-slate-700 pb-4">
              <CardTitle className="text-lg text-slate-100">회원가입 관리</CardTitle>
              <CardDescription className="text-slate-400">
                가입 상태 및 구매/판매 권한을 관리합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {loading ? (
                <div className="flex justify-center py-16 text-slate-400">로딩 중...</div>
              ) : fetchError ? (
                <div className="flex flex-col items-center py-16 gap-4">
                  <p className="text-red-400 text-sm text-center max-w-md">{fetchError}</p>
                  <button type="button" onClick={() => fetchUsers()} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 text-sm">
                    다시 불러오기
                  </button>
                </div>
              ) : users.length === 0 ? (
                <div className="flex flex-col items-center py-16 gap-2 text-slate-400 text-sm">
                  <p>등록된 회원이 없습니다.</p>
                  <button type="button" onClick={() => fetchUsers()} className="mt-2 px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 text-sm">새로고침</button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700 hover:bg-transparent">
                      <TableHead className="text-slate-300 font-medium">아이디</TableHead>
                      <TableHead className="text-slate-300 font-medium">은행</TableHead>
                      <TableHead className="text-slate-300 font-medium">예금주</TableHead>
                      <TableHead className="text-slate-300 font-medium">가입 상태</TableHead>
                      <TableHead className="text-slate-300 font-medium">구매</TableHead>
                      <TableHead className="text-slate-300 font-medium">판매</TableHead>
                      <TableHead className="text-slate-300 font-medium">가입일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id} className="border-slate-700 hover:bg-slate-800/50">
                        <TableCell className="text-slate-200 font-medium">{user.username}</TableCell>
                        <TableCell className="text-slate-400">{user.bankName}</TableCell>
                        <TableCell className="text-slate-400">{user.accountHolder}</TableCell>
                        <TableCell>
                          <Select
                            value={user.status}
                            onValueChange={(v) => handleStatusChange(user.id, v as UserStatus)}
                            disabled={updatingId === user.id}
                          >
                            <SelectTrigger className="w-[90px] border-slate-600 bg-slate-800/50 text-slate-200 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-700">
                              {STATUS_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value} className="text-slate-200 focus:bg-slate-800">
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={user.canBuy}
                            onCheckedChange={(c) => handleCanBuyChange(user.id, c === true)}
                            disabled={updatingId === user.id}
                            className="data-[state=checked]:bg-emerald-600"
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={user.canSell}
                            onCheckedChange={(c) => handleCanSellChange(user.id, c === true)}
                            disabled={updatingId === user.id}
                            className="data-[state=checked]:bg-emerald-600"
                          />
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {new Date(user.createdAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit", year: "numeric" })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {menu === "구매" && (
          <div className="space-y-4">
            {renderTxnTable(buyTxns, "구매 신청 내역")}
          </div>
        )}

        {menu === "판매" && (
          <div className="space-y-4">
            {renderTxnTable(sellTxns, "판매 신청 내역")}
          </div>
        )}
      </div>
    </div>
  );
}
