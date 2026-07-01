const express = require('express');  // goes  into node_modules and looks for express package and imports it into this file
const mongoose = require('mongoose');
const cors = require('cors'); // allows cross-origin requests from different domains(front and back ends)
const dotenv = require('dotenv'); //use to hide sensitive information like database connection strings and API keys in environment variables

dotenv.config(); // activates dotenv

const app = express(); // creates express application (like a car)
//express is the factory
//express() is building car

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

const companyRoutes = require('./routes/companyRoutes');
app.use('/api/companies', companyRoutes);

const jobRoutes = require('./routes/jobRoutes');
app.use('/api/jobs', jobRoutes);

const candidateRoutes = require('./routes/candidateRoutes');
app.use('/api/candidates', candidateRoutes);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI) // tells mongoose to connect t a MongoDB database
  .then(() => console.log('MongoDB Connected')) // runs if the connection is successful
  .catch((err) => console.log('MongoDB Connection Error:', err)); // runs if the connection is unsuccessful

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


// every route in the project starts with /api/ - it's a standard convention
// that tells everyone "this is a backend API endpoint, not a webpage".