import express from 'express';
import authController from '../controllers/authController.js';
import auth from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Registrar nuevo usuario
 * @access  Public
 */
router.post('/register', authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Iniciar sesión
 * @access  Public
 */
router.post('/login', authController.login);

/**
 * @route   GET /api/auth/verify
 * @desc    Verificar token y obtener datos del usuario
 * @access  Private
 */
router.get('/verify', auth, authController.verifyToken);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refrescar token (opcional)
 * @access  Private
 */
router.post('/refresh', auth, async (req, res) => {
  try {
    // Aquí puedes implementar refresh token si lo necesitas
    res.json({ 
      success: true, 
      message: 'Token válido',
      user: req.user 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Cerrar sesión (limpiar token del cliente)
 * @access  Private
 */
router.post('/logout', auth, async (req, res) => {
  try {
    // En un sistema más avanzado, podrías invalidar el token en el servidor
    // Por ahora, el cliente simplemente elimina el token del localStorage
    
    res.json({ 
      success: true, 
      message: 'Sesión cerrada exitosamente' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Solicitar restablecimiento de contraseña
 * @access  Public
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Aquí implementarías el envío de email con link de reset
    // Por ahora solo devolvemos un mensaje
    
    res.json({ 
      success: true, 
      message: 'Si el email existe, recibirás un enlace para restablecer tu contraseña' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Restablecer contraseña con token
 * @access  Public
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    // Aquí implementarías la lógica de reset de contraseña
    // Verificar token y actualizar contraseña
    
    res.json({ 
      success: true, 
      message: 'Contraseña restablecida exitosamente' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route   GET /api/auth/check-username/:username
 * @desc    Verificar disponibilidad de username
 * @access  Public
 */
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    if (!username || username.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Username debe tener al menos 3 caracteres'
      });
    }
    
    const existingUser = await User.findOne({ username })
      .collation({ locale: 'en', strength: 2 }); // Case insensitive
    
    res.json({ 
      success: true, 
      available: !existingUser 
    });
  } catch (error) {
    console.error('Error checking username:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor' 
    });
  }
});

/**
 * @route   GET /api/auth/check-email/:email
 * @desc    Verificar disponibilidad de email
 * @access  Public
 */
router.get('/check-email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const existingUser = await User.findOne({ 
      email: new RegExp(`^${email}$`, 'i') 
    });
    
    res.json({ 
      success: true, 
      available: !existingUser 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;