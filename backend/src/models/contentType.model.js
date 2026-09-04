import mongoose from 'mongoose';

const contentTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Content type name is required'],
      trim: true,
      unique: true
    },
    value: {
      type: String,
      trim: true,
      lowercase: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    isSystemDefault: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// Auto-slugify name to value key if modified or not set
contentTypeSchema.pre('save', function (next) {
  if (this.name && (!this.value || this.isModified('name'))) {
    this.value = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }
  if (typeof next === 'function') {
    next();
  }
});

export default mongoose.model('ContentType', contentTypeSchema);
