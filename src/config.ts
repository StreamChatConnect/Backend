function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is not set`);
  }
  return value;
}

export const TWITCH_BOT_USER_ID = getEnvVar("TWITCH_BOT_USER_ID");
export const TWITCH_BOT_OAUTH_TOKEN = getEnvVar("TWITCH_BOT_OAUTH_TOKEN");
export const CLIENT_ID = getEnvVar("CLIENT_ID");
export const CLIENT_SECRET = getEnvVar("CLIENT_SECRET");
export const TWITCH_CHAT_CHANNEL_USER_ID = getEnvVar(
  "TWITCH_CHAT_CHANNEL_USER_ID",
);
export const EVENTSUB_WEBSOCKET_URL = getEnvVar("EVENTSUB_WEBSOCKET_URL");
export const YOUTUBE_CHANNEL_NAME = getEnvVar("YOUTUBE_CHANNEL_NAME");
