import React from 'react';
import { DeploymentForm } from '../components/DeploymentForm';
import { DeploymentList } from '../components/DeploymentList';

export const DeploymentDashboard: React.FC = () => {
  return (
    <div className="dashboard-grid">
      <section className="form-section">
        <DeploymentForm />
      </section>
      <section className="list-section">
        <DeploymentList />
      </section>
    </div>
  );
};
