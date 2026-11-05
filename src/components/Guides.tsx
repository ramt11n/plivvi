import { ArrowRight, BookOpen } from 'lucide-react';
import { InternalLink } from './PublicPages';
import { guideContent, guidePath, toolPath } from '../seo/routes';
import { tools } from '../lib/catalog';
import './guides.css';

export default function Guides({ id }: { id?: keyof typeof guideContent }) {
  const guide = id ? guideContent[id] : undefined;
  const sample = id === 'pencil-notebooks' ? guideContent['pencil-notebooks'].sample : undefined;
  if (!guide)
    return (
      <article className="public-page guide-index">
        <span className="eyebrow">A LITTLE GUIDANCE</span>
        <h1>A useful way through the paperwork.</h1>
        <p className="public-lead">
          Practical workflows, clear instructions, and a few things to check before sharing the
          result.
        </p>
        <div className="guide-cards">
          {Object.entries(guideContent).map(([key, item]) => (
            <InternalLink key={key} href={guidePath(key as keyof typeof guideContent)}>
              <BookOpen size={22} />
              <h2>{item.heading}</h2>
              <p>{item.description}</p>
              <span>
                Read the guide <ArrowRight size={16} />
              </span>
            </InternalLink>
          ))}
        </div>
      </article>
    );
  return (
    <article className="public-page workflow-guide">
      <nav aria-label="Breadcrumbs">
        <InternalLink href="/guides/">Guides</InternalLink>
        <span>/</span>
        <span>{guide.heading}</span>
      </nav>
      <span className="eyebrow">FREE TOOLS. PRACTICAL GUIDANCE.</span>
      <h1>{guide.heading}</h1>
      <p className="public-lead">{guide.intro}</p>
      <p className="guide-byline">
        By <a href="https://github.com/ramt11n">Ramtin Neshatvar</a> · Updated{' '}
        <time dateTime={guide.updated}>5 November 2026</time>
      </p>
      <section className="guide-steps">
        <h2>Get started</h2>
        <ol>
          {guide.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      <nav className="guide-actions" aria-label="Tools for this guide">
        {guide.toolIds.map((toolId) => {
          const tool = tools.find((item) => item.id === toolId)!;
          return (
            <InternalLink key={toolId} href={toolPath(toolId)} className="button secondary">
              {tool.title}
              <ArrowRight size={15} />
            </InternalLink>
          );
        })}
        {id === 'pencil-notebooks' && (
          <InternalLink href="/notebooks/" className="button primary">
            Start a free notebook <ArrowRight size={15} />
          </InternalLink>
        )}
        {id === 'persian-arabic-ocr' && (
          <>
            <InternalLink href="/persian-ocr/" className="button primary">
              Persian OCR
            </InternalLink>
            <InternalLink href="/arabic-ocr/" className="button secondary">
              Arabic OCR
            </InternalLink>
          </>
        )}
      </nav>
      {guide.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </section>
      ))}
      {sample && (
        <a className="button secondary" href={sample.href} download>
          {sample.label}
          <ArrowRight size={15} />
        </a>
      )}
      <section className="guide-next">
        <h2>Keep going</h2>
        <InternalLink href="/guides/">
          Browse all practical guides <ArrowRight size={15} />
        </InternalLink>
        <InternalLink href="/tools/">
          Explore all free tools <ArrowRight size={15} />
        </InternalLink>
      </section>
    </article>
  );
}
