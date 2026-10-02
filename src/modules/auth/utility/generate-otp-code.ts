import { randomInt } from 'crypto';

export const generateOtpCode = () => {
  return randomInt(100000, 1000000).toString();
};
