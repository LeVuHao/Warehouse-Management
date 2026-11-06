const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Controller to get all users (Admin only)
 */
const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { created_at: 'desc' }
    });

    // Exclude password hashes from response
    const sanitizedUsers = users.map(user => {
      const { password_hash, ...rest } = user;
      return rest;
    });

    res.json(sanitizedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy danh sách người dùng.' });
  }
};

/**
 * Controller to get a single user by ID (Admin only)
 */
const getUserById = async (req, res) => {
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ message: 'ID người dùng không hợp lệ.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    const { password_hash, ...sanitizedUser } = user;
    res.json(sanitizedUser);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy thông tin người dùng.' });
  }
};

/**
 * Controller to create a new user (Admin only)
 */
const createUser = async (req, res) => {
  const { username, full_name, email, password, role, is_active } = req.body;

  if (!username || !full_name || !password) {
    return res.status(400).json({ message: 'Vui lòng điền đầy đủ các thông tin bắt buộc.' });
  }

  try {
    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại.' });
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email }
      });
      if (existingEmail) {
        return res.status(400).json({ message: 'Email đã được sử dụng.' });
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        username,
        full_name,
        email: email || null,
        password_hash: passwordHash,
        role: role || 'staff',
        is_active: is_active !== undefined ? is_active : true
      }
    });

    const { password_hash, ...sanitizedUser } = newUser;
    res.status(201).json(sanitizedUser);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi tạo tài khoản.' });
  }
};

/**
 * Controller to update a user (Admin only)
 */
const updateUser = async (req, res) => {
  const id = parseInt(req.params.id);
  const { username, full_name, email, password, role, is_active } = req.body;

  if (isNaN(id)) {
    return res.status(400).json({ message: 'ID người dùng không hợp lệ.' });
  }

  if (!username || !full_name) {
    return res.status(400).json({ message: 'Tên đăng nhập và họ tên không được để trống.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    // Check if username is taken by another user
    const usernameCheck = await prisma.user.findFirst({
      where: {
        username,
        NOT: { id }
      }
    });

    if (usernameCheck) {
      return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại.' });
    }

    // Check if email is taken by another user (if provided)
    if (email) {
      const emailCheck = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id }
        }
      });
      if (emailCheck) {
        return res.status(400).json({ message: 'Email đã được sử dụng.' });
      }
    }

    // Prepare update data
    const updateData = {
      username,
      full_name,
      email: email || null,
      role: role || user.role,
      is_active: is_active !== undefined ? is_active : user.is_active
    };

    // If new password is provided, hash it
    if (password) {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData
    });

    const { password_hash, ...sanitizedUser } = updatedUser;
    res.json(sanitizedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật thông tin.' });
  }
};

/**
 * Controller to lock/disable a user (Admin only)
 */
const deleteUser = async (req, res) => {
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ message: 'ID người dùng không hợp lệ.' });
  }

  // Prevent users from locking themselves
  if (req.user && req.user.id === id) {
    return res.status(400).json({ message: 'Không thể khóa chính tài khoản đang đăng nhập.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { is_active: false }
    });

    const { password_hash, ...sanitizedUser } = updatedUser;
    res.json({ message: 'Khóa tài khoản thành công.', user: sanitizedUser });
  } catch (error) {
    console.error('Error locking user:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi khóa tài khoản.' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
};
