"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Kiosk" },
  { href: "/admin", label: "Staff" },
  { href: "/analytics", label: "Analytics" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-40 border-b border-[#E5D5C8] bg-[#FDF7EF]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-9 h-9 rounded-xl overflow-hidden bg-[#1C1007] flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
            <Image src="/images/Logo.png" alt="Vestia" fill className="object-contain p-1" />
          </div>
          <div className="leading-none">
            <p className="text-lg font-bold text-[#1C1007] tracking-tight">Vestia</p>
            <p className="text-[10px] uppercase tracking-[0.35em] text-[#8C6A4B]">Smart Fitting Room</p>
          </div>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1 bg-[#F0E0CC] p-1 rounded-2xl">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-[#4A3A2E] text-[#FDF7EF] shadow-md"
                    : "text-[#4A3A2E] hover:bg-white/70"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Right pill */}
        <div className="flex items-center gap-2 px-4 py-2 bg-[#F0E0CC] rounded-full text-xs font-semibold text-[#8C6A4B]">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          STORE-001
        </div>
      </div>
    </nav>
  );
}
