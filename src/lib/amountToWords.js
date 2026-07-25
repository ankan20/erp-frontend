const ones = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function wordsIN(n) {
  if (n === 0) return "";
  if (n < 20)  return ones[n] + " ";
  if (n < 100) return tens[Math.floor(n / 10)] + " " + wordsIN(n % 10);
  if (n < 1000)      return ones[Math.floor(n / 100)]      + " Hundred "   + wordsIN(n % 100);
  if (n < 100000)    return wordsIN(Math.floor(n / 1000))  + "Thousand "   + wordsIN(n % 1000);
  if (n < 10000000)  return wordsIN(Math.floor(n / 100000))  + "Lakh "     + wordsIN(n % 100000);
  return               wordsIN(Math.floor(n / 10000000)) + "Crore "        + wordsIN(n % 10000000);
}

/**
 * Converts a numeric amount to Indian-system words.
 * e.g. 1500000 → "Rupees Fifteen Lakh Only"
 */
export function amountToWordsIN(amount) {
  const n = Math.floor(Math.abs(Number(amount) || 0));
  if (n === 0) return "Rupees Zero Only";
  return "Rupees " + wordsIN(n).replace(/\s+/g, " ").trim() + " Only";
}
