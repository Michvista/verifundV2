import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const featureCards = [
  {
    title: 'Verified cooperative onboarding',
    text: 'Create cooperative records with audit trails.',
  },
  {
    title: 'Multi-signature withdrawals',
    text: 'Control large disbursements with approvals.',
  },
  {
    title: 'Explainable risk monitoring',
    text: 'Spot fraud signals before funds move.',
  },
];

export function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Primary">
        <Link to="/" className="landing-brand" aria-label="VeriFund home">
          VeriFund
        </Link>
        <div className="landing-nav__links">
          <Link to="/">Home</Link>
          <a href="#features">Features</a>
          <a href="#about">About Us</a>
          <a href="#contact">Contact</a>
        </div>
        <div className="landing-nav__actions">
          <Link to="/public/lookup">Lookup</Link>
          <Link to="/whistleblower">Report</Link>
          <Link to={isAuthenticated ? '/dashboard' : '/login'}>
            {isAuthenticated ? 'Dashboard' : 'Login'}
          </Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero__copy page-reveal">
          <h1>Building Trust in Every Contribution</h1>
          <p>VeriFund helps cooperatives manage money, approvals, and risk in one place.</p>
          <div className="landing-hero__actions">
            <Link className="button button--primary" to={isAuthenticated ? '/dashboard' : '/onboard'}>
              {isAuthenticated ? 'Open Dashboard' : 'Join a Cooperative'}
            </Link>
            <Link className="button button--ghost" to="/cooperative/trust-score">
              View Demo
            </Link>
          </div>
        </div>

        <div className="landing-visual page-reveal" aria-label="Secure cooperative finance preview">
          <div className="landing-visual__glass">
            <div className="landing-visual__bars">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="landing-visual__line" />
          </div>
          <div className="landing-visual__people">
            <span />
            <span />
            <span />
          </div>
          <div className="landing-visual__base" />
        </div>
      </section>

      <section className="landing-section" id="features">
        <div className="landing-section__intro">
          <h2>Institutional Security. Agile Execution.</h2>
          <p>Built to keep cooperative operations simple and controlled.</p>
        </div>

        <div className="landing-feature-grid">
          {featureCards.map((item) => (
            <article key={item.title} className="landing-feature-card">
              <div className="landing-feature-card__icon" />
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-split" id="about">
        <div>
          <h2>Transparent treasury operations for member-owned finance.</h2>
        </div>
        <p>Track approvals, balances, and risk without extra complexity.</p>
      </section>

      <section className="landing-contact" id="contact">
        <div>
          <h2>Ready to protect your cooperative treasury?</h2>
        </div>
        <div className="landing-contact__actions">
          <Link className="button button--primary" to="/onboard">
            Get Started
          </Link>
          <Link className="button button--ghost" to="/public/lookup">
            Public Lookup
          </Link>
        </div>
      </section>
    </main>
  );
}
