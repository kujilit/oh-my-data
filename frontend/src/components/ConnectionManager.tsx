import { useEffect, useState } from 'react';
import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

interface Connection {
  id: number;
  name: string;
  db_type: string;
  host: string | null;
  port: number | null;
  database: string;
  username: string | null;
}

interface ConnectionManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const ConnectionManager = ({ isOpen, onClose }: ConnectionManagerProps) => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [testStatus, setTestStatus] = useState<{ [key: number]: string }>({});

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    db_type: 'postgresql',
    host: '',
    port: '',
    database: '',
    username: '',
    password: '',
  });

  useEffect(() => {
    if (isOpen) {
      loadConnections();
    }
  }, [isOpen]);

  const loadConnections = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${apiBaseUrl}/connections`);
      setConnections(response.data);
    } catch (err) {
      setError('Failed to load connections');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await axios.post(`${apiBaseUrl}/connections`, {
        name: formData.name,
        db_type: formData.db_type,
        host: formData.host || null,
        port: formData.port ? parseInt(formData.port) : null,
        database: formData.database,
        username: formData.username || null,
        password: formData.password || null,
      });
      setFormData({
        name: '',
        db_type: 'postgresql',
        host: '',
        port: '',
        database: '',
        username: '',
        password: '',
      });
      setIsFormOpen(false);
      loadConnections();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create connection');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this connection?')) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      await axios.delete(`${apiBaseUrl}/connections/${id}`);
      loadConnections();
    } catch (err) {
      setError('Failed to delete connection');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (id: number) => {
    setTestStatus({ ...testStatus, [id]: 'testing' });
    try {
      const response = await axios.post(`${apiBaseUrl}/connections/${id}/test`);
      setTestStatus({
        ...testStatus,
        [id]: response.data.status === 'success' ? 'success' : 'error',
      });
      setTimeout(() => {
        setTestStatus((prev) => {
          const newStatus = { ...prev };
          delete newStatus[id];
          return newStatus;
        });
      }, 3000);
    } catch (err) {
      setTestStatus({ ...testStatus, [id]: 'error' });
      setTimeout(() => {
        setTestStatus((prev) => {
          const newStatus = { ...prev };
          delete newStatus[id];
          return newStatus;
        });
      }, 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Database Connections</h2>
          <button
            type="button"
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-sm font-medium"
          >
            {isFormOpen ? 'Cancel' : 'Add Connection'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="bg-red-900/20 border border-red-700 text-red-400 px-4 py-2 rounded mb-4">
              {error}
            </div>
          )}

          {isFormOpen && (
            <form onSubmit={handleSubmit} className="bg-slate-800 rounded-lg p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Connection Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full rounded bg-slate-700 border border-slate-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="My PostgreSQL DB"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Database Type</label>
                  <select
                    value={formData.db_type}
                    onChange={(e) => setFormData({ ...formData, db_type: e.target.value })}
                    className="w-full rounded bg-slate-700 border border-slate-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <option value="postgresql">PostgreSQL</option>
                    <option value="mysql">MySQL</option>
                    <option value="sqlite">SQLite</option>
                    <option value="mariadb">MariaDB</option>
                    <option value="oracle">Oracle</option>
                    <option value="mssql">MS SQL Server</option>
                  </select>
                </div>
              </div>

              {formData.db_type !== 'sqlite' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Host</label>
                    <input
                      type="text"
                      value={formData.host}
                      onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                      className="w-full rounded bg-slate-700 border border-slate-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      placeholder="localhost"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Port</label>
                    <input
                      type="number"
                      value={formData.port}
                      onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                      className="w-full rounded bg-slate-700 border border-slate-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      placeholder="5432"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1">
                  Database {formData.db_type === 'sqlite' ? 'Path' : 'Name'}
                </label>
                <input
                  type="text"
                  value={formData.database}
                  onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                  required
                  className="w-full rounded bg-slate-700 border border-slate-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder={formData.db_type === 'sqlite' ? '/path/to/database.db' : 'my_database'}
                />
              </div>

              {formData.db_type !== 'sqlite' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Username</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full rounded bg-slate-700 border border-slate-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Password</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full rounded bg-slate-700 border border-slate-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-semibold disabled:opacity-50"
                >
                  Create Connection
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {connections.length === 0 && !loading && (
              <div className="text-center py-8 text-slate-400">
                No connections configured. Add one to get started.
              </div>
            )}

            {connections.map((conn) => (
              <div
                key={conn.id}
                className="bg-slate-800 rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="font-medium">{conn.name}</div>
                  <div className="text-sm text-slate-400">
                    {conn.db_type} • {conn.database}
                    {conn.host && ` • ${conn.host}${conn.port ? `:${conn.port}` : ''}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {testStatus[conn.id] && (
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        testStatus[conn.id] === 'testing'
                          ? 'bg-blue-900/20 text-blue-400'
                          : testStatus[conn.id] === 'success'
                          ? 'bg-green-900/20 text-green-400'
                          : 'bg-red-900/20 text-red-400'
                      }`}
                    >
                      {testStatus[conn.id] === 'testing'
                        ? 'Testing...'
                        : testStatus[conn.id] === 'success'
                        ? 'Connected'
                        : 'Failed'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleTest(conn.id)}
                    className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-xs font-medium"
                  >
                    Test
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(conn.id)}
                    className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-xs font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectionManager;
