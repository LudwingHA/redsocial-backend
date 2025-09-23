import User from '../models/User.js';
import jwt from 'jsonwebtoken';

export const authController = {
  // Registro de usuario
  register: async (req, res) => {
    try {
      const { username, email, password, phone, age, bio, location, interests } = req.body;

      // Validaciones básicas
      if (!username || !email || !password) {
        return res.status(400).json({ 
          success: false, 
          error: 'Username, email y password son requeridos' 
        });
      }

      if (password.length < 6) {
        return res.status(400).json({ 
          success: false, 
          error: 'La contraseña debe tener al menos 6 caracteres' 
        });
      }

      if (age && (age < 13 || age > 120)) {
        return res.status(400).json({ 
          success: false, 
          error: 'La edad debe estar entre 13 y 120 años' 
        });
      }

      if (phone && !/^\d{10}$/.test(phone)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Formato de teléfono inválido (10 dígitos requeridos)' 
        });
      }

      // Verificar si el usuario ya existe
      const existingUser = await User.findOne({ 
        $or: [{ email: email.toLowerCase() }, { username }] 
      });

      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          error: 'El email o username ya están en uso' 
        });
      }

      // Crear nuevo usuario
      const user = new User({
        username: username.trim(),
        email: email.toLowerCase().trim(),
        password,
        phone: phone?.trim(),
        age: age ? parseInt(age) : undefined,
        bio: bio?.trim(),
        location: location?.trim(),
        interests: interests ? (
          Array.isArray(interests) 
            ? interests.map(i => i.trim())
            : interests.split(',').map(i => i.trim())
        ) : []
      });

      await user.save();

      // Generar token JWT
      const token = jwt.sign(
        { id: user._id }, 
        process.env.JWT_SECRET, 
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      // Respuesta exitosa
      res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio,
          location: user.location,
          age: user.age,
          phone: user.phone,
          interests: user.interests,
          followers: user.followers,
          following: user.following,
          createdAt: user.createdAt
        }
      });

    } catch (error) {
      console.error('Error en registro:', error);
      
      // Manejar errores de validación de MongoDB
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({ 
          success: false, 
          error: errors.join(', ') 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        error: 'Error del servidor en el registro' 
      });
    }
  },

  // Login de usuario
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      // Validaciones
      if (!email || !password) {
        return res.status(400).json({ 
          success: false, 
          error: 'Email y password son requeridos' 
        });
      }

      // Buscar usuario por email
      const user = await User.findOne({ email: email.toLowerCase() })
        .populate('followers', 'username avatar')
        .populate('following', 'username avatar');

      if (!user) {
        return res.status(400).json({ 
          success: false, 
          error: 'Credenciales inválidas' 
        });
      }

      // Verificar password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(400).json({ 
          success: false, 
          error: 'Credenciales inválidas' 
        });
      }

      // Generar token JWT
      const token = jwt.sign(
        { id: user._id }, 
        process.env.JWT_SECRET, 
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      // Respuesta exitosa
      res.json({
        success: true,
        message: 'Login exitoso',
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio,
          location: user.location,
          age: user.age,
          phone: user.phone,
          interests: user.interests,
          followers: user.followers,
          following: user.following,
          createdAt: user.createdAt
        }
      });

    } catch (error) {
      console.error('Error en login:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error del servidor en el login' 
      });
    }
  },

  // Verificar token
  verifyToken: async (req, res) => {
    try {
      const user = await User.findById(req.user.id)
        .select('-password')
        .populate('followers', 'username avatar')
        .populate('following', 'username avatar');

      if (!user) {
        return res.status(404).json({ 
          success: false, 
          error: 'Usuario no encontrado' 
        });
      }

      res.json({
        success: true,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio,
          location: user.location,
          age: user.age,
          phone: user.phone,
          interests: user.interests,
          followers: user.followers,
          following: user.following,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      console.error('Error en verifyToken:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Error del servidor al verificar token' 
      });
    }
  }
};

export default authController;