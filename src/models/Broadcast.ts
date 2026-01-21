import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IBroadcast extends Document {
  _id: Types.ObjectId;
  channel_id: Types.ObjectId;
  broadcast_type: 'official' | 'push'; // official = LINE OA broadcast, push = multicast
  message_type: 'text' | 'image' | 'template' | 'flex';
  content: string;
  target_type: 'all' | 'segment';
  target_count: number;
  sent_count: number;
  failed_count: number;
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed';
  scheduled_at?: Date;
  sent_at?: Date;
  created_by?: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const BroadcastSchema = new Schema<IBroadcast>(
  {
    channel_id: {
      type: Schema.Types.ObjectId,
      ref: 'LineChannel',
      required: true,
      index: true,
    },
    broadcast_type: {
      type: String,
      enum: ['official', 'push'],
      default: 'push',
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
    target_type: {
      type: String,
      enum: ['all', 'segment'],
      default: 'all',
    },
    target_count: {
      type: Number,
      default: 0,
    },
    sent_count: {
      type: Number,
      default: 0,
    },
    failed_count: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'sending', 'completed', 'failed'],
      default: 'draft',
      index: true,
    },
    scheduled_at: {
      type: Date,
      index: true,
    },
    sent_at: Date,
    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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

// Indexes
BroadcastSchema.index({ channel_id: 1, created_at: -1 });
BroadcastSchema.index({ status: 1, scheduled_at: 1 });

const Broadcast: Model<IBroadcast> =
  mongoose.models.Broadcast || mongoose.model<IBroadcast>('Broadcast', BroadcastSchema);

export default Broadcast;