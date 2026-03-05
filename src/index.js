import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import cookieParser from 'cookie-parser'
import { PORT } from './config.js'
import userRoutes from './routes/users.routes.js'
import authRoutes from './routes/auth.routes.js'
import exercisesRoutes from './routes/exercises.routes.js'
import chatbotRoutes from './routes/chatbot.routes.js'
import categoriesRoutes from './routes/categories.route.js'
import morgan from 'morgan'
import swaggerUi from 'swagger-ui-express'
import { swaggerSpec } from './swagger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:4000',
        'https://fitforge-murex.vercel.app'
    ],
    credentials: true
}))
app.use(morgan('dev'))
app.use(express.json())
app.use(cookieParser())
app.use(express.static(path.join(__dirname, '..', 'public')))
app.use('/api/users', userRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/exercises', exercisesRoutes)
app.use('/api/chatbot', chatbotRoutes)
app.use('/api/categories', categoriesRoutes)
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))


app.listen(PORT)
console.log('Server running on port', PORT)