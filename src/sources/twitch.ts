import WebSocket from "ws";
import { addMessageType, Cheermote } from "@/shared-lib/types";
import { handleAddMessage } from "../index";
import {
  TWITCH_BOT_USER_ID,
  TWITCH_CHAT_CHANNEL_USER_ID,
  CLIENT_ID,
  EVENTSUB_WEBSOCKET_URL,
  TWITCH_BOT_OAUTH_TOKEN,
} from "../config";
import { log } from "../helpers";

let websocketSessionID: any;

let cheermotes: Cheermote[] = [];
let badges: any[] = [];

let moderators: any[] = [];
let getModeratorsEnabled = false;

export async function twitchMain() {
  await getAuth();
  const websocketClient = startWebSocketClient();
}

async function getAuth() {
  // https://dev.twitch.tv/docs/authentication/validate-tokens/#how-to-validate-a-token
  let response = await fetch("https://id.twitch.tv/oauth2/validate", {
    method: "GET",
    headers: {
      Authorization: "OAuth " + TWITCH_BOT_OAUTH_TOKEN,
    },
  });
  let data = await response.json();
  if (response.status != 200) {
    log(
      `Token is not valid. /oauth2/validate returned status code ${response.status}, Twitch Chat won't be connected!`,
      "Error",
      "TW",
      "Failure",
    );
    log(data, "Error", "TW");
    return;
  }

  log("Twitch OAuth token valid!", "Info", "TW", "Success");
  const scopes = data.scopes;
  if (!scopes.find((scope: string) => scope == "user:read:chat")) {
    log(
      "Scope: user:read:chat missing! Twitch Chat won't be connected!",
      "Error",
      "TW",
      "Failure",
    );
    return;
  }
  if (!scopes.find((scope: string) => scope == "moderation:read")) {
    log(
      "Scope: moderation:read missing! Moderator badge functionality for Twitch is disabled!",
      "Error",
      "TW",
      "Important",
    );
    getModeratorsEnabled = false;
  } else if (data.user_id != TWITCH_CHAT_CHANNEL_USER_ID) {
    log(
      "User ID of the bot and broadcaster need to match to get moderators. Moderator badge functionality for Twitch is disabled!",
      "Error",
      "TW",
      "Important",
    );
    getModeratorsEnabled = false;
  } else getModeratorsEnabled = true;
}

function startWebSocketClient() {
  let websocketClient = new WebSocket(EVENTSUB_WEBSOCKET_URL);

  websocketClient.on("error", (err) => log(err.message, "Error", "TW"));

  websocketClient.on("open", () => {
    log(
      `WebSocket connection opened to ${EVENTSUB_WEBSOCKET_URL}`,
      "Debug",
      "TW",
    );
  });

  websocketClient.on("message", (data) => {
    handleWebSocketMessage(JSON.parse(data.toString()));
  });

  return websocketClient;
}

async function sendMsg(data: any) {
  let frags = data.payload.event.message.fragments;

  const msg: addMessageType = {
    user: {
      username: data.payload.event.chatter_user_name,
      isMod:
        getModeratorsEnabled &&
        moderators.find(
          (moderator) =>
            moderator.user_id == data.payload.event.chatter_user_id,
        ),
      isStreamer:
        data.payload.event.broadcaster_user_id ==
        data.payload.event.chatter_user_id,
    },
    source: "TW",
    message: data.payload.event.message.text,
    extra: {
      fragments: frags,
      badges: data.payload.event.badges,
    },
  };

  for (const f of frags) {
    if (f.type === "cheermote")
      f.cheermoteData = await getCheermote(
        f.cheermote.prefix,
        f.cheermote.bits,
      );
  }

  for (const badge of msg.extra.badges) {
    badge.data = await getBadge(badge.set_id, badge.id);
  }

  handleAddMessage(msg);
}

function handleWebSocketMessage(data: any) {
  switch (data.metadata.message_type) {
    case "session_welcome":
      websocketSessionID = data.payload.session.id;

      registerEventSubListeners();
      break;
    case "notification": // An EventSub notification has occurred, such as channel.chat.message
      switch (data.metadata.subscription_type) {
        case "channel.chat.message":
          sendMsg(data);
          break;
      }
      break;
  }
}

