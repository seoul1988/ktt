import type { ReactNode } from "react";

type SafePageProps = {
  children: ReactNode;
  className?: string;
};

export default function SafePage({
  children,
  className = "",
}: SafePageProps) {
  return (
    <main className={`app-page safe-screen ${className}`}>
      {children}
    </main>
  );
}