import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authStore, knowledgeApi } from '../services/api';

function KnowledgeBase() {
  const isAdmin = authStore.getUser()?.role === 'ADMIN';
  const [documents, setDocuments] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setDocuments(await knowledgeApi.listDocuments());
    } catch (e) {
      console.error('Failed to load documents:', e);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    try {
      setResults(await knowledgeApi.search(query, 5));
    } catch (e) {
      console.error('Search failed:', e);
    }
  };

  const handleAdd = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    try {
      await knowledgeApi.add({ title: newTitle, content: newContent, category: 'DOCUMENTATION' });
      setNewTitle('');
      setNewContent('');
      loadDocuments();
    } catch (e) {
      console.error('Failed to add knowledge:', e);
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
        <section>
          <h2>Search</h2>
          <div className="knowledge-search">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search knowledge base..."
            />
            <button className="btn btn-primary" onClick={handleSearch}>Search</button>
          </div>
          {results.map((doc, i) => (
            <div key={i} className="knowledge-result">
              <pre>{doc.content ?? doc.text}</pre>
            </div>
          ))}
        </section>

        <section>
          <h2>Uploaded Documents</h2>
          {documents.length === 0 ? (
            <p>No documents uploaded yet.</p>
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
            <h2>Add Knowledge</h2>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Title"
            />
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Content..."
              rows={6}
            />
            <button className="btn btn-primary" onClick={handleAdd}>Add</button>
          </section>
        )}
      </div>
    </div>
  );
}

export default KnowledgeBase;
