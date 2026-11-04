import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, Copy, Heart, Search, Wallet } from 'lucide-react';
import { donationRoutes, trustWalletLink } from './model';
import './donations.css';
export default function DonatePanel() {
  const [tab, setTab] = useState<'usdt' | 'all'>('usdt');
  const [query, setQuery] = useState('');
  const [selectedId, select] = useState('');
  const [qr, setQr] = useState<{ id: string; data: string }>();
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');
  const selected = donationRoutes.find((route) => route.id === selectedId);
  const filtered = donationRoutes.filter(
    (route) =>
      (tab === 'all' || route.asset === 'USDT') &&
      `${route.asset} ${route.network} ${route.standard}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  useEffect(() => {
    setError('');
    if (!selected) return;
    let alive = true;
    import('qrcode')
      .then((qrCode) =>
        qrCode.toDataURL(trustWalletLink(selected), {
          width: 240,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#1a233b', light: '#ffffff' },
        }),
      )
      .then((data) => {
        if (alive) setQr({ id: selected.id, data });
      })
      .catch(() => {
        if (alive)
          setError('The QR code could not load. You can still copy the receiving address.');
      });
    return () => {
      alive = false;
    };
  }, [selected]);
  return (
    <section className="donate-panel" id="donate" aria-labelledby="donate-title">
      <div className="donate-intro">
        <span className="donate-heart">
          <Heart />
        </span>
        <span className="eyebrow">A LITTLE SUPPORT. A LOT MORE POSSIBILITY.</span>
        <h2 id="donate-title">
          Keep good <br />
          <em>tools free.</em>
        </h2>
        <p>
          Help Ramtin maintain Plivvi, test more devices, and make everyday document work a little
          easier.
        </p>
        <span className="donate-promise">
          Every feature stays free. Giving is entirely optional.
        </span>
      </div>
      <div className="donate-picker">
        <div className="donate-tabs" role="group" aria-label="Donation assets">
          <button
            aria-pressed={tab === 'usdt'}
            onClick={() => {
              setTab('usdt');
              select('');
            }}
          >
            USDT · 5 networks
          </button>
          <button
            aria-pressed={tab === 'all'}
            onClick={() => {
              setTab('all');
              select('');
            }}
          >
            All crypto · {donationRoutes.length}
          </button>
        </div>
        <label className="donate-search">
          <Search size={17} />
          <input
            aria-label="Find a donation asset or network"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              select('');
            }}
            placeholder="Find a token or network…"
          />
        </label>
        <p className="donate-step">1. Choose the network used by your sending wallet.</p>
        <div className="donate-networks">
          {filtered.map((route) => (
            <button
              key={route.id}
              aria-pressed={selectedId === route.id}
              onClick={() => select(route.id)}
            >
              <span className="donate-token">
                {route.asset === 'USDT' ? '₮' : route.asset.slice(0, 2)}
              </span>
              <span>
                <strong>
                  {route.asset} · {route.network}
                </strong>
                <small>{route.standard}</small>
              </span>
              {selectedId === route.id && <Check size={17} />}
            </button>
          ))}
        </div>
        {!filtered.length && (
          <p className="donate-empty">No matching receiving route. Try another token or network.</p>
        )}
        {selected ? (
          <div className="donate-receive" key={selected.id}>
            <p className="donate-step">2. Scan, open Trust Wallet, or copy the address.</p>
            <div className="donate-qr-row">
              {qr?.id === selected.id ? (
                <img
                  src={qr.data}
                  width="184"
                  height="184"
                  alt={`Trust Wallet payment QR for ${selected.asset} on ${selected.network}`}
                />
              ) : (
                <div className="donate-qr-placeholder" role="status">
                  Preparing QR…
                </div>
              )}
              <div>
                <strong>
                  {selected.asset} on {selected.network}
                </strong>
                <p>Any amount is welcome. You choose the amount in your wallet.</p>
                <a
                  className="button primary"
                  href={trustWalletLink(selected)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Wallet size={16} />
                  Open Trust Wallet <ArrowUpRight size={15} />
                </a>
              </div>
            </div>
            <label className="donate-address-label">
              Receiving address · {selected.network}
              <input
                readOnly
                aria-label={`Receiving address for ${selected.asset} on ${selected.network}`}
                value={selected.address}
                onFocus={(event) => event.target.select()}
              />
            </label>
            <button
              className="button secondary donate-copy"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(selected.address);
                  setCopied(selected.id);
                  setError('');
                } catch {
                  setError('Select the receiving address above and copy it manually.');
                }
              }}
            >
              {copied === selected.id ? <Check size={16} /> : <Copy size={16} />}
              {copied === selected.id ? 'Address copied' : 'Copy receiving address'}
            </button>
            <small className="donate-network-note">
              Send only {selected.asset} using {selected.network} ({selected.standard}). The QR
              opens the same asset and receiving address shown here.
            </small>
            <p className="donate-local">
              Direct to the maker’s wallet. No account or wallet connection on Plivvi.
            </p>
          </div>
        ) : (
          <div className="donate-unselected">
            <Wallet size={25} />
            <p>Select a network to see its receiving address.</p>
          </div>
        )}
        {error && (
          <p role="alert" className="error-banner">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
