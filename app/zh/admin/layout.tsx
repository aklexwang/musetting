import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ADMIN",
};

export default function ZhAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
