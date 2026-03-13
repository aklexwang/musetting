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

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [txnLoading, setTxnLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const pendingCount = users.filter((u) => u.status === "PENDING").length;
  const pendingTxns = transactions.filter((t) => t.status === "PENDING");

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

  return (
    <div className="min-h-screen w-full bg-slate-950">
      <div className="container max-w-7xl mx-auto py-8 px-4">
        <Card className="bg-slate-900/95 border-slate-800 ring-1 ring-slate-800 shadow-2xl">
          <CardHeader className="border-b border-slate-800/80 pb-6">
            <CardTitle className="text-2xl font-semibold tracking-tight text-slate-50">
              관리자 대시보드
            </CardTitle>
            <CardDescription className="text-slate-400">
              가맹점 파트너 가입 상태 및 구매/판매 권한을 관리합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {pendingCount > 0 && !loading && (
              <div
                role="alert"
                className="mb-6 flex items-center gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-amber-200"
              >
                <span className="text-lg" aria-hidden>
                  🔔
                </span>
                <p className="text-sm font-medium">
                  가입 요청 <strong>{pendingCount}건</strong>이 텔레그램으로 전달되었습니다. 텔레그램에서 [승인]/[거절] 처리해 주세요.
                </p>
              </div>
            )}
            {pendingTxns.length > 0 && !txnLoading && (
              <div
                role="alert"
                className="mb-6 flex items-center gap-3 rounded-lg border border-sky-500/50 bg-sky-500/10 px-4 py-3 text-sky-200"
              >
                <span className="text-lg" aria-hidden>
                  📋
                </span>
                <p className="text-sm font-medium">
                  승인 대기 중인 <strong>거래 신청</strong>이 <strong>{pendingTxns.length}건</strong> 있습니다. 텔레그램에서 [승인]/[거절] 처리하세요.
                </p>
              </div>
            )}
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-400">
                로딩 중...
              </div>
            ) : fetchError ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <p className="text-red-400 text-sm text-center max-w-md">{fetchError}</p>
                <button
                  type="button"
                  onClick={() => fetchUsers()}
                  className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 text-sm"
                >
                  다시 불러오기
                </button>
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
                <p>등록된 유저가 없습니다.</p>
                <p className="text-xs text-slate-500">회원가입 후 /signup 에서 가입한 계정이 여기 표시됩니다.</p>
                <button
                  type="button"
                  onClick={() => fetchUsers()}
                  className="mt-2 px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 text-sm"
                >
                  새로고침
                </button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-300 font-medium">아이디</TableHead>
                    <TableHead className="text-slate-300 font-medium">은행</TableHead>
                    <TableHead className="text-slate-300 font-medium">계좌번호</TableHead>
                    <TableHead className="text-slate-300 font-medium">예금주</TableHead>
                    <TableHead className="text-slate-300 font-medium">가입 상태</TableHead>
                    <TableHead className="text-slate-300 font-medium">구매 권한</TableHead>
                    <TableHead className="text-slate-300 font-medium">판매 권한</TableHead>
                    <TableHead className="text-slate-300 font-medium">가입일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow
                      key={user.id}
                      className="border-slate-800 hover:bg-slate-800/50 transition-colors"
                    >
                      <TableCell className="text-slate-200 font-medium">
                        {user.username}
                      </TableCell>
                      <TableCell className="text-slate-400">{user.bankName}</TableCell>
                      <TableCell className="text-slate-400 font-mono text-sm">
                        {user.accountNumber}
                      </TableCell>
                      <TableCell className="text-slate-400">{user.accountHolder}</TableCell>
                      <TableCell>
                        <Select
                          value={user.status}
                          onValueChange={(value) =>
                            handleStatusChange(user.id, value as UserStatus)
                          }
                          disabled={updatingId === user.id}
                        >
                          <SelectTrigger
                            className={`
                              w-[100px] border-slate-700 bg-slate-800/50 text-slate-200
                              hover:bg-slate-800 focus:ring-slate-500
                            `}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-700">
                            {STATUS_OPTIONS.map((opt) => (
                              <SelectItem
                                key={opt.value}
                                value={opt.value}
                                className="text-slate-200 focus:bg-slate-800 focus:text-slate-100"
                              >
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={user.canBuy}
                          onCheckedChange={(checked) =>
                            handleCanBuyChange(user.id, checked === true)
                          }
                          disabled={updatingId === user.id}
                          className="data-[state=checked]:bg-emerald-600"
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={user.canSell}
                          onCheckedChange={(checked) =>
                            handleCanSellChange(user.id, checked === true)
                          }
                          disabled={updatingId === user.id}
                          className="data-[state=checked]:bg-emerald-600"
                        />
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {new Date(user.createdAt).toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="mt-8 bg-slate-900/95 border-slate-800 ring-1 ring-slate-800 shadow-2xl">
          <CardHeader className="border-b border-slate-800/80 pb-6">
            <CardTitle className="text-xl font-semibold tracking-tight text-slate-50">
              최근 거래 신청
            </CardTitle>
            <CardDescription className="text-slate-400">
              구매/판매 신청 내역입니다. 텔레그램 알림이 오지 않아도 여기에서 확인할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {txnLoading ? (
              <div className="flex justify-center py-8 text-slate-400">로딩 중...</div>
            ) : transactions.length === 0 ? (
              <div className="flex justify-center py-8 text-slate-500 text-sm">거래 신청이 없습니다.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-300 font-medium">아이디</TableHead>
                    <TableHead className="text-slate-300 font-medium">유형</TableHead>
                    <TableHead className="text-slate-300 font-medium">금액</TableHead>
                    <TableHead className="text-slate-300 font-medium">상태</TableHead>
                    <TableHead className="text-slate-300 font-medium">신청일시</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn) => (
                    <TableRow
                      key={txn.id}
                      className="border-slate-800 hover:bg-slate-800/50 transition-colors"
                    >
                      <TableCell className="text-slate-200 font-medium">
                        {txn.user?.username ?? "-"}
                      </TableCell>
                      <TableCell className="text-slate-400">
                        {txn.type === "BUY" ? "구매" : "판매"}
                      </TableCell>
                      <TableCell className="text-slate-400 font-mono">
                        {txn.amount.toLocaleString("ko-KR")}원
                      </TableCell>
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
                          {txn.status === "PENDING"
                            ? "대기"
                            : txn.status === "APPROVED"
                              ? "승인"
                              : "거절"}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {new Date(txn.createdAt).toLocaleString("ko-KR", {
                          year: "numeric",
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
            {!txnLoading && transactions.length > 0 && (
              <button
                type="button"
                onClick={() => fetchTransactions()}
                className="mt-4 px-3 py-1.5 rounded-md bg-slate-700 text-slate-200 hover:bg-slate-600 text-sm"
              >
                새로고침
              </button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
