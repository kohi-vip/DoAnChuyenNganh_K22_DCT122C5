

function AuthSplitLayout({ loginImage, title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex min-h-screen flex-col md:flex-row">
        <section className="flex w-full items-center justify-center overflow-hidden bg-slate-200 md:w-1/2">
          <img
            src={loginImage}
            alt="Ảnh đăng nhập"
            className="h-full w-full object-cover"
          />
        </section>

        <section className="flex w-full items-center justify-center bg-white px-6 py-10 md:w-1/2 md:px-10">
          <div className="w-full max-w-md">
            <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
            <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
            <div className="mt-8">{children}</div>
            <div className="mt-6 text-center text-sm text-slate-600">{footer}</div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default AuthSplitLayout;
