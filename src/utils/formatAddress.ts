export function formatAddress(address: string) {
  if (!address) return ''
  const start = address.slice(0, 4)
  const end = address.slice(-3)
  return `${start}...${end}`
}
