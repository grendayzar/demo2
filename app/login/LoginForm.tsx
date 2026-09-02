"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setStep("code");
    setInfo("We emailed you a 6-digit code. It expires in a few minutes.");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: "email" });
    if (error) { setBusy(false); setError(error.message); return; }
    router.replace(next && next.startsWith("/") ? next : "/dashboard");
    router.refresh();
  }

  return (
    <div>
      <h1 className="text-[26px] font-extrabold">{step === "email" ? "Sign in" : "Enter your code"}</h1>
      <p className="text-ts mt-1 mb-7 text-[14px]">
        {step === "email" ? "Use your work email. We'll send a one-time code, no password." : <>Sent to <b className="text-tp">{email}</b>.</>}
      </p>

      {step === "email" ? (
        <form onSubmit={sendCode}>
          <label className="field">
            <span>Email</span>
            <input type="email" required autoFocus autoComplete="email" inputMode="email" placeholder="you@accidentprofessionals.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="btn btn-pri btn-lg btn-block" disabled={busy || !email}>{busy ? "Sending…" : "Send code"}</button>
        </form>
      ) : (
        <form onSubmit={verify}>
          <label className="field">
            <span>6-digit code</span>
            <input ref={codeRef} required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" maxLength={8} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="tracking-[.4em] text-center text-[22px] font-bold" />
          </label>
          <button className="btn btn-pri btn-lg btn-block" disabled={busy || code.length < 6}>{busy ? "Checking…" : "Sign in"}</button>
          <div className="flex justify-between mt-4 text-[12.5px]">
            <button type="button" className="text-ts hover:text-tp font-semibold" onClick={() => { setStep("email"); setCode(""); setInfo(null); }}>Change email</button>
            <button type="button" className="text-ts hover:text-tp font-semibold" disabled={busy} onClick={(e) => sendCode(e as unknown as React.FormEvent)}>Resend code</button>
          </div>
        </form>
      )}

      {info && <p className="mt-4 text-[13px] text-ok font-semibold">{info}</p>}
      {error && <p className="mt-4 text-[13px] text-bad font-semibold" role="alert">{error}</p>}
      <p className="mt-8 text-[11.5px] text-tt leading-relaxed">
        New here? Sign in and your account is created in a pending state. A manager activates it and sets your territory.
      </p>
    </div>
  );
}
