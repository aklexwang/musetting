/**
 * 거래 승인 시 호출할 외부 API.
 * 실제 연동 전까지 3초 후 성공을 반환하는 Mock 함수.
 */

export type ExternalTransactionPayload = {
  transactionId: string;
  userId: string;
  type: "BUY" | "SELL";
  amount: number;
};

export type ExternalTransactionResult = {
  success: boolean;
  message?: string;
};

/**
 * 거래 승인 시 외부 시스템에 전달하는 API.
 * 현재는 3초 뒤 성공을 반환하는 Mock.
 */
export async function executeExternalTransactionApi(
  payload: ExternalTransactionPayload
): Promise<ExternalTransactionResult> {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return { success: true, message: "Mock OK" };
}
