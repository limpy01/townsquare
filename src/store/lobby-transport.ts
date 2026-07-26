import { decodeLegacyEnvelope } from "@townsquare/contracts/legacy-envelope";
import { wsBase } from "../config";
import { pinia } from "../pinia";
import { useLobbyStore } from "../stores/lobby";

type LegacyLobbyStore = {
  state: {
    session: {
      playerId: string;
    };
  };
  commit(type: string, payload?: unknown): void;
};

export default class LiveLobby {
  private _wss = `${wsBase}/lobby/`;
  private _socket: WebSocket | null = null;
  private _store: LegacyLobbyStore;
  private _lobby = useLobbyStore(pinia);
  private _pingTimer: ReturnType<typeof setTimeout> | undefined;
  private _reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private _reconnectInterval: ReturnType<typeof setInterval> | undefined;
  private _pings: Record<string, number> = {};

  constructor(store: LegacyLobbyStore) {
    this._store = store;
  }

  private _open() {
    this.disconnect();
    this._socket = new WebSocket(
      this._wss + this._store.state.session.playerId,
    );
    this._socket.addEventListener("message", this._handleMessage.bind(this));
    this._socket.onopen = () => console.log("Welcome!");
    this._socket.onclose = () => {
      this._socket = null;
      clearTimeout(this._pingTimer);
      this._pingTimer = undefined;
      this._reconnectTimer = setTimeout(() => {
        this._reconnectInterval = setInterval(() => {
          if (!this._lobby.allowReconnect) return;
          clearInterval(this._reconnectInterval);
          this._reconnectInterval = undefined;
          this.connect();
        }, 3 * 1000);
      }, 3 * 1000);
    };
  }

  private _handleMessage({ data }: MessageEvent<unknown>): void {
    let command: string | undefined;
    let params: unknown;
    if (typeof data !== "string") {
      console.log("unsupported socket message", data);
      return;
    }
    try {
      ({ command, params } = decodeLegacyEnvelope(JSON.parse(data)));
    } catch {
      console.log("unsupported socket message", data);
      return;
    }
    switch (command) {
      case "setRooms":
        this.setRooms(params);
        break;
      case "addRoom":
        this.addRoom(params);
        break;
      case "removeRoom":
        this.removeRoom(params);
        break;
    }
  }

  connect(): void {
    if (!this._store.state.session.playerId) {
      let playerId: string | undefined;
      while (
        !playerId ||
        playerId === "host" ||
        playerId === "_host" ||
        playerId === "player" ||
        playerId === "default"
      ) {
        playerId = Math.random().toString(36).slice(2);
      }
      this._store.commit("session/setPlayerId", playerId);
    }
    this._pings = {};
    this._lobby.setPing(0);
    this._open();
  }

  disconnect(): void {
    this._pings = {};
    this._lobby.setPing(0);
    this._lobby.setIsReconnecting(false);
    clearTimeout(this._reconnectTimer);
    clearInterval(this._reconnectInterval);
    if (this._socket) {
      this._socket.close(1000);
      this._socket = null;
    }
  }

  private setRooms(params: unknown): void {
    if (
      Array.isArray(params) &&
      params.every((room) => typeof room === "string")
    )
      this._lobby.setRooms(params);
  }

  private addRoom(params: unknown): void {
    if (typeof params === "string") this._lobby.addRoom(params);
  }

  private removeRoom(params: unknown): void {
    if (typeof params === "string") this._lobby.removeRoom(params);
  }
}
