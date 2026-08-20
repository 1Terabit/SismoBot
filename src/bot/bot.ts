import { Bot, GrammyError, HttpError } from "grammy";
import { logger } from "../utils/logger";

/**
 * Create and configure the Telegram bot instance.
 */
export function createBot(): Bot {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN is not set. Get one from @BotFather on Telegram."
    );
  }

  const bot = new Bot(token);

  // Global error handler
  bot.catch((err) => {
    const ctx = err.ctx;
    const e = err.error;

    logger.error("Bot", `Error handling update ${ctx.update.update_id}:`);

    if (e instanceof GrammyError) {
      logger.error("Bot", `Telegram API error: ${e.description}`);
    } else if (e instanceof HttpError) {
      logger.error("Bot", `Network error: ${e.message}`);
    } else {
      logger.error("Bot", `Unknown error`, e);
    }
  });

  return bot;
}
