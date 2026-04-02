import { useState } from "react";
import {
	createCategory,
	createWallet,
	deleteCategory,
	deleteWallet,
	fetchCategories,
	fetchWallets,
	updateCategory,
	updateWallet,
} from "../api/financeApi";
import NotificationDialog from "../components/common/NotificationDialog";
import CategoryEditModal from "../components/management/CategoryEditModal";
import CategorySection from "../components/management/CategorySection";
import AddWalletModal from "../components/management/AddWalletModal";
import WalletSection from "../components/management/WalletSection";
import { useAppData } from "../stores/AppDataContext";

const findCategoryParentId = (categoryList, categoryId) => {
	for (const parent of categoryList) {
		if (parent.id === categoryId) {
			return null;
		}
		if (parent.children.some((child) => child.id === categoryId)) {
			return parent.id;
		}
	}
	return null;
};

function ManagementPage() {
	const { wallets, setWallets, categories, setCategories, transactions } = useAppData();
	const [activeTab, setActiveTab] = useState("expense");
	const [expandedParents, setExpandedParents] = useState(["cat_food", "cat_transport"]);
	const [walletModalOpen, setWalletModalOpen] = useState(false);
	const [walletModalMode, setWalletModalMode] = useState("create");
	const [editingWallet, setEditingWallet] = useState(null);
	const [categoryModalOpen, setCategoryModalOpen] = useState(false);
	const [categoryModalMode, setCategoryModalMode] = useState("create");
	const [editingCategory, setEditingCategory] = useState(null);
	const [feedback, setFeedback] = useState(null);

	const toggleParent = (parentId) => {
		setExpandedParents((current) =>
			current.includes(parentId) ? current.filter((id) => id !== parentId) : [...current, parentId]
		);
	};

	const showError = (message) => {
		setFeedback({ type: "error", message });
	};

	const showSuccess = (message) => {
		setFeedback({ type: "success", message });
	};

	const handleOpenAddWallet = () => {
		setWalletModalMode("create");
		setEditingWallet(null);
		setWalletModalOpen(true);
	};

	const handleOpenEditWallet = (wallet) => {
		setWalletModalMode("edit");
		setEditingWallet(wallet);
		setWalletModalOpen(true);
	};

	const handleUpsertWallet = async (wallet) => {
		try {
			if (walletModalMode === "edit") {
				const updated = await updateWallet(wallet.id, wallet);
				setWallets((current) => current.map((item) => (item.id === wallet.id ? { ...item, ...updated } : item)));
				showSuccess("Đã cập nhật thông tin ví.");
			} else {
				const created = await createWallet(wallet);
				setWallets((current) => [...current, created]);
				showSuccess("Đã thêm ví mới.");
			}
		} catch (err) {
			showError(err?.response?.data?.detail || "Không thể lưu ví. Vui lòng thử lại.");
		}
	};

	const handleDeleteWallet = async (walletId) => {
		const hasLinkedTransactions = transactions.some((item) => item.walletId === walletId);
		if (hasLinkedTransactions) {
			showError("Không thể xóa vì ví đang có giao dịch liên kết.");
			return;
		}

		try {
			await deleteWallet(walletId);
			// Tải lại wallets từ API để đồng bộ số dư
			const updated = await fetchWallets();
			setWallets(updated);
			showSuccess("Đã xóa ví thành công.");
		} catch (err) {
			showError(err?.response?.data?.detail || "Không thể xóa ví. Vui lòng thử lại.");
		}
	};

	const handleOpenAddCategory = () => {
		setCategoryModalMode("create");
		setEditingCategory(null);
		setCategoryModalOpen(true);
	};

	const handleOpenEditCategory = (category, parentId) => {
		const resolvedParentId = parentId ?? findCategoryParentId(categories, category.id);
		const parentRef = resolvedParentId ? categories.find((item) => item.id === resolvedParentId) : null;
		setCategoryModalMode("edit");
		setEditingCategory({
			id: category.id,
			name: category.name,
			type: category.type ?? parentRef?.type ?? activeTab,
			color: category.color ?? parentRef?.color ?? "#ec4899",
			parentId: resolvedParentId,
		});
		setCategoryModalOpen(true);
	};

	const addCategory = async (category) => {
		try {
			await createCategory(category);
			// Tải lại toàn bộ categories từ API để đảm bảo cấu trúc parent/child đúng
			const updated = await fetchCategories();
			setCategories(updated);
			if (!category.parentId) {
				setExpandedParents((current) => [...current, category.id]);
				showSuccess("Đã thêm danh mục mới.");
			} else {
				setExpandedParents((current) =>
					current.includes(category.parentId) ? current : [...current, category.parentId]
				);
				showSuccess("Đã thêm danh mục con mới.");
			}
		} catch (err) {
			showError(err?.response?.data?.detail || "Không thể thêm danh mục. Vui lòng thử lại.");
		}
	};

	const hasTransactionsByCategoryId = (categoryId) =>
		transactions.some((item) => item.categoryId === categoryId);

	const getWalletDeleteState = (walletId) => {
		const hasLinkedTransactions = transactions.some((item) => item.walletId === walletId);
		if (hasLinkedTransactions) {
			return { disabled: true, reason: "Không thể xóa vì ví đang có giao dịch liên kết" };
		}
		return { disabled: false, reason: "" };
	};

	const getCategoryDeleteState = (categoryId, parentId) => {
		if (hasTransactionsByCategoryId(categoryId)) {
			return { disabled: true, reason: "Không thể xóa vì danh mục đang có giao dịch liên kết" };
		}

		if (!parentId) {
			const target = categories.find((item) => item.id === categoryId);
			if (target && target.children.length > 0) {
				return { disabled: true, reason: "Không thể xóa vì danh mục cha đang chứa danh mục con" };
			}
		}

		return { disabled: false, reason: "" };
	};

	const updateCategoryLocal = (payload) => {
		// Validation thuần local (không cần API) trước khi gọi API
		let extracted = null;

		const removedCurrent = categories.flatMap((parent) => {
			if (parent.id === payload.id) {
				extracted = {
					id: parent.id,
					name: parent.name,
					type: parent.type,
					color: parent.color,
					badge: parent.badge,
					icon: parent.icon,
					children: parent.children,
					parentId: null,
				};
				return [];
			}

			const childIndex = parent.children.findIndex((child) => child.id === payload.id);
			if (childIndex >= 0) {
				const child = parent.children[childIndex];
				extracted = {
					id: child.id,
					name: child.name,
					type: parent.type,
					color: child.color ?? parent.color,
					badge: "Tùy chỉnh",
					icon: "default",
					children: [],
					parentId: parent.id,
				};
				return [{ ...parent, children: parent.children.filter((c) => c.id !== payload.id) }];
			}

			return [parent];
		});

		if (!extracted) return { error: "Không tìm thấy danh mục để cập nhật." };

		const nextType = payload.type;
		const nextParentId = payload.parentId;

		if (extracted.children.length > 0 && nextParentId)
			return { error: "Không thể chuyển danh mục cha có danh mục con thành danh mục cấp 2." };
		if (hasTransactionsByCategoryId(payload.id) && extracted.type !== nextType)
			return { error: "Không thể đổi loại danh mục đang có giao dịch liên kết." };
		if (nextParentId) {
			const targetParent = removedCurrent.find((item) => item.id === nextParentId);
			if (!targetParent) return { error: "Danh mục cha không tồn tại." };
			if (targetParent.type !== nextType) return { error: "Danh mục con phải cùng loại với danh mục cha." };
		}

		return { ok: true, removedCurrent, extracted, nextParentId };
	};

	const updateCategoryHandler = async (payload) => {
		const check = updateCategoryLocal(payload);
		if (check.error) {
			showError(check.error);
			return;
		}

		try {
			await updateCategory(payload.id, {
				name: payload.name,
				color: payload.color,
				icon: payload.icon,
			});
			// Tải lại từ API để cấu trúc parent/child chính xác
			const updated = await fetchCategories();
			setCategories(updated);
			if (check.nextParentId) {
				setExpandedParents((current) =>
					!current.includes(check.nextParentId) ? [...current, check.nextParentId] : current
				);
			}
			showSuccess("Đã cập nhật danh mục.");
		} catch (err) {
			showError(err?.response?.data?.detail || "Không thể cập nhật danh mục. Vui lòng thử lại.");
		}
	};

	const handleUpsertCategory = async (category) => {
		if (categoryModalMode === "edit") {
			await updateCategoryHandler(category);
			return;
		}

		await addCategory(category);
	};

	const handleDeleteCategory = async (categoryId, parentId) => {
		if (hasTransactionsByCategoryId(categoryId)) {
			showError("Không thể xóa vì danh mục đang có giao dịch liên kết.");
			return;
		}

		if (!parentId) {
			const target = categories.find((item) => item.id === categoryId);
			if (target && target.children.length > 0) {
				showError("Không thể xóa vì danh mục cha đang chứa danh mục con.");
				return;
			}
		}

		try {
			await deleteCategory(categoryId);
			const updated = await fetchCategories();
			setCategories(updated);
			setExpandedParents((current) => current.filter((item) => item !== categoryId));
			showSuccess(parentId ? "Đã xóa danh mục con." : "Đã xóa danh mục.");
		} catch (err) {
			showError(err?.response?.data?.detail || "Không thể xóa danh mục. Vui lòng thử lại.");
		}
	};

	return (
		<div className="space-y-5 text-slate-900">
			<div>
				<h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
					Quản lý ví và danh mục
				</h1>
				<p className="mt-1 text-sm text-slate-600">
					Theo dõi danh sách ví và tổ chức danh mục thu chi của bạn.
				</p>
			</div>
			<WalletSection
				wallets={wallets}
				onOpenAddWallet={handleOpenAddWallet}
				onEditWallet={handleOpenEditWallet}
				onDeleteWallet={handleDeleteWallet}
				getWalletDeleteState={getWalletDeleteState}
			/>
			<CategorySection
				activeTab={activeTab}
				onTabChange={setActiveTab}
				categories={categories}
				expandedParents={expandedParents}
				onToggleParent={toggleParent}
				onOpenAddCategory={handleOpenAddCategory}
				onEditCategory={handleOpenEditCategory}
				onDeleteCategory={handleDeleteCategory}
				getCategoryDeleteState={getCategoryDeleteState}
			/>

			<AddWalletModal
				open={walletModalOpen}
				onClose={() => setWalletModalOpen(false)}
				mode={walletModalMode}
				initialData={editingWallet}
				onSubmitWallet={handleUpsertWallet}
			/>

			<CategoryEditModal
				open={categoryModalOpen}
				onClose={() => setCategoryModalOpen(false)}
				mode={categoryModalMode}
				initialData={editingCategory}
				onSubmitCategory={handleUpsertCategory}
				activeType={activeTab}
				parentOptions={categories}
			/>

			<NotificationDialog
				open={Boolean(feedback)}
				type={feedback?.type === "error" ? "error" : "success"}
				title={feedback?.type === "error" ? "Thao tác không thành công" : "Thao tác thành công"}
				message={feedback?.message || ""}
				onClose={() => setFeedback(null)}
			/>
		</div>
	);
}

export default ManagementPage;
