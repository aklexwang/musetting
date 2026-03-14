declare module "node-telegram-bot-api" {
  interface SendMessageOptions {
    reply_markup?: { inline_keyboard?: Array<Array<{ text: string; callback_data?: string; url?: string }>> };
  }
  export default class TelegramBot {
    constructor(token: string, options?: { polling?: boolean });
    sendMessage(chatId: number | string, text: string, options?: SendMessageOptions): Promise<unknown>;
    answerCallbackQuery(callbackQueryId: string, options?: { text?: string; url?: string }): Promise<unknown>;
    deleteMessage(chatId: number | string, messageId: number): Promise<unknown>;
    editMessageText(text: string, options?: { chat_id?: number; message_id?: number }): Promise<unknown>;
  }
}
