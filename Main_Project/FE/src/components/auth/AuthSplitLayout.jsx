function AuthSplitLayout({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex min-h-screen flex-col md:flex-row">
        <section className="flex w-full items-center justify-center bg-slate-200 md:w-1/2">
          <div className="mx-auto max-w-md px-8 py-12 text-center text-slate-500">
            <div className="rounded-3xl border border-slate-300 bg-slate-100/80 p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.2em]">Image Placeholder</p>
              <p className="mt-3 text-sm">Khu vực dành cho minh họa / graphic theo thiết kế.</p>
            </div>
          </div>
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
