import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Multi-Vendor E-commerce API',
      version: '1.0.0',
      description: 'API documentation for the Multi-Vendor platform with KhataBook functionality',
    },
    servers: [{ url: '/api', description: 'API server' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/modules/*/*.routes.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
