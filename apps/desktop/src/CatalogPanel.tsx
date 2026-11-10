import { useEffect, useState } from "react";
import type { ContentPack } from "@cairn/content";

import {
  DEFAULT_CATALOG_URL,
  installCatalogPack,
  isRevoked,
  loadCatalog,
  type CatalogPack,
  type Revocation,
} from "./packs";

function minutes(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  if (value < 60) return `${value} min`;
  return `${Math.round((value / 60) * 10) / 10} hr`;
}

export function CatalogPanel({
  installed,
  onInstalled,
  onClose,
}: {
  installed: Record<string, string>;
  onInstalled: (pack: ContentPack) => void;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<CatalogPack[]>([]);
  const [catalogUrl, setCatalogUrl] = useState(DEFAULT_CATALOG_URL);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [revoked, setRevoked] = useState<Revocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCatalog()
      .then(({ url, catalog }) => {
        if (cancelled) return;
        setCatalogUrl(url);
        setPublicKey(catalog.publicKey);
        setRevoked(catalog.revoked);
        setEntries(catalog.packs);
      })
      .catch((cause) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function install(entry: CatalogPack): Promise<void> {
    setBusyId(entry.id);
    setError(null);
    try {
      const pack = await installCatalogPack(
        entry,
        catalogUrl,
        publicKey ?? undefined,
        revoked
      );
      onInstalled(pack);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      className="catalog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="catalog-title"
    >
      <div className="catalog-panel">
        <div className="catalog-head">
          <div>
            <p className="eyebrow">Community library</p>
            <h2 id="catalog-title">Pack catalog</h2>
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="catalog-intro">
          Download a pack into the local library. Cairn verifies the catalog
          hash before installing it. The app still works offline afterwards.
        </p>

        {loading && <p className="catalog-note">Loading catalog...</p>}
        {error && <p className="catalog-error">{error}</p>}
        {!loading && !error && entries.length === 0 && (
          <p className="catalog-note">The catalog has no packs yet.</p>
        )}

        <div className="catalog-list">
          {entries.map((entry) => {
            const installedVersion = installed[entry.id];
            const isCurrent = installedVersion === entry.version;
            const isUpdate = Boolean(installedVersion) && !isCurrent;
            const revocation = isRevoked(entry, revoked);
            return (
              <article className="catalog-card" key={entry.id}>
                <div className="catalog-card-head">
                  <div>
                    <h3>{entry.title}</h3>
                    <p className="catalog-meta">
                      v{entry.version} · {entry.level} · {entry.trust}
                    </p>
                  </div>
                  <span
                    className={`catalog-trust ${revocation ? "revoked" : ""}`}
                  >
                    {revocation ? "revoked" : entry.trust}
                  </span>
                </div>
                <p className="catalog-description">{entry.description}</p>
                {revocation && (
                  <p className="catalog-revoked">
                    Revoked: {revocation.reason}
                    {revocation.replacement
                      ? ` Use ${revocation.replacement} instead.`
                      : ""}
                  </p>
                )}
                <p className="catalog-stats">
                  {[
                    entry.skills ? `${entry.skills} skills` : "",
                    entry.items ? `${entry.items} items` : "",
                    entry.labs ? `${entry.labs} labs` : "",
                    minutes(entry.estimatedMinutes),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="catalog-actions">
                  <button
                    type="button"
                    className="button small"
                    disabled={
                      Boolean(revocation) || isCurrent || Boolean(busyId)
                    }
                    onClick={() => void install(entry)}
                  >
                    {revocation
                      ? "Revoked"
                      : isCurrent
                        ? "Installed"
                        : busyId === entry.id
                          ? "Installing..."
                          : isUpdate
                            ? "Update"
                            : "Install"}
                  </button>
                  {entry.tags && entry.tags.length > 0 && (
                    <span className="catalog-tags">
                      {entry.tags.slice(0, 4).join(" · ")}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <p className="catalog-source">
          Catalog:{" "}
          <a href={catalogUrl} target="_blank" rel="noreferrer">
            {catalogUrl}
          </a>
        </p>
      </div>
    </div>
  );
}
