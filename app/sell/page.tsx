"use client";

import Link from "next/link";

export default function SellPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6 p-4">
      <h1 className="text-slate-50 text-xl font-semibold">판매</h1>
      <p className="text-slate-400 text-sm">판매 기능은 준비 중입니다.</p>
      <Link
        href="/"
        className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-600 bg-transparent px-4 text-sm font-medium text-slate-200 hover:bg-slate-800"
      >
        홈으로
      </Link>
    </div>
  );
}
