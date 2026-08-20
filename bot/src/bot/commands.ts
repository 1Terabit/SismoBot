import { Bot, Context, InlineKeyboard, CommandContext } from "grammy";
import {
  upsertUser,
  getUser,
  setUserMagnitude,
  setUserRegions,
  setUserLocation,
  setUserSilentHours,
  deactivateUser,
  getUserCount,
  getEventCount,
  getLatestEvent,
  addEventReport,
  getDb
} from "../db/database";
import { REGIONS, ALL_REGION_KEYS, MAGNITUDE_OPTIONS, getSeverityEmoji } from "../config";
import { haversineDistance, formatDistance } from "../utils/geo";
import { logger } from "../utils/logger";
import { getLastReport, getLastPdfPath } from "../analysis/workflow";
import { InputFile } from "grammy";

const startTime = Date.now();

/**
 * Register all bot commands.
 */
export function registerCommands(bot: Bot): void {
  bot.command("start", (ctx) => handleStart(ctx));
  bot.command("config", (ctx) => handleConfig(ctx));
  bot.command("magnitud", (ctx) => handleMagnitudeMenu(ctx));
  bot.command("regiones", (ctx) => handleRegionsMenu(ctx));
  bot.command("ubicacion", (ctx) => handleLocationPrompt(ctx));
  bot.command("silencio", (ctx) => handleSilentHours(ctx));
  bot.command("ultimo", (ctx) => handleLastEvent(ctx));
  bot.command("estado", (ctx) => handleStatus(ctx));
  bot.command("riesgo", (ctx) => handleRisk(ctx));
  bot.command("reporte", (ctx) => handleReporte(ctx));
  bot.command("parar", (ctx) => handleStop(ctx));
  bot.command("ayuda", (ctx) => handleHelp(ctx));
  bot.command("ping", (ctx) => handlePing(ctx));

  // Callback query handlers for inline keyboards
  bot.on("callback_query:data", (ctx) => handleCallbackQuery(ctx));

  // Location message handler
  bot.on("message:location", (ctx) => handleLocationMessage(ctx));

  // Set bot commands for the menu
  bot.api.setMyCommands([
    { command: "start", description: "Iniciar y registrarse" },
    { command: "config", description: "Ver tu configuración actual" },
    { command: "magnitud", description: "Configurar magnitud mínima" },
    { command: "regiones", description: "Seleccionar regiones a monitorear" },
    { command: "ubicacion", description: "Enviar tu ubicación" },
    { command: "silencio", description: "Configurar horario silencioso" },
    { command: "ultimo", description: "Último sismo registrado" },
    { command: "estado", description: "Estado del sistema" },
    { command: "riesgo", description: "Resumen del análisis de riesgo" },
    { command: "reporte", description: "Descargar Boletín Oficial (PDF)" },
    { command: "parar", description: "Desactivar alertas" },
    { command: "ayuda", description: "Guía de uso" },
  ]).catch((err) => logger.warn("Bot", "Failed to set commands", err));
}

// ─── Command Handlers ───────────────────────────────────────────

async function handleStart(ctx: CommandContext<Context>): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const isNew = await upsertUser(telegramId, ctx.from?.username ?? null);

  if (isNew) {
    logger.info("Bot", `New user registered: ${telegramId} (@${ctx.from?.username})`);
    await ctx.reply(
      `🌍 *¡Bienvenido a SismoBot!*\n\n` +
      `Recibirás alertas sísmicas en tiempo real para América Latina.\n\n` +
      `📋 *Configuración inicial:*\n` +
      `• Magnitud mínima: *4.0*\n` +
      `• Región: *Venezuela*\n\n` +
      `🔧 Personaliza tu configuración:\n` +
      `• /magnitud — Cambiar umbral de magnitud\n` +
      `• /regiones — Seleccionar regiones\n` +
      `• /ubicacion — Enviar ubicación para calcular distancia\n` +
      `• /ayuda — Ver todos los comandos\n\n` +
      `⚡ Las alertas se envían en menos de 30 segundos desde la detección.`,
      { parse_mode: "Markdown" }
    );
  } else {
    await ctx.reply(
      `👋 ¡Hola de nuevo! Tus alertas están activas.\n\n` +
      `Usa /config para ver tu configuración actual o /ayuda para ver los comandos.`
    );
  }
}

