import { pinia } from "../pinia";
import { useChatStore } from "../stores/chat";
import { mutationBus } from "./mutation-bus";
import { hydratePersistence } from "./persistence-hydrator";
import type { PersistenceStore } from "./persistence-types";
import { createPersistenceWriter } from "./persistence-writer";
import { migrateTownsquareStorage } from "./storage";

const updatePageTitle = (_isPublic: boolean) => {
  document.title = "编程分享：钟楼谜团魔典——线上的说书人辅助工具（血染钟楼） ";
};

/** Browser-only compatibility adapter for the historical flat storage format. */
export default (store: PersistenceStore) => {
  if (window.location.pathname !== "/") return;

  const storage = window.localStorage;
  migrateTownsquareStorage(storage);
  hydratePersistence(store, storage);
  if (storage.getItem("isGrimoire")) updatePageTitle(false);

  return mutationBus.subscribe(
    createPersistenceWriter({
      storage,
      getChatHistories: () => useChatStore(pinia).histories,
      updatePageTitle,
    }),
  );
};
