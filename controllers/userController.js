import User from "../models/User.js";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import Post from "../models/Post.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración Multer para avatares
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/avatars/");
  },
  filename: function (req, file, cb) {
    cb(null, req.user.id + "-" + Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten imágenes"));
    }
  },
}).single("avatar");

export const userController = {
  // Obtener perfil del usuario actual
  getCurrentUser: async (req, res) => {
    try {
      const user = await User.findById(req.user.id)
        .select("-password")
        .populate("followers", "username avatar")
        .populate("following", "username avatar");

      res.json({ success: true, user });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Actualizar perfil de usuario
  updateProfile: async (req, res) => {
    try {
      const { username, email, phone, age, bio, location, interests } =
        req.body;

      const updateData = {};
      if (username) updateData.username = username;
      if (email) updateData.email = email;
      if (phone) updateData.phone = phone;
      if (age) updateData.age = parseInt(age);
      if (bio) updateData.bio = bio;
      if (location) updateData.location = location;
      if (interests) {
        updateData.interests = Array.isArray(interests)
          ? interests
          : interests.split(",").map((i) => i.trim());
      }

      const user = await User.findByIdAndUpdate(req.user.id, updateData, {
        new: true,
        runValidators: true,
      }).select("-password");

      res.json({ success: true, user });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  },
  getAllUsers: async (req, res) => {
    try {
      const users = await User.find({ _id: { $ne: req.user.id } }).select(
        "username avatar email"
      );
      res.json({ success: true, users });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  // Cambiar avatar
  updateAvatar: async (req, res) => {
    upload(req, res, async function (err) {
      try {
        if (err) {
          return res.status(400).json({ success: false, error: err.message });
        }

        if (!req.file) {
          return res
            .status(400)
            .json({ success: false, error: "No se subió ninguna imagen" });
        }

        const user = await User.findByIdAndUpdate(
          req.user.id,
          { avatar: `/uploads/avatars/${req.file.filename}` },
          { new: true }
        ).select("-password");

        res.json({ success: true, user });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
  },

  // Obtener perfil de usuario por ID
 getProfile: async (req, res) => {
  try {
    const userId = req.params.userId;

    // Obtener usuario
    const user = await User.findById(userId)
      .select("-password")
      .populate("followers", "username avatar")
      .populate("following", "username avatar");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, error: "Usuario no encontrado" });
    }

    // Obtener posts del usuario
    const posts = await Post.find({ author: userId }).sort({ createdAt: -1 });

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        createdAt: user.createdAt,
        followersCount: user.followers.length,
        followingCount: user.following.length,
        followers: user.followers,
        following: user.following,
      },
      posts,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
},

  // Buscar usuarios
  searchUsers: async (req, res) => {
    try {
      const { q } = req.query;

      if (!q || q.length < 2) {
        return res.status(400).json({
          success: false,
          error: "La búsqueda debe tener al menos 2 caracteres",
        });
      }

      const users = await User.find({
        $or: [
          { username: { $regex: q, $options: "i" } },
          { email: { $regex: q, $options: "i" } },
        ],
      })
        .select("username avatar email bio followers following")
        .limit(20);

      res.json({ success: true, users });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Seguir/Dejar de seguir usuario
  toggleFollow: async (req, res) => {
    try {
      const { userId } = req.params;
      const currentUser = await User.findById(req.user.id);
      const targetUser = await User.findById(userId);

      if (!targetUser) {
        return res
          .status(404)
          .json({ success: false, error: "Usuario no encontrado" });
      }

      const isFollowing = currentUser.following.includes(userId);

      if (isFollowing) {
        // Dejar de seguir
        await User.findByIdAndUpdate(req.user.id, {
          $pull: { following: userId },
        });
        await User.findByIdAndUpdate(userId, {
          $pull: { followers: req.user.id },
        });
      } else {
        // Seguir
        await User.findByIdAndUpdate(req.user.id, {
          $addToSet: { following: userId },
        });
        await User.findByIdAndUpdate(userId, {
          $addToSet: { followers: req.user.id },
        });
      }

      res.json({
        success: true,
        message: isFollowing
          ? "Dejaste de seguir al usuario"
          : "Ahora sigues al usuario",
        isFollowing: !isFollowing,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },
};

export default userController;
