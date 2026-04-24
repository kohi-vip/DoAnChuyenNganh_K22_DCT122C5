import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateTransactionDrawer from '../components/transactions/CreateTransactionDrawer';

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockWallets = [
  { id: 'wallet_1', name: 'Ví tiền mặt', balance: 5000000, color: '#2563eb', type: 'basic' },
  { id: 'wallet_2', name: 'Ví ngân hàng', balance: 12000000, color: '#10b981', type: 'linked' },
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

// ─── Mock AppDataContext ──────────────────────────────────────────────────────

const mockSetTransactions = vi.fn();
const mockSetWallets = vi.fn();
const mockRefreshAll = vi.fn();

function createMockContext(overrides = {}) {
  return {
    wallets: mockWallets,
    setWallets: mockSetWallets,
    categories: mockCategories,
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

  describe('Category selection (danh mục)', () => {
    it('should NOT pre-select any category when drawer opens', () => {
      renderDrawer();
      const selectedText = screen.getByText('Chưa chọn');
      expect(selectedText).toBeInTheDocument();
    });

    it('should display "Chưa chọn" when no category is selected', () => {
      renderDrawer();
      expect(screen.getByText('Chưa chọn')).toBeInTheDocument();
    });

    it('should update selected label when user clicks a category', async () => {
      const { user } = renderDrawer();
      const foodCategory = screen.getByText('Ăn uống');
      await user.click(foodCategory);
      expect(screen.getByText('Đã chọn: Ăn uống')).toBeInTheDocument();
    });

    it('should update selected label when user clicks a child category', async () => {
      const { user } = renderDrawer();
      const coffeeCategory = screen.getByText('Cà phê');
      await user.click(coffeeCategory);
      expect(screen.getByText('Đã chọn: Ăn uống / Cà phê')).toBeInTheDocument();
    });
  });

  describe('Invoice attachment (đính kèm hóa đơn)', () => {
    it('should NOT have invoice attachment field', () => {
      renderDrawer();
      expect(screen.queryByText(/Đính kèm hóa đơn/i)).not.toBeInTheDocument();
    });

    it('should NOT have OCR button in AI Shortcut section', () => {
      renderDrawer();
      expect(screen.queryByText(/OCR/i)).not.toBeInTheDocument();
    });
  });

  describe('Notes field (ghi chú)', () => {
    it('should NOT have notes textarea', () => {
      renderDrawer();
      expect(screen.queryByText(/Ghi chú/i)).not.toBeInTheDocument();
    });
  });

  describe('Transaction content field (nội dung giao dịch)', () => {
    it('should have "Nội dung giao dịch" label', () => {
      renderDrawer();
      expect(screen.getByText('Nội dung giao dịch')).toBeInTheDocument();
    });

    it('should have default content options in select', () => {
      renderDrawer();
      expect(screen.getByText('-- Chọn nội dung --')).toBeInTheDocument();
      expect(screen.getByText('Ăn uống')).toBeInTheDocument();
      expect(screen.getByText('Di chuyển')).toBeInTheDocument();
      expect(screen.getByText('Mua sắm')).toBeInTheDocument();
      expect(screen.getByText('Giải trí')).toBeInTheDocument();
      expect(screen.getByText('Y tế')).toBeInTheDocument();
      expect(screen.getByText('Hóa đơn')).toBeInTheDocument();
      expect(screen.getByText('Nạp tiền')).toBeInTheDocument();
      expect(screen.getByText('Lương')).toBeInTheDocument();
      expect(screen.getByText('Chuyển khoản')).toBeInTheDocument();
      expect(screen.getByText('Khác (nhập tùy ý)')).toBeInTheDocument();
    });

    it('should fill input when user selects a preset option', async () => {
      const { user } = renderDrawer();
      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'Ăn uống');
      expect(select).toHaveValue('Ăn uống');
    });

    it('should show text input when user selects "Khác"', async () => {
      const { user } = renderDrawer();
      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'Khác');
      const customInput = screen.getByPlaceholderText('Nhập nội dung tùy ý...');
      expect(customInput).toBeInTheDocument();
    });

    it('should allow custom text input when "Khác" is selected', async () => {
      const { user } = renderDrawer();
      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'Khác');
      const customInput = screen.getByPlaceholderText('Nhập nội dung tùy ý...');
      await user.type(customInput, 'Mua đồ cho pet');
      expect(customInput).toHaveValue('Mua đồ cho pet');
    });
  });

  describe('Form validation', () => {
    it('should show error when trying to save without category', async () => {
      const { user } = renderDrawer();
      const amountInput = screen.getByRole('spinbutton');
      await user.clear(amountInput);
      await user.type(amountInput, '50000');

      const nameSelect = screen.getByRole('combobox');
      await user.selectOptions(nameSelect, 'Ăn uống');

      const saveButton = screen.getByRole('button', { name: 'Lưu' });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Vui lòng nhập đầy đủ thông tin/i)).toBeInTheDocument();
      });
    });

    it('should show error when trying to save without name/content', async () => {
      const { user } = renderDrawer();
      const amountInput = screen.getByRole('spinbutton');
      await user.clear(amountInput);
      await user.type(amountInput, '50000');

      const foodCategory = screen.getByText('Ăn uống');
      await user.click(foodCategory);

      const saveButton = screen.getByRole('button', { name: 'Lưu' });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Vui lòng nhập đầy đủ thông tin/i)).toBeInTheDocument();
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

      const { user, onClose } = renderDrawer();

      const amountInput = screen.getByRole('spinbutton');
      await user.clear(amountInput);
      await user.type(amountInput, '50000');

      const nameSelect = screen.getByRole('combobox');
      await user.selectOptions(nameSelect, 'Ăn uống');

      const foodCategory = screen.getByText('Ăn uống');
      await user.click(foodCategory);

      const saveButton = screen.getByRole('button', { name: 'Lưu' });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockRefreshAll).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('should send correct payload to API when creating transaction', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          id: 'tx_new_2',
          wallet_id: 'wallet_1',
          category_id: 'cat_food',
          type: 'expense',
          amount: '75000',
          transacted_at: new Date().toISOString(),
        },
      });

      const { user } = renderDrawer();

      const amountInput = screen.getByRole('spinbutton');
      await user.clear(amountInput);
      await user.type(amountInput, '75000');

      const nameSelect = screen.getByRole('combobox');
      await user.selectOptions(nameSelect, 'Di chuyển');

      const transportCategory = screen.getByText('Di chuyển');
      await user.click(transportCategory);

      const saveButton = screen.getByRole('button', { name: 'Lưu' });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/api/transactions', expect.objectContaining({
          name: 'Di chuyển',
          type: 'expense',
          amount: 75000,
        }));
      });
    });

    it('should NOT include note or receipt_url in payload', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          id: 'tx_new_3',
          wallet_id: 'wallet_1',
          category_id: 'cat_food',
          type: 'expense',
          amount: '100000',
          transacted_at: new Date().toISOString(),
        },
      });

      const { user } = renderDrawer();

      const amountInput = screen.getByRole('spinbutton');
      await user.clear(amountInput);
      await user.type(amountInput, '100000');

      const nameSelect = screen.getByRole('combobox');
      await user.selectOptions(nameSelect, 'Mua sắm');

      const foodCategory = screen.getByText('Ăn uống');
      await user.click(foodCategory);

      const saveButton = screen.getByRole('button', { name: 'Lưu' });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockPost).toHaveBeenCalledWith('/api/transactions', expect.not.objectContaining({
          note: expect.anything(),
          receipt_url: expect.anything(),
        }));
      });
    });
  });

  describe('Reset form after save', () => {
    it('should reset all fields after successful creation with keepOpen=false', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          id: 'tx_reset',
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

      const nameSelect = screen.getByRole('combobox');
      await user.selectOptions(nameSelect, 'Ăn uống');

      const foodCategory = screen.getByText('Ăn uống');
      await user.click(foodCategory);

      const saveButton = screen.getByRole('button', { name: 'Lưu' });
      await user.click(saveButton);

      await waitFor(() => {
        expect(amountInput).toHaveValue(0);
        expect(screen.getByText('Chưa chọn')).toBeInTheDocument();
      });
    });

    it('should show error toast when API call fails', async () => {
      mockPost.mockRejectedValueOnce({
        response: {
          status: 500,
          data: { detail: 'Server error' },
        },
      });

      const { user } = renderDrawer();

      const amountInput = screen.getByRole('spinbutton');
      await user.clear(amountInput);
      await user.type(amountInput, '50000');

      const nameSelect = screen.getByRole('combobox');
      await user.selectOptions(nameSelect, 'Ăn uống');

      const foodCategory = screen.getByText('Ăn uống');
      await user.click(foodCategory);

      const saveButton = screen.getByRole('button', { name: 'Lưu' });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Không thể tạo giao dịch/i)).toBeInTheDocument();
      });
    });
  });
});
