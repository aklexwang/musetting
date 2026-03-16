import { prisma } from "@/lib/prisma";

let cachedDefaultFranchiseId: string | null | undefined = undefined;

/** 현재 사이트의 기본 가맹점 ID (벳이스트 또는 첫 번째 가맹점). 회원가입 시 franchiseId 연결용. */
export async function getDefaultFranchiseId(): Promise<string | null> {
  if (cachedDefaultFranchiseId !== undefined) return cachedDefaultFranchiseId;
  const franchise = await prisma.franchise.findFirst({
    where: { name: "벳이스트" },
    select: { id: true },
  });
  if (franchise) {
    cachedDefaultFranchiseId = franchise.id;
    return franchise.id;
  }
  const first = await prisma.franchise.findFirst({ select: { id: true } });
  cachedDefaultFranchiseId = first?.id ?? null;
  return cachedDefaultFranchiseId;
}
