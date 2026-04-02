import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const formatCurrencyVnd = (value) => `${new Intl.NumberFormat("vi-VN").format(Math.round(value))} VNĐ`;

const palette = ["#2563eb", "#64748b", "#0ea5e9", "#14b8a6", "#e11d48", "#f59e0b", "#8b5cf6", "#22c55e"];

const normalizeDistinctColors = (rows) => {
  const used = new Set();
  let paletteIndex = 0;

  return rows.map((row) => {
    const preferred = row.color ? String(row.color).toLowerCase() : "";
    let resolvedColor = preferred;

    if (!resolvedColor || used.has(resolvedColor)) {
      while (used.has(palette[paletteIndex % palette.length])) {
        paletteIndex += 1;
      }
      resolvedColor = palette[paletteIndex % palette.length];
      paletteIndex += 1;
    }

    used.add(resolvedColor);
    return { ...row, color: resolvedColor };
  });
};

const recursiveTotal = (node, amountByCategoryId) => {
  const selfAmount = amountByCategoryId.get(node.id) || 0;
  const childrenTotal = (node.children || []).reduce(
    (sum, child) => sum + recursiveTotal(child, amountByCategoryId),
    0
  );

  return selfAmount + childrenTotal;
};

function DrilldownExpensePieChart({ categories, transactions }) {
  const [drillState, setDrillState] = useState({
    parentId: null,
    parentName: "",
    data: [],
  });

  const expenseParents = useMemo(
    () => categories.filter((category) => category.type === "expense"),
    [categories]
  );

  const amountByCategoryId = useMemo(() => {
    const map = new Map();

    transactions.forEach((item) => {
      if (item.type !== "expense" || item.type === "transfer" || item.is_reviewed !== true) {
        return;
      }

      map.set(item.categoryId, (map.get(item.categoryId) || 0) + item.amount);
    });

    return map;
  }, [transactions]);

  const parentData = useMemo(() => {
    const rows = expenseParents
      .map((parent) => ({
        id: parent.id,
        name: parent.name,
        value: recursiveTotal(parent, amountByCategoryId),
        color: parent.color || "",
      }))
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value);

    return normalizeDistinctColors(rows);
  }, [expenseParents, amountByCategoryId]);

  useEffect(() => {
    if (!drillState.parentId) {
      return;
    }

    const exists = parentData.some((item) => item.id === drillState.parentId);
    if (!exists) {
      setDrillState({ parentId: null, parentName: "", data: [] });
    }
  }, [drillState.parentId, parentData]);

  const chartData = useMemo(() => {
    if (!drillState.parentId) {
      return parentData;
    }

    return drillState.data;
  }, [drillState, parentData]);

  const onPieSliceClick = (_, index) => {
    if (drillState.parentId) {
      return;
    }

    const selectedParent = parentData[index];
    if (!selectedParent) {
      return;
    }

    const parentCategory = expenseParents.find((item) => item.id === selectedParent.id);
    if (!parentCategory) {
      return;
    }

    const subRows = (parentCategory.children || [])
      .map((child) => ({
        id: child.id,
        name: child.name,
        value: recursiveTotal(child, amountByCategoryId),
        color: child.color || "",
      }))
      .filter((row) => row.value > 0);

    const parentSelfAmount = amountByCategoryId.get(parentCategory.id) || 0;
    if (parentSelfAmount > 0) {
      subRows.push({
        id: `${parentCategory.id}__self`,
        name: "Khác",
        value: parentSelfAmount,
        color: parentCategory.color || "",
      });
    }

    const coloredSubRows = normalizeDistinctColors(subRows);
    if (coloredSubRows.length === 0) {
      return;
    }

    setDrillState({
      parentId: parentCategory.id,
      parentName: parentCategory.name,
      data: coloredSubRows,
    });
  };

  const hasData = chartData.some((item) => item.value > 0);

  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 md:text-base">Phân bổ chi tiêu theo danh mục</h3>
          <p className="text-xs text-slate-500">
            {drillState.parentId ? `Chi tiết danh mục: ${drillState.parentName}` : "Nhấp vào lát cắt để drill-down theo danh mục con"}
          </p>
        </div>

        {drillState.parentId ? (
          <button
            type="button"
            onClick={() => setDrillState({ parentId: null, parentName: "", data: [] })}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Quay lại
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_220px]">
        <div className="h-[320px] w-full overflow-hidden">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={110}
                innerRadius={48}
                paddingAngle={2}
                onClick={onPieSliceClick}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`${entry.id}-${index}`} fill={entry.color || palette[index % palette.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrencyVnd(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2">
          {hasData ? (
            chartData.map((item, index) => (
              <div key={`${item.id}-${index}`} className="rounded-lg border border-slate-200 px-3 py-2">
                <div className="mb-1 inline-flex items-center gap-2 text-sm text-slate-700">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color || palette[index % palette.length] }}
                  />
                  {item.name}
                </div>
                <p className="text-xs font-semibold text-slate-500">{formatCurrencyVnd(item.value)}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Không có dữ liệu chi tiêu cho biểu đồ.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export default DrilldownExpensePieChart;
