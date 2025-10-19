// utils/videoTrim.js
export const trimVideo = (inputPath, outputPath, duration = 15) => {
  return new Promise((resolve, reject) => {
    console.log("🚀 Iniciando FFmpeg con configuración mejorada...");

    ffmpeg(inputPath)
      .setStartTime(0)
      .setDuration(duration)
      .videoCodec('libx264')
      .audioCodec('aac')
      
      // ✅ CONFIGURACIÓN SUPER COMPATIBLE
      .outputOptions([
        '-movflags +faststart',
        '-pix_fmt yuv420p',      // CRÍTICO: Formato más compatible
        '-preset fast',
        '-crf 23',               // Calidad balanceada
        '-profile:v baseline',   // Perfil más compatible
        '-level 3.1',
        '-max_muxing_queue_size 1024', // Evita errores de muxing
        '-vf "scale=trunc(iw/2)*2:trunc(ih/2)*2"', // Asegura dimensiones pares
        '-r 30',                 // Frame rate estándar
        '-b:v 1M',               // Bitrate video
        '-b:a 128k',             // Bitrate audio
        '-ac 2',                 // Audio stereo
        '-ar 44100',             // Sample rate estándar
        '-f mp4'                 // Forzar formato MP4
      ])
      
      .on('start', (commandLine) => {
        console.log('🎬 Comando FFmpeg:', commandLine);
      })
      .on('progress', (progress) => {
        console.log(`📊 Progreso: ${Math.round(progress.percent || 0)}%`);
      })
      .on('stderr', (stderrLine) => {
        console.log('🔧 FFmpeg log:', stderrLine);
      })
      .on('end', () => {
        console.log('✅ FFmpeg completado exitosamente');
        console.log('📁 Output path:', outputPath);
        
        // Verificar que el archivo se creó
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          console.log(`📏 Tamaño del archivo: ${stats.size} bytes`);
          
          if (stats.size === 0) {
            reject(new Error('El archivo de salida está vacío'));
            return;
          }
        } else {
          reject(new Error('El archivo de salida no se creó'));
          return;
        }
        
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('❌ Error FFmpeg:', err.message);
        reject(new Error(`FFmpeg error: ${err.message}`));
      })
      .save(outputPath);
  });
};