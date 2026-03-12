import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "auth";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET must be set in .env (min 16 characters)");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export type Session = { userId: string; username: string };

export function createSessionCookie(session: Session): string {
  const payload = JSON.stringify({
    ...session,
    exp: Date.now() + MAX_AGE * 1000,
  });
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  const sig = sign(encoded);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encoded}.${sig}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`;
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const [encoded, sig] = raw.split(".");
  if (!encoded || !sig) return null;
  try {
    const expectedSig = sign(encoded);
    if (expectedSig.length !== sig.length || !timingSafeEqual(Buffer.from(expectedSig, "utf8"), Buffer.from(sig, "utf8"))) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (payload.exp && Date.now() > payload.exp) return null;
    return { userId: payload.userId, username: payload.username };
  } catch {
    return null;
  }
}

export function getSessionFromCookieHeader(cookieHeader: string | null): Session | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const raw = match?.[1];
  if (!raw) return null;
  const [encoded, sig] = raw.split(".");
  if (!encoded || !sig) return null;
  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) return null;
    const expectedSig = createHmac("sha256", secret).update(encoded).digest("base64url");
    if (expectedSig.length !== sig.length || !timingSafeEqual(Buffer.from(expectedSig, "utf8"), Buffer.from(sig, "utf8"))) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (payload.exp && Date.now() > payload.exp) return null;
    return { userId: payload.userId, username: payload.username };
  } catch {
    return null;
  }
}
