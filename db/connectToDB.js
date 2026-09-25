import dotenv from 'dotenv'
import mongoose from 'mongoose'
dotenv.config()

export default async function connectToDb () {
    try{
        if (mongoose.connection.readyState === 1) {
            return
        }

        const mongoUri = process.env.MONGO_URI_PROD || process.env.MONGO_URI;
        if (!mongoUri) {
            throw new Error('MONGO_URI or MONGO_URI_PROD environment variable is not set');
        }
        await mongoose.connect(mongoUri)
        console.log('connected successfully')
    }catch(e){
        console.log("Database connection error:", e.message)
        throw e; // Throw the error so the server knows connection failed
    }
}