import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IQuickReply extends Document {
  _id: Types.ObjectId;
  channel_id: Types.ObjectId; // Required - ผูกกับ LINE Channel
  created_by: Types.ObjectId; // User ที่สร้าง
  title: string;
  shortcut?: string;
  message_type: 'text' | 'image' | 'template' | 'flex';
  content: string;
  flex_content?: any;
  media_url?: string;
  is_active: boolean;
  use_count: number;
  created_at: Date;
  updated_at: Date;
}

const QuickReplySchema = new Schema<IQuickReply>(
  {
    channel_id: {
      type: Schema.Types.ObjectId,
      ref: 'LineChannel',
      required: true, // บังคับต้องมี channel
      index: true,
    },
    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    shortcut: {
      type: String,
      trim: true,
      index: true,
    },
    message_type: {
      type: String,
      enum: ['text', 'image', 'template', 'flex'],
      default: 'text',
    },
    content: {
      type: String,
      required: true,
    },
    flex_content: Schema.Types.Mixed,
    media_url: String,
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
    use_count: {
      type: Number,
      default: 0,
    },
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

// Indexes - เปลี่ยนเป็น channel-based
QuickReplySchema.index({ channel_id: 1, is_active: 1 });
QuickReplySchema.index({ channel_id: 1, shortcut: 1 });

const QuickReply: Model<IQuickReply> =
  mongoose.models.QuickReply || mongoose.model<IQuickReply>('QuickReply', QuickReplySchema);

export default QuickReply;