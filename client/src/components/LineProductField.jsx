import { Plus } from '@phosphor-icons/react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { formatMoney } from '../lib/billShare'

export default function LineProductField({ name, products, disabled, onNameChange, onPick, onCreate }) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const box = useRef(null)
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
    function onPointerDown(event) {
      if (!box.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  function close() {
    setOpen(false)
  }

  function pick(product) {
    close()
    onPick(product)
  }

  async function createNew() {
    if (saving || disabled) return
    setSaving(true)
    try {
      const saved = await onCreate({ name: query.trim() })
      if (saved) close()
    } finally {
      setSaving(false)
    }
  }

  function onKeyDown(event) {
    if (disabled) return
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
      if (canAdd && highlighted === matches.length) createNew()
      else if (matches[highlighted]) pick(matches[highlighted])
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
          setActiveIndex(0)
          setOpen(true)
        }}
        onKeyDown={onKeyDown}
      />
      {open && !disabled && (
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
                disabled={saving}
                onMouseEnter={() => setActiveIndex(matches.length)}
                onClick={createNew}
              >
                <Plus size={16} weight="bold" />
                <span>{saving ? 'Adding…' : `Add “${query.trim()}”`}</span>
              </button>
            </li>
          )}
          {!optionCount && <li className="line-product-empty">No products yet</li>}
        </ul>
      )}
    </div>
  )
}
