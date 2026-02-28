import { generateGeminiResponse, getChatHistory } from '../services/gemini.service.js';

export const handleChatMessage = async (req, res) => {
    try {
        const { message } = req.body;
        const { userId } = req.user;

        if (!message) {
            return res.status(400).json({ error: 'The message is required.' });
        }

        const response = await generateGeminiResponse(userId, message);

        res.status(200).json({ response });
    } catch (error) {
        console.error('Error in handleChatMessage:', error);
        res.status(500).json({ error: 'Internal server error while processing the message' });
    }
};

export const fetchChatHistory = async (req, res) => {
    try {
        const { userId } = req.user;
        const history = await getChatHistory(userId);
        res.status(200).json({ history });
    } catch (error) {
        console.error('Error in fetchChatHistory:', error);
        res.status(500).json({ error: 'Internal server error while retrieving history' });
    }
};

export const deleteData = async (req, res) => {
    try {
        const { userId } = req.user;
        await deleteChatHistory(userId);
        res.status(200).json({ message: 'Data successfully deleted' });
    } catch (error) {
        console.error('Error in deleteData:', error);
        res.status(500).json({ error: 'Internal server error when deleting data' });
    }
};