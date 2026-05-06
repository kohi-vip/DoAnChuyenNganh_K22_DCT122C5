import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGet, mockPost, mockPut, mockPatch, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockPatch: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('../api/httpClient', () => ({
  default: {
    get: mockGet,
    post: mockPost,
    put: mockPut,
    patch: mockPatch,
    delete: mockDelete,
  },
}));

import {
  fetchWallets,
  fetchCategories,
  fetchTransactions,
  updateTransaction,
  createTransfer,
  fetchTransfers,
  fetchNotifications,
  parseTransactionText,
  ocrReceipt,
} from '../api/financeApi';

describe('financeApi normalization and request mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes wallet API responses with numeric balances and defaults', async () => {
    mockGet.mockResolvedValueOnce({
      data: [
        {
          id: 'wallet_1',
          name: 'Cash',
          balance: '12345.50',
          wallet_type: 'linked',
          currency: null,
          color: null,
          icon: null,
          is_active: false,
        },
      ],
    });

    const wallets = await fetchWallets();

    expect(mockGet).toHaveBeenCalledWith('/api/wallets');
    expect(wallets).toEqual([
      {
        id: 'wallet_1',
        name: 'Cash',
        balance: 12345.5,
        color: '#2563eb',
        type: 'linked',
        currency: 'VND',
        icon: 'wallet',
        is_active: false,
      },
    ]);
  });

  it('normalizes root categories and child category defaults', async () => {
    mockGet.mockResolvedValueOnce({
      data: [
        {
          id: 'cat_root',
          name: 'Food',
          type: 'expense',
          parent_id: null,
          color: null,
          icon: null,
          is_default: true,
          is_active: true,
          children: [
            {
              id: 'cat_child',
              name: 'Coffee',
              color: null,
              icon: null,
              is_active: false,
            },
          ],
        },
        {
          id: 'cat_flat_child',
          name: 'Ignored child',
          type: 'expense',
          parent_id: 'cat_root',
          children: [],
        },
      ],
    });

    const categories = await fetchCategories();

    expect(mockGet).toHaveBeenCalledWith('/api/categories');
    expect(categories).toHaveLength(1);
    expect(categories[0]).toMatchObject({
      id: 'cat_root',
      name: 'Food',
      type: 'expense',
      color: '#94a3b8',
      icon: 'default',
      is_default: true,
      is_active: true,
    });
    expect(categories[0].children).toEqual([
      {
        id: 'cat_child',
        name: 'Coffee',
        color: '#94a3b8',
        icon: 'default',
        is_active: false,
      },
    ]);
  });

  it('normalizes paginated transactions and keeps filter params', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 'tx_1',
            note: null,
            transacted_at: '2026-05-01T08:00:00',
            amount: '50000',
            type: 'expense',
            wallet_id: 'wallet_1',
            category_id: null,
            recurring_id: 'rec_1',
            source: null,
            is_reviewed: false,
            receipt_url: '',
            currency: null,
          },
        ],
        total: 1,
      },
    });

    const transactions = await fetchTransactions({ type: 'expense' });

    expect(mockGet).toHaveBeenCalledWith('/api/transactions', {
      params: { page: 1, page_size: 500, type: 'expense' },
    });
    expect(transactions[0]).toMatchObject({
      id: 'tx_1',
      description: '',
      date: '2026-05-01T08:00:00',
      transacted_at: '2026-05-01T08:00:00',
      amount: 50000,
      type: 'expense',
      walletId: 'wallet_1',
      categoryId: null,
      recurringId: 'rec_1',
      source: 'manual',
      is_reviewed: false,
      receipt_url: null,
      currency: 'VND',
    });
  });

  it('maps updateTransaction payload to backend fields and normalizes the response', async () => {
    mockPut.mockResolvedValueOnce({
      data: {
        id: 'tx_2',
        note: 'Salary',
        transacted_at: '2026-05-02T08:00:00',
        amount: '3000000',
        type: 'income',
        wallet_id: 'wallet_1',
        category_id: 'cat_income',
        recurring_id: null,
        source: 'manual',
        is_reviewed: true,
        receipt_url: null,
        currency: 'VND',
      },
    });

    const transaction = await updateTransaction('tx_2', {
      categoryId: 'cat_income',
      type: 'income',
      amount: '3000000',
      name: 'Salary',
      date: '2026-05-02T08:00:00',
    });

    expect(mockPut).toHaveBeenCalledWith('/api/transactions/tx_2', {
      category_id: 'cat_income',
      type: 'income',
      amount: 3000000,
      note: 'Salary',
      transacted_at: '2026-05-02T08:00:00',
      receipt_url: null,
      is_reviewed: true,
    });
    expect(transaction).toMatchObject({
      id: 'tx_2',
      name: 'Salary',
      walletId: 'wallet_1',
      categoryId: 'cat_income',
      amount: 3000000,
    });
  });

  it('maps transfer payloads both directions between FE and BE shapes', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        id: 'transfer_1',
        from_wallet_id: 'wallet_1',
        to_wallet_id: 'wallet_2',
        amount: '750000',
        note: 'Move cash',
        transferred_at: '2026-05-03T10:00:00',
      },
    });

    const transfer = await createTransfer({
      fromWalletId: 'wallet_1',
      toWalletId: 'wallet_2',
      amount: '750000',
      note: 'Move cash',
    });

    expect(mockPost).toHaveBeenCalledWith('/api/transfers', {
      from_wallet_id: 'wallet_1',
      to_wallet_id: 'wallet_2',
      amount: 750000,
      note: 'Move cash',
    });
    expect(transfer).toEqual({
      id: 'transfer_1',
      fromWalletId: 'wallet_1',
      toWalletId: 'wallet_2',
      amount: 750000,
      note: 'Move cash',
      transferredAt: '2026-05-03T10:00:00',
    });

    mockGet.mockResolvedValueOnce({
      data: [
        {
          id: 'transfer_2',
          from_wallet_id: 'wallet_2',
          to_wallet_id: 'wallet_1',
          amount: '125000',
          note: null,
          transferred_at: '2026-05-04T10:00:00',
        },
      ],
    });

    const transfers = await fetchTransfers();

    expect(mockGet).toHaveBeenCalledWith('/api/transfers');
    expect(transfers[0]).toMatchObject({
      id: 'transfer_2',
      fromWalletId: 'wallet_2',
      toWalletId: 'wallet_1',
      amount: 125000,
      note: null,
      transferredAt: '2026-05-04T10:00:00',
    });
  });

  it('normalizes notification pagination fields', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 'noti_1',
            user_id: 'user_1',
            recurring_id: null,
            title: 'Reminder',
            message: 'Pay soon',
            notification_type: 'reminder',
            scheduled_for: '2026-05-05T08:00:00',
            is_read: null,
            is_paid: true,
            read_at: '',
            created_at: '2026-05-01T08:00:00',
          },
        ],
        total: '1',
        page: '2',
        page_size: '10',
        total_pages: '3',
      },
    });

    const notifications = await fetchNotifications({ is_read: false });

    expect(mockGet).toHaveBeenCalledWith('/api/notifications', {
      params: { page: 1, page_size: 20, is_read: false },
    });
    expect(notifications).toMatchObject({
      total: 1,
      page: 2,
      pageSize: 10,
      totalPages: 3,
    });
    expect(notifications.items[0]).toMatchObject({
      id: 'noti_1',
      userId: 'user_1',
      recurringId: null,
      notificationType: 'reminder',
      scheduledFor: '2026-05-05T08:00:00',
      isRead: false,
      isPaid: true,
      readAt: null,
    });
  });

  it('normalizes AI parse amount and sends OCR files as multipart form data', async () => {
    mockPost.mockResolvedValueOnce({
      data: { amount: '120000', type: 'expense', note: 'coffee' },
    });

    const parsed = await parseTransactionText('coffee 120k');

    expect(mockPost).toHaveBeenCalledWith('/api/ai/parse-transaction', {
      text: 'coffee 120k',
    });
    expect(parsed).toEqual({ amount: 120000, type: 'expense', note: 'coffee' });

    const file = new File(['fake image'], 'receipt.png', { type: 'image/png' });
    mockPost.mockResolvedValueOnce({
      data: { amount: '99000', vendor: 'Cafe', type: 'expense' },
    });

    const ocrResult = await ocrReceipt(file);

    expect(mockPost).toHaveBeenLastCalledWith(
      '/api/ai/ocr-receipt',
      expect.any(FormData),
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      },
    );
    expect(ocrResult).toEqual({ amount: '99000', vendor: 'Cafe', type: 'expense' });
  });
});
