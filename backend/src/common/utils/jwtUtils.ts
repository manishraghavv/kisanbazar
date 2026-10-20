import jwt, { JwtPayload } from 'jsonwebtoken';

interface TokenPayload {
  userId: string;
  role: string;
}

const requireSecret = (name: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET'): string => {
  const secret = process.env[name];
  if (!secret) throw new Error(`${name} is not set (environment validation should have stopped the server at boot)`);
  return secret;
};

export const getAccessSecret = (): string => requireSecret('JWT_ACCESS_SECRET');
export const getRefreshSecret = (): string => requireSecret('JWT_REFRESH_SECRET');

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(
    { userId: payload.userId, role: payload.role },
    getAccessSecret(),
    { expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as jwt.SignOptions['expiresIn'] }
  );
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(
    { userId: payload.userId, role: payload.role },
    getRefreshSecret(),
    { expiresIn: '7d' }
  );
};

export const verifyToken = (token: string, secret: string): TokenPayload | null => {
  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    return {
      userId: decoded.userId,
      role: decoded.role
    };
  } catch (error) {
    return null;
  }
};
