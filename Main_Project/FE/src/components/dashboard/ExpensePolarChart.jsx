const polarToCartesian = (cx, cy, radius, angleInDegrees) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
};

const buildSectorPath = (cx, cy, innerRadius, outerRadius, startAngle, endAngle) => {
  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
};

function ExpensePolarChart({ data }) {
  const formatCurrencyVnd = (amount) => `${new Intl.NumberFormat("vi-VN").format(amount)} VND`;
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const maxValue = Math.max(1, ...data.map((item) => item.value));

  let currentAngle = 0;
  const sectors = data.map((item) => {
    const angleSize = total > 0 ? (item.value / total) * 360 : 360 / Math.max(1, data.length);
    const startAngle = currentAngle;
    const endAngle = currentAngle + angleSize;
    currentAngle = endAngle;

    const outerRadius = 70 + (item.value / maxValue) * 40;

    return {
      ...item,
      path: buildSectorPath(130, 130, 38, outerRadius, startAngle, endAngle),
    };
  });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-900 md:text-base">Phân bổ chi tiêu cho danh mục cha</h3>

      <div className="flex flex-col items-center gap-4 md:flex-row md:items-start md:justify-between">
        <svg viewBox="0 0 260 260" className="h-[220px] w-[220px]">
          {sectors.map((sector) => (
            <path key={sector.id} d={sector.path} fill={sector.color} opacity="0.95" />
          ))}
          <circle cx="130" cy="130" r="28" fill="#ffffff" />
        </svg>

        <div className="w-full space-y-2 md:max-w-[180px]">
          {data.map((item) => (
            <div key={`legend-${item.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
              <span className="inline-flex items-center gap-2 text-sm text-slate-700">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name}
              </span>
              <span className="text-xs font-semibold text-slate-500">{formatCurrencyVnd(item.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ExpensePolarChart;
