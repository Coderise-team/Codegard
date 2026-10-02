import { useEffect, useState } from 'react';
import { openSignalSocket } from '../api/signalSocket';

// The consumer's answer to a socket without a signed-in user. Reconnecting
// would only mint tickets that the server turns down the same way.
const NOT_AUTHENTICATED = 4001;

/**
 * Subscribes to the signed-in user's notification channel and surfaces WHEN
 * there may be something new, never the notifications themselves: the socket
 * only rings, the unread count and the feed come over HTTP.
 *
 * Returns a counter bumped on every `notification` ring and on every reconnect -
 * rings sent while the line was down are lost, so coming back counts as one.
 * Put it in a useEffect dependency to refetch the count.
 *
 * Only connects while `enabled`.
 */
export function useNotificationsSignal(enabled) {
  const [signal, setSignal] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;

    const bump = () => setSignal((n) => n + 1);

    return openSignalSocket('/ws/notifications/', {
      onMessage: (msg) => {
        if (msg.type === 'notification') bump();
      },
      onOpen: ({ reconnected }) => {
        if (reconnected) bump();
      },
      shouldReconnect: (event) => event?.code !== NOT_AUTHENTICATED,
    });
  }, [enabled]);

  return signal;
}
