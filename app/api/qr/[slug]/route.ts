import { NextResponse } from "next/server";
import QRCode from "qrcode";

export const runtime = "nodejs";

/** QR code PNG for a store's lead form. /api/qr/<slug>?size=600&fmt=svg */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const size = Math.min(2000, Math.max(120, Number(url.searchParams.get("size") ?? 600)));
  const fmt = url.searchParams.get("fmt") === "svg" ? "svg" : "png";
  const base = process.env.NEXT_PUBLIC_APP_URL || `${url.protocol}//${url.host}`;
  const target = `${base}/l/${encodeURIComponent(slug)}?utm_source=qr&utm_medium=store&utm_campaign=${encodeURIComponent(slug)}`;
  if (fmt === "svg") {
    const svg = await QRCode.toString(target, { type: "svg", margin: 2, color: { dark: "#000000", light: "#ffffff" }, errorCorrectionLevel: "M" });
    return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" } });
  }
  const png = await QRCode.toBuffer(target, { type: "png", width: size, margin: 2, color: { dark: "#000000", light: "#ffffff" }, errorCorrectionLevel: "M" });
  return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400", "Content-Disposition": `inline; filename="qr-${slug}.png"` } });
}
