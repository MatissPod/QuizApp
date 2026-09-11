import mongoose, { Schema } from 'mongoose';

const questionSchema = new Schema({
  value: { type: Number, required: true },
  question: { type: String, required: true },
  answer: { type: String, required: true },
  dailyDouble: { type: Boolean, default: false },
});

const categorySchema = new Schema({
  title: { type: String, required: true },
  order: { type: Number, default: 0 },
  questions: { type: [questionSchema], default: [] },
});

export const CategoryModel = mongoose.model('Category', categorySchema);
