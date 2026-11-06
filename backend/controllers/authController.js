const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
    process.env.JWT_SECRET || 'dev-jwt-secret',
    { expiresIn: '15m' }
  );
};

const REFRESH_TTL_DAYS = 7;

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_REFRESH_SECRET || 'dev-jwt-refresh-secret',
    { expiresIn: `${REFRESH_TTL_DAYS}d` }
  );
};

const getRefreshExpiry = () => {
  const expires = new Date();
  expires.setDate(expires.getDate() + REFRESH_TTL_DAYS);
  return expires;
};

const persistRefreshToken = async (userId, token) => {
  await prisma.refreshToken.deleteMany({ where: { user_id: userId } });
  await prisma.refreshToken.create({
    data: {
      token,
      user_id: userId,
      expires_at: getRefreshExpiry(),
    },
  });
};

const verifyRefreshTokenInDb = async (token) => {
  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored) return null;
  if (stored.expires_at < new Date()) {
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    return null;
  }
  return stored;
};

const serializeUser = (user) => ({
  id: user.id,
  username: user.username,
  full_name: user.full_name,
  email: user.email,
  role: user.role,
  is_active: user.is_active,
  created_at: user.created_at,
});

const verifyPassword = async (plainPassword, passwordHash) => {
  if (!plainPassword || !passwordHash) return false;

  if (
    passwordHash.startsWith('$2a$') ||
    passwordHash.startsWith('$2b$') ||
    passwordHash.startsWith('$2y$')
  ) {
    return bcrypt.compare(plainPassword, passwordHash);
  }

  if (passwordHash.startsWith('pbkdf2:sha256')) {
    const parts = passwordHash.split('$');
    if (parts.length !== 3) return false;

    const [methodAndIterations, salt, expectedHash] = parts;
    const iterations = Number.parseInt(methodAndIterations.split(':')[2], 10) || 260000;
    const derivedKey = crypto.pbkdf2Sync(plainPassword, salt, iterations, 32, 'sha256');
    const actualHash = Buffer.from(derivedKey.toString('hex'), 'utf8');
    const expected = Buffer.from(expectedHash, 'utf8');

    return actualHash.length === expected.length && crypto.timingSafeEqual(actualHash, expected);
  }

  try {
    return await bcrypt.compare(plainPassword, passwordHash);
  } catch (error) {
    return false;
  }
};

const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Vui lòng điền đầy đủ tên đăng nhập và mật khẩu.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: 'Tài khoản của bạn đã bị vô hiệu hóa.' });
    }

    const isMatch = await verifyPassword(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
    }

    const accessToken = generateAccessToken(user);
    const refreshTokenValue = generateRefreshToken(user);
    await persistRefreshToken(user.id, refreshTokenValue);

    res.json({
      message: 'Đăng nhập thành công.',
      accessToken,
      refreshToken: refreshTokenValue,
      user: serializeUser(user),
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Đã xảy ra lỗi máy chủ trong quá trình đăng nhập.' });
  }
};

const refreshToken = async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ message: 'Refresh Token là bắt buộc.' });
  }

  try {
    let decoded;
    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_REFRESH_SECRET || 'dev-jwt-refresh-secret'
      );
    } catch {
      return res.status(403).json({ message: 'Refresh Token không hợp lệ hoặc đã hết hạn.' });
    }

    const stored = await verifyRefreshTokenInDb(token);
    if (!stored || stored.user_id !== decoded.id) {
      return res.status(403).json({ message: 'Refresh Token đã bị thu hồi hoặc không tồn tại.' });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user || !user.is_active) {
      return res.status(403).json({ message: 'Tài khoản không hợp lệ hoặc đã bị khóa.' });
    }

    const newAccessToken = generateAccessToken(user);
    return res.json({ accessToken: newAccessToken });
  } catch (error) {
    console.error('Error refreshing token:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi làm mới token.' });
  }
};

const logout = async (req, res) => {
  const { token } = req.body;

  try {
    if (token) {
      await prisma.refreshToken.deleteMany({ where: { token } });
    }
    return res.json({ message: 'Đăng xuất thành công.' });
  } catch (error) {
    console.error('Error during logout:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi đăng xuất.' });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin người dùng.' });
    }

    res.json(serializeUser(user));
  } catch (error) {
    console.error('Error retrieving user profile:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy thông tin cá nhân.' });
  }
};

const updateProfile = async (req, res) => {
  const { full_name, email } = req.body;
  const cleanFullName = String(full_name || '').trim();
  const cleanEmail = email ? String(email).trim().toLowerCase() : null;

  if (!cleanFullName) {
    return res.status(400).json({ message: 'Họ tên không được để trống.' });
  }

  try {
    if (cleanEmail) {
      const existingEmail = await prisma.user.findFirst({
        where: {
          email: cleanEmail,
          NOT: { id: req.user.id },
        },
      });

      if (existingEmail) {
        return res.status(409).json({ message: 'Email này đã được sử dụng bởi tài khoản khác.' });
      }
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        full_name: cleanFullName,
        email: cleanEmail,
      },
    });

    res.json({
      message: 'Cập nhật thông tin cá nhân thành công.',
      user: serializeUser(user),
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật thông tin cá nhân.' });
  }
};

const changePassword = async (req, res) => {
  const { old_password, new_password } = req.body;

  if (!old_password || !new_password) {
    return res.status(400).json({ message: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.' });
  }

  if (String(new_password).length < 6) {
    return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin người dùng.' });
    }

    const isCurrentPasswordValid = await verifyPassword(old_password, user.password_hash);

    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: 'Mật khẩu hiện tại không chính xác.' });
    }

    const nextPasswordHash = await bcrypt.hash(new_password, 10);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { password_hash: nextPasswordHash },
    });

    await prisma.refreshToken.deleteMany({ where: { user_id: req.user.id } });

    res.json({ message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại trên các thiết bị khác.' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi đổi mật khẩu.' });
  }
};

module.exports = {
  login,
  refreshToken,
  logout,
  getProfile,
  updateProfile,
  changePassword,
};
