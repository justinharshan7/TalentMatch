const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({ // schema is a blueprint that defines exactly what a User document in MongoDB should look like.
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true, //this field cannot be empty. If someone tries to create a user without a name, MongoDB will reject it and give an error
    unique: true //no two users can have the same email address
  },
  password: {
    type: String,
    required: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  }
}, { timestamps: true });
//This tells Mongoose to automatically add two fields to every user document:
// createdAt — when the account was created
// updatedAt — when the account was last updated
// We don't need to manually add these — Mongoose handles it automatically because of { timestamps: true }.

module.exports = mongoose.model('User', userSchema);
//module.exports
//This makes the User model available to other files
//mongoose.model('User', userSchema)
//This creates the actual Model from our schema blueprint.
// 'User' - the name of the model. Mongoose will automatically create a MongoDB collection called users (lowercase + plural) based on this name
// userSchema - the blueprint we just defined above