import { GoogleGenerativeAI } from '@google/generative-ai';
import { pool } from '../db.js';

const getGeminiModel = () => {
    const api_key = process.env.GEMINI_API_KEY;
    if (!api_key) {
        throw new Error("GEMINI_API_KEY is not configured in environment variables");
    }
    const genAI = new GoogleGenerativeAI(api_key);
    return genAI.getGenerativeModel({ model: 'models/gemini-2.5-flash' });
};

export const getContextForUser = async (userId) => {
    try {
        const profileQuery = await pool.query(
            `SELECT u.username, up.weight, up.height, up.age, up.gender
             FROM users u
             LEFT JOIN user_profiles up ON u."userId" = up.user_id
             WHERE u."userId" = $1`,
            [userId]
        );
        const data = profileQuery.rows[0];

        if (!data) return 'No se encontraron datos del usuario.';

        let context = '';

        if (data.username) context += `Nombre: ${data.username}. `;

        if (data.weight && data.height && data.age && data.gender) {
            const weight = parseFloat(data.weight);
            const height = parseFloat(data.height);
            const age = parseInt(data.age);
            const genderLabel = data.gender === 'm' ? 'Masculino' : 'Femenino';

            context += `Peso: ${weight}kg. `;
            context += `Altura: ${height}cm. `;
            context += `Edad: ${age} años. `;
            context += `Género: ${genderLabel}. `;

            const heightM = height / 100;
            const imc = weight / (heightM * heightM);
            let imcCategory;
            if (imc < 18.5) imcCategory = 'Bajo peso';
            else if (imc < 25) imcCategory = 'Peso normal';
            else if (imc < 30) imcCategory = 'Sobrepeso';
            else imcCategory = 'Obesidad';
            context += `IMC: ${imc.toFixed(1)} (${imcCategory}). `;

            const tmb = data.gender === 'm'
                ? (10 * weight) + (6.25 * height) - (5 * age) + 5
                : (10 * weight) + (6.25 * height) - (5 * age) - 161;
            context += `TMB: ${Math.round(tmb)} kcal/día. `;
            context += `Calorías mantenimiento (~1.55x): ${Math.round(tmb * 1.55)} kcal/día. `;
            context += `Proteína recomendada: ${Math.round(weight * 1.8)}g/día. `;
        } else {
            context += 'Perfil físico incompleto (faltan datos de peso, altura, edad o género). ';
        }

        return context;
    } catch (error) {
        console.error('Error fetching user context:', error);
        return 'Error al obtener los datos del usuario.';
    }
};

export const getChatHistory = async (userId) => {
    try {
        const query = await pool.query(
            'SELECT role, content FROM (SELECT role, content, created_at FROM chat_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10) sub ORDER BY created_at ASC',
            [userId]
        );
        return query.rows;
    } catch (error) {
        console.error('Error fetching chat history:', error);
        return [];
    }
};

export const saveChatMessage = async (userId, role, content) => {
    try {
        const query = await pool.query(
            'INSERT INTO chat_history (user_id, role, content) VALUES ($1, $2, $3) RETURNING id',
            [userId, role, content]
        );
        return query.rows[0].id;
    } catch (error) {
        console.error('Error saving chat message:', error);
        return null;
    }
};

export const generateGeminiResponse = async (userId, message) => {
    try {
        const context = await getContextForUser(userId);
        const history = await getChatHistory(userId);
        const model = getGeminiModel();

        const systemPrompt = `Eres un entrenador personal certificado y nutricionista experto. Respondes EXCLUSIVAMENTE en español. Tienes acceso a los siguientes datos personales del usuario: [${context}]. Si el usuario tiene nombre, dirígete a él por su nombre de forma natural. Si ya tienes sus métricas calculadas (IMC, TMB, calorías), NO le pidas esos datos de nuevo, úsalos directamente en tus respuestas y recomendaciones. Eres directo y práctico: ve al grano sin frases motivacionales de relleno. Cuando te pidan una rutina, dieta o plan, dalo COMPLETO con todos los días, ejercicios, series y repeticiones. Cuando te pidan un análisis, usa las métricas ya calculadas y añade recomendaciones concretas. Nunca cortes una respuesta a mitad ni dejes listas incompletas. Usa el historial para mantener el contexto de la conversación.`;

        const geminiHistory = history.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        const chat = model.startChat({
            history: [
                {
                    role: 'user',
                    parts: [{ text: systemPrompt }]
                },
                {
                    role: 'model',
                    parts: [{ text: 'Entendido. Estoy listo para ayudarte como tu entrenador personal y experto en nutrición.' }]
                },
                ...geminiHistory
            ],
            generationConfig: {
                maxOutputTokens: 8192,
            }
        });

        await saveChatMessage(userId, 'user', message);

        console.log(`Llamando a Gemini para el usuario ${userId}...`);
        const result = await chat.sendMessage(message);
        const response = await result.response;
        const responseText = response.text();

        await saveChatMessage(userId, 'assistant', responseText);

        return responseText;
    } catch (error) {
        console.error('--- ERROR DETALLADO EN GEMINI SERVICE ---');
        console.error('Mensaje:', error.message);
        if (error.status) console.error('Status:', error.status);
        if (error.response) console.error('Response Data:', JSON.stringify(error.response, null, 2));

        return "Lo siento, tengo problemas técnicos procesando tu mensaje ahora mismo. Por favor, inténtalo de nuevo más tarde.";
    }
};
