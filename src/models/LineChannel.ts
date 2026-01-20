import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ILineChannel extends Document {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  channel_name: string;
  channel_id: string;
  channel_secret: string;
  channel_access_token: string;
  webhook_url?: string;
  basic_id?: string;
  picture_url?: string;
  status: 'active' | 'inactive';
  created_at: Date;
  updated_at: Date;
}

const LineChannelSchema = new Schema<ILineChannel>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    channel_name: {
      type: String,
      required: true,
      trim: true,
    },
    channel_id: {
      type: String,
      required: true,
      index: true,
    },
    channel_secret: {
      type: String,
      required: true,
    },
    channel_access_token: {
      type: String,
      required: true,
    },
    webhook_url: String,
    basic_id: String,
    picture_url: String,
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
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

// Compound index for unique channel per user
LineChannelSchema.index({ user_id: 1, channel_id: 1 }, { unique: true });
LineChannelSchema.index({ channel_id: 1, status: 1 });

const LineChannel: Model<ILineChannel> =
  mongoose.models.LineChannel || mongoose.model<ILineChannel>('LineChannel', LineChannelSchema);

export default LineChannel;
