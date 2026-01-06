<template>
  <Modal
    v-if="modals.reminder && availableReminders.length && players[playerIndex]"
    @close="toggleModal('reminder')"
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
                : require('../../assets/icons/' +
                    (reminder.imageAlt || reminder.role.replace(/old1$/, '')) +
                    '.png')
            })`
          }"
        ></span>
        <span class="text">{{ reminder.name }}</span>
      </li>
    </ul>
  </Modal>
</template>

<script>
import Modal from "./Modal";
import { mapMutations, mapState } from "vuex";

/**
 * Helper function that maps a reminder name with a role-based object that provides necessary visual data.
 * @param role The role for which the reminder should be generated
 * @return {function(*): {image: string|string[]|string|*, role: *, name: *, imageAlt: string|*}}
 */
const mapReminder = ({ id, image, imageAlt }) => name => ({
  role: id,
  image,
  imageAlt,
  name
});

export default {
  components: { Modal },
  props: ["playerIndex"],
  computed: {
    availableReminders() {
      let reminders = [];
      const { players, bluffs } = this.$store.state.players;
      this.$store.state.roles.forEach(role => {
        // add reminders from player roles
        if (players.some(p => p.role.id === role.id)) {
          if (role.reminders && role.reminders.length) reminders = [...reminders, ...role.reminders.map(mapReminder(role))];
        }
        // add reminders from bluff/other roles
        else if (bluffs.some(bluff => bluff.id === role.id)) {
          if (role.reminders && role.reminders.length) reminders = [...reminders, ...role.reminders.map(mapReminder(role))];
        }
        // add global reminders
        if (role.remindersGlobal && role.remindersGlobal.length) {
          reminders = [
            ...reminders,
            ...role.remindersGlobal.map(mapReminder(role))
          ];
        }
      });
      // add fabled reminders
      this.$store.state.players.fabled.forEach(role => {
        if (role.reminders && role.reminders.length) reminders = [...reminders, ...role.reminders.map(mapReminder(role))];
      });

      // add out of script traveler reminders
      this.$store.state.otherTravelers.forEach(role => {
        if (players.some(p => p.role.id === role.id)) {
          if (role.reminders && role.reminders.length) reminders = [...reminders, ...role.reminders.map(mapReminder(role))];
        }
      });

      reminders.push({ role: "good", name: "善良" });
      reminders.push({ role: "evil", name: "邪恶" });
      reminders.push({ role: "custom", name: "自定义" });
      return reminders;
    },
    ...mapState(["modals", "grimoire", "session"]),
    ...mapState("players", ["players"])
  },
  methods: {
    async showInputModal({ inputType, inputModal, inputData }) {
      return new Promise((resolve, reject) => {
        this.$store.commit("session/setInputResolver", resolve);
        this.$store.commit("session/setInputRejecter", reject);

        this.$store.commit("session/setInputType", inputType);
        this.$store.commit("session/setInputModal", inputModal);
        this.$store.commit("session/setInputData", inputData);

        this.$store.commit("toggleModal", "input");
      });
    },
    async addReminder(reminder) {
      const player = this.$store.state.players.players[this.playerIndex];
      let value;

      if (reminder.role === "custom") {
        const input = await this.showInputModal({
          inputType: "reminder",
          inputModal: "input",
          inputData: {
            name: ["输入自定义提醒"],
            length: 1,
            placeholder: [""]
          }
        }).catch(() => {
          return null;
        });
        if (input === null) return;

        const name = input[0];
        if (!name) return;
        value = [...player.reminders, { role: "custom", name }];
      } else {
        value = [...player.reminders, reminder];
        this.$store.commit("toggleModal", "reminder");
      }
      this.$store.commit("players/update", {
        player,
        property: "reminders",
        value
      });
      const stReminders = value.filter(reminder => reminder.role !== "custom");
      if (!this.session.isSpectator && reminder.role != "custom") {
        this.$store.commit("players/update", {
          player,
          property: "stReminders",
          value: stReminders
        });
      }
    },
    ...mapMutations(["toggleModal"])
  }
};
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
