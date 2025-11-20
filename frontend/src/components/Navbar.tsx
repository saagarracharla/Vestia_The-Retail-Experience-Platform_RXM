"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Kiosk" },
    { href: "/admin", label: "Requests" },
    { href: "/analytics", label: "Analytics" },
    { href: "/analytics/store", label: "Analytics - Store" },
  ];

  return (
    <nav className="border-b border-[#E4C8A3] bg-[#F4E3C4]">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#3D2614] text-white flex items-center justify-center font-semibold tracking-wide">
            V
          </div>
          <div>
            <p className="text-2xl font-serif text-[#3D2614] leading-none">
              Vestia
            </p>
            <p className="text-[11px] uppercase tracking-[0.4em] text-[#9A7551] mt-1">
              Experience
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 border ${
                  isActive
                    ? "bg-[#8A623C] border-[#8A623C] text-[#FFF4E2] shadow-sm"
                    : "border-transparent text-[#6B4B2E] hover:border-[#C89C6C] hover:bg-[#F9EBD3]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
