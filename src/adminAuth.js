import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export async function loginAdmin(email, password) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  const jwtSecret = process.env.JWT_SECRET;

  if (!adminEmail || !adminPasswordHash || !jwtSecret) {
    throw new Error('Admin authentication is not configured.');
  }

  if (email !== adminEmail) {
    return null;
  }

  const passwordMatches = await bcrypt.compare(
    password,
    adminPasswordHash
  );

  if (!passwordMatches) {
    return null;
  }

  const token = jwt.sign(
    {
      role: 'admin',
      email: adminEmail,
    },
    jwtSecret,
    {
      expiresIn: '8h',
    }
  );

  return token;
}

export function verifyAdminToken(token) {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error('JWT secret is not configured.');
  }

  return jwt.verify(token, jwtSecret);
}
