import Post from '../models/Post.js';
import User from '../models/User.js';
import { postUpload } from '../config/multer.js';

export const postController = {
  // Crear post con multimedia
  createPost: async (req, res) => {
    const upload = postUpload.fields([
      { name: 'image', maxCount: 1 },
      { name: 'video', maxCount: 1 }
    ]);

    upload(req, res, async (err) => {
      try {
        if (err) {
          return res.status(400).json({ 
            success: false, 
            error: err.message 
          });
        }

        const { content, tags, privacy = 'public' } = req.body;

        if (!content && !req.files?.image && !req.files?.video) {
          return res.status(400).json({ 
            success: false, 
            error: 'El post debe contener texto, imagen o video' 
          });
        }

        const postData = {
          content: content?.trim(),
          author: req.user.id,
          privacy: ['public', 'friends', 'private'].includes(privacy) ? privacy : 'public'
        };

        // Procesar archivos
        if (req.files?.image) {
          postData.image = `/uploads/posts/${req.files.image[0].filename}`;
        }

        if (req.files?.video) {
          postData.video = `/uploads/posts/${req.files.video[0].filename}`;
        }

        // Procesar tags
        if (tags) {
          postData.tags = Array.isArray(tags) 
            ? tags.map(tag => tag.trim().toLowerCase())
            : tags.split(',').map(tag => tag.trim().toLowerCase());
        }

        const post = new Post(postData);
        await post.save();
        
        await post.populate('author', 'username avatar');
        
        res.status(201).json({
          success: true,
          message: 'Post creado exitosamente',
          post
        });

      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: error.message 
        });
      }
    });
  },

  // Obtener todos los posts (con paginación)
  getPosts: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      // Obtener usuarios que sigue el usuario actual
      const currentUser = await User.findById(req.user.id);
      const followingUsers = [...currentUser.following, req.user.id];

      const posts = await Post.find({
        $or: [
          { privacy: 'public' },
          { 
            privacy: 'friends', 
            author: { $in: followingUsers } 
          },
          { author: req.user.id } // Siempre ver los posts propios
        ]
      })
      .populate('author', 'username avatar')
      .populate('comments.author', 'username avatar')
      .populate('likes', 'username avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

      const totalPosts = await Post.countDocuments({
        $or: [
          { privacy: 'public' },
          { 
            privacy: 'friends', 
            author: { $in: followingUsers } 
          },
          { author: req.user.id }
        ]
      });

      res.json({
        success: true,
        posts,
        pagination: {
          current: page,
          pages: Math.ceil(totalPosts / limit),
          total: totalPosts
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  },

  // Obtener posts de un usuario específico
  getUserPosts: async (req, res) => {
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const query = { author: userId };

      // Si no es el usuario actual, aplicar restricciones de privacidad
      if (userId !== req.user.id) {
        const currentUser = await User.findById(req.user.id);
        const isFollowing = currentUser.following.includes(userId);

        query.$or = [
          { privacy: 'public' },
          ...(isFollowing ? [{ privacy: 'friends' }] : [])
        ];
      }

      const posts = await Post.find(query)
        .populate('author', 'username avatar')
        .populate('comments.author', 'username avatar')
        .populate('likes', 'username avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const totalPosts = await Post.countDocuments(query);

      res.json({
        success: true,
        posts,
        pagination: {
          current: page,
          pages: Math.ceil(totalPosts / limit),
          total: totalPosts
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  },

  // Obtener un post específico
  getPost: async (req, res) => {
    try {
      const { postId } = req.params;

      const post = await Post.findById(postId)
        .populate('author', 'username avatar')
        .populate('comments.author', 'username avatar')
        .populate('likes', 'username avatar');

      if (!post) {
        return res.status(404).json({ 
          success: false, 
          error: 'Post no encontrado' 
        });
      }

      // Verificar permisos de visualización
      if (post.author._id.toString() !== req.user.id) {
        if (post.privacy === 'private') {
          return res.status(403).json({ 
            success: false, 
            error: 'No tienes permiso para ver este post' 
          });
        }

        if (post.privacy === 'friends') {
          const currentUser = await User.findById(req.user.id);
          const isFollowing = currentUser.following.includes(post.author._id);
          
          if (!isFollowing) {
            return res.status(403).json({ 
              success: false, 
              error: 'No tienes permiso para ver este post' 
            });
          }
        }
      }

      res.json({ success: true, post });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  },

  // Actualizar post
  updatePost: async (req, res) => {
    try {
      const { postId } = req.params;
      const { content, tags, privacy } = req.body;

      const post = await Post.findById(postId);
      
      if (!post) {
        return res.status(404).json({ 
          success: false, 
          error: 'Post no encontrado' 
        });
      }

      // Verificar que el usuario es el autor
      if (post.author.toString() !== req.user.id) {
        return res.status(403).json({ 
          success: false, 
          error: 'Solo el autor puede editar el post' 
        });
      }

      const updateData = {};
      if (content !== undefined) updateData.content = content.trim();
      if (tags !== undefined) {
        updateData.tags = Array.isArray(tags) 
          ? tags.map(tag => tag.trim().toLowerCase())
          : tags.split(',').map(tag => tag.trim().toLowerCase());
      }
      if (privacy !== undefined) updateData.privacy = privacy;

      const updatedPost = await Post.findByIdAndUpdate(
        postId, 
        updateData, 
        { new: true, runValidators: true }
      ).populate('author', 'username avatar');

      res.json({
        success: true,
        message: 'Post actualizado exitosamente',
        post: updatedPost
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  },

  // Eliminar post
  deletePost: async (req, res) => {
    try {
      const { postId } = req.params;

      const post = await Post.findById(postId);
      
      if (!post) {
        return res.status(404).json({ 
          success: false, 
          error: 'Post no encontrado' 
        });
      }

      // Verificar que el usuario es el autor
      if (post.author.toString() !== req.user.id) {
        return res.status(403).json({ 
          success: false, 
          error: 'Solo el autor puede eliminar el post' 
        });
      }

      await Post.findByIdAndDelete(postId);
      
      res.json({ 
        success: true, 
        message: 'Post eliminado exitosamente' 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  },

  // Like/Unlike post
  toggleLike: async (req, res) => {
    try {
      const { postId } = req.params;

      const post = await Post.findById(postId);
      
      if (!post) {
        return res.status(404).json({ 
          success: false, 
          error: 'Post no encontrado' 
        });
      }

      const hasLiked = post.likes.includes(req.user.id);
      
      if (hasLiked) {
        // Quitar like
        post.likes = post.likes.filter(like => 
          like.toString() !== req.user.id
        );
      } else {
        // Agregar like
        post.likes.push(req.user.id);
      }

      await post.save();
      await post.populate('likes', 'username avatar');

      res.json({
        success: true,
        message: hasLiked ? 'Like removido' : 'Post liked',
        likes: post.likes,
        likesCount: post.likes.length,
        hasLiked: !hasLiked
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  },

  // Agregar comentario
  addComment: async (req, res) => {
    try {
      const { postId } = req.params;
      const { content } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({ 
          success: false, 
          error: 'El comentario no puede estar vacío' 
        });
      }

      const post = await Post.findById(postId);
      
      if (!post) {
        return res.status(404).json({ 
          success: false, 
          error: 'Post no encontrado' 
        });
      }

      const newComment = {
        author: req.user.id,
        content: content.trim(),
        timestamp: new Date()
      };

      post.comments.push(newComment);
      await post.save();

      // Populate para obtener datos del autor
      await post.populate('comments.author', 'username avatar');
      const addedComment = post.comments[post.comments.length - 1];

      res.status(201).json({
        success: true,
        message: 'Comentario agregado',
        comment: addedComment
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  },

  // Eliminar comentario
  deleteComment: async (req, res) => {
    try {
      const { postId, commentId } = req.params;

      const post = await Post.findById(postId);
      
      if (!post) {
        return res.status(404).json({ 
          success: false, 
          error: 'Post no encontrado' 
        });
      }

      const comment = post.comments.id(commentId);
      if (!comment) {
        return res.status(404).json({ 
          success: false, 
          error: 'Comentario no encontrado' 
        });
      }

      // Verificar que el usuario es el autor del comentario o del post
      if (comment.author.toString() !== req.user.id && 
          post.author.toString() !== req.user.id) {
        return res.status(403).json({ 
          success: false, 
          error: 'No tienes permiso para eliminar este comentario' 
        });
      }

      post.comments.pull(commentId);
      await post.save();

      res.json({ 
        success: true, 
        message: 'Comentario eliminado exitosamente' 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  },

  // Buscar posts por tags
  searchPosts: async (req, res) => {
    try {
      const { tag, query } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      let searchCriteria = { privacy: 'public' };

      if (tag) {
        searchCriteria.tags = { $in: [new RegExp(tag, 'i')] };
      }

      if (query) {
        searchCriteria.content = { $regex: query, $options: 'i' };
      }

      const posts = await Post.find(searchCriteria)
        .populate('author', 'username avatar')
        .populate('comments.author', 'username avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const totalPosts = await Post.countDocuments(searchCriteria);

      res.json({
        success: true,
        posts,
        pagination: {
          current: page,
          pages: Math.ceil(totalPosts / limit),
          total: totalPosts
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
};

export default postController;