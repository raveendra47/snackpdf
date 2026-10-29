import { ServiceWorkerRegistration } from "./service-worker-registration";

export function SiteFrame({ children, showOfflineStatus = true }: { children: React.ReactNode; showOfflineStatus?: boolean }) {
  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="site-page site-header-inner">
          <a className="brand" href="/" aria-label="SnackPDF home">
            <span className="brand-mark" aria-hidden="true">S</span>
            <span className="wordmark">SnackPDF</span>
          </a>
          <nav className="site-nav" aria-label="Primary navigation">
            <a href="/">All tools</a>
            <a href="/privacy">Privacy</a>
            <a href="/guides/compress-pdf-without-uploading">Guides</a>
            <a href="/about">About</a>
            <a className="support-link" href="/support">Support SnackPDF</a>
          </nav>
        </div>
      </header>
      {showOfflineStatus ? <div className="site-wide-offline"><ServiceWorkerRegistration /></div> : null}
      {children}
      <footer className="site-footer">
        <div className="site-page site-footer-inner">
          <a className="brand footer-brand" href="/" aria-label="SnackPDF home">
            <span className="brand-mark" aria-hidden="true">S</span>
            <span className="wordmark">SnackPDF</span>
          </a>
          <nav className="footer-links" aria-label="Site information">
            <a href="/">All tools</a>
            <a href="/offline-use">Offline help</a>
            <a href="/how-snackpdf-is-tested">How we test</a>
            <a href="/about">About</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/support">Support</a>
            <a href="/open-source-licences">Source and licences</a>
            <span>SnackPDF is listed by <a href="https://dialegein.com">Dialegein</a>, an independent PDF-tools index.</span>
          </nav>
        </div>
      </footer>
    </div>
  );
}
