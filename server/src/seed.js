const fs = require('fs')
const path = require('path')
const bcrypt = require('bcryptjs')
const mongoose = require('mongoose')
require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true })

const { connectDB } = require('./config/db')
const User = require('./models/User')
const Customer = require('./models/Customer')
const Product = require('./models/Product')
const Settings = require('./models/Settings')
const Bill = require('./models/Bill')
const LedgerEntry = require('./models/LedgerEntry')
const { computeTotals, normalizePayments, nextBillNo, applyBillLedger, recordCollection } = require('./services/billing')

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed/data.json'), 'utf8'))

function onDate(value) {
  const [year, month, day] = String(value).split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

function unique(rows, field, label) {
  const seen = new Set()
  for (const row of rows) {
    const value = row[field]
    if (!value || seen.has(value)) throw new Error(`Duplicate or missing ${label}: ${value}`)
    seen.add(value)
  }
}

function requireRef(map, ref, label) {
  const row = map[ref]
  if (!row) throw new Error(`Unknown ${label} reference: ${ref}`)
  return row
}

function checkSeed(file) {
  if (file.users.length !== 2) throw new Error('Seed needs exactly 2 users')
  if (file.products.length !== 10) throw new Error('Seed needs exactly 10 products')
  if (file.customers.length !== 10) throw new Error('Seed needs exactly 10 customers')
  if (!file.bills.length || !file.payments.length) throw new Error('Seed needs bills and later payments')
  unique(file.users, 'mobile', 'user mobile')
  unique(file.products, 'ref', 'product ref')
  unique(file.products, 'name', 'product name')
  unique(file.customers, 'ref', 'customer ref')
  unique(file.customers, 'mobile', 'customer mobile')
  unique(file.bills, 'ref', 'bill ref')
  const customers = new Set(file.customers.map((row) => row.ref))
  const products = new Set(file.products.map((row) => row.ref))
  const users = new Set(file.users.map((row) => row.mobile))
  const bills = new Set(file.bills.map((row) => row.ref))
  for (const bill of file.bills) {
    if (!customers.has(bill.customer)) throw new Error(`Bill ${bill.ref} has an unknown customer`)
    if (!users.has(bill.createdBy)) throw new Error(`Bill ${bill.ref} has an unknown user`)
    if (!bill.items.length) throw new Error(`Bill ${bill.ref} has no items`)
    for (const item of bill.items) {
      if (!products.has(item.product)) throw new Error(`Bill ${bill.ref} has an unknown product`)
      if (!(Number(item.qty) > 0)) throw new Error(`Bill ${bill.ref} has a bad qty`)
    }
  }
  for (const payment of file.payments) {
    if (!customers.has(payment.customer)) throw new Error(`Payment has an unknown customer`)
    if (!users.has(payment.createdBy)) throw new Error(`Payment has an unknown user`)
    for (const allocation of payment.allocations || []) {
      if (!bills.has(allocation.bill)) throw new Error(`Payment allocation points at an unknown bill`)
    }
  }
}

async function wipe() {
  const name = mongoose.connection.name
  await mongoose.connection.dropDatabase()
  console.log(`Wiped database ${name}`)
}

async function seedUsers() {
  const byMobile = {}
  for (const row of data.users) {
    byMobile[row.mobile] = await User.create({
      name: row.name,
      mobile: row.mobile,
      role: row.role,
      isActive: row.isActive !== false,
      passwordHash: await bcrypt.hash(row.password, 10),
    })
  }
  return byMobile
}

async function seedCatalog(ownerId) {
  await Settings.create(data.settings)
  const products = {}
  for (const row of data.products) {
    products[row.ref] = await Product.create({
      name: row.name,
      salePrice: row.salePrice,
      isActive: row.isActive !== false,
      createdBy: ownerId,
      updatedBy: ownerId,
    })
  }
  const customers = {}
  for (const row of data.customers) {
    customers[row.ref] = await Customer.create({
      name: row.name,
      mobile: row.mobile,
      address: row.address || '',
      notes: row.notes || '',
      isActive: row.isActive !== false,
      createdBy: ownerId,
      updatedBy: ownerId,
    })
  }
  return { products, customers }
}

async function seedBill(bill, customers, products, users) {
  const userId = requireRef(users, bill.createdBy, 'user')._id
  const customer = requireRef(customers, bill.customer, 'customer')
  const items = bill.items.map((line) => {
    const product = requireRef(products, line.product, 'product')
    return {
      productId: product._id,
      name: product.name,
      qty: line.qty,
      rate: line.rate ?? product.salePrice,
    }
  })
  const totals = computeTotals(items, bill.discount || 0)
  const pay = normalizePayments(bill.payments, totals.total)
  const saved = await Bill.create({
    billNo: await nextBillNo(),
    customerId: customer._id,
    billDate: onDate(bill.billDate),
    notes: bill.notes || '',
    status: 'final',
    createdBy: userId,
    updatedBy: userId,
    ...totals,
    ...pay,
  })
  await applyBillLedger(saved, userId)
  return saved
}

async function seedPayment(payment, customers, bills, users) {
  const savedBills = payment.allocations || []
  await recordCollection({
    customerId: requireRef(customers, payment.customer, 'customer')._id,
    paymentDate: onDate(payment.paymentDate),
    amounts: { cash: payment.cash || 0, upi: payment.upi || 0 },
    allocationMode: payment.allocationMode || 'fifo',
    allocations: savedBills.map((row) => ({
      billId: requireRef(bills, row.bill, 'bill')._id,
      amount: row.amount,
    })),
    notes: payment.notes || '',
    userId: requireRef(users, payment.createdBy, 'user')._id,
  })
}

async function assertLedgers() {
  const customers = await Customer.find().select('name balance advanceBalance').lean()
  const entries = await LedgerEntry.find().select('customerId debit credit bills type').lean()
  const nets = new Map()
  for (const entry of entries) {
    const id = String(entry.customerId)
    nets.set(id, Math.round(((nets.get(id) || 0) + entry.debit - entry.credit) * 100) / 100)
    if (['bill', 'payment', 'return', 'reversal'].includes(entry.type) && !(entry.bills || []).length) {
      throw new Error(`Ledger ${entry.type} entry is missing its bill reference`)
    }
  }
  for (const customer of customers) {
    const net = nets.get(String(customer._id)) || 0
    if (net !== customer.balance) {
      throw new Error(`${customer.name} ledger ${net} does not match balance ${customer.balance}`)
    }
    if (customer.advanceBalance < 0 || customer.balance < 0) {
      throw new Error(`${customer.name} has a negative balance`)
    }
  }
}

async function seed() {
  checkSeed(data)
  await connectDB()
  await wipe()

  const users = await seedUsers()
  const owner = data.users.find((row) => row.role === 'owner')
  const { products, customers } = await seedCatalog(users[owner.mobile]._id)
  const bills = {}
  const orderedBills = [...data.bills].sort((a, b) => onDate(a.billDate) - onDate(b.billDate))
  for (const bill of orderedBills) {
    bills[bill.ref] = await seedBill(bill, customers, products, users)
  }
  const orderedPayments = [...data.payments].sort((a, b) => onDate(a.paymentDate) - onDate(b.paymentDate))
  for (const payment of orderedPayments) {
    await seedPayment(payment, customers, bills, users)
  }

  await assertLedgers()
  const balances = await Customer.find().select('name mobile balance advanceBalance').sort({ name: 1 }).lean()
  console.log(`Seeded ${data.users.length} users, ${data.products.length} products, ${data.customers.length} customers, ${data.bills.length} bills, ${data.payments.length} later payments`)
  for (const row of balances) {
    console.log(`  ${row.name}  due ${row.balance}  advance ${row.advanceBalance}`)
  }
}

seed()
  .catch((err) => {
    console.error(err.message || err)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
