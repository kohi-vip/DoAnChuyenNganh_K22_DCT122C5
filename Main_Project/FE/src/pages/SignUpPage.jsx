import { Eye, EyeOff, Lock, Mail, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import AuthSplitLayout from "../components/auth/AuthSplitLayout";
import { useAuth } from "../stores/useAuth";
import { isEmailValid, isPasswordValid } from "../utils/authSession";

function SignUpPage() {
	const navigate = useNavigate();
	const { register, isAuthenticated } = useAuth();
	const [lastName, setLastName] = useState("");
	const [firstName, setFirstName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState("");
	const [submitting, setSubmitting] = useState(false);

	if (isAuthenticated) {
		return <Navigate to="/dashboard" replace />;
	}

	const handleSubmit = async (event) => {
		event.preventDefault();
		setError("");

		if (!lastName.trim() || !firstName.trim()) {
			setError("Vui lòng nhập đầy đủ Họ và Tên.");
			return;
		}

		if (!isEmailValid(email)) {
			setError("Email không đúng định dạng.");
			return;
		}

		if (!isPasswordValid(password)) {
			setError("Mật khẩu phải dài hơn 8 ký tự, gồm chữ hoa, chữ thường và số.");
			return;
		}

		try {
			setSubmitting(true);
			await register({ lastName, firstName, email, password });
			navigate("/dashboard", { replace: true });
		} catch (apiError) {
			setError(apiError?.response?.data?.detail || apiError?.message || "Đăng ký thất bại.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<AuthSplitLayout
			title="Đăng ký"
			subtitle="Tạo tài khoản mới để bắt đầu quản lý thu chi hiệu quả."
			footer={
				<>
					Đã có tài khoản?{" "}
					<Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700">
						Đăng nhập
					</Link>
				</>
			}
		>
			<form onSubmit={handleSubmit} className="space-y-4">
				<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
					<label className="block">
						<span className="mb-1.5 block text-sm font-medium text-slate-700">Họ</span>
						<div className="relative">
							<UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
							<input
								value={lastName}
								onChange={(event) => setLastName(event.target.value)}
								className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-500"
								required
							/>
						</div>
					</label>

					<label className="block">
						<span className="mb-1.5 block text-sm font-medium text-slate-700">Tên</span>
						<input
							value={firstName}
							onChange={(event) => setFirstName(event.target.value)}
							className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500"
							required
						/>
					</label>
				</div>

				<label className="block">
					<span className="mb-1.5 block text-sm font-medium text-slate-700">Email</span>
					<div className="relative">
						<Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
						<input
							type="email"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							placeholder="you@example.com"
							className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-500"
							autoComplete="email"
							required
						/>
					</div>
				</label>

				<label className="block">
					<span className="mb-1.5 block text-sm font-medium text-slate-700">Mật khẩu</span>
					<div className="relative">
						<Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
						<input
							type={showPassword ? "text" : "password"}
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							placeholder="•••••••••"
							className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-10 text-sm text-slate-700 outline-none transition focus:border-blue-500"
							autoComplete="new-password"
							required
						/>
						<button
							type="button"
							onClick={() => setShowPassword((current) => !current)}
							className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
							aria-label="Hiện hoặc ẩn mật khẩu"
						>
							{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
						</button>
					</div>
					<p className="mt-1 text-xs text-slate-500">Mật khẩu phải dài hơn 8 ký tự, gồm chữ hoa, chữ thường và số.</p>
				</label>

				{error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}

				<button
					type="submit"
					disabled={submitting}
					className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
				>
					{submitting ? "Đang đăng ký..." : "Đăng ký"}
				</button>
			</form>
		</AuthSplitLayout>
	);
}

export default SignUpPage;
