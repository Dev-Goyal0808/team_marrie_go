import Link from 'next/link';

function AccessMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span className="brand-mark-bar brand-mark-bar-one" />
      <span className="brand-mark-bar brand-mark-bar-two" />
      <span className="brand-mark-dot" />
    </span>
  );
}

export default function SiteHeader({ active = '' }) {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="AccessMap home">
          <AccessMark />
          <span>AccessMap</span>
        </Link>
        <nav className="primary-nav" aria-label="Primary navigation">
          <Link className={active === 'explore' ? 'nav-link nav-link-active' : 'nav-link'} href="/search">
            Explore places
          </Link>
          <Link className={active === 'profile' ? 'nav-link nav-link-active' : 'nav-link'} href="/profile">
            My access profile
          </Link>
          <Link className="nav-link nav-link-quiet" href="/#how-it-works">
            How it works
          </Link>
        </nav>
      </div>
    </header>
  );
}
