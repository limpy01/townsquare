import type { OutboxMessage } from "../stores/message-outbox";

export interface SessionOutboxTransport {
  send(command: string, params: unknown, feedback: number): void;
  sendDirect(
    playerId: string,
    command: string,
    params: unknown,
    feedback: number,
  ): void;
  request(
    command: string,
    playerId: string,
    params: unknown,
    feedback: number,
  ): void;
  uploadFile(
    command: string,
    playerId: string,
    params: unknown,
    feedback: number,
  ): void;
}

/** Route persisted outbox entries through the unchanged v1 transport helpers. */
export function dispatchSessionOutboxMessage(
  message: OutboxMessage,
  transport: SessionOutboxTransport,
): void {
  switch (message.type) {
    case "direct":
      transport.sendDirect(
        message.playerId,
        message.command,
        message.params,
        message.id,
      );
      return;
    case "request":
      transport.request(
        message.command,
        message.playerId,
        message.params,
        message.id,
      );
      return;
    case "uploadFile":
      transport.uploadFile(
        message.command,
        message.playerId,
        message.params,
        message.id,
      );
      return;
    default:
      transport.send(message.command, message.params, message.id);
  }
}
