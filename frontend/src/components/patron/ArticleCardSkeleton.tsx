import React from 'react';

export const ArticleCardSkeleton: React.FC = () => {
  return (
    <div className="skeleton-card" aria-hidden="true">
      {/* Top Meta Line: EPrint ID, Year, Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="skeleton-shimmer" style={{ width: 80, height: 20 }} />
          <div className="skeleton-shimmer" style={{ width: 60, height: 20 }} />
          <div className="skeleton-shimmer" style={{ width: 70, height: 20 }} />
        </div>
        <div className="skeleton-shimmer" style={{ width: 140, height: 22, borderRadius: 4 }} />
      </div>

      {/* Title */}
      <div style={{ margin: '4px 0' }}>
        <div className="skeleton-shimmer" style={{ width: '85%', height: 24, marginBottom: 8 }} />
        <div className="skeleton-shimmer" style={{ width: '60%', height: 24 }} />
      </div>

      {/* Author and Dept */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div className="skeleton-shimmer" style={{ width: 130, height: 26, borderRadius: 9999 }} />
        <div className="skeleton-shimmer" style={{ width: 150, height: 26, borderRadius: 9999 }} />
        <div className="skeleton-shimmer" style={{ width: 180, height: 20 }} />
      </div>

      {/* Abstract lines */}
      <div style={{ margin: '6px 0' }}>
        <div className="skeleton-shimmer" style={{ width: '100%', height: 14, marginBottom: 6 }} />
        <div className="skeleton-shimmer" style={{ width: '95%', height: 14, marginBottom: 6 }} />
        <div className="skeleton-shimmer" style={{ width: '70%', height: 14 }} />
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
        <div className="skeleton-shimmer" style={{ width: 160, height: 18 }} />
        <div className="skeleton-shimmer" style={{ width: 150, height: 32, borderRadius: 6 }} />
      </div>
    </div>
  );
};
