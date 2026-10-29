/** Indian states/UTs with GST state codes (first two GSTIN digits). */
export const IN_STATES = [
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
]

export const SELLER_STATE_CODE = '29' // Karnataka default for demo seller

export const stateFromGstin = (gstin) => {
  const code = String(gstin || '')
    .trim()
    .slice(0, 2)
  if (!/^\d{2}$/.test(code)) return null
  return IN_STATES.find((s) => s.code === code) || null
}

export const amountInWords = (n) => {
  const num = Math.round(Number(n) || 0)
  if (num === 0) return 'Zero rupees only'
  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ]
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const two = (v) => {
    if (v < 20) return ones[v]
    return `${tens[Math.floor(v / 10)]}${v % 10 ? ` ${ones[v % 10]}` : ''}`.trim()
  }
  const three = (v) => {
    if (v < 100) return two(v)
    return `${ones[Math.floor(v / 100)]} Hundred${v % 100 ? ` ${two(v % 100)}` : ''}`.trim()
  }
  let n2 = num
  const crore = Math.floor(n2 / 10000000)
  n2 %= 10000000
  const lakh = Math.floor(n2 / 100000)
  n2 %= 100000
  const thousand = Math.floor(n2 / 1000)
  n2 %= 1000
  const parts = []
  if (crore) parts.push(`${two(crore)} Crore`)
  if (lakh) parts.push(`${two(lakh)} Lakh`)
  if (thousand) parts.push(`${two(thousand)} Thousand`)
  if (n2) parts.push(three(n2))
  return `${parts.join(' ')} rupees only`
}
