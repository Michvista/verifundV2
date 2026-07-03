import type http from 'http';
import { WebSocketServer } from 'ws';

type FeedEvent = {
  type: string;
  message: string;
  timestamp: string;
  payload?: Record<string, unknown>;
};

let wss: WebSocketServer | null = null;

export function attachRealtime(server: http.Server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (socket) => {
    socket.send(JSON.stringify({
      type: 'connected',
      message: 'VeriFund live feed connected',
      timestamp: new Date().toISOString(),
    }));
  });
}

export function broadcastFeedEvent(event: FeedEvent) {
  if (!wss) return;
  const serialized = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(serialized);
    }
  }
}
