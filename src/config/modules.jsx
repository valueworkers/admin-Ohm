/** Shared module definitions for tenant CRUD + Super Admin read-only inspection. */

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

/** Dedicated rich pages (not EntityCrudPage). */
export const SERVICES_TAB = { collection: 'services', title: 'Services' }
export const VENUES_TAB = { collection: 'venues', title: 'Venues' }
export const PACKAGES_TAB = { collection: 'packages', title: 'Packages' }
export const BOOKINGS_TAB = { collection: 'bookings', title: 'Bookings' }
export const PATIENTS_TAB = { collection: 'patients', title: 'Patients' }
export const EMPLOYEES_TAB = { collection: 'employees', title: 'Employees' }

export const MODULE_CONFIG = [
  {
    collection: 'vendors',
    title: 'Vendors',
    description: 'Suppliers and partner vendors.',
    columns: [
      { key: 'name', label: 'Vendor', render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
      { key: 'category', label: 'Category' },
      { key: 'contact', label: 'Contact' },
      { key: 'phone', label: 'Phone' },
      { key: 'status', label: 'Status' },
    ],
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'category', label: 'Category' },
      { key: 'contact', label: 'Contact person' },
      { key: 'phone', label: 'Phone' },
      { key: 'status', label: 'Status', type: 'select', options: statusOptions },
    ],
    buildEmpty: () => ({
      name: '',
      category: '',
      contact: '',
      phone: '',
      status: 'active',
    }),
    validate: (f) => (!f.name?.trim() ? 'Name is required.' : null),
  },
  {
    collection: 'vendorPayments',
    title: 'Vendor payments',
    description: 'Payments issued to vendors.',
    columns: [
      { key: 'vendor_name', label: 'Vendor', render: (r) => <span className="font-medium text-slate-900">{r.vendor_name}</span> },
      { key: 'amount', label: 'Amount', render: (r) => `₹${Number(r.amount || 0).toLocaleString('en-IN')}` },
      { key: 'method', label: 'Method' },
      { key: 'paid_on', label: 'Paid on' },
      { key: 'status', label: 'Status' },
    ],
    fields: [
      { key: 'vendor_name', label: 'Vendor name' },
      { key: 'amount', label: 'Amount', type: 'number' },
      { key: 'method', label: 'Method', type: 'select', options: [
        { value: 'NEFT', label: 'NEFT' },
        { value: 'UPI', label: 'UPI' },
        { value: 'Cash', label: 'Cash' },
      ] },
      { key: 'paid_on', label: 'Paid on', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: [
        { value: 'paid', label: 'Paid' },
        { value: 'pending', label: 'Pending' },
      ] },
      { key: 'note', label: 'Note', required: false },
    ],
    buildEmpty: () => ({
      vendor_name: '',
      amount: 0,
      method: 'NEFT',
      paid_on: new Date().toISOString().slice(0, 10),
      status: 'paid',
      note: '',
    }),
    validate: (f) => (!f.vendor_name?.trim() ? 'Vendor name is required.' : null),
  },
]
