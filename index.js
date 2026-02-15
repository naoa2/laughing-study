const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.use(express.json());
app.use(express.static('public'));

// 投稿データ（本来はDBに保存）
let posts = [
    { id: 1, text: "テスト投稿: 学校のPCからこんにちは", points: 10, replies: [] }
];

// リアルタイム通信
io.on('connection', (socket) => {
    socket.emit('init-posts', posts);
    
    socket.on('new-post', (data) => {
        const post = { id: Date.now(), text: data.text, points: 0, image: data.image, replies: [] };
        posts.unshift(post); // 新着を上に
        io.emit('update-posts', posts);
    });

    socket.on('vote', (id) => {
        const post = posts.find(p => p.id === id);
        if(post) post.points++;
        io.emit('update-posts', posts);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));