async function handleConfig(ctx: CommandContext<Context>): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await getUser(telegramId);
  if (!user) {
    await ctx.reply("⚠️ No estás registrado. Usa /start para comenzar.");
    return;
  }

  const regionLabels = user.regions
    .map((r) => (r === "all" ? "🌎 Todas" : REGIONS[r]?.label ?? r))
    .join(", ");

  const locationText = user.lat && user.lon
    ? `${user.lat.toFixed(4)}, ${user.lon.toFixed(4)}`
    : "No configurada";

  const silentText = user.silentStart && user.silentEnd
    ? `${user.silentStart} — ${user.silentEnd}`
    : "Desactivado";

  await ctx.reply(
    `⚙️ *Tu configuración:*\n\n` +
    `📊 Magnitud mínima: *${user.minMagnitude}*\n` +
    `🗺 Regiones: ${regionLabels}\n` +
    `📍 Ubicación: ${locationText}\n` +
    `🔇 Horario silencioso: ${silentText}\n\n` +
    `_Sismos M6.0+ ignoran el horario silencioso._`,
    { parse_mode: "Markdown" }
  );
}

async function handleMagnitudeMenu(ctx: CommandContext<Context>): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await getUser(telegramId);
  if (!user) {
    await ctx.reply("⚠️ No estás registrado. Usa /start para comenzar.");
    return;
  }

  const keyboard = new InlineKeyboard();
  for (let i = 0; i < MAGNITUDE_OPTIONS.length; i += 2) {
    const row: Array<{ text: string; callback_data: string }> = [];
    for (let j = i; j < Math.min(i + 2, MAGNITUDE_OPTIONS.length); j++) {
      const mag = MAGNITUDE_OPTIONS[j];
      const current = mag === user.minMagnitude ? " ✓" : "";
      row.push({
        text: `${getSeverityEmoji(mag)} M${mag}+${current}`,
        callback_data: `mag:${mag}`,
      });
    }
    keyboard.row(...row.map((r) => InlineKeyboard.text(r.text, r.callback_data)));
  }

  await ctx.reply(
    `📊 *Selecciona la magnitud mínima para recibir alertas:*\n\n` +
    `🟢 M2.5-3.0 → Microsismos (muchas alertas)\n` +
    `🟡 M3.0-4.0 → Sismos menores\n` +
    `🟠 M4.0-5.0 → Se sienten claramente\n` +
    `🔴 M5.0+ → Sismos significativos\n\n` +
    `_Actual: M${user.minMagnitude}+_`,
    { parse_mode: "Markdown", reply_markup: keyboard }
  );
}

async function handleRegionsMenu(ctx: CommandContext<Context>): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await getUser(telegramId);
  if (!user) {
    await ctx.reply("⚠️ No estás registrado. Usa /start para comenzar.");
    return;
  }

  const keyboard = new InlineKeyboard();

  // Add "All" option
  const allSelected = user.regions.includes("all");
  keyboard.row(
    InlineKeyboard.text(`🌎 Todas las regiones${allSelected ? " ✓" : ""}`, "region:all")
  );

  // Add individual regions
  for (const [key, region] of Object.entries(REGIONS)) {
    const selected = user.regions.includes(key);
    keyboard.row(
      InlineKeyboard.text(`${region.label}${selected ? " ✓" : ""}`, `region:${key}`)
    );
  }

  // Done button
  keyboard.row(InlineKeyboard.text("✅ Listo", "region:done"));

  await ctx.reply(
    `🗺 *Selecciona las regiones que quieres monitorear:*\n\n` +
    `Toca una región para activar/desactivar. Las que tienen ✓ están activas.\n\n` +
    `_Regiones actuales: ${user.regions.map((r) => r === "all" ? "Todas" : REGIONS[r]?.label ?? r).join(", ")}_`,
    { parse_mode: "Markdown", reply_markup: keyboard }
  );
}

async function handleLocationPrompt(ctx: CommandContext<Context>): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await getUser(telegramId);
  if (!user) {
    await ctx.reply("⚠️ No estás registrado. Usa /start para comenzar.");
    return;
  }

  await ctx.reply(
    `📍 *Envía tu ubicación* para calcular la distancia a cada sismo.\n\n` +
    `En Telegram, toca el 📎 (clip) → Ubicación → Enviar mi ubicación actual.\n\n` +
    `_Tu ubicación se guarda solo para calcular distancias. No se comparte._`,
    { parse_mode: "Markdown" }
  );
}

