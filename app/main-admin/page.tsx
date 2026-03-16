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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TabId = "현황" | "가맹점리스트";

interface FranchiseItem {
  id: string;
  name: string;
  contact: string;
  telegramCode: string;
  apiUrl: string;
  status: string;
  token: string;
  memberUrl: string;
  remark: string;
  createdAt: string;
  memberCount: number;
}

export default function MainAdminPage() {
  const [tab, setTab] = useState<TabId>("현황");
  const [franchises, setFranchises] = useState<FranchiseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<FranchiseItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const [addForm, setAddForm] = useState({
    name: "",
    password: "",
    contact: "",
    telegramCode: "",
    apiUrl: "",
    status: "ACTIVE",
    token: "",
    memberUrl: "",
    remark: "",
  });
  const [editForm, setEditForm] = useState({
    contact: "",
    telegramCode: "",
    apiUrl: "",
    status: "ACTIVE",
    newPassword: "",
    newPasswordConfirm: "",
    token: "",
    memberUrl: "",
    remark: "",
  });

  const fetchFranchises = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/main-admin/franchises");
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setFranchises(data);
      else setFranchises([]);
    } catch {
      setFranchises([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFranchises();
  }, []);

  const totalCount = franchises.length;
  const activeCount = franchises.filter((f) => f.status === "ACTIVE").length;
  const suspendedCount = franchises.filter((f) => f.status === "SUSPENDED").length;
  const newCount = franchises.filter((f) => {
    const created = new Date(f.createdAt).getTime();
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return created >= weekAgo;
  }).length;
  const maxBar = Math.max(totalCount, 1);

  const filteredList = franchises.filter((f) => {
    const matchSearch =
      !search.trim() ||
      f.name.toLowerCase().includes(search.trim().toLowerCase()) ||
      (f.contact || "").toLowerCase().includes(search.trim().toLowerCase());
    const matchStatus =
      !statusFilter ||
      (statusFilter === "정상" && f.status === "ACTIVE") ||
      (statusFilter === "정지" && f.status === "SUSPENDED");
    return matchSearch && matchStatus;
  });

  const handleAddSave = async () => {
    if (!addForm.name.trim()) {
      alert("가맹점명을 입력해 주세요.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/main-admin/franchises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addForm.name.trim(),
          password: addForm.password || undefined,
          contact: addForm.contact.trim() || undefined,
          telegramCode: addForm.telegramCode.trim() || undefined,
          apiUrl: addForm.apiUrl.trim() || undefined,
          status: addForm.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE",
          token: addForm.token.trim() || undefined,
          memberUrl: addForm.memberUrl.trim() || undefined,
          remark: addForm.remark.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "저장 실패");
        return;
      }
      setAddOpen(false);
      setAddForm({ name: "", password: "", contact: "", telegramCode: "", apiUrl: "", status: "ACTIVE", token: "", memberUrl: "", remark: "" });
      await fetchFranchises();
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row: FranchiseItem) => {
    setEditing(row);
    setEditForm({
      contact: row.contact || "",
      telegramCode: row.telegramCode || "",
      apiUrl: row.apiUrl || "",
      status: row.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE",
      newPassword: "",
      newPasswordConfirm: "",
      token: row.token || "",
      memberUrl: row.memberUrl || "",
      remark: row.remark || "",
    });
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/main-admin/franchises/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: editForm.contact.trim() || undefined,
          telegramCode: editForm.telegramCode.trim() || undefined,
          apiUrl: editForm.apiUrl.trim() || undefined,
          status: editForm.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE",
          password: editForm.newPassword || undefined,
          token: editForm.token.trim() || undefined,
          memberUrl: editForm.memberUrl.trim() || undefined,
          remark: editForm.remark.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data?.error || "저장 실패");
        return;
      }
      setEditOpen(false);
      setEditing(null);
      await fetchFranchises();
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, "0")}. ${String(d.getDate()).padStart(2, "0")}.`;
  };

  const runSeedDefaultFranchise = async () => {
    if (seeding) return;
    setSeeding(true);
    try {
      const res = await fetch("/api/main-admin/seed-default-franchise", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        alert(`연동 완료. 벳이스트 가맹점에 기존 회원 ${data.linkedUsers ?? 0}명 연결되었습니다.`);
        await fetchFranchises();
      } else {
        alert(data?.error || "연동 실패");
      }
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#020617] text-[#f1f5f9] antialiased flex">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-30%,rgba(56,189,248,0.06),transparent_50%)] pointer-events-none" aria-hidden />
      <aside className="fixed left-0 top-0 bottom-0 w-56 bg-slate-900/95 border-r border-slate-700/50 z-10 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-700/50">
          <h1 className="text-lg font-semibold text-white tracking-tight">Admin Dashboard</h1>
          <p className="mt-1 text-xs text-slate-400">무설치 ADMIN</p>
        </div>
        <nav className="flex-1 p-4 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setTab("현황")}
            className={`text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              tab === "현황" ? "bg-slate-600 text-white" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
            }`}
          >
            현황판
          </button>
          <button
            type="button"
            onClick={() => setTab("가맹점리스트")}
            className={`text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              tab === "가맹점리스트" ? "bg-slate-600 text-white" : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
            }`}
          >
            가맹점 리스트
          </button>
        </nav>
      </aside>

      <main className="flex-1 ml-56 relative z-[1] min-h-screen">
        <div className="max-w-[72rem] mx-auto px-6 py-8">
          <header className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-white">본사 어드민</h1>
            <p className="mt-1 text-sm text-slate-400">가맹점 현황 및 관리</p>
          </header>

          {tab === "현황" && (
            <section className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl p-6 text-center bg-gradient-to-br from-amber-500/90 to-orange-600/90 shadow-lg">
                  <p className="text-3xl font-bold text-white tabular-nums">{newCount}</p>
                  <p className="text-white text-sm font-medium mt-2">신규 가맹점</p>
                </div>
                <div className="rounded-2xl p-6 text-center bg-gradient-to-br from-sky-500/90 to-cyan-600/90 shadow-lg">
                  <p className="text-3xl font-bold text-white tabular-nums">{totalCount}</p>
                  <p className="text-white text-sm font-medium mt-2">총 가맹점</p>
                </div>
                <div className="rounded-2xl p-6 text-center bg-gradient-to-br from-green-600 to-green-500 shadow-lg">
                  <p className="text-3xl font-bold text-white tabular-nums">{activeCount}</p>
                  <p className="text-white text-sm font-medium mt-2">운영 중</p>
                </div>
                <div className="rounded-2xl p-6 text-center bg-gradient-to-br from-violet-600 to-violet-500 shadow-lg">
                  <p className="text-3xl font-bold text-white tabular-nums">{suspendedCount}</p>
                  <p className="text-white text-sm font-medium mt-2">이용정지</p>
                </div>
              </div>
              <Card className="rounded-2xl border border-slate-700/50 bg-slate-950/40 overflow-hidden">
                <CardHeader className="border-b border-slate-700/50 px-6 py-5 text-center">
                  <CardTitle className="text-slate-100 font-semibold text-base">가맹점별 주요 지표</CardTitle>
                  <CardDescription className="text-slate-400 text-sm mt-0.5">하부 가맹점 지표 비교</CardDescription>
                </CardHeader>
                <CardContent className="px-6 py-5 space-y-4">
                  <div className="flex items-center gap-4">
                    <span className="text-slate-400 text-sm w-28 shrink-0 text-center">신규 가맹점</span>
                    <div className="flex-1 h-3 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full bg-amber-500 min-w-[4px] transition-all duration-700" style={{ width: `${(newCount / maxBar) * 100}%` }} />
                    </div>
                    <span className="text-slate-200 font-mono text-sm w-8 text-center tabular-nums">{newCount}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-slate-400 text-sm w-28 shrink-0 text-center">총 가맹점</span>
                    <div className="flex-1 h-3 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full bg-sky-500 min-w-[4px] transition-all duration-700" style={{ width: `${(totalCount / maxBar) * 100}%` }} />
                    </div>
                    <span className="text-slate-200 font-mono text-sm w-8 text-center tabular-nums">{totalCount}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-slate-400 text-sm w-28 shrink-0 text-center">운영 중</span>
                    <div className="flex-1 h-3 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full bg-green-500 min-w-[4px] transition-all duration-700" style={{ width: `${totalCount ? (activeCount / totalCount) * 100 : 0}%` }} />
                    </div>
                    <span className="text-slate-200 font-mono text-sm w-8 text-center tabular-nums">{activeCount}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-slate-400 text-sm w-28 shrink-0 text-center">이용정지</span>
                    <div className="flex-1 h-3 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full bg-violet-500 min-w-[4px] transition-all duration-700" style={{ width: `${totalCount ? (suspendedCount / totalCount) * 100 : 0}%` }} />
                    </div>
                    <span className="text-slate-200 font-mono text-sm w-8 text-center tabular-nums">{suspendedCount}</span>
                  </div>
                </CardContent>
              </Card>
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-slate-200 flex flex-wrap items-center justify-between gap-3">
                <span>현재 가맹점 어드민(벳이스트) 데이터와 연동하려면 아래 버튼을 한 번만 실행하세요. (기존 회원을 벳이스트 가맹점으로 연결)</span>
                <Button onClick={runSeedDefaultFranchise} disabled={seeding} className="bg-amber-600 hover:bg-amber-700 text-white shrink-0">
                  {seeding ? "연동 중..." : "기존 회원 연동"}
                </Button>
              </div>
            </section>
          )}

          {tab === "가맹점리스트" && (
            <section>
              <Card className="rounded-2xl border border-slate-700/50 bg-slate-950/40 overflow-hidden">
                <CardHeader className="border-b border-slate-700/50 px-6 py-5 text-center">
                  <CardTitle className="text-slate-100 font-semibold text-base">가맹점 리스트</CardTitle>
                  <CardDescription className="text-slate-400 text-sm mt-0.5">등록된 하부 가맹점 목록</CardDescription>
                  <div className="mt-4">
                    <Input
                      placeholder="가맹점명·연락처로 검색"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="max-w-xs mx-auto bg-slate-800/60 border-slate-600 text-slate-200 text-center placeholder:text-slate-500"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700/50 hover:bg-transparent">
                          <TableHead className="text-right border-slate-700/50 p-2">
                            <Button onClick={() => setAddOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-sm h-9 px-4">
                              가맹점 추가
                            </Button>
                          </TableHead>
                          <TableHead colSpan={7} className="border-0 p-0" />
                        </TableRow>
                        <TableRow className="border-slate-700/50 hover:bg-transparent">
                          <TableHead className="text-slate-400 text-xs uppercase px-4 py-3 text-center">가맹점명</TableHead>
                          <TableHead className="text-slate-400 text-xs uppercase px-4 py-3 text-center">연락처</TableHead>
                          <TableHead className="text-slate-400 text-xs uppercase px-4 py-3 text-center">텔봇코드</TableHead>
                          <TableHead className="text-slate-400 text-xs uppercase px-4 py-3 text-center">로그인 API 주소</TableHead>
                          <TableHead className="text-slate-400 text-xs uppercase px-4 py-3 text-center">
                            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "")}>
                              <SelectTrigger className="w-[100px] h-8 border-slate-600 bg-slate-800 text-slate-300 text-xs">
                                <SelectValue placeholder="상태" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">전체</SelectItem>
                                <SelectItem value="정상">정상</SelectItem>
                                <SelectItem value="정지">정지</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableHead>
                          <TableHead className="text-slate-400 text-xs uppercase px-4 py-3 text-center">회원수</TableHead>
                          <TableHead className="text-slate-400 text-xs uppercase px-4 py-3 text-center">가입일</TableHead>
                          <TableHead className="text-slate-400 text-xs uppercase px-4 py-3 text-center">수정</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-slate-500 text-center py-12">로딩 중...</TableCell>
                          </TableRow>
                        ) : filteredList.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-slate-500 text-center py-12">등록된 가맹점이 없습니다.</TableCell>
                          </TableRow>
                        ) : (
                          filteredList.map((f) => (
                            <TableRow key={f.id} className="border-slate-700/40 hover:bg-slate-800/40">
                              <TableCell className="text-slate-200 font-medium px-4 py-3 text-center">{f.name}</TableCell>
                              <TableCell className="text-slate-400 tabular-nums px-4 py-3 text-center">{f.contact || "-"}</TableCell>
                              <TableCell className="text-slate-400 tabular-nums px-4 py-3 text-center">{f.telegramCode || "-"}</TableCell>
                              <TableCell className="text-slate-400 tabular-nums px-4 py-3 text-center max-w-[180px] truncate">{f.apiUrl || "-"}</TableCell>
                              <TableCell className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium ${f.status === "ACTIVE" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                                  {f.status === "ACTIVE" ? "정상" : "정지"}
                                </span>
                              </TableCell>
                              <TableCell className="text-slate-400 tabular-nums px-4 py-3 text-center">{f.memberCount}</TableCell>
                              <TableCell className="text-slate-400 tabular-nums px-4 py-3 text-center">{formatDate(f.createdAt)}</TableCell>
                              <TableCell className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {f.apiUrl ? (
                                    <a href={f.apiUrl.replace(/\/$/, "") + "/admin"} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 hover:underline mr-1">어드민</a>
                                  ) : null}
                                  <Button variant="outline" size="sm" className="border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-slate-200 h-7 text-xs" onClick={() => openEdit(f)}>
                                    수정
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}
        </div>
      </main>

      {/* 가맹점 추가 모달 */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-[420px] rounded-xl border-slate-700 bg-slate-900 text-slate-100 p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-4 border-b border-slate-700">
            <DialogTitle className="text-white font-semibold">가맹점 추가</DialogTitle>
          </DialogHeader>
          <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block text-center">가맹점명</label>
              <Input className="bg-slate-800 border-slate-600 text-center" placeholder="가맹점명 입력" value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block text-center">비밀번호</label>
              <Input type="password" className="bg-slate-800 border-slate-600 text-center" placeholder="비밀번호 입력" value={addForm.password} onChange={(e) => setAddForm((p) => ({ ...p, password: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block text-center">연락처</label>
              <Input className="bg-slate-800 border-slate-600 text-center" placeholder="@아이디 형식" value={addForm.contact} onChange={(e) => setAddForm((p) => ({ ...p, contact: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block text-center">텔봇코드</label>
              <Input className="bg-slate-800 border-slate-600 text-center" placeholder="텔봇코드 입력" value={addForm.telegramCode} onChange={(e) => setAddForm((p) => ({ ...p, telegramCode: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block text-center">로그인 API 주소</label>
              <Input className="bg-slate-800 border-slate-600 text-center" placeholder="API 주소 입력" value={addForm.apiUrl} onChange={(e) => setAddForm((p) => ({ ...p, apiUrl: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block text-center">상태</label>
              <Select value={addForm.status} onValueChange={(v) => setAddForm((p) => ({ ...p, status: v ?? "ACTIVE" }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-center w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">정상</SelectItem>
                  <SelectItem value="SUSPENDED">정지</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block text-center">토큰</label>
              <Input className="bg-slate-800 border-slate-600 text-center" placeholder="Token 입력" value={addForm.token} onChange={(e) => setAddForm((p) => ({ ...p, token: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block text-center">회원 URL</label>
              <Input className="bg-slate-800 border-slate-600 text-center" placeholder="회원 URL 입력" value={addForm.memberUrl} onChange={(e) => setAddForm((p) => ({ ...p, memberUrl: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block text-center">비고</label>
              <textarea className="w-full min-h-[80px] px-3 py-2 rounded-md bg-slate-800 border border-slate-600 text-slate-200 text-sm placeholder:text-slate-500 resize-y" placeholder="비고 입력" value={addForm.remark} onChange={(e) => setAddForm((p) => ({ ...p, remark: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 px-5 py-4 border-t border-slate-700 bg-slate-800/40">
            <Button variant="outline" className="flex-1 border-slate-600 text-slate-300" onClick={() => setAddOpen(false)}>취소</Button>
            <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleAddSave} disabled={saving}>{saving ? "저장 중..." : "저장"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 가맹점 설정 모달 */}
      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) setEditing(null); setEditOpen(open); }}>
        <DialogContent className="max-w-[420px] rounded-xl border-slate-700 bg-slate-900 text-slate-100 p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-4 border-b border-slate-700">
            <DialogTitle className="text-white font-semibold">가맹점 설정</DialogTitle>
          </DialogHeader>
          <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block text-center">가맹점명</label>
              <Input className="bg-slate-800 border-slate-600 text-center opacity-80 cursor-not-allowed" readOnly disabled value={editing?.name ?? ""} />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block text-center">연락처</label>
              <Input className="bg-slate-800 border-slate-600 text-center" placeholder="@아이디 형식" value={editForm.contact} onChange={(e) => setEditForm((p) => ({ ...p, contact: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block text-center">텔봇코드</label>
              <Input className="bg-slate-800 border-slate-600 text-center" value={editForm.telegramCode} onChange={(e) => setEditForm((p) => ({ ...p, telegramCode: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block text-center">로그인 API 주소</label>
              <Input className="bg-slate-800 border-slate-600 text-center" value={editForm.apiUrl} onChange={(e) => setEditForm((p) => ({ ...p, apiUrl: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block text-center">상태</label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm((p) => ({ ...p, status: v ?? "ACTIVE" }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-center w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">정상</SelectItem>
                  <SelectItem value="SUSPENDED">정지</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="pt-3 border-t border-slate-700">
              <p className="text-xs text-slate-400 mb-3 text-center">비밀번호 변경</p>
              <div className="space-y-2 mb-2">
                <Input type="password" className="bg-slate-800 border-slate-600 text-center" placeholder="새 비밀번호" value={editForm.newPassword} onChange={(e) => setEditForm((p) => ({ ...p, newPassword: e.target.value }))} />
                <Input type="password" className="bg-slate-800 border-slate-600 text-center" placeholder="비밀번호 확인" value={editForm.newPasswordConfirm} onChange={(e) => setEditForm((p) => ({ ...p, newPasswordConfirm: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block text-center">Token</label>
              <Input className="bg-slate-800 border-slate-600 text-center" value={editForm.token} onChange={(e) => setEditForm((p) => ({ ...p, token: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block text-center">회원 URL</label>
              <Input className="bg-slate-800 border-slate-600 text-center" value={editForm.memberUrl} onChange={(e) => setEditForm((p) => ({ ...p, memberUrl: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-400 block text-center">비고</label>
              <textarea className="w-full min-h-[80px] px-3 py-2 rounded-md bg-slate-800 border border-slate-600 text-slate-200 text-sm resize-y" value={editForm.remark} onChange={(e) => setEditForm((p) => ({ ...p, remark: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 px-5 py-4 border-t border-slate-700 bg-slate-800/40">
            <Button variant="outline" className="flex-1 border-slate-600 text-slate-300" onClick={() => setEditOpen(false)}>취소</Button>
            <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleEditSave} disabled={saving}>{saving ? "저장 중..." : "저장"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
