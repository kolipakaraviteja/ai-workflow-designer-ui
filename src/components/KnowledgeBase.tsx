import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authStore, knowledgeApi } from '../services/api';

function KnowledgeBase() {
  const isAdmin = authStore.getUser()?.role === 'ADMIN';
  const [documents, setDocuments] = useState<any[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchComplete, setSearchComplete] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setDocuments(await knowledgeApi.listDocuments());
    } catch (e) {
      console.error('Failed to load documents:', e);
      setFeedback('Documents could not be loaded. Please try again.');
    } finally {
      setDocumentsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchComplete(false);
    setFeedback('');
    try {
      setResults(await knowledgeApi.search(query, 5));
    } catch (e) {
      console.error('Search failed:', e);
      setFeedback('Search failed. Please try again.');
    } finally {
      setSearching(false);
      setSearchComplete(true);
    }
  };

  const handleAdd = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    setSaving(true);
    setFeedback('');
    try {
      await knowledgeApi.add({ title: newTitle, content: newContent, category: 'DOCUMENTATION' });
      setNewTitle('');
      setNewContent('');
      setFeedback('Knowledge added successfully.');
      await loadDocuments();
    } catch (e) {
      console.error('Failed to add knowledge:', e);
      setFeedback('Knowledge could not be added. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="knowledge-page">
      <header className="app-header">
        <h1>Knowledge Base</h1>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          Back to Designer
        </button>
      </header>

      <div className="knowledge-content">
        {feedback && (
          <div className={`notice ${feedback.includes('successfully') ? 'notice-success' : 'notice-error'}`} role="status">
            {feedback}
          </div>
        )}
        <section>
          <h2>Search the knowledge base</h2>
          <form className="knowledge-search" onSubmit={e => { e.preventDefault(); handleSearch(); }}>
            <label className="sr-only" htmlFor="knowledge-query">Search documents and patterns</label>
            <input
              id="knowledge-query"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documents and patterns…"
            />
            <button className="btn btn-primary" type="submit" disabled={searching || !query.trim()}>
              {searching ? 'Searching…' : 'Search'}
            </button>
          </form>
          {searching && <p className="section-loading" role="status">Searching relevant knowledge…</p>}
          {searchComplete && !searching && results.length === 0 && <p className="section-empty">No matching knowledge found. Try a broader search.</p>}
          {results.map((doc, i) => (
            <article key={doc.id ?? i} className="knowledge-result">
              <pre>{doc.content ?? doc.text}</pre>
            </article>
          ))}
        </section>

        <section>
          <h2>Knowledge documents</h2>
          {documentsLoading ? (
            <p className="section-loading" role="status">Loading documents…</p>
          ) : documents.length === 0 ? (
            <p className="section-empty">No knowledge documents have been uploaded yet.</p>
          ) : (
            <ul className="document-list">
              {documents.map((doc) => (
                <li key={doc.id}>
                  <strong>{doc.filename}</strong> — {doc.chunkCount} chunks
                  {' '}by {doc.uploadedBy ?? 'unknown'}
                </li>
              ))}
            </ul>
          )}
        </section>

        {isAdmin && (
          <section>
            <h2>Add a knowledge entry</h2>
            <label className="knowledge-field">
              <span>Title</span>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Approval workflow pattern"
              />
            </label>
            <label className="knowledge-field">
              <span>Content</span>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Add useful process guidance…"
                rows={6}
              />
            </label>
            <button className="btn btn-primary" onClick={handleAdd} disabled={saving || !newTitle.trim() || !newContent.trim()}>
              {saving ? 'Adding…' : 'Add knowledge'}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

export default KnowledgeBase;
