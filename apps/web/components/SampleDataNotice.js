export default function SampleDataNotice({ compact = false }) {
  return (
    <aside className={compact ? 'sample-notice sample-notice-compact' : 'sample-notice'} role="note">
      <span className="sample-notice-icon" aria-hidden="true">✦</span>
      <p>
        <strong>Sample data mode.</strong>{' '}
        This preview uses a shared contract fixture, not a live directory. No place information here is a real-world verification.
      </p>
    </aside>
  );
}
