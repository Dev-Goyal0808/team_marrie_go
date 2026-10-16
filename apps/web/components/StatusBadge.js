const toneByStatus = {
  recently_observed: 'status-positive',
  community_observation: 'status-neutral',
  not_assessed: 'status-unknown',
  temporarily_unavailable: 'status-warning',
  published: 'status-warning',
  pending: 'status-pending',
  needs_more_information: 'status-unknown'
};

export default function StatusBadge({ status, children }) {
  const tone = toneByStatus[status] ?? 'status-neutral';
  return <span className={`status-badge ${tone}`}><span aria-hidden="true" className="status-dot" />{children ?? status.replaceAll('_', ' ')}</span>;
}
