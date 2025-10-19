  // controllers/storyController.js
  import Story from "../models/Story.js";
  import { trimVideo } from "../utils/videoTrim.js";
  import path from "path";
  import fs from "fs";
  import { uploadsPath } from "../config/uploads.js";
  // controllers/storyController.js
export const uploadStory = async (req, res) => {
  let filePathToDelete = req.file?.path;
  let processedVideoPath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Archivo requerido" });
    }

    console.log("📁 Archivo recibido:", {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });

    const isVideo = req.file.mimetype.startsWith("video/");
    const originalFilePath = req.file.path;
    let mediaPath;

    if (isVideo) {
      // Procesar video
      const trimmedFilename = `trimmed-${Date.now()}.mp4`;
      mediaPath = path.join("stories", trimmedFilename);
      const outputPath = path.join(uploadsPath, mediaPath);
      processedVideoPath = outputPath;

      console.log("🎬 Iniciando procesamiento de video...");
      console.log("📥 Input:", originalFilePath);
      console.log("📤 Output:", outputPath);

      try {
        await trimVideo(originalFilePath, outputPath);
        console.log("✅ Video procesado exitosamente");
        
        // Verificar que el archivo output existe y tiene tamaño
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          console.log("📊 Archivo output:", {
            exists: true,
            size: stats.size,
            path: outputPath
          });
        } else {
          console.log("❌ Archivo output NO existe:", outputPath);
        }
      } catch (ffmpegError) {
        console.error("❌ Error en FFmpeg:", ffmpegError);
        throw new Error(`Error procesando video: ${ffmpegError.message}`);
      }

      filePathToDelete = originalFilePath;
    } else {
      // Para imágenes
      mediaPath = path.join("stories", req.file.filename);
      console.log("🖼️ Imagen procesada:", mediaPath);
    }

    // Guardar en base de datos
    const finalMediaUrl = `/uploads/${mediaPath.replace(/\\/g, "/")}`;
    console.log("🔗 URL final para frontend:", finalMediaUrl);

    const story = new Story({
      user: req.user.id,
      mediaUrl: finalMediaUrl,
      type: isVideo ? "video" : "image",
    });

    await story.save();
    console.log("💾 Story guardada en BD:", story._id);

    // Limpiar archivo temporal original si es video
    if (isVideo && fs.existsSync(originalFilePath)) {
      fs.unlinkSync(originalFilePath);
      console.log("🧹 Archivo temporal eliminado");
    }

    // Emitir y responder
    const io = req.app.get("io");
    io.emit("storyAdded", story);
    
    res.json({ 
      success: true, 
      story: {
        ...story.toObject(),
        mediaUrl: finalMediaUrl
      }
    });

  } catch (err) {
    console.error("💥 ERROR en uploadStory:", err);
    
    // Limpieza en caso de error
    if (filePathToDelete && fs.existsSync(filePathToDelete)) {
      fs.unlinkSync(filePathToDelete);
      console.log("🧹 Archivo temporal eliminado por error");
    }
    if (processedVideoPath && fs.existsSync(processedVideoPath)) {
      fs.unlinkSync(processedVideoPath);
      console.log("🧹 Archivo procesado eliminado por error");
    }

    res.status(500).json({ 
      success: false, 
      message: "Error al subir la historia: " + err.message 
    });
  }
};
  export const getStories = async (req, res) => {
    try {
      const stories = await Story.find()
        .populate("user", "username avatar")
        .sort({ createdAt: -1 });
      res.json({ success: true, stories });
    } catch {
      res
        .status(500)
        .json({ success: false, message: "Error al obtener historias" });
    }
  };

  export const viewStory = async (req, res) => {
    try {
      const { id } = req.params;
      const story = await Story.findById(id);
      if (!story)
        return res
          .status(404)
          .json({ success: false, message: "Historia no encontrada" });

      // Evitar duplicado de vistas
      if (!story.views.some((v) => v.user.toString() === req.user.id)) {
        story.views.push({ user: req.user.id });
        await story.save();
        const io = req.app.get("io");
        io.emit("storyViewed", { storyId: id, views: story.views.length });
      }

      res.json({ success: true, views: story.views.length });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false });
    }
  };

  export const likeStory = async (req, res) => {
    try {
      const { id } = req.params;
      const story = await Story.findById(id);
      if (!story)
        return res
          .status(404)
          .json({ success: false, message: "Historia no encontrada" });

      const userId = req.user.id;
      const alreadyLiked = story.likes.includes(userId);

      if (alreadyLiked) {
        story.likes = story.likes.filter((l) => l.toString() !== userId);
      } else {
        story.likes.push(userId);
      }

      await story.save();
      const io = req.app.get("io");
      io.emit("storyLiked", { storyId: id, likes: story.likes.length });

      res.json({
        success: true,
        liked: !alreadyLiked,
        likes: story.likes.length,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false });
    }
  };
