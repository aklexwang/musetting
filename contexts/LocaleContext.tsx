"use client";

import { createContext, useContext, useMemo } from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/translations";

const LocaleContext = createContext<Locale>("ko");

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const locale = useMemo<Locale>(() => (pathname?.startsWith("/zh") ? "zh" : "ko"), [pathname]);
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}
