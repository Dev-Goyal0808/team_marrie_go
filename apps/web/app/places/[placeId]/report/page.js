import { notFound } from 'next/navigation';
import Link from 'next/link';
import SiteHeader from '../../../../components/SiteHeader';
import SampleDataNotice from '../../../../components/SampleDataNotice';
import ReportForm from '../../../../components/ReportForm';
import { featureForCode, samplePlace } from '../../../../lib/fixture-client';

export const metadata = {
  title: 'Report an issue · AccessMap',
  description: 'Share a structured accessibility observation with AccessMap.'
};

export default async function ReportPage({ params, searchParams }) {
  const { placeId } = await params;
  if (placeId !== samplePlace.id) notFound();
  const query = await searchParams;
  const requestedFeature = typeof query?.feature === 'string' && featureForCode(query.feature) ? query.feature : '';

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <SiteHeader active="explore" />
      <main id="main-content" className="app-main">
        <div className="shell report-shell">
          <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href={`/places/${samplePlace.id}`}>{samplePlace.name}</Link><span aria-hidden="true">/</span><span aria-current="page">Report an issue</span></nav>
          <div className="page-heading report-heading"><div><p className="eyebrow"><span className="eyebrow-line" />Add what you know</p><h1>Report an issue</h1><p>Share one observation about <strong>{samplePlace.name}</strong>. A short, specific report can help someone plan with more confidence.</p></div><div className="report-step"><span>01</span><small>Sample report flow</small></div></div>
          <SampleDataNotice />
          <ReportForm place={samplePlace} initialFeature={requestedFeature} />
        </div>
      </main>
      <footer className="site-footer"><div className="shell footer-inner"><div><Link className="footer-brand" href="/">AccessMap</Link><p>Reports should be specific, dated, and privacy-aware.</p></div><Link className="text-link" href={`/places/${samplePlace.id}`}>Back to place <span aria-hidden="true">→</span></Link></div></footer>
    </>
  );
}
