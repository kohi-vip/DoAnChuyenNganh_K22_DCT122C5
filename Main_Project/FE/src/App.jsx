import { Navigate, Route, Routes } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import ManagementPage from "./pages/ManagementPage";
import AccountSettingsPage from "./pages/AccountSettingsPage";
import ReportsPage from "./pages/ReportsPage";
import SignUpPage from "./pages/SignUpPage";
import TransactionsPage from "./pages/TransactionsPage";
import MainLayout from "./layouts/MainLayout";
import { useAuth } from "./stores/useAuth";

function PrivateRoute({ children }) {
	const { isAuthenticated } = useAuth();
	if (!isAuthenticated) {
		return <Navigate to="/login" replace />;
	}
	return children;
}

function App() {
	return (
		<Routes>
			<Route path="/login" element={<LoginPage />} />
			<Route path="/signup" element={<SignUpPage />} />
			<Route
				element={
					<PrivateRoute>
						<MainLayout />
					</PrivateRoute>
				}
			>
				<Route path="/" element={<Navigate to="/dashboard" replace />} />
				<Route path="/dashboard" element={<DashboardPage />} />
				<Route path="/wallet-categories" element={<ManagementPage />} />
				<Route path="/transactions" element={<TransactionsPage />} />
				<Route path="/reports" element={<ReportsPage />} />
				<Route path="/account-settings" element={<AccountSettingsPage />} />
			</Route>
			<Route path="*" element={<Navigate to="/dashboard" replace />} />
		</Routes>
	);
}

export default App;
