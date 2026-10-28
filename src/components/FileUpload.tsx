import React, { useRef, useState } from 'react';
import { documentApi } from '../services/api';
import type { DocumentUploadResult } from '../types/workflow';

interface FileUploadProps {
  onResult: (result: DocumentUploadResult) => void;
}

function FileUpload({ onResult }: FileUploadProps) {
  const [purpose, setPurpose] = useState<'KNOWLEDGE' | 'WORKFLOW'>('KNOWLEDGE');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setUploading(true);
    try {
      const result = await documentApi.upload(file, purpose);
      onResult(result);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="file-upload">
      <select value={purpose} onChange={(e) => setPurpose(e.target.value as any)}>
        <option value="KNOWLEDGE">Add to knowledge base</option>
        <option value="WORKFLOW">Generate workflow</option>
      </select>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.md,.csv,.log"
        onChange={handleFile}
        disabled={uploading}
      />
      {uploading && <span className="upload-status">Processing...</span>}
      {error && <span className="upload-error">{error}</span>}
    </div>
  );
}

export default FileUpload;
