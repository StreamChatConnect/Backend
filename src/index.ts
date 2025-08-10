import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import {
  addMessageType,
  ClientToServerEvents,
  message,
  Place,
  PlaceKey,
  ServerToClientEvents,
} from "@/shared-lib/types";

let messages: message[] = [];

let places: Record<PlaceKey, Place> = {
  "1ST": null,
  "2ND": null,
  "3RD": null,
};

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: "*",
  },
});
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { ytMain } from "./sources/youtube";
import { getBadge, getCheermote, twitchMain } from "./sources/twitch";

export function handlePlace(username: string): Place {
  return (
    (Object.keys(places) as PlaceKey[]).find((k) => places[k] === username) ||
    (Object.keys(places) as PlaceKey[]).find(
      (k) => places[k] === null && (places[k] = username),
    ) ||
    null
  );
}

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

ytMain();
twitchMain();
io.on("connection", (socket) => {
  socket.on("sync", () => sendStreamMessages());

  socket.on("addMessage", (msg) => handleAddMessage(msg));

  socket.on("deleteMessage", (id) => handleRemoveMessage(id));
});

const PORT = 6842;
httpServer.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});

// #region Utilities
function handleRemoveMessage(id: string) {
  messages = messages.filter((msg) => msg.id !== id);
  sendStreamMessages();
}

function sendStreamMessages() {
  io.emit("streamMessages", messages);
}

function cleanMessage(msg: string): string {
  return DOMPurify.sanitize(msg).trim();
}

export async function handleAddMessage(msg: addMessageType) {
  if (!msg.message) return;

  const cleanedMessage = cleanMessage(msg.message);
  if (cleanedMessage == "") return;
  let tempMsg: message = {
    id: crypto.randomUUID(),
    message: cleanedMessage,
    user: {
      username: msg.user.username,
      place: handlePlace(msg.user.username),
    },
    timestamp: Date.now(),
    source: msg.source,
    extra: msg.extra,
  };

  for (const fragment of tempMsg.extra.fragments) {
    if (fragment.type === "cheermote" && fragment.cheermote) {
      fragment.cheermoteData = await getCheermote(
        fragment.cheermote.prefix,
        fragment.cheermote.bits,
      );
      fragment.text =
        fragment.cheermote.prefix + fragment.cheermoteData.min_bits;
    }
  }

  for (const badge of tempMsg.extra.badges) {
    badge.data = await getBadge(badge.set_id, badge.id);
  }

  if (msg.user.isMod) tempMsg.user.isMod = true;
  if (msg.user.isStreamer) tempMsg.user.isStreamer = true;

  messages.push(tempMsg);

  if (messages.length > 100) {
    messages.shift();
    console.warn("100 message threshold reached! Removing old message...");
  }

  io.emit("streamMessage", tempMsg);
}

// #endregion
