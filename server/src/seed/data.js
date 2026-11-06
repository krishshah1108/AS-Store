/** Demo data for `npm run seed`. Re-running wipes the database and loads this set again. */
const PASSWORD = '123456'

const users = [
  { name: 'Dhruv Shah', mobile: '9999999999', role: 'owner', password: PASSWORD },
  { name: 'Store Staff', mobile: '8888888888', role: 'employee', password: PASSWORD },
]

const settings = {
  shopName: 'AS Store',
  address: 'Shop 12, Display Market',
  phone: '9999999999',
  upiId: 'asstore@upi',
  overdueDays: 30,
  billFooterNote: 'Thank you for your business',
}

const products = [
  { key: 'panel', name: 'LED Panel 2x2', salePrice: 1200 },
  { key: 'letter', name: 'Acrylic Letter', salePrice: 80 },
  { key: 'flex', name: 'Flex Banner', salePrice: 45 },
  { key: 'vinyl', name: 'Vinyl Roll', salePrice: 350 },
  { key: 'acp', name: 'ACP Sheet', salePrice: 900 },
  { key: 'strip', name: 'LED Strip', salePrice: 220 },
  { key: 'channel', name: 'Channel Letter', salePrice: 650 },
  { key: 'glow', name: 'Glow Sign', salePrice: 500, isActive: false },
]

const customers = [
  {
    key: 'primary',
    name: 'Primary buyer',
    mobile: '8200417557',
    address: 'Ring Road, Ahmedabad',
    notes: 'Main account',
  },
  {
    key: 'ramesh',
    name: 'Ramesh Glass House',
    mobile: '9811111111',
    address: 'CG Road',
    notes: 'Overdue account',
  },
  {
    key: 'neha',
    name: 'Neha Flex Point',
    mobile: '9822222222',
    address: 'Naroda',
    notes: 'Pays in full',
  },
  {
    key: 'om',
    name: 'Om Sign Board',
    mobile: '9833333333',
    address: 'Odhav',
    notes: 'Keeps an advance',
  },
  {
    key: 'mehta',
    name: 'Mehta Lights',
    mobile: '9844444444',
    address: 'Satellite',
    notes: 'Takes a small discount',
  },
  {
    key: 'city',
    name: 'City Decor',
    mobile: '9855555555',
    address: 'Maninagar',
    notes: 'Settled account',
  },
  {
    key: 'closed',
    name: 'Closed Account',
    mobile: '9866666666',
    address: '',
    notes: 'Inactive',
    isActive: false,
  },
]

/** Older bills first. Rates come from the product list unless a line sets its own. */
const bills = [
  {
    customer: 'ramesh',
    daysAgo: 45,
    lines: [
      { product: 'acp', qty: 4 },
      { product: 'flex', qty: 20 },
    ],
    payments: { cash: 0, upi: 0 },
    notes: 'Credit bill',
  },
  {
    customer: 'primary',
    daysAgo: 8,
    lines: [
      { product: 'panel', qty: 2 },
      { product: 'letter', qty: 5 },
    ],
    payments: { cash: 800, upi: 0 },
    notes: '',
  },
  {
    customer: 'om',
    daysAgo: 6,
    lines: [{ product: 'panel', qty: 1 }],
    payments: { cash: 200, upi: 0 },
    notes: '',
  },
  {
    customer: 'neha',
    daysAgo: 3,
    lines: [
      { product: 'vinyl', qty: 1 },
      { product: 'letter', qty: 10 },
    ],
    payments: { cash: 0, upi: 1150 },
    notes: 'Paid on the spot',
  },
  {
    customer: 'ramesh',
    daysAgo: 10,
    lines: [{ product: 'vinyl', qty: 1 }],
    payments: { cash: 0, upi: 0 },
    notes: 'Second open bill',
  },
  {
    customer: 'mehta',
    daysAgo: 15,
    by: 'staff',
    discount: 100,
    lines: [{ product: 'channel', qty: 2 }],
    payments: { cash: 400, upi: 300 },
    notes: 'Staff bill with discount',
  },
  {
    customer: 'city',
    daysAgo: 2,
    lines: [{ product: 'strip', qty: 2 }],
    payments: { cash: 440, upi: 0 },
    notes: 'Paid in cash',
  },
  {
    customer: 'primary',
    daysAgo: 0,
    lines: [{ product: 'strip', qty: 3 }],
    payments: { cash: 160, upi: 0 },
    notes: 'Today',
  },
]

const collections = [
  { customer: 'ramesh', daysAgo: 20, cash: 0, upi: 1500, notes: 'Part payment' },
  { customer: 'primary', daysAgo: 1, cash: 500, upi: 0, notes: 'Part payment' },
  { customer: 'om', daysAgo: 1, cash: 1500, upi: 0, notes: 'Extra kept as advance' },
  { customer: 'mehta', daysAgo: 4, cash: 200, upi: 0, by: 'staff', notes: 'Balance collected by staff' },
]

module.exports = { PASSWORD, users, settings, products, customers, bills, collections }
