import { Pencil, Plus, Trash2 } from "lucide-react";

const formatVnd = (amount) =>
	new Intl.NumberFormat("vi-VN", {
		style: "currency",
		currency: "VND",
		maximumFractionDigits: 0,
	}).format(amount);

function WalletSection({ wallets, onOpenAddWallet, onEditWallet, onDeleteWallet, getWalletDeleteState }) {
	const getWalletTypeLabel = (type) => {
		if (type === "linked") {
			return "Liên kết";
		}
		return "Tiền mặt";
	};

	return (
		<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
			<div className="mb-4 flex items-center justify-between">
				<h2 className="text-lg font-semibold text-slate-900">Danh sách các ví hiện tại</h2>
			</div>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
				<button
					type="button"
					onClick={onOpenAddWallet}
					className="group flex min-h-[160px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
				>
					<Plus className="mb-2 h-9 w-9" />
					<span className="text-sm font-medium">Thêm ví</span>
				</button>

				{wallets.map((wallet) => {
					const deleteState = getWalletDeleteState
						? getWalletDeleteState(wallet.id)
						: { disabled: false, reason: "" };

					return (
						<article
						key={wallet.id}
						className="relative flex min-h-[160px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
						>
						<span
							className="inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold"
							style={{ backgroundColor: `${wallet.color}20`, color: wallet.color }}
						>
							{getWalletTypeLabel(wallet.type)}
						</span>

						<div className="absolute right-3 top-3 flex items-center gap-1">
							<button
								type="button"
								onClick={() => onEditWallet(wallet)}
								className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-700"
								aria-label="Sửa ví"
							>
								<Pencil className="h-4 w-4" />
							</button>
							<span title={deleteState.disabled ? deleteState.reason : "Xóa ví"}>
								<button
									type="button"
									onClick={() => onDeleteWallet(wallet.id)}
									disabled={deleteState.disabled}
									className={`rounded-lg p-1.5 text-slate-400 ${
										deleteState.disabled
											? "cursor-not-allowed opacity-40"
											: "hover:bg-slate-100 hover:text-rose-600"
									}`}
									aria-label="Xóa ví"
								>
									<Trash2 className="h-4 w-4" />
								</button>
							</span>
						</div>

						<div>
							<h3 className="text-base font-semibold text-slate-900">{wallet.name}</h3>
							{wallet.type === "linked" && wallet.provider ? (
								<p className="mt-1 text-xs text-slate-500">Nhà cung cấp: {wallet.provider}</p>
							) : null}
						</div>

						<p className="text-right text-sm font-semibold text-slate-700">{formatVnd(wallet.balance)}</p>
						</article>
					);
				})}
			</div>
		</section>
	);
}

export default WalletSection;
