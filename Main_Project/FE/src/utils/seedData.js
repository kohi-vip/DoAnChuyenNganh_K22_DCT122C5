const now = new Date();

const toISODateTime = (daysAgo) => {
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
};

export const users = [
  {
    id: "user_001",
    email: "demo.finance@example.com",
    password: "12345678Nguyen",
    full_name: "Demo User",
    default_currency: "VND",
    created_at: toISODateTime(120),
  },
];

export const wallets = [
  { id: "wallet_1", name: "Vi tien mat", balance: 5000000, color: "#2563eb", type: "basic", provider: null },
  { id: "wallet_2", name: "Vi ngan hang", balance: 12000000, color: "#10b981", type: "linked", provider: "Bank" },
  { id: "wallet_3", name: "Vi du lich", balance: 3500000, color: "#ec4899", type: "basic", provider: null },
];

export const categories = [
  {
    id: "cat_food",
    name: "An uong",
    icon: "food",
    type: "expense",
    badge: "An uong",
    color: "#ec4899",
    children: [
      { id: "cat_coffee", name: "Ca phe", color: "#ec4899" },
      { id: "cat_breakfast", name: "An sang", color: "#ec4899" },
    ],
  },
  {
    id: "cat_transport",
    name: "Di chuyen",
    icon: "transport",
    type: "expense",
    badge: "Di chuyen",
    color: "#06b6d4",
    children: [{ id: "cat_grab", name: "Grab", color: "#06b6d4" }],
  },
  {
    id: "cat_salary",
    name: "Luong",
    icon: "income",
    type: "income",
    badge: "Chinh",
    color: "#16a34a",
    children: [{ id: "cat_bonus", name: "Thuong quy", color: "#16a34a" }],
  },
];

const generateTransactions = () => {
  const names = [
    "An trua",
    "Cafe sang",
    "Di Grab",
    "Mua do gia dung",
    "Nhan luong",
    "Thuong KPI",
    "Mua sach",
    "Di sieu thi",
    "Nap dien thoai",
    "Chi phi internet",
    "Chuyen noi bo",
  ];

  const descriptions = [
    "Chi tieu trong ngay",
    "Thanh toan nhanh",
    "Giao dich tu dong",
    "Thanh toan dinh ky",
    "Cap nhat thang",
  ];

  const walletIds = ["wallet_1", "wallet_2", "wallet_3"];
  const expenseCats = ["cat_food", "cat_coffee", "cat_transport", "cat_grab"];
  const incomeCats = ["cat_salary", "cat_bonus"];

  const rows = [];

  for (let i = 1; i <= 55; i += 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    if (i % 10 === 0) {
      rows.push({
        id: `tx_${i}`,
        name: names[10],
        description: "Chuyen giua cac vi",
        date: date.toISOString(),
        amount: 500000,
        type: "transfer",
        walletId: walletIds[i % walletIds.length],
        categoryId: "cat_transfer",
        source: "internal_transfer",
        is_reviewed: true,
      });
      continue;
    }

    const isIncome = i % 4 === 0;
    rows.push({
      id: `tx_${i}`,
      name: names[i % 10],
      description: descriptions[i % descriptions.length],
      date: date.toISOString(),
      amount: (isIncome ? 1200 : 100 + (i % 7) * 35) * 1000,
      type: isIncome ? "income" : "expense",
      walletId: walletIds[i % walletIds.length],
      categoryId: isIncome ? incomeCats[i % incomeCats.length] : expenseCats[i % expenseCats.length],
      source: i % 6 === 0 ? "auto_sync" : "manual",
      is_reviewed: i % 6 === 0 ? false : true,
    });
  }

  return rows;
};

export const transactions = generateTransactions();

const seedData = {
  users,
  wallets,
  categories,
  transactions,
};

export default seedData;
