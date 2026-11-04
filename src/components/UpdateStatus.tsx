import { RefreshCw, Wifi, WifiOff, ArrowUpRight } from 'lucide-react';
import type { useAppStatus } from '../lib/appStatus';
export default function UpdateStatus({ app }: { app: ReturnType<typeof useAppStatus> }) {
  const { status, check, apply, reloading } = app;
  return (
    <section className="update-status" aria-label="Connection and updates">
      <div className="setting-row">
        <div>
          <strong>
            {status.state === 'offline' ? <WifiOff size={16} /> : <Wifi size={16} />}{' '}
            {status.state === 'reachable'
              ? 'Plivvi is reachable'
              : status.state === 'checking'
                ? 'Checking connection…'
                : status.state === 'offline'
                  ? 'Offline'
                  : 'Connection needs attention'}
          </strong>
          <span>
            {status.state === 'reachable'
              ? 'Connected to this website. Document processing stays local.'
              : status.state === 'offline'
                ? 'Use tools already cached on this device.'
                : 'Your device may be online while this website or sign-in services are blocked.'}
          </span>
        </div>
        <span className={`network-light ${status.state}`} />
      </div>
      <button
        className="button secondary full"
        disabled={status.state === 'checking'}
        onClick={check}
      >
        <RefreshCw size={16} />
        Check connection & updates
      </button>
      {status.update && (
        <div className="update-ready" role="status">
          <strong>An update is available{status.version ? ' · ' + status.version : ''}</strong>
          <p>Save or download important work before reloading.</p>
          <button className="button primary" disabled={reloading} onClick={apply}>
            {reloading ? 'Preparing update…' : 'Reload to update'}
            <ArrowUpRight size={15} />
          </button>
        </div>
      )}
      {status.state === 'reachable' && !status.update && (
        <p className="small muted">You’re using the current build.</p>
      )}
      {status.error && (
        <p className="small error-banner" role="status">
          {status.error}
        </p>
      )}
      <p className="small muted">
        Changed Wi-Fi or VPN? Check again here. Plivvi never reloads an open document automatically.
      </p>
    </section>
  );
}