async function handleLocationMessage(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  const location = ctx.message?.location;
  if (!telegramId || !location) return;

  const user = await getUser(telegramId);
  if (!user) {
    await ctx.reply("⚠️ No estás registrado. Usa /start para comenzar.");
    return;
  }

  await setUserLocation(telegramId, location.latitude, location.longitude);
  logger.info("Bot", `User ${telegramId} set location: ${location.latitude}, ${location.longitude}`);

  await ctx.reply(
    `✅ Ubicación guardada: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}\n\n` +
    `Ahora las alertas incluirán la distancia aproximada al epicentro.`
  );
}

async function handleSilentHours(ctx: CommandContext<Context>): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await getUser(telegramId);
  if (!user) {
    await ctx.reply("⚠️ No estás registrado. Usa /start para comenzar.");
    return;
  }

  const keyboard = new InlineKeyboard()
    .text("🌙 23:00 — 07:00", "silent:23:00-07:00").row()
    .text("🌙 22:00 — 06:00", "silent:22:00-06:00").row()
    .text("🌙 00:00 — 08:00", "silent:00:00-08:00").row()
    .text("🔔 Desactivar", "silent:off");

  await ctx.reply(
    `🔇 *Horario silencioso:*\n\n` +
    `Durante este horario NO recibirás alertas, EXCEPTO para sismos M6.0+ (esos siempre te avisan).\n\n` +
    `_Actual: ${user.silentStart && user.silentEnd ? `${user.silentStart} — ${user.silentEnd}` : "Desactivado"}_`,
    { parse_mode: "Markdown", reply_markup: keyboard }
  );
}

async function handleLastEvent(ctx: CommandContext<Context>): Promise<void> {
  const event = await getLatestEvent();

  if (!event) {
    await ctx.reply("ℹ️ No hay sismos registrados aún. El sistema está monitoreando...");
    return;
  }

  const mag = event.magnitude as number;
  // Parse numeric string from DB if needed, or number
  const timestamp = new Date(Number(event.timestamp));
  const ago = getTimeAgo(timestamp);

  let distanceText = "";
  const telegramId = ctx.from?.id;
  if (telegramId) {
    const user = await getUser(telegramId);
    if (user?.lat && user?.lon) {
      const dist = haversineDistance(user.lat, user.lon, event.lat as number, event.lon as number);
      distanceText = `\n📏 Distancia a ti: ${formatDistance(dist)}`;
    }
  }

  await ctx.reply(
    `📋 *Último sismo registrado:*\n\n` +
    `${getSeverityEmoji(mag)} Magnitud: *${mag}*\n` +
    `📌 ${event.location}\n` +
    `📏 Profundidad: ${event.depth} km\n` +
    `🕐 ${timestamp.toLocaleString("es-VE", { timeZone: "America/Caracas" })} (${ago})` +
    `${distanceText}\n` +
    `📡 Fuente: ${(event.source as string).toUpperCase()}`,
    { parse_mode: "Markdown" }
  );
}

async function handleStatus(ctx: CommandContext<Context>): Promise<void> {
  const uptime = getTimeAgo(new Date(startTime));
  const userCount = await getUserCount();
  const eventCount = await getEventCount();

  await ctx.reply(
    `📊 *Estado del sistema:*\n\n` +
    `⏱ Uptime: ${uptime}\n` +
    `👥 Usuarios activos: ${userCount}\n` +
    `🔔 Eventos procesados: ${eventCount}\n` +
    `📡 Fuentes: USGS ✅, EMSC ✅\n` +
    `⚡ Intervalo de polling: ${process.env.POLL_INTERVAL_SECONDS ?? 15}s`,
    { parse_mode: "Markdown" }
  );
}

async function handlePing(ctx: CommandContext<Context>): Promise<void> {
  const dbStart = Date.now();
  try {
    await getDb().query("SELECT 1");
    const dbLatency = Date.now() - dbStart;
    const uptime = getTimeAgo(new Date(startTime));
    
    await ctx.reply(`🏓 Pong!\n\n⏱ Uptime: ${uptime}\n💽 DB Latency: ${dbLatency}ms`);
  } catch (err) {
    await ctx.reply("❌ Base de datos inalcanzable");
  }
}

