import { Plus } from '@phosphor-icons/react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { formatMoney } from '../lib/billShare'

export default function LineProductField({ name, products, disabled, onNameChange, onPick, onCreate }) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [creating, setCreating] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftPrice, setDraftPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const box = useRef(null)
  const priceRef = useRef(null)
  const listId = useId()
  const query = String(name || '')
  const term = query.trim().toLowerCase()

  const matches = useMemo(() => {
    const list = term ? products.filter((product) => product.name.toLowerCase().includes(term)) : products
    return list.slice(0, 8)
  }, [products, term])

  const canAdd =
    term.length > 0 &&
    !products.some((product) => String(product.name || '').trim().toLowerCase() === term)
  const optionCount = matches.length + (canAdd ? 1 : 0)
  const highlighted = Math.min(activeIndex, Math.max(optionCount - 1, 0))

  useEffect(() => {
    if (creating) priceRef.current?.focus()
  }, [creating])

  useEffect(() => {
    function onPointerDown(event) {
      if (!box.current?.contains(event.target)) {
        setOpen(false)
        setCreating(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  function close() {
    setOpen(false)
    setCreating(false)
    setFormError('')
  }

  function pick(product) {
    close()
    onPick(product)
  }

  function startCreate() {
    setCreating(true)
    setDraftName(query.trim())
    setDraftPrice('')
    setFormError('')
    setOpen(true)
  }

  function onKeyDown(event) {
    if (disabled || creating) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((index) => Math.min(Math.max(optionCount - 1, 0), index + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((index) => Math.max(0, index - 1))
    } else if (event.key === 'Escape') {
      close()
    } else if (event.key === 'Enter' && open && optionCount) {
      event.preventDefault()
      if (canAdd && highlighted === matches.length) startCreate()
      else if (matches[highlighted]) pick(matches[highlighted])
    }
  }

  async function saveCreate() {
    setSaving(true)
    setFormError('')
    try {
      const saved = await onCreate({ name: draftName.trim(), salePrice: draftPrice })
      if (saved) close()
    } catch (err) {
      setFormError(err.message || 'Could not add the product')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="line-product bill-line-name" ref={box}>
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder="Type a product"
        value={query}
        disabled={disabled}
        onFocus={() => {
          if (!disabled) setOpen(true)
        }}
        onChange={(event) => {
          onNameChange(event.target.value)
          setCreating(false)
          setActiveIndex(0)
          setOpen(true)
        }}
        onKeyDown={onKeyDown}
      />
      {open && !disabled && creating && (
        <div className="line-product-create" role="dialog" aria-label="Add new product">
          <strong>Add new product</strong>
          <label>
            Name
            <input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Product name" />
          </label>
          <label>
            Sale price (₹)
            <input
              ref={priceRef}
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={draftPrice}
              onChange={(event) => setDraftPrice(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  saveCreate()
                }
              }}
            />
          </label>
          {formError ? <p className="field-error">{formError}</p> : null}
          <div className="row-actions">
            <button type="button" className="btn primary" disabled={saving} onClick={saveCreate}>
              <Plus size={16} weight="bold" />
              {saving ? 'Adding…' : 'Add product'}
            </button>
            <button type="button" className="btn ghost" onClick={close}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {open && !disabled && !creating && (
        <ul className="line-product-menu" id={listId} role="listbox">
          {matches.map((product, index) => (
            <li key={product._id}>
              <button
                type="button"
                role="option"
                aria-selected={index === highlighted}
                className={index === highlighted ? 'is-hot' : ''}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => pick(product)}
              >
                <span>{product.name}</span>
                <small>{formatMoney(product.salePrice)}</small>
              </button>
            </li>
          ))}
          {canAdd && (
            <li>
              <button
                type="button"
                role="option"
                className={`line-product-add${highlighted === matches.length ? ' is-hot' : ''}`}
                onMouseEnter={() => setActiveIndex(matches.length)}
                onClick={startCreate}
              >
                <Plus size={16} weight="bold" />
                <span>Add “{query.trim()}”</span>
              </button>
            </li>
          )}
          {!optionCount && <li className="line-product-empty">No products yet</li>}
        </ul>
      )}
    </div>
  )
}
