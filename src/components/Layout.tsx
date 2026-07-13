import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

export function Layout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] w-full bg-slate-50 font-sans overflow-hidden relative">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="flex flex-col flex-1 h-full min-w-0">
        <TopNav onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto no-scrollbar scroll-smooth pb-12">
          {children}
        </main>
      </div>
    </div>
  );
}
