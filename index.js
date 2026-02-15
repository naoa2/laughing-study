const express = require('express');
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

// Cloudinary設定 (画像倉庫)
cloudinary.config({ 
  cloud_name: process.env.C_NAME, 
  api_key: process.env.C_KEY, 
  api_secret: process.env.C_SECRET 
});

// Supabase/PostgreSQL設定 (文字倉庫)
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

app.use(express.static('public'));
app.use(express.json({limit: '100mb'})); // 超大容量OK

io.on('connection', async (socket) => {
    // 1. 接続時にDBから全投稿を取得（文字数制限なし）
    const res = await pool.query('SELECT * FROM posts ORDER BY id DESC');
    socket.emit('sync-all', res.rows);

    // 2. 新規投稿（画像はCloudinaryへ飛ばす）
    socket.on('save-log', async (data) => {
        let finalImg = data.i;
        if(data.i && data.i.startsWith('data:image')) {
            const uploadRes = await cloudinary.uploader.upload(data.i, { folder: "school_bbs" });
            finalImg = uploadRes.secure_url; // 外部URLに変換
        }
        
        const ins = await pool.query(
            'INSERT INTO posts (n, m, i, d, points) VALUES ($1, $2, $3, $4, 0) RETURNING *',
            [data.n, data.m, finalImg, data.d]
        );
        const all = await pool.query('SELECT * FROM posts ORDER BY id DESC');
        io.emit('sync-all', all.rows);
    });

    // 3. Reddit風「いいね」機能
    socket.on('vote', async (id) => {
        await pool.query('UPDATE posts SET points = points + 1 WHERE id = $1', [id]);
        const all = await pool.query('SELECT * FROM posts ORDER BY id DESC');
        io.emit('sync-all', all.rows);
    });
});

http.listen(process.env.PORT || 3000);
