import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ITag extends Document {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  name: string;
  color: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

const TagSchema = new Schema<ITag>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    color: {
      type: String,
      default: '#06C755',
    },
    description: String,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Unique tag name per user
TagSchema.index({ user_id: 1, name: 1 }, { unique: true });

const Tag: Model<ITag> = mongoose.models.Tag || mongoose.model<ITag>('Tag', TagSchema);

export default Tag;
