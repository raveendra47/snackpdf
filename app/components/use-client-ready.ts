"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
/** Prevent native file selection before React has attached its file handler. */
export function useClientReady() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
