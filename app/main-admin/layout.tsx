import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "본사 ADMIN",
};

export default function MainAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
