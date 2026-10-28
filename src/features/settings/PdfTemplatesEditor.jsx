import {
  FiAlignCenter,
  FiAlignLeft,
  FiAlignRight,
  FiBold,
  FiItalic,
  FiType,
} from 'react-icons/fi'
import {
  FONT_FAMILIES,
  PDF_ALIGN,
  PDF_PAGE_SIZES,
  defaultPdfStyle,
  defaultPdfTemplates,
  resolvePdfPageMm,
  resolvePdfPagePx,
} from './defaults'
import { SectionCard, SoftBadge } from './SettingsChrome'
import { btnGhost, fieldClass, labelClass } from '../../utils/ui'

const ToolGroup = ({ title, children }) => (
  <div className="space-y-2.5 border-b border-stone-100 pb-3 last:border-0 last:pb-0">
    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{title}</p>
    {children}
  </div>
)

const PdfPagePreview = ({ template, style, org }) => {
  const size = resolvePdfPagePx(style)
  const landscape = style.orientation === 'landscape'
  const pageW = landscape ? size.h : size.w
  const pageH = landscape ? size.w : size.h
  const mm = resolvePdfPageMm(style)
  const scale = Math.min(0.42, 360 / Math.max(pageW, 1))
  const orgName = org?.name || 'Your organization'
  const orgEmail = org?.email || 'billing@organization.com'
  const address = [org?.address_line1, org?.locality, org?.city, org?.country]
    .filter(Boolean)
    .join(', ') || 'Address line · City · Country'

  const docTitle =
    template.docType === 'quotation'
      ? 'QUOTATION'
      : template.docType === 'report'
        ? 'OPERATIONS REPORT'
        : 'INVOICE'

  const docNo =
    template.docType === 'quotation'
      ? 'QT-2026-0142'
      : template.docType === 'report'
        ? 'RPT-2026-03'
        : 'INV-2026-1088'

  return (
    <div className="overflow-auto rounded-xl bg-stone-200/80 p-4">
      <div
        className="mx-auto origin-top overflow-hidden shadow-lg"
        style={{
          width: pageW * scale,
          height: pageH * scale,
        }}
      >
        <div
          className="relative bg-white"
          style={{
            width: pageW,
            height: pageH,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            fontFamily: `"${style.fontFamily}", system-ui, serif`,
            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
            color: style.textColor,
            textAlign: style.textAlign,
            boxSizing: 'border-box',
            paddingTop: style.marginTop,
            paddingRight: style.marginRight,
            paddingBottom: style.marginBottom,
            paddingLeft: style.marginLeft,
            borderWidth: style.showBorder ? style.borderWidth : 0,
            borderStyle: style.borderStyle,
            borderColor: style.borderColor,
          }}
        >
          {style.showWatermark ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              style={{
                fontSize: 72,
                fontWeight: 700,
                opacity: 0.08,
                transform: 'rotate(-28deg)',
                color: style.accentColor,
              }}
            >
              {style.watermarkText || 'DRAFT'}
            </div>
          ) : null}

          <div
            style={{
              paddingTop: style.paddingTop,
              paddingRight: style.paddingRight,
              paddingBottom: style.paddingBottom,
              paddingLeft: style.paddingLeft,
              height: '100%',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {style.showHeader ? (
              <div
                className="mb-4 flex items-start justify-between gap-3 border-b pb-3"
                style={{ borderColor: style.accentColor }}
              >
                <div className="flex items-start gap-3">
                  {style.showLogo ? (
                    org?.logoUrl ? (
                      <img
                        src={org.logoUrl}
                        alt=""
                        className="h-12 w-12 rounded object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded text-[10px] font-bold text-white"
                        style={{ background: style.accentColor }}
                      >
                        LOGO
                      </div>
                    )
                  ) : null}
                  <div>
                    <p
                      style={{
                        fontSize: style.headingSize,
                        fontWeight: style.fontWeightHeading,
                        fontStyle: style.fontStyleHeading,
                        color: style.accentColor,
                        margin: 0,
                      }}
                    >
                      {orgName}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 10, opacity: 0.7 }}>{orgEmail}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 10, opacity: 0.65 }}>{address}</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: style.headingSize - 2,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {docTitle}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 10 }}>{docNo}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 10, opacity: 0.7 }}>
                    Date: 28 Oct 2026
                  </p>
                </div>
              </div>
            ) : null}

            {template.docType !== 'report' ? (
              <div className="mb-4 grid grid-cols-2 gap-4" style={{ fontSize: 10 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, color: style.accentColor }}>Bill to</p>
                  <p style={{ margin: '4px 0 0' }}>Vaishnavi Test Care</p>
                  <p style={{ margin: '2px 0 0', opacity: 0.75 }}>health@yopmail.com</p>
                  <p style={{ margin: '2px 0 0', opacity: 0.75 }}>Malleshwaram, Bengaluru</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontWeight: 700, color: style.accentColor }}>
                    {template.docType === 'quotation' ? 'Valid until' : 'Due date'}
                  </p>
                  <p style={{ margin: '4px 0 0' }}>15 Nov 2026</p>
                </div>
              </div>
            ) : (
              <p style={{ margin: '0 0 12px', fontSize: 11 }}>
                Monthly summary of bookings, attendance, and payouts for the selected period.
              </p>
            )}

            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: Math.max(9, style.fontSize - 1),
              }}
            >
              <thead>
                <tr style={{ background: style.tableHeaderBg }}>
                  {['Description', 'Qty', 'Rate', 'Amount'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === 'Description' ? 'left' : 'right',
                        padding: '8px 6px',
                        borderBottom: style.tableBorder
                          ? `1px solid ${style.borderColor}`
                          : 'none',
                        fontWeight: 600,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Home care visit (2 hrs)', '2', '₹1,200', '₹2,400'],
                  ['Medical supplies pack', '1', '₹650', '₹650'],
                  ['Transport surcharge', '1', '₹150', '₹150'],
                ].map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, i) => (
                      <td
                        key={`${row[0]}-${i}`}
                        style={{
                          textAlign: i === 0 ? 'left' : 'right',
                          padding: '7px 6px',
                          borderBottom: style.tableBorder
                            ? `1px solid ${style.borderColor}`
                            : 'none',
                        }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            <div
              className="mt-4 ml-auto"
              style={{ width: '42%', fontSize: Math.max(10, style.fontSize) }}
            >
              <div className="flex justify-between py-1">
                <span style={{ opacity: 0.7 }}>Subtotal</span>
                <span>₹3,200</span>
              </div>
              <div className="flex justify-between py-1">
                <span style={{ opacity: 0.7 }}>GST (18%)</span>
                <span>₹576</span>
              </div>
              <div
                className="flex justify-between border-t py-2 font-bold"
                style={{ borderColor: style.accentColor }}
              >
                <span>Total</span>
                <span>₹3,776</span>
              </div>
            </div>

            <div style={{ flex: 1 }} />

            {style.showFooter ? (
              <div
                className="mt-4 flex items-end justify-between border-t pt-2"
                style={{ borderColor: style.borderColor, fontSize: 9, opacity: 0.65 }}
              >
                <span>
                  {template.name} · {template.label} ·{' '}
                  {style.pageSize === 'Custom'
                    ? `${mm.widthMm}×${mm.heightMm} mm`
                    : style.pageSize}{' '}
                  {style.orientation}
                </span>
                {style.showPageNumber ? <span>Page 1 of 1</span> : <span />}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

const PdfTemplatesEditor = ({
  templates = [],
  activeId,
  onSelect,
  onStyleChange,
  onMetaChange,
  organization,
}) => {
  const list = templates.length ? templates : defaultPdfTemplates()
  const active = list.find((t) => t.id === activeId) || list[0]
  const style = { ...defaultPdfStyle(), ...(active?.style || {}) }

  const setStyle = (key, value) => onStyleChange?.(active.id, key, value)
  const patchStyle = (patch) => onStyleChange?.(active.id, patch)

  if (!active) return null

  const pageMm = resolvePdfPageMm(style)
  const sizeLabel =
    style.pageSize === 'Custom'
      ? `Custom ${pageMm.widthMm}×${pageMm.heightMm} mm`
      : style.pageSize

  return (
    <div className="space-y-4">
      <SectionCard
        title="Template options"
        description="Choose Template 1, 2, or 3. Set any page size (presets or custom mm) and customize the layout tools below."
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {list.slice(0, 3).map((t) => {
            const on = t.id === active.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelect(t.id)}
                className={`rounded-2xl border p-3.5 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
                  on
                    ? 'border-brand-300 bg-brand-50 shadow-sm ring-1 ring-brand-100'
                    : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-stone-900">{t.name}</span>
                  <SoftBadge tone={on ? 'brand' : 'neutral'}>Option {t.option}</SoftBadge>
                </div>
                <p className="mt-1 text-xs font-medium text-stone-700">{t.label}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-stone-500">{t.description}</p>
              </button>
            )
          })}
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <SectionCard title="PDF tools" description="Page, margins, type, borders, and document chrome.">
          <div className="space-y-3">
            <ToolGroup title="Document">
              <label className="block">
                <span className={labelClass}>Display label</span>
                <input
                  className={fieldClass}
                  value={active.label || ''}
                  onChange={(e) => onMetaChange?.(active.id, 'label', e.target.value)}
                  maxLength={60}
                />
              </label>
            </ToolGroup>

            <ToolGroup title="Page format">
              <label className="block">
                <span className={labelClass}>Page size</span>
                <select
                  className={fieldClass}
                  value={
                    PDF_PAGE_SIZES.some((p) => p.value === style.pageSize)
                      ? style.pageSize
                      : 'Custom'
                  }
                  onChange={(e) => {
                    const next = e.target.value
                    const preset = PDF_PAGE_SIZES.find((p) => p.value === next)
                    if (preset && next !== 'Custom') {
                      patchStyle({
                        pageSize: next,
                        pageWidthMm: preset.widthMm,
                        pageHeightMm: preset.heightMm,
                      })
                    } else {
                      patchStyle({ pageSize: 'Custom' })
                    }
                  }}
                >
                  {PDF_PAGE_SIZES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="block">
                  <span className={labelClass}>Width (mm)</span>
                  <input
                    type="number"
                    min={50}
                    max={2000}
                    step={1}
                    className={fieldClass}
                    value={style.pageWidthMm ?? pageMm.widthMm}
                    onChange={(e) => {
                      const widthMm = Math.min(
                        2000,
                        Math.max(50, Number(e.target.value) || 50),
                      )
                      patchStyle({ pageSize: 'Custom', pageWidthMm: widthMm })
                    }}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Height (mm)</span>
                  <input
                    type="number"
                    min={50}
                    max={2000}
                    step={1}
                    className={fieldClass}
                    value={style.pageHeightMm ?? pageMm.heightMm}
                    onChange={(e) => {
                      const heightMm = Math.min(
                        2000,
                        Math.max(50, Number(e.target.value) || 50),
                      )
                      patchStyle({ pageSize: 'Custom', pageHeightMm: heightMm })
                    }}
                  />
                </label>
              </div>
              <p className="mt-1.5 text-[11px] text-stone-500">
                Presets fill width/height. Edit either field for any custom size
                (50–2000 mm).
              </p>
              <div className="mt-2 flex gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1">
                {['portrait', 'landscape'].map((o) => (
                  <button
                    key={o}
                    type="button"
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold capitalize ${
                      style.orientation === o
                        ? 'bg-white text-ink shadow-sm ring-1 ring-stone-200'
                        : 'text-stone-500'
                    }`}
                    onClick={() => setStyle('orientation', o)}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </ToolGroup>

            <ToolGroup title="Margins (px)">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['marginTop', 'Top'],
                  ['marginRight', 'Right'],
                  ['marginBottom', 'Bottom'],
                  ['marginLeft', 'Left'],
                ].map(([key, label]) => (
                  <label key={key} className="block">
                    <span className={labelClass}>{label}</span>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      className={fieldClass}
                      value={style[key]}
                      onChange={(e) => setStyle(key, Number(e.target.value) || 0)}
                    />
                  </label>
                ))}
              </div>
            </ToolGroup>

            <ToolGroup title="Padding (px)">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['paddingTop', 'Top'],
                  ['paddingRight', 'Right'],
                  ['paddingBottom', 'Bottom'],
                  ['paddingLeft', 'Left'],
                ].map(([key, label]) => (
                  <label key={key} className="block">
                    <span className={labelClass}>{label}</span>
                    <input
                      type="number"
                      min={0}
                      max={80}
                      className={fieldClass}
                      value={style[key]}
                      onChange={(e) => setStyle(key, Number(e.target.value) || 0)}
                    />
                  </label>
                ))}
              </div>
            </ToolGroup>

            <ToolGroup title="Typography">
              <label className="block">
                <span className={labelClass}>Font family</span>
                <select
                  className={fieldClass}
                  value={style.fontFamily}
                  onChange={(e) => setStyle('fontFamily', e.target.value)}
                >
                  {FONT_FAMILIES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="block">
                  <span className={labelClass}>Body size</span>
                  <input
                    type="number"
                    min={8}
                    max={18}
                    className={fieldClass}
                    value={style.fontSize}
                    onChange={(e) => setStyle('fontSize', Number(e.target.value) || 11)}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Heading size</span>
                  <input
                    type="number"
                    min={12}
                    max={36}
                    className={fieldClass}
                    value={style.headingSize}
                    onChange={(e) => setStyle('headingSize', Number(e.target.value) || 20)}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Line height</span>
                  <input
                    type="number"
                    min={1}
                    max={2.2}
                    step={0.05}
                    className={fieldClass}
                    value={style.lineHeight}
                    onChange={(e) => setStyle('lineHeight', Number(e.target.value) || 1.45)}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Text color</span>
                  <input
                    type="color"
                    className="h-10 w-full cursor-pointer rounded-lg border border-stone-300 bg-white p-1"
                    value={style.textColor}
                    onChange={(e) => setStyle('textColor', e.target.value)}
                  />
                </label>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <button
                  type="button"
                  className={btnGhost}
                  aria-pressed={style.fontWeightHeading === '700'}
                  onClick={() =>
                    setStyle(
                      'fontWeightHeading',
                      style.fontWeightHeading === '700' ? '400' : '700',
                    )
                  }
                  title="Bold heading"
                >
                  <FiBold className="h-3.5 w-3.5" />
                  Bold
                </button>
                <button
                  type="button"
                  className={btnGhost}
                  aria-pressed={style.fontStyleHeading === 'italic'}
                  onClick={() =>
                    setStyle(
                      'fontStyleHeading',
                      style.fontStyleHeading === 'italic' ? 'normal' : 'italic',
                    )
                  }
                  title="Italic heading"
                >
                  <FiItalic className="h-3.5 w-3.5" />
                  Italic
                </button>
                {PDF_ALIGN.map((a) => {
                  const Icon =
                    a.value === 'center'
                      ? FiAlignCenter
                      : a.value === 'right'
                        ? FiAlignRight
                        : FiAlignLeft
                  return (
                    <button
                      key={a.value}
                      type="button"
                      className={btnGhost}
                      aria-pressed={style.textAlign === a.value}
                      onClick={() => setStyle('textAlign', a.value)}
                      title={a.label}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  )
                })}
              </div>
            </ToolGroup>

            <ToolGroup title="Borders & accent">
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className={labelClass}>Border width</span>
                  <input
                    type="number"
                    min={0}
                    max={8}
                    className={fieldClass}
                    value={style.borderWidth}
                    onChange={(e) => setStyle('borderWidth', Number(e.target.value) || 0)}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Border style</span>
                  <select
                    className={fieldClass}
                    value={style.borderStyle}
                    onChange={(e) => setStyle('borderStyle', e.target.value)}
                  >
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                    <option value="none">None</option>
                  </select>
                </label>
                <label className="block">
                  <span className={labelClass}>Border color</span>
                  <input
                    type="color"
                    className="h-10 w-full cursor-pointer rounded-lg border border-stone-300 bg-white p-1"
                    value={style.borderColor}
                    onChange={(e) => setStyle('borderColor', e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Accent</span>
                  <input
                    type="color"
                    className="h-10 w-full cursor-pointer rounded-lg border border-stone-300 bg-white p-1"
                    value={style.accentColor}
                    onChange={(e) => setStyle('accentColor', e.target.value)}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className={labelClass}>Table header fill</span>
                  <input
                    type="color"
                    className="h-10 w-full cursor-pointer rounded-lg border border-stone-300 bg-white p-1"
                    value={style.tableHeaderBg}
                    onChange={(e) => setStyle('tableHeaderBg', e.target.value)}
                  />
                </label>
              </div>
            </ToolGroup>

            <ToolGroup title="Chrome">
              <div className="space-y-2">
                {[
                  ['showLogo', 'Logo'],
                  ['showHeader', 'Header'],
                  ['showFooter', 'Footer'],
                  ['showBorder', 'Page border'],
                  ['tableBorder', 'Table borders'],
                  ['showPageNumber', 'Page number'],
                  ['showWatermark', 'Watermark'],
                ].map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center justify-between gap-2 text-sm text-stone-700"
                  >
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-500"
                      checked={Boolean(style[key])}
                      onChange={(e) => setStyle(key, e.target.checked)}
                    />
                  </label>
                ))}
                {style.showWatermark ? (
                  <label className="block">
                    <span className={labelClass}>Watermark text</span>
                    <input
                      className={fieldClass}
                      value={style.watermarkText || ''}
                      onChange={(e) => setStyle('watermarkText', e.target.value)}
                    />
                  </label>
                ) : null}
              </div>
            </ToolGroup>
          </div>
        </SectionCard>

        <SectionCard
          title="Exact PDF preview"
          description={`${sizeLabel} · ${style.orientation} · scaled view of the printable page`}
          action={
            <span className="inline-flex items-center gap-1 text-xs text-stone-500">
              <FiType className="h-3.5 w-3.5" aria-hidden />
              {style.fontFamily}
            </span>
          }
        >
          <PdfPagePreview template={active} style={style} org={organization} />
        </SectionCard>
      </div>
    </div>
  )
}

export default PdfTemplatesEditor
