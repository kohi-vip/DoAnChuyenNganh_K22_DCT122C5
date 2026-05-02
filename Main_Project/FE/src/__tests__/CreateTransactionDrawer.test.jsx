import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateTransactionDrawer from '../components/transactions/CreateTransactionDrawer';

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockWallets = [
  { id: 'wallet_1', name: 'Ví tiền mặt', balance: 5000000, color: '#2563eb', type: 'basic' },
  { id: 'wallet_2', name: 'Ví ngân hàng', balance: 12000000, color: '#10b981', type: 'linked' },
  { id: 'wallet_3', name: 'Ví tiết kiệm', balance: 2000000, color: '#f59e0b', type: 'basic' },
];

const mockCategories = [
  {
    id: 'cat_food',
    name: 'Ăn uống',
    type: 'expense',
    color: '#ec4899',
    children: [
      { id: 'cat_coffee', name: 'Cà phê', color: '#ec4899' },
      { id: 'cat_breakfast', name: 'Ăn sáng', color: '#ec4899' },
    ],
  },
  {
    id: 'cat_transport',
    name: 'Di chuyển',
    type: 'expense',
    color: '#06b6d4',
    children: [
      { id: 'cat_grab', name: 'Grab', color: '#06b6d4' },
    ],
  },
  {
    id: 'cat_salary',
    name: 'Lương',
    type: 'income',
    color: '#16a34a',
    children: [
      { id: 'cat_bonus', name: 'Thưởng', color: '#16a34a' },
    ],
  },
];

const mockTransactions = [];

// ─── Mock AppDataContext ──────────────────────────────────────────────────────

const mockSetTransactions = vi.fn();
const mockSetWallets = vi.fn();
const mockRefreshAll = vi.fn();

function createMockContext(overrides = {}) {
  return {
    wallets: mockWallets,
    setWallets: mockSetWallets,
    categories: mockCategories,
    transactions: mockTransactions,
    setTransactions: mockSetTransactions,
    refreshAll: mockRefreshAll,
    ...overrides,
  };
}

vi.mock('../stores/AppDataContext', () => ({
  useAppData: vi.fn(),
}));

import { useAppData } from '../stores/AppDataContext';

// ─── Mock httpClient ──────────────────────────────────────────────────────────

const mockPost = vi.fn();

vi.mock('../api/httpClient', () => ({
  default: {
    post: mockPost,
  },
}));

// ─── Mock createTransfer ──────────────────────────────────────────────────────

const mockCreateTransfer = vi.fn();

vi.mock('../api/financeApi', () => ({
  createTransfer: mockCreateTransfer,
}));

// ─── Helper ───────────────────────────────────────────────────────────────────

