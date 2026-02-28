import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { PORT } from './config.js'
import userRoutes from './routes/users.routes.js'
import authRoutes from './routes/auth.routes.js'
import chatbotRoutes from './routes/chatbot.routes.js'
import morgan from 'morgan'
import swaggerUi from 'swagger-ui-express'
import { swaggerSpec } from './swagger.js'

const app = express()

app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true
}))
app.use(morgan('dev'))
app.use(express.json())
app.use(cookieParser())
app.use('/api/users', userRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/chatbot', chatbotRoutes)
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))


app.listen(PORT)
console.log('Server running on port', PORT)