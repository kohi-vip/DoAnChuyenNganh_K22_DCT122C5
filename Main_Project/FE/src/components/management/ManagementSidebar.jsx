import {
	Bell,
	Bot,
	ChartColumnBig,
	CreditCard,
	History,
	Home,
	LogOut,
	Plus,
	Search,
	Settings,
	// User,  // tạm ẩn - chưa dùng
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { fetchUnreadNotificationCount } from "../../api/financeApi";
import { useAuth } from "../../stores/useAuth";

function ManagementSidebar({ onOpenCreateTransaction }) {
	const navigate = useNavigate();
	const { logout } = useAuth();
	const [unreadCount, setUnreadCount] = useState(0);

	useEffect(() => {
		let mounted = true;

		const loadUnreadCount = async () => {
			try {
				const count = await fetchUnreadNotificationCount();
				if (mounted) {
					setUnreadCount(count);
				}
			} catch {
				if (mounted) {
					setUnreadCount(0);
				}
			}
		};

		loadUnreadCount();
		const timer = window.setInterval(loadUnreadCount, 60000);

		return () => {
			mounted = false;
			window.clearInterval(timer);
		};
	}, []);

	const navItems = useMemo(
		() => [
			{ id: "home", label: "Trang chủ", icon: Home, path: "/dashboard" },
			{ id: "history", label: "Lịch sử giao dịch", icon: History, path: "/transactions" },
			{ id: "wallet-category", label: "Quản lý ví và danh mục", icon: CreditCard, path: "/wallet-categories" },
			{ id: "ai", label: "Trợ lý AI Jelly", icon: Bot, path: "/ai-assistant" },
			{ id: "report", label: "Thống kê", icon: ChartColumnBig, path: "/reports" },
			{ id: "notifications", label: "Thông báo", icon: Bell, path: "/notifications", badgeCount: unreadCount },
			{ id: "account", label: "Cài đặt tài khoản", icon: Settings, path: "/account-settings" },
		],
		[unreadCount]
	);

	const handleLogout = () => {
		const accepted = window.confirm("Bạn có chắc chắn muốn đăng xuất?");
		if (!accepted) {
			return;
		}
		logout();
		navigate("/login", { replace: true });
	};

	return (
		<aside className="sticky top-0 h-screen w-1/4 border-r border-slate-200 bg-white">
			<div className="flex h-full flex-col p-5">
				<div className="mb-5 flex items-center justify-between">
					<h1 className="text-lg font-semibold text-slate-900">CaiSoCai</h1>
					{/* Các nút User/Settings/Notification tạm thời ẩn, chưa sử dụng
				<div className="flex items-center gap-2">
						<button className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" type="button" aria-label="Hồ sơ cá nhân">
							<User className="h-4 w-4" />
						</button>
						<button className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" type="button" aria-label="Cài đặt">
							<Settings className="h-4 w-4" />
						</button>
						<button className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" type="button" aria-label="Thông báo">
							<span className="relative block">
								<Bell className="h-4 w-4" />
								<span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-blue-600" />
							</span>
						</button>
					</div>
				*/}
				</div>

				<label className="relative mb-5 block">
					<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
					<input
						type="text"
						placeholder="Tìm kiếm"
						className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-500"
					/>
				</label>

				<div className="mb-4 flex justify-center">
					<button
						type="button"
						onClick={onOpenCreateTransaction}
						className="inline-flex w-full max-w-[180px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
					>
						<Plus className="h-4 w-4" />
						<span>Thêm giao dịch</span>
					</button>
				</div>

				<nav className="space-y-1">
					{navItems.map((item) => {
						const Icon = item.icon;
						if (item.path) {
							return (
								<NavLink
									key={item.id}
									to={item.path}
									className={({ isActive }) =>
										`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
											isActive
												? "bg-blue-50 text-blue-700"
												: "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
										}`
								}
								>
									<Icon className="h-4 w-4" />
									<span>{item.label}</span>
									{item.badgeCount > 0 ? (
										<span className="ml-auto inline-flex min-w-5 justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
											{item.badgeCount > 99 ? "99+" : item.badgeCount}
										</span>
									) : null}
								</NavLink>
							);
						}

						return (
							<button
								key={item.id}
								type="button"
								className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
							>
								<Icon className="h-4 w-4" />
								<span>{item.label}</span>
							</button>
						);
					})}
				</nav>

				<div className="mt-auto pt-4">
					<button
						type="button"
						onClick={handleLogout}
						className="flex w-full items-center gap-3 rounded-xl border border-rose-200 px-3 py-2.5 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
					>
						<LogOut className="h-4 w-4" />
						<span>Đăng xuất</span>
					</button>
				</div>
			</div>
		</aside>
	);
}

export default ManagementSidebar;
