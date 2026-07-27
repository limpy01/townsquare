import { defineStore } from "pinia";

export interface LobbyState {
  allowReconnect: boolean;
  isReconnecting: boolean;
  ping: number;
  rooms: string[] | null;
}

export const useLobbyStore = defineStore("lobby", {
  state: (): LobbyState => ({
    ping: 0,
    rooms: null,
    isReconnecting: false,
    allowReconnect: true,
  }),
  actions: {
    addRoom(roomId: string) {
      if (this.rooms?.includes(roomId)) return;
      this.rooms = [...(this.rooms ?? []), roomId];
    },
    removeRoom(roomId: string) {
      this.rooms =
        this.rooms?.filter((existingRoomId) => existingRoomId !== roomId) ??
        null;
    },
    setAllowReconnect(allowReconnect: boolean) {
      this.allowReconnect = allowReconnect;
    },
    setIsReconnecting(isReconnecting: boolean) {
      this.isReconnecting = isReconnecting;
    },
    setPing(ping: number) {
      this.ping = ping;
    },
    setRooms(rooms: string[]) {
      this.rooms = [...rooms];
    },
  },
});
