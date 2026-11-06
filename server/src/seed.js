const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true })

const { connectDB } = require('./config/db')
const User = require('./models/User')
const Product = require('./models/Product')
const Customer = require('./models/Customer')

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed/data.json'), 'utf8'))

function checkSeed(file) {
  if (!Array.isArray(file.users) || file.users.length !== 3) throw new Error('Seed needs exactly 3 users')
  if (!Array.isArray(file.products) || file.products.length !== 10) {
    throw new Error('Seed needs exactly 10 products')
  }
  if (!Array.isArray(file.customers) || file.customers.length !== 10) {
    throw new Error('Seed needs exactly 10 customers')
  }
  const userIds = new Set()
  for (const user of file.users) {
    if (!mongoose.isValidObjectId(user._id)) throw new Error(`User ${user.name} is missing a valid id`)
    if (!user.name || !user.mobile || !user.passwordHash || !user.role) {
      throw new Error(`User ${user.name || user._id} is incomplete`)
    }
    if (userIds.has(user._id)) throw new Error(`Duplicate user id: ${user._id}`)
    userIds.add(user._id)
  }
  const names = new Set()
  for (const row of [...file.products, ...file.customers]) {
    const name = String(row.name || '').trim()
    if (!name || names.has(name.toLowerCase())) throw new Error(`Duplicate or missing name: ${name}`)
    names.add(name.toLowerCase())
    if (!userIds.has(String(row.createdBy))) throw new Error(`${name} points at a user that is not in the seed`)
  }
}

async function seedRows(Model, rows, users) {
  let created = 0
  for (const row of rows) {
    const user = users.get(String(row.createdBy))
    const name = row.name.trim()
    if (!user) throw new Error(`${name} points at a user that is not in the database`)
    const existing = await Model.findOne({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })
    if (existing) continue
    await Model.create({
      name,
      ...(Model === Product ? { salePrice: row.salePrice } : {
        mobile: row.mobile || '',
        address: row.address || '',
        notes: row.notes || '',
      }),
      isActive: row.isActive !== false,
      createdBy: user._id,
      updatedBy: user._id,
    })
    created += 1
  }
  return created
}

async function seedUsers() {
  let created = 0
  for (const row of data.users) {
    const existing = await User.findById(row._id).select('_id')
    if (existing) continue
    await User.create({
      _id: row._id,
      name: row.name,
      mobile: row.mobile,
      passwordHash: row.passwordHash,
      role: row.role,
      isActive: row.isActive !== false,
    })
    created += 1
  }
  return created
}

async function seed() {
  checkSeed(data)
  await connectDB()
  const createdUsers = await seedUsers()
  const ids = data.users.map((row) => row._id)
  const found = await User.find({ _id: { $in: ids } }).select('name')
  const users = new Map(found.map((user) => [String(user._id), user]))
  if (users.size !== ids.length) throw new Error('One or more seed users are missing')

  const products = await seedRows(Product, data.products, users)
  const customers = await seedRows(Customer, data.customers, users)
  console.log(`Seeded ${createdUsers} users, ${products} products and ${customers} customers`)
}

seed()
  .catch((err) => {
    console.error(err.message || err)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
