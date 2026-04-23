import React, { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon } from 'lucide-react';

interface LogViewerProps {
  deploymentId: string;
}

export const LogViewer: React.FC<LogViewerProps> = ({ deploymentId }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const eventSource = new EventSource(`/api/deployments/${deploymentId}/logs`);

    eventSource.onmessage = (event) => {
      setLogs((prev) => [...prev, event.data]);
    };

    eventSource.onerror = () => {
      setLogs((prev) => {
        const lastLog = prev[prev.length - 1] || '';
        if (lastLog.includes('Build complete')) {
          return prev;
        }
        return [...prev, '--- Connection lost. Reconnecting... ---'];
      });
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [deploymentId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="log-viewer">
      <div className="log-header">
        <TerminalIcon size={14} />
        <span>Build Logs for {deploymentId.substring(0, 8)}</span>
      </div>
      <div className="log-content" ref={scrollRef}>
        {logs.length === 0 ? (
          <div className="log-empty">Waiting for logs...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="log-line">
              <span className="line-number">{i + 1}</span>
              <span className="line-text">{log}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
