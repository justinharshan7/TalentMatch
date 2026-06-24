//importing these modules to handle user authentiction.

const User = require('../models/User'); //(we used ../ to import our own module)
const bcrypt = require('bcryptjs'); // (no need for .. bcs these packages are installed in node_modules folder.)
const jwt = require('jsonwebtoken');


// Register HR
const register = async (req, res) => {  //( async means, async tells js to wait for things to complete before moving on)
  try {                                 //(attempt to run the code)
    const { name, email, password, company } = req.body;
    //When the frontend sends data (like a registration form), that data arrives in req.body.

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Encrypt password
    const salt = await bcrypt.genSalt(10);        //( 10 means thr number of times encryption runs, higher number = more secure but sower)
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = await User.create({    //(User.create() takes our data and saves it as a new document in the users collection in MongoDB.)
      name,
      email,
      password: hashedPassword,
      company
    });

    // Generate JWT token, It's like a hotel key card card.. when we have it, we don't need to verify everytime..(digital pass)
    const token = jwt.sign(
      { id: user._id },         //The data we store inside the token
      process.env.JWT_SECRET,   //The secret key used to sign the token.
      { expiresIn: '7d' }       //The token expires after 7 days.
    );

    // Sends a success response back to the frontend with the token and user details.
    res.status(201).json({        //(here .json() converts our JavaScript object into JSON format and sends it as the response. )
    token,
    user: { id: user._id, name: user.name, email: user.email, company: user.company } });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
//The full picture of try/catch:
// try — attempt everything (check email, encrypt password, save user, generate token)
// catch — if ANY of those steps fail for any reason, catch it and send a 500 error

// Login HR
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({ token, user: { id: user._id, name: user.name, email: user.email, company: user.company } });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { register, login };     //Exports both functions so other files can use them.