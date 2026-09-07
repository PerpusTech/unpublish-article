import React from 'react';
import { ArticleItem } from '../../services/api';

interface ArticleCardProps {
  article: ArticleItem;
  onSelect: (article: ArticleItem) => void;
  onOpenPdf?: (articleId: number, docId: number, title: string) => void;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({ article, onSelect, onOpenPdf }) => {
  const isPublish = article.eprint_status === 'archive';
  const tierClass = isPublish ? 'publish-tier' : 'unpublish-tier';

  return (
    <article
      className={`academic-card ${tierClass}`}
      aria-labelledby={`article-heading-${article.eprintid}`}
    >
      {/* Top Meta Line: EPrint ID, Year, Publication Type, Status */}
      <div className="academic-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="eprint-id-badge">#{article.eprintid}</span>

          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-text-muted)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>{article.date_year || 'Tahun N/A'}</span>
          </span>

          {article.type && (
            <span
              style={{
                fontSize: 11.5,
                textTransform: 'capitalize',
                background: 'var(--color-surface-subtle)',
                padding: '2px 8px',
                borderRadius: 4,
                color: 'var(--color-text-muted)',
                border: '1px solid var(--color-border)',
              }}
            >
              {article.type}
            </span>
          )}
        </div>

        <div>
          {isPublish ? (
            <span
              className="badge badge-publish"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
              Terbit Terbuka (Archive)
            </span>
          ) : (
            <span
              className="badge badge-unpublish"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
              Khusus Perpustakaan (Unpublish)
            </span>
          )}
        </div>
      </div>

      {/* Article Title */}
      <h3 id={`article-heading-${article.eprintid}`} className="academic-card-title">
        <a
          href={`#article-${article.eprintid}`}
          onClick={(e) => {
            e.preventDefault();
            onSelect(article);
          }}
        >
          {article.title}
        </a>
      </h3>


      {/* Authors & Department */}
      <div className="author-chip-list">
        {article.creators && article.creators.length > 0 ? (
          article.creators.slice(0, 3).map((author, idx) => (
            <span key={idx} className="author-chip">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>{author}</span>
              {idx === 0 && (article.id_number || article.nim) && (
                <span className="author-id-number" title="Nomor Identifikasi / NIM Penulis">
                  {article.id_number || article.nim}
                </span>
              )}
            </span>
          ))
        ) : (
          <span className="author-chip">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>Peneliti Civitas UMS</span>
            {(article.id_number || article.nim) && (
              <span className="author-id-number" title="Nomor Identifikasi / NIM">
                {article.id_number || article.nim}
              </span>
            )}
          </span>
        )}

        {article.creators && article.creators.length > 3 && (
          <span style={{ fontSize: 11.5, color: 'var(--color-text-muted)', fontWeight: 600 }}>
            +{article.creators.length - 3} lainnya
          </span>
        )}

        {article.department && (
          <span className="department-tag">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
              <path d="M9 22v-4h6v4" />
              <path d="M8 6h.01" />
              <path d="M16 6h.01" />
              <path d="M12 6h.01" />
              <path d="M12 10h.01" />
              <path d="M12 14h.01" />
              <path d="M16 10h.01" />
              <path d="M16 14h.01" />
              <path d="M8 10h.01" />
              <path d="M8 14h.01" />
            </svg>
            <span>{article.department}</span>
          </span>
        )}
      </div>

      {/* Abstract Excerpt */}
      <p className="academic-card-abstract">
        {article.abstract || 'Tidak ada abstrak ringkas yang disertakan pada metadata naskah eprint ini.'}
      </p>

      {/* Card Action Footer */}
      <div className="academic-card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div className="doc-count-pill">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span>
            {article.documents && article.documents.length > 0
              ? `${article.documents.length} Dokumen (PDF)`
              : 'Naskah Digital Terkoneksi'}
          </span>
        </div>

        <div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onSelect(article)}
            style={{
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
            }}
          >
            <span>Detail & Abstrak Naskah</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
};
