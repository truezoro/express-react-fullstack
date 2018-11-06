import { MongoClient } from 'mongodb';

// todo... get PROD url
const url = `mongodb://localhost:27017/organizer`;

// todo... move this initializer function into own file

// todo... add server routes
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

import uuid from 'uuid';
import md5 from 'md5';
import './initialize-db';

import { connectDB } from './connect-db'

let port = 7777;
let app = express();

const authorizationTokens = [];

app.use(
    cors(),
    bodyParser.urlencoded({extended:true}),
    bodyParser.json()
);
app.listen(port,console.info("Server running, listening on port ", port));

async function assembleUserState(user){

    let db = await connectDB();

    let tasks = await db.collection(`tasks`).find({owner:user.id}).toArray();
    let comments = await db.collection(`comments`).find({task:{$in:tasks.map(task=>task.id)}}).toArray();
    let users = await db.collection(`users`).find({id:{$in:[...tasks,comments].map(x=>x.owner)}}).toArray();

    let state = {
        session:{authenticated:`AUTHENTICATED`,id:user.id},
        groups:await db.collection(`groups`).find({owner:user.id}).toArray(),
        tasks,
        users,
        comments
    };

    return state;
}

app.post('/authenticate',async (req,res)=>{
    let { username, password } = req.body;
    // let user = defaultState.users.find(user=>user.name === username);
    let db = await connectDB();
    let collection = db.collection(`users`);

    let user = await collection.findOne({name:username});
    console.log("User?",user,username);
    if (!user) {
        return res.status(500).send(`User not found`);
    }

    let hash = md5(password);
    let passwordCorrect = hash === user.passwordHash;
    if (!passwordCorrect) {
        return res.status(500).send('Password incorrect');
    }

    let token = uuid();

    authorizationTokens.push({
        token,
        userID: user.id
    });

    let state = await assembleUserState(user);

    res.send({token,state});
});

app.post('/task/new',async (req,res)=>{
    let task = req.body.task;
    let db = await connectDB();
    let collection = db.collection(`tasks`);
    await collection.insertOne(task);
    res.status(200).send();
});


app.post('/comment/new',async (req,res)=>{
    let comment = req.body.comment;
    let db = await connectDB();
    let collection = db.collection(`comments`);
    await collection.insertOne(comment);
    res.status(200).send();
});