async function getBadges() {
  const channel_res = await fetch(
    `https://api.twitch.tv/helix/chat/badges?broadcaster_id=${TWITCH_CHAT_CHANNEL_USER_ID}`,
    {
      headers: {
        "Client-ID": CLIENT_ID,
        Authorization: `Bearer ${TWITCH_BOT_OAUTH_TOKEN}`,
      },
    },
  );

  if (!channel_res.ok)
    throw new Error(
      `Failed to fetch channel badges: ${channel_res.statusText}`,
    );

  const channel_data = await channel_res.json();

  const global_res = await fetch(
    "https://api.twitch.tv/helix/chat/badges/global",
    {
      headers: {
        "Client-ID": CLIENT_ID,
        Authorization: `Bearer ${TWITCH_BOT_OAUTH_TOKEN}`,
      },
    },
  );

  if (!global_res.ok)
    throw new Error(`Failed to fetch global badges: ${global_res.statusText}`);

  const global_data = await global_res.json();
  badges = [...channel_data.data, ...global_data.data];
}

async function getModerators() {
  let response = await fetch(
    `https://api.twitch.tv/helix/moderation/moderators?broadcaster_id=${TWITCH_CHAT_CHANNEL_USER_ID}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${TWITCH_BOT_OAUTH_TOKEN}`,
        "Client-Id": CLIENT_ID,
        "Content-Type": "application/json",
      },
    },
  );
  if (response.status != 200) {
    let data = await response.json();
    log(
      `Failed to get moderators! ${response.status}, Twitch Chat won't be connected!`,
      "Error",
      "TW",
      "Failure",
    );
    log(data, "Debug", "TW");
    return;
  } else {
    const data = await response.json();
    moderators = data.data;
  }
}

export async function getBadge(set_id: string, id: string) {
  return badges
    .find((badgeSet) => badgeSet.set_id == set_id)
    ?.versions?.find((badge: any) => badge.id == id);
}

export async function getCheermote(prefix: string, bits: number) {
  const c = cheermotes.find(
    (c) => c.prefix.toLowerCase() === prefix.toLowerCase(),
  );
  if (!c) return null;
  return (
    [...c.tiers]
      .sort((a, b) => a.min_bits - b.min_bits)
      .filter((t) => t.min_bits <= bits)
      .pop() || null
  );
}

async function getCheermotes() {
  let response = await fetch(
    `https://api.twitch.tv/helix/bits/cheermotes/?broadcaster_user_id=${TWITCH_CHAT_CHANNEL_USER_ID}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${TWITCH_BOT_OAUTH_TOKEN}`,
        "Client-Id": CLIENT_ID,
        "Content-Type": "application/json",
      },
    },
  );
  if (response.status != 200) {
    let data = await response.json();
    log(
      `Failed to get cheermotes! ${response.status}, Twitch Chat won't be connected!`,
      "Error",
      "TW",
      "Failure",
    );
    log(data, "Debug", "TW");
    return;
  } else {
    const data = await response.json();
    cheermotes = data.data;
  }
}

async function registerEventSubListeners() {
  // Register channel.chat.message
  let response = await fetch(
    "https://api.twitch.tv/helix/eventsub/subscriptions",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + TWITCH_BOT_OAUTH_TOKEN,
        "Client-Id": CLIENT_ID,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "channel.chat.message",
        version: "1",
        condition: {
          broadcaster_user_id: TWITCH_CHAT_CHANNEL_USER_ID,
          user_id: TWITCH_BOT_USER_ID,
        },
        transport: {
          method: "websocket",
          session_id: websocketSessionID,
        },
      }),
    },
  );

  if (response.status != 202) {
    let data = await response.json();
    log(
      `Failed to subscribe to channel.chat.message. API call returned status code ${response.status}, Twitch Chat won't be connected!`,
      "Error",
      "TW",
      "Failure",
    );
    log(data, "Debug", "TW");
    return;
  } else {
    log(`Connection to Twitch Chat was successful!`, "Info", "TW", "Success");
    getCheermotes();
    getBadges();
    if (getModeratorsEnabled) getModerators();
  }
}
