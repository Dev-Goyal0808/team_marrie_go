import Link from 'next/link';
import StatusBadge from './StatusBadge';

export default function MatchSummary({ explanation, profileLink = '/profile' }) {
  const required = explanation.required;
  const preferred = explanation.preferred;

  return (
    <section className="match-summary" aria-labelledby="match-summary-title">
      <div className="match-summary-heading">
        <div>
          <p className="section-label">Your access profile</p>
          <h2 id="match-summary-title">Accessibility match</h2>
        </div>
        <StatusBadge status={explanation.decision}>Needs more information</StatusBadge>
      </div>
      <p className="match-summary-lede">The sample explanation keeps unknown information visible instead of treating it as a match or a failure.</p>
      <div className="match-count-grid">
        <div className="match-count match-count-confirmed"><strong>{required.confirmed}</strong><span>of {required.total} required confirmed</span></div>
        <div className="match-count match-count-unknown"><strong>{required.unknown}</strong><span>required unknown</span></div>
        <div className="match-count match-count-preferred"><strong>{preferred.confirmed}</strong><span>preferred confirmed</span></div>
      </div>
      <div className="match-summary-footer">
        <p><span className="info-icon" aria-hidden="true">i</span> A required feature that has not been assessed cannot count as confirmed.</p>
        <Link className="text-link" href={profileLink}>Edit private profile <span aria-hidden="true">→</span></Link>
      </div>
    </section>
  );
}
