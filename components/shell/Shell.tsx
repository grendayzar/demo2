"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogoFull, LogoMark } from "@/components/brand/Logo";
import { Avatar } from "@/components/ui";
import type { Profile } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/types";
import { navFor } from "./nav";
import { Icon, type IconName } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";

const MOBILE_TABS = ["/dashboard", "/routes", "/businesses", "/inventory"];

export function Shell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const pathname = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (v: boolean) => setOpenAt(v ? pathname : null);
  const items = navFor(profile.role);
  const groups = Array.from(new Set(items.map((i) => i.group)));
  const isOn = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const rail = (
    <nav className="flex flex-col h-full">
      <div className="px-2 pt-1 pb-3 hidden lg:block">
        <Link href="/dashboard" className="block text-tp"><LogoFull className="h-6 w-auto" /></Link>
      </div>
      <div className="flex-1 overflow-y-auto">
        {groups.map((g) => (
          <div key={g}>
            <div className="navgrp">{g}</div>
            {items.filter((i) => i.group === g).map((i) => (
              <Link key={i.href} href={i.href} className={`navitem ${isOn(i.href) ? "on" : ""}`}>
                <Icon name={i.icon as IconName} size={17} />
                <span>{i.label}</span>
              </Link>
            ))}
          </div>
        ))}
        <div className="navgrp">Display</div>
        <ThemeToggle withLabel />
      </div>
      <div className="border-t border-line pt-3 mt-3 px-1">
        <Link href="/settings" className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-card2">
          <Avatar name={profile.full_name} src={profile.photo_url} size={30} brand />
          <div className="min-w-0">
            <div className="text-[13px] font-bold truncate">{profile.full_name}</div>
            <div className="text-[11px] text-tt truncate">{ROLE_LABEL[profile.role]}{profile.territory ? ` · ${profile.territory.code}` : ""}</div>
          </div>
        </Link>
        <form action="/auth/signout" method="post">
          <button className="navitem mt-1" type="submit"><Icon name="logout" size={16} /><span>Sign out</span></button>
        </form>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      {/* Desktop rail */}
      <aside className="hidden lg:block sticky top-0 h-dvh bg-card border-r border-line p-3 overflow-hidden">{rail}</aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-40 bg-black text-white flex items-center gap-3 px-3 h-14 border-b-2 border-brand" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <Link href="/dashboard" className="flex items-center gap-2 text-brand">
          <LogoMark className="w-7 h-7" />
          <span className="font-extrabold text-[14px] text-white tracking-tight">Promo Routes</span>
        </Link>
        <div className="flex-1" />
        <ThemeToggle />
        <button className="btn btn-ghost btn-sm text-white" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" size={20} /></button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-[290px] max-w-[85vw] bg-card border-l border-line p-3 pt-4 overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-2 mb-2">
              <LogoFull className="h-5 w-auto text-tp" />
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="Close menu"><Icon name="x" /></button>
            </div>
            {rail}
          </div>
        </div>
      )}

      <div className="min-w-0">
        <main className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7 pb-24 lg:pb-10 max-w-[1280px] mx-auto">{children}</main>
      </div>

      {/* Mobile bottom tabs */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t border-line grid grid-cols-5" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {items.filter((i) => MOBILE_TABS.includes(i.href)).map((i) => (
          <Link key={i.href} href={i.href} className={`flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-bold ${isOn(i.href) ? "text-tp" : "text-tt"}`}>
            <span className={`grid place-items-center w-9 h-6 rounded-full ${isOn(i.href) ? "bg-brand text-black" : ""}`}><Icon name={i.icon as IconName} size={18} /></span>
            {i.label}
          </Link>
        ))}
        <button onClick={() => setOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-bold text-tt">
          <span className="grid place-items-center w-9 h-6"><Icon name="more" size={18} /></span>More
        </button>
      </nav>
    </div>
  );
}
