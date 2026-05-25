import React from "react";
import styles from "./Context.module.css";

export interface RagDocument {
  id: string;
  content: string;
  metadata?: {
    title?: string;
    source?: string;
    [key: string]: any;
  };
  score?: number;
}

export interface ContextProps {
  documents: RagDocument[];
  isLoading?: boolean;
}

export default function Context({ documents, isLoading = false }: ContextProps) {
  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Retrieving context...</div>
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>No context documents retrieved.</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Retrieved Context</h3>
      <ul className={styles.documentList}>
        {documents.map((doc, index) => (
          <li key={doc.id || index} className={styles.documentItem}>
            <div className={styles.documentHeader}>
              <span className={styles.sourceBadge}>
                {doc.metadata?.title || doc.metadata?.source || `Source ${index + 1}`}
              </span>
              {doc.score !== undefined && (
                <span className={styles.scoreBadge}>
                  Score: {doc.score.toFixed(2)}
                </span>
              )}
            </div>
            <p className={styles.documentContent}>{doc.content}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
