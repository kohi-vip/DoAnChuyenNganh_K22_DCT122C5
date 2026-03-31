import { useState } from "react";
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

	const handleUpsertWallet = (wallet) => {
		if (walletModalMode === "edit") {
			setWallets((current) => current.map((item) => (item.id === wallet.id ? { ...item, ...wallet } : item)));
			showSuccess("Đã cập nhật thông tin ví.");
			return;
		}

		setWallets((current) => [...current, wallet]);
		showSuccess("Đã thêm ví mới.");
	};

	const handleDeleteWallet = (walletId) => {
		const hasLinkedTransactions = transactions.some((item) => item.walletId === walletId);
		if (hasLinkedTransactions) {
			return;
		}

		setWallets((current) => current.filter((item) => item.id !== walletId));
		showSuccess("Đã xóa ví thành công.");
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

	const addCategory = (category) => {
		if (!category.parentId) {
			setCategories((current) => [
				...current,
				{
					id: category.id,
					name: category.name,
					type: category.type,
					color: category.color,
					badge: "Tùy chỉnh",
					icon: "default",
					children: [],
				},
			]);
			setExpandedParents((current) => [...current, category.id]);
			showSuccess("Đã thêm danh mục mới.");
			return;
		}

		setCategories((current) =>
			current.map((item) =>
				item.id === category.parentId
					? {
							...item,
							children: [...item.children, { id: category.id, name: category.name }],
						}
					: item
			)
		);
		setExpandedParents((current) =>
			current.includes(category.parentId) ? current : [...current, category.parentId]
		);
		showSuccess("Đã thêm danh mục con mới.");
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

	const updateCategory = (payload) => {
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

				return [
					{
						...parent,
						children: parent.children.filter((childItem) => childItem.id !== payload.id),
					},
				];
			}

			return [parent];
		});

		if (!extracted) {
			showError("Không tìm thấy danh mục để cập nhật.");
			return;
		}

		const nextType = payload.type;
		const nextParentId = payload.parentId;

		if (extracted.children.length > 0 && nextParentId) {
			showError("Không thể chuyển danh mục cha có danh mục con thành danh mục cấp 2.");
			return;
		}

		if (hasTransactionsByCategoryId(payload.id) && extracted.type !== nextType) {
			showError("Không thể đổi loại danh mục đang có giao dịch liên kết.");
			return;
		}

		if (!nextParentId) {
			setCategories([
				...removedCurrent,
				{
					id: payload.id,
					name: payload.name,
					type: nextType,
					color: payload.color,
					badge: extracted.badge || "Tùy chỉnh",
					icon: extracted.icon || "default",
					children: extracted.children,
				},
			]);
			showSuccess("Đã cập nhật danh mục.");
			return;
		}

		const targetParent = removedCurrent.find((item) => item.id === nextParentId);
		if (!targetParent) {
			showError("Danh mục cha không tồn tại.");
			return;
		}

		if (targetParent.type !== nextType) {
			showError("Danh mục con phải cùng loại với danh mục cha.");
			return;
		}

		setCategories(
			removedCurrent.map((item) =>
				item.id === nextParentId
					? {
						...item,
						children: [...item.children, { id: payload.id, name: payload.name, color: payload.color }],
					}
					: item
			)
		);

		setExpandedParents((current) =>
			!current.includes(nextParentId) ? [...current, nextParentId] : current
		);
		showSuccess("Đã cập nhật danh mục.");
	};

	const handleUpsertCategory = (category) => {
		if (categoryModalMode === "edit") {
			updateCategory(category);
			return;
		}

		addCategory(category);
	};

	const handleDeleteCategory = (categoryId, parentId) => {
		if (hasTransactionsByCategoryId(categoryId)) {
			return;
		}

		if (!parentId) {
			const target = categories.find((item) => item.id === categoryId);
			if (target && target.children.length > 0) {
				return;
			}

			setCategories((current) => current.filter((item) => item.id !== categoryId));
			setExpandedParents((current) => current.filter((item) => item !== categoryId));
			showSuccess("Đã xóa danh mục.");
			return;
		}

		setCategories((current) =>
			current.map((item) =>
				item.id === parentId
					? { ...item, children: item.children.filter((child) => child.id !== categoryId) }
					: item
			)
		);
		showSuccess("Đã xóa danh mục con.");
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
