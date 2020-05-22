let user = {};
const connections = {};
let keyPair = {};
let sharedKey = {};

function addTextboxEvents(textbox, button, callback) {
  textbox.addEventListener('keydown', e => {
    if (e.keyCode === 13 && !e.shiftKey) {
      e.preventDefault();
      callback(textbox);
    }
  });
  button.addEventListener('click', e => {
    callback(textbox);
  });
}

// Sign in button on start page
addTextboxEvents(document.getElementById("signInID"),
  document.getElementById("signInButton"), function(id){
    signIn(id.value);
});

// Register button on start page
 addTextboxEvents(document.getElementById("registerEmail"),
  document.getElementById("registerButton"), async function(id){
    const name = document.getElementById("registerName");
    keyPair = generateKeyPair();
    // KeyPair.publicKey is a Uint8Array which needs to be converted to a typeless
    //array in order to be stringified. Then it's encoded
    const encodedKey = encodeURIComponent(JSON.stringify(Array.from(keyPair.publicKey)));
    // Sends the data to the JSON file.
    const response = await fetch(`api/register?name=${name.value}&email=${id.value}&publicKey=${encodedKey}`);
    const data = await response.json();
    console.log(data);
    if(data.success){
      saveKeyPair(keyPair, id.value);
      signIn(id.value);
    }
 });

// SignIn function ran when the user signs in to check if they exist and then
// generate a new kaey pair if needed
async function signIn(email){
    const response = await fetch(`api/getuser?email=${email}`);
    const data = await response.json();
    console.log(data);
    if(data.success){
      try {
        keyPair = retrieveKeyPair(email);
      } catch(e) {
        if(confirm(`Can't find the private key for ${email} on this machine, generate new key pair?`)){
          keyPair = generateKeyPair();
          const encodedKey = encodeURIComponent(JSON.stringify(Array.from(keyPair.publicKey)));
          const response = await fetch(`api/updatekey?email=${email}&publicKey=${encodedKey}`);
        }
      }
      // Creates the peer to be used for each user
      const user = data.user;
      const peer = new Peer({
        host: '/',
        port: '8080',
        path: '/api',
        debug: 3
      });
      begin(peer, user);
    } else {
      window.alert('Email not found');
    }
}

