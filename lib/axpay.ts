/**
 * AxPay API 연동 (가이드 3.1 로그인, 3.3 order_query, 3.4 order_callback)
 * 3.1: multipart/form-data, transaction_amount(만 원 단위), 응답 data.url / data.order_id
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
  form.append("user_id", params.username);
  form.append("bank_name", params.bankName);
  form.append("account_number", params.accountNumber);
  form.append("account_holder", params.accountHolder);
  form.append("transaction_amount", String(params.amount));
  form.append("type", params.type);

  const base = AXPAY_BASE_URL.replace(/\/$/, "");
  const loginUrl = `${base}/api/index/login`;

  try {
    const res = await fetch(loginUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AXPAY_TOKEN}`,
      },
      body: form,
    });

    const json = (await res.json().catch(() => ({}))) as {
      data?: { url?: string; order_id?: string };
      url?: string;
      order_id?: string;
      message?: string;
      code?: number;
    };

    if (!res.ok) {
      return {
        success: false,
        message: json?.message ?? `HTTP ${res.status}`,
      };
    }

    const data = json?.data ?? json;
    const url = typeof data?.url === "string" ? data.url : undefined;
    const order_id =
      data?.order_id != null ? String(data.order_id) : undefined;

    return {
      success: true,
      url,
      order_id,
      message: json?.message,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
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
    form.append("order_id", orderId);

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${AXPAY_TOKEN}` },
      body: form,
    });

    const json = (await res.json().catch(() => ({}))) as {
      data?: { status?: number };
      status?: number;
      message?: string;
    };

    if (!res.ok) {
      return { success: false, message: json?.message ?? `HTTP ${res.status}` };
    }

    const data = json?.data ?? json;
    const status =
      typeof data?.status === "number" ? data.status : json?.status;

    return { success: true, status, message: json?.message };
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
export async function orderCallback(
  orderId: string,
  status: number
): Promise<{ success: boolean; message?: string }> {
  if (!AXPAY_TOKEN) {
    return { success: false, message: "AXPAY_TOKEN이 설정되지 않았습니다." };
  }

  const base = AXPAY_BASE_URL.replace(/\/$/, "");
  const url = `${base}/api/index/order_callback`;

  try {
    const form = new FormData();
    form.append("order_id", orderId);
    form.append("status", String(status));

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${AXPAY_TOKEN}` },
      body: form,
    });

    const json = (await res.json().catch(() => ({}))) as { message?: string };

    if (!res.ok) {
      return { success: false, message: json?.message ?? `HTTP ${res.status}` };
    }
    return { success: true, message: json?.message };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("AxPay order_callback error:", err);
    return { success: false, message };
  }
}
