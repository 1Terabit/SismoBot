# 🌍 SismoBot — Alertas Sísmicas en Tiempo Real via Telegram

Bot de Telegram que monitorea fuentes sísmicas (USGS, EMSC) cada 15 segundos y envía alertas personalizadas a usuarios en América Latina.

## Características

- ⚡ **Latencia < 30 segundos** desde la detección del evento
- 📡 **Múltiples fuentes**: USGS + EMSC para máxima cobertura
- 🗺 **Regiones configurables**: Venezuela, Colombia, Caribe, México, Centroamérica, Sudamérica, Norteamérica
- 📊 **Magnitud configurable**: Cada usuario elige su umbral (M2.5 a M6.0)
- 📍 **Cálculo de distancia**: Envía tu ubicación para saber qué tan lejos estás del epicentro
- 🌙 **Horario silencioso**: Desactiva alertas nocturnas (excepto M6.0+)
- 💾 **SQLite**: Base de datos ligera, sin dependencias externas

## Requisitos

- Node.js 20 o superior
- Un token de bot de Telegram (de [@BotFather](https://t.me/BotFather))

## Instalación

### 1. Clonar y configurar

```bash
git clone <tu-repo>
cd sismobot
pnpm install
```

### 2. Crear el bot en Telegram

1. Abre Telegram y busca [@BotFather](https://t.me/BotFather)
2. Envía `/newbot`
3. Nombre: `SismoBot` (o el que prefieras)
4. Username: `tu_sismobot` (debe ser único y terminar en `bot`)
5. Copia el token que te da

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` y pega tu token:

```
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
POLL_INTERVAL_SECONDS=15
DB_PATH=./data/sismobot.db
LOG_LEVEL=info
```

### 4. Compilar y ejecutar

```bash
# Desarrollo (con hot reload)
pnpm dev

# Producción
pnpm build
pnpm start
```

### 5. Producción con PM2 (recomendado)

```bash
# Instalar PM2 globalmente
pnpm add -g pm2

# Compilar
pnpm build

# Iniciar con PM2
pm2 start ecosystem.config.js

# Auto-iniciar al reiniciar el sistema
pm2 startup
pm2 save
```

## Configurar Sonido de Alarma en iOS (iPhone)

Para que las notificaciones de SismoBot suenen como alarma en tu iPhone:

1. Abre el chat con tu SismoBot en Telegram
2. Toca el **nombre del bot** en la parte superior
3. Ve a **Notificaciones** → **Sonido**
4. Selecciona un tono de alarma fuerte (por ejemplo, "Alarm" o "Emergency")
5. Asegúrate de que el **switch de silencio** del iPhone esté desactivado
6. En **Ajustes → Telegram → Notificaciones**, activa "Permitir notificaciones"

## Comandos del Bot

| Comando | Descripción |
|---------|-------------|
| `/start` | Registrarse y activar alertas |
| `/config` | Ver tu configuración actual |
| `/magnitud` | Cambiar umbral de magnitud mínima |
| `/regiones` | Seleccionar regiones a monitorear |
| `/ubicacion` | Enviar ubicación para calcular distancia |
| `/silencio` | Configurar horario silencioso |
| `/ultimo` | Ver último sismo registrado |
| `/estado` | Estado del sistema |
| `/parar` | Desactivar alertas |
| `/ayuda` | Guía de uso |

## Ejemplo de Alerta

```
🚨 ALERTA SÍSMICA 🚨

🔴 Magnitud: 5.2 (MODERADO)
📌 45km al N de Caracas, Venezuela
📏 Profundidad: 12.0 km
🕐 14:32:15 — 18/08/2026 (VET)
📏 Distancia a ti: ~120 km al N
📡 Fuente: USGS

🛡 Mantén la calma. Aléjate de ventanas y objetos pesados.
Si estás en un edificio, ubícate en zona segura. NO uses ascensores.
```

## Fuentes de Datos

- **[USGS Earthquake Hazards](https://earthquake.usgs.gov/)**: Servicio Geológico de Estados Unidos. Feed GeoJSON actualizado cada ~15 segundos.
- **[EMSC](https://www.emsc-csem.org/)**: Centro Sismológico Europeo-Mediterráneo. Fuente complementaria vía FDSN.

## Troubleshooting

### El bot no responde
- Verifica que `TELEGRAM_BOT_TOKEN` sea correcto
- Revisa los logs: `pm2 logs sismobot`

### No recibo alertas
- Ejecuta `/config` para verificar tu configuración
- Baja la magnitud mínima con `/magnitud`
- Verifica que tu región esté activa con `/regiones`

### Error de base de datos
- Verifica permisos en la carpeta `data/`
- Elimina `data/sismobot.db` para reiniciar (perderás configuraciones)

## Licencia

MIT
