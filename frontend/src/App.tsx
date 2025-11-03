import { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Connection,
  Edge,
  EdgeChange,
  MarkerType,
  Node,
  type NodeProps,
  NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';
import NodeLegend from './components/NodeLegend';
import ExtractNodeModal from './components/ExtractNodeModal';
import ConnectionManager from './components/ConnectionManager';
import BuilderNode from './components/BuilderNode';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

interface ExtractConfig {
  connection_id?: number;
  connection_name?: string;
  schema?: string;
  table?: string;
  columns?: string[];
}

type NodeCategory = 'source' | 'transform' | 'load' | 'extract';

type BuilderNodeData = {
  label: string;
  type: NodeCategory;
  config: Record<string, unknown>;
};

type BuilderFlowNode = Node<BuilderNodeData>;

const SOURCE_OPTIONS = [
  { id: 'users', label: 'Users' },
  { id: 'orders', label: 'Orders' },
  { id: 'payments', label: 'Payments' },
  { id: 'events', label: 'Events' },
];

const initialNodes: BuilderFlowNode[] = [
  {
    id: '1',
    position: { x: 0, y: 0 },
    data: {
      label: 'Source: Users',
      type: 'source',
      config: { query: 'SELECT * FROM users', sources: ['users'] },
    },
    type: 'builder',
  },
  {
    id: '2',
    position: { x: 250, y: 0 },
    data: {
      label: 'Transform: Filter Active',
      type: 'transform',
      config: { function: "[x for x in data if x['active']]" },
    },
    type: 'builder',
  },
  {
    id: '3',
    position: { x: 500, y: 0 },
    data: { label: 'load: Active Users', type: 'load', config: { table: 'active_users' } },
    type: 'builder',
  },
];

const initialEdges: Edge[] = [
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    markerEnd: { type: MarkerType.ArrowClosed },
    animated: true,
  },
  {
    id: 'e2-3',
    source: '2',
    target: '3',
    markerEnd: { type: MarkerType.ArrowClosed },
    animated: true,
  },
];

const nodeTypeConfig: Record<NodeCategory, { label: string; config: Record<string, unknown> }> = {
  source: { label: 'New Source', config: { query: 'SELECT * FROM table', sources: [] } },
  extract: { label: 'New Extract', config: { sources: [] } },
  transform: { label: 'New Transform', config: { code: 'return data' } },
  load: { label: 'New Load', config: { destination: 'table_name' } },
};

const NODE_TYPE_OPTIONS: { id: NodeCategory; label: string }[] = [
  { id: 'extract', label: 'Extract' },
  { id: 'source', label: 'Source' },
  { id: 'transform', label: 'Transform' },
  { id: 'load', label: 'Load' },
];

