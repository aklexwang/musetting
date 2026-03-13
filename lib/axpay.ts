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
};

/**
 * AxPay 로그인 API (가이드 3.1)
 * POST https://manage.test999.vip/api/index/login
 * multipart/form-data, transaction_amount 필드에 만 원 단위 금액(Integer) 전송.
 * 응답 data.url, data.order_id 반환 → 호출 측에서 Transaction 에 저장.
 */
export async function login(params: AxPayLoginParams): Promise<AxPayLoginResult> {
  if (!AXPAY_TOKEN) {
    return { success: false, message: "AXPAY_TOKEN이 설정되지 않았습니다." };
  }

  const form = new FormData();
  form.append("token", AXPAY_TOKEN);
  form.append("user_id", params.username);
  form.append("type", params.type === "BUY" ? "1" : "2");
  form.append("money", String(params.amount));
  form.append("wallet_car_number", params.accountNumber);
  form.append("wallet_bank", params.bankName);
  form.append("wallet_name", params.accountHolder);
  form.append("transaction_amount", String(params.amount));

  const base = AXPAY_BASE_URL.replace(/\/$/, "");
  const loginUrl = `${base}/api/index/login`;
  const AXPAY_TIMEOUT_MS = 15000;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AXPAY_TIMEOUT_MS);
    const res = await fetch(loginUrl, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const rawText = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      // ignore
    }

    const code = json.code as number | undefined;
    const msg = (json.msg as string) ?? (json.message as string) ?? `HTTP ${res.status}`;

    if (!res.ok) {
      console.error("[AxPay] login HTTP 실패:", res.status, rawText?.slice(0, 500));
      return { success: false, message: msg };
    }

    if (code === 1) {
      console.warn("[AxPay] login code=1 실패:", msg, rawText?.slice(0, 300));
      return { success: false, message: msg };
    }

    const data = json.data as Record<string, unknown> | undefined;
    if (!data || typeof data !== "object") {
      console.warn("[AxPay] login code=0이지만 data 없음:", rawText?.slice(0, 300));
      return { success: false, message: msg || "응답 data 없음" };
    }

    const url = typeof data.url === "string" ? data.url : undefined;
    const order_id = data.order_id != null ? String(data.order_id) : undefined;

    if (!url) {
      console.warn("[AxPay] login 200이지만 data.url 없음. 응답:", rawText?.slice(0, 500));
      return {
        success: false,
        message: (json.msg as string) ?? "AxPay 응답에 url이 없습니다.",
        order_id,
      };
    }

    return {
      success: true,
      url,
      order_id,
      message: msg,
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