async function handleRisk(ctx: CommandContext<Context>): Promise<void> {
  const report = getLastReport();
  if (!report) {
    await ctx.reply("ℹ️ El motor de Análisis de Riesgo aún está procesando los datos base. Intenta de nuevo más tarde.");
    return;
  }

  let text = `🚨 *RESUMEN DE RIESGO SÍSMICO*\n_Generado: ${new Date(report.generatedAt).toLocaleString("es-VE", { timeZone: "America/Caracas" })}_\n\n`;
  
  for (const assessment of report.assessments) {
    const emoji = { low: "🟢", moderate: "🟡", high: "🟠", critical: "🔴" }[assessment.riskLevel];
    text += `${emoji} *${assessment.regionName.toUpperCase()}*\n`;
    text += `Nivel: *${assessment.riskLevel.toUpperCase()}* (${assessment.riskScore}/100)\n`;
    
    if (assessment.indicators.bValue) {
      text += `• Valor b: ${assessment.indicators.bValue.currentBValue} ${assessment.indicators.bValue.deviation > 1 ? "⚠️" : ""}\n`;
    }
    if (assessment.indicators.rate) {
      text += `• Tasa: ${assessment.indicators.rate.rateRatio}x\n`;
    }
    if (assessment.indicators.activeForecasts.length > 0) {
      const etas = assessment.indicators.activeForecasts[0];
      text += `• ETAS: ${(etas.forecast24h.probM4 * 100).toFixed(1)}% prob M4+ (24h)\n`;
    }
    text += "\n";
  }
  
  text += `Para un detalle exhaustivo, usa /reporte y descarga el Boletín Oficial en PDF.`;
  
  await ctx.reply(text, { parse_mode: "Markdown" });
}

async function handleReporte(ctx: CommandContext<Context>): Promise<void> {
  const pdfPath = getLastPdfPath();
  const report = getLastReport();

  if (!pdfPath || !report) {
    await ctx.reply("ℹ️ Aún no hay un Boletín Oficial disponible. Se generan periódicamente cada 6 horas.");
    return;
  }

  await ctx.replyWithChatAction("upload_document");
  
  try {
    const file = new InputFile(pdfPath);
    await ctx.replyWithDocument(file, {
      caption: `📄 *BOLETÍN SÍSMICO OFICIAL*\n_Generado: ${new Date(report.generatedAt).toLocaleString("es-VE", { timeZone: "America/Caracas" })}_\n\nAnálisis de anomalías (Valor b, Tasa, Modelo ETAS).`,
      parse_mode: "Markdown"
    });
  } catch (err) {
    logger.error("Bot", "Failed to send PDF report", err);
    await ctx.reply("❌ Error al enviar el archivo PDF.");
  }
}

async function handleStop(ctx: CommandContext<Context>): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  await deactivateUser(telegramId);
  logger.info("Bot", `User ${telegramId} deactivated`);

  await ctx.reply(
    `🔕 Alertas desactivadas. Ya no recibirás notificaciones.\n\n` +
    `Usa /start en cualquier momento para reactivar.`
  );
}

async function handleHelp(ctx: CommandContext<Context>): Promise<void> {
  await ctx.reply(
    `📖 *Guía de SismoBot*\n\n` +
    `*Comandos disponibles:*\n` +
    `/start — Registrarse y activar alertas\n` +
    `/config — Ver tu configuración actual\n` +
    `/magnitud — Configurar magnitud mínima\n` +
    `/regiones — Seleccionar regiones\n` +
    `/ubicacion — Enviar ubicación para distancias\n` +
    `/silencio — Horario silencioso\n` +
    `/ultimo — Último sismo registrado\n` +
    `/estado — Estado del sistema\n` +
    `/parar — Desactivar alertas\n\n` +
    `*¿Cómo funciona?*\n` +
    `SismoBot consulta USGS y EMSC cada 15 segundos. ` +
    `Cuando detecta un sismo que coincide con tu configuración, ` +
    `te envía una alerta en menos de 30 segundos.\n\n` +
    `*💡 Tip para iOS:*\n` +
    `Para que suene como alarma, configura un sonido de notificación ` +
    `personalizado para este chat en Telegram ` +
    `(toca el nombre del bot → Notificaciones → Sonido).`,
    { parse_mode: "Markdown" }
  );
}

// ─── Callback Query Handler ────────────────────────────────────

