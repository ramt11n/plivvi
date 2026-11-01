import { Component, type ReactNode } from 'react';
import Brand from './Brand';

export default class WorkspaceRecovery extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const error = this.state.error;
    if (!error) return this.props.children;
    const updated =
      /dynamically imported module|module script|loading chunk|importing a module/i.test(
        error.message,
      );
    return (
      <main className="workspace-recovery">
        <section className="workspace-recovery-card" role="alert">
          <Brand />
          <h1>Let’s get your workspace back.</h1>
          <p>
            {updated
              ? 'Plivvi updated while this tab was open. Reload to open the latest editor.'
              : 'Something interrupted this view. Reload to try again.'}
          </p>
          <button className="button primary" onClick={() => window.location.reload()}>
            Reload Plivvi
          </button>
          <small>
            Saved documents stay in this browser. Recent unsaved edits may need to be repeated.
          </small>
        </section>
      </main>
    );
  }
}
