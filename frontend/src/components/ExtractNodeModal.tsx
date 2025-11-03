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

interface Schema {
  schema_name: string;
}

interface Table {
  table_name: string;
  table_type: string;
}

interface Column {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  ordinal_position: number;
}

interface ExtractConfig {
  connection_id?: number;
  connection_name?: string;
  schema?: string;
  table?: string;
  columns?: string[];
}

interface ExtractNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: ExtractConfig) => void;
  initialConfig?: ExtractConfig;
}

const ExtractNodeModal = ({ isOpen, onClose, onSave, initialConfig }: ExtractNodeModalProps) => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);

  const [selectedConnectionId, setSelectedConnectionId] = useState<number | undefined>(
    initialConfig?.connection_id
  );
  const [selectedSchema, setSelectedSchema] = useState<string | undefined>(initialConfig?.schema);
  const [selectedTable, setSelectedTable] = useState<string | undefined>(initialConfig?.table);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(initialConfig?.columns || []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Load connections on mount
  useEffect(() => {
    if (isOpen) {
      loadConnections();
    }
  }, [isOpen]);

  // Load schemas when connection changes
  useEffect(() => {
    if (selectedConnectionId) {
      loadSchemas(selectedConnectionId);
    } else {
      setSchemas([]);
      setTables([]);
      setColumns([]);
    }
  }, [selectedConnectionId]);

  // Load tables when schema changes
  useEffect(() => {
    if (selectedConnectionId && selectedSchema) {
      loadTables(selectedConnectionId, selectedSchema);
    } else {
      setTables([]);
      setColumns([]);
    }
  }, [selectedConnectionId, selectedSchema]);

  // Load columns when table changes
  useEffect(() => {
    if (selectedConnectionId && selectedTable) {
      loadColumns(selectedConnectionId, selectedSchema, selectedTable);
    } else {
      setColumns([]);
    }
  }, [selectedConnectionId, selectedSchema, selectedTable]);

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

  const loadSchemas = async (connectionId: number) => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${apiBaseUrl}/connections/${connectionId}/schemas`);
      setSchemas(response.data.schemas);
    } catch (err) {
      setError('Failed to load schemas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadTables = async (connectionId: number, schema: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${apiBaseUrl}/connections/${connectionId}/tables`, {
        params: { schema },
      });
      setTables(response.data.tables);
    } catch (err) {
      setError('Failed to load tables');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadColumns = async (connectionId: number, schema: string | undefined, table: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${apiBaseUrl}/connections/${connectionId}/columns`, {
        params: { schema, table },
      });
      setColumns(response.data.columns);
    } catch (err) {
      setError('Failed to load columns');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectionChange = (connectionId: string) => {
    const id = connectionId ? parseInt(connectionId) : undefined;
    setSelectedConnectionId(id);
    setSelectedSchema(undefined);
    setSelectedTable(undefined);
    setSelectedColumns([]);
  };

  const handleSchemaChange = (schema: string) => {
    setSelectedSchema(schema);
    setSelectedTable(undefined);
    setSelectedColumns([]);
  };

  const handleTableChange = (table: string) => {
    setSelectedTable(table);
    setSelectedColumns([]);
  };

  const handleColumnToggle = (columnName: string) => {
    setSelectedColumns((prev) =>
      prev.includes(columnName) ? prev.filter((c) => c !== columnName) : [...prev, columnName]
    );
  };

  const handleSelectAllColumns = () => {
    if (selectedColumns.length === columns.length) {
      setSelectedColumns([]);
    } else {
      setSelectedColumns(columns.map((c) => c.column_name));
    }
  };

  const handleSave = () => {
    const connection = connections.find((c) => c.id === selectedConnectionId);
    const config: ExtractConfig = {
      connection_id: selectedConnectionId,
      connection_name: connection?.name,
      schema: selectedSchema,
      table: selectedTable,
      columns: selectedColumns.length > 0 ? selectedColumns : undefined,
    };
    onSave(config);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-800">
          <h2 className="text-xl font-semibold">Configure Extract Node</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="bg-red-900/20 border border-red-700 text-red-400 px-4 py-2 rounded">
              {error}
            </div>
          )}

          {/* Connection Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Database Connection</label>
            <select
              value={selectedConnectionId || ''}
              onChange={(e) => handleConnectionChange(e.target.value)}
              className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value="">Select a connection...</option>
              {connections.map((conn) => (
                <option key={conn.id} value={conn.id}>
                  {conn.name} ({conn.db_type})
                </option>
              ))}
            </select>
          </div>

          {/* Schema Selection */}
          {schemas.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Schema</label>
              <select
                value={selectedSchema || ''}
                onChange={(e) => handleSchemaChange(e.target.value)}
                className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="">Select a schema...</option>
                {schemas.map((schema) => (
                  <option key={schema.schema_name} value={schema.schema_name}>
                    {schema.schema_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Table Selection */}
          {tables.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Table</label>
              <select
                value={selectedTable || ''}
                onChange={(e) => handleTableChange(e.target.value)}
                className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="">Select a table...</option>
                {tables.map((table) => (
                  <option key={table.table_name} value={table.table_name}>
                    {table.table_name} ({table.table_type})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Column Selection */}
          {columns.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">Columns</label>
                <button
                  type="button"
                  onClick={handleSelectAllColumns}
                  className="text-xs text-emerald-400 hover:text-emerald-300"
                >
                  {selectedColumns.length === columns.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded max-h-64 overflow-y-auto">
                {columns.map((column) => (
                  <label
                    key={column.column_name}
                    className="flex items-center px-3 py-2 hover:bg-slate-700 cursor-pointer border-b border-slate-700 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes(column.column_name)}
                      onChange={() => handleColumnToggle(column.column_name)}
                      className="mr-3 w-4 h-4 text-emerald-500 bg-slate-700 border-slate-600 rounded focus:ring-emerald-400"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{column.column_name}</div>
                      <div className="text-xs text-slate-400">
                        {column.data_type}
                        {column.is_nullable === 'YES' && ' (nullable)'}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {selectedColumns.length > 0
                  ? `${selectedColumns.length} column(s) selected`
                  : 'Select columns or leave empty to extract all'}
              </div>
            </div>
          )}

          {loading && (
            <div className="text-center py-4">
              <div className="text-slate-400">Loading...</div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!selectedConnectionId || !selectedTable}
            className="px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExtractNodeModal;
