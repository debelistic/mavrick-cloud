import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { ExternalLink, Terminal, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { LogViewer } from './LogViewer';

interface Deployment {
  id: string;
  status: 'pending' | 'building' | 'deploying' | 'running' | 'failed' | 'success';
  gitUrl?: string;
  imageTag?: string;
  createdAt: string;
  publicUrl?: string;
}

export const DeploymentList: React.FC = () => {
  const [selectedDeployment, setSelectedDeployment] = useState<string | null>(null);

  const { data: deployments, isLoading, isError, refetch } = useQuery<Deployment[]>({
    queryKey: ['deployments'],
    queryFn: async () => {
      const response = await axios.get('/api/deployments');
      return response.data;
    },
    refetchInterval: 5000, // Poll every 5s for status updates
  });

  const getStatusIcon = (status: Deployment['status']) => {
    switch (status) {
      case 'running':
      case 'success':
        return <CheckCircle size={14} />;
      case 'failed':
        return <XCircle size={14} />;
      case 'building':
      case 'deploying':
        return <RefreshCw size={14} className="animate-spin" />;
      default:
        return <Clock size={14} />;
    }
  };

  if (isLoading) return <div className="loading">Loading deployments...</div>;
  if (isError) return <div className="error">Failed to load deployments.</div>;

  return (
    <div className="card">
      <div className="card-header">
        <h3>Active Deployments</h3>
        <button onClick={() => refetch()} className="btn-icon">
          <RefreshCw size={16} />
        </button>
      </div>
      
      <div className="table-container">
        <table className="deployment-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Status</th>
              <th>Image</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {Array.isArray(deployments) && deployments.map((dep) => (
              <React.Fragment key={dep.id}>
                <tr className={selectedDeployment === dep.id ? 'selected' : ''}>
                  <td>
                    <code className="id-badge">{dep.id.substring(0, 8)}</code>
                  </td>
                  <td>
                    <span className={`status-badge ${dep.status}`}>
                      {getStatusIcon(dep.status)}
                      {dep.status}
                    </span>
                  </td>
                  <td>
                    {dep.imageTag ? (
                      <code className="id-badge">{dep.imageTag}</code>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td>{formatDistanceToNow(new Date(dep.createdAt), { addSuffix: true })}</td>
                  <td className="actions">
                    <button 
                      onClick={() => setSelectedDeployment(selectedDeployment === dep.id ? null : dep.id)}
                      className="btn-icon"
                      title="View Logs"
                    >
                      <Terminal size={16} />
                    </button>
                    {dep.publicUrl && (
                      <a href={dep.publicUrl} target="_blank" rel="noreferrer" className="btn-icon">
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </td>
                </tr>
                {selectedDeployment === dep.id && (
                  <tr>
                    <td colSpan={5} className="log-row">
                      <LogViewer deploymentId={dep.id} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {(!Array.isArray(deployments) || deployments.length === 0) && !isLoading && (
              <tr>
                <td colSpan={5} className="empty-state">
                  {Array.isArray(deployments) ? 'No deployments found.' : 'Invalid data received from API.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
