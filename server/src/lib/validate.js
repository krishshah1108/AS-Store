function mobileDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function mobileError(value, required = false) {
  const mobile = mobileDigits(value);
  if (!mobile) return required ? 'Enter a 10-digit mobile number' : '';
  if (mobile.length !== 10) return 'Mobile number must be exactly 10 digits';
  return '';
}

function moneyError(value, label, { required = false, min = 0 } = {}) {
  if (value === '' || value == null) return required ? `Enter ${label}` : '';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${label} must be a number`;
  if (amount < min) return min === 0 ? `${label} cannot be negative` : `${label} must be greater than 0`;
  return '';
}

function duplicateName(rows, name, exceptId) {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return false;
  return rows.some(
    (row) => String(row._id) !== String(exceptId || '') && String(row.name || '').trim().toLowerCase() === key
  );
}

module.exports = { mobileDigits, mobileError, moneyError, duplicateName };
