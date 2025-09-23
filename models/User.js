import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // puedes hashear luego con bcrypt
  bio: { type: String, default: "" },
  avatar: { type: String, default: "" }, // URL de la imagen
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("User", userSchema);
