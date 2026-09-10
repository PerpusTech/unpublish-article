import React from 'react';
import { ArticleItem } from '../../services/api';
import { HighlightText } from '../common/HighlightText';

interface ArticleCardProps {
  article: ArticleItem;
  searchQuery?: string;
  onSelect: (article: ArticleItem) => void;
  onOpenPdf?: (articleId: number, docId: number, title: string) => void;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({ article, searchQuery, onSelect }) => {
  const isPublish = article.eprint_status === 'archive';
  const tierClass = isPublish ? 'publish-tier' : 'unpublish-tier';

  // Format creators cleanly
  const authors = Array.isArray(article.creators)
    ? article.creators
        .map((c) =>
          typeof c === 'string'
            ? c
            : (c as any)?.name
            ? `${(c as any).name.family || ''} ${(c as any).name.given || ''}`.trim()
            : String(c)
        )
        .filter(Boolean)
    : typeof article.creators === 'string'
    ? (article.creators as string).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
    : [];

  const mainAuthor = authors.length > 0 ? authors[0] : 'Peneliti Civitas UMS';
  const otherAuthorsCount = authors.length > 1 ? authors.length - 1 : 0;
  const authorNim = article.id_number || article.nim;

  return (
    <article
      className={`academic-card ${tierClass}`}
      aria-labelledby={`article-heading-${article.eprintid}`}
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => {
        e.preventDefault();
        try {
          navigator.clipboard?.writeText?.('DOKUMEN INI DILINDUNGI HAK CIPTA UPT PERPUSTAKAAN UMS');
        } catch {}
      }}
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      {/* Top Meta Line */}
      <div className="academic-card-header">
        <div className="academic-meta-left">
          <span className="eprint-id-badge">#{article.eprintid}</span>
          <span className="meta-dot">·</span>
          <span className="meta-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>{article.date_year || 'Tahun N/A'}</span>
          </span>
          {article.type && (
            <>
              <span className="meta-dot">·</span>
              <span className="meta-type-tag">{article.type}</span>
            </>
          )}
        </div>

        <div className="academic-meta-right">
          {isPublish ? (
            <span className="status-badge status-badge-publish">
              <span className="status-indicator-dot" />
              Terbit Terbuka (Archive)
            </span>
          ) : (
            <span className="status-badge status-badge-unpublish">
              <span className="status-indicator-dot" />
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
          <HighlightText text={article.title} query={searchQuery} />
        </a>
      </h3>

      {/* Authors & Faculty/Department Line */}
      <div className="academic-card-authors">
        <div className="author-info">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--color-text-muted)' }}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span className="author-name">
            <HighlightText text={mainAuthor} query={searchQuery} />
          </span>
          {authorNim && (
            <span className="author-nim">
              (<HighlightText text={authorNim} query={searchQuery} />)
            </span>
          )}
          {otherAuthorsCount > 0 && (
            <span className="other-authors-tag">+{otherAuthorsCount} penulis</span>
          )}
        </div>

        {article.department && (
          <div className="department-info">
            <span className="meta-dot">·</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--color-text-muted)' }}>
              <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
              <path d="M9 22v-4h6v4" />
              <path d="M8 6h.01" />
              <path d="M16 6h.01" />
              <path d="M12 6h.01" />
            </svg>
            <span className="department-name">
              <HighlightText text={article.department} query={searchQuery} />
            </span>
          </div>
        )}
      </div>

      {/* Abstract Excerpt */}
      <p className="academic-card-abstract">
        <HighlightText
          text={article.abstract || 'Tidak ada abstrak ringkas yang disertakan pada metadata naskah eprint ini.'}
          query={searchQuery}
        />
      </p>

      {/* Card Action Footer */}
      <div className="academic-card-footer">
        <div className="doc-count-pill">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span>
            {article.documents && article.documents.length > 0
              ? `${article.documents.length} Dokumen Terlampir (PDF)`
              : 'Naskah Digital Terkoneksi'}
          </span>
        </div>

        <div>
          <button
            type="button"
            className="btn btn-secondary btn-sm academic-detail-btn"
            onClick={() => onSelect(article)}
          >
            <span>Detail & Abstrak Naskah</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
};

