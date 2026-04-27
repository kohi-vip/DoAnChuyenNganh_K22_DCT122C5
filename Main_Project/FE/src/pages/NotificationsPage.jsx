import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  fetchRecurringTemplates,
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  markNotificationAsUnread,
  runNotificationAction,
} from "../api/financeApi";
import NotificationDialog from "../components/common/NotificationDialog";

const PAGE_SIZE = 10;

const formatDateTime = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("vi-VN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function NotificationsPage() {
  const { openCreateTransaction } = useOutletContext();
  const [items, setItems] = useState([]);
  const [recurringMap, setRecurringMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingRecurring, setLoadingRecurring] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [readFilter, setReadFilter] = useState("all");
  const [pendingReadId, setPendingReadId] = useState("");
  const [pendingActionKey, setPendingActionKey] = useState("");
  const [feedback, setFeedback] = useState(null);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const isRead =
        readFilter === "all" ? undefined : readFilter === "read";
      const res = await fetchNotifications({
        page,
        page_size: PAGE_SIZE,
        is_read: isRead,
      });
      setItems(res.items);
      setTotalPages(res.totalPages || 1);
    } catch (error) {
      setFeedback({
        type: "error",
        message: error?.response?.data?.detail || "Không thể tải danh sách thông báo.",
      });
    } finally {
      setLoading(false);
    }
  }, [page, readFilter]);

  const loadRecurringTemplates = useCallback(async () => {
    try {
      setLoadingRecurring(true);
      const templates = await fetchRecurringTemplates();
      const mapped = templates.reduce((acc, template) => {
        acc[template.id] = template;
        return acc;
      }, {});
      setRecurringMap(mapped);
    } catch (error) {
      setFeedback({
        type: "error",
        message: error?.response?.data?.detail || "Không thể tải dữ liệu giao dịch định kỳ.",
      });
    } finally {
      setLoadingRecurring(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    loadRecurringTemplates();
  }, [loadRecurringTemplates]);

  const unreadCountOnPage = useMemo(
    () => items.filter((item) => !item.isRead).length,
    [items]
  );

  const handleToggleRead = async (item) => {
    const targetId = item.id;
    try {
      setPendingReadId(targetId);
      if (item.isRead) {
        await markNotificationAsUnread(targetId);
      } else {
        await markNotificationAsRead(targetId);
      }
      setItems((current) =>
        current.map((currentItem) =>
          currentItem.id === targetId
            ? {
                ...currentItem,
                isRead: !currentItem.isRead,
                readAt: currentItem.isRead ? null : new Date().toISOString(),
              }
            : currentItem
        )
      );
    } catch (error) {
      setFeedback({
        type: "error",
        message: error?.response?.data?.detail || "Không thể cập nhật trạng thái đã đọc.",
      });
    } finally {
      setPendingReadId("");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setItems((current) =>
        current.map((item) => ({
          ...item,
          isRead: true,
          readAt: item.readAt || new Date().toISOString(),
        }))
      );
      setFeedback({ type: "success", message: "Đã đánh dấu tất cả thông báo là đã đọc." });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error?.response?.data?.detail || "Không thể đánh dấu tất cả đã đọc.",
      });
    }
  };

  const handleNotificationAction = async (item, action) => {
    const actionKey = `${item.id}:${action}`;
    if (!item.recurringId || item.isPaid || pendingActionKey === actionKey) {
      return;
    }

    if (action === "skip") {
      const confirmed = window.confirm("Bạn có chắc muốn hủy thanh toán kỳ này không?");
      if (!confirmed) {
        return;
      }
    }

    const recurring = recurringMap[item.recurringId];
    if (!recurring) {
      setFeedback({
        type: "error",
        message: "Không tìm thấy mẫu giao dịch định kỳ.",
      });
      return;
    }

    if (!recurring.isActive) {
      setFeedback({
        type: "error",
        message: "Giao dịch định kỳ này đã bị hủy, không thể thực hiện thao tác.",
      });
      return;
    }

    if (action === "pay") {
      if (!openCreateTransaction) {
        setFeedback({
          type: "error",
          message: "Không thể mở form thanh toán lúc này.",
        });
        return;
      }

      openCreateTransaction({
        recurring_id: recurring.id,
        wallet_id: recurring.walletId,
        category_id: recurring.categoryId,
        type: recurring.type,
        amount: recurring.amount,
        note: recurring.note || item.message || item.title,
        transacted_at: item.scheduledFor || new Date().toISOString(),
        onSuccess: async () => {
          try {
            setPendingActionKey(actionKey);
            await runNotificationAction(item.id, "pay");
            setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
            await Promise.all([loadNotifications(), loadRecurringTemplates()]);
            setFeedback({ type: "success", message: "Đã thanh toán thành công." });
          } catch (error) {
            setFeedback({
              type: "error",
              message: error?.response?.data?.detail || "Thanh toán xong nhưng không thể đồng bộ trạng thái thông báo.",
            });
          } finally {
            setPendingActionKey("");
          }
        },
      });
      return;
    }

    try {
      setPendingActionKey(actionKey);
      await runNotificationAction(item.id, action);
      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
      await Promise.all([loadNotifications(), loadRecurringTemplates()]);

      const actionLabel = action === "pay" ? "thanh toán" : "hủy kỳ này";
      setFeedback({ type: "success", message: `Đã ${actionLabel} thành công.` });
    } catch (error) {
      setFeedback({
        type: "error",
        message: error?.response?.data?.detail || "Không thể thực hiện thao tác thông báo.",
      });
    } finally {
      setPendingActionKey("");
    }
  };

  const typeStyleMap = {
    reminder: "bg-amber-100 text-amber-700",
    due: "bg-blue-100 text-blue-700",
    overdue: "bg-rose-100 text-rose-700",
  };

  return (
    <div className="space-y-4 pb-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Thông báo</h1>
            <p className="mt-1 text-sm text-slate-500">
              Theo dõi nhắc lịch định kỳ, trạng thái đã đọc và thanh toán nhanh.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={readFilter}
              onChange={(event) => {
                setReadFilter(event.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500"
            >
              <option value="all">Tất cả</option>
              <option value="unread">Chưa đọc</option>
              <option value="read">Đã đọc</option>
            </select>

            <button
              type="button"
              onClick={handleMarkAllRead}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Đánh dấu tất cả đã đọc
            </button>
          </div>
        </div>

        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Chưa đọc trên trang hiện tại: <span className="font-semibold text-slate-900">{unreadCountOnPage}</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[980px] w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="border-b border-slate-200 px-3 py-2.5 font-semibold text-slate-700">Tiêu đề</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-semibold text-slate-700">Nội dung</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-semibold text-slate-700">Loại</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-semibold text-slate-700">Lịch</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-semibold text-slate-700">Giao dịch dự kiến</th>
                <th className="border-b border-slate-200 px-3 py-2.5 font-semibold text-slate-700">Trạng thái</th>
                <th className="border-b border-slate-200 px-3 py-2.5 text-center font-semibold text-slate-700">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                    Đang tải thông báo...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                    Không có thông báo phù hợp.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-medium text-slate-800">{item.title}</td>
                    <td className="px-3 py-2.5 text-slate-700">{item.message}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          typeStyleMap[item.notificationType] || "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {item.notificationType}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">{formatDateTime(item.scheduledFor)}</td>
                    <td className="px-3 py-2.5 text-slate-700">
                      {item.recurringId ? (
                        recurringMap[item.recurringId] ? (
                          <div className="space-y-0.5">
                            <p className="font-medium text-slate-800">
                              {Number(recurringMap[item.recurringId].amount || 0).toLocaleString("vi-VN")} VND
                            </p>
                            <p className="text-xs text-slate-500">
                              {recurringMap[item.recurringId].type === "income" ? "Thu" : "Chi"}
                              {recurringMap[item.recurringId].note ? ` • ${recurringMap[item.recurringId].note}` : ""}
                            </p>
                          </div>
                        ) : loadingRecurring ? (
                          <span className="text-xs text-slate-500">Đang tải...</span>
                        ) : (
                          <span className="text-xs text-slate-500">Không còn mẫu giao dịch</span>
                        )
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          item.isRead ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {item.isRead ? "Đã đọc" : "Chưa đọc"}
                      </span>
                    </td>
                    <td className="w-[180px] px-3 py-2.5 align-top">
                      <div className="mx-auto grid w-[148px] grid-cols-1 gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleRead(item)}
                          disabled={pendingReadId === item.id}
                          className="w-full whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-center text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {pendingReadId === item.id
                            ? "Đang lưu..."
                            : item.isRead
                              ? "Đánh dấu chưa đọc"
                              : "Đánh dấu đã đọc"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleNotificationAction(item, "pay")}
                          disabled={
                            !item.recurringId ||
                            item.isPaid ||
                            pendingActionKey === `${item.id}:pay` ||
                            !recurringMap[item.recurringId]?.isActive
                          }
                          className="w-full whitespace-nowrap rounded-lg bg-blue-600 px-2.5 py-1.5 text-center text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {item.isPaid
                            ? "Đã giao dịch"
                            : pendingActionKey === `${item.id}:pay`
                              ? "Đang xử lý..."
                              : !recurringMap[item.recurringId]?.isActive
                                ? "Đã hủy"
                                : "Thanh toán"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleNotificationAction(item, "skip")}
                          disabled={
                            !item.recurringId ||
                            item.isPaid ||
                            pendingActionKey === `${item.id}:skip` ||
                            !recurringMap[item.recurringId]?.isActive
                          }
                          className="w-full whitespace-nowrap rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-center text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {pendingActionKey === `${item.id}:skip` ? "Đang xử lý..." : "Hủy"}
                        </button>


                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Trước
          </button>

          <div className="flex flex-wrap items-center gap-1">
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => (
              <button
                key={number}
                type="button"
                onClick={() => setPage(number)}
                className={`h-8 min-w-8 rounded-md px-2 text-sm ${
                  number === page
                    ? "bg-blue-600 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {number}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Sau
          </button>
        </div>
      </section>

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

export default NotificationsPage;
