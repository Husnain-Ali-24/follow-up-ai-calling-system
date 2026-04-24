import { useState } from 'react';

export default function ReportsPage() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Analytics & Reports</h1>
      <p>Testing Reports Page</p>
    </div>
  );
}
