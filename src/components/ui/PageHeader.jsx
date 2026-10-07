/**
 * Standard page title row — eyebrow + title + description + actions (uiux-rules A3/A5).
 */
const PageHeader = ({ eyebrow = 'Tenant catalog', title, description, actions }) => (
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div className="min-w-0">
      {eyebrow ? (
        <p className="text-[11px] font-bold uppercase tracking-wide text-sky-700">{eyebrow}</p>
      ) : null}
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      {description ? <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p> : null}
    </div>
    {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
  </div>
)

export default PageHeader
