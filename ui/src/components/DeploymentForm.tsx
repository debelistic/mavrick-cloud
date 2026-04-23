import React, { useState } from 'react';
import { Upload, GitBranch, Play } from 'lucide-react';
import axios from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const DeploymentForm: React.FC = () => {
  const [gitUrl, setGitUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const queryClient = useQueryClient();

  const deployMutation = useMutation({
    mutationFn: async (data: { gitUrl?: string; file?: File }) => {
      const formData = new FormData();
      if (data.gitUrl) formData.append('gitUrl', data.gitUrl);
      if (data.file) formData.append('file', data.file);
      
      const response = await axios.post('/api/deployments', formData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
      setGitUrl('');
      setFile(null);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (gitUrl || file) {
      deployMutation.mutate({ gitUrl, file: file || undefined });
    }
  };

  return (
    <div className="card">
      <h3>New Deployment</h3>
      <form onSubmit={handleSubmit} className="deployment-form">
        <div className="input-group">
          <label htmlFor="gitUrl">Git Repository URL</label>
          <div className="input-with-icon">
            <GitBranch size={18} />
            <input
              id="gitUrl"
              type="text"
              placeholder="https://github.com/user/repo"
              value={gitUrl}
              onChange={(e) => setGitUrl(e.target.value)}
              disabled={!!file}
            />
          </div>
        </div>

        <div className="divider">
          <span>OR</span>
        </div>

        <div className="input-group">
          <label htmlFor="file">Upload Project (Zip)</label>
          <div className="file-upload">
            <input
              id="file"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={!!gitUrl}
            />
            <label htmlFor="file" className="file-label">
              <Upload size={18} />
              {file ? file.name : 'Choose a file...'}
            </label>
          </div>
        </div>

        <button 
          type="submit" 
          className="btn-primary" 
          disabled={deployMutation.isPending || (!gitUrl && !file)}
        >
          {deployMutation.isPending ? 'Deploying...' : (
            <>
              <Play size={18} />
              Deploy Now
            </>
          )}
        </button>
      </form>
    </div>
  );
};
