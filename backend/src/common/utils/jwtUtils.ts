import jwt, { JwtPayload } from 'jsonwebtoken';

interface TokenPayload {
  userId: string;
  role: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(
    { userId: payload.userId, role: payload.role },
    process.env.JWT_ACCESS_SECRET || 'access_secret',
    { expiresIn: '15m' }
  );
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(
    { userId: payload.userId, role: payload.role },
    process.env.JWT_REFRESH_SECRET || 'refresh_secret',
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
