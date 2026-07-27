<template>
  <ul class="info">
    <li
      class="edition"
      :class="['edition-' + edition.id]"
      :style="{
        backgroundImage: `url(${
          edition.logo && grimoire.isImageOptIn
            ? edition.logo
            : editionImage(edition.id)
        })`,
      }"
    ></li>
    <li v-if="players.length - teams.traveler < 5">请添加更多玩家！</li>
    <li>
      <span class="meta" v-if="!edition.isOfficial">
        {{ edition.name }}
        {{ edition.author ? "by " + edition.author : "" }}
      </span>
      <span>
        {{ players.length }} <font-awesome-icon class="players" icon="users" />
      </span>
      <span>
        {{ teams.alive }}
        <font-awesome-icon class="alive" icon="heartbeat" />
      </span>
      <span>
        {{ teams.votes }} <font-awesome-icon class="votes" icon="vote-yea" />
      </span>
    </li>
    <li v-if="players.length - teams.traveler >= 5">
      <span>
        {{ teams.townsfolk }}
        <font-awesome-icon class="townsfolk" icon="user-friends" />
      </span>
      <span>
        {{ teams.outsider }}
        <font-awesome-icon
          class="outsider"
          :icon="teams.outsider > 1 ? 'user-friends' : 'user'"
        />
      </span>
      <span>
        {{ teams.minion }}
        <font-awesome-icon
          class="minion"
          :icon="teams.minion > 1 ? 'user-friends' : 'user'"
        />
      </span>
      <span>
        {{ teams.demon }}
        <font-awesome-icon
          class="demon"
          :icon="teams.demon > 1 ? 'user-friends' : 'user'"
        />
      </span>
      <span v-if="teams.traveler">
        {{ teams.traveler }}
        <font-awesome-icon
          class="traveler"
          :icon="teams.traveler > 1 ? 'user-friends' : 'user'"
        />
      </span>
      <span v-if="grimoire.isNight">
        夜晚阶段
        <font-awesome-icon :icon="['fas', 'cloud-moon']" />
      </span>
    </li>
    <li>
      <span> 房间号： </span>
      <span v-if="identity.sessionId">
        {{ identity.sessionId }}
      </span>
      <span v-else> 未加入房间 </span>
    </li>
    <li v-if="review.isReview">复盘视角</li>
  </ul>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { editionImage } from "../assets/images";
import gameJSON from "../game.json";
import { useReviewStore } from "../stores/review";
import { useGrimoireStore } from "../stores/grimoire";
import { usePlayersStore } from "../stores/players";
import { useScenarioStore } from "../stores/scenario";
import { useSessionIdentityStore } from "../stores/session-identity";

const playerState = usePlayersStore();
const scenario = useScenarioStore();
const grimoire = useGrimoireStore();
const identity = useSessionIdentityStore();
const review = useReviewStore();
const players = computed(() => playerState.players);
const edition = computed(() => scenario.edition as any);
const teams = computed(() => {
  const nonTravelers = Math.min(
    players.value.filter((player) => player.role.team !== "traveler").length,
    15,
  );
  const alive = players.value.filter((player) => player.isDead !== true).length;
  const gameTeamCounts = gameJSON[nonTravelers - 5] ?? {
    townsfolk: 0,
    outsider: 0,
    minion: 0,
    demon: 0,
  };
  return {
    ...gameTeamCounts,
    traveler: players.value.length - nonTravelers,
    alive,
    votes:
      alive +
      players.value.filter(
        (player) => player.isDead === true && player.isVoteless !== true,
      ).length,
  };
});
</script>

<style lang="scss" scoped>
@use "../vars.scss" as *;

.info {
  position: absolute;
  display: flex;
  width: 20%;
  height: 20%;
  padding: 50px 0 0;
  align-items: center;
  place-content: center center;
  flex-wrap: wrap;
  background: url("../assets/demon-head.png") center center no-repeat;
  background-size: auto 100%;

  li {
    font-weight: bold;
    width: 100%;
    filter: drop-shadow(0 0 2px rgb(0 0 0 / 70%));
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    text-shadow:
      0 2px 1px black,
      0 -2px 1px black,
      2px 0 1px black,
      -2px 0 1px black;

    span {
      white-space: nowrap;
    }

    .meta {
      text-align: center;
      flex-basis: 100%;
      font-family: PiratesBay, sans-serif;
      font-weight: normal;
    }

    svg {
      margin-right: 10px;
    }

    .players {
      color: #00f700;
    }

    .alive {
      color: #ff4a50;
    }

    .votes {
      color: #fff;
    }

    .townsfolk {
      color: $townsfolk;
    }

    .outsider {
      color: $outsider;
    }

    .minion {
      color: $minion;
    }

    .demon {
      color: $demon;
    }

    .traveler {
      color: $traveler;
    }
  }

  li.edition {
    width: 220px;
    height: 200px;
    max-width: 100%;
    max-height: 100%;
    background-position: 0 center;
    background-repeat: no-repeat;
    background-size: 100% auto;
    position: absolute;
    top: -25%;
  }
}
</style>
