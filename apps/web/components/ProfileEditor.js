'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import StatusBadge from './StatusBadge';

const storageKey = 'accessmap.sample.match-profile';

function profileFromRequirements(requirements) {
  return requirements.reduce((profile, requirement) => ({ ...profile, [requirement.featureCode]: requirement.level }), {});
}

export default function ProfileEditor({ initialProfile, features, explanation }) {
  const [profile, setProfile] = useState(() => profileFromRequirements(initialProfile.requirements));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const savedProfile = JSON.parse(stored);
        startTransition(() => setProfile((current) => ({ ...current, ...savedProfile })));
      }
    } catch {
      // Local storage is optional; the editor still works in memory.
    }
  }, []);

  const selectedCount = useMemo(() => Object.values(profile).filter((level) => level !== 'none').length, [profile]);

  function updateFeature(featureCode, level) {
    setSaved(false);
    setProfile((current) => ({ ...current, [featureCode]: level }));
  }

  function saveProfile() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(profile));
    } catch {
      // Keep the state usable if storage is blocked.
    }
    setSaved(true);
  }

  function clearProfile() {
    setProfile({});
    setSaved(false);
    try { window.localStorage.removeItem(storageKey); } catch { /* Optional storage. */ }
  }

  function resetProfile() {
    setProfile(profileFromRequirements(initialProfile.requirements));
    setSaved(false);
  }

  return (
    <div className="profile-layout">
      <section className="profile-editor-card" aria-labelledby="profile-editor-title">
        <div className="profile-card-heading"><div><p className="section-label">Choose what matters</p><h2 id="profile-editor-title">Your features</h2></div><span className="selection-count">{selectedCount} selected</span></div>
        <p className="profile-card-intro">Set a level for any feature. Leave it as “Not part of my profile” if it is not useful for your decision.</p>
        <div className="feature-editor-list">
          {features.slice(0, 3).map((feature) => (
            <div className="feature-editor-row" key={feature.code}>
              <div className="feature-editor-copy"><span className="feature-icon" aria-hidden="true">{feature.group === 'Movement' ? '↗' : feature.group === 'Facilities' ? '□' : '◌'}</span><div><label htmlFor={`profile-${feature.code}`}>{feature.label}</label><p>{feature.description}</p></div></div>
              <select id={`profile-${feature.code}`} value={profile[feature.code] ?? 'none'} onChange={(event) => updateFeature(feature.code, event.target.value)} aria-describedby={`profile-help-${feature.code}`}><option value="none">Not selected</option><option value="required">Required</option><option value="preferred">Preferred</option><option value="avoid">Avoid</option></select>
              <span className="sr-only" id={`profile-help-${feature.code}`}>Choose whether {feature.label} is required, preferred, something to avoid, or not selected.</span>
            </div>
          ))}
        </div>
        <div className="profile-actions"><button className="button button-primary" type="button" onClick={saveProfile}>Save profile</button><button className="button button-text" type="button" onClick={clearProfile}>Clear all</button><button className="button button-text button-text-muted" type="button" onClick={resetProfile}>Reset sample</button></div>
        <p className="save-status" aria-live="polite">{saved ? <><span aria-hidden="true">✓</span> Saved privately in this browser.</> : 'Changes are local until you save them.'}</p>
        <div className="privacy-message"><span className="info-icon" aria-hidden="true">i</span><p>This is a private preference tool. It does not ask for a diagnosis, and the profile is not included in place links or public sample data.</p></div>
      </section>

      <aside className="profile-preview-card" aria-labelledby="profile-preview-title"><div className="profile-card-heading"><div><p className="section-label">Sample preview</p><h2 id="profile-preview-title">How a match can read</h2></div><StatusBadge status={explanation.decision}>Needs information</StatusBadge></div><p className="profile-preview-intro">This explanation comes from the supplied fixture for Sample Community Centre. It is not recalculated when you edit the local profile because no match API exists yet.</p><div className="preview-metrics"><div><strong>{explanation.required.confirmed}</strong><span>required confirmed</span></div><div><strong>{explanation.required.unknown}</strong><span>required unknown</span></div><div><strong>{explanation.preferred.confirmed}</strong><span>preferred confirmed</span></div></div><div className="preview-list"><div><span className="metric-icon metric-icon-positive" aria-hidden="true">✓</span><span>Step-free entrance</span><strong>Observed</strong></div><div><span className="metric-icon metric-icon-unknown" aria-hidden="true">?</span><span>Accessible toilet</span><strong>Unknown</strong></div><div><span className="metric-icon metric-icon-unknown" aria-hidden="true">?</span><span>Quiet space</span><strong>Unknown</strong></div></div><Link className="text-link" href="/places/place_sample_community_centre">See this place’s evidence <span aria-hidden="true">→</span></Link></aside>
    </div>
  );
}