async function handleCallbackQuery(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  const telegramId = ctx.from?.id;
  if (!data || !telegramId) return;

  // Report Felt Interaction
  if (data.startsWith("report:")) {
    const parts = data.split(":");
    if (parts.length === 3) {
      const felt = parts[1] === "yes";
      const eventId = parts[2];

      const isNewVote = await addEventReport(eventId, telegramId, felt);
      
      if (isNewVote) {
        await ctx.answerCallbackQuery({ text: "✅ ¡Gracias por reportar!" });
      } else {
        await ctx.answerCallbackQuery({ text: "⚠️ Ya habías reportado este sismo." });
      }
    }
    return;
  }

  // Magnitude selection
  if (data.startsWith("mag:")) {
    const magnitude = parseFloat(data.slice(4));
    if (!isNaN(magnitude)) {
      await setUserMagnitude(telegramId, magnitude);
      await ctx.answerCallbackQuery({
        text: `✅ Magnitud mínima: M${magnitude}+`,
      });
      await ctx.editMessageText(
        `✅ Magnitud mínima actualizada a *M${magnitude}+*\n\n` +
        `Recibirás alertas de sismos con magnitud ${magnitude} o mayor.`,
        { parse_mode: "Markdown" }
      );
      logger.info("Bot", `User ${telegramId} set magnitude to ${magnitude}`);
    }
    return;
  }

  // Region selection (toggle)
  if (data.startsWith("region:")) {
    const regionKey = data.slice(7);

    if (regionKey === "done") {
      await ctx.answerCallbackQuery({ text: "✅ Regiones guardadas" });
      const user = await getUser(telegramId);
      if (user) {
        const labels = user.regions
          .map((r) => (r === "all" ? "🌎 Todas" : REGIONS[r]?.label ?? r))
          .join(", ");
        await ctx.editMessageText(
          `✅ Regiones actualizadas: ${labels}`,
          { parse_mode: "Markdown" }
        );
      }
      return;
    }

    const user = await getUser(telegramId);
    if (!user) return;

    let newRegions = [...user.regions];

    if (regionKey === "all") {
      newRegions = newRegions.includes("all") ? ["venezuela"] : ["all"];
    } else {
      newRegions = newRegions.filter((r) => r !== "all");

      if (newRegions.includes(regionKey)) {
        newRegions = newRegions.filter((r) => r !== regionKey);
      } else {
        newRegions.push(regionKey);
      }

      if (newRegions.length === 0) {
        newRegions = ["venezuela"];
      }

      if (newRegions.length === ALL_REGION_KEYS.length) {
        newRegions = ["all"];
      }
    }

    await setUserRegions(telegramId, newRegions);

    // Rebuild keyboard with updated selections
    const keyboard = new InlineKeyboard();
    const allSelected = newRegions.includes("all");
    keyboard.row(
      InlineKeyboard.text(`🌎 Todas las regiones${allSelected ? " ✓" : ""}`, "region:all")
    );

    for (const [key, region] of Object.entries(REGIONS)) {
      const selected = allSelected || newRegions.includes(key);
      keyboard.row(
        InlineKeyboard.text(`${region.label}${selected ? " ✓" : ""}`, `region:${key}`)
      );
    }
    keyboard.row(InlineKeyboard.text("✅ Listo", "region:done"));

    const labels = newRegions
      .map((r) => (r === "all" ? "Todas" : REGIONS[r]?.label ?? r))
      .join(", ");

    await ctx.answerCallbackQuery({ text: `Regiones: ${labels}` });
    await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
    return;
  }

  // Silent hours
  if (data.startsWith("silent:")) {
    const value = data.slice(7);

    if (value === "off") {
      await setUserSilentHours(telegramId, null, null);
      await ctx.answerCallbackQuery({ text: "🔔 Horario silencioso desactivado" });
      await ctx.editMessageText("🔔 Horario silencioso *desactivado*. Recibirás todas las alertas.", {
        parse_mode: "Markdown",
      });
    } else {
      const [start, end] = value.split("-");
      await setUserSilentHours(telegramId, start, end);
      await ctx.answerCallbackQuery({
        text: `🌙 Silencio: ${start} — ${end}`,
      });
      await ctx.editMessageText(
        `🌙 Horario silencioso: *${start} — ${end}*\n\n` +
        `_Sismos M6.0+ seguirán notificando._`,
        { parse_mode: "Markdown" }
      );
    }
    logger.info("Bot", `User ${telegramId} updated silent hours`);
    return;
  }

  await ctx.answerCallbackQuery();
}

// ─── Helpers ───────────────────────────────────────────────────

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}
