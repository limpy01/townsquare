<template>
  <Modal
    v-if="modals.reminder && availableReminders.length && players[playerIndex]"
    @close="modals.toggle('reminder')"
  >
    <h3>选择一个提醒标记</h3>
    <ul class="reminders">
      <li
        v-for="reminder in availableReminders"
        class="reminder"
        :class="[reminder.role]"
        :key="reminder.role + ' ' + reminder.name"
        @click="addReminder(reminder)"
      >
        <span
          class="icon"
          :style="{
            backgroundImage: `url(${
              reminder.image && grimoire.isImageOptIn
                ? reminder.image
                : require(
                    '../../assets/icons/' +
                      (reminder.imageAlt ||
                        reminder.role.replace(/old1$/, '')) +
                      '.png',
                  )
            })`,
          }"
        ></span>
        <span class="text">{{ reminder.name }}</span>
      </li>
    </ul>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Modal from "./Modal.vue";
import { showInputModal } from "../../services/input-modal";
import { emitLegacyMutation } from "../../store/legacy-effects";
import { useGrimoireStore } from "../../stores/grimoire";
import { useModalStore } from "../../stores/modals";
import { usePlayersStore } from "../../stores/players";
import { useScenarioStore } from "../../stores/scenario";
import { useSessionIdentityStore } from "../../stores/session-identity";

/**
 * Helper function that maps a reminder name with a role-based object that provides necessary visual data.
 * @param role The role for which the reminder should be generated
 * @return {function(*): {image: string|string[]|string|*, role: *, name: *, imageAlt: string|*}}
 */
const mapReminder =
  ({ id, image, imageAlt }: any) =>
  (name: string) => ({
    role: id,
    image,
    imageAlt,
    name,
  });

const { playerIndex } = defineProps<{ playerIndex: number }>();
const modals = useModalStore();
const grimoire = useGrimoireStore();
const playerState = usePlayersStore();
const scenario = useScenarioStore();
const session = useSessionIdentityStore();
const players = computed(() => playerState.players);
const availableReminders = computed(() => {
  let reminders: any[] = [];
  const { players, bluffs } = playerState;
  (scenario.roles as Map<string, any>).forEach((role) => {
    // add reminders from player roles
    if (players.some((p) => p.role.id === role.id)) {
      if (role.reminders && role.reminders.length)
        reminders = [...reminders, ...role.reminders.map(mapReminder(role))];
    }
    // add reminders from bluff/other roles
    else if (bluffs.some((bluff) => bluff.id === role.id)) {
      if (role.reminders && role.reminders.length)
        reminders = [...reminders, ...role.reminders.map(mapReminder(role))];
    }
    // add global reminders
    if (role.remindersGlobal && role.remindersGlobal.length) {
      reminders = [
        ...reminders,
        ...role.remindersGlobal.map(mapReminder(role)),
      ];
    }
  });
  // add fabled reminders
  playerState.fabled.forEach((role) => {
    if (role.reminders && role.reminders.length)
      reminders = [...reminders, ...role.reminders.map(mapReminder(role))];
  });

  // add out of script traveler reminders
  (scenario.otherTravelers as Map<string, any>).forEach((role) => {
    if (players.some((p) => p.role.id === role.id)) {
      if (role.reminders && role.reminders.length)
        reminders = [...reminders, ...role.reminders.map(mapReminder(role))];
    }
  });

  reminders.push({ role: "good", name: "善良" });
  reminders.push({ role: "evil", name: "邪恶" });
  reminders.push({ role: "custom", name: "自定义" });
  return reminders;
});

async function addReminder(reminder: any) {
  const player = players.value[playerIndex];
  let value;

  if (reminder.role === "custom") {
    const input = await showInputModal({
      inputType: "reminder",
      inputModal: "input",
      inputData: {
        name: ["输入自定义提醒"],
        length: 1,
        placeholder: [""],
      },
    }).catch(() => {
      return null;
    });
    if (input === null || !Array.isArray(input)) return;

    const name = input[0];
    if (!name) return;
    value = [...player.reminders, { role: "custom", name }];
  } else {
    value = [...player.reminders, reminder];
    modals.toggle("reminder");
  }
  const reminderPayload = {
    player,
    property: "reminders",
    value,
  };
  playerState.update(reminderPayload);
  emitLegacyMutation("players/update", reminderPayload);
  const stReminders = value.filter((reminder) => reminder.role !== "custom");
  if (!session.isSpectator && reminder.role != "custom") {
    const storytellerReminderPayload = {
      player,
      property: "stReminders",
      value: stReminders,
    };
    playerState.update(storytellerReminderPayload);
    emitLegacyMutation("players/update", storytellerReminderPayload);
  }
}
</script>

<style scoped lang="scss">
ul.reminders .reminder {
  background: url("../../assets/reminder.png") center center;
  background-size: 100%;
  width: 14vh;
  height: 14vh;
  max-width: 100px;
  max-height: 100px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 1%;

  border-radius: 50%;
  border: 3px solid black;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  cursor: pointer;
  line-height: 100%;
  transition: transform 500ms ease;

  .icon {
    position: absolute;
    top: 0;
    width: 90%;
    height: 90%;
    background-size: 100%;
    background-position: center center;
    background-repeat: no-repeat;
  }

  .text {
    color: black;
    font-size: 65%;
    font-weight: bold;
    text-align: center;
    top: 28%;
    width: 80%;
    line-height: 1;
  }

  &:hover {
    transform: scale(1.2);
  }
}
</style>
