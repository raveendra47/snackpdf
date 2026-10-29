"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type OfflineState = "checking" | "preparing" | "ready" | "failed" | "unsupported";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function subscribeToConnection(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getConnectionSnapshot(): boolean {
  return navigator.onLine;
}

function getServerConnectionSnapshot(): boolean {
  return true;
}

export function ServiceWorkerRegistration() {
  const [updateReady, setUpdateReady] = useState<ServiceWorker | null>(null);
  const [offlineState, setOfflineState] = useState<OfflineState>("checking");
  const isOnline = useSyncExternalStore(subscribeToConnection, getConnectionSnapshot, getServerConnectionSnapshot);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [jobActive, setJobActive] = useState(false);

  useEffect(() => {
    let disposed = false;
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => setInstallPrompt(null);
    const handleJobState = (event: Event) => {
      setJobActive(Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active));
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener("snackpdf:job-state", handleJobState);

    const removeListeners = () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("snackpdf:job-state", handleJobState);
    };

    if (!("serviceWorker" in navigator)) {
      queueMicrotask(() => {
        if (!disposed) setOfflineState("unsupported");
      });
      return removeListeners;
    }

    let registrationStarted = false;

    const checkCache = async (worker: ServiceWorker | null): Promise<boolean> => {
      if (!worker) return false;
      const channel = new MessageChannel();
      const response = new Promise<boolean>((resolve) => {
        const timeout = window.setTimeout(() => resolve(false), 5_000);
        channel.port1.onmessage = (event) => {
          window.clearTimeout(timeout);
          resolve(event.data?.type === "CACHE_STATUS" && event.data.ready === true);
        };
      });
      worker.postMessage({ type: "CACHE_STATUS" }, [channel.port2]);
      const ready = await response;
      if (!disposed) setOfflineState(ready ? "ready" : "failed");
      return ready;
    };

    const watchInstallingWorker = (worker: ServiceWorker, hasActiveWorker: boolean) => {
      setOfflineState(hasActiveWorker ? "ready" : "preparing");
      worker.addEventListener("statechange", () => {
        if (disposed) return;
        if (worker.state === "installed") {
          if (hasActiveWorker) setUpdateReady(worker);
          else void checkCache(worker);
        }
        if (worker.state === "redundant" && !hasActiveWorker) setOfflineState("failed");
      });
    };

    const registerWorker = () => {
      if (disposed || registrationStarted) return;
      registrationStarted = true;
      setOfflineState("preparing");
      navigator.serviceWorker.register("/service-worker.js", { scope: "/", updateViaCache: "none" }).then((registration) => {
        if (disposed) return;
        if (registration.waiting) setUpdateReady(registration.waiting);
        if (registration.active) void checkCache(registration.active);
        if (registration.installing) watchInstallingWorker(registration.installing, Boolean(registration.active));
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (worker) watchInstallingWorker(worker, Boolean(registration.active));
        });
        void navigator.serviceWorker.ready.then((readyRegistration) => checkCache(readyRegistration.active));
      }).catch(() => {
        if (!disposed) setOfflineState("failed");
      });
    };

    if (document.readyState === "complete") registerWorker();
    else window.addEventListener("load", registerWorker, { once: true });

    return () => {
      disposed = true;
      window.removeEventListener("load", registerWorker);
      removeListeners();
    };
  }, []);

  const reload = () => {
    if (!updateReady || jobActive || !isOnline) return;
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
    updateReady.postMessage({ type: "SKIP_WAITING" });
  };

  const install = async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    setInstallPrompt(null);
    await prompt.prompt();
    await prompt.userChoice;
  };

  const statusText = (() => {
    if (offlineState === "unsupported") return "Offline support unavailable.";
    if (offlineState === "ready" && !isOnline) return "You are offline. Ready to work offline.";
    if (offlineState === "ready") return "Ready to work offline.";
    if (!isOnline) return "Offline setup is incomplete. Reconnect and reload to finish.";
    if (offlineState === "failed") return "Offline setup failed. Reload while connected to try again.";
    if (offlineState === "preparing") return "Preparing offline use. Keep this page open.";
    return "Checking offline setup.";
  })();

  return (
    <div className={`site-notice offline-${offlineState}`} aria-live="polite">
      <span className="offline-status-line"><span className="offline-dot" aria-hidden="true" /><strong>{statusText}</strong></span>
      {updateReady ? (
        <span className="notice-line">A new version is ready. <button className="link-button" type="button" disabled={jobActive || !isOnline} onClick={reload}>Reload</button>{jobActive ? " after this job finishes or is cancelled." : !isOnline ? " after reconnecting." : ""}</span>
      ) : null}
      {installPrompt ? (
        <span className="notice-line"><button className="link-button" type="button" onClick={() => void install()}>Install SnackPDF</button> <span>- optional. It also works in this browser.</span></span>
      ) : null}
    </div>
  );
}
