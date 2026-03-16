import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ADMIN",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
