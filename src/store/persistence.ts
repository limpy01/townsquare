import { pinia } from "../pinia";
import { useChatStore } from "../stores/chat";
import { gameEvents } from "./game-events";
import { hydratePersistence } from "./persistence-hydrator";
import { createPersistenceWriter } from "./persistence-writer";
import { migrateTownsquareStorage } from "./storage";

const updatePageTitle = (_isPublic: boolean) => {
  document.title = "编程分享：钟楼谜团魔典——线上的说书人辅助工具（血染钟楼） ";
};

/** Browser-only compatibility adapter for the historical flat storage format. */
export default () => {
  if (window.location.pathname !== "/") return;

  const storage = window.localStorage;
  migrateTownsquareStorage(storage);
  hydratePersistence(storage);
  if (storage.getItem("isGrimoire")) updatePageTitle(false);

  return gameEvents.subscribe(
    createPersistenceWriter({
      storage,
      getChatHistories: () => useChatStore(pinia).histories,
      updatePageTitle,
    }),
  );
};
