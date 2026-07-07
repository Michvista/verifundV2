import { Component, type ErrorInfo, type ReactNode } from 'react';
import { removeStorage } from '../services/browserStorage';
import { clearStoredSession } from '../services/session';

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.assign('/');
  };

  handleResetSession = () => {
    clearStoredSession();
    removeStorage('verifund_cooperative_id');
    removeStorage('verifund_virtual_account');
    window.location.assign('/login');
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="app-error">
        <section className="center-card page-reveal">
          <div className="eyebrow">Application Recovery</div>
          <h2>Something went wrong</h2>
          <p>
            The app hit an unexpected state. You can return home, or clear the saved session and
            sign in again.
          </p>
          <div className="stacked-actions" style={{ marginTop: 20 }}>
            <button className="button button--primary button--full" onClick={this.handleReload}>
              Go Home
            </button>
            <button className="button button--ghost button--full" onClick={this.handleResetSession}>
              Reset Session
            </button>
          </div>
        </section>
      </main>
    );
  }
}
