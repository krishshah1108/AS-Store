import { FileXls, UploadSimple } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { productsApi } from '../lib/api'
import { useToast } from '../context/ToastContext'

const MAP_KEY = 'as_store_product_import_map'
const FIELDS = [
  { id: 'name', label: 'Product name', required: true },
  { id: 'unit', label: 'Unit', required: false },
  { id: 'salePrice', label: 'Sale price', required: true },
]

const HINTS = {
  name: /name|product|item/i,
  unit: /unit|uom/i,
  salePrice: /price|rate|amount|mrp/i,
}

function cellText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function readSavedMap() {
  try {
    const parsed = JSON.parse(localStorage.getItem(MAP_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function guessHeader(field, headers, used) {
  const match = headers.find((header) => !used.has(header) && HINTS[field].test(header))
  return match || ''
}

function buildMapping(headers) {
  const saved = readSavedMap()
  const used = new Set()
  const mapping = {}
  for (const field of FIELDS) {
    const savedHeader = saved[field.id]
    const header =
      savedHeader && headers.includes(savedHeader) && !used.has(savedHeader)
        ? savedHeader
        : guessHeader(field.id, headers, used)
    mapping[field.id] = header
    if (header) used.add(header)
  }
  return mapping
}

export default function ProductImport({ existingNames, online, onDone, onClose }) {
  const toast = useToast()
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [mapping, setMapping] = useState({})
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)

  function onFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const book = XLSX.read(reader.result, { type: 'array' })
      const sheet = book.Sheets[book.SheetNames[0]]
      const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
      const head = (grid[0] || []).map((cell, index) => cellText(cell) || `Column ${index + 1}`)
      const body = grid.slice(1).filter((row) => row.some((cell) => cellText(cell)))
      if (!head.length || !body.length) {
        toast.error('The file has no product rows')
        return
      }
      setFileName(file.name)
      setHeaders(head)
      setRows(body)
      setMapping(buildMapping(head))
    }
    reader.onerror = () => toast.error('Could not read that file')
    reader.readAsArrayBuffer(file)
  }

  useEffect(() => {
    if (!headers.length) return
    if (!mapping.name && !mapping.unit && !mapping.salePrice) return
    localStorage.setItem(MAP_KEY, JSON.stringify(mapping))
  }, [mapping, headers.length])

  function setField(field, header) {
    setMapping((current) => {
      const next = { ...current, [field]: header }
      if (header) {
        for (const other of FIELDS) {
          if (other.id !== field && next[other.id] === header) next[other.id] = ''
        }
      }
      return next
    })
  }

  const mapped = useMemo(() => {
    const indexOf = (field) => headers.indexOf(mapping[field] || '')
    return rows
      .map((row) => ({
        name: indexOf('name') >= 0 ? cellText(row[indexOf('name')]) : '',
        unit: indexOf('unit') >= 0 ? cellText(row[indexOf('unit')]) : '',
        salePrice: indexOf('salePrice') >= 0 ? cellText(row[indexOf('salePrice')]) : '',
      }))
      .filter((item) => item.name || item.salePrice || item.unit)
  }, [rows, headers, mapping])

  const preview = mapped.slice(0, 5)
  const ready = Boolean(mapping.name && mapping.salePrice)

  async function importAll() {
    if (!online) {
      toast.error('Import needs the shop server to be online')
      return
    }
    if (!ready) {
      toast.error('Map product name and sale price to Excel columns')
      return
    }
    setImporting(true)
    try {
      const result = await productsApi.import(mapped)
      const parts = [`Imported ${result.imported} products`]
      if (result.duplicates) parts.push(`removed ${result.duplicates} duplicates`)
      if (result.invalid) parts.push(`skipped ${result.invalid} incomplete rows`)
      toast.success(parts.join('. '))
      onDone()
    } catch (err) {
      toast.error(err.message || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const known = useMemo(() => {
    const names = new Set(existingNames.map((name) => name.trim().toLowerCase()))
    let duplicates = 0
    for (const item of mapped) {
      const key = item.name.trim().toLowerCase()
      if (!key) continue
      if (names.has(key)) duplicates += 1
      else names.add(key)
    }
    return duplicates
  }, [mapped, existingNames])

  return (
    <section className="panel form editor">
      <h2>Import products</h2>
      <p className="muted">Upload an Excel file, match each product field to a column, then import.</p>
      <label className="file-drop">
        <FileXls size={36} weight="duotone" />
        <strong>{fileName || 'Choose an Excel file'}</strong>
        <span>{fileName ? 'Choose a different file' : 'XLSX, XLS, or CSV. The first row must be the column headers.'}</span>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(event) => onFile(event.target.files?.[0])}
        />
      </label>

      {headers.length > 0 && (
        <>
          <div className="map-grid">
            {FIELDS.map((field) => (
              <label key={field.id}>
                {field.label}
                {field.required ? ' *' : ''}
                <select value={mapping[field.id] || ''} onChange={(event) => setField(field.id, event.target.value)}>
                  <option value="">Choose an Excel column</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="muted">This mapping is saved and reused the next time those column names appear.</p>

          <div className="table-wrap">
            <h3>First 5 rows</h3>
            <table>
              <thead>
                <tr>
                  <th>Product name</th>
                  <th>Unit</th>
                  <th>Sale price</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((item, index) => (
                  <tr key={index}>
                    <td>{item.name || '—'}</td>
                    <td>{item.unit || 'pcs'}</td>
                    <td>{item.salePrice || '—'}</td>
                  </tr>
                ))}
                {!preview.length && (
                  <tr>
                    <td colSpan={3} className="muted">
                      Map name and price to preview rows.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="muted">
            {mapped.length} rows ready
            {known ? `, ${known} duplicate ${known === 1 ? 'name' : 'names'} will be removed` : ''}.
          </p>
        </>
      )}

      <div className="row-actions">
        <button type="button" className="btn primary" disabled={importing || !headers.length} onClick={importAll}>
          <UploadSimple size={16} weight="bold" />
          {importing ? 'Importing…' : 'Import all'}
        </button>
        <button type="button" className="btn ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
    </section>
  )
}
