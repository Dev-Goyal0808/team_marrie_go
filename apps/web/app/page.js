import Link from 'next/link';

const principles = [
  {
    title: 'Feature-level information',
    text: 'See concrete details such as step-free entrances, working lifts, and accessible toilets.'
  },
  {
    title: 'Dates and sources',
    text: 'Understand when information was observed and whether it came from a visitor or facility.'
  },
  {
    title: 'Uncertainty stays visible',
    text: 'Unknown information is never presented as a confirmed match or a universal score.'
  }
];

export default function HomePage() {
  return (
    <main>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="site-header">
        <div className="shell header-inner">
          <Link className="brand" href="/" aria-label="AccessMap home">
            AccessMap
          </Link>
          <nav aria-label="Primary navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#principles">Principles</a>
          </nav>
        </div>
      </header>

      <div id="main-content">
        <section className="hero" aria-labelledby="hero-title">
          <div className="shell hero-grid">
            <div>
              <p className="eyebrow">Community-verified access information</p>
              <h1 id="hero-title">Plan your visit with clearer accessibility information.</h1>
              <p className="hero-copy">
                AccessMap helps people understand whether a public place is likely to meet their own access needs before they travel.
              </p>
              <div className="hero-actions">
                <a className="button button-primary" href="#search">
                  Explore places
                </a>
                <a className="button button-secondary" href="#how-it-works">
                  Learn how it works
                </a>
              </div>
            </div>

            <aside className="trust-card" aria-label="AccessMap information promise">
              <p className="card-kicker">AccessMap promise</p>
              <h2>Unknown is different from unavailable.</h2>
              <p>
                Every useful claim includes its source, date, and current status so you can make a decision with the information that is actually known.
              </p>
            </aside>
          </div>
        </section>

        <section className="search-section" id="search" aria-labelledby="search-title">
          <div className="shell search-card">
            <div>
              <p className="eyebrow">Start with a place</p>
              <h2 id="search-title">Find a facility near you</h2>
              <p>Search and browse will connect to the real place API in the next backend slice.</p>
            </div>
            <form className="search-form" action="#search" role="search">
              <label htmlFor="place-search">Place, category, or city</label>
              <div className="search-controls">
                <input id="place-search" name="query" type="search" placeholder="e.g. library or community centre" />
                <button className="button button-primary" type="submit">
                  Search
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className="content-section" id="how-it-works" aria-labelledby="how-title">
          <div className="shell">
            <p className="eyebrow">Built for informed decisions</p>
            <h2 id="how-title">Information that reflects real access needs</h2>
            <div className="principles-grid" id="principles">
              {principles.map((principle) => (
                <article className="principle-card" key={principle.title}>
                  <h3>{principle.title}</h3>
                  <p>{principle.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>

      <footer className="site-footer">
        <div className="shell footer-inner">
          <p>AccessMap is being built as a community-verified accessibility platform.</p>
          <p>Sample interface — no place data is connected yet.</p>
        </div>
      </footer>
    </main>
  );
}
