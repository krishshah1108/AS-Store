import { CaretDown, MagnifyingGlass, Plus } from '@phosphor-icons/react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

export default function SearchSelect({
  label,
  placeholder,
  options,
  value,
  onSelect,
  onCreate,
  getKey,
  getLabel,
  getHint,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const box = useRef(null)
  const listId = useId()
  const selected = options.find((option) => String(getKey(option)) === String(value || ''))
  const term = query.trim()
  const canAdd =
    Boolean(onCreate) &&
    term.length > 0 &&
    !options.some((option) => String(getLabel(option) || '').trim().toLowerCase() === term.toLowerCase())

  useEffect(() => {
    function onPointerDown(event) {
      if (!box.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    const list = term
      ? options.filter((option) => {
          const labelText = getLabel(option).toLowerCase()
          const hint = (getHint?.(option) || '').toLowerCase()
          return labelText.includes(term) || hint.includes(term)
        })
      : options
    return list.slice(0, 30)
  }, [options, query, getLabel, getHint])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, open])

  function choose(option) {
    onSelect(option)
    setQuery('')
    setOpen(false)
  }

  const optionCount = filtered.length + (canAdd ? 1 : 0)

  async function createNew() {
    if (saving || !onCreate) return
    setSaving(true)
    try {
      const saved = await onCreate(term)
      if (saved) {
        setQuery('')
        setOpen(false)
      }
    } finally {
      setSaving(false)
    }
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!open) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(Math.max(optionCount - 1, 0), index + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(0, index - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (canAdd && activeIndex === filtered.length) createNew()
      else if (filtered[activeIndex]) choose(filtered[activeIndex])
    }
  }

  return (
    <div className="search-select" ref={box}>
      {label ? <span className="search-select-label">{label}</span> : null}
      <div className={`search-select-control ${open ? 'is-open' : ''}`}>
        <MagnifyingGlass size={16} weight="bold" />
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder={placeholder}
          value={open ? query : selected ? getLabel(selected) : ''}
          onFocus={() => {
            setQuery('')
            setOpen(true)
          }}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onKeyDown={onKeyDown}
        />
        <CaretDown size={14} weight="bold" />
      </div>
      {open && (
        <ul className="search-select-menu" id={listId} role="listbox">
          {filtered.map((option, index) => {
            const key = String(getKey(option))
            const active = key === String(value || '')
            return (
              <li key={key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`${active ? 'is-active' : ''} ${index === activeIndex ? 'is-hot' : ''}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option)}
                >
                  <span>{getLabel(option)}</span>
                  {getHint ? <small>{getHint(option)}</small> : null}
                </button>
              </li>
            )
          })}
          {canAdd && (
            <li>
              <button
                type="button"
                role="option"
                className={`search-select-add${activeIndex === filtered.length ? ' is-hot' : ''}`}
                disabled={saving}
                onMouseEnter={() => setActiveIndex(filtered.length)}
                onClick={createNew}
              >
                <Plus size={16} weight="bold" />
                <span>{saving ? 'Adding…' : `Add “${term}”`}</span>
              </button>
            </li>
          )}
          {!optionCount && <li className="search-select-empty">No matches</li>}
        </ul>
      )}
    </div>
  )
}
