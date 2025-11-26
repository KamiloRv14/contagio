    import express from 'express';
    import path from 'path';
    import { fileURLToPath } from 'url';

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const app = express();
    const PORT = process.env.PORT || 3000; // You can choose a different port

    // Serve static files from a 'public' directory
    app.use(express.static(path.join(__dirname, 'public')));

    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });