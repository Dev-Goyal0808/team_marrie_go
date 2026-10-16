'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import EmptyState from './EmptyState';
import PlaceCard from './PlaceCard';

export default function SearchExperience({ initialQuery, initialPlaces }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [view, setView] = useState('list');
  const [featureFilter, setFeatureFilter] = useState('all');
  const [sort, setSort] = useState('relevance');

  const filteredPlaces = useMemo(() => {
    const places = featureFilter === 'step-free'
      ? initialPlaces.filter((place) => place.claims.some((item) => item.featureCode === 'step_free_entrance'))
      : initialPlaces;

    return [...places].sort((left, right) => {
      if (sort === 'distance') return left.distanceMeters - right.distanceMeters;
      return left.name.localeCompare(right.name);
    });
  }, [featureFilter, initialPlaces, sort]);

  function handleSubmit(event) {
    event.preventDefault();
    const nextQuery = query.trim();
    router.push(nextQuery ? `/search?query=${encodeURIComponent(nextQuery)}` : '/search');
  }

  function clearSearch() {
    setQuery('');
    router.push('/search');
  }

  return (
    <section className="directory-panel" aria-labelledby="results-title">
      <form className="directory-search" onSubmit={handleSubmit} role="search">
        <label htmlFor="directory-search-input">Search places</label>
        <div className="directory-search-controls"><div className="search-input-wrap"><span aria-hidden="true">⌕</span><input id="directory-search-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by place, category, or area" /></div><button className="button button-primary" type="submit">Search</button></div>
      </form>

      <div className="directory-toolbar">
        <div><h2 id="results-title">{filteredPlaces.length} {filteredPlaces.length === 1 ? 'place' : 'places'} found</h2><p>{initialQuery ? <>Showing results for <strong>“{initialQuery}”</strong></> : 'Start with the sample place or try a search above.'}</p></div>
        <div className="toolbar-controls">
          <label htmlFor="feature-filter">Filter</label>
          <select id="feature-filter" value={featureFilter} onChange={(event) => setFeatureFilter(event.target.value)}><option value="all">All information</option><option value="step-free">Step-free entrance observed</option></select>
          <label htmlFor="sort-results">Sort</label>
          <select id="sort-results" value={sort} onChange={(event) => setSort(event.target.value)}><option value="relevance">Relevance</option><option value="distance">Distance</option></select>
        </div>
      </div>

      <div className="view-switcher" role="group" aria-label="Choose results view"><button className={view === 'list' ? 'view-button view-button-active' : 'view-button'} type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}><span aria-hidden="true">☷</span> Accessible list</button><button className={view === 'map' ? 'view-button view-button-active' : 'view-button'} type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}><span aria-hidden="true">⌖</span> Visual preview</button></div>

      {filteredPlaces.length === 0 ? <EmptyState query={initialQuery || query || 'that search'} onClear={clearSearch} /> : null}

      {filteredPlaces.length > 0 && view === 'list' ? <div className="result-list" aria-live="polite">{filteredPlaces.map((place) => <PlaceCard place={place} key={place.id} />)}</div> : null}

      {filteredPlaces.length > 0 && view === 'map' ? <div className="directory-map-preview" aria-label="Visual preview of the sample place location">
        <div className="map-preview-copy"><span className="map-preview-icon" aria-hidden="true">⌖</span><div><p className="section-label">Optional visual preview</p><h3>Sample Street, Pilot District</h3><p>The list remains the source of truth. This fixture preview does not load map tiles or use your location.</p><button className="button button-secondary" type="button" onClick={() => setView('list')}>Return to accessible list</button></div></div>
        <div className="map-preview-art" aria-hidden="true"><div className="map-grid-lines" /><span className="preview-pin">●</span><span className="preview-label">Sample Community Centre</span></div>
      </div> : null}
    </section>
  );
}
