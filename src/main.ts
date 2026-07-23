import { createApp } from "vue";
import App from "./App.vue";
import { pinia } from "./pinia";
import store from "./store";
import { library } from "@fortawesome/fontawesome-svg-core";
import { fas } from "@fortawesome/free-solid-svg-icons";
import { fab } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { wraith } from "./assets/svg/wraith";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

const faIcons = [
  "AddressCard",
  "ArrowCircleUp",
  "ArrowCircleDown",
  "Book",
  "BookOpen",
  "BookDead",
  "BroadcastTower",
  "Chair",
  "CheckSquare",
  "CloudMoon",
  "Cog",
  "Comment",
  "Copy",
  "Clipboard",
  "Dice",
  "Dragon",
  "ExchangeAlt",
  "ExclamationTriangle",
  "FileCode",
  "FileUpload",
  "HandPaper",
  "HandPointRight",
  "HatWizard",
  "Heartbeat",
  "Image",
  "Keyboard",
  "Link",
  "Minus",
  "MinusCircle",
  "Microphone",
  "MicrophoneSlash",
  "PeopleArrows",
  "Plus",
  "PlusCircle",
  "Question",
  "Random",
  "RedoAlt",
  "SearchMinus",
  "SearchPlus",
  "Skull",
  "Slash",
  "Square",
  "TheaterMasks",
  "Times",
  "TimesCircle",
  "TrashAlt",
  "Undo",
  "User",
  "UserEdit",
  "UserFriends",
  "Users",
  "VenusMars",
  "VolumeUp",
  "VolumeMute",
  "VoteYea",
  "WindowMaximize",
  "WindowMinimize",
] as const;
const fabIcons = ["Github", "Discord"] as const;

library.add(
  ...(faIcons
    .map((icon) => fas[`fa${icon}`])
    .filter(Boolean) as IconDefinition[]),
  ...(fabIcons
    .map((icon) => fab[`fa${icon}`])
    .filter(Boolean) as IconDefinition[]),
  wraith as IconDefinition,
);

createApp(App)
  .use(pinia)
  .use(store)
  .component("font-awesome-icon", FontAwesomeIcon)
  .mount("#app");
