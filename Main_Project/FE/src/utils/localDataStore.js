// import seedData from "./seedData"; // không dùng seed data làm giá trị mặc định nữa

const LOCAL_DATA_KEY = "pfm_local_data_v1";

const createDefaultData = () => ({
  users: [],
  wallets: [],
  categories: [],
  transactions: [],
});

const readLocalData = () => {
  const raw = localStorage.getItem(LOCAL_DATA_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const getLocalData = () => {
  const existing = readLocalData();
  if (existing) {
    return existing;
  }

  const fallback = createDefaultData();
  localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(fallback));
  return fallback;
};

export const saveLocalData = (nextData) => {
  localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(nextData));
};

export const patchLocalData = (updater) => {
  const current = getLocalData();
  const next = updater(current);
  saveLocalData(next);
  return next;
};

export const getLocalUsers = () => getLocalData().users || [];

export const upsertLocalUser = (userLike) =>
  patchLocalData((current) => {
    const users = current.users || [];
    const index = users.findIndex((item) => item.id === userLike.id || item.email === userLike.email);

    if (index >= 0) {
      const nextUsers = [...users];
      nextUsers[index] = { ...nextUsers[index], ...userLike };
      return { ...current, users: nextUsers };
    }

    return { ...current, users: [...users, userLike] };
  });

export const persistAppData = ({ wallets, categories, transactions }) =>
  patchLocalData((current) => ({
    ...current,
    wallets: wallets || [],
    categories: categories || [],
    transactions: transactions || [],
  }));

export const getLocalAppData = () => {
  const data = getLocalData();
  return {
    wallets: data.wallets || [],
    categories: data.categories || [],
    transactions: data.transactions || [],
  };
};
