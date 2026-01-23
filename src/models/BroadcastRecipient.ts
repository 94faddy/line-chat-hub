// src/models/BroadcastRecipient.ts
import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IBroadcastRecipient extends Document {
  _id: Types.ObjectId;
  broadcast_id: Types.ObjectId;
  channel_id: Types.ObjectId;
  line_user_id: string;
  user_id?: Types.ObjectId; // Reference to LineUser
  display_name?: string;
  picture_url?: string;
  status: 'sent' | 'failed' | 'pending';
  error_message?: string;
  sent_at?: Date;
  created_at: Date;
}

const BroadcastRecipientSchema = new Schema<IBroadcastRecipient>(
  {
    broadcast_id: {
      type: Schema.Types.ObjectId,
      ref: 'Broadcast',
      required: true,
      index: true,
    },
    channel_id: {
      type: Schema.Types.ObjectId,
      ref: 'LineChannel',
      required: true,
      index: true,
    },
    line_user_id: {
      type: String,
      required: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'LineUser',
    },
    display_name: {
      type: String,
      default: null,
    },
    picture_url: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['sent', 'failed', 'pending'],
      default: 'pending',
      index: true,
    },
    error_message: {
      type: String,
      default: null,
    },
    sent_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
    toJSON: {
      virtuals: true,
      transform: (_, ret: any) => {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexes
BroadcastRecipientSchema.index({ broadcast_id: 1, status: 1 });
BroadcastRecipientSchema.index({ broadcast_id: 1, line_user_id: 1 }, { unique: true });
BroadcastRecipientSchema.index({ channel_id: 1, created_at: -1 });

const BroadcastRecipient: Model<IBroadcastRecipient> =
  mongoose.models.BroadcastRecipient || mongoose.model<IBroadcastRecipient>('BroadcastRecipient', BroadcastRecipientSchema);

export default BroadcastRecipient;