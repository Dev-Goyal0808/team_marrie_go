export default function EmptyState({ query, onClear }) {
  return (
    <section className="empty-state" aria-labelledby="empty-title">
      <div className="empty-state-icon" aria-hidden="true">⌕</div>
      <p className="section-label">No matching sample place</p>
      <h2 id="empty-title">We could not find “{query}”.</h2>
      <p>Try “community centre”, “Pilot District”, or clear the search to browse the available sample place.</p>
      <button className="button button-secondary" type="button" onClick={onClear}>Clear search</button>
    </section>
  );
}
