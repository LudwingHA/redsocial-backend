import Post from "../models/Post.js";
export const createPost = async (req, res) => {
  try {
    const { content } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : "";

    const newPost = new Post({
      user: req.userId, // ✅ aquí usamos el userId del JWT
      content,
      image: imagePath,
    });

    const saved = await newPost.save();
    res.status(201).json(await saved.populate("user", "username"));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Obtener todos los posts (ya estaba bien)
export const getPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("user", "username avatar")
      .populate("comments.user", "username avatar")
      .sort({ createdAt: -1 });
    res.status(200).json(posts);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Dar like/unlike
export const toggleLike = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ msg: "Post no encontrado" });

    const userId = req.userId; // del JWT
    if (post.likes.includes(userId)) {
      post.likes = post.likes.filter((id) => id.toString() !== userId);
    } else {
      post.likes.push(userId);
    }

    await post.save();
    res.status(200).json(post);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// Comentar
export const addComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ msg: "Post no encontrado" });

    const { text } = req.body;
    const user = req.userId; // del JWT
    post.comments.push({ user, text });
    await post.save();

    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};
