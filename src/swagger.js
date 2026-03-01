import swaggerJsdoc from 'swagger-jsdoc';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'FitForge API',
            version: '1.0.0',
            description: 'Backend API for FitForge fitness app',
        },
        servers: [{ url: 'https://fit-forge-api.vercel.app' }, { url: 'http://localhost:4000' }],
        components: {
            securitySchemes: {
                cookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'token',
                },
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        type: { type: 'string', example: 'error' },
                        message: { type: 'string' },
                    },
                },
                Success: {
                    type: 'object',
                    properties: {
                        type: { type: 'string', example: 'success' },
                        message: { type: 'string' },
                    },
                },
            },
        },
    },
    apis: ['./src/routes/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
