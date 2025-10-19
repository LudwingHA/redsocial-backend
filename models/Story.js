// models/Story.js
import mongoose from "mongoose";

const storySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  mediaUrl: { type: String, required: true },
  type: { type: String, enum: ["image", "video"], required: true },
  views: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      viewedAt: { type: Date, default: Date.now },
    },
  ],
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 }, // expira en 24 h
});

export default mongoose.model("Story", storySchema);
