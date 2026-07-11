import { Suspense } from "react";
import LoginForm from "../components/LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#F8F3EC]">
          <p className="font-bold text-[#172033]">
            로그인 페이지 불러오는 중...
          </p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}