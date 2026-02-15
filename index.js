const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

// Renderのディスクまたは一時保存用。再起動対策
const adapter = new FileSync('/opt/render/project/src/data/db.json');
const db = low(adapter);
db.defaults({ posts: [] }).write();

app.use(express.static('public'));
app.use(express.json({limit: '50mb'}));

io.on('connection', (socket) => {
    socket.emit('sync-all', db.get('posts').value());

    socket.on('save-log', (data) => {
        const newPost = { id: Date.now(), ...data, points: 0 };
        db.get('posts').unshift(newPost).write();
        io.emit('sync-all', db.get('posts').value());
    });

    socket.on('vote', (id) => {
        db.get('posts').find({ id }).update('points', n => n + 1).write();
        io.emit('sync-all', db.get('posts').value());
    });

    socket.on('admin-del', (id) => {
        db.get('posts').remove({ id }).write();
        io.emit('sync-all', db.get('posts').value());
    });
});

http.listen(process.env.PORT || 3000);
