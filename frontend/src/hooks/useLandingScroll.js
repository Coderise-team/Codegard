import { createContext, useContext } from 'react';

/**
 * The element the landing scrolls inside.
 *
 * The app shell keeps `body` from scrolling and lets each page own its scroll
 * area, so anything on the landing that reacts to scrolling has to listen on
 * that element instead of on `window`. LandingPage publishes the node here
 * once React has mounted it; consumers get `null` on the first render and
 * attach their listeners when it arrives.
 */
export const LandingScrollContext = createContext(null);

export const useLandingScroll = () => useContext(LandingScrollContext);
