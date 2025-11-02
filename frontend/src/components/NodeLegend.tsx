const NodeLegend = () => (
  <ul className="space-y-1 text-xs text-slate-300">
    <li><span className="font-semibold text-emerald-300">Extract</span> — источник данных</li>
    <li><span className="font-semibold text-blue-300">Transform</span> — трансформация данных</li>
    <li><span className="font-semibold text-purple-300">Load</span> — выгрузка или сохранение</li>
  </ul>
);

export default NodeLegend;
