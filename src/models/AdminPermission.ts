// src/models/AdminPermission.ts
import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IAdminPermissions {
  can_reply?: boolean;
  can_view_all?: boolean;
  can_broadcast?: boolean;
  can_manage_tags?: boolean;
  can_manage_channel?: boolean;
}

export interface IAdminPermission extends Document {
  _id: Types.ObjectId;
  owner_id: Types.ObjectId;
  admin_id?: Types.ObjectId;
  channel_id?: Types.ObjectId;
  permissions?: IAdminPermissions;
  status: 'pending' | 'active' | 'revoked';
  invite_token?: string;
  invite_expires_at?: Date;
  invited_at: Date;
  accepted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const AdminPermissionSchema = new Schema<IAdminPermission>(
  {
    owner_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    admin_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    channel_id: {
      type: Schema.Types.ObjectId,
      ref: 'LineChannel',
      index: true,
    },
    permissions: {
      type: Schema.Types.Mixed,
      default: { can_reply: true },
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'revoked'],
      default: 'pending',
      index: true,
    },
    invite_token: {
      type: String,
      sparse: true,
      index: true,
    },
    invite_expires_at: Date,
    invited_at: {
      type: Date,
      default: Date.now,
    },
    accepted_at: Date,
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
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

// Indexes
AdminPermissionSchema.index({ owner_id: 1, admin_id: 1 });
AdminPermissionSchema.index({ admin_id: 1, status: 1 });

// Virtuals
AdminPermissionSchema.virtual('owner', {
  ref: 'User',
  localField: 'owner_id',
  foreignField: '_id',
  justOne: true,
});

AdminPermissionSchema.virtual('admin', {
  ref: 'User',
  localField: 'admin_id',
  foreignField: '_id',
  justOne: true,
});

AdminPermissionSchema.virtual('channel', {
  ref: 'LineChannel',
  localField: 'channel_id',
  foreignField: '_id',
  justOne: true,
});

const AdminPermission: Model<IAdminPermission> =
  mongoose.models.AdminPermission || mongoose.model<IAdminPermission>('AdminPermission', AdminPermissionSchema);

export default AdminPermission;