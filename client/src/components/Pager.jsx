import { CaretLeft, CaretRight } from '@phosphor-icons/react'

export default function Pager({ page, pages, onPage }) {
  if (pages <= 1) return null
  const numbers = Array.from({ length: pages }, (_, index) => index + 1)

  return (
    <nav className="pager" aria-label="Pages">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <CaretLeft size={16} weight="bold" />
        Previous
      </button>
      {numbers.map((number) => (
        <button
          key={number}
          type="button"
          className={number === page ? 'is-current' : ''}
          aria-current={number === page ? 'page' : undefined}
          onClick={() => onPage(number)}
        >
          {number}
        </button>
      ))}
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
        <CaretRight size={16} weight="bold" />
      </button>
    </nav>
  )
}
