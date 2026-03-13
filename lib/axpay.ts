/**
 * AxPay REST API 연동 (가이드 Rev 12.10 기준)
 * 3.1 로그인: token·user_id·type(1/2)·money·wallet_*·transaction_amount (form), 응답 code 0 + data.url/data.order_id
 * 3.3 order_query: token·order_id (form), 응답 data 배열 내 status (1=성공, 2=실패)
 * 3.4 order_callback: token·order_id (form), status 파라미터 없음
 */

const AXPAY_BASE_URL = process.env.AXPAY_BASE_URL ?? "https://manage.test999.vip";
const AXPAY_TOKEN = process.env.AXPAY_TOKEN?.trim();

/** 가이드 3.1 로그인 API 요청 파라미터 */
export type AxPayLoginParams = {
  username: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  /** 신청 금액 (원), 만 원 단위만 허용 */
  amount: number;
  type: "BUY" | "SELL";
};

/** 가이드 3.1 로그인 API 성공 응답: data.url, data.order_id */
export type AxPayLoginResult = {
  success: boolean;
  url?: string;
  order_id?: string;
  message?: string;
  /** 실패 시 디버깅용: AxPay 원본 응답 일부(텔레그램 등에 노출) */
  rawResponse?: string;
};

/**
 * AxPay 로그인 API (가이드 3.1)
 * POST https://manage.test999.vip/api/index/login
 * multipart/form-data, transaction_amount 필드에 만 원 단위 금액(Integer) 전송.
 * 응답 data.url, data.order_id 반환 → 호출 측에서 Transaction 에 저장.
 */
