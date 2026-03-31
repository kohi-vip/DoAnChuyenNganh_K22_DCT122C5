import {
	ChevronDown,
	ChevronRight,
	HandCoins,
	Pencil,
	Plus,
	Soup,
	Trash2,
	TramFront,
	Wallet,
} from "lucide-react";

const iconMap = {
	food: Soup,
	transport: TramFront,
	income: HandCoins,
	default: Wallet,
};

function CategorySection({
	activeTab,
	onTabChange,
	categories,
	expandedParents,
	onToggleParent,
	onOpenAddCategory,
	onEditCategory,
	onDeleteCategory,
	getCategoryDeleteState,
}) {
	const filteredParents = categories.filter((item) => item.type === activeTab);

	return (
		<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
				<h2 className="text-lg font-semibold text-slate-900">Danh sách danh mục</h2>

				<div className="flex items-center gap-2">
					<div className="flex rounded-xl bg-slate-100 p-1">
						<button
							type="button"
							onClick={() => onTabChange("income")}
							className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
								activeTab === "income" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"
							}`}
						>
							Thu nhập
						</button>
						<button
							type="button"
							onClick={() => onTabChange("expense")}
							className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
								activeTab === "expense" ? "bg-white text-blue-700 shadow-sm" : "text-slate-600"
							}`}
						>
							Chi tiêu
						</button>
					</div>

					<button
						type="button"
						onClick={onOpenAddCategory}
						className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
					>
						<Plus className="h-4 w-4" />
						Thêm danh mục
					</button>
				</div>
			</div>

			<div className="space-y-2">
				{filteredParents.map((parent) => {
					const ParentIcon = iconMap[parent.icon] || iconMap.default;
					const expanded = expandedParents.includes(parent.id);
					const parentDeleteState = getCategoryDeleteState
						? getCategoryDeleteState(parent.id, null)
						: { disabled: false, reason: "" };

					return (
						<div key={parent.id} className="rounded-xl border border-slate-200 bg-white">
							<button
								type="button"
								onClick={() => onToggleParent(parent.id)}
								className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-slate-50"
							>
								<div className="flex items-center gap-2.5">
									<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
										<ParentIcon className="h-4 w-4" />
									</div>
									<p className="text-sm font-medium text-slate-800">{parent.name}</p>
									<span
										className="rounded-full px-2 py-0.5 text-xs font-semibold"
										style={{ color: parent.color, backgroundColor: `${parent.color}22` }}
									>
										{parent.badge || "Nhóm"}
									</span>
								</div>

								<div className="flex items-center gap-1">
									<button
										type="button"
										onClick={(event) => {
											event.stopPropagation();
											onEditCategory(parent, null);
										}}
										className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-700"
										aria-label="Sửa danh mục cha"
									>
										<Pencil className="h-4 w-4" />
									</button>
									<span title={parentDeleteState.disabled ? parentDeleteState.reason : "Xóa danh mục cha"}>
										<button
											type="button"
											onClick={(event) => {
												event.stopPropagation();
												onDeleteCategory(parent.id, null);
											}}
											disabled={parentDeleteState.disabled}
											className={`rounded-md p-1 text-slate-400 ${
												parentDeleteState.disabled
													? "cursor-not-allowed opacity-40"
													: "hover:bg-slate-100 hover:text-rose-600"
											}`}
											aria-label="Xóa danh mục cha"
										>
											<Trash2 className="h-4 w-4" />
										</button>
									</span>

									{expanded ? (
										<ChevronDown className="h-4 w-4 text-slate-500" />
									) : (
										<ChevronRight className="h-4 w-4 text-slate-500" />
									)}
								</div>
							</button>

							{expanded && parent.children.length > 0 ? (
								<div className="relative ml-7 mr-3 border-l border-slate-200 py-1">
									{parent.children.map((child) => {
										const childDeleteState = getCategoryDeleteState
											? getCategoryDeleteState(child.id, parent.id)
											: { disabled: false, reason: "" };

										return (
										<div
											key={child.id}
											className="relative ml-3 flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-50"
										>
											<span className="absolute -left-3 top-1/2 h-px w-3 -translate-y-1/2 bg-slate-200" />
											<p className="text-sm text-slate-700">{child.name}</p>
											<div className="flex items-center gap-1">
												<button
													type="button"
													onClick={() => onEditCategory(child, parent.id)}
													className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-blue-700"
													aria-label="Sửa danh mục con"
												>
													<Pencil className="h-4 w-4" />
												</button>
												<span title={childDeleteState.disabled ? childDeleteState.reason : "Xóa danh mục con"}>
													<button
														type="button"
														onClick={() => onDeleteCategory(child.id, parent.id)}
														disabled={childDeleteState.disabled}
														className={`rounded-md p-1 text-slate-400 ${
															childDeleteState.disabled
																? "cursor-not-allowed opacity-40"
																: "hover:bg-slate-100 hover:text-rose-600"
														}`}
														aria-label="Xóa danh mục con"
													>
														<Trash2 className="h-4 w-4" />
													</button>
												</span>
											</div>
										</div>
										);
									})}
								</div>
							) : null}
						</div>
					);
				})}
			</div>
		</section>
	);
}

export default CategorySection;