function renderDrawer(contextOverrides = {}) {
  const user = userEvent.setup();
  const context = createMockContext(contextOverrides);
  useAppData.mockReturnValue(context);

  const onClose = vi.fn();
  render(<CreateTransactionDrawer open={true} onClose={onClose} />);

  return { user, onClose, context };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CreateTransactionDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Category selection (danh mục) — không chọn trước', () => {
    it('should NOT pre-select any category when drawer opens', () => {
      renderDrawer();
      expect(screen.getByText('Chưa chọn')).toBeInTheDocument();
    });

    it('should display "Chưa chọn" when no category is selected', () => {
      renderDrawer();
      expect(screen.getByText('Chưa chọn')).toBeInTheDocument();
    });

    it('should update selected label when user clicks a category', async () => {
      const { user } = renderDrawer();
      await user.click(screen.getByText('Ăn uống'));
      expect(screen.getByText('Đã chọn: Ăn uống')).toBeInTheDocument();
    });

    it('should update selected label when user clicks a child category', async () => {
      const { user } = renderDrawer();
      await user.click(screen.getByText('Cà phê'));
      expect(screen.getByText('Đã chọn: Ăn uống / Cà phê')).toBeInTheDocument();
    });
  });

  describe('Invoice attachment (đính kèm hóa đơn) — bỏ đính kèm', () => {
    it('should NOT have invoice attachment field', () => {
      renderDrawer();
      expect(screen.queryByText(/Đính kèm hóa đơn/i)).not.toBeInTheDocument();
    });

    it('should NOT have OCR button in AI Shortcut section', () => {
      renderDrawer();
      expect(screen.queryByText(/OCR/i)).not.toBeInTheDocument();
    });
  });

  describe('Notes field (ghi chú) — bỏ ghi chú', () => {
    it('should NOT have notes textarea', () => {
      renderDrawer();
      expect(screen.queryByText(/Ghi chú/i)).not.toBeInTheDocument();
    });
  });

  describe('Transaction content field (nội dung giao dịch) — preset dropdown', () => {
    it('should have "Nội dung giao dịch" label', () => {
      renderDrawer();
      expect(screen.getByText('Nội dung giao dịch')).toBeInTheDocument();
    });

    it('should render preset options in the select dropdown', () => {
      renderDrawer();
      const select = screen.getByRole('combobox');
      const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
      expect(options).toContain('Ăn uống');
      expect(options).toContain('Di chuyển');
      expect(options).toContain('Mua sắm');
      expect(options).toContain('Giải trí');
      expect(options).toContain('Y tế');
      expect(options).toContain('Hóa đơn');
      expect(options).toContain('Nạp tiền');
      expect(options).toContain('Lương');
      expect(options).toContain('Chuyển khoản');
      expect(options).toContain('Khác (nhập tùy ý)');
    });

    it('should fill preset option value when user selects from dropdown', async () => {
      const { user } = renderDrawer();
      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'Di chuyển');
      expect(select).toHaveValue('Di chuyển');
    });

    it('should show custom text input when user selects "Khác (nhập tùy ý)"', async () => {
      const { user } = renderDrawer();
      const select = screen.getByRole('combobox');
      await user.selectOptions(select, '__custom__');
      expect(screen.getByPlaceholderText('Nhập nội dung tùy ý...')).toBeInTheDocument();
    });

    it('should allow custom text input when "Khác" is selected', async () => {
      const { user } = renderDrawer();
      const select = screen.getByRole('combobox');
      await user.selectOptions(select, '__custom__');
      const customInput = screen.getByPlaceholderText('Nhập nội dung tùy ý...');
      await user.type(customInput, 'Mua đồ cho pet');
      expect(customInput).toHaveValue('Mua đồ cho pet');
    });

    it('should NOT show custom input for preset options', async () => {
      const { user } = renderDrawer();
      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'Ăn uống');
      expect(screen.queryByPlaceholderText('Nhập nội dung tùy ý...')).not.toBeInTheDocument();
    });
  });

  describe('Form validation', () => {
    it('should show error when saving without amount', async () => {
      const { user } = renderDrawer();
      const saveButton = screen.getByRole('button', { name: 'Lưu' });
      await user.click(saveButton);
      await waitFor(() => {
        expect(screen.getByText(/Vui lòng nhập đầy đủ thông tin/i)).toBeInTheDocument();
      });
    });

    it('should show error when saving without content/name', async () => {
      const { user } = renderDrawer();
      const amountInput = screen.getByRole('spinbutton');
      await user.clear(amountInput);
      await user.type(amountInput, '50000');
      const saveButton = screen.getByRole('button', { name: 'Lưu' });
      await user.click(saveButton);
      await waitFor(() => {
        expect(screen.getByText(/Vui lòng chọn hoặc nhập nội dung/i)).toBeInTheDocument();
      });
    });

    it('should allow save without category selected', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          id: 'tx_nocat',
          wallet_id: 'wallet_1',
          type: 'expense',
          amount: '50000',
          transacted_at: new Date().toISOString(),
        },
      });
      const { user } = renderDrawer();
      const amountInput = screen.getByRole('spinbutton');
      await user.clear(amountInput);
      await user.type(amountInput, '50000');
      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'Ăn uống');
      const saveButton = screen.getByRole('button', { name: 'Lưu' });
      await user.click(saveButton);
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/api/transactions', expect.objectContaining({
          note: 'Ăn uống',
        }));
      });
    });
  });

  describe('Transaction creation', () => {
    it('should call refreshAll after successful transaction creation', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          id: 'tx_new',
          wallet_id: 'wallet_1',
          category_id: 'cat_food',
          type: 'expense',
          amount: '50000',
          transacted_at: new Date().toISOString(),
        },
      });
      const { user } = renderDrawer();
      const amountInput = screen.getByRole('spinbutton');
      await user.clear(amountInput);
      await user.type(amountInput, '50000');
      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'Ăn uống');
      await user.click(screen.getByText('Ăn uống'));
      const saveButton = screen.getByRole('button', { name: 'Lưu' });
      await user.click(saveButton);
      await waitFor(() => { expect(mockRefreshAll).toHaveBeenCalledTimes(1); });
    });

    it('should send note field (not name) in API payload', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          id: 'tx_new_2',
          wallet_id: 'wallet_1',
          type: 'expense',
          amount: '75000',
          transacted_at: new Date().toISOString(),
        },
      });
      const { user } = renderDrawer();
      const amountInput = screen.getByRole('spinbutton');
      await user.clear(amountInput);
      await user.type(amountInput, '75000');
      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'Di chuyển');
      const saveButton = screen.getByRole('button', { name: 'Lưu' });
      await user.click(saveButton);
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/api/transactions', expect.objectContaining({
          note: 'Di chuyển',
        }));
      });
    });

    it('should NOT include receipt_url in payload', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          id: 'tx_new_3',
          wallet_id: 'wallet_1',
          type: 'expense',
          amount: '100000',
          transacted_at: new Date().toISOString(),
        },
      });
      const { user } = renderDrawer();
      const amountInput = screen.getByRole('spinbutton');
      await user.clear(amountInput);
      await user.type(amountInput, '100000');
      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'Mua sắm');
      const saveButton = screen.getByRole('button', { name: 'Lưu' });
      await user.click(saveButton);
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/api/transactions', expect.not.objectContaining({
          receipt_url: expect.anything(),
        }));
      });
    });

    it('should show error toast when API call fails', async () => {
      mockPost.mockRejectedValueOnce({
        response: { status: 500, data: { detail: 'Server error' } },
      });
      const { user } = renderDrawer();
      const amountInput = screen.getByRole('spinbutton');
      await user.clear(amountInput);
      await user.type(amountInput, '50000');
      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'Ăn uống');
      const saveButton = screen.getByRole('button', { name: 'Lưu' });
      await user.click(saveButton);
      await waitFor(() => {
        expect(screen.getByText(/Không thể tạo giao dịch/i)).toBeInTheDocument();
      });
    });
  });

  describe('Mode switcher', () => {
    it('should show 3 mode buttons by default', () => {
      renderDrawer();
      expect(screen.getByText('Giao dịch thường')).toBeInTheDocument();
      expect(screen.getByText('Giao dịch định kỳ')).toBeInTheDocument();
      expect(screen.getByText('Chuyển ví')).toBeInTheDocument();
    });

    it('should switch to transfer mode and show wallet selectors', async () => {
      const { user } = renderDrawer();
      await user.click(screen.getByText('Chuyển ví'));
      expect(screen.getByText('Số tiền chuyển')).toBeInTheDocument();
      expect(screen.getByText('Từ ví')).toBeInTheDocument();
      expect(screen.getByText('Sang ví')).toBeInTheDocument();
    });

    it('should switch back to transaction mode', async () => {
      const { user } = renderDrawer();
      await user.click(screen.getByText('Chuyển ví'));
      await user.click(screen.getByText('Giao dịch thường'));
      expect(screen.getByText('Nội dung giao dịch')).toBeInTheDocument();
    });
  });

  describe('Transfer mode (chuyển ví)', () => {
    it('should show error when source and destination wallets are the same', async () => {
      const { user } = renderDrawer();
      await user.click(screen.getByText('Chuyển ví'));
      const amountInput = screen.getByRole('spinbutton');
      await user.clear(amountInput);
      await user.type(amountInput, '100000');
      const saveButton = screen.getByRole('button', { name: 'Lưu' });
      await user.click(saveButton);
      await waitFor(() => {
        expect(screen.getByText(/Ví nguồn và ví đích không được trùng nhau/i)).toBeInTheDocument();
      });
    });

    it('should call createTransfer API with correct payload', async () => {
      mockCreateTransfer.mockResolvedValueOnce({
        data: { id: 'transfer_1', amount: '500000' },
      });
      const { user } = renderDrawer();
      await user.click(screen.getByText('Chuyển ví'));
      const amountInput = screen.getByRole('spinbutton');
      await user.clear(amountInput);
      await user.type(amountInput, '500000');
      const saveButton = screen.getByRole('button', { name: 'Lưu' });
      await user.click(saveButton);
      await waitFor(() => {
        expect(mockCreateTransfer).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 500000,
          })
        );
      });
    });

    it('should call refreshAll after successful transfer', async () => {
      mockCreateTransfer.mockResolvedValueOnce({ data: { id: 'transfer_2' } });
      const { user } = renderDrawer();
      await user.click(screen.getByText('Chuyển ví'));
      const amountInput = screen.getByRole('spinbutton');
      await user.clear(amountInput);
      await user.type(amountInput, '300000');
      const saveButton = screen.getByRole('button', { name: 'Lưu' });
      await user.click(saveButton);
      await waitFor(() => {
        expect(mockRefreshAll).toHaveBeenCalledTimes(1);
      });
    });

    it('should show insufficient balance error', async () => {
      const { user } = renderDrawer({ wallets: [{ id: 'w1', name: 'Ví ít tiền', balance: 100000, color: '#2563eb' }] });
      await user.click(screen.getByText('Chuyển ví'));
      const amountInput = screen.getByRole('spinbutton');
      await user.clear(amountInput);
      await user.type(amountInput, '500000');
      const saveButton = screen.getByRole('button', { name: 'Lưu' });
      await user.click(saveButton);
      await waitFor(() => {
        expect(screen.getByText(/Số dư ví nguồn không đủ/i)).toBeInTheDocument();
      });
    });
  });

  describe('Recurring mode', () => {
    it('should NOT require category when switching to recurring mode', async () => {
      mockPost.mockResolvedValueOnce({ data: { id: 'recurring_1' } });
      const { user } = renderDrawer();
      await user.click(screen.getByText('Giao dịch định kỳ'));
      const amountInput = screen.getByRole('spinbutton');
      await user.clear(amountInput);
      await user.type(amountInput, '500000');
      const saveButton = screen.getByRole('button', { name: 'Lưu' });
      await user.click(saveButton);
      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/api/recurring', expect.any(Object));
      });
    });
  });

  describe('Reload đồng bộ sau tạo giao dịch', () => {
    it('should call refreshAll for recurring mode after creation', async () => {
      mockPost.mockResolvedValueOnce({ data: { id: 'recurring_reload' } });
      const { user } = renderDrawer();
      await user.click(screen.getByText('Giao dịch định kỳ'));
      const amountInput = screen.getByRole('spinbutton');
      await user.clear(amountInput);
      await user.type(amountInput, '1000000');
      const saveButton = screen.getByRole('button', { name: 'Lưu' });
      await user.click(saveButton);
      await waitFor(() => {
        expect(mockRefreshAll).toHaveBeenCalledTimes(1);
      });
    });
  });
});
