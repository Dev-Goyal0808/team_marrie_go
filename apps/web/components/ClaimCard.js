import StatusBadge from './StatusBadge';
import { formatObservedDate, labelForFeature } from '../lib/fixture-client';

export default function ClaimCard({ claim, explanationItem }) {
  return (
    <details className="claim-card" open={claim.status === 'recently_observed'}>
      <summary>
        <span className="claim-summary-main">
          <span className="feature-icon" aria-hidden="true">↗</span>
          <span>
            <strong>{labelForFeature(claim.featureCode)}</strong>
            <span className="claim-summary-meta">{claim.status === 'recently_observed' ? 'Available based on recent information' : 'Information status'}</span>
          </span>
        </span>
        <StatusBadge status={claim.status}>{claim.status === 'recently_observed' ? 'Recently observed' : claim.status}</StatusBadge>
      </summary>
      <div className="claim-detail">
        <dl className="detail-list">
          <div><dt>Status</dt><dd>Feature-level information, not an overall accessibility label</dd></div>
          <div><dt>Source</dt><dd>{claim.source === 'community_observation' ? 'Community observation' : claim.source}</dd></div>
          <div><dt>Observed</dt><dd>{formatObservedDate(claim.observedAt)}</dd></div>
          <div><dt>Support</dt><dd>{claim.supportingCount} supporting observations · {claim.disputingCount} disputes</dd></div>
        </dl>
        {explanationItem ? (
          <div className="claim-explanation">
            <span className="info-icon" aria-hidden="true">i</span>
            <p>This claim is used in the sample match explanation: {explanationItem.reason}.</p>
          </div>
        ) : null}
      </div>
    </details>
  );
}