/** 가이드 3.1 필수 필드 8개: token, user_id, type, money, wallet_car_number, wallet_bank, wallet_name, transaction_amount (모두 String) */
export async function login(params: AxPayLoginParams): Promise<AxPayLoginResult> {
  if (!AXPAY_TOKEN) {
    return { success: false, message: "AXPAY_TOKEN이 설정되지 않았습니다." };
  }

  const user_id = String(params.username ?? "").trim();
  const type = params.type === "BUY" ? "1" : "2";
  const amountStr = params.amount != null && !Number.isNaN(Number(params.amount)) ? String(params.amount) : "";
  const money = amountStr;
  const wallet_car_number = String(params.accountNumber ?? "").trim();
  const wallet_bank = String(params.bankName ?? "").trim();
  const wallet_name = String(params.accountHolder ?? "").trim();
  const transaction_amount = amountStr;

  const missing: string[] = [];
  if (!user_id) missing.push("user_id");
  if (!money) missing.push("money");
  if (!wallet_car_number) missing.push("wallet_car_number");
  if (!wallet_bank) missing.push("wallet_bank");
  if (!wallet_name) missing.push("wallet_name");
  if (!transaction_amount) missing.push("transaction_amount");
  if (missing.length > 0) {
    return { success: false, message: `필수 필드가 비어 있거나 올바르지 않습니다: ${missing.join(", ")}` };
  }

  const base = AXPAY_BASE_URL.replace(/\/$/, "");
  const loginUrl = `${base}/api/index/login`;
  const AXPAY_TIMEOUT_MS = 15000;
  const useUrlEncoded = process.env.AXPAY_USE_URLENCODED === "true" || process.env.AXPAY_USE_URLENCODED === "1";

  let body: FormData | URLSearchParams;
  if (useUrlEncoded) {
    body = new URLSearchParams();
    body.set("token", String(AXPAY_TOKEN));
    body.set("user_id", user_id);
    body.set("type", type);
    body.set("money", money);
    body.set("wallet_car_number", wallet_car_number);
    body.set("wallet_bank", wallet_bank);
    body.set("wallet_name", wallet_name);
    body.set("transaction_amount", transaction_amount);
    console.log("[AxPay] login Content-Type: application/x-www-form-urlencoded (AXPAY_USE_URLENCODED)");
  } else {
    const form = new FormData();
    form.append("token", String(AXPAY_TOKEN));
    form.append("user_id", user_id);
    form.append("type", type);
    form.append("money", money);
    form.append("wallet_car_number", wallet_car_number);
    form.append("wallet_bank", wallet_bank);
    form.append("wallet_name", wallet_name);
    form.append("transaction_amount", transaction_amount);
    body = form;
  }

  const formLog: Record<string, string> = {
    token: "[SET]",
    user_id,
    type,
    money,
    wallet_car_number,
    wallet_bank,
    wallet_name,
    transaction_amount,
  };
  console.log("[AxPay] login 요청 FormData:", formLog);

  const curlParts = [
    "curl -X POST",
    `'${loginUrl}'`,
    `-F 'token=YOUR_TOKEN'`,
    `-F 'user_id=${user_id.replace(/'/g, "'\\''")}'`,
    `-F 'type=${type}'`,
    `-F 'money=${money}'`,
    `-F 'wallet_car_number=${wallet_car_number.replace(/'/g, "'\\''")}'`,
    `-F 'wallet_bank=${wallet_bank.replace(/'/g, "'\\''")}'`,
    `-F 'wallet_name=${wallet_name.replace(/'/g, "'\\''")}'`,
    `-F 'transaction_amount=${transaction_amount}'`,
  ];
  console.log("[AxPay] curl로 재현 (token만 채워서 실행):", curlParts.join(" \\\n  "));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AXPAY_TIMEOUT_MS);
    const res = await fetch(loginUrl, {
      method: "POST",
      body,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const rawText = await res.text();
    const isServerErrorHtml =
      typeof rawText === "string" &&
      (rawText.includes("Fatal error") ||
        rawText.includes("think\\exception") ||
        rawText.includes("Stack trace") ||
        rawText.trimStart().startsWith("<"));
    if (isServerErrorHtml) {
      console.warn("[AxPay] login 응답이 HTML/서버오류:", rawText?.slice(0, 300));
      return {
        success: false,
        message: "AxPay 서버 오류가 발생했습니다. AxPay 측 점검 후 재시도해 주세요.",
        rawResponse: "서버응답: PHP Fatal error (AxPay 측 오류)",
      };
    }

    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      // ignore
    }

    const code = json.code as number | undefined;
    const apiMsg = (json.msg as string) ?? (json.message as string) ?? "";

    if (!res.ok) {
      console.error("[AxPay] login HTTP 실패:", res.status, rawText?.slice(0, 500));
      return { success: false, message: apiMsg || `HTTP ${res.status}` };
    }

    if (code === 1) {
      console.warn("[AxPay] login code=1 실패:", apiMsg, rawText?.slice(0, 300));
      return { success: false, message: apiMsg || "AxPay 서버 거부 (code=1)" };
    }

    const getStr = (o: Record<string, unknown>, ...keys: string[]): string | undefined => {
      if (!o || typeof o !== "object") return undefined;
      for (const k of keys) {
        const v = o[k];
        if (typeof v === "string" && v.length > 0) return v;
        if (typeof v === "number") return String(v);
      }
      return undefined;
    };

    const urlKeys = ["url", "redirect_url", "payment_url", "pay_url", "link", "redirectUrl", "paymentUrl"];
    const data = json.data;
    const result = json.result as Record<string, unknown> | undefined;
    const root = json as Record<string, unknown>;

    const fromObj = (o: Record<string, unknown> | undefined) => o && getStr(o, ...urlKeys);
    const url =
      fromObj(data as Record<string, unknown> | undefined) ??
      (Array.isArray(data) && data[0] && typeof data[0] === "object" ? getStr(data[0] as Record<string, unknown>, ...urlKeys) : undefined) ??
      fromObj(result) ??
      (result?.data && typeof result.data === "object" ? getStr(result.data as Record<string, unknown>, ...urlKeys) : undefined) ??
      getStr(root, ...urlKeys);

    const orderIdFrom = (o: unknown) => {
      if (o == null || typeof o !== "object") return undefined;
      const r = o as Record<string, unknown>;
      if (r.order_id != null) return String(r.order_id);
      return getStr(r, "order_id", "orderId");
    };
    const order_id =
      orderIdFrom(data) ??
      (Array.isArray(data) && data[0] ? orderIdFrom(data[0]) : undefined) ??
      orderIdFrom(result) ??
      orderIdFrom(root);

    if (!url) {
      const snippet = rawText?.slice(0, 400) ?? "";
      console.warn("[AxPay] login 200, url 없음. 전체 응답:", rawText?.slice(0, 800));
      return {
        success: false,
        message: apiMsg || "AxPay 응답에 url이 없습니다.",
        order_id,
        rawResponse: snippet ? `응답일부: ${snippet}` : undefined,
      };
    }

    return {
      success: true,
      url,
      order_id,
      message: apiMsg,
    };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    const message = isAbort
      ? "AxPay 요청 시간 초과(15초). 서버 상태를 확인하세요."
      : err instanceof Error
        ? err.message
        : String(err);
    console.error("AxPay login error:", err);
    return { success: false, message };
  }
}

