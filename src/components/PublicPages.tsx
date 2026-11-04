import { lazy, Suspense } from 'react';
import LoadingProgress from './LoadingProgress';
const DonatePanel = lazy(() => import('../donations/DonatePanel'));
import {
  ArrowRight,
  ArrowUpRight,
  Code2,
  Heart,
  Mail,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { brand, maker, repoUrl, sourceUrl } from '../integrations/config';
import {
  navigateTo,
  relatedTools,
  toolContent,
  toolPath,
  featureContent,
  type ToolContent,
} from '../seo/routes';
import type { Tool } from '../lib/catalog';
import Icon from './Icon';
import Brand from './Brand';
export function InternalLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigateTo(href);
      }}
    >
      {children}
    </a>
  );
}
export function SponsorPlacement() {
  return (
    <aside className="sponsor-placement" aria-label="Support this free project">
      <span className="sponsor-heart">
        <Heart size={18} />
      </span>
      <div>
        <strong>Every tool stays free. Help keep it that way.</strong>
        <p>Help improve Plivvi, fix bugs, and keep useful tools free for everyone.</p>
      </div>
      <InternalLink href="/support/">
        Support improvements <Heart size={15} />
      </InternalLink>
      <small>Optional support</small>
    </aside>
  );
}
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div>
          <Brand />
          <p>
            A little less paperwork.
            <br />
            Free tools. Open source. Vibe coded.
          </p>
        </div>
        <div>
          <h3>The workshop</h3>
          <InternalLink href="/pdf-reader/">PDF reader & editor</InternalLink>
          <InternalLink href="/tools/">All document tools</InternalLink>
          <InternalLink href="/templates/">Document layouts</InternalLink>
        </div>
        <div>
          <h3>Make it better</h3>
          <a href={repoUrl || sourceUrl} target={repoUrl ? '_blank' : undefined} rel="noreferrer">
            {repoUrl ? 'Contribute on GitHub' : 'Download source'}
          </a>
          <InternalLink href="/support/">Donate · improve Plivvi</InternalLink>
          <InternalLink href="/contact/">Contact Ramtin</InternalLink>
        </div>
        <div>
          <h3>Good to know</h3>
          <InternalLink href="/about/">About & vibe coding</InternalLink>
          <InternalLink href="/privacy/">Privacy</InternalLink>
          <a href="/LICENSE.txt" target="_blank" rel="noreferrer">
            Open-source license
          </a>
        </div>
      </div>
      <div className="footer-story">
        <strong>A little imagination. A lot of possibility.</strong>
        <p>
          Plivvi (PLIV-ee): <b>P</b>ages, <b>L</b>ines, <b>I</b>deas, <b>V</b>ision, <b>V</b>
          ersatility, <b>I</b>magination. An invented name for the way we make documents our own.
        </p>
        <button
          className="text-button"
          onClick={() => window.dispatchEvent(new Event('plivvi:report'))}
        >
          Report a bug · help us improve
        </button>
      </div>
      <div className="footer-bottom">
        <span>
          Made by{' '}
          <a href={maker.github} target="_blank" rel="noreferrer">
            Ramtin Neshatvar <ArrowUpRight size={11} />
          </a>
        </span>
        <span>
          <ShieldCheck size={13} />
          Documents stay on your device unless you choose cloud sharing.
        </span>
        <span>AGPL-3.0-or-later</span>
      </div>
    </footer>
  );
}
export function ToolLanding({
  tool,
  onStart,
  content,
}: {
  tool: Tool;
  onStart: () => void;
  content?: ToolContent;
}) {
  const data = content ?? toolContent[tool.id];
  if (!data) return null;
  return (
    <article className="tool-landing">
      <div className="tool-landing-hero">
        <span className={`tool-icon ${tool.color}`}>
          <Icon name={tool.icon} size={29} />
        </span>
        <span className="eyebrow">FREE. OPEN SOURCE. ON YOUR DEVICE.</span>
        <h1>{data.title.split(' — ')[0]}</h1>
        <p>{data.description}</p>
        <button className="button primary" onClick={onStart}>
          {tool.id === 'reader' ? 'Open your reading nook' : tool.action}
          <ArrowRight size={17} />
        </button>
        <div className="landing-trust">
          <span>
            <ShieldCheck size={14} />
            Local processing
          </span>
          <span>
            <Code2 size={14} />
            Open source
          </span>
          <span>
            <Heart size={14} />
            No feature paywalls
          </span>
        </div>
      </div>
      {Object.values(featureContent).some((f) => f.toolId === tool.id) && (
        <nav className="feature-quick-links" aria-label="Specific workflows">
          {Object.values(featureContent)
            .filter((f) => f.toolId === tool.id && f.slug !== data.slug)
            .map((f) => (
              <InternalLink key={f.slug} href={'/' + f.slug + '/'}>
                {f.title.split(' — ')[0]} <ArrowRight size={13} />
              </InternalLink>
            ))}
        </nav>
      )}
      <section className="tool-guide">
        <div>
          <span className="eyebrow">A LITTLE GUIDANCE</span>
          <h2>{data.heading}</h2>
          <p>
            {tool.description}{' '}
            {tool.note ??
              'The tool creates a new output and keeps your original file unchanged. Review important documents before sharing them.'}
          </p>
        </div>
        <ol>
          {data.steps.map((step, i) => (
            <li key={step}>
              <span>{i + 1}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="tool-faq">
        <h2>A few useful answers.</h2>
        {data.faqs.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
        <details>
          <summary>Can I use this on a phone or without signing in?</summary>
          <p>
            Yes. {brand.name} adapts to phones, tablets, laptops, and wide desktop screens. You can
            use every document tool as a guest. Camera capture is optional; importing files is
            always available.
          </p>
        </details>
        <details>
          <summary>What works offline?</summary>
          <p>
            Load the app and the tools you need online first, then check offline readiness in
            Settings. Used engines and OCR language packs are cached. Sign-in and cloud storage
            still need an internet connection.
          </p>
        </details>
      </section>
      <SponsorPlacement />
      <section className="related-tools">
        <h2>Keep the good work going.</h2>
        <div>
          {relatedTools(tool.id).map((t) => (
            <InternalLink key={t.id} href={toolPath(t.id)}>
              <Icon name={t.icon} size={20} />
              <span>{t.title}</span>
              <ArrowRight size={16} />
            </InternalLink>
          ))}
        </div>
      </section>
    </article>
  );
}
export function PublicPage({ view }: { view: string }) {
  if (view === 'about')
    return (
      <article className="public-page">
        <span className="eyebrow">SMALL PROJECT. USEFUL PURPOSE.</span>
        <h1>Paperwork deserves a friendlier place.</h1>
        <p className="public-lead">
          {brand.name} is free, open-source, and proudly vibe coded—made by Ramtin Neshatvar with
          AI-assisted development, practical testing, and room for community improvements.
        </p>
        <section>
          <span className="public-icon">
            <Sparkles />
          </span>
          <h2>Vibe coded, with the work in the open.</h2>
          <p>
            AI helps write and refine the software. The source is available to inspect, improve, and
            run yourself under AGPL-3.0-or-later. The project documents its tests, limitations, and
            third-party dependencies. Vibe coding is part of how it is made, not a promise that
            software is flawless.
          </p>
          <a className="button secondary" href={repoUrl || sourceUrl}>
            {repoUrl ? 'Explore the repository' : 'Download the application source'}
            <Code2 size={17} />
          </a>
        </section>
        <section>
          <span className="public-icon mint">
            <ShieldCheck />
          </span>
          <h2>Useful by default. Private by design.</h2>
          <p>
            PDF processing runs in your browser. Your workspace and annotation drafts are local to
            this device. Accounts and cloud connections are optional, and document features stay
            free.
          </p>
          <InternalLink href="/privacy/" className="text-button">
            Read the privacy notes <ArrowRight size={14} />
          </InternalLink>
        </section>
        <section className="maker-card">
          <span className="maker-avatar">RN</span>
          <div>
            <span className="eyebrow">MADE BY</span>
            <h2>Ramtin Neshatvar</h2>
            <p>A personal open-source project built around useful everyday document tasks.</p>
            <div className="maker-links">
              <a href={maker.github} target="_blank" rel="noreferrer">
                GitHub <ArrowUpRight size={14} />
              </a>
              <a href={maker.linkedin} target="_blank" rel="noreferrer">
                LinkedIn <ArrowUpRight size={14} />
              </a>
              <a href={maker.cv} target="_blank" rel="noreferrer">
                CV <ArrowUpRight size={14} />
              </a>
              <a href={`mailto:${maker.email}`}>
                Email <Mail size={14} />
              </a>
            </div>
          </div>
        </section>
      </article>
    );
  if (view === 'privacy')
    return (
      <article className="public-page">
        <span className="eyebrow">CLEAR WORDS. NO FINE-PRINT MAZE.</span>
        <h1>Your paperwork stays yours.</h1>
        <p className="public-lead">
          {brand.name} processes documents in your browser. You choose when to download, save, or
          send a copy to a cloud provider.
        </p>
        <section>
          <h2>Document processing</h2>
          <p>
            Files you open are held in browser memory for processing. PDF, image, and OCR engines
            run on your device. Engine code, fonts, and language packs download from the app’s host
            when needed; your document is not part of those download requests.
          </p>
        </section>
        <section>
          <h2>Local workspace and drafts</h2>
          <p>
            Save to workspace and reader drafts use browser storage. They are specific to the
            current browser and website address. Browser data clearing, private browsing, storage
            pressure, or operating-system cleanup can remove them. Download important copies and
            workspace backups.
          </p>
        </section>
        <section>
          <h2>Optional accounts</h2>
          <p>
            When accounts are enabled, Firebase Authentication handles sign-in, email addresses,
            passwords, and profile information directly. Each signed-in account has a separate
            document library and reader drafts on this browser. Signing in does not upload or
            synchronize your documents. Account availability depends on the deployment’s
            configuration.
          </p>
          <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noreferrer">
            Firebase privacy information <ArrowUpRight size={13} />
          </a>
        </section>
        <section>
          <h2>Cloud connections you choose</h2>
          <p>
            Opening cloud connections may load Google or Microsoft authentication code. If you
            choose a file or save an output, its content is transferred directly between your
            browser and that provider. Google Drive uses access to files you select or create with
            {brand.name}. OneDrive requests delegated file access appropriate to importing or
            saving. Cloud tokens are kept in the current session, not included in exported PDFs or
            application source.
          </p>
        </section>
        <section>
          <h2>Sponsorship and site requests</h2>
          <p>
            The current sponsorship placements are first-party content and email links. There are no
            active advertising-network scripts or behavioral trackers. The hosting provider receives
            normal website request information such as IP address and browser details. External
            links and mail apps have their own privacy practices.
          </p>
        </section>
        <section>
          <h2>Private bug reports</h2>
          <p>The optional report form loads Google Forms only when you choose to open it. Text you submit is stored in the project’s Google account and not published as a public response summary. No document is attached, and email is optional. Google receives normal form request information; its privacy policy applies. You can also choose email or a public GitHub issue.</p>
        </section>
        <section>
          <h2>Contact</h2>
          <p>
            For privacy questions or account requests, contact{' '}
            <a href={`mailto:${maker.email}`}>{maker.email}</a>. Do not email private documents
            unless you intentionally want to share them.
          </p>
        </section>
      </article>
    );
  if (view === 'support')
    return (
      <article className="public-page">
        <span className="eyebrow">SUPPORT THE WORK. KEEP THE TOOLS FREE.</span>
        <h1>A free workshop can still have a future.</h1>
        <p className="public-lead">
          Support the maker with a crypto donation or direct sponsorship. Your gift helps fund
          maintenance and device testing. Every reader, scanner, and PDF feature stays available
          without a subscription.
        </p>
        <Suspense fallback={<LoadingProgress label="Opening donation options…" />}>
          <DonatePanel />
        </Suspense>
        <div className="support-cards">
          <section>
            <Heart />
            <h2>Support the project</h2>
            <p>
              Help keep the open-source workshop maintained. Discuss a community-support credit or
              an ongoing sponsorship.
            </p>
            <a
              href={`mailto:${maker.email}?subject=${encodeURIComponent(`Support ${brand.name}`)}`}
            >
              Talk about support <ArrowRight size={15} />
            </a>
          </section>
          <section>
            <Users />
            <h2>Sponsor a useful tool</h2>
            <p>
              Discuss a clearly labeled placement on a public tool guide. Sponsor content stays away
              from private document views.
            </p>
            <a
              href={`mailto:${maker.email}?subject=${encodeURIComponent(`Sponsor a ${brand.name} tool`)}`}
            >
              Discuss a placement <ArrowRight size={15} />
            </a>
          </section>
          <section>
            <Code2 />
            <h2>Custom workflow help</h2>
            <p>
              Need tailored setup, branding, or a document workflow for your team? Contact Ramtin to
              discuss a separate paid service.
            </p>
            <a href={`mailto:${maker.email}?subject=Custom%20document%20workflow`}>
              Describe your project <ArrowRight size={15} />
            </a>
          </section>
        </div>
        <section>
          <h2>A clear promise.</h2>
          <p>
            Sponsorship does not unlock or restrict document features. There are no invented
            audience numbers, guaranteed impressions, or paid rankings. Scope and pricing are agreed
            directly before any sponsored placement is published.
          </p>
        </section>
        <section>
          <h2>Code is a contribution too.</h2>
          <p>
            Bug reports, thoughtful issues, tests, accessibility improvements, translations, and
            pull requests all help. The project is open source under AGPL-3.0-or-later.
          </p>
          <a className="button secondary" href={repoUrl || sourceUrl}>
            {repoUrl ? 'Contribute on GitHub' : 'Get the source code'}
            <ArrowUpRight size={16} />
          </a>
        </section>
      </article>
    );
  if (view === 'contact')
    return (
      <article className="public-page">
        <span className="eyebrow">A REAL PERSON BEHIND THE WORKSHOP.</span>
        <h1>Say hello to Ramtin.</h1>
        <p className="public-lead">
          Questions, bug reports, sponsorship, or a custom document workflow—send a little context
          and we can start there.
        </p>
        <a className="contact-email" href={`mailto:${maker.email}`}>
          {maker.email}
          <ArrowUpRight size={25} />
        </a>
        <div className="contact-options">
          <a href={`mailto:${maker.email}?subject=${encodeURIComponent(`${brand.name} feedback`)}`}>
            Product feedback <Mail size={18} />
          </a>
          <a
            href={`mailto:${maker.email}?subject=${encodeURIComponent(`${brand.name} sponsorship`)}`}
          >
            Sponsorship <Heart size={18} />
          </a>
          <a href={repoUrl ? repoUrl + '/issues' : maker.github} target="_blank" rel="noreferrer">
            GitHub & contributions <Code2 size={18} />
          </a>
        </div>
        <section>
          <h2>Help me reproduce a bug.</h2>
          <p>
            Include the tool name, browser, device, and steps that led to the problem. If possible,
            use a synthetic or anonymized sample. Please keep passwords, identity documents, and
            other private information out of public issues.
          </p>
        </section>
        <div className="maker-links">
          <a href={maker.github} target="_blank" rel="noreferrer">
            GitHub <ArrowUpRight size={14} />
          </a>
          <a href={maker.linkedin} target="_blank" rel="noreferrer">
            LinkedIn <ArrowUpRight size={14} />
          </a>
          <a href={maker.cv} target="_blank" rel="noreferrer">
            CV <ArrowUpRight size={14} />
          </a>
        </div>
      </article>
    );
  return (
    <article className="public-page">
      <span className="eyebrow">A SMALL DETOUR.</span>
      <h1>This page has moved out of reach.</h1>
      <p className="public-lead">Find a document tool or return to your workspace.</p>
      <InternalLink href="/tools/" className="button primary">
        Explore the tools <ArrowRight size={16} />
      </InternalLink>
    </article>
  );
}
