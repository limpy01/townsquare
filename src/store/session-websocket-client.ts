export type SessionSocketHandlers = {
  onMessage(event: MessageEvent<unknown>): void;
  onOpen(): void;
  onClose(event: CloseEvent): void;
};

/** Browser WebSocket adapter with no game or Pinia dependencies. */
export class SessionWebSocketClient {
  private socket: WebSocket | null = null;

  get isConnected(): boolean {
    return this.socket !== null;
  }

  open(endpoint: string, handlers: SessionSocketHandlers): void {
    this.close();
    const socket = new WebSocket(endpoint);
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      handlers.onMessage(event as MessageEvent<unknown>);
    });
    socket.onopen = handlers.onOpen;
    socket.onclose = (event) => {
      if (this.socket === socket) this.socket = null;
      handlers.onClose(event);
    };
  }

  send(payload: string): void {
    if (this.socket?.readyState === 1) this.socket.send(payload);
  }

  close(code = 1000): void {
    const socket = this.socket;
    this.socket = null;
    socket?.close(code);
  }
}
