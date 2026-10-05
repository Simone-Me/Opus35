export const PASSWORD_MIN_LENGTH = 12;
const SPECIAL_CHARACTER_REGEX = /[^A-Za-z0-9]/;

export function checkPasswordPolicy(password, confirmPassword) {
  return {
    minLengthOk: password.length >= PASSWORD_MIN_LENGTH,
    specialCharacterOk: SPECIAL_CHARACTER_REGEX.test(password),
    confirmOk: password === confirmPassword && confirmPassword.length > 0,
  };
}

// First failing rule as a user-facing message, or "" when the password is valid.
export function getPasswordPolicyError(policy) {
  if (!policy.minLengthOk) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }

  if (!policy.specialCharacterOk) {
    return "Password must contain at least one special character.";
  }

  if (!policy.confirmOk) {
    return "Passwords do not match.";
  }

  return "";
}
