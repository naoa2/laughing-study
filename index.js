const express = require('express');
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

// 外部サービス連携（RenderのEnvironment Variablesで設定）
cloudinary.config({ 
  cloud_name: process.env.C_NAME, 
  api_key: process.env.C_KEY, 
  api_secret: process.env.C_SECRET 
});
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: { rejectUnauthorized: false } 
});

app.use(express.static('public'));
app.use(express.json({limit: '100mb'}));

io.on('connection', async (socket) => {
    // 初回同期（最新100件）
    const res = await pool.query('SELECT * FROM posts ORDER BY id DESC LIMIT 100');
    socket.emit('sync-all', res.rows);

    // 新規投稿処理（画像はCloudinaryへ）
    socket.on('save-log', async (data) => {
        let finalImg = data.i;
        if(data.i && data.i.startsWith('data:image')) {
            const up = await cloudinary.uploader.upload(data.i, { folder: "bbs" });
            finalImg = up.secure_url;
        }
        await pool.query(
            'INSERT INTO posts (n, m, i, d, points) VALUES ($1, $2, $3, $4, 0)',
            [data.n, data.m, finalImg, data.d]
        );
        const refresh = await pool.query('SELECT * FROM posts ORDER BY id DESC LIMIT 100');
        io.emit('sync-all', refresh.rows);
    });

    // Reddit風：いいね機能
    socket.on('vote', async (id) => {
        await pool.query('UPDATE posts SET points = points + 1 WHERE id = $1', [id]);
        const refresh = await pool.query('SELECT * FROM posts ORDER BY id DESC LIMIT 100');
        io.emit('sync-all', refresh.rows);
    });

    socket.on('admin-del', async (id) => {
        await pool.query('DELETE FROM posts WHERE id = $1', [id]);
        const refresh = await pool.query('SELECT * FROM posts ORDER BY id DESC LIMIT 100');
        io.emit('sync-all', refresh.rows);
    });
});

http.listen(process.env.PORT || 3000);
