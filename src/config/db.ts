const mongoose = require('mongoose');

const connectDB = async() => {
	try {
		const connect = await mongoose.connect(process.env.DB_URI, {
			useUnifiedTopology: true,
			useNewUrlParser: true,
		});
		console.log('Database connect succesfully !');
	}catch (error) {
		console.log(error);
		process.exit(1)
	}
}

module.exports = { connectDB }