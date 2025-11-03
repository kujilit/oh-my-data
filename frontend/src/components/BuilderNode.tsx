import { memo, useMemo, type ChangeEventHandler } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';

type SourceOption = {
  id: string;
  label: string;
};

type BuilderNodeData = {
  label: string;
  type: string;
  config: Record<string, unknown> | undefined;
};

type NodeTypeOption = {
  id: string;
  label: string;
};

interface BuilderNodeProps extends NodeProps<BuilderNodeData> {
  availableSources: SourceOption[];
  availableNodeTypes: NodeTypeOption[];
  onLabelChange: (label: string) => void;
  onConfigChange: (config: Record<string, unknown>) => void;
  onTypeChange: (type: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  extract: 'Extract',
  source: 'Source',
  transform: 'Transform',
  load: 'Load',
};

const BuilderNode = ({
  data,
  selected,
  availableSources,
  availableNodeTypes,
  onLabelChange,
  onConfigChange,
  onTypeChange,
}: BuilderNodeProps) => {
  const config = useMemo(() => ({ ...(data.config ?? {}) }) as {
    sources?: string[];
    [key: string]: unknown;
  }, [data.config]);

  const selectedSources = Array.isArray(config.sources) ? config.sources : [];

  const toggleSource = (sourceId: string) => {
    const nextSources = selectedSources.includes(sourceId)
      ? selectedSources.filter((id) => id !== sourceId)
      : [...selectedSources, sourceId];
    onConfigChange({ ...config, sources: nextSources });
  };

  const handleLabelInput: ChangeEventHandler<HTMLInputElement> = (event) => {
    onLabelChange(event.target.value);
  };

  const handleTypeSelect: ChangeEventHandler<HTMLSelectElement> = (event) => {
    onTypeChange(event.target.value);
  };

  const typeBadge = TYPE_LABELS[data.type] ?? data.type;
  const canManipulateSources = data.type === 'source' || data.type === 'extract';

  return (
    <div
      className={`min-w-[220px] rounded-lg border bg-slate-900/90 px-4 py-3 text-xs shadow-lg transition-colors ${
        selected ? 'border-emerald-400 ring-2 ring-emerald-400/60' : 'border-slate-700'
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-emerald-400" />
      <Handle type="source" position={Position.Right} className="!bg-emerald-400" />

      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-400">
        <span>{typeBadge}</span>
        {data.type === 'extract' && typeof config.connection_name === 'string' && (
          <span className="text-emerald-300">{config.connection_name}</span>
        )}
      </div>

      <input
        value={data.label}
        onChange={handleLabelInput}
        onPointerDown={(event) => event.stopPropagation()}
        className="mt-2 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm font-medium text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />

      <div className="mt-3">
        <label className="text-[10px] uppercase tracking-wide text-slate-400">Тип ноды</label>
        <select
          value={data.type}
          onChange={handleTypeSelect}
          onPointerDown={(event) => event.stopPropagation()}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs font-medium text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          {availableNodeTypes.map((typeOption) => (
            <option key={typeOption.id} value={typeOption.id}>
              {typeOption.label}
            </option>
          ))}
        </select>
      </div>

      {data.type === 'extract' && typeof config.table === 'string' && (
        <div className="mt-2 text-[11px] text-slate-300">
          <div className="font-semibold text-slate-200">{config.table}</div>
          {typeof config.schema === 'string' && (
            <div className="text-slate-400">Schema: {config.schema}</div>
          )}
          {Array.isArray(config.columns) && config.columns.length > 0 && (
            <div className="mt-1 text-slate-400">
              {config.columns.length} column{config.columns.length > 1 ? 's' : ''} selected
            </div>
          )}
        </div>
      )}

      {canManipulateSources && (
        <div className="mt-3 space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">Источники данных</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {availableSources.map((source) => {
                const isActive = selectedSources.includes(source.id);
                return (
                  <button
                    key={source.id}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleSource(source.id);
                    }}
                    className={`rounded px-2 py-1 text-[11px] transition-colors ${
                      isActive
                        ? 'bg-emerald-500/90 text-slate-900'
                        : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    {source.label}
                  </button>
                );
              })}
            </div>
            {selectedSources.length === 0 && (
              <div className="mt-1 text-[10px] text-slate-500">Не выбрано</div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};

export default memo(BuilderNode);
