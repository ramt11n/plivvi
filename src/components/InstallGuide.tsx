import {
  ArrowDown,
  ArrowUpRight,
  Check,
  Download,
  Menu,
  MonitorDown,
  Plus,
  Share2,
  Smartphone,
} from 'lucide-react';

type Platform =
  'ios' | 'android' | 'mac-safari' | 'desktop-chromium' | 'desktop-firefox' | 'desktop-other';

export function installPlatform(ua: string, touchPoints = 0): Platform {
  if (/iPad|iPhone|iPod/i.test(ua) || (/Macintosh/i.test(ua) && touchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Macintosh/i.test(ua) && /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR/i.test(ua))
    return 'mac-safari';
  if (/Firefox/i.test(ua)) return 'desktop-firefox';
  if (/Chrome|Chromium|Edg|OPR|Opera|Brave/i.test(ua)) return 'desktop-chromium';
  return 'desktop-other';
}

export default function InstallGuide({
  installEvent,
  onPrompt,
}: {
  installEvent?: { prompt: () => Promise<unknown> } | null;
  onPrompt: () => void;
}) {
  const ua = navigator.userAgent,
    platform = installPlatform(ua, navigator.maxTouchPoints);
  const isIPad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const steps =
    platform === 'ios'
      ? [
          {
            icon: Smartphone,
            title: 'Open in Safari',
            detail: 'Visit plivvi.pages.dev in Safari on this iPhone or iPad.',
          },
          {
            icon: Share2,
            title: 'Tap Share',
            detail: isIPad
              ? 'Tap the Share button in Safari’s toolbar.'
              : 'Tap Page Menu, then Share. Some Safari layouts show Share directly.',
          },
          {
            icon: Plus,
            title: 'Add to Home Screen',
            detail:
              'Scroll the Share menu if needed. Turn on Open as Web App if shown, then tap Add.',
          },
        ]
      : platform === 'android'
        ? [
            {
              icon: Menu,
              title: 'Open browser menu',
              detail: 'In Chrome or your browser, tap ⋮ or the menu button.',
            },
            {
              icon: Download,
              title: 'Install app',
              detail: 'Choose Install app or Add to Home screen.',
            },
            {
              icon: Check,
              title: 'Launch Plivvi',
              detail: 'Open the new icon from your app list or Home screen.',
            },
          ]
        : platform === 'mac-safari'
          ? [
              {
                icon: Share2,
                title: 'Open File menu',
                detail: 'In Safari on Mac, choose File in the menu bar.',
              },
              {
                icon: Plus,
                title: 'Add to Dock',
                detail: 'Choose Add to Dock and confirm the name.',
              },
            ]
          : platform === 'desktop-firefox'
            ? [
                {
                  icon: Menu,
                  title: 'Open browser menu',
                  detail:
                    'Firefox desktop does not offer the same native install prompt as Chromium.',
                },
                {
                  icon: MonitorDown,
                  title: 'Keep a shortcut',
                  detail:
                    'Bookmark this page, or create a desktop shortcut using your operating system.',
                },
              ]
            : platform === 'desktop-chromium'
              ? [
                  {
                    icon: Download,
                    title: 'Use the install control',
                    detail:
                      'Look for the install icon in the address bar, or open the browser menu.',
                  },
                  {
                    icon: Plus,
                    title: 'Choose Install',
                    detail:
                      'Chrome, Edge, and Opera may label the command Install app or Save and share.',
                  },
                ]
              : [
                  {
                    icon: Menu,
                    title: 'Open browser menu',
                    detail: 'Look for Install app, Add to Dock, or Create shortcut.',
                  },
                  {
                    icon: ArrowUpRight,
                    title: 'Keep it close',
                    detail: 'You can always bookmark plivvi.pages.dev.',
                  },
                ];
  return (
    <div className="install-guide">
      {standalone ? (
        <div className="install-done">
          <Check size={22} />
          <div>
            <strong>Plivvi is already installed here.</strong>
            <p>Open it from your Home Screen, Dock, or app launcher.</p>
          </div>
        </div>
      ) : (
        <>
          <p className="install-intro">
            Your free document workshop can live one tap away. Here are the steps for this{' '}
            {platform === 'ios'
              ? isIPad
                ? 'iPad'
                : 'iPhone'
              : platform === 'android'
                ? 'Android device'
                : 'browser'}
            .
          </p>
          {installEvent && (
            <button className="button primary full" onClick={onPrompt}>
              <Download size={17} />
              Install Plivvi now
            </button>
          )}
          <ol className="install-steps">
            {steps.map((step, i) => (
              <li key={step.title}>
                <span className="install-step-icon">
                  <step.icon size={22} />
                </span>
                <div>
                  <b>{String(i + 1).padStart(2, '0')}</b>
                  <strong>{step.title}</strong>
                  <p>{step.detail}</p>
                </div>
                <ArrowDown size={15} />
              </li>
            ))}
          </ol>
          <p className="install-offline">
            The app shell is available offline after loading. Large tools and OCR languages may need
            one online visit before they are cached.
          </p>
        </>
      )}
    </div>
  );
}
