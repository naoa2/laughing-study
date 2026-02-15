const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.use(express.static('public'));
app.use(express.json({limit: '50mb'})); // これで画像も長文もOK

let posts = []; // 無料枠なのでメモリに保存（再起動でリセットされるが共有は可能）

io.on('connection', (socket) => {
    socket.emit('sync-all', posts);

    socket.on('save-log', (data) => {
        const newPost = { id: Date.now(), ...data, points: 0 };
        posts.unshift(newPost);
        if(posts.length > 300) posts.pop(); // 300件まで保持
        io.emit('sync-all', posts);
    });

    socket.on('vote', (id) => {
        const post = posts.find(p => p.id === id);
        if(post) post.points = (post.points || 0) + 1;
        io.emit('sync-all', posts);
    });

    socket.on('admin-del', (id) => {
        posts = posts.filter(x => x.id !== id);
        io.emit('sync-all', posts);
    });
});

const PORT = process.env.PORT || 10000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
