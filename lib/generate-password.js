const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';

function generatePassword(length = 24) {
  const crypto = require('crypto');
  let password = '';

  // Ensure at least one of each required type
  const upper   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower   = 'abcdefghijklmnopqrstuvwxyz';
  const digits  = '0123456789';
  const special = '!@#$%^&*';

  password += upper[crypto.randomInt(upper.length)];
  password += lower[crypto.randomInt(lower.length)];
  password += digits[crypto.randomInt(digits.length)];
  password += special[crypto.randomInt(special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += CHARS[crypto.randomInt(CHARS.length)];
  }

  // Shuffle so required chars aren't always at the start
  return password.split('').sort(() => crypto.randomInt(3) - 1).join('');
}

module.exports = { generatePassword };
