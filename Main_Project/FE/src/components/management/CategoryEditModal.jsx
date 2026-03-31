import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const presetColors = ["#ec4899", "#ef4444", "#f97316", "#2563eb", "#06b6d4", "#22c55e", "#8b5cf6"];

function CategoryEditModal({ open, mode, initialData, onClose, onSubmitCategory, activeType, parentOptions }) {
	const [name, setName] = useState("");
	const [type, setType] = useState(activeType);
	const [parentId, setParentId] = useState("");
	const [color, setColor] = useState("#ec4899");

	useEffect(() => {
		if (!open) {
			return;
		}

		if (mode === "edit" && initialData) {
			setName(initialData.name ?? "");
			setType(initialData.type ?? activeType);
			setParentId(initialData.parentId ?? "");
			setColor(initialData.color ?? "#ec4899");
			return;
		}

		setName("");
		setType(activeType);
		setParentId("");
		setColor("#ec4899");
	}, [open, mode, initialData, activeType]);

	const canSubmit = useMemo(() => name.trim().length > 0, [name]);

	if (!open) {
		return null;
	}

	const handleSubmit = (event) => {
		event.preventDefault();
		if (!canSubmit) {
			return;
		}

		onSubmitCategory({
			id: initialData?.id ?? `cat_${Date.now()}`,
			name: name.trim(),
			type,
			color,
			children: [],
			parentId: parentId || null,
		});
		onClose();
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
			<div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
				<div className="mb-5 flex items-center justify-between">
					<h3 className="text-lg font-semibold text-slate-900">
						{mode === "edit" ? "Sửa danh mục" : "Thêm danh mục"}
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<form className="space-y-4" onSubmit={handleSubmit}>
					<div>
						<label className="mb-1 block text-sm font-medium text-slate-700">Tên danh mục</label>
						<input
							value={name}
							onChange={(event) => setName(event.target.value)}
							className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500"
							placeholder="Ví dụ: Ăn ngoài"
							required
						/>
					</div>

					<div>
						<label className="mb-1 block text-sm font-medium text-slate-700">Loại danh mục</label>
						<select
							value={type}
							onChange={(event) => setType(event.target.value)}
							className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500"
						>
							<option value="income">Thu nhập</option>
							<option value="expense">Chi tiêu</option>
						</select>
					</div>

					<div>
						<label className="mb-1 block text-sm font-medium text-slate-700">Danh mục cha (không bắt buộc)</label>
						<select
							value={parentId}
							onChange={(event) => setParentId(event.target.value)}
							className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500"
						>
							<option value="">Không có (Parent)</option>
							{parentOptions
								.filter((item) => item.type === type)
								.map((item) => (
									<option key={item.id} value={item.id}>
										{item.name}
									</option>
								))}
						</select>
					</div>

					<div>
						<p className="mb-1 text-sm font-medium text-slate-700">Màu sắc hiển thị</p>
						<div className="mb-3 flex flex-wrap gap-2">
							{presetColors.map((preset) => (
								<button
									key={preset}
									type="button"
									onClick={() => setColor(preset)}
									className={`h-7 w-7 rounded-full border-2 ${color === preset ? "border-slate-900" : "border-transparent"}`}
									style={{ backgroundColor: preset }}
									aria-label={`Chọn màu ${preset}`}
								/>
							))}
						</div>
						<input
							value={color}
							onChange={(event) => setColor(event.target.value)}
							className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm outline-none transition focus:border-blue-500"
							placeholder="#ec4899"
						/>
					</div>

					<button
						type="submit"
						className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
						disabled={!canSubmit}
					>
						{mode === "edit" ? "Lưu thay đổi" : "Thêm danh mục"}
					</button>
				</form>
			</div>
		</div>
	);
}

export default CategoryEditModal;
