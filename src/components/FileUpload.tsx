import React, { useEffect, useRef, useState } from 'react';
import { documentApi } from '../services/api';
import type { DocumentUploadResult } from '../types/workflow';

interface FileUploadProps {
  onResult: (result: DocumentUploadResult) => void;
  allowKnowledge?: boolean;
}

function FileUpload({ onResult, allowKnowledge = false }: FileUploadProps) {
  const [purpose, setPurpose] = useState<'KNOWLEDGE' | 'WORKFLOW'>(
    allowKnowledge ? 'KNOWLEDGE' : 'WORKFLOW'
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPurpose(allowKnowledge ? 'KNOWLEDGE' : 'WORKFLOW');
  }, [allowKnowledge]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setUploading(true);
    try {
      const result = await documentApi.upload(file, purpose);
      onResult(result);
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="file-upload">
      <div className="file-upload-row">
        {allowKnowledge && (
          <label className="file-purpose">
            <span className="sr-only">Choose upload purpose</span>
            <select value={purpose} onChange={(e) => setPurpose(e.target.value as 'KNOWLEDGE' | 'WORKFLOW')}>
              <option value="KNOWLEDGE">Knowledge base</option>
              <option value="WORKFLOW">Create workflow</option>
            </select>
          </label>
        )}
        <label className={`file-picker ${uploading ? 'disabled' : ''}`}>
          <span aria-hidden="true">＋</span>
          {uploading ? 'Processing…' : 'Attach document'}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.txt,.md,.csv,.log"
            onChange={handleFile}
            disabled={uploading}
          />
        </label>
      </div>
      <p className="upload-hint">PDF, TXT, Markdown, CSV or LOG · up to 20 MB</p>
      {uploading && <span className="upload-status" role="status">Extracting document text…</span>}
      {error && <span className="upload-error" role="alert">{error}</span>}
    </div>
  );
}

export default FileUpload;
