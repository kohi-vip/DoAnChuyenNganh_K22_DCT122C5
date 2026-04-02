import { useMemo, useState } from "react";
import DailyExpenseLineChart from "../components/reports/DailyExpenseLineChart";
import DrilldownExpensePieChart from "../components/reports/DrilldownExpensePieChart";
import IncomeExpenseBarChart from "../components/reports/IncomeExpenseBarChart";
import ReportsFilters from "../components/reports/ReportsFilters";
import ReportsSummaryCards from "../components/reports/ReportsSummaryCards";
import TopInsightsPanel from "../components/reports/TopInsightsPanel";
import { useAppData } from "../stores/AppDataContext";

const toDateInputValue = (date) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const toMonthInputValue = (date) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${y}-${m}`;
};

const getFilterRange = ({ mode, monthValue, yearValue, customFrom, customTo }) => {
  const now = new Date();

  if (mode === "month") {
    const [year, month] = (monthValue || toMonthInputValue(now)).split("-").map(Number);
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end };
  }

  if (mode === "year") {
    const year = Number(yearValue) || now.getFullYear();
    const start = new Date(year, 0, 1, 0, 0, 0, 0);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);
    return { start, end };
  }

  const fallbackStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const fallbackEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const start = customFrom ? new Date(`${customFrom}T00:00:00`) : fallbackStart;
  const end = customTo ? new Date(`${customTo}T23:59:59`) : fallbackEnd;

  if (start > end) {
    return { start: end, end: start };
  }

  return { start, end };
};

const getMonthBuckets = (start, end) => {
  const buckets = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const limit = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= limit) {
    buckets.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      label: cursor.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      income: 0,
      expense: 0,
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return buckets;
};

const buildCategoryMappings = (categories) => {
  const parentIdByCategoryId = new Map();

  const walk = (node, parentId) => {
    const resolvedParentId = parentId || node.id;
    parentIdByCategoryId.set(node.id, resolvedParentId);

    (node.children || []).forEach((child) => walk(child, resolvedParentId));
  };

  categories.forEach((parent) => walk(parent, null));

  return { parentIdByCategoryId };
};

const recursiveNodeTotal = (node, amountByCategoryId) => {
  const selfAmount = amountByCategoryId.get(node.id) || 0;
  const childrenTotal = (node.children || []).reduce(
    (sum, child) => sum + recursiveNodeTotal(child, amountByCategoryId),
    0
  );

  return selfAmount + childrenTotal;
};

function ReportsPage() {
  const now = new Date();
  const { categories, transactions } = useAppData();
  const [mode, setMode] = useState("month");
  const [monthValue, setMonthValue] = useState(toMonthInputValue(now));
  const [yearValue, setYearValue] = useState(String(now.getFullYear()));
  const [customFrom, setCustomFrom] = useState(toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [customTo, setCustomTo] = useState(toDateInputValue(now));

  const range = useMemo(
    () => getFilterRange({ mode, monthValue, yearValue, customFrom, customTo }),
    [mode, monthValue, yearValue, customFrom, customTo]
  );

  const validTransactions = useMemo(
    () =>
      transactions.filter(
        (item) => item.is_reviewed === true && (item.type === "income" || item.type === "expense")
      ),
    [transactions]
  );

  const filteredTransactions = useMemo(
    () =>
      validTransactions.filter((item) => {
        const date = new Date(item.date);
        return date >= range.start && date <= range.end;
      }),
    [validTransactions, range]
  );

  const summary = useMemo(() => {
    const totalIncome = filteredTransactions
      .filter((item) => item.type === "income")
      .reduce((sum, item) => sum + item.amount, 0);

    const totalExpense = filteredTransactions
      .filter((item) => item.type === "expense")
      .reduce((sum, item) => sum + item.amount, 0);

    const netBalance = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? (netBalance / totalIncome) * 100 : 0;

    return { totalIncome, totalExpense, netBalance, savingsRate };
  }, [filteredTransactions]);

  const monthlyBarData = useMemo(() => {
    const buckets = getMonthBuckets(range.start, range.end);
    const lookup = new Map(buckets.map((item) => [item.key, { ...item }]));

    filteredTransactions.forEach((item) => {
      const date = new Date(item.date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const bucket = lookup.get(key);
      if (!bucket) {
        return;
      }

      if (item.type === "income") {
        bucket.income += item.amount;
      }

      if (item.type === "expense") {
        bucket.expense += item.amount;
      }
    });

    return buckets.map((item) => lookup.get(item.key));
  }, [filteredTransactions, range]);

  const categoryAnalytics = useMemo(() => {
    const expenseParents = categories.filter((category) => category.type === "expense");
    const amountByCategoryId = new Map();

    filteredTransactions.forEach((item) => {
      if (item.type !== "expense") {
        return;
      }

      amountByCategoryId.set(item.categoryId, (amountByCategoryId.get(item.categoryId) || 0) + item.amount);
    });

    const parentData = expenseParents
      .map((parent) => ({
        id: parent.id,
        name: parent.name,
        value: recursiveNodeTotal(parent, amountByCategoryId),
        color: parent.color || "#94a3b8",
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);

    const childDataByParent = {};

    expenseParents.forEach((parent) => {
      const rows = (parent.children || [])
        .map((child) => ({
          id: child.id,
          name: child.name,
          value: recursiveNodeTotal(child, amountByCategoryId),
          color: child.color || parent.color || "#94a3b8",
        }))
        .filter((item) => item.value > 0);

      const selfAmount = amountByCategoryId.get(parent.id) || 0;
      if (selfAmount > 0) {
        rows.push({
          id: `${parent.id}__self`,
          name: "Khác",
          value: selfAmount,
          color: parent.color || "#94a3b8",
        });
      }

      childDataByParent[parent.id] = rows;
    });

    return { parentData, childDataByParent };
  }, [categories, filteredTransactions]);

  const topCategories = useMemo(
    () => categoryAnalytics.parentData.slice(0, 5),
    [categoryAnalytics.parentData]
  );

  const comparisonText = useMemo(() => {
    if (topCategories.length === 0) {
      return "Không đủ dữ liệu để so sánh với tháng trước.";
    }

    const { parentIdByCategoryId } = buildCategoryMappings(categories);
    const topCategory = topCategories[0];

    const monthStart = new Date(range.end.getFullYear(), range.end.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(range.end.getFullYear(), range.end.getMonth() + 1, 0, 23, 59, 59, 999);
    const prevStart = new Date(range.end.getFullYear(), range.end.getMonth() - 1, 1, 0, 0, 0, 0);
    const prevEnd = new Date(range.end.getFullYear(), range.end.getMonth(), 0, 23, 59, 59, 999);

    const sumByPeriod = (start, end) =>
      validTransactions.reduce((sum, item) => {
        if (item.type !== "expense") {
          return sum;
        }

        const parentId = parentIdByCategoryId.get(item.categoryId);
        const date = new Date(item.date);

        if (parentId === topCategory.id && date >= start && date <= end) {
          return sum + item.amount;
        }

        return sum;
      }, 0);

    const currentTotal = sumByPeriod(monthStart, monthEnd);
    const previousTotal = sumByPeriod(prevStart, prevEnd);

    if (previousTotal <= 0) {
      return `${topCategory.name}: chưa có dữ liệu tháng trước để so sánh.`;
    }

    const diffPercent = ((currentTotal - previousTotal) / previousTotal) * 100;
    const direction = diffPercent >= 0 ? "tăng" : "giảm";

    return `${topCategory.name}: ${direction} ${Math.abs(diffPercent).toFixed(1)}% so với tháng trước.`;
  }, [topCategories, categories, range, validTransactions]);

  const largeTransactions = useMemo(() => {
    const expenseRows = filteredTransactions.filter((item) => item.type === "expense");
    if (expenseRows.length === 0) {
      return [];
    }

    const avg = expenseRows.reduce((sum, item) => sum + item.amount, 0) / expenseRows.length;
    const threshold = avg * 1.8;

    return expenseRows
      .filter((item) => item.amount >= threshold)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [filteredTransactions]);

  return (
    <div className="space-y-4 text-slate-900">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Thống kê</h1>
        <p className="mt-1 text-sm text-slate-600">Phân tích thu chi và xu hướng tài chính theo thời gian.</p>
      </header>

      <div className="grid grid-cols-1 gap-4">
        <ReportsFilters
          mode={mode}
          onModeChange={setMode}
          monthValue={monthValue}
          onMonthChange={setMonthValue}
          yearValue={yearValue}
          onYearChange={setYearValue}
          customFrom={customFrom}
          onCustomFromChange={setCustomFrom}
          customTo={customTo}
          onCustomToChange={setCustomTo}
        />

        <ReportsSummaryCards
          totalIncome={summary.totalIncome}
          totalExpense={summary.totalExpense}
          netBalance={summary.netBalance}
          savingsRate={summary.savingsRate}
        />
      </div>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <IncomeExpenseBarChart data={monthlyBarData} />
          <DailyExpenseLineChart transactions={transactions} />
        </div>

        <div className="xl:col-span-4">
          <TopInsightsPanel
            topCategories={topCategories}
            comparisonText={comparisonText}
            largeTransactions={largeTransactions}
          />
        </div>
      </section>

      <DrilldownExpensePieChart
        categories={categories}
        transactions={filteredTransactions}
      />
    </div>
  );
}

export default ReportsPage;
