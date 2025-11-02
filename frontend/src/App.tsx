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
  NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';
import NodeLegend from './components/NodeLegend';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

type NodeCategory = 'source' | 'transform' | 'sink';

type BuilderNode = Node<{
  label: string;
  type: NodeCategory;
  config: Record<string, unknown>;
}>;

const initialNodes: BuilderNode[] = [
  {
    id: '1',
    position: { x: 0, y: 0 },
    data: { label: 'Source: Users', type: 'source', config: { query: 'SELECT * FROM users' } },
    type: 'default',
  },
  {
    id: '2',
    position: { x: 250, y: 0 },
    data: {
      label: 'Transform: Filter Active',
      type: 'transform',
      config: { function: "[x for x in data if x['active']]" },
    },
    type: 'default',
  },
  {
    id: '3',
    position: { x: 500, y: 0 },
    data: { label: 'Sink: Active Users', type: 'sink', config: { table: 'active_users' } },
    type: 'default',
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
  source: { label: 'New Source', config: { query: 'SELECT * FROM table' } },
  transform: { label: 'New Transform', config: { code: 'return data' } },
  sink: { label: 'New Sink', config: { destination: 'table_name' } },
};

function App() {
  const [nodes, setNodes] = useState<BuilderNode[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [nodeCounter, setNodeCounter] = useState(initialNodes.length + 1);
  const [dagName, setDagName] = useState('example_etl');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

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

  const addNode = useCallback(
    (category: NodeCategory) => {
      setNodes((prev) => {
        const id = String(nodeCounter);
        const position = { x: 100 * nodeCounter, y: 100 };
        const definition = nodeTypeConfig[category];
        const newNode: BuilderNode = {
          id,
          position,
          data: {
            label: `${definition.label} ${id}`,
            type: category,
            config: definition.config,
          },
          type: 'default',
        };
        return [...prev, newNode];
      });
      setNodeCounter((value) => value + 1);
    },
    [nodeCounter]
  );

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

  return (
    <div className="flex h-full w-full">
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
          <span className="block text-xs uppercase tracking-wide text-slate-400">Добавить ноду</span>
          <div className="flex flex-col gap-2">
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
              onClick={() => addNode('sink')}
              className="rounded bg-purple-600 px-3 py-2 text-sm font-medium hover:bg-purple-500"
            >
              Sink
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
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
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
