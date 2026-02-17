type MessageHandler = (data: any) => void;

export class WebSocketManager {
  private connections = new Map<string, WebSocket>();
  private handlers = new Map<string, Set<MessageHandler>>();

  constructor(private baseUrl: string) {}

  connect(channel: string): WebSocket {
    if (this.connections.has(channel)) {
      return this.connections.get(channel)!;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}${this.baseUrl}/${channel}`;
    const ws = new WebSocket(url);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const channelHandlers = this.handlers.get(channel);
      if (channelHandlers) {
        channelHandlers.forEach((handler) => handler(data));
      }
    };

    ws.onclose = () => {
      this.connections.delete(channel);
    };

    this.connections.set(channel, ws);
    return ws;
  }

  subscribe(channel: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
    }
    this.handlers.get(channel)!.add(handler);

    if (!this.connections.has(channel)) {
      this.connect(channel);
    }

    return () => {
      this.handlers.get(channel)?.delete(handler);
      if (this.handlers.get(channel)?.size === 0) {
        this.connections.get(channel)?.close();
        this.connections.delete(channel);
        this.handlers.delete(channel);
      }
    };
  }

  disconnect(channel: string): void {
    this.connections.get(channel)?.close();
    this.connections.delete(channel);
    this.handlers.delete(channel);
  }

  disconnectAll(): void {
    for (const [channel] of this.connections) {
      this.disconnect(channel);
    }
  }
}
