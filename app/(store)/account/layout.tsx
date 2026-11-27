import type { Metadata } from "next";

// The pages below are client components, which can't export metadata.
export const metadata: Metadata = {
  title: "Your Account",
  robots: { index: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