// Ran as the the user signs in and performs everything insdie the main application
function begin(peer, user){
  console.log(user.contacts);
  populateContacts(user.contacts);

  // When the home page loads the peer id is set
  peer.on('open', async function(id) {
    console.log('My peer ID is: ' + id);
    document.querySelector('#myid').textContent = user.email;
    const response = await fetch(`api/updateid?email=${user.email}&id=${id}`);
    const data = await response.json();

    signInBackground.classList.add("hideContent");
    console.log(data);

    document.getElementById('signOut').addEventListener('click', e => {
      signOut();
    });

    // If the sign out button is pressed this function is run to disconnect
    // the current user from the peer server
    function signOut(){
      peer.disconnect();
      let signInBackground = document.getElementById("signInBackground");
      signInBackground.classList.remove("hideContent");
      document.querySelector('#myid').textContent = '';
    }
  });

  peer.on('connection', function(conn) {
    console.log('Incoming connection from: ' + conn.peer);
    connectionMade(conn);
  });

  // When the users adds a contact the JSON is checked to see if that user exists.
  // The populateContacts function is run to add this contact to the web page
  addTextboxEvents(document.getElementById("addContactBox"),
   document.getElementById("submitAddContact"), async function(id){
     const response = await fetch(`api/addcontact?email=${user.email}&contact=${id.value}`);
     const data = await response.json();
     try {
       populateContacts(data.contacts);
     } catch {
       window.alert('Contact does not exist');
     }
  });

   // populateContacts gets the contact list from the user and displays it in the web page
   function populateContacts(contacts){
     const contactsList = document.getElementById('contactsList');
     contactsList.innerHTML = '';
     contacts.forEach(async contact => {
       console.log(contact);
       const li = document.createElement('li');
       const span = document.createElement('span');
       const connectButton = document.createElement('button');
       const disconnectButton = document.createElement('button');
       const deleteButton = document.createElement('button');

       const response = await fetch(`api/getuser?email=${contact}`);
       const data = await response.json();

       span.textContent = contact;
       connectButton.textContent = 'Connect';
       disconnectButton.textContent = 'Disconnect';
       deleteButton.textContent = 'Delete contact';

       // Attempts to reconnect the two previously disconnected users when the button is pressed
       connectButton.addEventListener('click', e =>{
         if (peer.disconnected === false){
           connectionPrep({value:contact});
           li.appendChild(disconnectButton);
           connectButton.remove();
         } else {
           peer.reconnect();
         }
       });

       // Disconnects the user from the current connected contact
       disconnectButton.addEventListener('click', e =>{
         connections[contact].close();
         disconnectButton.remove();
         li.appendChild(connectButton);
       });

       // Deletes the contact from the JSON
       deleteButton.addEventListener('click', e =>{
         deleteContact(user,{value:contact});
       });

       // Finds the contact within the user in the JSON
       async function deleteContact(user, contact) {
         const response = await fetch(`api/deleteContact?email=${user.email}&contact=${contact.value}`);
         const data = await response.json();
         try {
           populateContacts(data.contacts);
         } catch {
           window.alert('Error deleting contact');
         }
       }
       li.appendChild(span);
       li.appendChild(connectButton);
       li.appendChild(deleteButton);
       contactsList.appendChild(li);
     });
   }

   async function connectionPrep(id){
     const response = await fetch(`api/getuser?email=${id.value}`);
     const data = await response.json();
     if(data.success){
       if(data.user.lastId){
         connectToPeer(data.user.lastId, id.value);
         document.querySelector('#connectedTo').textContent = data.user.email;
         id.value = '';
       }
     }
   }

  // A function that allows the user to connect to another peer
  // by using their peer ID
  function connectToPeer(id, email) {
    const conn = peer.connect(id, {serialization: 'json'});
    connections[email] = conn;
    // On connection of the peers, the new ID is logged in the page
    conn.on('open', function() {
        connectionMade(conn);
      });
    }

  // This function is called when two peers are connected. It gets the user that you are connected
  // to from the JSON and prints them on the web page. It also creates the shared key for encryption
  // and decryption for ther messages. This is done through tht use of the TweetNacl library
  async function connectionMade(conn) {
    const response = await fetch(`api/getuser?id=${conn.peer}`);
    const data = await response.json();
    document.querySelector('#connectedTo').textContent = data.user.email;
    // Decodes the users public key
    const decodedPubKey = new Uint8Array(JSON.parse(decodeURIComponent(data.user.publicKey)));
    sharedKey = nacl.box.before(decodedPubKey, keyPair.secretKey);
    // Receive messages
    conn.on('data', function(data) {
      // Decrypts the message recieved using the shared key
      addMessage(decrypt(sharedKey, data));
    });

    // Runs the sendMessage function when submit message is clicked
    addTextboxEvents(document.getElementById("messageBox"),
    document.getElementById("submitMessage"), function(message){
      sendMessage(conn, message.value);
      message.value = '';
    });

    function sendMessage(conn, message) {
      // Gets the message inside the text box
      const messageBox = document.getElementById('messageBox').value;
      if(messageBox.length > 0){
        // Encrypts the message using the shared key
        conn.send(encrypt(sharedKey, message));
      }

      const list = document.createElement('li');
      if(message.length > 0){
        list.textContent = message;
        list.classList.add("sentMessage");
        document.getElementById('messagesSent').appendChild(list);
      }
    }

    // Takes the recieved message and adds it to the webpage
    function addMessage(message) {
      const list = document.createElement('li');
      list.textContent = message;
      list.classList.add("receivedMessage");
      document.getElementById('messagesSent').appendChild(list);
    }
  }
}

function saveKeyPair(keyPair, email) {
    const serialised = JSON.stringify({
        secret: Array.from(keyPair.secretKey),
        public: Array.from(keyPair.publicKey)
    });
    window.localStorage.setItem(email,serialised);
}

function retrieveKeyPair(email) {
    const parsed = JSON.parse(window.localStorage.getItem(email));
    const keyPair = {
        publicKey: new Uint8Array(parsed.public),
        secretKey: new Uint8Array(parsed.secret)
    }
    return keyPair;
}
