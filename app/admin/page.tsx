"use client";

import { useEffect, useState, useMemo } from "react";
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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

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
  const [expandedSignup, setExpandedSignup] = useState(false);
  const [expandedTxn, setExpandedTxn] = useState(false);

  const pendingUsers = useMemo(() => users.filter((u) => u.status === "PENDING"), [users]);
  const pendingTxns = useMemo(() => transactions.filter((t) => t.status === "PENDING"), [transactions]);
  const buyTxns = useMemo(() => transactions.filter((t) => t.type === "BUY"), [transactions]);
  const sellTxns = useMemo(() => transactions.filter((t) => t.type === "SELL"), [transactions]);
  const pendingCount = pendingUsers.length;
  const approvedCount = users.filter((u) => u.status === "APPROVED").length;

  const barChartData = useMemo(() => [
    { name: "가입대기", count: pendingCount, fill: "#f97316" },
    { name: "거래대기", count: pendingTxns.length, fill: "#eab308" },
    { name: "승인회원", count: approvedCount, fill: "#ef4444" },
    { name: "구매", count: buyTxns.length, fill: "#22c55e" },
    { name: "판매", count: sellTxns.length, fill: "#a855f7" },
  ], [pendingCount, pendingTxns.length, approvedCount, buyTxns.length, sellTxns.length]);

  const pieChartData = useMemo(() => {
    const buy = buyTxns.length;
    const sell = sellTxns.length;
    if (buy === 0 && sell === 0) return [{ name: "구매", value: 1, color: "#22c55e" }, { name: "판매", value: 1, color: "#a855f7" }];
    return [
      { name: "구매", value: buy || 1, color: "#22c55e" },
      { name: "판매", value: sell || 1, color: "#a855f7" },
    ];
  }, [buyTxns.length, sellTxns.length]);

  const areaChartData = useMemo(() => {
    const days = 7;
    const now = new Date();
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (days - 1 - i));
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);
      const signups = users.filter((u) => {
        const t = new Date(u.createdAt);
        return t >= dayStart && t <= dayEnd;
      }).length;
      const txns = transactions.filter((t) => {
        const ct = new Date(t.createdAt);
        return ct >= dayStart && ct <= dayEnd;
      }).length;
      return { date: dateStr, 가입: signups, 거래: txns, total: signups + txns };
    });
  }, [users, transactions]);

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <button
                type="button"
                onClick={() => setExpandedSignup((v) => !v)}
                className="text-left rounded-xl overflow-hidden border-0 bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-xl hover:shadow-orange-500/20 hover:scale-[1.02] transition-all duration-200"
              >
                <Card className="border-0 bg-transparent shadow-none">
                  <CardContent className="p-5 relative">
                    <span className="absolute top-2 right-2 text-white/70 text-xs">클릭 시 목록</span>
                    <p className="text-3xl font-bold tabular-nums">{pendingCount}</p>
                    <p className="text-white/90 text-sm mt-1">가입 대기</p>
                  </CardContent>
                </Card>
              </button>
              <button
                type="button"
                onClick={() => setExpandedTxn((v) => !v)}
                className="text-left rounded-xl overflow-hidden border-0 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xl hover:shadow-amber-500/20 hover:scale-[1.02] transition-all duration-200"
              >
                <Card className="border-0 bg-transparent shadow-none">
                  <CardContent className="p-5 relative">
                    <span className="absolute top-2 right-2 text-white/70 text-xs">클릭 시 목록</span>
                    <p className="text-3xl font-bold tabular-nums">{pendingTxns.length}</p>
                    <p className="text-white/90 text-sm mt-1">거래 대기</p>
                  </CardContent>
                </Card>
              </button>
              <Card className="overflow-hidden border-0 bg-gradient-to-br from-red-500 to-orange-600 text-white shadow-xl rounded-xl">
                <CardContent className="p-5">
                  <p className="text-3xl font-bold tabular-nums">{approvedCount}</p>
                  <p className="text-white/90 text-sm mt-1">승인 회원</p>
                </CardContent>
              </Card>
              <Card className="overflow-hidden border-0 bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-xl rounded-xl">
                <CardContent className="p-5">
                  <p className="text-3xl font-bold tabular-nums">{buyTxns.length}</p>
                  <p className="text-white/90 text-sm mt-1">구매</p>
                </CardContent>
              </Card>
              <Card className="overflow-hidden border-0 bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-xl rounded-xl">
                <CardContent className="p-5">
                  <p className="text-3xl font-bold tabular-nums">{sellTxns.length}</p>
                  <p className="text-white/90 text-sm mt-1">판매</p>
                </CardContent>
              </Card>
            </div>

            {expandedSignup && (
              <Card className="bg-slate-900/90 border-slate-700 rounded-xl overflow-hidden">
                <CardHeader className="border-b border-slate-700 py-3">
                  <CardTitle className="text-base text-slate-100">가입 대기 목록</CardTitle>
                </CardHeader>
                <CardContent className="pt-3">
                  {loading ? (
                    <p className="text-slate-400 py-4 text-center text-sm">로딩 중...</p>
                  ) : pendingUsers.length === 0 ? (
                    <p className="text-slate-500 py-4 text-center text-sm">대기 중인 가입이 없습니다.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700 hover:bg-transparent">
                          <TableHead className="text-slate-300 font-medium">아이디</TableHead>
                          <TableHead className="text-slate-300 font-medium">은행</TableHead>
                          <TableHead className="text-slate-300 font-medium">예금주</TableHead>
                          <TableHead className="text-slate-300 font-medium">가입일시</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingUsers.map((u) => (
                          <TableRow key={u.id} className="border-slate-700 hover:bg-slate-800/50">
                            <TableCell className="text-slate-200 font-medium">{u.username}</TableCell>
                            <TableCell className="text-slate-400">{u.bankName}</TableCell>
                            <TableCell className="text-slate-400">{u.accountHolder}</TableCell>
                            <TableCell className="text-slate-500 text-sm">
                              {new Date(u.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}

            {expandedTxn && (
              <Card className="bg-slate-900/90 border-slate-700 rounded-xl overflow-hidden">
                <CardHeader className="border-b border-slate-700 py-3">
                  <CardTitle className="text-base text-slate-100">거래 대기 목록</CardTitle>
                </CardHeader>
                <CardContent className="pt-3">
                  {txnLoading ? (
                    <p className="text-slate-400 py-4 text-center text-sm">로딩 중...</p>
                  ) : pendingTxns.length === 0 ? (
                    <p className="text-slate-500 py-4 text-center text-sm">대기 중인 거래가 없습니다.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700 hover:bg-transparent">
                          <TableHead className="text-slate-300 font-medium">아이디</TableHead>
                          <TableHead className="text-slate-300 font-medium">유형</TableHead>
                          <TableHead className="text-slate-300 font-medium">금액</TableHead>
                          <TableHead className="text-slate-300 font-medium">신청일시</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingTxns.map((t) => (
                          <TableRow key={t.id} className="border-slate-700 hover:bg-slate-800/50">
                            <TableCell className="text-slate-200 font-medium">{t.user?.username ?? "-"}</TableCell>
                            <TableCell className="text-slate-400">{t.type === "BUY" ? "구매" : "판매"}</TableCell>
                            <TableCell className="text-slate-300 font-mono">{t.amount.toLocaleString("ko-KR")}원</TableCell>
                            <TableCell className="text-slate-500 text-sm">
                              {new Date(t.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-900/80 border-slate-700 rounded-xl overflow-hidden">
                <CardHeader className="border-b border-slate-700 py-3">
                  <CardTitle className="text-base text-slate-100">Statistics</CardTitle>
                  <CardDescription className="text-slate-400 text-xs">항목별 건수</CardDescription>
                </CardHeader>
                <CardContent className="pt-4 h-[220px] min-h-[220px]">
                  <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={180}>
                    <BarChart data={barChartData} layout="vertical" margin={{ left: 8, right: 8 }}>
                      <XAxis type="number" stroke="#64748b" fontSize={11} />
                      <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={70} />
                      <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569", borderRadius: "8px" }} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/80 border-slate-700 rounded-xl overflow-hidden">
                <CardHeader className="border-b border-slate-700 py-3">
                  <CardTitle className="text-base text-slate-100">Budget</CardTitle>
                  <CardDescription className="text-slate-400 text-xs">구매 / 판매 비율</CardDescription>
                </CardHeader>
                <CardContent className="pt-4 h-[220px] min-h-[220px]">
                  <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={180}>
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value }) => `${name} ${value}`}
                      >
                        {pieChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569", borderRadius: "8px" }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-slate-900/80 border-slate-700 rounded-xl overflow-hidden">
              <CardHeader className="border-b border-slate-700 py-3">
                <CardTitle className="text-base text-slate-100">Subscribers</CardTitle>
                <CardDescription className="text-slate-400 text-xs">최근 7일 가입·거래 추이</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 h-[200px] min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={160}>
                  <AreaChart data={areaChartData}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569", borderRadius: "8px" }} />
                    <Area type="monotone" dataKey="total" stroke="#f97316" fill="url(#areaGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {pendingCount > 0 && !loading && (
              <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-amber-200 text-sm">
                가입 요청 <strong>{pendingCount}건</strong> — 텔레그램에서 [승인]/[거절] 처리해 주세요.
              </div>
            )}
            {pendingTxns.length > 0 && !txnLoading && (
              <div className="rounded-xl border border-sky-500/50 bg-sky-500/10 px-4 py-3 text-sky-200 text-sm">
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
