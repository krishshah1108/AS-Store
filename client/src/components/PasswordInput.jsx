import { Eye, EyeSlash } from '@phosphor-icons/react'
import { useState } from 'react'

export default function PasswordInput({
  value,
  onChange,
  required,
  minLength,
  placeholder,
  id,
  name = 'password',
  autoComplete = 'current-password',
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="password-field">
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeSlash size={20} weight="duotone" /> : <Eye size={20} weight="duotone" />}
      </button>
    </div>
  )
}
