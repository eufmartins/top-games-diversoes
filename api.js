require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const sanitizeHtml = require('sanitize-html');

const app = express();
const port = process.env.PORT || 3000;

// Middlewares de segurança
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use(limiter);

// Pool de conexões MySQL
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Sanitização de inputs
const sanitizeInput = (input) => {
    if (!input) return '';
    return sanitizeHtml(input.toString(), {
        allowedTags: [],
        allowedAttributes: {}
    });
};

// Rota para listar todas as músicas ativas
app.get('/api/songs', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT CODIGO, CANTOR, \`TITULO DA MUSICA\` as song_title, 
             \`INICIO DA LETRA\` as lyric_start, GENERO, ATIVO 
             FROM mytable WHERE ATIVO = 'S' 
             ORDER BY CANTOR, \`TITULO DA MUSICA\``
        );
        res.json(rows);
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Erro ao buscar músicas' });
    }
});

// Rota de busca
app.get('/api/songs/search', async (req, res) => {
    try {
        const { q, genres } = req.query;
        let query = `SELECT CODIGO, CANTOR, \`TITULO DA MUSICA\` as song_title, 
                    \`INICIO DA LETRA\` as lyric_start, GENERO 
                    FROM mytable WHERE ATIVO = 'S'`;
        const params = [];

        if (q) {
            query += ` AND (MATCH(CANTOR, \`TITULO DA MUSICA\`, \`INICIO DA LETRA\`) 
                      AGAINST(? IN BOOLEAN MODE) OR CANTOR LIKE ? OR \`TITULO DA MUSICA\` LIKE ?)`;
            params.push(q + '*', `%${q}%`, `%${q}%`);
        }

        if (genres) {
            const genreList = genres.split(',').map(g => sanitizeInput(g.trim()));
            query += ' AND GENERO IN (?)';
            params.push(genreList);
        }

        query += ' ORDER BY CANTOR, `TITULO DA MUSICA`';

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Erro na busca' });
    }
});

// Middleware para tratamento de erros
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Erro interno do servidor' });
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});