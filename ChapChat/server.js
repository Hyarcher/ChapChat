"use strict";

const express = require("express");
const app = express();
const { ExpressPeerServer } = require('peer');
const bodyParser = require("body-parser");
const fs = require("fs");
const usersFile = 'users.json';
let userData = [];

// Information for reaching the website via the url.
console.log("The server is now running! Please go to http://localhost:8080 in your chosen web browser");

// Using the public folder for resources.
app.use(express.static("public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

// Port number for the server.
const server = app.listen(8080);

const peerserver = ExpressPeerServer(server);

app.use('/api', peerserver);

// Loads the index page as the first page to be displayed.
app.get("/", function(req, res) {
  res.sendFile(__dirname + "/public/index.html");
});

async function setUserData(){
  userData = await getData(usersFile);
  console.log(userData);
}

setUserData();

async function getData(file){
  try {
    const data = await fs.readFileSync(file);
    const parsed = JSON.parse(data);
    console.log(parsed);
    return parsed.users;
  } catch(error) {
    // file not found
  }
  return [];
}

function saveData(file, data){
  console.log(userData);
  fs.writeFileSync(file, JSON.stringify({users:data}));
}

function getUser(req, res, next){
  console.log(userData);
  let user;
  if(req.query.id){
    const id = req.query.id;
    user = userData.find(e =>{
          return e.lastId === id;
      });
  } else {
    const email = req.query.email;
    user = userData.find(e =>{
          return e.email === email;
      });
  }
  if(user !== undefined){
    res.send({success:true, user});
  } else {
    res.send({success:false});
  }
  next();
}

function register(req, res, next){
  const name = req.query.name;
  const email = req.query.email;
  const publicKey = req.query.publicKey;
  const unique = userData.find(e =>{
        return e.email === email;
    }) === undefined;
  if(unique){
    userData.push({name, email, publicKey, contacts:[]});
    res.send({success:true});
    saveData(usersFile, userData);
  } else {
    res.send({success:false});
  }
  next();
}

function updateId(req, res, next){
  const email = req.query.email;
  const id = req.query.id;
  const user = userData.find(e =>{
        return e.email === email;
    });
  if(user !== undefined){
    user.lastId = id;
    res.send({success:true, user});
    saveData(usersFile, userData);
  } else {
    res.send({success:false});
  }
  next();
}

function updateKey(req, res, next){
  const email = req.query.email;
  const pubKey = req.query.publicKey;
  const user = userData.find(e =>{
        return e.email === email;
    });
  if(user !== undefined){
    user.publicKey = pubKey;
    res.send({success:true, user});
    saveData(usersFile, userData);
  } else {
    res.send({success:false});
  }
  next();
}

function addContact(req, res, next){
  const email = req.query.email;
  const contact = req.query.contact;
  const user = userData.find(e =>{
        return e.email === email;
    });
  const contactUser = userData.find(e =>{
        return e.email === contact;
    });
  if(user !== undefined){
    if(contactUser !== undefined){
      user.contacts.push(contact);
      res.send({success:true, contact:contactUser, contacts:user.contacts});
      saveData(usersFile, userData);
    } else {
      res.send({success:false, error:"No contact found"});
    }
  } else {
    res.send({success:false});
  }
  next();
}

/* deleteContact function, gets the index of the contact that is to be
 deleted and splices the contact from the JSON file. */

function deleteContact(req, res, next){
  const email = req.query.email;
  const targetContact = req.query.contact;
  const user = userData.find(e =>{
        return e.email === email;
    });

  let contact = 0;

  for (let i = 0; i < user.contacts.length; i++) {
      if (user.contacts[i] === targetContact) {
          contact = i;
      }
  }

  if(user !== undefined){
    if(contact !== undefined){
      user.contacts.splice(contact, 1);
      res.send({success:true, contact:contact, contacts:user.contacts});
      saveData(usersFile, userData);
    } else {
      res.send({success:false, error:"No contact found"});
    }
  } else {
    res.send({success:false});
  }
  next();
}

app.use('/api/register', register);
app.use('/api/getuser', getUser);
app.use('/api/updateid', updateId);
app.use('/api/updatekey', updateKey);
app.use('/api/addcontact', addContact);
app.use('/api/deleteContact', deleteContact);
