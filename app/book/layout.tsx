import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stories - Raconteur",
  description: "Read beautiful stories with synchronized audio",
};

export default function BookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
