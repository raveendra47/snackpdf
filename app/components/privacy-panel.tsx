import { ServiceWorkerRegistration } from "./service-worker-registration";

const facts = [
  ["Processed locally", "Files remain inside your browser tab."],
  ["No account", "Just open a tool and get started."],
  ["No watermark", "Your finished PDF stays yours."],
  ["Available offline", "Prepare once, then work without Wi-Fi."],
] as const;

export function PrivacyPanel({ showOfflineStatus = false }: { showOfflineStatus?: boolean }) {
  return (
    <section className="privacy-panel" id="privacy-panel" aria-labelledby="privacy-panel-heading">
      <div className="privacy-panel-inner">
        <div className="privacy-introduction">
          <span className="kicker">Private by design</span>
          <h2 id="privacy-panel-heading">Your documents are none of our business.</h2>
          <p>Your PDFs stay on this device. SnackPDF processes files on your device rather than sending them to a remote server. That keeps the experience quick, simple and private.</p>
          <a className="privacy-link" href="/privacy">Read how it works</a>
        </div>
        {showOfflineStatus ? <ServiceWorkerRegistration /> : null}
        <dl className="privacy-facts">
          {facts.map(([term, detail]) => (
            <div className="privacy-fact" key={term}>
              <dt>{term}</dt>
              <dd>{detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
