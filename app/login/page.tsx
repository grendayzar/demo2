import { LogoFull, LogoMark } from "@/components/brand/Logo";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="min-h-dvh grid lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden lg:flex flex-col justify-between p-12 bg-black text-white">
        <LogoFull className="h-9 w-auto text-brand" />
        <div>
          <p className="text-brand text-[12px] font-bold tracking-[.18em] uppercase mb-4">Promo Routes</p>
          <h1 className="text-4xl font-extrabold leading-tight max-w-[18ch]">
            The field app for <span className="text-brand">every stop</span>, every route, every placement.
          </h1>
          <p className="text-[#a3a29d] mt-5 max-w-[46ch] text-[15px] leading-relaxed">
            Plan routes, report on stops with photos, keep stock honest and sign up new businesses. Built for phones first.
          </p>
        </div>
        <p className="text-[12px] text-[#686867]">© {new Date().getFullYear()} Accident Professionals</p>
      </section>
      <section className="flex flex-col justify-center p-6 sm:p-12">
        <div className="w-full max-w-[400px] mx-auto">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <span className="grid place-items-center w-11 h-11 rounded-2xl bg-brand text-black"><LogoMark className="w-6 h-6" /></span>
            <div>
              <div className="font-extrabold text-[15px] leading-tight">Promo Routes</div>
              <div className="text-[11px] text-tt font-bold tracking-widest uppercase">Accident Professionals</div>
            </div>
          </div>
          <LoginForm next={next} />
        </div>
      </section>
    </main>
  );
}