/** 가이드 3.3 order_query 응답: status 1=성공, 2=실패 */
export type OrderQueryResult = {
  success: boolean;
  status?: number;
  message?: string;
};

/**
 * 가이드 3.3 order_query API
 * 거래 상태 조회. status 1(성공) 또는 2(실패) 시 order_callback 호출 후 모니터링 종료.
 */
export async function orderQuery(orderId: string): Promise<OrderQueryResult> {
  if (!AXPAY_TOKEN) {
    return { success: false, message: "AXPAY_TOKEN이 설정되지 않았습니다." };
  }

  const base = AXPAY_BASE_URL.replace(/\/$/, "");
  const url = `${base}/api/index/order_query`;

  try {
    const form = new FormData();
    form.append("token", AXPAY_TOKEN);
    form.append("order_id", orderId);

    const res = await fetch(url, {
      method: "POST",
      body: form,
    });

    const json = (await res.json().catch(() => ({}))) as {
      code?: number;
      msg?: string;
      data?: Array<{ status?: number }> | { status?: number };
    };

    if (!res.ok) {
      return { success: false, message: (json as { msg?: string }).msg ?? `HTTP ${res.status}` };
    }
    if (json.code === 1) {
      return { success: false, message: (json.msg as string) ?? "Record does not exist" };
    }

    const data = json.data;
    const first = Array.isArray(data) ? data[0] : data;
    const status = first && typeof first.status === "number" ? first.status : undefined;

    return { success: true, status, message: json.msg };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("AxPay order_query error:", err);
    return { success: false, message };
  }
}

/**
 * 가이드 3.4 주문 핸들링 API (api/index/order_callback)
 * 거래 상태가 1(성공) 또는 2(실패)로 확정된 뒤 AxPay 측에 최종 완료 신호 전송.
 */
export async function orderCallback(orderId: string): Promise<{ success: boolean; message?: string }> {
  if (!AXPAY_TOKEN) {
    return { success: false, message: "AXPAY_TOKEN이 설정되지 않았습니다." };
  }

  const base = AXPAY_BASE_URL.replace(/\/$/, "");
  const url = `${base}/api/index/order_callback`;

  try {
    const form = new FormData();
    form.append("token", AXPAY_TOKEN);
    form.append("order_id", orderId);

    const res = await fetch(url, {
      method: "POST",
      body: form,
    });

    const json = (await res.json().catch(() => ({}))) as { code?: number; msg?: string };

    if (!res.ok) {
      return { success: false, message: json?.msg ?? `HTTP ${res.status}` };
    }
    if (json.code === 1) {
      return { success: false, message: json.msg ?? "order_callback 실패" };
    }
    return { success: true, message: json.msg };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("AxPay order_callback error:", err);
    return { success: false, message };
  }
}
