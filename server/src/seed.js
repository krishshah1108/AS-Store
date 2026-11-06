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
const { computeTotals, normalizePayments, nextBillNo, applyBillLedger, recordCollection } = require('./services/billing')
const data = require('./seed/data')

function daysAgo(days) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return date
}

async function wipe() {
  const name = mongoose.connection.name
  await mongoose.connection.dropDatabase()
  console.log(`Wiped database ${name}`)
}

async function seedUsers() {
  const byMobile = {}
  for (const row of data.users) {
    const user = await User.create({
      name: row.name,
      mobile: row.mobile,
      role: row.role,
      isActive: true,
      passwordHash: await bcrypt.hash(row.password, 10),
    })
    byMobile[row.mobile] = user
  }
  return byMobile
}

async function seedCatalog(ownerId) {
  await Settings.create(data.settings)

  const products = {}
  for (const row of data.products) {
    products[row.key] = await Product.create({
      name: row.name,
      salePrice: row.salePrice,
      isActive: row.isActive !== false,
      createdBy: ownerId,
      updatedBy: ownerId,
    })
  }

  const customers = {}
  for (const row of data.customers) {
    customers[row.key] = await Customer.create({
      name: row.name,
      mobile: row.mobile,
      address: row.address,
      notes: row.notes,
      isActive: row.isActive !== false,
      createdBy: ownerId,
      updatedBy: ownerId,
    })
  }

  return { products, customers }
}

function actorId(users, by) {
  return users[by === 'staff' ? '8888888888' : '9999999999']._id
}

async function seedBill(bill, customers, products, users) {
  const userId = actorId(users, bill.by)
  const customer = customers[bill.customer]
  const items = bill.lines.map((line) => {
    const product = products[line.product]
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
    billDate: daysAgo(bill.daysAgo),
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

async function seed() {
  await connectDB()
  await wipe()

  const users = await seedUsers()
  const owner = users['9999999999']
  const { products, customers } = await seedCatalog(owner._id)

  const bills = [...data.bills].sort((a, b) => b.daysAgo - a.daysAgo)
  for (const bill of bills) {
    await seedBill(bill, customers, products, users)
  }

  const collections = [...data.collections].sort((a, b) => b.daysAgo - a.daysAgo)
  for (const row of collections) {
    await recordCollection({
      customerId: customers[row.customer]._id,
      paymentDate: daysAgo(row.daysAgo),
      amounts: { cash: row.cash || 0, upi: row.upi || 0 },
      allocationMode: 'fifo',
      notes: row.notes || '',
      userId: actorId(users, row.by),
    })
  }

  const balances = await Customer.find().select('name mobile balance advanceBalance').lean()
  console.log('Seeded users:')
  for (const row of data.users) {
    console.log(`  ${row.role} ${row.name}  ${row.mobile}  password ${row.password}`)
  }
  console.log('Customer balances:')
  for (const row of balances) {
    console.log(`  ${row.name} ${row.mobile}  due ${row.balance}  advance ${row.advanceBalance}`)
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
