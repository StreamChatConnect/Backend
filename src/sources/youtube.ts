import { Innertube, UniversalCache } from "youtubei.js";
import {
  AddChatItemAction,
  Channel,
  LiveChatTextMessage,
} from "youtubei.js/dist/src/parser/nodes";
import Video from "youtubei.js/dist/src/parser/classes/Video";
import { handleAddMessage } from "../index";
import { YOUTUBE_CHANNEL_NAME } from "../config";
import { log } from "../helpers";

export async function ytMain() {
  const yt = await Innertube.create({
    cache: new UniversalCache(true),
  });
  const search = await yt.search(YOUTUBE_CHANNEL_NAME, { type: "channel" });

  if (search.results.length === 0) {
    log("Channel not found.", "Error", "YT", "Failure");
    return;
  }

  // @ts-ignore
  const channel: Channel = search.results[0];
  log(
    `Channel found: ${channel.author.name} | ${channel.id}`,
    "Info",
    "YT",
    "Success",
  );

  const full = await yt.getChannel(channel.id);
  const livestreams = await full.getLiveStreams();
  // @ts-ignore
  const latestStream: Video = livestreams.videos[0];
  const videoInfo = await yt.getInfo(latestStream.video_id);
  const liveChat = await videoInfo.getLiveChat();

  if (!liveChat) {
    log(
      "No live chat available! YouTube chat won't be connected!",
      "Error",
      "YT",
      "Failure",
    );
    return;
  } else if (!videoInfo.basic_info.is_live) {
    log(
      "No live stream found! YouTube chat won't be connected!",
      "Error",
      "YT",
      "Failure",
    );
    return;
  } else {
    log(`Stream found: ${latestStream.title.text}`, "Info", "YT", "Success");
  }

  liveChat.start();

  liveChat.on("chat-update", (chat) => {
    if (chat.type == "AddChatItemAction") {
      const item = (chat as AddChatItemAction).item as LiveChatTextMessage;
      if (item.message.runs == null) return;
      handleAddMessage({
        user: {
          username: item.author.name,
          isMod: item.author.is_moderator ?? false,
          isStreamer: item.author.id == channel.author.id,
        },
        source: "YT",
        message: item.message.text ?? null,
        extra: { runs: item.message.runs },
      });
    }
  });
}
