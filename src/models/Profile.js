import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    about_me: {
      type: String,
      default: '',
      maxlength: 500,
    },
    avatar: {
      type: String,
      default: '',
    },
    full_name: {
      type: String,
      default: '',
      trim: true,
    },
    contact: {
      phone: { type: String, default: '' },
      city: { type: String, default: '' },
      country: { type: String, default: '' },
      website: { type: String, default: '' },
      social_media: {
        instagram: { type: String, default: '' },
        twitter: { type: String, default: '' },
        youtube: { type: String, default: '' },
        soundcloud: { type: String, default: '' },
        spotify: { type: String, default: '' },
      },
    },
    studies: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: function (tags) {
          return tags.length <= 20;
        },
        message: 'Cannot have more than 20 tags',
      },
    },
    certifications: {
      type: [
        {
          title: { type: String, required: true, maxlength: 100 },
          url: { type: String, required: true },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
      validate: {
        validator: function (certs) {
          return certs.length <= 20;
        },
        message: 'Cannot have more than 20 certifications',
      },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

profileSchema.index({ userId: 1 });
profileSchema.index({ username: 1 });
profileSchema.index({ tags: 1 });

profileSchema.methods.toJSON = function () {
  const profile = this.toObject();
  return profile;
};

const Profile = mongoose.model('Profile', profileSchema);

export default Profile;
