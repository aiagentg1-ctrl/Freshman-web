"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to TMA (Telegram Mini App)
    router.push("/tma");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">F</div>
        <h1 className="text-2xl font-bold text-[#1D70F5] mb-2">Fresho</h1>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}