function App() {
  const [nodes, setNodes] = useState<BuilderFlowNode[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [nodeCounter, setNodeCounter] = useState(initialNodes.length + 1);
  const [dagName, setDagName] = useState('example_etl');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Modal states
  const [isExtractModalOpen, setIsExtractModalOpen] = useState(false);
  const [isConnectionManagerOpen, setIsConnectionManagerOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) =>
        addEdge({ ...connection, id: `${connection.source}-${connection.target}`, markerEnd: { type: MarkerType.ArrowClosed } }, eds)
      ),
    []
  );

  const handleNodeLabelChange = useCallback((nodeId: string, label: string) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                label,
              },
            }
          : node
      )
    );
  }, []);

  const handleNodeConfigChange = useCallback((nodeId: string, config: Record<string, unknown>) => {
    setNodes((prev) =>
      prev.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                config,
              },
            }
          : node
      )
    );
  }, []);

  const handleNodeTypeChange = useCallback(
    (nodeId: string, nextType: NodeCategory) => {
      setNodes((prev) =>
        prev.map((node) => {
          if (node.id !== nodeId) {
            return node;
          }

          const definition = nodeTypeConfig[nextType];

          return {
            ...node,
            data: {
              ...node.data,
              type: nextType,
              config: { ...definition.config },
            },
          };
        })
      );

      if (nextType === 'extract') {
        setEditingNodeId(nodeId);
        setIsExtractModalOpen(true);
      }
    },
    []
  );

  const nodeTypes = useMemo(
    () => ({
      builder: (props: NodeProps<BuilderNodeData>) => (
        <BuilderNode
          {...props}
          availableSources={SOURCE_OPTIONS}
          availableNodeTypes={NODE_TYPE_OPTIONS}
          onLabelChange={(label) => handleNodeLabelChange(props.id, label)}
          onConfigChange={(config) => handleNodeConfigChange(props.id, config)}
          onTypeChange={(type) => handleNodeTypeChange(props.id, type as NodeCategory)}
        />
      ),
    }),
    [handleNodeConfigChange, handleNodeLabelChange, handleNodeTypeChange]
  );

  const addNode = useCallback(
    (category: NodeCategory) => {
      const id = String(nodeCounter);
      const position = { x: 100 * nodeCounter, y: 100 };
      const definition = nodeTypeConfig[category];
      const newNode: BuilderFlowNode = {
        id,
        position,
        data: {
          label: `${definition.label} ${id}`,
          type: category,
          config: definition.config,
        },
        type: 'builder',
      };

      setNodes((prev) => [...prev, newNode]);
      setNodeCounter((value) => value + 1);
      
      // Open modal for extract nodes
      if (category === 'extract') {
        setEditingNodeId(id);
        setIsExtractModalOpen(true);
      }
    },
    [nodeCounter]
  );

  const onNodeDoubleClick = useCallback((_event: React.MouseEvent, node: BuilderFlowNode) => {
    if (node.data.type === 'extract') {
      setEditingNodeId(node.id);
      setIsExtractModalOpen(true);
    }
  }, []);

  const handleExtractConfigSave = useCallback((config: ExtractConfig) => {
    if (!editingNodeId) return;

    setNodes((prev) =>
      prev.map((node) => {
        if (node.id === editingNodeId) {
          // Build a descriptive label
          let label = 'Extract: ';
          if (config.connection_name) {
            label += config.connection_name;
            if (config.table) {
              label += `.${config.table}`;
            }
          } else {
            label += 'Not configured';
          }

          const existingConfig = (node.data.config ?? {}) as Record<string, unknown>;
          const mergedConfig = { ...existingConfig, ...config } as Record<string, unknown>;

          return {
            ...node,
            data: {
              ...node.data,
              label,
              config: mergedConfig,
            },
          };
        }
        return node;
      })
    );
    
    setEditingNodeId(null);
  }, [editingNodeId]);

  const payload = useMemo(() => {
    return {
      dag_name: dagName,
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.data.type,
        name: node.data.label,
        config: node.data.config,
      })),
      edges: edges.map((edge) => ({ from: edge.source, to: edge.target })),
    };
  }, [dagName, edges, nodes]);

  const generateDag = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const response = await axios.post(`${apiBaseUrl}/generate_dag`, payload);
      setStatusMessage(`DAG saved to ${response.data.path}`);
    } catch (error) {
      setStatusMessage('Failed to generate DAG. Check backend logs.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [payload]);

  const editingNode = useMemo(() => {
    return nodes.find((n) => n.id === editingNodeId);
  }, [nodes, editingNodeId]);

  return (
    <div className="flex h-full w-full">
      <ExtractNodeModal
        isOpen={isExtractModalOpen}
        onClose={() => {
          setIsExtractModalOpen(false);
          setEditingNodeId(null);
        }}
        onSave={handleExtractConfigSave}
        initialConfig={editingNode?.data.config as ExtractConfig}
      />
      
      <ConnectionManager
        isOpen={isConnectionManagerOpen}
        onClose={() => setIsConnectionManagerOpen(false)}
      />
      
      <aside className="w-80 bg-slate-900 p-6 space-y-6 border-r border-slate-800">
        <div>
          <h1 className="text-2xl font-semibold mb-2">Visual ETL Builder</h1>
          <p className="text-sm text-slate-300">
            Добавляйте ноды, соединяйте их и генерируйте код DAG для Airflow.
          </p>
          <div className="mt-4">
            <NodeLegend />
          </div>
        </div>
        <div className="space-y-2">
          <label className="block text-xs uppercase tracking-wide text-slate-400">DAG name</label>
          <input
            value={dagName}
            onChange={(event) => setDagName(event.target.value)}
            className="w-full rounded bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        <div className="space-y-2">
          <span className="block text-xs uppercase tracking-wide text-slate-400">Управление</span>
          <button
            type="button"
            onClick={() => setIsConnectionManagerOpen(true)}
            className="w-full rounded bg-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-600"
          >
            🔌 Подключения к БД
          </button>
        </div>
        <div className="space-y-2">
          <span className="block text-xs uppercase tracking-wide text-slate-400">Добавить ноду</span>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => addNode('extract')}
              className="rounded bg-cyan-600 px-3 py-2 text-sm font-medium hover:bg-cyan-500"
            >
              Extract (DB)
            </button>
            <button
              type="button"
              onClick={() => addNode('source')}
              className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500"
            >
              Source
            </button>
            <button
              type="button"
              onClick={() => addNode('transform')}
              className="rounded bg-blue-600 px-3 py-2 text-sm font-medium hover:bg-blue-500"
            >
              Transform
            </button>
            <button
              type="button"
              onClick={() => addNode('load')}
              className="rounded bg-purple-600 px-3 py-2 text-sm font-medium hover:bg-purple-500"
            >
              load
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={generateDag}
            disabled={isLoading}
            className="w-full rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            {isLoading ? 'Генерация...' : 'Сгенерировать код'}
          </button>
          {statusMessage && <p className="text-xs text-slate-300">{statusMessage}</p>}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-200 mb-1">JSON Preview</h2>
          <pre className="max-h-48 overflow-auto rounded bg-slate-950/60 p-3 text-xs text-emerald-200">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </div>
      </aside>
      <main className="flex-1 h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={onNodeDoubleClick}
          fitView
          className="bg-slate-950"
        >
          <MiniMap className="!bg-slate-900/80" maskColor="#020617" nodeColor="#22d3ee" />
          <Controls className="bg-slate-900 text-white" />
          <Background gap={24} color="#334155" />
        </ReactFlow>
      </main>
    </div>
  );
}

export default App;
